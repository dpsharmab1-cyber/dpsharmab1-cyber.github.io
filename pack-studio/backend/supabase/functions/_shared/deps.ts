// Wires the handlers to Supabase and the function secrets (Deno runtime only).
import { createClient } from 'npm:@supabase/supabase-js@2';
import type { Deps } from './handlers.ts';

const env = (k: string) => Deno.env.get(k) ?? '';

export function makeDeps(): Deps {
  const url = env('SUPABASE_URL'), anon = env('SUPABASE_ANON_KEY');
  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  return {
    origin: env('SITE_ORIGIN') || '*',
    async getUser(authHeader) {
      if (!authHeader) return null;
      const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
      const { data } = await client.auth.getUser();
      return data.user ? { id: data.user.id, email: data.user.email } : null;
    },
    async insertPayment(row) {
      const { error } = await admin.from('payments').insert(row);
      if (error) throw error;
    },
    async getPaymentOwner(orderId) {
      const { data } = await admin.from('payments').select('user_id').eq('razorpay_order_id', orderId).maybeSingle();
      return data?.user_id ?? null;
    },
    async markPaid(orderId, paymentId) {
      const { data, error } = await admin.rpc('mark_paid', { p_order_id: orderId, p_payment_id: paymentId });
      if (error) throw error;
      return data;
    },
    async getProfile(userId) {
      const { data } = await admin.from('profiles').select('plan, plan_until').eq('id', userId).single();
      return data;
    },
    fetch,
    razorpay: { keyId: env('RAZORPAY_KEY_ID'), keySecret: env('RAZORPAY_KEY_SECRET') },
    webhookSecret: env('RAZORPAY_WEBHOOK_SECRET'),
  };
}
