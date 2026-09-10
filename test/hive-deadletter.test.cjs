'use strict';

/**
 * B-003 remainder: when god itself is absent, escalations and bounces must not
 * vanish with only a drop log — they are preserved in dead-letter/ with full
 * fidelity. And god→human is intentional non-routing (god IS the human proxy),
 * locked here so nobody "fixes" it into a bounce loop.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { HiveManager } = loadTs('src/main/hive.ts');

async function floor(t, { god = true } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-deadletter-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  if (god) await hive.ensureAgent({ id: 'god-1', name: 'Deepak', provider: 'claude', cwd: home, isGod: true });
  await hive.ensureAgent({ id: 'jim-1', name: 'Jim', provider: 'claude', cwd: home });
  return { home, hive };
}

const entries = (hive, kind) => hive.logTail(500).filter((e) => e.kind === kind);
const deadLetters = (home) => {
  const dir = path.join(home, 'hive', 'dead-letter');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
};

test('god-absent cap breach dead-letters with full fidelity', async (t) => {
  const { home, hive } = await floor(t, { god: false });
  hive.send({ to: 'jim-1', act: 'request', subject: 'hot', body: 'payload-body', hops: 12 }, 'jim-1');
  assert.equal(hive.inbox('jim-1').length, 0);
  const dl = deadLetters(home);
  assert.equal(dl.length, 1, 'exactly one dead letter');
  assert.equal(dl[0].body, 'payload-body');
  assert.equal(dl[0].from, 'jim-1');
  assert.ok(entries(hive, 'dead-letter').length === 1, 'dead-letter is logged');
  assert.ok(entries(hive, 'drop').some((e) => e.reason === 'hop-cap'), 'drop log retained');
});

test('god-absent unknown-recipient bounce dead-letters instead of vanishing', async (t) => {
  const { home, hive } = await floor(t, { god: false });
  hive.send({ to: 'ghost', act: 'request', subject: 'lost', body: 'find me' }, 'jim-1');
  const dl = deadLetters(home);
  assert.equal(dl.length, 1);
  assert.equal(dl[0].body, 'find me');
});

test('god present: no dead-letter dir created on the same paths', async (t) => {
  const { home, hive } = await floor(t, { god: true });
  hive.send({ to: 'ghost', act: 'request', subject: 'lost', body: 'x' }, 'jim-1');
  hive.send({ to: 'jim-1', act: 'request', subject: 'hot', body: 'x', hops: 12 }, 'jim-1');
  assert.equal(deadLetters(home).length, 0, 'god delivery leaves no dead letters');
  assert.equal(hive.inbox('god-1').length, 2);
});

test('god→human routes nowhere by design: logged, not bounced, not dropped', async (t) => {
  const { hive } = await floor(t, { god: true });
  hive.send({ to: 'human', act: 'inform', subject: 'speaking', body: 'hi' }, 'god-1');
  assert.equal(hive.inbox('god-1').length, 0, 'god does not mail itself');
  const logged = entries(hive, 'message').filter((e) => e.subject === 'speaking');
  assert.equal(logged.length, 1);
  assert.deepEqual(logged[0].delivered, []);
  assert.equal(entries(hive, 'drop').length, 0, 'no drop recorded');
});
