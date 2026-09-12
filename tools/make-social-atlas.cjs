'use strict';
/**
 * Social-floor props atlas — toodooo's OWN pixel art (pool, table-tennis,
 * sofa, coffee bar, rug, lamp, trophy, wall art) on a 16px grid. Generated,
 * never hand-painted: every tile is rects in code, brand palette, ink
 * outlines. Third-party tilesets are NOT touched (licensed).
 *
 * Layout 8 cols x 4 rows (128x64). Tile ids below are (col,row); the theme
 * maps them as firstgid + row*8+col.
 *
 *   node tools/make-social-atlas.cjs  ->  src/renderer/src/assets/tilesets/social-props.png
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src/renderer/src/assets/tilesets/social-props.png');

const T = 16, COLS = 8, ROWS = 4, W = COLS * T, H = ROWS * T;

// Brand-aligned palette (matches tokens.css light set).
const INK   = [26, 19, 32];
const CREAM = [244, 233, 199];
const PAPER = [252, 250, 240];
const GOLD  = [244, 211, 94];
const LEMON = [220, 171, 60];
const TEAL  = [46, 125, 110];
const TEALD = [31, 90, 78];
const WOOD  = [138, 90, 50];
const WOODD = [110, 69, 37];
const TTBLUE = [58, 110, 165];
const TTBLUED = [44, 86, 128];
const RUST  = [192, 106, 74];
const RUSTD = [138, 74, 50];
const CORAL = [217, 106, 98];
const WHITE = [250, 250, 250];
const GREY  = [120, 118, 132];

const buf = Buffer.alloc(W * H * 4); // transparent by default

function px(tx, ty, x, y, w, h, c) {
  const ox = tx * T, oy = ty * T;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const X = ox + x + i, Y = oy + y + j;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const o = (Y * W + X) * 4;
      buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255;
    }
  }
}

/** Ink outline around a rect region (1px). */
function frame(tx, ty, x, y, w, h) {
  px(tx, ty, x, y, w, 1, INK);
  px(tx, ty, x, y + h - 1, w, 1, INK);
  px(tx, ty, x, y, 1, h, INK);
  px(tx, ty, x + w - 1, y, 1, h, INK);
}

// ─── pool table 3x2 at (0,0) ─────────────────────────────────────────────
function poolTable() {
  for (let cx = 0; cx < 3; cx++) {
    for (let cy = 0; cy < 2; cy++) {
      px(cx, cy, 0, 0, 16, 16, WOOD);
      px(cx, cy, 2, 2, 12, 12, TEAL);
      px(cx, cy, 2, 2, 12, 1, TEALD);
    }
  }
  // pockets: corners + side middles
  for (const [cx, cy, x, y] of [[0, 0, 1, 1], [2, 0, 14, 1], [0, 1, 1, 14], [2, 1, 14, 14], [1, 0, 7, 1], [1, 1, 7, 14]]) {
    px(cx, cy, x, y, 2, 2, INK);
  }
  // ball triangle + cue ball + cue stick
  px(1, 0, 6, 6, 2, 2, WHITE);
  px(1, 0, 9, 5, 2, 2, CORAL);
  px(1, 1, 7, 9, 2, 2, GOLD);
  px(1, 0, 8, 4, 1, 1, INK);
  for (let i = 0; i < 6; i++) px(2, 1, 4 + i, 10 - i, 1, 1, [201, 166, 107]);
  frame(0, 0, 0, 0, 16, 16); frame(1, 0, 0, 0, 16, 16); frame(2, 0, 0, 0, 16, 16);
  frame(0, 1, 0, 0, 16, 16); frame(1, 1, 0, 0, 16, 16); frame(2, 1, 0, 0, 16, 16);
}

// ─── table tennis 2x2 at (3,0) ────────────────────────────────────────────
function ttTable() {
  for (const [cx, cy] of [[3, 0], [4, 0], [3, 1], [4, 1]]) {
    px(cx, cy, 0, 3, 16, 10, TTBLUE);
    px(cx, cy, 0, 3, 16, 1, TTBLUED);
  }
  // centre line + edges
  px(3, 0, 15, 3, 1, 10, WHITE); px(4, 0, 0, 3, 1, 10, WHITE);
  px(3, 1, 15, 3, 1, 10, WHITE); px(4, 1, 0, 3, 1, 10, WHITE);
  // net across the middle seam
  for (let x = 0; x < 16; x++) { px(3, 0, x, 15, 1, 1, INK); px(4, 0, x, 15, 1, 1, INK); }
  px(3, 0, 0, 13, 1, 3, WOOD); px(4, 0, 15, 13, 1, 3, WOOD);
  // ball + paddle
  px(4, 1, 10, 6, 2, 2, WHITE);
  px(3, 1, 4, 8, 3, 3, RUST); px(3, 1, 5, 11, 1, 2, WOOD);
  // legs
  for (const [cx, cy, x] of [[3, 1, 2], [4, 1, 13]]) px(cx, cy, x, 13, 2, 3, INK);
  frame(3, 0, 0, 3, 16, 13); frame(4, 0, 0, 3, 16, 13);
}

