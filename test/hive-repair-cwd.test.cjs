'use strict';

/**
 * B-016: renaming a project folder on disk orphaned the agent with no in-app
 * fix (issue #445). repairCwd rebinds registry + fleet to a validated dir;
 * archived agents get a Restore button reusing the boot-restore recipe (#447).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { HiveManager } = loadTs('src/main/hive.ts');

async function floor(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-repair-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  await hive.ensureAgent({ id: 'jim-1', name: 'Jim', provider: 'claude', cwd: home });
  return { home, hive };
}

test('repair rebinds a moved folder and recomputes validity', async (t) => {
  const { hive } = await floor(t);
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'md-repair-dest-'));
  t.after(() => fs.rmSync(dest, { recursive: true, force: true }));
  const r = hive.repairCwd('jim-1', dest);
  assert.equal(r.ok, true);
  assert.equal(r.cwd, dest);
  const a = hive.registry().agents['jim-1'];
  assert.equal(a.cwd, dest);
  assert.equal(a.cwdValid, true);
  const logged = hive.logTail(50).filter((e) => e.kind === 'repair-cwd');
  assert.equal(logged.length, 1);
  assert.equal(logged[0].agentId, 'jim-1');
});

test('repair rejects bad inputs without touching state', async (t) => {
  const { hive } = await floor(t);
  const before = hive.registry().agents['jim-1'].cwd;
  for (const bad of ['', '   ', 'relative/path', '/no-such-dir-xyz-123', path.join(os.tmpdir(), 'missing-xyz-123')]) {
    const r = hive.repairCwd('jim-1', bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.ok(typeof r.error === 'string' && r.error.length > 0, 'UI needs a reason');
  }
  assert.equal(hive.repairCwd('ghost', os.tmpdir()).ok, false);
  assert.equal(hive.registry().agents['jim-1'].cwd, before, 'failed repairs change nothing');
});

test('repair rejects a path that is a file, not a directory', async (t) => {
  const { home, hive } = await floor(t);
  const f = path.join(home, 'file.txt');
  fs.writeFileSync(f, 'x');
  const r = hive.repairCwd('jim-1', f);
  assert.equal(r.ok, false);
  assert.match(r.error, /directory/);
});

test('archived agents keep history through repair (restore path intact)', async (t) => {
  const { hive } = await floor(t);
  hive.setArchived('jim-1', true);
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'md-repair-dest2-'));
  t.after(() => fs.rmSync(dest, { recursive: true, force: true }));
  assert.equal(hive.repairCwd('jim-1', dest).ok, true);
  assert.equal(hive.registry().agents['jim-1'].archived, true, 'repair must not unarchive');
  assert.ok(fs.existsSync(path.join(dest)) && hive.memory('jim-1') !== undefined);
});
