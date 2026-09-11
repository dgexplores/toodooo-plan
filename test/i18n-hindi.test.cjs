'use strict';

/**
 * Hindi locale contract (India wedge, R-01): hi.json ships the always-visible
 * chrome first, everything else falls back to English honestly (fallbackLng).
 * The ratchet: coverage only grows (floor), no orphan keys, every {{var}}
 * preserved exactly — a mistranslated placeholder breaks rendering silently.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const LOCALES = path.join(__dirname, '..', 'src', 'renderer', 'src', 'i18n', 'locales');
const en = JSON.parse(fs.readFileSync(path.join(LOCALES, 'en.json'), 'utf8'));
const hi = JSON.parse(fs.readFileSync(path.join(LOCALES, 'hi.json'), 'utf8'));

// Coverage floor: full parity (1210). The ratchet now guards regressions only.
const COVERAGE_FLOOR = 1210;

function leaves(obj, prefix = []) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object') out.push(...leaves(v, [...prefix, k]));
    else out.push({ path: [...prefix, k].join('.'), value: String(v) });
  }
  return out;
}

function vars(s) {
  const m = s.match(/\{\{[^}]+\}\}/g);
  return m ? [...m].sort() : [];
}

test('hindi is registered (resources, supportedLngs, picker)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'renderer', 'src', 'i18n', 'index.ts'), 'utf8');
  assert.match(src, /import hi from '\.\/locales\/hi\.json'/);
  assert.match(src, /hi: \{ translation: hi \}/);
  assert.match(src, /supportedLngs: \['en', 'zh-CN', 'ar', 'hi'\]/);
  assert.match(src, /\{ code: 'hi', label: 'हिन्दी', dir: 'ltr' \}/);
});

test('every hindi key exists in english (no orphans, no drift)', () => {
  const enPaths = new Set(leaves(en).map((l) => l.path));
  for (const l of leaves(hi)) {
    assert.ok(enPaths.has(l.path), `orphan key: ${l.path}`);
  }
});

test('every placeholder survives translation exactly', () => {
  const enByPath = new Map(leaves(en).map((l) => [l.path, l.value]));
  for (const l of leaves(hi)) {
    assert.deepEqual(vars(l.value), vars(enByPath.get(l.path)), `vars differ at ${l.path}`);
    assert.ok(l.value.trim().length > 0, `empty translation at ${l.path}`);
  }
});

test('coverage only grows', () => {
  const n = leaves(hi).length;
  assert.ok(n >= COVERAGE_FLOOR, `hindi coverage ${n} below floor ${COVERAGE_FLOOR}`);
});
