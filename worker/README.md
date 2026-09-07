# Stripe checkout worker

A tiny Cloudflare Worker (free tier) that turns the registration and donation forms on the
static site into Stripe Checkout sessions. All form answers are saved as **metadata on the
Stripe payment**, so you can see them in the Stripe Dashboard (Payments → click a payment →
Metadata) or export them as CSV. No database needed.

## One-time setup (about 10 minutes)

1. `cd worker && npm install`
2. `npx wrangler login` (opens the browser, sign in to Cloudflare, free account is fine)
3. `npx wrangler secret put STRIPE_SECRET_KEY` and paste your Stripe **secret** key
   (`sk_test_…` first to test, later `sk_live_…`)
4. `npx wrangler deploy` and copy the printed URL, e.g. `https://seek-movement-checkout.<you>.workers.dev`
5. Paste that URL into `src/_data/site.json` → `payments.checkoutEndpoint`, commit, push.

Test with card number `4242 4242 4242 4242`, any future date, any CVC while using the test key.

## Endpoints

| Method | Path        | Body                                   | Returns          |
|--------|-------------|----------------------------------------|------------------|
| POST   | `/checkout` | all registration form fields (JSON)    | `{ url }` Stripe |
| POST   | `/donate`   | `{ "amount": 50 }`                     | `{ url }` Stripe |

## Changing the price or event

Edit `wrangler.toml` (`REGISTRATION_NAME`, `REGISTRATION_AMOUNT_CENTS`) and run
`npx wrangler deploy` again. Or create a Price in Stripe and set `REGISTRATION_PRICE_ID`.

Coupons: create a Promotion Code in Stripe (Product catalog → Coupons); the Checkout page
shows an "Add promotion code" field automatically.

Receipts: Stripe Dashboard → Settings → Emails → turn on "Successful payments".
