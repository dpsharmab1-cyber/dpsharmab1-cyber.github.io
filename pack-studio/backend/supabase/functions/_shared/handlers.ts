// Request handlers for the three payment functions. Dependencies (database, auth,
// fetch, secrets) are passed in, so the logic is tested without Supabase or Razorpay.

import {
  PLANS, isPlanId, createRazorpayOrder, verifyCheckoutSignature, verifyWebhookSignature, type RazorpayKeys,
} from './billing.ts';

export interface User { id: string; email?: string | null }
export interface PaymentRow { user_id: string; plan: string; amount: number; currency: string; razorpay_order_id: string }

export interface Deps {
  origin: string;                                             // allowed browser origin for CORS
  getUser(authHeader: string | null): Promise<User | null>;   // verifies the Supabase JWT
  insertPayment(row: PaymentRow): Promise<void>;
  getPaymentOwner(orderId: string): Promise<string | null>;
  markPaid(orderId: string, paymentId: string): Promise<unknown | null>;
  getProfile(userId: string): Promise<unknown>;
  fetch: typeof fetch;
  razorpay: RazorpayKeys;
  webhookSecret: string;
}

export function cors(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try { return await req.json(); } catch { return null; }
}

// POST { plan } -> creates a Razorpay order for the signed-in user
export async function handleCreateOrder(req: Request, d: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(d.origin) });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, d.origin);
  const user = await d.getUser(req.headers.get('Authorization'));
  if (!user) return json({ error: 'sign_in_required' }, 401, d.origin);
  const body = await readJson(req);
  const plan = body?.plan;
  if (!isPlanId(plan)) return json({ error: 'unknown_plan' }, 400, d.origin);
  try {
    const order = await createRazorpayOrder(d.fetch, d.razorpay, plan, user.id);
    await d.insertPayment({ user_id: user.id, plan, amount: order.amount, currency: order.currency, razorpay_order_id: order.id });
    return json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: d.razorpay.keyId, label: PLANS[plan].label }, 200, d.origin);
  } catch (e) {
    console.error('create-order', e);
    return json({ error: 'order_failed' }, 502, d.origin);
  }
}

// POST { razorpay_order_id, razorpay_payment_id, razorpay_signature } from Checkout
export async function handleVerifyPayment(req: Request, d: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(d.origin) });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, d.origin);
  const user = await d.getUser(req.headers.get('Authorization'));
  if (!user) return json({ error: 'sign_in_required' }, 401, d.origin);
  const b = await readJson(req);
  const orderId = String(b?.razorpay_order_id ?? ''), paymentId = String(b?.razorpay_payment_id ?? ''), sig = String(b?.razorpay_signature ?? '');
  if (!(await verifyCheckoutSignature(orderId, paymentId, sig, d.razorpay.keySecret))) {
    return json({ error: 'bad_signature' }, 400, d.origin);
  }
  // the order must belong to the person asking
  if ((await d.getPaymentOwner(orderId)) !== user.id) return json({ error: 'not_your_order' }, 403, d.origin);
  await d.markPaid(orderId, paymentId); // null when the webhook got there first; that's fine
  return json({ ok: true, profile: await d.getProfile(user.id) }, 200, d.origin);
}

// Razorpay webhook (order.paid / payment.captured). Backs up the browser callback
// for people who close the tab before it returns.
export async function handleWebhook(req: Request, d: Deps): Promise<Response> {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  const raw = await req.text();
  if (!(await verifyWebhookSignature(raw, req.headers.get('X-Razorpay-Signature'), d.webhookSecret))) {
    return new Response('bad_signature', { status: 400 });
  }
  let event: any;
  try { event = JSON.parse(raw); } catch { return new Response('bad_json', { status: 400 }); }
  if (event?.event === 'order.paid' || event?.event === 'payment.captured') {
    const p = event?.payload?.payment?.entity;
    if (p?.order_id && p?.id) await d.markPaid(p.order_id, p.id);
  }
  return new Response('ok', { status: 200 }); // acknowledge everything verified so Razorpay stops retrying
}
