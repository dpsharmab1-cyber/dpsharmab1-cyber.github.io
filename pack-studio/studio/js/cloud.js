// Accounts, saved projects and payments.
//   LocalStore    projects in this browser (IndexedDB); always available.
//   SupabaseCloud sign-in, projects in your account, Razorpay checkout.
// createCloud() picks Supabase when assets/config.js has keys, else local only.

import { CONFIG } from '../../assets/config.js';

// ---------- browser storage ----------

export class LocalStore {
  constructor(name = 'pack-studio') { this.name = name; }

  db() {
    if (!this._db) {
      this._db = new Promise((resolve, reject) => {
        const req = indexedDB.open(this.name, 1);
        req.onupgradeneeded = () => req.result.createObjectStore('projects', { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this._db;
  }

  async tx(mode, fn) {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const t = db.transaction('projects', mode), store = t.objectStore('projects');
      const req = fn(store);
      t.oncomplete = () => resolve(req?.result);
      t.onerror = () => reject(t.error);
    });
  }

  async list() {
    const all = (await this.tx('readonly', (s) => s.getAll())) || [];
    return all.map(({ state, ...meta }) => meta).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  get(id) { return this.tx('readonly', (s) => s.get(id)); }

  async save(p) {
    const now = new Date().toISOString();
    const row = { ...p, id: p.id || 'local-' + crypto.randomUUID(), created_at: p.created_at || now, updated_at: now };
    await this.tx('readwrite', (s) => s.put(row));
    return row;
  }

  remove(id) { return this.tx('readwrite', (s) => s.delete(id)); }
}

// ---------- plans ----------

export function effectivePlan(profile) {
  if (!profile || profile.plan === 'free' || !profile.plan_until) return 'free';
  return new Date(profile.plan_until) > new Date() ? profile.plan : 'free';
}

// ---------- local-only mode ----------

export class LocalCloud {
  constructor() {
    this.mode = 'local';
    this.user = null;
    this.profile = { plan: 'free' };
    this.local = new LocalStore();
    this.listeners = new Set();
  }
  async init() { return this; }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this); }
  get plan() { return effectivePlan(this.profile); }
  get where() { return 'local'; }
  async signInWithEmail() { throw new Error('accounts_off'); }
  async signInWithGoogle() { throw new Error('accounts_off'); }
  async signOut() {}
  listProjects() { return this.local.list(); }
  getProject(id) { return this.local.get(id); }
  saveProject(p) { return this.local.save(p); }
  deleteProject(id) { return this.local.remove(id); }
  async checkout() { throw new Error('payments_off'); }
}

// ---------- Supabase accounts ----------

export class SupabaseCloud extends LocalCloud {
  constructor(client, { loadCheckout = loadRazorpay } = {}) {
    super();
    this.mode = 'cloud';
    this.sb = client;
    this.loadCheckout = loadCheckout;
  }

  async init() {
    const { data } = await this.sb.auth.getSession();
    await this.setSession(data.session);
    this.sb.auth.onAuthStateChange((_event, session) => {
      // run outside the auth callback (supabase-js recommends not awaiting inside it)
      setTimeout(() => this.setSession(session), 0);
    });
    return this;
  }

  async setSession(session) {
    const u = session?.user || null;
    if ((u?.id || null) === (this.user?.id || null) && this.profile?.loaded) return;
    this.user = u ? { id: u.id, email: u.email } : null;
    this.profile = { plan: 'free' };
    if (u) await this.refreshProfile();
    this.emit();
  }

  async refreshProfile() {
    if (!this.user) return;
    const { data } = await this.sb.from('profiles').select('plan, plan_until').eq('id', this.user.id).maybeSingle();
    this.profile = { ...(data || { plan: 'free' }), loaded: true };
  }

  get where() { return this.user ? 'cloud' : 'local'; }

  redirectUrl() { return location.origin + location.pathname; }

  async signInWithEmail(email) {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: this.redirectUrl() } });
    if (error) throw error;
  }

  async signInWithGoogle() {
    const { error } = await this.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: this.redirectUrl() } });
    if (error) throw error;
  }

  async signOut() {
    await this.sb.auth.signOut();
    await this.setSession(null);
  }

  // Signed in: your account. Signed out: this browser.
  async listProjects() {
    if (!this.user) return super.listProjects();
    const { data, error } = await this.sb.from('projects').select('id, name, template, thumb, created_at, updated_at').order('updated_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getProject(id) {
    if (!this.user || String(id).startsWith('local-')) return super.getProject(id);
    const { data, error } = await this.sb.from('projects').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async saveProject(p) {
    if (!this.user) return super.saveProject(p);
    const row = { name: p.name, template: p.template, state: p.state, thumb: p.thumb };
    const isCloudId = p.id && !String(p.id).startsWith('local-');
    const q = isCloudId
      ? this.sb.from('projects').update(row).eq('id', p.id).select('id, name, updated_at').single()
      : this.sb.from('projects').insert(row).select('id, name, updated_at').single();
    const { data, error } = await q;
    if (error) throw new Error(/free_limit/.test(error.message) ? 'free_limit' : error.message);
    return data;
  }

  async deleteProject(id) {
    if (!this.user || String(id).startsWith('local-')) return super.deleteProject(id);
    const { error } = await this.sb.from('projects').delete().eq('id', id);
    if (error) throw error;
  }

  listLocal() { return this.local.list(); }

  // Copy projects saved in this browser into the account.
  async uploadLocal() {
    let n = 0;
    for (const meta of await this.local.list()) {
      const p = await this.local.get(meta.id);
      await this.saveProject({ ...p, id: null });
      await this.local.remove(meta.id);
      n++;
    }
    return n;
  }

  async checkout(planId) {
    if (!this.user) throw new Error('sign_in_required');
    const { data: order, error } = await this.sb.functions.invoke('create-order', { body: { plan: planId } });
    if (error || !order?.orderId) throw new Error('order_failed');
    const Razorpay = await this.loadCheckout();
    const paid = await new Promise((resolve, reject) => {
      const rz = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'Pack Studio',
        description: order.label,
        prefill: { email: this.user.email },
        theme: { color: '#2547d0' },
        handler: resolve,
        modal: { ondismiss: () => reject(new Error('dismissed')) },
      });
      rz.on('payment.failed', (r) => reject(new Error(r?.error?.description || 'payment_failed')));
      rz.open();
    });
    const { data: result, error: vErr } = await this.sb.functions.invoke('verify-payment', { body: paid });
    if (vErr || !result?.ok) throw new Error('verify_failed');
    this.profile = { ...result.profile, loaded: true };
    this.emit();
    return this.profile;
  }
}

let rzp;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  rzp ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => { rzp = null; reject(new Error('checkout_unavailable')); };
    document.head.appendChild(s);
  });
  return rzp;
}

export async function createCloud() {
  if (CONFIG.supabaseUrl && CONFIG.supabaseAnonKey) {
    try {
      const { createClient } = await import('./vendor/supabase.bundle.mjs');
      const client = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      });
      return await new SupabaseCloud(client).init();
    } catch (e) {
      console.warn('Accounts unavailable, saving in this browser instead.', e);
    }
  }
  return new LocalCloud().init();
}
