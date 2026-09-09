'use strict';

/**
 * B-005: agents write plain JSON (no tmp+rename), so the router can read a
 * torn file mid-write — which used to mean instant quarantine + loss. Fresh
 * failures now wait a pass; agent rewrites landing mid-route no longer get
 * archived unprocessed. Registry RMW needs no lock (all sites synchronous —
 * locked here so nobody adds one, or an await inside a window, blindly).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { HiveManager } = loadTs('src/main/hive.ts');

async function floor(t, Hive = HiveManager) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-outbox-race-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new Hive(() => home);
  await hive.ensureAgent({ id: 'god-1', name: 'Michael', provider: 'claude', cwd: home, isGod: true });
  await hive.ensureAgent({ id: 'jim-1', name: 'Jim', provider: 'claude', cwd: home });
  return { home, hive };
}

const outboxFile = (home, id, name) => {
  const dir = path.join(home, 'hive', 'agents', id, 'outbox');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
};
const entries = (hive, kind) => hive.logTail(500).filter((e) => e.kind === kind);

test('fresh torn file waits a pass instead of quarantining', async (t) => {
  const { home, hive } = await floor(t);
  const f = outboxFile(home, 'jim-1', 'm.json');
  fs.writeFileSync(f, '{"to": "god-1", "act": "requ');
  assert.equal(hive.routeOnce(), 0);
  assert.ok(fs.existsSync(f), 'torn file must still be in outbox');
  assert.equal(entries(hive, 'drop').length, 0, 'no drop logged for a fresh tear');
});

test('completed file routes on the next pass after a torn wait', async (t) => {
  const { home, hive } = await floor(t);
  const f = outboxFile(home, 'jim-1', 'm.json');
  fs.writeFileSync(f, '{"to": "god-1", "act": "requ');
  hive.routeOnce();
  fs.writeFileSync(f, JSON.stringify({ to: 'god-1', act: 'request', subject: 'done now', body: 'x' }));
  assert.equal(hive.routeOnce(), 1);
  assert.ok(hive.inbox('god-1').some((m) => m.subject === 'done now'));
});

test('stale torn file still quarantines (no infinite wait)', async (t) => {
  const { home, hive } = await floor(t);
  const f = outboxFile(home, 'jim-1', 'm.json');
  fs.writeFileSync(f, '{"to": "god-1", "act": "requ');
  const old = Date.now() - 60_000;
  fs.utimesSync(f, old / 1000, old / 1000);
  hive.routeOnce();
  assert.ok(!fs.existsSync(f), 'stale tear must be quarantined away');
  assert.ok(entries(hive, 'drop').some((e) => e.reason === 'malformed-json'));
});

test('rewrite landing mid-route is not archived unprocessed', async (t) => {
  class RewritingHive extends HiveManager {
    routeMessage(msg) {
      // Simulate the agent process rewriting its outbox file mid-route.
      const dir = path.join(this.root(), 'agents', msg.from, 'outbox');
      for (const name of fs.readdirSync(dir)) {
        if (name.endsWith('.json')) {
          fs.writeFileSync(path.join(dir, name),
            JSON.stringify({ to: 'god-1', act: 'inform', subject: 'v2', body: 'new' }));
        }
      }
      super.routeMessage(msg);
    }
  }
  const { home, hive } = await floor(t, RewritingHive);
  const f = outboxFile(home, 'jim-1', 'm.json');
  fs.writeFileSync(f, JSON.stringify({ to: 'god-1', act: 'inform', subject: 'v1', body: 'old' }));
  assert.equal(hive.routeOnce(), 0, 'rewritten file must not count as routed');
  assert.ok(fs.existsSync(f), 'rewrite stays for the next pass');
  assert.ok(JSON.parse(fs.readFileSync(f, 'utf8')).subject === 'v2');
  assert.ok(hive.inbox('god-1').some((m) => m.subject === 'v1'), 'already-routed v1 still delivered');
  assert.ok(entries(hive, 'outbox-rewrite-skipped').length === 1);
  assert.equal(hive.routeOnce(), 1, 'next pass routes v2');
  assert.ok(hive.inbox('god-1').some((m) => m.subject === 'v2'));
});

test('rapid sequential registry mutations preserve every field (no lock needed)', async (t) => {
  const { hive } = await floor(t);
  hive.recordSession('jim-1', 'sess-1');
  hive.patchAgentRole('jim-1', 'writer');
  hive.setAgentHold('jim-1', true);
  hive.renameAgent('jim-1', 'Jimbo');
  hive.setArchived('jim-1', true);
  hive.setArchived('jim-1', false);
  const a = hive.registry().agents['jim-1'];
  assert.equal(a.sessionId, 'sess-1', 'session survives later mutations');
  assert.equal(a.role, 'writer');
  assert.equal(a.onHold, true);
  assert.equal(a.name, 'Jimbo');
  assert.equal(a.archived, false);
});
