/**
 * The Seek Movement – Stripe Checkout worker (Cloudflare Workers)
 *
 * POST /checkout  { email, first_name, last_name, ... }  -> { url }  (retreat registration)
 * POST /donate    { amount }                             -> { url }  (donation, any amount)
 *
 * The site collects the registration details, this worker creates a Stripe Checkout
 * Session and stores every form field as metadata on the payment, then the browser is
 * redirected to Stripe's hosted payment page. Nothing is stored here.
 */

const STRIPE_API = "https://api.stripe.com/v1/checkout/sessions";
const META_LIMIT = 500; // Stripe: metadata values max 500 chars

const REQUIRED = [
  "email", "first_name", "last_name", "phone", "address", "city", "state", "zip", "country",
  "diet_allergies", "emergency_name", "emergency_phone", "emergency_relationship",
  "medical_conditions", "medical_medications", "question_pattern", "question_future", "legal_media",
];
const CONSENTS = ["legal_medical", "terms", "liability_waiver"];
const MEDIA_CHOICES = [
  "Yes: I’m okay being included in photos and videos",
  "Group only: I’m okay with wide/group shots, but please avoid close-ups of me",
  "No: please do not photograph or record me (I understand I may appear incidentally in background/wide shots)",
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
    if (origin && !isAllowedOrigin(origin, env)) return json({ error: "Origin not allowed" }, 403, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, cors); }

    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/checkout") return json(await createRegistrationSession(body, env), 200, cors);
      if (pathname === "/donate") return json(await createDonationSession(body, env), 200, cors);
      return json({ error: "Not found" }, 404, cors);
    } catch (err) {
      return json({ error: err.message || "Something went wrong" }, err.status || 400, cors);
    }
  },
};

/* ---------------- registration ---------------- */
async function createRegistrationSession(data, env) {
  if (data.website) throw httpError("Spam detected", 400); // honeypot

  for (const key of REQUIRED) {
    if (!str(data[key])) throw httpError(`Missing required field: ${label(key)}`);
  }
  for (const key of CONSENTS) {
    if (!truthy(data[key])) throw httpError(`Please accept: ${label(key)}`);
  }
  const email = str(data.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError("Please enter a valid email address.");
  if (!MEDIA_CHOICES.includes(str(data.legal_media))) throw httpError("Please choose a photo/video consent option.");

  const metadata = { type: "registration", event: str(data.event) || env.REGISTRATION_NAME || "Retreat registration" };
  for (const key of [...REQUIRED, ...CONSENTS]) {
    metadata[key] = key in data && typeof data[key] === "boolean" ? String(data[key]) : str(data[key]);
  }

  const params = {
    mode: "payment",
    customer_email: email,
    success_url: `${siteUrl(env)}/registration/thank-you/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl(env)}/registration/`,
    allow_promotion_codes: "true",
    "line_items[0][quantity]": "1",
    "payment_intent_data[description]": `${metadata.event} – ${str(data.first_name)} ${str(data.last_name)}`,
  };

  if (env.REGISTRATION_PRICE_ID) {
    params["line_items[0][price]"] = env.REGISTRATION_PRICE_ID;
  } else {
    const cents = parseInt(env.REGISTRATION_AMOUNT_CENTS || "0", 10);
    if (!(cents > 0)) throw httpError("Registration price is not configured.", 500);
    params["line_items[0][price_data][currency]"] = "usd";
    params["line_items[0][price_data][unit_amount]"] = String(cents);
    params["line_items[0][price_data][product_data][name]"] = env.REGISTRATION_NAME || "Retreat registration";
  }

  addMetadata(params, metadata);
  const session = await stripe(params, env);
  return { url: session.url, id: session.id };
}

/* ---------------- donation ---------------- */
async function createDonationSession(data, env) {
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount < 1) throw httpError("Please enter an amount of $1 or more.");
  if (amount > 100000) throw httpError("For gifts over $100,000 please contact us directly.");
  const cents = Math.round(amount * 100);

  const params = {
    mode: "payment",
    submit_type: "donate",
    success_url: `${siteUrl(env)}/donate/thank-you/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl(env)}/donate/`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(cents),
    "line_items[0][price_data][product_data][name]": env.DONATION_NAME || "Donation to The Seek Movement",
    "payment_intent_data[description]": "Donation to The Seek Movement",
  };
  addMetadata(params, { type: "donation", amount: amount.toFixed(2) });
  const session = await stripe(params, env);
  return { url: session.url, id: session.id };
}

/* ---------------- helpers ---------------- */
async function stripe(params, env) {
  if (!env.STRIPE_SECRET_KEY) throw httpError("Stripe is not configured (missing STRIPE_SECRET_KEY).", 500);
  const res = await fetch(STRIPE_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const json = await res.json();
  if (!res.ok) throw httpError(json.error?.message || "Stripe rejected the request.", 502);
  return json;
}

function addMetadata(params, metadata) {
  for (const [key, value] of Object.entries(metadata)) {
    const v = String(value ?? "").slice(0, META_LIMIT);
    params[`metadata[${key}]`] = v;
    params[`payment_intent_data[metadata][${key}]`] = v;
  }
}

function siteUrl(env) {
  return (env.SITE_URL || "https://seekmovement.org").replace(/\/+$/, "");
}
function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || siteUrl(env)).split(",").map((s) => s.trim()).filter(Boolean);
}
function isAllowedOrigin(origin, env) {
  return allowedOrigins(env).includes(origin);
}
function corsHeaders(origin, env) {
  const allow = isAllowedOrigin(origin, env) ? origin : allowedOrigins(env)[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}
function httpError(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  return e;
}
function str(v) {
  return v == null ? "" : String(v).trim();
}
function truthy(v) {
  return v === true || v === "true" || v === "yes" || v === "on" || v === "1";
}
function label(key) {
  return key.replace(/_/g, " ");
}
