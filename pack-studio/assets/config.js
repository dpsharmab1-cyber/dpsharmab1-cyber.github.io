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
  { id: 'pro_month', tier: 'pro', name: 'Pro', price: '₹399', per: 'month', note: 'No auto-renewal' },
  { id: 'pro_year', tier: 'pro', name: 'Pro yearly', price: '₹3,990', per: 'year', note: '2 months free' },
  { id: 'business_month', tier: 'business', name: 'Business', price: '₹999', per: 'month', note: 'For printers and teams' },
];

// Business details shown on the Terms, Privacy, Refund and Contact pages.
// Razorpay checks these pages before approving live payments, so fill in every
// field. Empty fields show as highlighted placeholders on the pages.
export const BUSINESS = {
  brand: 'Pack Studio',
  legalName: '',          // e.g. 'Your Name (sole proprietor)' or 'Your Company Private Limited'
  email: '',              // support email, e.g. 'support@yourdomain.com'
  phone: '',              // e.g. '+91 98xxx xxxxx'
  address: '',            // full postal address, including PIN code
  city: '',               // city whose courts handle disputes, e.g. 'Jaipur, Rajasthan'
  gstin: '',              // optional; leave empty if not GST-registered
  grievanceOfficer: '',   // name of the person who handles privacy and complaints
  hours: 'Monday to Saturday, 10:00 to 18:00 IST',
  effectiveDate: '8 October 2026',
};
