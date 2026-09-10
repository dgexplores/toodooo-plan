'use strict';

// Slice U — toodooo owns its face. The app shipped upstream marketing strings
// (MUNDER DIFFLIN hero/IDE/focus-mode/onboarding, Dunder Mifflin theme blurb,
// the show's "World's best boss" mug quote, a maroon MD splash) and briefed
// the god as "Michael". These guard the cutover: rendered product surfaces say
// toodooo/Deepak. Code comments and key identifiers are explicitly out of
// scope — only what a user can see, read, or hear.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('no upstream marketing strings in renderer surfaces', () => {
  const bad = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(tsx?|jsx?|html|css)$/.test(e.name)) continue;
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/MUNDER DIFFLIN|Munder ?Difflin|Dunder Mifflin|World's best boss/i.test(line)) {
          bad.push(`${path.relative(root, p)}:${i + 1}`);
        }
      });
    }
  };
  walk(path.join(root, 'src', 'renderer'));
  assert.deepEqual(bad, [], `upstream face leaks:\n${bad.join('\n')}`);
});

test('onboarding persona welcomes to TOODOOO in every locale', () => {
  for (const l of ['en', 'ar', 'zh-CN']) {
    const loc = JSON.parse(read(`src/renderer/src/i18n/locales/${l}.json`));
    assert.match(loc.onboarding.titles.persona, /TOODOOO/, `${l} persona is not TOODOOO`);
    assert.doesNotMatch(loc.onboarding.titles.persona, /MUNDER/i, `${l} persona still upstream`);
  }
});

test('god briefs as Deepak, boss avatar reads Deepak', () => {
  assert.match(read('src/renderer/src/hooks/useHive.ts'), /You're online as Deepak/,
    'INITIAL_GOD_PROMPT still briefs Michael');
  const cast = read('src/renderer/src/scene/office/cast.ts');
  assert.match(cast, /displayName: 'Deepak'/, 'boss avatar displayName is not Deepak');
  assert.doesNotMatch(cast, /World's best boss/, 'show mug quote still on the boss card');
});

test('brand gold is mirrored css<->ts and spent on the boss', () => {
  assert.match(read('src/renderer/src/design/tokens.css'), /--cth-brand: #F4D35E/,
    'tokens.css lost brand gold');
  const ts = read('src/renderer/src/design/tokens.ts');
  assert.match(ts, /gold: 0xf4d35e/, 'tokens.ts lost brand gold mirror');
  assert.match(read('src/renderer/src/scene/office/OfficeFloor.tsx'), /agent\.isGod \? colors\.brand\.gold/,
    'boss glow is not brand gold');
});

test('splash shows the toodooo mark, not the MD block', () => {
  const html = read('src/renderer/index.html');
  assert.doesNotMatch(html, />MD</, 'splash still flashes MD');
  assert.match(html, /<div class="mk">T<\/div>/, 'splash mark is not the toodooo T');
});

test('slack invite names our bot', () => {
  assert.match(read('src/renderer/src/components/SettingsModal.tsx'), /\/invite @toodooo/,
    'slack walkthrough still invites the upstream bot');
});
