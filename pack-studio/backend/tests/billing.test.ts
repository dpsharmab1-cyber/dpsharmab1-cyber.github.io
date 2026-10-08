// Run: node --test --experimental-strip-types pack-studio/backend/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { PLANS, isPlanId, verifyCheckoutSignature, verifyWebhookSignature, safeEqual } from '../supabase/functions/_shared/billing.ts';
import { handleCreateOrder, handleVerifyPayment, handleWebhook, type Deps } from '../supabase/functions/_shared/handlers.ts';

const SECRET = 'rzp_test_secret_123', HOOK = 'whsec_456';
const sign = (secret: string, msg: string) => createHmac('sha256', secret).update(msg).digest('hex');

function deps(over: Partial<Deps> = {}) {
  const calls: Record<string, any[]> = { insert: [], markPaid: [], fetch: [] };
  const d: Deps = {
    origin: 'https://example.github.io',
    getUser: async (h) => (h === 'Bearer good' ? { id: 'user-1', email: 'a@b.c' } : null),
    insertPayment: async (row) => { calls.insert.push(row); },
    getPaymentOwner: async (orderId) => (orderId === 'order_1' ? 'user-1' : 'someone-else'),
    markPaid: async (o, p) => { calls.markPaid.push([o, p]); return { plan: 'pro' }; },
    getProfile: async () => ({ plan: 'pro', plan_until: '2026-11-08T00:00:00Z' }),
    fetch: (async (url: string, init: any) => {
      calls.fetch.push([url, init]);
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: 'order_1', amount: body.amount, currency: 'INR' }), { status: 200 });
    }) as any,
    razorpay: { keyId: 'rzp_test_key', keySecret: SECRET },
    webhookSecret: HOOK,
    ...over,
  };
  return { d, calls };
}

const post = (body: unknown, auth = 'Bearer good', headers: Record<string, string> = {}) =>
  new Request('https://fn.local', { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('plans and prices are fixed on the server', () => {
  assert.equal(PLANS.pro_month.amount, 39900);
  assert.equal(PLANS.pro_year.amount, 399000);
  assert.equal(PLANS.business_month.amount, 99900);
  assert.ok(isPlanId('pro_month'));
  assert.ok(!isPlanId('toString'));
  assert.ok(!isPlanId('free'));
});

test('checkout signature: matches Razorpay HMAC, rejects tampering', async () => {
  const good = sign(SECRET, 'order_1|pay_9');
  assert.ok(await verifyCheckoutSignature('order_1', 'pay_9', good, SECRET));
  assert.ok(!(await verifyCheckoutSignature('order_1', 'pay_8', good, SECRET)));
  assert.ok(!(await verifyCheckoutSignature('order_1', 'pay_9', good, 'other')));
  assert.ok(!(await verifyCheckoutSignature('', 'pay_9', good, SECRET)));
});

test('webhook signature covers the raw body', async () => {
  const raw = '{"event":"order.paid"}';
  assert.ok(await verifyWebhookSignature(raw, sign(HOOK, raw), HOOK));
  assert.ok(!(await verifyWebhookSignature(raw + ' ', sign(HOOK, raw), HOOK)));
  assert.ok(!(await verifyWebhookSignature(raw, null, HOOK)));
  assert.ok(!safeEqual('abc', 'abcd'));
});

test('create-order: needs sign-in and a known plan', async () => {
  const { d } = deps();
  assert.equal((await handleCreateOrder(post({ plan: 'pro_month' }, 'Bearer bad'), d)).status, 401);
  assert.equal((await handleCreateOrder(post({ plan: 'gold' }), d)).status, 400);
  assert.equal((await handleCreateOrder(post('not json'), d)).status, 400);
});

test('create-order: server sets the amount and records the order', async () => {
  const { d, calls } = deps();
  const res = await handleCreateOrder(post({ plan: 'pro_month', amount: 1 }), d);
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.deepEqual(out, { orderId: 'order_1', amount: 39900, currency: 'INR', keyId: 'rzp_test_key', label: PLANS.pro_month.label });
  const [url, init] = calls.fetch[0];
  assert.equal(url, 'https://api.razorpay.com/v1/orders');
  assert.equal(init.headers.Authorization, 'Basic ' + Buffer.from(`rzp_test_key:${SECRET}`).toString('base64'));
  assert.equal(JSON.parse(init.body).amount, 39900);
  assert.deepEqual(calls.insert[0], { user_id: 'user-1', plan: 'pro_month', amount: 39900, currency: 'INR', razorpay_order_id: 'order_1' });
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://example.github.io');
});

test('create-order: Razorpay failure is reported, nothing recorded', async () => {
  const { d, calls } = deps({ fetch: (async () => new Response('{}', { status: 401 })) as any });
  assert.equal((await handleCreateOrder(post({ plan: 'business_month' }), d)).status, 502);
  assert.equal(calls.insert.length, 0);
});

test('verify-payment: rejects bad signatures and other people\'s orders', async () => {
  const { d, calls } = deps();
  const bad = { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_9', razorpay_signature: 'nope' };
  assert.equal((await handleVerifyPayment(post(bad), d)).status, 400);
  const other = { razorpay_order_id: 'order_2', razorpay_payment_id: 'pay_9', razorpay_signature: sign(SECRET, 'order_2|pay_9') };
  assert.equal((await handleVerifyPayment(post(other), d)).status, 403);
  assert.equal((await handleVerifyPayment(post(bad, 'Bearer bad'), d)).status, 401);
  assert.equal(calls.markPaid.length, 0);
});

test('verify-payment: valid payment upgrades the plan, and is safe to repeat', async () => {
  const { d, calls } = deps();
  const ok = { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_9', razorpay_signature: sign(SECRET, 'order_1|pay_9') };
  const res = await handleVerifyPayment(post(ok), d);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, profile: { plan: 'pro', plan_until: '2026-11-08T00:00:00Z' } });
  assert.deepEqual(calls.markPaid[0], ['order_1', 'pay_9']);
  const again = deps({ markPaid: async () => null }); // webhook already applied it
  assert.equal((await handleVerifyPayment(post(ok), again.d)).status, 200);
});

test('webhook: verified order.paid marks the order paid; other events are acknowledged', async () => {
  const { d, calls } = deps();
  const raw = JSON.stringify({ event: 'order.paid', payload: { payment: { entity: { id: 'pay_9', order_id: 'order_1' } } } });
  assert.equal((await handleWebhook(post(raw, '', { 'X-Razorpay-Signature': 'forged' }), d)).status, 400);
  assert.equal(calls.markPaid.length, 0);
  assert.equal((await handleWebhook(post(raw, '', { 'X-Razorpay-Signature': sign(HOOK, raw) }), d)).status, 200);
  assert.deepEqual(calls.markPaid[0], ['order_1', 'pay_9']);
  const other = JSON.stringify({ event: 'refund.created', payload: {} });
  assert.equal((await handleWebhook(post(other, '', { 'X-Razorpay-Signature': sign(HOOK, other) }), d)).status, 200);
  assert.equal(calls.markPaid.length, 1);
});

test('CORS preflight is answered', async () => {
  const { d } = deps();
  const res = await handleCreateOrder(new Request('https://fn.local', { method: 'OPTIONS' }), d);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Access-Control-Allow-Headers') || '', /authorization/);
});
