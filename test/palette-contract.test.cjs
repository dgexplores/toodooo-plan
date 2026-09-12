'use strict';

// Palette colorways: gold default, teal + ember remap only the brand tokens.
// Status hues keep their meaning; the floor (baked tile art + static token
// mirror) stays gold by documented scope.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('palette module offers three colorways, gold default, persisted', () => {
  const src = read('src/renderer/src/design/palette.ts');
  assert.match(src, /export type AppPalette = 'gold' \| 'teal' \| 'ember'/, 'colorway set changed');
  assert.match(src, /data-cth-palette/, 'stamp missing');
  assert.match(src, /cth\.palette/, 'persistence missing');
  assert.match(src, /return 'gold';/, 'default is not gold');
});

test('only brand tokens move, in both themes', () => {
  const css = read('src/renderer/src/design/tokens.css');
  for (const p of ['teal', 'ember']) {
    assert.match(css, new RegExp(`:root\\[data-cth-palette='${p}'\\] \\{\\s*--cth-brand: #[0-9A-Fa-f]{6};\\s+--cth-brand-light: #[0-9A-Fa-f]{6};`),
      `${p} light override missing`);
    assert.match(css, new RegExp(`:root\\[data-cth-theme='dark'\\]\\[data-cth-palette='${p}'\\]`),
      `${p} dark override missing`);
  }
  assert.doesNotMatch(css, /data-cth-palette[^}]*--cth-status/, 'status hues move with palette');
});

test('settings exposes the switch', () => {
  const src = read('src/renderer/src/components/SettingsModal.tsx');
  assert.match(src, /PALETTES\.map\(\(p\) =>/, 'swatch row missing');
  assert.match(src, /setAppPalette\(p\.id\)/, 'switch unwired');
});
