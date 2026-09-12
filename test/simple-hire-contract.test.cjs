'use strict';

// Quick hire: non-technical users get name + project + goal only. Power
// controls (command text, OSS picks, resume id, AI/import footer) hide behind
// Advanced; defaults and the submit path are identical. Source-contract style.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('simple mode defaults from the onboarding audience', () => {
  const src = read('src/renderer/src/components/AddAgentModal.tsx');
  assert.match(src, /const \[simple, setSimple\] = useState\(config\.audience === 'non-technical'\)/,
    'quick hire not driven by audience');
  assert.match(src, /simple \? tr\('addAgent\.advanced'\) : tr\('addAgent\.simple'\)/,
    'simple/advanced toggle missing');
});

test('power controls hide in simple mode, nothing else', () => {
  const src = read('src/renderer/src/components/AddAgentModal.tsx');
  assert.match(src, /\{!simple && \(\s*<Row label=\{tr\('addAgent\.resumeSession'\)\}/,
    'resume row not gated');
  assert.match(src, /\/\* Raw command text is a power control[\s\S]*?\{!simple && \(\s*<Row label=\{config\.autoMode/,
    'command row not gated');
  assert.match(src, /\{!simple && hasOssQuickPicks\(provider\) && \(/, 'OSS picks not gated');
  // Provider/model chips stay: friendly defaults, command rebuilds itself.
  assert.doesNotMatch(src, /!simple && \(\s*<Row label=\{tr\('addAgent\.provider'\)\}/,
    'provider picker must stay visible in simple mode');
});

test('huddle tab registered on existing bridges only', () => {
  const src = read('src/renderer/src/components/CommandCenterPanel.tsx');
  assert.match(src, /\{ key: 'huddle', labelKey: 'commandCenter\.tabs\.huddle'/, 'tab not registered');
  assert.match(src, /\{tab === 'huddle' && <HuddleTab \/>\}/, 'tab body missing');
  const tab = read('src/renderer/src/components/HuddleTab.tsx');
  assert.match(tab, /window\.cth\.hiveLog\(200\)/, 'huddle must read hiveLog, not new IPC');
  assert.match(tab, /buildHuddles\(log, agents\.map/, 'huddle must aggregate via shared helper');
});

test('submit path is shared between modes', () => {
  const src = read('src/renderer/src/components/AddAgentModal.tsx');
  const submits = src.match(/window\.cth\.spawnPty\(/g) || [];
  assert.equal(submits.length, 1, `expected one spawn path, found ${submits.length}`);
});

test('simple tab strip shows six daily tabs behind More', () => {
  const src = read('src/renderer/src/components/CommandCenterPanel.tsx');
  assert.match(src, /const CORE_TABS: CCTab\[\] = \['terminal', 'floor', 'tasks', 'human', 'huddle', 'workers', 'spend'\]/,
    'core tab set changed');
  assert.match(src, /\.filter\(\(t\) => !simpleTabs \|\| showAllTabs \|\| CORE_TABS\.includes\(t\.key\)\)/,
    'simple gate missing');
  assert.match(src, /if \(!CORE_TABS\.includes\(key\)\) setShowAllTabs\(true\)/,
    'external requests do not auto-expand');
  assert.match(src, /if \(!visibleTabs\.some\(\(t\) => t\.key === tab\)\) setTab\('terminal'\)/,
    'parked-tab guard does not cover the simple gate');
});
