'use strict';

/**
 * India wedge, money half (R-09/R-10): dual-currency display off a manual
 * offline rate, and a hard daily cap (IST day, ledger-measured) enforced at
 * the single spawn door. Running agents always finish — the gate stops NEW
 * spend, never kills work.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { usdToInr, formatInr, istDayStart } = loadTs('src/shared/money.ts');
const { HiveManager } = loadTs('src/main/hive.ts');

function readSrc(p) {
  return fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
}

test('usd→inr converts only on a sane manual rate', () => {
  assert.equal(usdToInr(2, 83.5), 167);
  assert.equal(usdToInr(0, 83.5), 0);
  assert.equal(usdToInr(2, null), null, 'no rate = USD only, never a guess');
  assert.equal(usdToInr(2, 0), null);
  assert.equal(usdToInr(2, -5), null);
  assert.equal(usdToInr(-2, 83.5), null);
  assert.equal(usdToInr(NaN, 83.5), null);
});

test('inr formats en-IN, sub-rupee floors', () => {
  assert.equal(formatInr(2, 83.5), '₹167');
  assert.equal(formatInr(123456.78, 83), '₹1,02,46,913', 'lakh grouping');
  assert.equal(formatInr(0.001, 83.5), '<₹1');
  assert.equal(formatInr(2, null), null);
});

test('IST midnight is exact (no DST, fixed +5:30)', () => {
  // 2026-06-01T00:00 IST == 2026-05-31T18:30Z.
  const midnightUtc = Date.UTC(2026, 5, 1, 0, 0, 0);
  assert.equal(istDayStart(midnightUtc), Date.UTC(2026, 4, 31, 18, 30));
  const dayStart = istDayStart(Date.UTC(2026, 5, 1, 12, 0, 0));
  assert.equal(new Date(dayStart).toISOString(), '2026-05-31T18:30:00.000Z');
  // Just before an IST midnight belongs to the day ending, not the one starting.
  assert.equal(istDayStart(Date.UTC(2026, 4, 31, 18, 29, 59)), dayStart - 86_400_000);
});

test('todaySpendUsd sums only this IST day, skips garbage', async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-inr-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  await hive.ensureAgent({ id: 'a', name: 'A', provider: 'claude', cwd: home });
  const now = Date.UTC(2026, 5, 1, 12, 0, 0); // 17:30 IST
  const rows = [
    { ts: now - 3600_000, usd: 1.5 },
    { ts: now - 7200_000, usd: 2.5 },
    { ts: now - 26 * 3600_000, usd: 100 }, // previous IST day, in window when looking back
    { ts: now - 50 * 3600_000, usd: 1000 }, // two IST days back
    { ts: 'junk', usd: 50 },
    { ts: now, usd: -5 },
    { ts: now }
  ];
  fs.appendFileSync(
    path.join(home, 'hive', 'cost-ledger.jsonl'),
    rows.map((r) => JSON.stringify({ agent_id: 'a', session_id: 's', ...r })).join('\n') + '\nnot json\n'
  );
  assert.equal(hive.todaySpendUsd(now), 4.0, 'rows before IST midnight excluded');
  assert.equal(hive.todaySpendUsd(now - 26 * 3600_000), 104, 'looking back widens, never narrows');
  assert.equal(hive.todaySpendUsd(now - 50 * 3600_000), 1104, 'oldest window sees everything since');
});

test('spawn gate checks the daily cap (contract)', () => {
  const src = readSrc('src/main/index.ts');
  assert.match(src, /dailyCapUsd/);
  assert.match(src, /todaySpendUsd\(\)/);
  assert.match(src, /spawn-refused-cap/);
  assert.match(src, /running agents finish/i);
});

test('client tagging attributes ledger rows without rewriting history', async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-client-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  await hive.ensureAgent({ id: 'a', name: 'A', provider: 'claude', cwd: home });
  const base = { agentId: 'a', sessionId: 's', ts: Date.now(), input: 1, output: 1, cacheRead: 0, cacheCreation: 0, model: 'm', usd: 2 };
  hive.appendCostLedger({ ...base });
  assert.equal(hive.setClientKey('a', 'acme').ok, true);
  hive.appendCostLedger({ ...base, usd: 3 });
  assert.equal(hive.setClientKey('ghost', 'x').ok, false);
  assert.equal(hive.setClientKey('a', '   ').clientKey, undefined, 'empty clears');
  const s = hive.spendByClient();
  assert.equal(s.total, 5);
  assert.equal(s.byClient.acme, 3, 'only post-tag rows attribute');
  assert.equal(s.unattributed, 2, 'pre-tag rows stay unattributed');
});

test('fleet rows expose the client key', () => {
  const src = readSrc('src/main/index.ts');
  assert.match(src, /clientKey: a\.clientKey \?\? null/);
});

test('fleet rows carry dual currency (null when no rate)', () => {
  const src = readSrc('src/main/index.ts');
  assert.match(src, /usdInr: formatInr\(usd, readConfig\(\)\.fxUsdInr\)/);
});
