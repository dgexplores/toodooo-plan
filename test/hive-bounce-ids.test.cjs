'use strict';

/**
 * B-004: escalations/bounces reused the original message id, so id-based
 * dedup (voiceMessages) and cursor bookkeeping collapsed original and copy
 * into one — hiding mail. Every escalation is now a new message chained with
 * in_reply_to; the original id is never duplicated.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { HiveManager } = loadTs('src/main/hive.ts');

async function floor(t, { god = true } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-bounce-id-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  if (god) await hive.ensureAgent({ id: 'god-1', name: 'Deepak', provider: 'claude', cwd: home, isGod: true });
  await hive.ensureAgent({ id: 'jim-1', name: 'Jim', provider: 'claude', cwd: home });
  return { home, hive };
}

test('unknown-recipient bounce mints a new id chained to the original', async (t) => {
  const { hive } = await floor(t);
  const sent = hive.send({ to: 'ghost', act: 'request', subject: 'lost', body: 'x' }, 'jim-1');
  const bounce = hive.inbox('god-1')[0];
  assert.ok(bounce, 'bounce delivered');
  assert.notEqual(bounce.id, sent.id, 'bounce must not reuse the original id');
  assert.equal(bounce.in_reply_to, sent.id, 'bounce chains to the original');
  assert.equal(bounce.conversation, sent.conversation, 'conversation preserved');
  assert.equal(bounce.body, 'x', 'body preserved');
});

test('hop-cap escalation mints a new id chained to the runaway', async (t) => {
  const { hive } = await floor(t);
  const sent = hive.send({ to: 'jim-1', act: 'request', subject: 'hot', body: 'x', hops: 12 }, 'pam-1');
  const esc = hive.inbox('god-1').find((m) => m.subject.startsWith('[hop-cap'));
  assert.ok(esc, 'escalation delivered');
  assert.notEqual(esc.id, sent.id);
  assert.equal(esc.in_reply_to, sent.id);
});

test('two bounces of redelivered mail stay distinct under id dedup', async (t) => {
  const { hive } = await floor(t);
  hive.send({ to: 'ghost', act: 'request', subject: 'one', body: 'x' }, 'jim-1');
  hive.send({ to: 'ghost', act: 'request', subject: 'two', body: 'y' }, 'jim-1');
  const ids = hive.inbox('god-1').map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, 'no id may appear twice');
  assert.equal(ids.length, 2);
});

test('dead-letter preserves the original id (no minting on the archive path)', async (t) => {
  const { home, hive } = await floor(t, { god: false });
  const sent = hive.send({ to: 'ghost', act: 'request', subject: 'lost', body: 'x' }, 'jim-1');
  const dir = path.join(home, 'hive', 'dead-letter');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.equal(files.length, 1);
  const archived = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf8'));
  assert.equal(archived.id, sent.id, 'archive keeps the original identity');
  assert.equal(archived.body, 'x');
});
