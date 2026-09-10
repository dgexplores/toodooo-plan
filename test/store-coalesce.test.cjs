'use strict';

/**
 * B-013: bursty producers (pty parser per chunk, context polls) cloned the
 * whole roster + notified every subscriber per chunk, even when nothing
 * changed. updateAgent now coalesces identical patches (primitives by ===,
 * data objects by JSON) and pushFeed collapses consecutive duplicates —
 * at the choke points, so every caller benefits and the parser stays untouched.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { useStore } = loadTs('src/renderer/src/store/store.ts');
const { FEED_MAX } = loadTs('src/shared/limits.ts');

function reset() {
  useStore.setState({
    agents: [{ id: 'a', status: 'working', action: 'bash test', currentStation: 'terminal' }],
    feeds: { a: [] }
  });
}

test('identical patch returns state untouched (no notify)', () => {
  reset();
  let notifies = 0;
  const unsub = useStore.subscribe(() => { notifies++; });
  try {
    const before = useStore.getState();
    useStore.getState().updateAgent('a', { status: 'working', action: 'bash test', currentStation: 'terminal' });
    assert.equal(useStore.getState(), before, 'same reference: zustand skips notify');
    assert.equal(notifies, 0);
  } finally {
    unsub();
  }
});

test('changed patch still applies and notifies once', () => {
  reset();
  let notifies = 0;
  const unsub = useStore.subscribe(() => { notifies++; });
  try {
    useStore.getState().updateAgent('a', { status: 'idle', action: 'bash test', currentStation: 'terminal' });
    assert.equal(useStore.getState().agents.find((a) => a.id === 'a').status, 'idle');
    assert.equal(notifies, 1);
  } finally {
    unsub();
  }
});

test('deep-equal blockReason coalesces despite fresh object identity', () => {
  reset();
  const reason = () => ({ summary: 'Waiting', detail: 'x', actions: [{ label: 'Approve' }] });
  useStore.getState().updateAgent('a', { status: 'blocked', blockReason: reason() });
  const before = useStore.getState();
  useStore.getState().updateAgent('a', { status: 'blocked', blockReason: reason() });
  assert.equal(useStore.getState(), before, 'rebuilt-but-identical reason must not notify');
});

test('structurally different blockReason still applies', () => {
  reset();
  useStore.getState().updateAgent('a', { blockReason: { summary: 'one' } });
  useStore.getState().updateAgent('a', { blockReason: { summary: 'two' } });
  assert.equal(useStore.getState().agents.find((a) => a.id === 'a').blockReason.summary, 'two');
});

test('pushFeed collapses consecutive duplicates, keeps real lines, rings the cap', () => {
  reset();
  const { pushFeed } = useStore.getState();
  pushFeed('a', 'line 1');
  pushFeed('a', 'line 1');
  pushFeed('a', 'line 1');
  pushFeed('a', 'line 2');
  assert.deepEqual(useStore.getState().feeds.a, ['line 1', 'line 2']);
  for (let i = 0; i < FEED_MAX + 10; i++) pushFeed('a', `n${i}`);
  const feed = useStore.getState().feeds.a;
  assert.equal(feed.length, FEED_MAX);
  assert.equal(feed[feed.length - 1], `n${FEED_MAX + 9}`);
});

test('100 identical chunk updates notify zero times (the storm shape)', () => {
  reset();
  let notifies = 0;
  const unsub = useStore.subscribe(() => { notifies++; });
  try {
    const patch = { status: 'working', action: 'bash test', currentStation: 'terminal' };
    for (let i = 0; i < 100; i++) useStore.getState().updateAgent('a', patch);
    assert.equal(notifies, 0);
  } finally {
    unsub();
  }
});
