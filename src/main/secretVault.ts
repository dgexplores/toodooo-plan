/**
 * Config-secret vault (B-020). The four scalar config secrets (Slack signing
 * secret + bot token, Groq key, legacy webhook secret) lived PLAINTEXT in
 * config.json — surviving backups and readable by any same-UID process.
 * They now live encrypted via Electron safeStorage (OS keychain), following
 * the integrations.ts precedent (fail-closed, no plaintext fallback for NEW
 * writes). Legacy plaintext values keep working where encryption is
 * unavailable (some Linux): migration moves what it can and never breaks
 * what it can't — strictly better than today, never worse.
 *
 * Trigger secrets + org key stay in config for now (broader surface; noted
 * debt) — but they never cross IPC anymore (B-019 redaction).
 */
import { safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const VAULT_KEYS = [
  'slackSigningSecret',
  'slackBotToken',
  'groqApiKey',
  'webhookSecret'
] as const;

export type VaultKey = (typeof VAULT_KEYS)[number];

let vaultDir: string | null = null;

/** Point the vault at a directory (production: userData). Must precede use. */
export function initVault(dir: string): void {
  vaultDir = dir;
}

function vaultPath(): string | null {
  return vaultDir ? join(vaultDir, 'config-secrets.json') : null;
}

function readStore(): Record<string, string> {
  const p = vaultPath();
  if (!p) return {};
  try {
    if (!existsSync(p)) return {};
    const raw = JSON.parse(readFileSync(p, 'utf8')) as unknown;
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string' && v) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, string>): void {
  const p = vaultPath();
  if (!p) return;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export function vaultAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/** Decrypted value, or undefined. Never throws. */
export function vaultGet(key: VaultKey): string | undefined {
  try {
    const enc = readStore()[key];
    if (!enc) return undefined;
    if (!vaultAvailable()) return undefined;
    return safeStorage.decryptString(Buffer.from(enc, 'base64'));
  } catch {
    return undefined;
  }
}

/** Encrypt + store. No-op (false) when encryption is unavailable — callers
 *  keep the legacy config path in that case rather than writing plaintext. */
export function vaultSet(key: VaultKey, value: string): boolean {
  try {
    if (!vaultAvailable() || !value) return false;
    const store = readStore();
    store[key] = safeStorage.encryptString(value).toString('base64');
    writeStore(store);
    return true;
  } catch {
    return false;
  }
}

export function vaultHas(key: VaultKey): boolean {
  return vaultGet(key) !== undefined;
}

export function vaultRemove(key: VaultKey): void {
  try {
    const store = readStore();
    if (key in store) {
      delete store[key];
      writeStore(store);
    }
  } catch { /* best-effort */ }
}

export interface VaultMigration {
  moved: VaultKey[];
  keptPlaintext: VaultKey[]; // encryption unavailable — legacy path unchanged
}

/** One-way migration of legacy plaintext config secrets into the vault.
 *  Never destructive on failure: a key leaves config.json only after its
 *  encrypted copy verifies (decrypt round-trip). Idempotent. */
export function migrateConfigSecrets(
  readSecrets: () => Partial<Record<VaultKey, unknown>>,
  clearSecrets: (keys: VaultKey[]) => void
): VaultMigration {
  const out: VaultMigration = { moved: [], keptPlaintext: [] };
  if (!vaultAvailable()) {
    for (const k of VAULT_KEYS) {
      if (typeof readSecrets()[k] === 'string' && (readSecrets()[k] as string)) out.keptPlaintext.push(k);
    }
    return out;
  }
  const current = readSecrets();
  const moved: VaultKey[] = [];
  for (const k of VAULT_KEYS) {
    const v = current[k];
    if (typeof v !== 'string' || !v) continue;
    if (!vaultSet(k, v)) continue;
    if (vaultGet(k) === v) moved.push(k); // verify before clearing
  }
  if (moved.length > 0) {
    try {
      clearSecrets(moved);
    } catch {
      // Config clear failed: encrypted copies already verify, so worst case is
      // duplication (vault wins on read), never loss. Report nothing — next
      // boot retries the clear.
      return { moved: [], keptPlaintext: moved };
    }
  }
  out.moved = moved;
  return out;
}