// ─── sofa 2x1 at (5,0) ────────────────────────────────────────────────────
function sofa() {
  for (const cx of [5, 6]) {
    px(cx, 0, 0, 4, 16, 12, RUST);
    px(cx, 0, 2, 6, 12, 7, [217, 138, 95]);
    px(cx, 0, 2, 6, 12, 1, RUSTD);
    frame(cx, 0, 0, 4, 16, 12);
  }
  px(5, 0, 0, 4, 2, 12, RUSTD);   // left arm shadow
  px(6, 0, 14, 4, 2, 12, RUSTD);  // right arm shadow
  px(5, 0, 4, 8, 3, 3, GOLD);     // cushion
  px(6, 0, 9, 8, 3, 3, TEAL);
}

// ─── floor lamp 1x2 at (7,0)-(7,1) ────────────────────────────────────────
function lamp() {
  px(7, 0, 4, 2, 8, 6, GOLD);
  px(7, 0, 4, 2, 8, 1, [250, 237, 190]);
  frame(7, 0, 4, 2, 8, 6);
  px(7, 0, 7, 8, 2, 8, [61, 46, 74]);
  px(7, 1, 7, 0, 2, 12, [61, 46, 74]);
  px(7, 1, 5, 12, 6, 4, [61, 46, 74]);
}

// ─── trophy 1x1 at (5,1) ──────────────────────────────────────────────────
function trophy() {
  px(5, 1, 5, 2, 6, 5, GOLD);
  px(5, 1, 5, 2, 6, 1, [250, 237, 190]);
  px(5, 1, 3, 3, 2, 3, GOLD);
  px(5, 1, 11, 3, 2, 3, GOLD);
  px(5, 1, 6, 7, 4, 2, WOODD);
  px(5, 1, 4, 9, 8, 3, WOOD);
  px(5, 1, 4, 9, 8, 1, [201, 166, 107]);
}

// ─── wall art (gold T) 1x1 at (6,1) ───────────────────────────────────────
function wallArt() {
  px(6, 1, 2, 2, 12, 12, CREAM);
  frame(6, 1, 2, 2, 12, 12);
  px(6, 1, 5, 5, 6, 2, GOLD);
  px(6, 1, 7, 5, 2, 6, GOLD);
}

// ─── rug 2x2 at (0,2) ─────────────────────────────────────────────────────
function rug() {
  for (const [cx, cy] of [[0, 2], [1, 2], [0, 3], [1, 3]]) {
    px(cx, cy, 0, 0, 16, 16, CREAM);
    px(cx, cy, 2, 2, 12, 12, [250, 237, 190]);
    px(cx, cy, 6, 6, 4, 4, LEMON);
    px(cx, cy, 7, 7, 2, 2, CORAL);
  }
}

// ─── coffee bar 2x2 at (3,2) ──────────────────────────────────────────────
function coffeeBar() {
  for (const cx of [3, 4]) {
    px(cx, 2, 0, 8, 16, 8, WOOD);
    px(cx, 2, 0, 8, 16, 2, [201, 166, 107]);
    px(cx, 3, 0, 0, 16, 16, WOODD);
    frame(cx, 2, 0, 8, 16, 8);
  }
  // espresso machine on the left counter
  px(3, 2, 3, 1, 6, 7, GREY);
  px(3, 2, 4, 2, 4, 3, INK);
  px(3, 2, 4, 6, 1, 2, CREAM);
  px(3, 2, 10, 1, 3, 2, CORAL);
  // mugs on the right counter
  px(4, 2, 3, 5, 3, 3, PAPER);
  px(4, 2, 9, 4, 3, 4, TEAL);
  px(4, 2, 6, 5, 1, 2, INK);
}

poolTable();
ttTable();
sofa();
lamp();
trophy();
wallArt();
rug();
coffeeBar();

// ── PNG encode (stdlib only; same shape as tools/make-logo.cjs) ────────────
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (b) => {
    let c = -1;
    for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}

const stride = W * 4 + 1;
const raw = Buffer.alloc(H * stride);
for (let y = 0; y < H; y++) {
  raw[y * stride] = 0;
  buf.copy(raw, y * stride + 1, y * W * 4, (y + 1) * W * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);
fs.writeFileSync(OUT, png);
console.log(`social-props.png ${(png.length / 1024).toFixed(1)} KB`);
