'use strict';

/**
 * WhatsApp Cloud API transport tests (India wedge R-05…R-08). Covers the
 * handshake, HMAC verification, inbound parsing incl. every skip reason,
 * allowlist gating, and send (success + API error + validation), the last
 * against a local stub — no network, no Meta account needed.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const loadTs = require('./load-ts.cjs');

const { verifyChallenge, verifySignature, parseInbound, isAllowed, sendText } =
  loadTs('src/main/whatsapp.ts');

test('challenge echoes only on token match', () => {
  const q = { 'hub.mode': 'subscribe', 'hub.verify_token': 'tok123', 'hub.challenge': 'CHAL' };
  assert.equal(verifyChallenge(q, 'tok123'), 'CHAL');
  assert.equal(verifyChallenge(q, 'wrong'), null);
  assert.equal(verifyChallenge({ ...q, 'hub.mode': 'unsubscribe' }, 'tok123'), null);
  assert.equal(verifyChallenge({}, 'tok123'), null);
  assert.equal(verifyChallenge(q, ''), null);
});

test('HMAC verifies over raw bytes, rejects forgery', async () => {
  const secret = 'app-secret';
  const raw = '{"object":"whatsapp_business_account"}';
  const good = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  assert.equal(await verifySignature(raw, good, secret), true);
  assert.equal(await verifySignature(raw + ' ', good, secret), false, 'body tamper fails');
  assert.equal(await verifySignature(raw, 'sha256=00', secret), false);
  assert.equal(await verifySignature(raw, 'md5=abc', secret), false, 'wrong scheme fails');
  assert.equal(await verifySignature(raw, good, ''), false, 'empty secret fails closed');
});

test('inbound text parses; receipts/media/unknown skip loudly', () => {
  const body = {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [
        { value: { messages: [{ from: '919999999999', id: 'm1', type: 'text', text: { body: '  hello deepak  ' } }] } },
        { value: { statuses: [{ id: 'm1', status: 'delivered' }] } },
        { value: { messages: [{ from: '918888888888', id: 'm2', type: 'image', image: { id: 'img' } }] } },
        { value: { messages: [{ from: '', id: 'm3', type: 'text', text: { body: 'x' } }] } }
      ]
    }]
  };
  const { messages, skipped } = parseInbound(body);
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0], { from: '919999999999', text: '  hello deepak  '.slice(0, 4000), messageId: 'm1' });
  assert.ok(skipped.includes('status-receipt'));
  assert.ok(skipped.includes('non-text:image'));
  assert.ok(skipped.includes('missing-from-or-id'));
  assert.deepEqual(parseInbound({}).skipped, ['no-entry']);
  assert.deepEqual(parseInbound(null).skipped, ['no-entry']);
});

test('allowlist fails closed', () => {
  assert.equal(isAllowed('919999999999', []), false);
  assert.equal(isAllowed('919999999999', ['918888888888']), false);
  assert.equal(isAllowed('919999999999', ['919999999999']), true);
});

test('send validates, posts, surfaces API errors', async () => {
  const seen = [];
  const srv = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      seen.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(b) });
      if (seen.length === 1) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ messages: [{ id: 'wamid.1' }] }));
      } else {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Invalid phone number' } }));
      }
    });
  });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const ok = await sendText({ phoneNumberId: '123', token: 'tok', to: '919999999999', text: 'hi', apiBase: base });
    assert.equal(ok.ok, true);
    assert.equal(seen[0].url, '/v21.0/123/messages');
    assert.equal(seen[0].auth, 'Bearer tok');
    assert.equal(seen[0].body.to, '919999999999');
    const bad = await sendText({ phoneNumberId: '123', token: 'tok', to: '000', text: 'hi', apiBase: base });
    assert.equal(bad.ok, false);
    assert.equal(bad.error, 'Invalid phone number');
    assert.deepEqual(await sendText({ phoneNumberId: '', token: 't', to: 'x', text: 'y' }), { ok: false, error: 'missing phoneNumberId/token/to/text' });
  } finally {
    srv.close();
  }
});
