/**
 * WhatsApp inbound server (R-05…R-08 wiring). One loopback HTTP server:
 *   - GET  /  + hub.verify_token → challenge echo (Meta handshake)
 *   - POST /  + X-Hub-Signature-256 → allowlisted text → onMessage
 * Tunnel + Settings UI arrive with the panel slice; the server exposes its
 * port and a status snapshot meanwhile. Secrets arrive as arguments (vault-
 * backed at the call site), never stored here beyond the secret strings
 * needed to verify while running.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { isAllowed, parseInbound, verifyChallenge, verifySignature } from './whatsapp';
// NOTE: `tunnelmole` is ESM-only; the main process bundles as CJS, so it is
// imported dynamically inside openTunnel (mirrors slack.ts) — never hoisted.

const TUNNEL_START_TIMEOUT_MS = 10_000;

const MAX_BODY_BYTES = 256 * 1024;
const DEDUPE_KEEP = 50;

export interface WhatsAppServerSecrets {
  verifyToken: string;
  appSecret: string;
}

export interface WhatsAppServerOptions {
  port: number;
  allowlist: readonly string[];
  onMessage: (msg: { from: string; text: string; messageId: string }) => void;
  onSkip?: (reasons: string[]) => void;
  /** Non-allowlisted text: held for the owner, never auto-executed (R-07). */
  onHeld?: (msg: { from: string; text: string; messageId: string }) => void;
  /** Allowlisted non-text (image/voice/…): explicit "not yet" note (R-08). */
  onMedia?: (msg: { from: string; messageId: string; kind: string }) => void;
}

export class WhatsAppServer {
  private server: Server | null = null;
  private seen: string[] = [];
  private boundPort = 0;
  private tunnelUrl: string | null = null;

  constructor(
    private secrets: () => WhatsAppServerSecrets,
    private opts: WhatsAppServerOptions
  ) {}

  async start(): Promise<{ ok: boolean; port?: number; url?: string; error?: string }> {
    if (this.server) return { ok: true, port: this.boundPort };
    const s = this.secrets();
    if (!s.verifyToken || !s.appSecret) {
      return { ok: false, error: 'whatsapp secrets not configured' };
    }
    const server = createServer((req, res) => { void this.route(req, res); });
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(this.opts.port, '127.0.0.1', () => resolve());
      });
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
    // Normalize via bound state: a failed listen leaves no address.
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      server.close();
      return { ok: false, error: 'could not bind whatsapp port' };
    }
    this.server = server;
    this.boundPort = (addr as { port: number }).port;
    return { ok: true, port: this.boundPort };
  }

  async stop(): Promise<void> {
    try {
      this.server?.close();
    } catch { /* best-effort */ }
    this.server = null;
    this.boundPort = 0;
    this.tunnelUrl = null;
  }

  get running(): boolean {
    return this.server !== null;
  }

  get url(): string | null {
    return this.tunnelUrl;
  }

  /** Open the public tunnel Meta must reach. Best-effort: a failed tunnel
   *  leaves the loopback handler live (same posture as the Slack server). */
  async openTunnel(): Promise<string | null> {
    if (!this.server) return null;
    try {
      const { tunnelmole } = await import('tunnelmole');
      const url = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timed out')), TUNNEL_START_TIMEOUT_MS);
        tunnelmole({ port: this.boundPort })
          .then((u) => { clearTimeout(timer); resolve(u); })
          .catch((e) => { clearTimeout(timer); reject(e); });
      });
      if (!url) return null;
      this.tunnelUrl = url;
      return url;
    } catch {
      return null;
    }
  }

  private async route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET') {
      const challenge = verifyChallenge(
        Object.fromEntries(url.searchParams.entries()),
        this.secrets().verifyToken
      );
      if (challenge === null) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(challenge);
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    const raw: Buffer = await new Promise((resolve) => {
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size <= MAX_BODY_BYTES) chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', () => resolve(Buffer.concat(chunks)));
    });
    if (size > MAX_BODY_BYTES) {
      res.writeHead(413);
      res.end();
      return;
    }
    const sig = req.headers['x-hub-signature-256'];
    const ok = await verifySignature(raw, Array.isArray(sig) ? (sig[0] ?? '') : (sig ?? ''), this.secrets().appSecret);
    if (!ok) {
      res.writeHead(401);
      res.end();
      return;
    }
    let body: unknown;
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    const { messages, skipped, media } = parseInbound(body);
    if (skipped.length > 0) {
      try {
        this.opts.onSkip?.(skipped);
      } catch { /* observability only */ }
    }
    const fresh = (id: string): boolean => {
      if (this.seen.includes(id)) return false;
      this.seen.push(id);
      this.seen = this.seen.slice(-DEDUPE_KEEP);
      return true;
    };
    for (const m of messages) {
      if (!fresh(m.messageId)) continue;
      if (!isAllowed(m.from, this.opts.allowlist)) {
        try {
          this.opts.onHeld?.(m);
        } catch { /* one bad message must not break the batch */ }
        continue;
      }
      try {
        this.opts.onMessage(m);
      } catch { /* one bad message must not break the batch */ }
    }
    for (const m of media) {
      if (!fresh(m.messageId)) continue;
      try {
        if (!isAllowed(m.from, this.opts.allowlist)) {
          this.opts.onHeld?.({ from: m.from, text: `[${m.kind} — not supported yet]`, messageId: m.messageId });
        } else {
          this.opts.onMedia?.(m);
        }
      } catch { /* one bad message must not break the batch */ }
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  }
}
