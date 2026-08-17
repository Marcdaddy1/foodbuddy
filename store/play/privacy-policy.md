# FoodBuddy Privacy Policy

**Draft — fill the `{{placeholders}}` and have it reviewed before publishing.**
This is a legal document that Play, the UK ICO, and EU regulators can hold you
to. It is written to match what the app actually does today; re-check it at
Phase 3 (AI explanations) and Phase 4 (shared lists, push).

Publish it at a stable public URL — it must be reachable **without installing
the app** and without logging in. Options: a page on `aegeanpulse.com`, or
GitHub Pages from this repo.

---

**Last updated:** {{last_updated_date}}
**Effective:** {{effective_date}}

## Who we are

FoodBuddy ("the app") is provided by {{legal_entity_name}}, {{registered_address}}.
For UK GDPR and EU GDPR purposes we are the **data controller** for the personal
data described below.

Questions, requests, or complaints: **{{support_email}}**

## The short version

- We collect the minimum needed to make the app work.
- Your allergies and dietary restrictions are health-related data. We treat them
  as sensitive: never sold, never shared with advertisers, never sent to our
  analytics.
- Analytics only run if you say yes.
- You can use the app without an account.
- You can delete everything, at any time, from inside the app.

## What we collect, and why

### If you create an account
- **Email address** — to authenticate you and sync your data across devices.
  Legal basis: performance of a contract.
- If you sign in with Google, Google confirms your identity to us and shares
  your email address. We never receive your Google password.

### If you set up a dietary profile (optional)
- **Allergies and severity, intolerances, diet patterns, and your custom
  avoid-list.** This is health-related data (UK/EU GDPR Article 9 "special
  category" data). We process it **only** to produce your personal verdicts, and
  only with your **explicit consent**, which you give when you create the
  profile and can withdraw at any time by deleting the profile.
- It is stored under row-level security so it is accessible only to your
  account, and it is excluded from all analytics and crash reporting.

### When you use the app
- **Scan history** — the barcodes you scan, with the verdict and score at the
  time. Stored against your account only when signed in. Legal basis: contract.
- **Lists, favourites, and notes** you create. Legal basis: contract.

### Diagnostics and analytics (only with your consent)
- **Crash reports and performance diagnostics** (via Sentry) to find and fix
  faults.
- **Product analytics** (via PostHog) — which screens are used and whether scans
  succeed, so we can improve the app. Legal basis: consent. You are asked on
  first use and can change your answer in Settings. Your dietary data is never
  included.

### Your camera
Barcode scanning happens **entirely on your device**. Camera frames are never
stored, never uploaded, and never leave your phone. We do not receive images.

## What we do NOT collect

Your name, address, phone number, location, photos, contacts, payment details,
advertising identifiers, or browsing history outside the app.

## Who we share it with

**We do not sell your personal data. We do not share it with advertisers. We do
not use it to build advertising profiles.**

We use these service providers, who process data strictly on our instructions:

| Provider | What they handle | Where |
|---|---|---|
| Supabase | Account, dietary profile, history, lists | European Union |
| Sentry | Crash and performance diagnostics | {{sentry_region}} |
| PostHog | Product analytics, only if you consent | European Union |
| Open Food Facts | Receives the barcode you scanned, with no information about you | European Union |
| OpenAI *(planned)* | Receives ingredient names only, never anything about you | United States |

Where data is transferred outside the UK/EEA, we rely on Standard Contractual
Clauses or an equivalent safeguard.

We may also disclose data if legally required, or to protect the rights and
safety of our users.

## How long we keep it

- Account data: for as long as your account exists.
- On deletion: your account and its personal data are removed within **30 days**,
  except where we must retain something by law.
- Anonymous, aggregated product data (which barcodes are popular) is retained
  indefinitely; it cannot identify you.
- Product and ingredient information in our catalogue is not personal data.

## Deleting your account and data

You can delete your account and all associated personal data:

- **In the app:** Profile → Account → Delete account.
- **On the web:** https://marcdaddy1.github.io/foodbuddy/delete-account/

Deletion is permanent and removes your profile, dietary data, scan history,
lists, favourites, and notes. It is not a deactivation.

## Your rights

Under UK and EU data protection law you can ask us to: access your data; correct
it; delete it; restrict or object to how we use it; provide it in a portable
format (the app has an export function); and withdraw consent at any time.

Contact **{{support_email}}**. We respond within one month.

If you are unhappy with our response, you can complain to the UK Information
Commissioner's Office (ico.org.uk) or your local EU supervisory authority.

## Children

FoodBuddy is not directed at children under 13 and we do not knowingly collect
their data. If you believe a child has given us personal data, contact us and we
will delete it.

## Security

Data is encrypted in transit (TLS) and at rest. Database access is enforced
per-user with row-level security. API keys for third-party services are held
server-side and never shipped in the app.

No system is perfectly secure, but we will notify you and the relevant regulator
of any breach affecting your rights, within the timeframes the law requires.

## Important note about the information in the app

FoodBuddy gives general information about packaged food. **It is not medical
advice and it is not a medical device.** Product and allergen information comes
from the Open Food Facts community database and from manufacturers, and it may
be incomplete, out of date, or wrong. **If you have a food allergy, always read
the physical label before eating a product.**

Product data is used under the Open Database Licence (ODbL).

## Changes

If we make material changes we will update the date above and notify you in the
app before the changes take effect.
