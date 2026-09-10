'use strict';

/**
 * B-014: terminal input parity. xterm sends bare \r for Shift+Enter (same as
 * Enter), but Claude Code submits on Enter — with no mapping there is no way
 * to type a multi-line prompt (issue #481). And the Windows cmd.exe fallback
 * silently truncated multi-line args; the warning now names the hazard and
 * rides the spawn result into the activity log.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { shiftEnterSequence } = loadTs('src/renderer/src/terminal/keys.ts');
const { cmdFallbackWarning } = loadTs('src/main/pty.ts');

function readSrc(p) {
  return fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
}

test('Shift+Enter maps to newline on every platform', () => {
  assert.equal(shiftEnterSequence({ key: 'Enter', shiftKey: true, ctrlKey: false, metaKey: false }), '\n');
});

test('everything else is left to xterm', () => {
  assert.equal(shiftEnterSequence({ key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false }), null);
  assert.equal(shiftEnterSequence({ key: 'Enter', shiftKey: true, ctrlKey: true, metaKey: false }), null);
  assert.equal(shiftEnterSequence({ key: 'Enter', shiftKey: true, ctrlKey: false, metaKey: true }), null);
  assert.equal(shiftEnterSequence({ key: 'a', shiftKey: true, ctrlKey: false, metaKey: false }), null);
  assert.equal(shiftEnterSequence({ key: 'enter', shiftKey: true, ctrlKey: false, metaKey: false }), null);
});

test('the pool wires the mapping into the key handler', () => {
  const src = readSrc('src/renderer/src/components/terminalPool.ts');
  assert.match(src, /shiftEnterSequence\(ev\)/);
  assert.match(src, /writePty\(ptyId, shifted\)/);
});

test('cmd fallback warning names the truncation hazard only when present', () => {
  const bad = cmdFallbackWarning('C:\\npm\\claude.cmd', ['--append-system-prompt', 'line1\nline2']);
  assert.match(bad, /TRUNCATED AT ITS FIRST NEWLINE/);
  assert.match(bad, /look healthy/);
  const ok = cmdFallbackWarning('C:\\npm\\claude.cmd', ['--model', 'sonnet']);
  assert.match(ok, /nothing is lost here/);
  assert.doesNotMatch(ok, /TRUNCATED/);
});

test('spawn warnings reach the activity log via spawnAgentCore', () => {
  const src = readSrc('src/main/index.ts');
  assert.match(src, /res\.warnings\?\.length/);
  assert.match(src, /kind: 'spawn-warning'/);
  const preload = readSrc('src/preload/index.ts');
  assert.match(preload, /warnings\?: string\[\]/);
});
