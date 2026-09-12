'use strict';

// Social floor: own atlas art, scripted map surgery, theme registration,
// pool + ping-pong errand behaviors. All static/filesystem asserts (the
// theme registry imports pixi + bundled asset URLs — not loadable here).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function pngPixels(rel) {
  const b = fs.readFileSync(path.join(root, rel));
  let p = 8;
  const idats = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString('ascii', p + 4, p + 8);
    if (type === 'IDAT') idats.push(b.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idats));
  return { raw, W: 128, H: 64 };
}

test('social props atlas exists at 128x64 with every tile painted', () => {
  const { raw, W } = pngPixels('src/renderer/src/assets/tilesets/social-props.png');
  const stride = W * 4 + 1;
  const alpha = (x, y) => raw[y * stride + 1 + x * 4 + 3];
  // [col, row, minPainted] — empty tiles (2,2),(5..7,2..3) stay transparent.
  const expectPainted = [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0],
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
    [0, 2], [1, 2], [3, 2], [4, 2],
    [0, 3], [1, 3], [3, 3], [4, 3]
  ];
  for (const [tx, ty] of expectPainted) {
    let n = 0;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) if (alpha(tx * 16 + x, ty * 16 + y) > 0) n++;
    }
    assert.ok(n > 40, `tile (${tx},${ty}) nearly empty: ${n}px`);
  }
});

test('social map keeps office geometry, adds the chill room', () => {
  const office = JSON.parse(read('src/renderer/src/assets/maps/office.tmj'));
  const social = JSON.parse(read('src/renderer/src/assets/maps/social.tmj'));
  assert.equal(social.width, 34);
  assert.equal(social.height, 22);
  assert.deepEqual(
    social.layers.map((l) => l.name),
    office.layers.map((l) => l.name)
  );
  const W = 34;
  const at = (name, x, y) => social.layers.find((l) => l.name === name).data[y * W + x];
  // Pool 3x2 from our atlas (firstgid 2449).
  assert.deepEqual([at('furniture-below', 10, 4), at('furniture-below', 12, 4), at('furniture-below', 12, 5)], [2449, 2451, 2459]);
  // TT 2x2 + sofa + lamp + rug + collision + spawns.
  assert.equal(at('furniture-below', 14, 4), 2452);
  assert.equal(at('furniture-below', 10, 6), 2454);
  assert.equal(at('furniture-below', 16, 6), 2456);
  assert.equal(at('floor', 9, 4), 2465);
  // Lounge extension: second sofa, coffee bar, trophy, rug row.
  assert.equal(at('furniture-below', 10, 7), 2454);
  assert.equal(at('furniture-below', 12, 6), 2468);
  assert.equal(at('furniture-below', 13, 7), 2477);
  assert.equal(at('furniture-below', 15, 6), 2462);
  assert.equal(at('collision', 12, 7), 1);
  assert.equal(at('collision', 14, 6), 0);
  assert.equal(at('collision', 11, 4), 1);
  assert.equal(at('collision', 9, 5), 0);
  const spawns = social.layers.find((l) => l.name === 'spawn-points').objects;
  assert.ok(spawns.some((o) => o.name === 'pool-view'), 'pool-view spawn missing');
  assert.ok(spawns.some((o) => o.name === 'tt-view'), 'tt-view spawn missing');
  // Everything else identical: seats, anchors, cafe.
  const names = (m) => m.layers.find((l) => l.name === 'spawn-points').objects.map((o) => o.name).sort();
  for (const n of names(office)) assert.ok(names(social).includes(n), `spawn lost: ${n}`);
});

test('social theme registered with own atlas, same everything else', () => {
  const src = read('src/renderer/src/scene/office/themeRegistry.ts');
  assert.match(src, /id: 'social'/, 'SOCIAL_THEME id missing');
  assert.match(src, /firstgid: 2449/, 'props atlas firstgid missing');
  assert.match(src, /social: SOCIAL_THEME/, 'theme not registered');
  assert.match(src, /kind: 'pool', stand: \{ x: 9, y: 5 \}/, 'pool errand spot missing');
  assert.match(src, /kind: 'tabletennis', stand: \{ x: 14, y: 6 \}/, 'tt errand spot missing');
  assert.match(src, /primarySeatNames: OFFICE_THEME\.primarySeatNames/, 'seats must carry over');
});

test('pool + ping-pong behaviors exist on the floor', () => {
  const floor = read('src/renderer/src/scene/office/OfficeFloor.tsx');
  assert.match(floor, /kind === 'pool'/, 'pool fx missing');
  assert.match(floor, /kind === 'tabletennis'/, 'tt fx missing');
  assert.match(floor, /pool:      \['office\.errand\.pool/, 'pool thoughts missing');
  assert.match(floor, /tabletennis: \['office\.errand\.tabletennis/, 'tt thoughts missing');
});

test('errand lines exist in every locale, picker lists the floor', () => {
  for (const l of ['en', 'hi', 'ar', 'zh-CN']) {
    const loc = JSON.parse(read(`src/renderer/src/i18n/locales/${l}.json`));
    assert.equal(loc.office.errand.pool.length, 3, `${l} pool lines`);
    assert.equal(loc.office.errand.tabletennis.length, 3, `${l} tt lines`);
  }
  assert.match(read('src/renderer/src/components/OfficeThemePicker.tsx'), /id: 'social'/, 'picker missing social');
});
