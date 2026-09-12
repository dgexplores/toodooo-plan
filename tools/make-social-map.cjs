'use strict';
/* One-shot map surgery (reviewed, not re-run blindly):
 * office.tmj -> social.tmj: convert the boardroom table block (x10-15, y4-6)
 * into a chill room with OUR props atlas (firstgid 2449). Everything else —
 * seats, anchors, cafe, monitors, collision elsewhere — byte-identical.
 *
 *   node tools/make-social-map.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src/renderer/src/assets/maps/office.tmj');
const DST = path.join(ROOT, 'src/renderer/src/assets/maps/social.tmj');

const W = 34;
const FIRST = 2449; // interiors (1025) + 1424 tiles
const T = (c, r) => FIRST + r * 8 + c;

const m = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const lay = {};
for (const l of m.layers) lay[l.name] = l;
const at = (layer, x, y) => layer.data[y * W + x];
const set = (layer, x, y, v) => { layer.data[y * W + x] = v; };

// 1. Clear boardroom block furniture + collision (keep walls/floor).
for (let y = 4; y <= 6; y++) {
  for (let x = 10; x <= 15; x++) {
    set(lay['furniture-below'], x, y, 0);
    set(lay['furniture-above'], x, y, 0);
    set(lay.collision, x, y, 0);
  }
}
// Fa extras in the block corners from the old table dressing.
set(lay['furniture-above'], 10, 4, 0);
set(lay['furniture-above'], 15, 4, 0);
set(lay['furniture-above'], 10, 5, 0);
set(lay['furniture-above'], 15, 5, 0);

// 2. Rug on the floor layer (walkable deco), 5x3 at x9-13, y4-6.
for (let y = 0; y < 3; y++) {
  for (let x = 0; x < 5; x++) {
    set(lay.floor, 9 + x, 4 + y, T(x % 2, 2 + (y % 2)));
  }
}

// 3. Pool table 3x2 at (10,4) + collision.
const pool = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]];
for (const [cx, cy] of pool) {
  set(lay['furniture-below'], 10 + cx, 4 + cy, T(cx, cy));
  set(lay.collision, 10 + cx, 4 + cy, 1);
}

// 4. Table-tennis 2x2 at (14,4) + collision.
for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
  set(lay['furniture-below'], 14 + cx, 4 + cy, T(3 + cx, cy));
  set(lay.collision, 14 + cx, 4 + cy, 1);
}

// 5. Sofa 2x1 at (10,6) + collision.
set(lay['furniture-below'], 10, 6, T(5, 0));
set(lay['furniture-below'], 11, 6, T(6, 0));
set(lay.collision, 10, 6, 1);
set(lay.collision, 11, 6, 1);

// 6. Lamp 1x2 at (16,6)-(16,7) + collision.
set(lay['furniture-below'], 16, 6, T(7, 0));
set(lay['furniture-below'], 16, 7, T(7, 1));
set(lay.collision, 16, 6, 1);
set(lay.collision, 16, 7, 1);

// 7. Viewing stands (walkable — no collision change). Full object shape mirrors
// the map's own spawns (the loader keys on name).
const spawns = lay['spawn-points'].objects;
const spot = (id, name, tx, ty) => ({
  id, name, type: '', x: tx * 16, y: ty * 16, width: 0, height: 0,
  rotation: 0, visible: true, point: true
});
spawns.push(spot(100, 'pool-view', 9, 5));
spawns.push(spot(101, 'tt-view', 14, 6));

fs.writeFileSync(DST, JSON.stringify(m));
console.log('social.tmj written: pool (10,4), tt (14,4), sofa (10,6), lamp (16,6), rug x9-13 y4-6');
