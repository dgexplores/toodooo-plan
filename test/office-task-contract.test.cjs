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

test('monitor roster rows carry a PC opener (god included)', () => {
  const src = read('src/renderer/src/components/CommandCenterPanel.tsx');
  assert.match(src, /const openPc = useStore\(\(s\) => s\.openPc\);/, 'FloorTab missing openPc');
  assert.match(src, /onClick=\{\(\) => openPc\(a\.id\)\}/, 'row PC button missing');
});

test('agent header has a working PC button (DOM path)', () => {
  // Floor taps proved flaky under probe; the detail header button is the
  // guaranteed opener — same openPc call, trusted DOM event path.
  const src = read('src/renderer/src/components/AgentDetailPanel.tsx');
  assert.match(src, /const openPc = useStore\(s => s\.openPc\);/, 'openPc not subscribed');
  assert.match(src, /onClick=\{\(\) => openPc\(agent\.id\)\}/, 'PC button does not call openPc');
});

test('PC done splits by finish day', () => {
  const src = read('src/renderer/src/components/AgentPcOverlay.tsx');
  assert.match(src, /dayBucket\(x\.completedAt\) === 'today'/, 'no today split');
  assert.match(src, /dayBucket\(x\.completedAt\) === 'yesterday'/, 'no yesterday split');
  assert.match(src, /if \(!iso\) return 'earlier';/, 'missing stamps must group as earlier');
});

test('PC overview is a boss dashboard: flip, stats, grid', () => {
  const src = read('src/renderer/src/components/AgentPcOverlay.tsx');
  assert.match(src, /openPc\(agents\[\(idx \+ dir \+ agents\.length\) % agents\.length\]\.id\)/,
    'team flip-through missing');
  assert.match(src, /gridTemplateColumns: '1fr 1fr'/, 'two-column layout missing');
  assert.match(src, /agentPc\.context/, 'context meter missing');
  assert.match(src, /agentPc\.now/, 'now section missing');
});

test('avatar and monitor taps use explicit hit geometry', () => {
  // Tap-dead-room incident: texture-backed hit-testing silently dropped taps
  // on avatars/monitors, so clicks visibly on an agent did nothing. Both
  // targets now carry an explicit hitArea; this guards the geometry.
  const sprite = read('src/renderer/src/scene/office/CharacterSprite.ts');
  assert.match(sprite, /enableTap\(onTap: \(\) => void\)/, 'sprite tap helper gone');
  assert.match(sprite, /new Rectangle\(\s*-this\.frameW \/ 2, -this\.frameH, this\.frameW, this\.frameH\)/,
    'avatar hitArea gone');
  const desk = read('src/renderer/src/scene/office/DeskScreen.ts');
  assert.match(desk, /new Rectangle\(0, 0, ts \* 2, ts \* 2\)/, 'monitor hitArea gone');
});

test('desk taps open the PC overview, never the terminal', () => {
  const desk = read('src/renderer/src/scene/office/DeskScreen.ts');
  assert.match(desk, /opts\?: \{ onTap\?: \(\) => void \}/, 'DeskScreen takes no tap handler');
  assert.match(desk, /this\.container\.on\('pointertap', opts\.onTap\)/, 'tap never fires');
  const floor = read('src/renderer/src/scene/office/OfficeFloor.tsx');
  // The seated avatar overlaps its monitor and swallows the tap first, so the
  // avatar path must open the same overview — otherwise the click dies there.
  assert.match(floor, /onClick: openAgentPc/, 'avatar tap bypasses the PC overview');
  assert.match(floor, /onTap: \(\) => openAgentPc\(agent\.id\)/, 'monitor tap bypasses the PC overview');
  assert.match(floor, /st\.openPc\(id\)/, 'taps do not open the PC overview');
  assert.doesNotMatch(floor, /openAgentPc[\s\S]{0,200}setFullscreen/,
    'PC overview path leaks into fullscreen terminal');
  assert.match(read('src/renderer/src/App.tsx'), /<AgentPcOverlay \/>/, 'overlay not mounted');
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
