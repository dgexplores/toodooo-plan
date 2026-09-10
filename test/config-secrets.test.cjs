'use strict';

/**
 * B-019: secret VALUES crossed to the renderer (config:get, webhooks:list,
 * org:getTrigger) and inputs were prefilled with them — any renderer XSS
 * dumped tokens. Reads now carry presence booleans; secrets travel only
 * renderer→main through dedicated setters that omit untouched fields
 * (empty would clear server-side).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { redactConfigForRenderer } = loadTs('src/main/config.ts');

function readSrc(p) {
  return fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
}

const FULL = {
  onboardingComplete: true,
  harnessHome: '/tmp/x',
  registeredRepos: [],
  autoMode: false,
  defaultCommand: 'claude',
  semanticMemory: false,
  slackSigningSecret: 'xox-secret',
  slackBotToken: 'xoxb-token',
  groqApiKey: 'gsk-key',
  webhookSecret: 'hook-secret',
  slackChannelId: 'C1'
};

test('redaction strips values, sets presence, keeps the rest, never mutates', () => {
  const before = JSON.parse(JSON.stringify(FULL));
  const r = redactConfigForRenderer(FULL);
  assert.deepEqual(FULL, before, 'input untouched');
  for (const k of ['slackSigningSecret', 'slackBotToken', 'groqApiKey', 'webhookSecret']) {
    assert.ok(!(k in r), `${k} must not cross`);
  }
  assert.equal(r.hasSlackSigningSecret, true);
  assert.equal(r.hasSlackBotToken, true);
  assert.equal(r.hasGroqApiKey, true);
  assert.equal(r.hasWebhookSecret, true);
  assert.equal(r.slackChannelId, 'C1', 'non-secrets intact');
  assert.equal(r.harnessHome, '/tmp/x');
});

test('redaction reports absence honestly (empty/whitespace/missing)', () => {
  const r = redactConfigForRenderer({ ...FULL, slackBotToken: '', groqApiKey: '   ' });
  delete r.webhookSecret;
  assert.equal(r.hasSlackBotToken, false);
  assert.equal(r.hasGroqApiKey, false);
  assert.equal(r.hasSlackSigningSecret, true);
  const empty = redactConfigForRenderer({});
  assert.equal(empty.hasSlackSigningSecret, false);
  assert.equal(empty.hasSlackBotToken, false);
  assert.equal(empty.hasGroqApiKey, false);
  assert.equal(empty.hasWebhookSecret, false);
});

test('config:get serves redacted, org/webhook reads strip values', () => {
  const index = readSrc('src/main/index.ts');
  assert.match(index, /ipcMain\.handle\('config:get', \(\) => redactConfigForRenderer\(readConfig\(\)\)\)/);
  assert.match(index, /hasApiKey: typeof current\.apiKey/);
  assert.match(index, /secret: '',\s*\n?\s*hasSecret:/);
});

test('save paths omit untouched secrets (empty would clear server-side)', () => {
  const modal = readSrc('src/renderer/src/components/SettingsModal.tsx');
  // Slack: conditional spreads, never bare values.
  assert.match(modal, /\.\.\.\(slackSecret\.trim\(\) \? \{ signingSecret:/);
  assert.match(modal, /\.\.\.\(slackBotToken\.trim\(\) \? \{ botToken:/);
  // Groq: conditional apiKey.
  assert.match(modal, /\.\.\.\(groqKey\.trim\(\) \? \{ apiKey:/);
  // Org: apiKey destructured out when blank.
  assert.match(modal, /const \{ apiKey, \.\.\.rest \} = next;/);
  // Webhook list round-trips through the merge that preserves stored secrets.
  assert.match(readSrc('src/main/index.ts'), /prior\?\.secret/);
});

test('no renderer source reads secret values anymore', () => {
  const modal = readSrc('src/renderer/src/components/SettingsModal.tsx');
  assert.doesNotMatch(modal, /cc\.slackSigningSecret|cc\.slackBotToken|cc\.groqApiKey/);
  assert.doesNotMatch(modal, /config\.slackSigningSecret|config\.slackBotToken|config\.groqApiKey/);
  const app = readSrc('src/renderer/src/App.tsx');
  assert.doesNotMatch(app, /c\.groqApiKey/);
  assert.match(app, /c\.hasGroqApiKey/);
});
