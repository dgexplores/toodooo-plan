'use strict';

/**
 * WhatsApp server wiring tests: handshake, HMAC gate, allowlist, dedupe,
 * body cap — against a live loopback server, no Meta account needed.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const loadTs = require('./load-ts.cjs');

const { WhatsAppServer } = loadTs('src/main/whatsappServer.ts');

const SECRETS = { verifyToken: 'verify-me', appSecret: 'app-secret' };

async function floor(t, opts = {}) {
  const got = [];
  const srv = new WhatsAppServer(() => ({ ...SECRETS }), {
    port: 0,
    allowlist: ['919999999999'],
    onMessage: (m) => got.push(m),
    ...opts
  });
  t.after(() => srv.stop());
  const started = await srv.start();
  assert.equal(started.ok, true, started.error);
  return { srv, got, port: started.port };
}

function sign(raw, secret = SECRETS.appSecret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

async function post(port, body, secret = SECRETS.appSecret) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const res = await fetch(`http://127.0.0.1:${port}/`, {
    method: 'POST',
    headers: { 'X-Hub-Signature-256': sign(raw, secret) },
    body: raw
  });
  return { status: res.status, text: await res.text() };
}

function inbound(from, text, id) {
  return { object: 'x', entry: [{ changes: [{ value: { messages: [{ from, id, type: 'text', text: { body: text } }] } }] }] };
}

test('handshake echoes challenge on token match, 403 otherwise', async (t) => {
  const { port } = await floor(t);
  const ok = await fetch(`http://127.0.0.1:${port}/?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=CH`);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), 'CH');
  const bad = await fetch(`http://127.0.0.1:${port}/?hub.mode=subscribe&hub.verify_token=no&hub.challenge=CH`);
  assert.equal(bad.status, 403);
});

test('allowlisted text dispatches, strangers and dupes do not', async (t) => {
  const { port, got } = await floor(t);
  const r1 = await post(port, inbound('919999999999', 'hi deepak', 'm1'));
  assert.equal(r1.status, 200);
  assert.equal(got.length, 1);
  assert.equal(got[0].text, 'hi deepak');
  const r2 = await post(port, inbound('910000000000', 'spam', 'm2'));
  assert.equal(r2.status, 200);
  assert.equal(got.length, 1, 'stranger held at the gate');
  const r3 = await post(port, inbound('919999999999', 'hi deepak', 'm1'));
  assert.equal(r3.status, 200);
  assert.equal(got.length, 1, 'retry deduped');
});

test('bad signature rejected, oversize rejected, garbage rejected', async (t) => {
  const { port, got } = await floor(t);
  const r1 = await post(port, inbound('919999999999', 'x', 'm9'), 'wrong-secret');
  assert.equal(r1.status, 401);
  const r2 = await post(port, 'not json{{{');
  assert.equal(r2.status, 400);
  assert.equal(got.length, 0);
  const big = 'x'.repeat(300 * 1024);
  const r3 = await post(port, big);
  assert.equal(r3.status, 413);
});

test('missing secrets refuse to start', async (t) => {
  const srv = new WhatsAppServer(
    () => ({ verifyToken: '', appSecret: '' }),
    { port: 0, allowlist: [], onMessage: () => {} }
  );
  t.after(() => srv.stop());
  const r = await srv.start();
  assert.equal(r.ok, false);
  assert.match(r.error, /not configured/);
});

test('strangers land in held, media leaves an explicit note', async (t) => {
  const held = [];
  const media = [];
  const { port } = await floor(t, { onHeld: (m) => held.push(m), onMedia: (m) => media.push(m) });
  const r1 = await post(port, inbound('910000000000', 'let me in', 'h1'));
  assert.equal(r1.status, 200);
  assert.equal(held.length, 1, 'stranger text held, never dispatched');
  assert.equal(held[0].from, '910000000000');
  const r2 = await post(port, inbound('910000000000', 'let me in', 'h1'));
  assert.equal(r2.status, 200);
  assert.equal(held.length, 1, 'held retry deduped');
  const img = { object: 'x', entry: [{ changes: [{ value: { messages: [{ from: '919999999999', id: 'w1', type: 'image', image: { id: 'img' } }] } }] }] };
  const r3 = await post(port, img);
  assert.equal(r3.status, 200);
  assert.equal(media.length, 1, 'allowlisted media noted, not dropped');
  assert.equal(media[0].kind, 'image');
});
