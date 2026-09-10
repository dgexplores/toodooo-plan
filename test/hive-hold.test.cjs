'use strict';

/**
 * B-010: hold means 1:1 with the human — fan-out must leave held agents alone
 * (and say so in the log), while explicitly-addressed direct mail still
 * delivers. Digest-on-unhold is future work, noted in broadcast.ts.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { HiveManager } = loadTs('src/main/hive.ts');

async function floor(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-hold-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  await hive.ensureAgent({ id: 'god-1', name: 'Michael', provider: 'claude', cwd: home, isGod: true });
  await hive.ensureAgent({ id: 'jim-1', name: 'Jim', provider: 'claude', cwd: home });
  await hive.ensureAgent({ id: 'pam-1', name: 'Pam', provider: 'claude', cwd: home });
  hive.setAgentHold('pam-1', true);
  return { hive };
}

const entries = (hive, kind) => hive.logTail(500).filter((e) => e.kind === kind);

test('broadcast skips the held agent and logs the skip', async (t) => {
  const { hive } = await floor(t);
  hive.send({ to: 'broadcast', act: 'inform', subject: 'all hands', body: 'x' }, 'god-1');
  assert.ok(hive.inbox('jim-1').some((m) => m.subject === 'all hands'));
  assert.ok(!hive.inbox('pam-1').some((m) => m.subject === 'all hands'), 'held agent must not receive fan-out');
  const skips = entries(hive, 'hold-skip');
  assert.equal(skips.length, 1);
  assert.deepEqual(skips[0].skipped, ['pam-1']);
});

test('direct mail to a held agent still delivers (explicit addressing wins)', async (t) => {
  const { hive } = await floor(t);
  hive.send({ to: 'pam-1', act: 'request', subject: '1:1 question', body: 'x' }, 'god-1');
  assert.ok(hive.inbox('pam-1').some((m) => m.subject === '1:1 question'));
  assert.equal(entries(hive, 'hold-skip').length, 0, 'direct mail never logs a hold-skip');
});

test('unheld broadcast has no hold-skip noise', async (t) => {
  const { hive } = await floor(t);
  hive.setAgentHold('pam-1', false);
  hive.send({ to: 'broadcast', act: 'inform', subject: 'all hands', body: 'x' }, 'god-1');
  assert.ok(hive.inbox('pam-1').some((m) => m.subject === 'all hands'));
  assert.equal(entries(hive, 'hold-skip').length, 0);
});
