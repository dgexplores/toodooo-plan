'use strict';

// Slice B — office behaviour + task assigning. The type/read sprite frames sat
// unused (every seat played idle), and Assign never wrote the assignee — it
// only seeded a dispatch, so the board + floor never showed the assignment.
// Source-contract style (renderer Pixi/store code is not importable here).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('seated pose plays the work texture', () => {
  const src = read('src/renderer/src/scene/office/Character.ts');
  assert.match(src, /sitAtDesk\(working: boolean, texture: 'type' \| 'read' \| null = null\)/,
    'sitAtDesk lost its texture param');
  assert.match(src, /private deskTexture: 'type' \| 'read' \| null = null;/,
    'deskTexture field gone');
  assert.match(src, /const anim = this\.deskTexture \?\? 'idle';/, 'seat no longer plays the texture');
  assert.match(src, /this\.sprite\.setAnimation\(anim, dir\)/, 'seat animation not texture-driven');
  assert.match(src, /this\.deskTexture = null; \/\/ breaks are idle/, 'cafe seats can inherit work texture');
});

test('floor maps hands to typing vs reading', () => {
  const src = read('src/renderer/src/scene/office/OfficeFloor.tsx');
  assert.match(src, /function deskTextureFor\(agent: Agent\): 'type' \| 'read' \| null/,
    'deskTextureFor gone');
  assert.match(src, /case 'Edit':\s*\n\s*case 'Write':\s*\n\s*case 'TodoWrite':\s*\n\s*return 'type';/,
    'edits do not type');
  assert.match(src, /case 'Read':/, 'research does not read');
  assert.match(src, /c\.sitAtDesk\(true, deskTextureFor\(agent\)\)/,
    'working branch does not pass the texture');
});

test('desk monitor mirrors owner state', () => {
  const desk = read('src/renderer/src/scene/office/DeskScreen.ts');
  assert.match(desk, /setMode\(mode: 'busy' \| 'alert' \| 'wait' \| 'idle'\)/,
    'DeskScreen.setMode gone');
  const floor = read('src/renderer/src/scene/office/OfficeFloor.tsx');
  assert.match(floor, /rt\.screen\?\.setMode\(screenModeFor\(agent\.status\)\)/,
    'applyState does not drive the monitor');
  assert.match(floor, /case 'blocked':\s*\n\s*case 'looping':\s*\n\s*return 'alert';/,
    'blocked/looping do not alert the monitor');
});

test('parser idle timer yields to flowing hooks', () => {
  const store = read('src/renderer/src/store/store.ts');
  assert.match(store, /lastHookAt\?: number;/, 'lastHookAt field gone');
  assert.match(store, /'contextTokens', 'contextLimit', 'lastPrompt', 'lastHookAt'/,
    'lastHookAt persists per hook event (must stay volatile)');
  const hive = read('src/renderer/src/hooks/useHive.ts');
  assert.match(hive, /updateAgent\(e\.agentId, \{ lastHookAt: Date\.now\(\) \}\)/,
    'hook handler stopped stamping');
  const parser = read('src/renderer/src/hooks/usePtyParser.ts');
  assert.match(parser, /Date\.now\(\) - \(a\.lastHookAt \?\? 0\) < 6000/,
    'idle drift no longer checks hook freshness');
});

test('assign writes the assignee to a live worker, never an installer', () => {
  const src = read('src/renderer/src/components/TaskDetailOverlay.tsx');
  assert.match(src, /hivePatchTask\(task\.id, \{ assignee: target\.id \}\)/,
    'assign does not write the assignee');
  assert.match(src, /!a\.isGod && !a\.isAssistant && !!a\.ptyId/, 'assign target guard weakened');
  assert.match(src, /\/\^installing engine\/i\.test\(a\.action/, 'installing agents became assignable');
  assert.match(src, /assigned to \$\{target\.name\}/, 'god dispatch lost the assignee context');
});
