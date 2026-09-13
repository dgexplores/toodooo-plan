/**
 * WhatsApp Cloud API transport (India wedge, R-05…R-08). Free tier, no paid
 * gateway: Meta hosts receipt; we only verify, parse and reply over HTTPS.
 *
 * Deliberately free of any `electron` import so it unit-tests as plain Node.
 * Secrets (verify token, app secret, phone token) travel renderer→main only
 * and live in the vault/broker — this module receives them as arguments and
 * never persists or logs them.
 *
 * Non-goals here: media transcription (text only; media is skipped loudly),
 * template management, multi-number routing.
 */

/** Hub verification handshake: echo the challenge iff the token matches. */
export function verifyChallenge(
  query: Record<string, string | string[] | undefined>,
  verifyToken: string
): string | null {
  const mode = Array.isArray(query['hub.mode']) ? query['hub.mode'][0] : query['hub.mode'];
  const token = Array.isArray(query['hub.verify_token']) ? query['hub.verify_token'][0] : query['hub.verify_token'];
  const challenge = Array.isArray(query['hub.challenge']) ? query['hub.challenge'][0] : query['hub.challenge'];
  if (mode !== 'subscribe' || typeof token !== 'string' || !token) return null;
  if (typeof challenge !== 'string' || !challenge) return null;
  return timingSafeEqualString(token, verifyToken) ? challenge : null;
}

function timingSafeEqualString(a: string, b: string): boolean {
  // Constant-time compare without node:crypto dependency at call sites that
  // already validated length context — length itself is not secret here
  // (tokens are fixed-format), but early-exit still leaks nothing useful.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify `X-Hub-Signature-256: sha256=<hex>` over the RAW body bytes. */
export async function verifySignature(
  raw: Uint8Array | string,
  signature: string,
  appSecret: string
): Promise<boolean> {
  if (!appSecret || !signature.startsWith('sha256=')) return false;
  try {
    const { createHmac, timingSafeEqual } = await import('node:crypto');
    const mac = createHmac('sha256', appSecret).update(raw).digest('hex');
    const a = Buffer.from(`sha256=${mac}`);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface WhatsAppInbound {
  /** Sender phone / WA id. */
  from: string;
  /** Text body (text messages only — see skip reasons). */
  text: string;
  /** Provider message id (dedupe key for retries). */
  messageId: string;
}

export interface WhatsAppMedia {
  /** Sender phone / WA id. */
  from: string;
  /** Provider message id (dedupe key for retries). */
  messageId: string;
  /** Media type as reported by Meta (image, audio, video, document, sticker…). */
  kind: string;
}

/** Extract inbound TEXT messages; delivery receipts, reactions and media are
 *  skipped with explicit reasons (never crash, never silent-drop). Non-text
 *  with a known sender is ALSO returned as `media` so the caller can leave an
 *  explicit "not supported yet" note instead of dropping it silently. */
export function parseInbound(body: unknown): { messages: WhatsAppInbound[]; skipped: string[]; media: WhatsAppMedia[] } {
  const messages: WhatsAppInbound[] = [];
  const skipped: string[] = [];
  const media: WhatsAppMedia[] = [];
  const entry = (body as Record<string, unknown> | null)?.['entry'];
  if (!Array.isArray(entry)) return { messages, skipped: ['no-entry'], media };
  for (const e of entry) {
    const changes = (e as Record<string, unknown>)?.['changes'];
    if (!Array.isArray(changes)) continue;
    for (const c of changes) {
      const value = (c as Record<string, unknown>)?.['value'] as Record<string, unknown> | undefined;
      if (!value || typeof value !== 'object') continue;
      if (Array.isArray(value['statuses']) && (value['statuses'] as unknown[]).length > 0) {
        skipped.push('status-receipt');
        continue;
      }
      const msgs = value['messages'];
      if (!Array.isArray(msgs)) continue;
      for (const m of msgs) {
        const r = m as Record<string, unknown>;
        const from = typeof r['from'] === 'string' ? (r['from'] as string) : '';
        const id = typeof r['id'] === 'string' ? (r['id'] as string) : '';
        const text = (r['text'] as Record<string, unknown> | undefined)?.['body'];
        if (!from || !id) {
          skipped.push('missing-from-or-id');
          continue;
        }
        if (typeof text !== 'string' || !text.trim()) {
          const kind = typeof r['type'] === 'string' ? (r['type'] as string) : 'unknown';
          skipped.push(`non-text:${kind}`);
          if (from && id && kind !== 'unknown') media.push({ from, messageId: id, kind });
          continue;
        }
        messages.push({ from, text: text.slice(0, 4000), messageId: id });
      }
    }
  }
  return { messages, skipped, media };
}

/** Allowlist gate (R-07): unknown senders never reach agents. Empty list =
 *  nobody allowed (fail closed, explicit allowlist required). */
export function isAllowed(from: string, allowlist: readonly string[]): boolean {
  return allowlist.includes(from);
}

export interface WhatsAppSend {
  phoneNumberId: string;
  token: string;
  to: string;
  text: string;
  apiBase?: string; // injectable for tests; default is the Graph API
}

/** Send a text message. Returns ok/error; never throws. */
export async function sendText(s: WhatsAppSend): Promise<{ ok: boolean; error?: string }> {
  if (!s.phoneNumberId || !s.token || !s.to || !s.text.trim()) {
    return { ok: false, error: 'missing phoneNumberId/token/to/text' };
  }
  const base = (s.apiBase ?? 'https://graph.facebook.com').replace(/\/$/, '');
  let res: Response;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      res = await fetch(`${base}/v21.0/${s.phoneNumberId}/messages`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: s.to, type: 'text', text: { body: s.text.slice(0, 4000) } })
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!res.ok) {
    let detail = `http ${res.status}`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j?.error?.message) detail = j.error.message.slice(0, 200);
    } catch { /* keep status */ }
    return { ok: false, error: detail };
  }
  return { ok: true };
}
