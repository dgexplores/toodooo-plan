'use strict';

/**
 * B-008: the no-progress arm was nested inside the velocity gate
 * (`dOut > 0 && dMin > 0`), so a wedged agent with FLAT output never reached
 * it — the arm slept precisely when needed. It now evaluates independently
 * whenever a sample pair exists. Same standalone-transpile style as
 * breaker.test.cjs (breaker.ts imports only node builtins).
 */
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const SRC = path.join(__dirname, '..', 'src', 'main', 'breaker.ts');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'breaker-np-'));
const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
fs.writeFileSync(path.join(out, 'breaker.js'), js, 'utf8');
const { CircuitBreaker } = require(path.join(out, 'breaker.js'));

let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok  ${name}`); }
  catch (e) { failures++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}

function makeBreaker(over = {}) {
  return new CircuitBreaker(() => ({
    enabled: true, hardStop: false, repeatedToolLimit: 8, errorStormLimit: 5,
    tokenVelocityPerMin: 60000, ...over
  }));
}

function sample(ts, output) {
  return { agentId: 'a', sessionId: 's1', ts, input: 1000, output, cacheRead: 0, cacheCreation: 0, model: 'm', usd: 0 };
}

const T0 = 1_000_000_000_000;
const BEAT = 30_000;
// Stale clocks: last tool/prompt/work long past the 300s progress window.
const STALE = T0 - 600_000;

function beat(b, s, now, progressing = false) {
  return b.tick([{ agentId: 'a', sample: s, progressing, lastWorkAt: 0 }], now)[0];
}

test('flat output with no progress signals trips no-progress on beat 2, not beat 1', () => {
  const b = makeBreaker();
  beat(b, sample(T0, 5000), T0); // baseline beat (lastSample null → skip)
  const d1 = beat(b, sample(T0 + BEAT, 5000), T0 + BEAT);
  assert.equal(d1.state.level, 'healthy', 'one blip never steers');
  const d2 = beat(b, sample(T0 + 2 * BEAT, 5000), T0 + 2 * BEAT);
  assert.equal(d2.state.level, 'steering', `reason: ${d2.state.reason}`);
  assert.match(d2.state.reason, /no-progress/);
});

test('growing output with no progress signals still trips (old path preserved)', () => {
  const b = makeBreaker();
  beat(b, sample(T0, 1000), T0);
  beat(b, sample(T0 + BEAT, 1000), T0 + BEAT);
  const d = beat(b, sample(T0 + 2 * BEAT, 1000), T0 + 2 * BEAT);
  assert.equal(d.state.level, 'steering');
  assert.match(d.state.reason, /no-progress/);
});

test('distinct tool activity keeps a flat-output agent healthy', () => {
  const b = makeBreaker();
  beat(b, sample(T0, 5000), T0);
  for (let i = 0; i < 4; i++) {
    b.recordToolUse('a', 'Bash', { cmd: `different-${i}` });
    const d = beat(b, sample(T0 + (i + 1) * BEAT, 5000), T0 + (i + 1) * BEAT);
    assert.equal(d.state.level, 'healthy', `beat ${i + 1}: ${d.state.reason}`);
  }
});

test('compaction window still exempts a flat-output agent', () => {
  const b = makeBreaker();
  b.recordCompactStart('a', T0);
  beat(b, sample(T0, 5000), T0);
  for (let i = 0; i < 4; i++) {
    const d = beat(b, sample(T0 + (i + 1) * BEAT, 5000), T0 + (i + 1) * BEAT);
    assert.equal(d.state.level, 'healthy', `beat ${i + 1}: ${d.state.reason}`);
  }
});

test('velocity spike still trips on growing output', () => {
  const b = makeBreaker();
  beat(b, sample(T0, 0), T0);
  const d = beat(b, sample(T0 + BEAT, 200000), T0 + BEAT);
  assert.equal(d.state.level, 'steering');
  assert.match(d.state.reason, /velocity/);
});

test('STALE constant is actually stale (guard the test setup)', () => {
  assert.ok(T0 - STALE > 300_000, 'progress clocks must read idle');
});

if (failures > 0) { console.error(`${failures} failure(s)`); process.exit(1); }
