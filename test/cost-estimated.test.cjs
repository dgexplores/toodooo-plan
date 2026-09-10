'use strict';

/**
 * B-018: unknown-model offline figures were Sonnet-priced silently, presenting
 * guesses as metered cost. Default-priced figures are now labeled estimated
 * from record → bucket → sample → ledger row. Spend is never blocked (local
 * and open models must keep working); honesty is enforced instead.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const loadTs = require('./load-ts.cjs');

const FAKE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'home-cost-'));
process.env.HOME = FAKE_HOME;
process.env.USERPROFILE = FAKE_HOME;

const SRC = path.join(__dirname, '..', 'src', 'main');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cost-'));
for (const name of ['pricing', 'transcript']) {
  const js = ts.transpileModule(fs.readFileSync(path.join(SRC, `${name}.ts`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText;
  fs.writeFileSync(path.join(out, `${name}.js`), js, 'utf8');
}
const { isKnownModelFamily, estimateCostUsd } = require(path.join(out, 'pricing.js'));
const { readAgentUsage, projectDir } = require(path.join(out, 'transcript.js'));
const { HiveManager } = loadTs('src/main/hive.ts');

function makeProject() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-cost-'));
  const dir = projectDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  return { cwd, dir };
}

function rec(model, output) {
  return JSON.stringify({
    type: 'assistant',
    sessionId: 's1',
    message: { model, usage: { input_tokens: 10, output_tokens: output, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }
  });
}

test('known families match, everything else is default-priced', () => {
  assert.equal(isKnownModelFamily('claude-opus-4-8'), true);
  assert.equal(isKnownModelFamily('claude-opus-4-8[1m]'), true);
  assert.equal(isKnownModelFamily('claude-sonnet-4-6'), true);
  assert.equal(isKnownModelFamily('CLAUDE-HAIKU-4-5'), true);
  assert.equal(isKnownModelFamily('qwen-max'), false);
  assert.equal(isKnownModelFamily('llama-3.1-8b'), false);
  assert.equal(isKnownModelFamily(undefined), false);
  assert.equal(isKnownModelFamily(''), false);
});

test('unknown-model records are still costed, but flagged', () => {
  const { cwd, dir } = makeProject();
  fs.writeFileSync(path.join(dir, 'a.jsonl'),
    rec('mystery-model-9', 1000) + '\n' + rec('claude-haiku-4-5', 1000) + '\n');
  const u = readAgentUsage(cwd);
  assert.ok(u.estimatedCostUsd > 0, 'guesses still accumulate, never blocked');
  assert.equal(u.defaultPriced, true, 'one default-priced record taints the bucket');
  assert.equal(u.model, 'claude-haiku-4-5', 'model still tracks the latest seen');
});

test('all-known buckets stay unflagged', () => {
  const { cwd, dir } = makeProject();
  fs.writeFileSync(path.join(dir, 'a.jsonl'), rec('claude-sonnet-4-6', 100) + '\n');
  const u = readAgentUsage(cwd);
  assert.equal(u.defaultPriced, false);
});

test('ledger rows carry the flag only when estimated', async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-ledger-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  await hive.ensureAgent({ id: 'a', name: 'A', provider: 'claude', cwd: home });
  const base = { agentId: 'a', sessionId: 's1', ts: 1, input: 1, output: 1, cacheRead: 0, cacheCreation: 0, model: 'm' };
  hive.appendCostLedger({ ...base, usd: 0.5 });
  hive.appendCostLedger({ ...base, usd: 0.5, estimated: true });
  const rows = fs.readFileSync(path.join(home, 'hive', 'cost-ledger.jsonl'), 'utf8')
    .trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(rows.length, 2);
  assert.ok(!('estimated' in rows[0]), 'metered rows stay schema-clean');
  assert.equal(rows[1].estimated, true);
});

test('estimate math unchanged by labeling', () => {
  const usd = estimateCostUsd('claude-haiku-4-5', { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
  assert.equal(usd, 0.8);
});
