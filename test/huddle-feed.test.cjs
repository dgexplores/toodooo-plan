'use strict';

// buildHuddles: per-pair aggregation is hot-first, strangers excluded,
// subjects newest-first and capped.

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { buildHuddles } = loadTs('src/shared/huddleFeed.ts');

const msg = (from, to, subject, ts, extra = {}) => ({
  kind: 'message', from, to, subject, ts, act: 'inform', ...extra
});

test('pairs aggregate both directions, hot first', () => {
  const out = buildHuddles([
    msg('a', 'b', 'one', 3),
    msg('b', 'a', 'two', 4),
    msg('a', 'c', 'three', 5)
  ], ['a', 'b', 'c']);
  assert.equal(out.length, 2);
  assert.deepEqual([out[0].a, out[0].b], ['a', 'b']);
  assert.equal(out[0].total, 2);
  assert.equal(out[0].fwd, 1);
  assert.equal(out[0].bwd, 1);
  assert.equal(out[0].lastSubject, 'two');
  assert.equal(out[1].total, 1);
});

test('non-messages, self-talk and strangers are skipped', () => {
  const out = buildHuddles([
    { kind: 'spawn', from: 'a', to: 'b' },
    msg('a', 'a', 'me', 1),
    msg('a', 'ghost', 'boo', 2),
    msg('human', 'a', 'hi', 3),
    msg('a', 'b', 'real', 4)
  ], ['a', 'b']);
  assert.equal(out.length, 1);
  assert.equal(out[0].total, 1);
});

test('recent subjects newest-first, capped at five', () => {
  const log = [];
  for (let i = 1; i <= 8; i++) log.push(msg('a', 'b', `s${i}`, i));
  const out = buildHuddles(log, ['a', 'b']);
  assert.equal(out[0].recent.length, 5);
  assert.deepEqual(out[0].recent.map((r) => r.subject), ['s8', 's7', 's6', 's5', 's4']);
});
