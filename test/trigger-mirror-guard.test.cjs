'use strict';

// triggerHistoryVisible runs inside CommandCenterPanel's render: a malformed
// mirror (old config shape, redacted IPC object) once threw on .trim() and
// blanked the entire app. It must never throw; the setter normalizes.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('selector survives malformed mirrors', () => {
  const src = read('src/renderer/src/store/store.ts');
  assert.match(src, /typeof key === 'string' && key\.trim\(\) !== ''/,
    'selector still trims unguarded');
  assert.match(src, /Array\.isArray\(s\.webhookTriggers\)/, 'selector assumes webhook array');
});

test('setter normalizes onto the default shape', () => {
  const src = read('src/renderer/src/store/store.ts');
  assert.match(src, /orgTrigger: \{ \.\.\.DEFAULT_ORG_TRIGGER, \.\.\.\(cfg as OrgTriggerConfig\) \}/,
    'setter stores caller shapes verbatim');
});
