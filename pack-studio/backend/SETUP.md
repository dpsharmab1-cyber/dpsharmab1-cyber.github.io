# Switching on accounts, cloud projects and payments

The studio already works without this: projects save in the visitor's browser. Follow these
steps to add sign-in (email link and Google), projects saved to an account, and paid plans
through Razorpay. Plan on about an hour, plus Razorpay's account activation time.

You need: a Supabase account (free tier is fine), a Razorpay account, and a terminal with
Node.js to run the Supabase CLI once.

---

## 1. Create the Supabase project

1. Go to supabase.com → **New project**. Pick the **Mumbai (ap-south-1)** region for Indian users.
2. When it's ready, open **Project settings → API** (or **API Keys**) and copy:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string starting `eyJ…`). If you see both new "publishable" keys and
     "legacy API keys", use the legacy **anon** key.

   These two are safe to share and go into the website. Never share the **service_role** key or your
   database password.

## 2. Create the tables

1. Open **SQL editor → New query**.
2. Paste the whole of `supabase/migrations/0001_accounts_projects_payments.sql` and press **Run**.

This creates `profiles`, `projects` and `payments` with row-level security (people only see their
own data), the 10-project limit on free accounts, and the `mark_paid` function payments use.

## 3. Set up sign-in

1. **Authentication → URL Configuration**
   - Site URL: `https://dpsharmab1-cyber.github.io/pack-studio/studio/`
   - Redirect URLs: add the same URL.
2. **Email** sign-in is on by default. Supabase's built-in mailer only sends a few emails an hour,
   so before launch add your own SMTP (for example Resend or Brevo) under
   **Authentication → Emails → SMTP settings**.
3. **Google (optional)**
   1. In Google Cloud Console create an **OAuth client ID** (type: Web application).
   2. Authorised redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
   3. Paste the client ID and secret into **Authentication → Providers → Google** and enable it.

## 4. Get Razorpay keys

1. Sign up at razorpay.com and stay in **Test mode** for now.
2. **Settings → API Keys → Generate key** gives a **Key ID** (`rzp_test_…`) and **Key Secret**.
   Keep the secret private; it never goes in the website code.
3. Live payments need account activation (KYC). Razorpay also checks your website for
   **Terms, Privacy policy, Refund/cancellation policy, and Contact** pages. These are already on the
   site (`terms.html`, `privacy.html`, `refund.html`, `contact.html`); fill in the `BUSINESS` block
   in `pack-studio/assets/config.js` (legal name, support email, phone, address, city, grievance officer)
   so they show your details instead of highlighted placeholders. Give Razorpay these URLs:
   - `https://dpsharmab1-cyber.github.io/pack-studio/terms.html`
   - `https://dpsharmab1-cyber.github.io/pack-studio/privacy.html`
   - `https://dpsharmab1-cyber.github.io/pack-studio/refund.html`
   - `https://dpsharmab1-cyber.github.io/pack-studio/contact.html`

## 5. Deploy the payment functions

### Option A (recommended, no terminal): GitHub Actions

1. Create a Supabase access token: supabase.com → your avatar → **Account preferences → Access tokens →
   Generate new token** (name it `github-deploy`).
2. In GitHub open this repository → **Settings → Secrets and variables → Actions → New repository secret**
   and add these five. They are encrypted; nobody, including Claude, can read them back.

   | Secret name | Value |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | the token from step 1 |
   | `SUPABASE_PROJECT_REF` | the project ref, the `abcd1234` part of `https://abcd1234.supabase.co` |
   | `RAZORPAY_KEY_ID` | `rzp_test_…` from step 4 |
   | `RAZORPAY_KEY_SECRET` | the key secret from step 4 |
   | `RAZORPAY_WEBHOOK_SECRET` | a long random string you make up (also used in step 6) |

3. Open the **Actions** tab → **Deploy Pack Studio backend** → **Run workflow**. In about two minutes it
   checks the secrets, runs the payment tests, saves the Razorpay keys into Supabase and deploys the
   three functions. The run summary shows your webhook URL for step 6.

Run it again whenever you change the Razorpay keys (for example when moving from test to live keys).

### Option B: from your own terminal

From this `backend/` folder:

```sh
npx supabase login
npx supabase link --project-ref <your-project-ref>      # the abcd1234 part of the URL

npx supabase secrets set \
  RAZORPAY_KEY_ID=rzp_test_xxx \
  RAZORPAY_KEY_SECRET=xxx \
  RAZORPAY_WEBHOOK_SECRET=<make up a long random string> \
  SITE_ORIGIN=https://dpsharmab1-cyber.github.io

npx supabase functions deploy create-order
npx supabase functions deploy verify-payment
npx supabase functions deploy razorpay-webhook --no-verify-jwt
```

Either way, Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to the
functions automatically.

## 6. Add the Razorpay webhook

The webhook upgrades the account even if someone closes the tab right after paying.

1. Razorpay **Settings → Webhooks → Add new webhook**
2. URL: `https://<your-project>.supabase.co/functions/v1/razorpay-webhook`
3. Secret: the same `RAZORPAY_WEBHOOK_SECRET` you set above.
4. Events: **order.paid** and **payment.captured**.

## 7. Switch it on in the website

Edit `pack-studio/assets/config.js`:

```js
supabaseUrl: 'https://abcd1234.supabase.co',
supabaseAnonKey: 'eyJhbGciOi…',
```

Commit and push. Both values are public by design; your data is protected by the
row-level-security policies, and the secrets stay in Supabase.

## 8. Test, then go live

1. Open the studio, sign in with your email, save a project, reload: it should still be there.
2. Open **Upgrade** and pay with Razorpay's test details (in test mode, UPI `success@razorpay`
   or one of the test cards in Razorpay's docs). Your plan badge should change to **Pro**.
3. When Razorpay activates your account, replace the test keys with **live** keys
   (step 5 secrets) and redeploy nothing else.
4. When you are ready to start charging, set `betaAllFree: false` in `config.js`. Free accounts
   then keep 10 projects, and PNG mockups get a small watermark; GLB and DXF need Pro.

## How payments work

- Plans are one-off purchases of time (1 month, 12 months), not auto-renewing subscriptions,
  so there's no mandate setup. Buying again before expiry adds the time on top.
  Auto-renewal can be added later with Razorpay Subscriptions.
- Prices are set only on the server (`supabase/functions/_shared/billing.ts`). Keep
  `assets/config.js` (what the page shows) in step with them.
- A plan is only granted after Razorpay's signature is verified, either by the browser callback
  (`verify-payment`) or the webhook. Both go through `mark_paid`, which applies a payment once.

## Tests

```sh
# payment logic (signatures, order creation, verification, webhook)
node --test --experimental-strip-types tests/billing.test.ts

# database rules (RLS, free limit, mark_paid) on a local Postgres 16+, see tests/sql/README.md
```
