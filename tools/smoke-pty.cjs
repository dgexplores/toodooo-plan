#!/usr/bin/env node
'use strict';

/**
 * B-015 platform smoke: the Linux AppImage shipped a broken pty.node (#456)
 * and Windows engine bridges rot silently (#475) because no job ever spawned
 * a real PTY per OS. This script is the release gate: require the natives,
 * spawn the current node binary in a PTY, round-trip a marker, assert clean
 * exit. Portable (no shell, no display). Non-zero exit + reason on failure.
 */
const path = require('node:path');
const fs = require('node:fs');

const MARKER = 'TOODOOO-SMOKE-OK';
const TIMEOUT_MS = 60_000;

function fail(reason) {
  console.error(`smoke FAIL: ${reason}`);
  process.exit(1);
}

// Fresh checkouts lack the postinstall chmod (spawn-helper ships 644 in the
// tarball — the exact class of issue this gate exists to catch). Best-effort,
// cross-platform no-op where irrelevant.
for (const plat of ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64']) {
  try {
    fs.chmodSync(
      path.join(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds', plat, 'spawn-helper'),
      0o755
    );
  } catch { /* absent platform or read-only fs */ }
}

async function main() {
  let pty;
  try {
    pty = require('node-pty');
  } catch (e) {
    fail(`require('node-pty'): ${e.message}`);
  }
  try {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.exec('CREATE TABLE t (x)');
    db.close();
  } catch (e) {
    fail(`better-sqlite3: ${e.message}`);
  }

  const chunks = [];
  let proc;
  try {
    proc = pty.spawn(process.execPath, ['-e', `console.log('${MARKER}')`], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: path.dirname(__dirname),
      env: process.env
    });
  } catch (e) {
    fail(`pty.spawn: ${e.message}`);
  }

  const done = new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ timeout: true }), TIMEOUT_MS);
    proc.onData((d) => { chunks.push(d); });
    proc.onExit(({ exitCode }) => { clearTimeout(timer); resolve({ exitCode }); });
  });
  const r = await done;
  if (r.timeout) {
    try { proc.kill(); } catch { /* already gone */ }
    fail('no exit within 60s');
  }
  const out = chunks.join('');
  if (!out.includes(MARKER)) fail(`marker missing in output: ${JSON.stringify(out.slice(0, 200))}`);
  if (r.exitCode !== 0) fail(`exit code ${r.exitCode}`);
  console.log(`smoke ok: pty round-trip + clean exit on ${process.platform}-${process.arch}`);
}

main().catch((e) => fail(e.message));
