'use strict';

/**
 * The hook UDS is reachable by any local process, so every payload must carry
 * the per-boot token (HIVE_HOOK_TOKEN env -> payload.hook_token) and HookServer
 * must ignore anything without it BEFORE any effect (avatars, breaker,
 * control, transcript registry). Fail closed, log the attempt.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const electron = require.resolve('electron');
require.cache[electron] = {
  id: electron,
  filename: electron,
  loaded: true,
  exports: { Notification: class { static isSupported() { return false; } } }
};

const { HiveManager } = loadTs('src/main/hive.ts');
const { HookServer } = loadTs('src/main/hooks.ts');

function floor(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-hooks-auth-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  const logs = [];
  const origAppend = hive.appendLog.bind(hive);
  hive.appendLog = (entry) => {
    logs.push(entry);
    try { origAppend(entry); } catch { /* hive root may not exist in this unit scope */ }
  };
  const server = new HookServer(hive, () => null, () => ({ notifications: false }), undefined, undefined);
  return { hive, server, logs };
}

test('hookToken mints once, persists, owner-only file', (t) => {
  const { hive } = floor(t);
  const a = hive.hookToken();
  const b = hive.hookToken();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, b, 'same boot must see a stable token');
  const st = fs.statSync(hive.hookTokenPath());
  assert.equal(st.mode & 0o777, 0o600, 'token file must be owner-only');
});

test('checkHookToken compares constant-time, rejects junk', (t) => {
  const { hive } = floor(t);
  const tok = hive.hookToken();
  assert.equal(hive.checkHookToken(tok), true);
  assert.equal(hive.checkHookToken('0'.repeat(64)), false);
  assert.equal(hive.checkHookToken('short'), false);
  assert.equal(hive.checkHookToken(null), false);
  assert.equal(hive.checkHookToken(undefined), false);
  assert.equal(hive.checkHookToken(42), false);
});

test('payload without token is ignored with zero effects', (t) => {
  const { server, logs } = floor(t);
  const res = server.handle({
    agent_id: 'mallory',
    session_id: 's1',
    hook_event_name: 'Status',
    transcript_path: '/tmp/evil.jsonl'
  });
  assert.deepEqual(res, {});
  assert.ok(logs.some((e) => e.kind === 'hook-auth-rejected'), 'rejection must be logged');
  assert.equal(server.transcriptPath('mallory'), undefined, 'no state may be recorded');
});

test('payload with wrong token is ignored with zero effects', (t) => {
  const { hive, server, logs } = floor(t);
  hive.hookToken(); // ensure a real token exists so "wrong" is meaningful
  const res = server.handle({
    agent_id: 'mallory',
    session_id: 's1',
    hook_event_name: 'Status',
    hook_token: 'f'.repeat(64),
    transcript_path: '/tmp/evil.jsonl'
  });
  assert.deepEqual(res, {});
  assert.ok(logs.some((e) => e.kind === 'hook-auth-rejected'));
  assert.equal(server.transcriptPath('mallory'), undefined);
});

test('payload with valid token flows through', (t) => {
  const { hive, server, logs } = floor(t);
  const res = server.handle({
    agent_id: 'jim-1',
    session_id: 's1',
    hook_event_name: 'Status',
    hook_token: hive.hookToken(),
    transcript_path: '/tmp/jim.jsonl',
    context_window: { total_input_tokens: 1000, context_window_size: 200000 }
  });
  assert.ok(!logs.some((e) => e.kind === 'hook-auth-rejected'), 'valid token must not be rejected');
  assert.equal(server.transcriptPath('jim-1'), '/tmp/jim.jsonl', 'transcript registry must record');
  assert.ok(res !== undefined);
});
