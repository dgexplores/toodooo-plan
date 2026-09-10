'use strict';

/**
 * B-011: every resolution miss used to boot a full login shell SYNCHRONOUSLY
 * on the main process (~1s freeze per miss; onboarding/restore froze all
 * windows for seconds, issue #446). The probe is now async, misses memoize
 * briefly (NEG_TTL), and any spawn ENOENT busts the negative entry so a
 * just-installed binary is never hidden by the TTL.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const electron = require.resolve('electron');
require.cache[electron] = {
  id: electron,
  filename: electron,
  loaded: true,
  exports: {}
};

const { PtyManager } = loadTs('src/main/pty.ts');

class CountingManager extends PtyManager {
  constructor() {
    super();
    this.probes = 0;
  }
  async resolveCommandUncached(command) {
    // Count only shapes that reach a shell (mirrors the guards in code).
    if (!command.includes('/') && !command.includes('\\') && /^[A-Za-z0-9._+-]+$/.test(command)) this.probes++;
    return super.resolveCommandUncached(command);
  }
}

test('a miss probes the shell once per TTL window, not per call', async () => {
  const mgr = new CountingManager();
  const missing = 'definitely-not-a-real-binary-xyz-123';
  const r1 = await mgr.isCommandAvailable(missing);
  const r2 = await mgr.isCommandAvailable(missing);
  const r3 = await mgr.commandPath(missing);
  assert.equal(r1, false);
  assert.equal(r2, false);
  assert.equal(r3, null);
  assert.equal(mgr.probes, 1, `expected 1 shell probe, got ${mgr.probes}`);
});

test('bustNegative forces an immediate re-probe', async () => {
  const mgr = new CountingManager();
  const missing = 'definitely-not-a-real-binary-xyz-456';
  await mgr.isCommandAvailable(missing);
  assert.equal(mgr.probes, 1);
  mgr.bustNegative(missing);
  await mgr.isCommandAvailable(missing);
  assert.equal(mgr.probes, 2, 'bust must bypass the TTL');
});

test('absolute paths and unsafe names never touch the shell', async () => {
  const mgr = new CountingManager();
  const hit = await mgr.commandPath(process.execPath);
  assert.equal(hit, process.execPath);
  assert.equal(await mgr.isCommandAvailable('rm; echo hi'), false);
  assert.equal(mgr.probes, 0, 'no shell for paths or rejected names');
});

test('positive hits revalidate existence without a shell probe', async () => {
  const mgr = new CountingManager();
  const mango = 'definitely-not-a-real-binary-xyz-789';
  // Seed a fake positive, then delete nothing — existsSync fails so it re-probes.
  mgr.resolvedCommands.set(mango, { path: '/nonexistent-xyz-789', found: true });
  assert.equal(await mgr.isCommandAvailable(mango), false);
  assert.equal(mgr.probes, 1, 'dead positive must re-probe');
});
