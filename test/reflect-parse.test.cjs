'use strict';

/**
 * B-017: condensation aborted ~80% of the time (issue #459) because the model
 * payload must survive JSON string escaping and models break it two ways:
 * raw control chars inside strings, and prose around the object. Layered
 * recovery — envelope, fence, balanced-brace scan, string repair — keeps the
 * null-on-failure contract (abort, original untouched) while parsing everything
 * with a recoverable shape.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { parseSummary, extractBalancedObject, repairJsonStrings } = loadTs('src/main/reflect.ts');

test('valid strict JSON still parses (all layers agree)', () => {
  const doc = JSON.stringify({ condensed: 'summary here', hoist: ['fact one'] });
  assert.deepEqual(parseSummary(doc), { condensed: 'summary here', hoist: ['fact one'] });
  assert.deepEqual(parseSummary(JSON.stringify({ result: doc })), { condensed: 'summary here', hoist: ['fact one'] });
  assert.deepEqual(parseSummary('```json\n' + doc + '\n```'), { condensed: 'summary here', hoist: ['fact one'] });
});

test('leading/trailing prose no longer aborts', () => {
  const doc = 'Here is the compacted memory:\n{"condensed": "s", "hoist": []}\nLet me know if you need more.';
  assert.deepEqual(parseSummary(doc), { condensed: 's', hoist: [] });
});

test('raw newlines inside strings are repaired (the #459 shape)', () => {
  const doc = '{"condensed": "line1\nline2", "hoist": ["a\nb"]}';
  assert.throws(() => JSON.parse(doc), 'fixture must be invalid JSON');
  assert.deepEqual(parseSummary(doc), { condensed: 'line1\nline2', hoist: ['a\nb'] });
});

test('trailing commas and tabs are repaired', () => {
  assert.deepEqual(
    parseSummary('{"condensed": "s", "hoist": ["a",],}'),
    { condensed: 's', hoist: ['a'] }
  );
  assert.deepEqual(
    parseSummary('{"condensed": "a\tb", "hoist": []}'),
    { condensed: 'a\tb', hoist: [] }
  );
});

test('repair never touches structure outside strings', () => {
  // Braces and brackets inside strings must not confuse the scanner.
  const doc = 'x {"condensed": "a {b} c [d]", "hoist": []} y';
  assert.deepEqual(parseSummary(doc), { condensed: 'a {b} c [d]', hoist: [] });
});

test('unrecoverable shapes still abort (null, never throw)', () => {
  assert.equal(parseSummary(''), null);
  assert.equal(parseSummary('   '), null);
  assert.equal(parseSummary('no json here'), null);
  assert.equal(parseSummary('{"condensed": "unclosed'), null);
  assert.equal(parseSummary('{"hoist": []}'), null, 'missing condensed is not a summary');
  assert.equal(parseSummary('{"condensed": "   ", "hoist": []}'), null, 'blank condensed is not a summary');
  assert.equal(parseSummary('{"condensed": 42, "hoist": []}'), null);
});

test('extractBalancedObject isolates the first balanced object', () => {
  assert.equal(extractBalancedObject('no braces'), null);
  assert.equal(extractBalancedObject('{"a": 1'), null, 'unbalanced aborts');
  assert.equal(extractBalancedObject('pre {"a": {"b": 2}} post'), '{"a": {"b": 2}}');
  assert.equal(extractBalancedObject('{"a": "} not a close"}'), '{"a": "} not a close"}');
});

test('repairJsonStrings is idempotent on valid JSON', () => {
  const doc = JSON.stringify({ condensed: 's with "quotes" and \\ backslash', hoist: [] });
  assert.equal(repairJsonStrings(doc), doc);
});

test('non-string hoist entries are filtered, not fatal', () => {
  assert.deepEqual(
    parseSummary('{"condensed": "s", "hoist": ["ok", 42, null]}'),
    { condensed: 's', hoist: ['ok'] }
  );
});
