'use strict';

/**
 * R-13 aggregate CPU cap (upstream #471): floor total across agent process
 * TREES refuses new spawns. Pure gauge math tested with fixture ps output;
 * the spawn gate itself pinned by contract. POSIX-only sampling (Windows has
 * no cheap tree-%CPU source) leaves the gate open there, loudly.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { parsePs, subtreeSums, floorCpuPct } = loadTs('src/main/cpuGauge.ts');

function readSrc(p) {
  return fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
}

const PS = `  PID  PPID %CPU
    1     0  0.0
  100     1  5.0
  200   100 30.0
  201   100 10.0
  202   201  7.5
  300     1  2.0
junk line here
  400 broken`;

test('parse tolerates headers and junk', () => {
  const s = parsePs(PS);
  assert.ok(s.length >= 6);
  assert.deepEqual(s[1], { pid: 100, ppid: 1, pct: 5.0 });
});

test('subtree sums include grandchildren, exclude outsiders', () => {
  const m = subtreeSums(parsePs(PS), [100, 300]);
  assert.equal(m.get(100), 52.5, '5 + 30 + 10 + 7.5');
  assert.equal(m.get(300), 2.0);
});

test('floor total sums roots without double counting shared ancestors', () => {
  // 200 is inside 100's tree: the union counts it once.
  assert.equal(floorCpuPct(parsePs(PS), [100, 200]), 52.5);
  assert.equal(floorCpuPct(parsePs(PS), []), 0);
  assert.equal(floorCpuPct([], [100]), 0);
});

test('pid-reuse cycles terminate', () => {
  const cyclic = [
    { pid: 1, ppid: 2, pct: 1 },
    { pid: 2, ppid: 1, pct: 1 }
  ];
  assert.equal(floorCpuPct(cyclic, [1]), 2);
});

test('spawn gate enforces the cap, running work untouched (contract)', () => {
  const src = readSrc('src/main/index.ts');
  assert.match(src, /cpuCapPercent/);
  assert.match(src, /sampleFloorCpu\(ptyManager\.agentPids\(\)\)/);
  assert.match(src, /spawn-refused-cpu/);
  assert.match(src, /running agents finish/i);
});

test('windows leaves the gate open loudly, never silently', () => {
  const src = readSrc('src/main/cpuGauge.ts');
  assert.match(src, /win32/);
  assert.match(src, /return null/);
});
