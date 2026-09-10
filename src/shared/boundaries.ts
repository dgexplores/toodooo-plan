/** Network boundary inventory (B-021, R-17). SINGLE SOURCE for the CI gate
 *  (listeners-boundary test) and the in-app data-flow page: both read this
 *  table, so docs, tests and UI cannot drift apart. */

export interface BoundaryRow {
  /** Source file owning the listener. The test scans for .listen() calls. */
  file: string;
  /** What it is, in plain words. */
  surface: string;
  /** Where it binds. */
  scope: 'uds-file' | 'loopback' | 'public-tunnel';
  /** How callers prove themselves. */
  auth: string;
  /** What leaves the machine through it. */
  egress: string;
}

export const BOUNDARIES: BoundaryRow[] = [
  {
    file: 'src/main/hooks.ts',
    surface: 'Agent hook socket (lifecycle events)',
    scope: 'uds-file',
    auth: 'Per-boot token (HIVE_HOOK_TOKEN), fail-closed',
    egress: 'Nothing leaves; local agents report in'
  },
  {
    file: 'src/main/telemetry.ts',
    surface: 'OTLP loopback collector (usage metrics)',
    scope: 'loopback',
    auth: 'None — local-only; spoofable by local processes (known debt)',
    egress: 'Aggregated anonymous counts to PostHog only if a key is built in (forks: dark)'
  },
  {
    file: 'src/main/slack.ts',
    surface: 'Slack events inlet + thread replies',
    scope: 'public-tunnel',
    auth: 'HMAC-SHA256 + replay window; per-message secrets stay main-side',
    egress: 'Channel text the user wired; replies the user approved'
  },
  {
    file: 'src/main/webhook.ts',
    surface: 'Generic trigger endpoints + Tunnel',
    scope: 'public-tunnel',
    auth: 'Per-endpoint secret (constant-time) + global/per-endpoint rate limits',
    egress: 'Nothing outbound; inbound bodies route to god as tasks'
  },
  {
    file: 'src/main/hive.ts',
    surface: 'Preview server (ephemeral file previews)',
    scope: 'loopback',
    auth: 'None — loopback only',
    egress: 'Nothing leaves the machine'
  },
  {
    file: 'src/main/whatsappServer.ts',
    surface: 'WhatsApp Cloud API inlet (challenge + HMAC posts)',
    scope: 'loopback',
    auth: 'Verify-token handshake + per-request HMAC-SHA256 + sender allowlist + dedupe; public reach via tunnel (Settings shows URL)',
    egress: 'Allowlisted sender text routes to god as tasks; replies via vault phone token'
  },
  {
    file: 'src/main/integrationBroker.ts',
    surface: 'Integration broker (REST templates for workers)',
    scope: 'loopback',
    auth: 'Per-worker capability token',
    egress: 'Only to user-configured endpoints, with user-held credentials'
  }
];

/** Data-flow promises (R-17): what the app guarantees about user data. */
export const DATA_PROMISES: string[] = [
  'Prompts, code, transcripts and file paths never leave the machine except through integrations the user explicitly configured (Slack, webhooks, WhatsApp, provider CLIs they already run).',
  'Secrets travel renderer→main only, live encrypted at rest, and never appear in logs, git history, or backups by default.',
  'No analytics SDK ships decisions: local counts only, no PostHog key in community builds.',
  'Every listener above is pinned by CI: a new network surface fails the build until its row lands here.'
];
