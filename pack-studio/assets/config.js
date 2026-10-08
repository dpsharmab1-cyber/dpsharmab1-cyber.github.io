// Switch on accounts and payments by filling in your Supabase project here.
// See backend/SETUP.md. Until then the studio saves projects in the browser.
//
// Both values are meant to be public: the anon key can only do what the
// row-level-security policies allow, and secrets (Razorpay key secret, service
// role key) live only in the Supabase function settings, never in this file.
export const CONFIG = {
  supabaseUrl: '',        // e.g. 'https://abcdefghijkl.supabase.co'
  supabaseAnonKey: '',    // Project settings → API → anon public key

  // While true, every feature is unlocked for everyone (beta). Set to false once
  // payments are live to apply the free plan limits below.
  betaAllFree: true,
  freeCloudProjects: 10,  // keep in sync with enforce_free_limit() in the SQL
};

// What each paid plan costs, for display. The real prices are set on the server
// (backend/supabase/functions/_shared/billing.ts); keep the two in step.
export const PLANS = [
  { id: 'pro_month', tier: 'pro', name: 'Pro', price: '₹399', per: 'month', note: 'Cancel any time' },
  { id: 'pro_year', tier: 'pro', name: 'Pro yearly', price: '₹3,990', per: 'year', note: '2 months free' },
  { id: 'business_month', tier: 'business', name: 'Business', price: '₹999', per: 'month', note: 'For printers and teams' },
];
