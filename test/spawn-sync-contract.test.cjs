'use strict';

// Slice S — spawn⇔roster sync. The member area carded installer PTYs as live
// agents ("spawn not done while member assigned") and a failed spawn leaked its
// ptyToAgent entry so a later teardown archived a never-live agent. A regular
// agent whose process exits sends no archive broadcast (only workers do), so
// its card read live forever without a re-sync.
//
// src/main/index.ts is not importable in this harness (Electron), so like the
// JSX-literal guard in i18n-god-name.test.cjs these assert the contract holds
// at the source level, tight to the edited lines.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('failed spawn cleans its staged ptyToAgent entry', () => {
  const src = read('src/main/index.ts');
  const i = src.indexOf('const res = await ptyManager.spawn(opts, owner);');
  assert.ok(i >= 0, 'spawn call site moved — update this test');
  const block = src.slice(i, i + 900);
  assert.match(block, /ptyToAgent\.delete\(opts\.id\)/, 'no ptyToAgent cleanup on spawn failure');
  assert.match(block, /workerWake\.forget\(opts\.hive\.id, opts\.id\)/, 'no watchdog cleanup on spawn failure');
});

test('installer PTY is flagged pendingInstall for the renderer', () => {
  const src = read('src/main/index.ts');
  assert.match(src, /pendingInstall\?: boolean/, 'spawn result type lost pendingInstall');
  assert.match(src, /\{\s*\.\.\.res, \.\.\.\(res\.ok \? \{ pendingInstall: true \} : \{\}\) \}/,
    'installer branch no longer flags pendingInstall');
  const preload = read('src/preload/index.ts');
  assert.match(preload, /pendingInstall\?: boolean/, 'preload spawnPty type lost pendingInstall');
  const i = preload.indexOf('onHiveAgentSpawned');
  assert.ok(i >= 0, 'onHiveAgentSpawned moved — update this test');
  assert.match(preload.slice(i, i + 500), /pendingInstall\?: boolean/,
    'agentSpawned broadcast type lost pendingInstall');
});

test('renderer cards installers honestly and clears on relaunch', () => {
  const modal = read('src/renderer/src/components/AddAgentModal.tsx');
  assert.match(modal, /spawnRes\.pendingInstall/, 'AddAgentModal ignores pendingInstall');
  assert.match(modal, /installing engine/, 'AddAgentModal lost the installing state');
  const hive = read('src/renderer/src/hooks/useHive.ts');
  assert.match(hive, /rec\.pendingInstall \? 'installing engine/, 'voice/main-initiated card ignores pendingInstall');
  const pool = read('src/renderer/src/components/terminalPool.ts');
  assert.match(pool, /onPtyRelaunch/, 'relaunch handler gone');
  assert.match(pool, /updateAgent\(a\.id, \{ action: 'starting up' \}\)/, 'relaunch no longer clears installing state');
});

test('member list re-syncs with live PTYs on an interval', () => {
  const app = read('src/renderer/src/App.tsx');
  assert.match(app, /setInterval\(sync, 15_000\)/, 'periodic reconcile gone');
  assert.match(app, /reconcileWithLivePtys\(list\.map\(\(p\) => p\.id\)\)/, 'reconcile call gone');
});

test('boot has no multi-second fixed waits before the team is usable', () => {
  // Slow-load complaint: god bootstrap slept 1200ms and auto-restore 2500ms
  // before doing anything. Readiness is polled downstream, so these are pure
  // delay — the ratchet keeps them short.
  const hive = read('src/renderer/src/hooks/useHive.ts');
  assert.doesNotMatch(hive, /\}, 1200\);/, 'god bootstrap 1200ms wait is back');
  assert.match(hive, /\}, 200\);/, 'god bootstrap wait missing');
  const restore = read('src/renderer/src/hooks/useRestoreTeam.ts');
  const m = restore.match(/AUTO_RESTORE_DELAY_MS = (\d+);/);
  assert.ok(m && Number(m[1]) <= 800, 'auto-restore delay crept back up');
});
