// Plans, Razorpay orders and signature checks. Runtime-agnostic (Web Crypto + fetch),
// so the same file runs in Supabase Edge Functions (Deno) and in the Node tests.

// Prices live here, on the server. The browser only ever sends a plan id.
export const PLANS = {
  pro_month: { amount: 39900, label: 'Pack Studio Pro · 1 month' },
  pro_year: { amount: 399000, label: 'Pack Studio Pro · 12 months' },
  business_month: { amount: 99900, label: 'Pack Studio Business · 1 month' },
} as const;

export type PlanId = keyof typeof PLANS;

export function isPlanId(x: unknown): x is PlanId {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(PLANS, x);
}

const enc = new TextEncoder();

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time comparison so timing does not leak how much of a signature matched.
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Checkout callback: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
export async function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, keySecret: string): Promise<boolean> {
  if (!orderId || !paymentId || !signature || !keySecret) return false;
  return safeEqual(await hmacSha256Hex(keySecret, `${orderId}|${paymentId}`), signature);
}

// Webhook: X-Razorpay-Signature = HMAC_SHA256(raw request body, webhook_secret)
export async function verifyWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string): Promise<boolean> {
  if (!signature || !webhookSecret) return false;
  return safeEqual(await hmacSha256Hex(webhookSecret, rawBody), signature);
}

export interface RazorpayKeys { keyId: string; keySecret: string }

export async function createRazorpayOrder(
  fetchImpl: typeof fetch, keys: RazorpayKeys, plan: PlanId, userId: string,
): Promise<{ id: string; amount: number; currency: string }> {
  const res = await fetchImpl('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + btoa(`${keys.keyId}:${keys.keySecret}`),
    },
    body: JSON.stringify({
      amount: PLANS[plan].amount,
      currency: 'INR',
      receipt: `ps_${Date.now().toString(36)}`,
      notes: { user_id: userId, plan },
    }),
  });
  if (!res.ok) throw new Error(`razorpay_order_failed_${res.status}`);
  const order = await res.json();
  return { id: order.id, amount: order.amount, currency: order.currency };
}
