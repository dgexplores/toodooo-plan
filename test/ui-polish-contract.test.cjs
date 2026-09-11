'use strict';

// Redesign slice 1 — chip/tab buttons had zero hover/pressed feedback
// (PixelButton aside), numerals weren't tabular. Global CSS covers every
// raw button at once instead of churning dozens of inline-style call sites.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const css = () => fs.readFileSync(
  path.join(root, 'src/renderer/src/design/global.css'), 'utf8');

test('raw buttons get hover and pressed states globally', () => {
  assert.match(css(), /button:not\(:disabled\):hover \{ filter: brightness\(0\.94\); \}/,
    'button hover rule missing');
  assert.match(css(), /button:not\(:disabled\):active \{ transform: translateY\(1px\); \}/,
    'button pressed rule missing');
});

test('numerals are tabular app-wide', () => {
  assert.match(css(), /body \{ font-variant-numeric: tabular-nums; \}/,
    'tabular numerals rule missing');
});
