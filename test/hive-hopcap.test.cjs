'use strict';

/**
 * B-002: the hop cap was checked but never incremented — forwards preserved
 * hops, so a request<->reply ping-pong rode the router forever (one git commit
 * per turn). Every forward must consume one hop; past the cap the runaway
 * escalates to god instead of vanishing or looping.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { HiveManager } = loadTs('src/main/hive.ts');

async function floor(t, { god = true } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-hopcap-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  if (god) await hive.ensureAgent({ id: 'god-1', name: 'Michael', provider: 'claude', cwd: home, isGod: true });
  await hive.ensureAgent({ id: 'jim-1', name: 'Jim', provider: 'claude', cwd: home });
  await hive.ensureAgent({ id: 'pam-1', name: 'Pam', provider: 'claude', cwd: home });
  return { hive };
}

const entries = (hive, kind) => hive.logTail(500).filter((e) => e.kind === kind);
const lastInbox = (hive, id) => hive.inbox(id).slice(-1)[0];

test('each forward consumes exactly one hop', async (t) => {
  const { hive } = await floor(t);
  hive.send({ to: 'jim-1', act: 'request', subject: 'build it', body: 'go' }, 'pam-1');
  assert.equal(lastInbox(hive, 'jim-1').hops, 1);
});

test('a reply ping-pong terminates at the cap with god escalation', async (t) => {
  const { hive } = await floor(t);
  // Simulate two agents answering each other, copying hops per PROTOCOL.md.
  let from = 'pam-1';
  let to = 'jim-1';
  let hops = 0;
  let turns = 0;
  for (;;) {
    turns++;
    assert.ok(turns < 40, 'ping-pong must terminate');
    hive.send({ to, act: 'request', subject: `turn ${turns}`, body: 'ping', hops }, from);
    const escalated = hive.inbox('god-1').find((m) => m.subject.endsWith(`turn ${turns}`));
    if (escalated) break;
    // Inbox order is readdir order, not chronological — match our turn.
    const got = hive.inbox(to).find((m) => m.subject === `turn ${turns}`);
    assert.ok(got, `turn ${turns} must be delivered`);
    assert.equal(got.hops, hops + 1, 'delivery consumes one hop');
    hops = got.hops;
    [from, to] = [to, from];
  }
  const escalated = lastInbox(hive, 'god-1');
  assert.match(escalated.subject, /^\[hop-cap/);
  assert.ok(escalated.hops > 12, 'escalation carries the over-cap count');
  const drops = entries(hive, 'drop').filter((e) => e.reason === 'hop-cap');
  assert.equal(drops.length, 1, 'exactly one cap drop per runaway');
});

test('a message arriving at the cap escalates without touching the target', async (t) => {
  const { hive } = await floor(t);
  hive.send({ to: 'jim-1', act: 'request', subject: 'hot', body: 'x', hops: 12 }, 'pam-1');
  assert.equal(hive.inbox('jim-1').length, 0, 'over-cap mail never reaches target');
  assert.match(lastInbox(hive, 'god-1').subject, /^\[hop-cap/);
});

test('bounces carry the incremented hop count', async (t) => {
  const { hive } = await floor(t);
  hive.send({ to: 'ghost', act: 'request', subject: 'lost', body: 'x', hops: 5 }, 'jim-1');
  assert.equal(lastInbox(hive, 'god-1').hops, 6);
});

test('god-absent cap breach logs the drop and stays silent otherwise', async (t) => {
  const { hive } = await floor(t, { god: false });
  hive.send({ to: 'jim-1', act: 'request', subject: 'hot', body: 'x', hops: 12 }, 'pam-1');
  const drops = entries(hive, 'drop').filter((e) => e.reason === 'hop-cap');
  assert.equal(drops.length, 1);
  assert.equal(hive.inbox('jim-1').length, 0);
});
