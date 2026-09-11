'use strict';

// De-copy: the floor team is toodooo's own — names, faces, voice. Guards the
// cast restyle (display names, original blurbs) and the banter purge (no show
// quotes in EXCHANGES, keyed bits, or locale gossip). Stable `name` ids are
// out of scope by design (persisted on agents, matched by voice inference).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const OFFICE_NAMES = ['Jim', 'Pam', 'Dwight', 'Kevin', 'Angela', 'Oscar',
  'Stanley', 'Phyllis', 'Andy', 'Kelly', 'Ryan', 'Toby', 'Creed', 'Meredith'];
const SHOW_QUOTES = ['I DECLARE…', 'Big Tuna',
  'FALSE. try', 'why few word', 'why use many word', 'feared or loved',
  'mung beans', 'a cappella'];

test('cast reads as our team, not the show', () => {
  const cast = read('src/renderer/src/scene/office/cast.ts');
  for (const n of OFFICE_NAMES) {
    assert.doesNotMatch(cast, new RegExp(`displayName: '${n}'`), `cast still shows ${n}`);
  }
  for (const n of ['Deepak', 'Arjun', 'Priya', 'Vikram', 'Rohan', 'Kavya',
    'Farhan', 'Mohan', 'Lakshmi', 'Aditya', 'Neha', 'Karan', 'Suresh', 'Dev', 'Meera']) {
    assert.match(cast, new RegExp(`displayName: '${n}'`), `missing teammate ${n}`);
  }
});

test('no show quotes in banter or locale gossip', () => {
  const files = [
    'src/renderer/src/scene/office/cafeteriaLines.ts',
    'src/renderer/src/i18n/locales/en.json',
    'src/renderer/src/i18n/locales/hi.json',
  ];
  for (const f of files) {
    const src = read(f);
    for (const q of SHOW_QUOTES) {
      assert.doesNotMatch(src, new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        `${f} still quotes the show: ${q}`);
    }
  }
});

test('keyed banter addresses current teammates', () => {
  const src = read('src/renderer/src/scene/office/cafeteriaLines.ts');
  for (const n of ['Vikram', 'Rohan', 'Kavya', 'Mohan']) {
    assert.match(src, new RegExp(`\\b${n}\\b`), `keyed banter lost ${n}`);
  }
  assert.match(read('src/renderer/src/components/OfficeThemePicker.tsx'),
    /label: 'Head Office'/, 'theme picker still labeled The Office');
});
