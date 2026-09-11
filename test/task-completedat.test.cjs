'use strict';

// completedAt: patchTask owns the finish stamp — entering done stamps once,
// leaving clears, explicit patch value wins, merge never resurrects a clear.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { HiveManager } = loadTs('src/main/hive.ts');

function floor(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-task-done-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return new HiveManager(() => home);
}

function card(id, extra = {}) {
  return {
    id, title: id, status: 'todo', dependsOn: [], priority: 3,
    createdAt: '2026-09-01T08:00:00.000Z', ...extra
  };
}

const tasks = (hive) => hive.tasks().tasks;
const one = (hive, id) => tasks(hive).find((t) => t.id === id);

test('moving to done stamps completedAt', (t) => {
  const hive = floor(t);
  hive.writeTasks([card('a')]);
  assert.equal(hive.patchTask('a', { status: 'done' }), true);
  const got = one(hive, 'a').completedAt;
  assert.ok(typeof got === 'string' && !Number.isNaN(Date.parse(got)), `no stamp: ${got}`);
});

test('re-done keeps the first stamp; undone clears it', (t) => {
  const hive = floor(t);
  hive.writeTasks([card('a')]);
  hive.patchTask('a', { status: 'done' });
  const first = one(hive, 'a').completedAt;
  hive.patchTask('a', { status: 'done' });
  assert.equal(one(hive, 'a').completedAt, first, 're-done must keep the first finish');
  hive.patchTask('a', { status: 'doing' });
  const second = one(hive, 'a');
  assert.ok(!('completedAt' in second) || second.completedAt == null,
    'leaving done must clear the stamp, not resurrect it');
  hive.patchTask('a', { status: 'done' });
  assert.ok(one(hive, 'a').completedAt, 'finishing again must re-stamp fresh');
});

test('explicit completedAt in the patch wins', (t) => {
  const hive = floor(t);
  hive.writeTasks([card('a')]);
  hive.patchTask('a', { status: 'done', completedAt: '2026-09-05T10:00:00.000Z' });
  assert.equal(one(hive, 'a').completedAt, '2026-09-05T10:00:00.000Z');
});
