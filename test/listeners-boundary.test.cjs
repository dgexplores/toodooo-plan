'use strict';

/**
 * B-021: docs once claimed "no listeners beyond the Unix socket" while TCP +
 * tunnels existed. This test pins the true inventory: every listener in main
 * must be on this list with its scope, and any NEW listener fails here until
 * the table (and its auth story) is updated alongside it.
 *
 * Table: file → bind scope → auth.
 * - hooks.ts: UDS file (or win32 named pipe) → HIVE_HOOK_TOKEN per-boot (B-006)
 * - telemetry.ts: OTLP loopback collector → none (local-only; spoofable — debt)
 * - slack.ts ×2: public tunnel port (HMAC) + 127.0.0.1 reply (token)
 * - webhook.ts: public tunnel port (per-endpoint secret + rate limits)
 * - hive.ts:3575: 127.0.0.1:0 preview server (loopback)
 * - integrationBroker.ts: 127.0.0.1 broker (capability token)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function src(p) {
  return fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
}

const EXPECTED = [
  'src/main/hooks.ts',
  'src/main/telemetry.ts',
  'src/main/slack.ts',
  'src/main/webhook.ts',
  'src/main/hive.ts',
  'src/main/integrationBroker.ts'
];

test('no listener outside the documented inventory', () => {
  const found = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.ts')) continue;
      const text = fs.readFileSync(p, 'utf8');
      if (/\.listen\(/.test(text)) found.push(path.relative(path.join(__dirname, '..'), p));
    }
  };
  walk(path.join(__dirname, '..', 'src', 'main'));
  assert.deepEqual(
    found.sort(),
    EXPECTED.sort(),
    `listener inventory changed — update the B-021 table above AND the auth story, then this list: extra=${found.filter((f) => !EXPECTED.includes(f))}`
  );
});

test('UDS hook server requires the per-boot token (B-006 gate present)', () => {
  assert.match(src('src/main/hooks.ts'), /checkHookToken/);
});

test('public-surface servers carry auth + limits', () => {
  const slack = src('src/main/slack.ts');
  assert.match(slack, /timingSafeEqual/);
  const webhook = src('src/main/webhook.ts');
  assert.match(webhook, /timingSafeEqual/);
  assert.match(webhook, /RATE|rateLimit|120/);
});
