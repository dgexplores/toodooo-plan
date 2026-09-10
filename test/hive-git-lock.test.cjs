'use strict';

/**
 * B-009: commit() used to DELETE index.lock/HEAD.lock older than 10s before
 * retrying — but our own git is fully synchronous, so a long-lived lock always
 * belongs to an EXTERNAL git process, and stealing it corrupts their index.
 * The deleter is gone: contention now backs off and gives up loudly, and a
 * foreign lock is never touched whatever its age.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { HiveManager } = loadTs('src/main/hive.ts');

async function floor(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-git-lock-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  await hive.ensureAgent({ id: 'god-1', name: 'Michael', provider: 'claude', cwd: home, isGod: true });
  await hive.ensureAgent({ id: 'jim-1', name: 'Jim', provider: 'claude', cwd: home });
  const gitDir = path.join(home, 'hive', '.git');
  assert.ok(fs.existsSync(gitDir), 'hive must be a git repo for lock tests');
  return { hive, lock: path.join(gitDir, 'index.lock') };
}

function ageFile(p, msAgo) {
  const t = Date.now() - msAgo;
  fs.utimesSync(p, t / 1000, t / 1000);
}

test('a live external lock is waited out, never deleted', async (t) => {
  const { hive, lock } = await floor(t);
  fs.writeFileSync(lock, 'held by an external git');
  hive.commit('blocked by foreign lock');
  assert.ok(fs.existsSync(lock), 'foreign lock must survive our commit attempts');
});

test('even a stale (>10s) lock is left alone — age never justifies theft', async (t) => {
  const { hive, lock } = await floor(t);
  fs.writeFileSync(lock, 'long external operation');
  ageFile(lock, 60_000);
  hive.commit('blocked by stale foreign lock');
  assert.ok(fs.existsSync(lock), 'stale does not mean abandoned');
  assert.ok(fs.readFileSync(lock, 'utf8') === 'long external operation', 'untouched content');
});

test('normal commits still work with no lock present', async (t) => {
  const { hive } = await floor(t);
  hive.send({ to: 'jim-1', act: 'inform', subject: 'ok', body: 'x' }, 'god-1');
  assert.equal(hive.inbox('jim-1').length, 1);
});
