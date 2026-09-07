# The Seek Movement – seekmovement.org

Static site for The Seek Movement, built with [Eleventy](https://www.11ty.dev/) and deployed to
GitHub Pages by the workflow in `.github/workflows/deploy.yml` on every push to `main`.

## Run locally

```bash
npm install
npm run dev        # http://localhost:8080
```

## Where things live

| What                              | Where                                   |
|-----------------------------------|-----------------------------------------|
| Home page                         | `src/index.njk`                         |
| About / Donate / FAQ              | `src/about.njk`, `src/donate.njk`, `src/faq.njk` |
| FAQ questions (shared)            | `src/_includes/partials/faq-items.njk`  |
| Registration form                 | `src/registration.njk`                  |
| Survey and waiver forms           | `src/survey.njk`, `src/release.njk`     |
| Legal pages (Markdown)            | `src/legal/*.md`                        |
| Event details, price, email, keys | `src/_data/site.json`                   |
| Header / footer                   | `src/_includes/partials/`               |
| Styles / scripts / images         | `src/assets/`                           |
| Stripe checkout worker            | `worker/` (see `worker/README.md`)      |

## Payments and forms

- **Registration and donations** go through Stripe Checkout via the worker in `worker/`.
  Set `payments.checkoutEndpoint` in `src/_data/site.json` to the deployed worker URL.
  Without it, the buttons fall back to `payments.registrationPaymentLink` /
  `payments.donatePaymentLink` (Stripe Payment Links) if set, otherwise they show a
  "not available yet" message.
- **Survey and waiver forms** post JSON to `forms.endpoint`. Not connected yet; follow
  [docs/connect-forms.md](docs/connect-forms.md) when ready (about 10 minutes).

## Going live on seekmovement.org

1. Push to `main`; the site deploys to `https://vanluda.github.io/seek-movement/`.
2. In the repo: Settings → Secrets and variables → Actions → Variables → add
   `CUSTOM_DOMAIN` = `seekmovement.org`. Re-run the workflow.
3. In the repo: Settings → Pages → Custom domain → `seekmovement.org` → Save, then tick
   "Enforce HTTPS" once the certificate is issued.
4. In `worker/wrangler.toml` set `SITE_URL` back to `https://seekmovement.org`, then run
   `cd worker && npx wrangler deploy` so Stripe returns people to the real domain.
5. At the DNS host (Porkbun), replace the current A record for `seekmovement.org` with
   GitHub's four A records and add `www` as a CNAME to `vanluda.github.io`:

   ```
   A     @     185.199.108.153
   A     @     185.199.109.153
   A     @     185.199.110.153
   A     @     185.199.111.153
   CNAME www   vanluda.github.io
   ```
