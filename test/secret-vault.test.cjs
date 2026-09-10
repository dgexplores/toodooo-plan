'use strict';

/**
 * B-020: scalar config secrets lived PLAINTEXT in config.json. They now live
 * encrypted (OS keychain via safeStorage), migrate one-way with verify-before-
 * clear, and degrade to the legacy path (never breakage) where encryption is
 * unavailable. Trigger secrets + org key stay in config for now (broader
 * surface) but never cross IPC (B-019) — noted debt, not silent.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const TAG = 'enc:';
const electron = require.resolve('electron');
require.cache[electron] = {
  id: electron,
  filename: electron,
  loaded: true,
  exports: {
    Notification: class { static isSupported() { return false; } },
    safeStorage: {
      isEncryptionAvailable: () => globalThis.__vaultOn !== false,
      encryptString: (s) => Buffer.from(TAG + s, 'utf8'),
      decryptString: (b) => Buffer.from(b).toString('utf8').replace(new RegExp(`^${TAG}`), '')
    }
  }
};

const vault = loadTs('src/main/secretVault.ts');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'md-vault-'));
}

test('round-trip + owner-only file + has/remove', (t) => {
  globalThis.__vaultOn = true;
  const dir = tmpDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  vault.initVault(dir);
  assert.equal(vault.vaultAvailable(), true);
  assert.equal(vault.vaultSet('slackBotToken', 'xoxb-secret'), true);
  assert.equal(vault.vaultGet('slackBotToken'), 'xoxb-secret');
  assert.equal(vault.vaultHas('slackBotToken'), true);
  assert.equal(vault.vaultHas('groqApiKey'), false);
  const files = fs.readdirSync(dir);
  assert.equal(files.length, 1);
  assert.equal(fs.statSync(path.join(dir, files[0])).mode & 0o777, 0o600);
  assert.ok(!fs.readFileSync(path.join(dir, files[0]), 'utf8').includes('xoxb-secret'), 'ciphertext at rest');
  vault.vaultRemove('slackBotToken');
  assert.equal(vault.vaultHas('slackBotToken'), false);
});

test('no encryption: set fails closed, get is undefined, nothing written', (t) => {
  globalThis.__vaultOn = false;
  const dir = tmpDir();
  t.after(() => { globalThis.__vaultOn = true; fs.rmSync(dir, { recursive: true, force: true }); });
  vault.initVault(dir);
  assert.equal(vault.vaultAvailable(), false);
  assert.equal(vault.vaultSet('groqApiKey', 'gsk-x'), false);
  assert.equal(vault.vaultGet('groqApiKey'), undefined);
  assert.equal(fs.existsSync(path.join(dir, 'config-secrets.json')), false);
});

test('migration moves with verify-then-clear, idempotent', (t) => {
  globalThis.__vaultOn = true;
  const dir = tmpDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  vault.initVault(dir);
  const cfg = { slackBotToken: 'xoxb-t', groqApiKey: 'gsk-t' };
  const cleared = [];
  const r1 = vault.migrateConfigSecrets(() => ({ ...cfg }), (keys) => {
    cleared.push(...keys);
    for (const k of keys) delete cfg[k];
  });
  assert.deepEqual(r1.moved.sort(), ['groqApiKey', 'slackBotToken']);
  assert.deepEqual(r1.keptPlaintext, []);
  assert.deepEqual(cleared.sort(), ['groqApiKey', 'slackBotToken']);
  assert.deepEqual(cfg, {}, 'plaintext gone after verified move');
  assert.equal(vault.vaultGet('slackBotToken'), 'xoxb-t');
  const r2 = vault.migrateConfigSecrets(() => ({ ...cfg }), () => { throw new Error('must not clear'); });
  assert.deepEqual(r2.moved, []);
});

test('migration without encryption keeps plaintext and clears nothing', (t) => {
  globalThis.__vaultOn = false;
  const dir = tmpDir();
  t.after(() => { globalThis.__vaultOn = true; fs.rmSync(dir, { recursive: true, force: true }); });
  vault.initVault(dir);
  let cleared = false;
  const r = vault.migrateConfigSecrets(
    () => ({ slackBotToken: 'xoxb-t' }),
    () => { cleared = true; }
  );
  assert.deepEqual(r.moved, []);
  assert.deepEqual(r.keptPlaintext, ['slackBotToken']);
  assert.equal(cleared, false, 'legacy path untouched');
});

test('corrupt vault file reads as empty, never throws', (t) => {
  globalThis.__vaultOn = true;
  const dir = tmpDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  vault.initVault(dir);
  fs.writeFileSync(path.join(dir, 'config-secrets.json'), '{broken');
  assert.equal(vault.vaultGet('slackBotToken'), undefined);
  assert.equal(vault.vaultSet('slackBotToken', 'x'), true, 'writes over corruption');
  assert.equal(vault.vaultGet('slackBotToken'), 'x');
});
