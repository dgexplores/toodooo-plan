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

test('submit path is shared between modes', () => {
  const src = read('src/renderer/src/components/AddAgentModal.tsx');
  const submits = src.match(/window\.cth\.spawnPty\(/g) || [];
  assert.equal(submits.length, 1, `expected one spawn path, found ${submits.length}`);
});
