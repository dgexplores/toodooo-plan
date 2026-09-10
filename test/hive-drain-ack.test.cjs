'use strict';

/**
 * B-001 (revised): upstream deliberately removed forced continuation at Stop
 * (HITL safety — draining must never spend credits mid-question), so the fix
 * is NOT reconnecting the block. The real defects: the cursor advanced before
 * the agent acted (crash = silently marked processed), and Stop carried no
 * pending content for the renderer wake path. Now the cursor moves only over
 * observed (.done) acks, and Stop reports the pending count.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { HiveManager } = loadTs('src/main/hive.ts');

async function floor(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-drain-ack-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  await hive.ensureAgent({ id: 'god-1', name: 'Michael', provider: 'claude', cwd: home, isGod: true });
  await hive.ensureAgent({ id: 'jim-1', name: 'Jim', provider: 'claude', cwd: home });
  return { home, hive };
}

const cursorOf = (home, id) =>
  JSON.parse(fs.readFileSync(path.join(home, 'hive', 'agents', id, 'cursor.json'), 'utf8'));

// Agent-side handling: move a live inbox file to .done, as PROTOCOL.md instructs.
function handle(home, id, subject) {
  const inbox = path.join(home, 'hive', 'agents', id, 'inbox');
  const f = fs.readdirSync(inbox).find((n) => {
    if (!n.endsWith('.json')) return false;
    try { return JSON.parse(fs.readFileSync(path.join(inbox, n), 'utf8')).subject === subject; }
    catch { return false; }
  });
  assert.ok(f, `no live message with subject ${subject}`);
  fs.renameSync(path.join(inbox, f), path.join(inbox, '.done', f));
}

test('drain lists mail without advancing the cursor', async (t) => {
  const { home, hive } = await floor(t);
  hive.send({ to: 'jim-1', act: 'request', subject: 'do it', body: 'x' }, 'god-1');
  const d = hive.drainForStop('jim-1');
  assert.equal(d.block, true);
  assert.match(d.reason, /do it/);
  assert.equal(cursorOf(home, 'jim-1').lastProcessed, null, 'cursor must not move before the agent acts');
});

test('crash between drain and handling resurfaces the same mail (at-least-once)', async (t) => {
  const { hive } = await floor(t);
  hive.send({ to: 'jim-1', act: 'request', subject: 'do it', body: 'x' }, 'god-1');
  hive.drainForStop('jim-1');
  // ...crash: nothing handled, nothing moved...
  const d2 = hive.drainForStop('jim-1');
  assert.equal(d2.block, true, 'mail must resurface, never be marked processed');
  assert.match(d2.reason, /do it/);
});

test('ackInbox advances only over observed .done acks', async (t) => {
  const { home, hive } = await floor(t);
  hive.send({ to: 'jim-1', act: 'request', subject: 'one', body: 'x' }, 'god-1');
  hive.send({ to: 'jim-1', act: 'request', subject: 'two', body: 'y' }, 'god-1');
  assert.deepEqual(hive.ackInbox('jim-1'), { acked: 0, pending: 2 });
  handle(home, 'jim-1', 'one');
  const r = hive.ackInbox('jim-1');
  assert.equal(r.acked, 1);
  assert.equal(r.pending, 1);
  const d = hive.drainForStop('jim-1');
  assert.match(d.reason, /two: y/, 'only unacked mail is fresh');
  assert.ok(!d.reason.includes('one: x'), 'acked mail must not resurface');
});

test('ackInbox on unknown agent and empty states never throws', async (t) => {
  const { hive } = await floor(t);
  assert.deepEqual(hive.ackInbox('ghost'), { acked: 0, pending: 0 });
  assert.deepEqual(hive.ackInbox('jim-1'), { acked: 0, pending: 0 });
});
