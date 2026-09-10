'use strict';

/**
 * B-012: every unbounded growth surface gets a ceiling from shared/limits —
 * terminal scrollback, feed rings, queues, log reads. Pure helpers tested
 * directly; store/pool wiring pinned by contract assertions (the store module
 * needs a DOM + Electron host, so behavior there is covered by convention,
 * same as command-name-validation.test.cjs).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { capTail, SCROLLBACK_MAX, FEED_MAX, QUEUE_MAX, LOG_TAIL_BYTES } = loadTs('src/shared/limits.ts');
const { HiveManager } = loadTs('src/main/hive.ts');

function readSrc(p) {
  return fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
}

test('budgets exist and are sane', () => {
  assert.ok(SCROLLBACK_MAX <= 20_000, 'scrollback must drop from 100k');
  assert.ok(FEED_MAX <= 500 && FEED_MAX > 0);
  assert.ok(QUEUE_MAX <= 50 && QUEUE_MAX > 0);
  assert.ok(LOG_TAIL_BYTES >= 64 * 1024, 'read window must hold many lines');
});

test('capTail keeps the newest n', () => {
  assert.deepEqual(capTail([1, 2, 3], 5), [1, 2, 3]);
  assert.deepEqual(capTail([1, 2, 3, 4], 2), [3, 4]);
  assert.deepEqual(capTail([], 3), []);
});

test('store pushFeed rings through capTail at FEED_MAX', () => {
  const src = readSrc('src/renderer/src/store/store.ts');
  assert.match(src, /capTail\(\[\.\.\.\(s\.feeds\[id\] \?\? \[\]\), line\], FEED_MAX\)/);
  assert.match(src, /from '@shared\/limits'/);
});

test('store queue add path enforces QUEUE_MAX with oldest-drop', () => {
  const src = readSrc('src/renderer/src/store/store.ts');
  assert.match(src, /next\.length > QUEUE_MAX/);
  assert.match(src, /dropping oldest/);
});

test('terminal pool scrollback comes from the shared ceiling', () => {
  const src = readSrc('src/renderer/src/components/terminalPool.ts');
  assert.match(src, /scrollback: SCROLLBACK_MAX/);
  assert.doesNotMatch(src, /scrollback: 100000/);
});

test('logTail reads a window, not the whole file, with exact tail', async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-logtail-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  await hive.ensureAgent({ id: 'god-1', name: 'Michael', provider: 'claude', cwd: home, isGod: true });
  // ~1MB of log: 40k lines × ~25 bytes — forces the windowed path.
  const lines = [];
  for (let i = 0; i < 40000; i++) lines.push(JSON.stringify({ kind: 't', i }));
  fs.appendFileSync(path.join(home, 'hive', 'log.jsonl'), lines.join('\n') + '\n');
  assert.ok(fs.statSync(path.join(home, 'hive', 'log.jsonl')).size > LOG_TAIL_BYTES);
  const tail = hive.logTail(5);
  assert.equal(tail.length, 5);
  assert.deepEqual(tail.map((e) => e.i), [39995, 39996, 39997, 39998, 39999]);
  assert.ok(tail.every((e) => typeof e.i === 'number'), 'no partial-line {raw} entries');
  const big = hive.logTail(500);
  assert.equal(big.length, 500);
  assert.equal(big[0].i, 39500);
});
