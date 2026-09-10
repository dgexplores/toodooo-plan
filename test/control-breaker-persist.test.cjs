'use strict';

/**
 * B-007: pauses, halts, gates, steers and breaker levels/counters must survive
 * a restart. Both registries persist through injected storage (the app wires
 * SQLite kv; tests use a memory stand-in). Velocity baselines deliberately do
 * NOT survive (a stale baseline would false-trip the first post-restart beat).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { ControlRegistry } = loadTs('src/main/control.ts');
const { CircuitBreaker } = loadTs('src/main/breaker.ts');

function memoryStore(initial) {
  let saved = initial;
  return {
    store: {
      load: () => saved,
      save: (v) => { saved = JSON.parse(JSON.stringify(v)); }
    },
    peek: () => saved
  };
}

const CFG = () => ({
  enabled: true, hardStop: false, repeatedToolLimit: 8, errorStormLimit: 5,
  tokenVelocityPerMin: 60000
});
const sample = (ts, output) => ({
  agentId: 'a', sessionId: 's1', ts, input: 1000, output, cacheRead: 0, cacheCreation: 0, model: 'm', usd: 0
});

// ─── ControlRegistry ─────────────────────────────────────────────────────────

test('control state round-trips through storage', () => {
  const { store } = memoryStore();
  const a = new ControlRegistry(store);
  a.pause('jim-1', true);
  a.halt('jim-1', true);
  a.gateTool('jim-1', 'Bash', true);
  a.steer('jim-1', 'be careful');
  a.pauseAutoDelivery('jim-1', true);
  const b = new ControlRegistry(store);
  assert.deepEqual(b.snapshot('jim-1'), {
    paused: true,
    halted: true,
    autoDeliveryPaused: true,
    gatedTools: ['Bash'],
    pendingSteers: 1
  });
  assert.equal(b.takeSteer('jim-1'), 'be careful');
});

test('control mutations persist incrementally, resume clears', () => {
  const { store, peek } = memoryStore();
  const a = new ControlRegistry(store);
  a.pause('jim-1', true);
  assert.equal(peek().agents['jim-1'].paused, true);
  a.resume('jim-1');
  assert.equal(peek().agents['jim-1'].paused, false);
  assert.equal(peek().agents['jim-1'].halted, false);
  a.gateTool('jim-1', 'Bash', true);
  a.gateTool('jim-1', 'Bash', false);
  assert.deepEqual(peek().agents['jim-1'].gatedTools, []);
  a.steer('jim-1', 'x');
  a.clearSteers('jim-1');
  const b = new ControlRegistry(store);
  assert.equal(b.snapshot('jim-1').pendingSteers, 0);
});

test('control load bounds hostile snapshots and never throws', () => {
  const evil = { agents: { 'jim-1': { paused: 'yes', gatedTools: 'Bash', steerQueue: ['ok', 42, 'x'.repeat(20000)] } } };
  const b = new ControlRegistry(memoryStore(evil).store);
  const s = b.snapshot('jim-1');
  assert.equal(s.paused, false);
  assert.deepEqual(s.gatedTools, []);
  assert.equal(s.pendingSteers, 2);
  for (const bad of [null, 'str', 42, [], { agents: null }, { agents: { '': { paused: true } } }]) {
    assert.doesNotThrow(() => new ControlRegistry(memoryStore(bad).store));
  }
  const throwing = { load: () => { throw new Error('disk gone'); } };
  assert.doesNotThrow(() => new ControlRegistry(throwing));
});

test('control without storage behaves exactly as before', () => {
  const a = new ControlRegistry();
  a.pause('jim-1', true);
  assert.equal(a.snapshot('jim-1').paused, true);
  a.hydrate(); // no-op, must not throw
});

// ─── CircuitBreaker ──────────────────────────────────────────────────────────

test('breaker level and counters survive reconstruct', () => {
  const { store } = memoryStore();
  const a = new CircuitBreaker(CFG, store);
  for (let i = 0; i < 8; i++) a.recordToolUse('a', 'Bash', { cmd: 'same' });
  const d = a.tick([{ agentId: 'a', sample: null, progressing: true, lastWorkAt: 0 }], 1_000_000);
  assert.equal(d[0].state.level, 'steering');
  const b = new CircuitBreaker(CFG, store);
  assert.equal(b.levelFor('a'), 'steering', 'level must survive restart');
  assert.equal(b.agents.get('a').repeatCount, 8, 'counters must survive restart');
});

test('breaker drops the velocity baseline on hydrate (no stale-trip)', () => {
  const { store } = memoryStore();
  const a = new CircuitBreaker(CFG, store);
  a.tick([{ agentId: 'a', sample: sample(1_000_000, 1000), progressing: true, lastWorkAt: 0 }], 1_000_000);
  const b = new CircuitBreaker(CFG, store);
  assert.equal(b.agents.get('a').lastSample, null, 'baseline resets so the first post-restart beat skips velocity');
  assert.equal(b.levelFor('a'), 'healthy');
});

test('breaker corrupt snapshots hydrate to healthy without throwing', () => {
  for (const bad of [null, 'str', [], { a: null }, { a: { level: 'godmode', repeatCount: 'x' } }]) {
    const b = new CircuitBreaker(CFG, memoryStore(bad).store);
    assert.equal(b.levelFor('a'), 'healthy');
  }
  const throwing = { load: () => { throw new Error('disk gone'); } };
  assert.doesNotThrow(() => new CircuitBreaker(CFG, throwing));
});

test('breaker forget persists the removal', () => {
  const { store, peek } = memoryStore();
  const a = new CircuitBreaker(CFG, store);
  a.recordError('a');
  a.tick([{ agentId: 'a', sample: null, progressing: true, lastWorkAt: 0 }], 1_000_000);
  assert.ok('a' in peek(), 'tick persists the agent');
  a.forget('a');
  assert.ok(!('a' in peek()), 'forget persists the removal');
  assert.equal(a.levelFor('a'), 'healthy');
});
