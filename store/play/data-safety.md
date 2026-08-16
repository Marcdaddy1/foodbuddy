# Google Play — Data Safety Form Answers

Answer the Console form exactly as below. **The form is a legal declaration.**
Play cross-checks it against observed app behaviour; a mismatch is one of the
most common causes of suspension, and it is the kind of mistake that gets found
after launch rather than before.

Re-check this file whenever data handling changes — especially at Phase 3 (AI
explanations) and Phase 4 (shared lists, push notifications).

---

## Key definitions (Play's, not the plain-English ones)

- **Collected** — data leaves the device to a server you control or use.
- **Shared** — data is transferred to a *third party*. Transfers to processors
  acting on your instructions (Supabase, Sentry, PostHog) are **not** "sharing"
  under Play's definition. FoodBuddy shares nothing.
- **Processed ephemerally** — used in memory and discarded, never stored.

---

## Data collection summary

| Data type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|
| **Email address** | Yes | No | Required for an account (app is usable signed-out) | Account management, authentication |
| **Health info** (allergies, intolerances, dietary restrictions) | Yes | No | Optional — profile is skippable | App functionality (personal verdicts) |
| **App interactions** (scan history, list activity) | Yes | No | Only when signed in | App functionality, cross-device sync |
| **Crash logs** | Yes | No | Optional (consent-gated) | Crash prevention, diagnostics |
| **Diagnostics / performance** | Yes | No | Optional (consent-gated) | Crash prevention, diagnostics |
| **Other user-generated content** (list items, product notes) | Yes | No | Only when signed in | App functionality |

**Not collected:** name, address, phone, precise or approximate location,
photos, videos, audio, contacts, calendar, financial info, payment info,
purchase history, browsing history, installed apps, device IDs for advertising,
SMS, files.

**Camera:** used on-device for barcode detection only. Frames are never stored,
never uploaded, and never leave the device — declare as **not collected**.

---

## Per-item answers

### Email address
- Collected: **Yes** · Shared: **No** · Processed ephemerally: No
- Required or optional: **Optional** (anonymous browsing works without an account)
- Purposes: **Account management**
- Encrypted in transit: **Yes** · Deletable by user: **Yes**

### Health info
- Collected: **Yes** · Shared: **No**
- Required or optional: **Optional**
- Purposes: **App functionality** only — *not* analytics, *not* personalisation,
  *not* advertising. Selecting analytics here would contradict the app's actual
  behaviour, which strips dietary data from every telemetry payload.
- Encrypted in transit: **Yes** · Deletable by user: **Yes**

### App interactions
- Collected: **Yes** · Shared: **No** · Purposes: **App functionality, Analytics**
- Encrypted in transit: **Yes** · Deletable by user: **Yes**

### Crash logs / Diagnostics
- Collected: **Yes** · Shared: **No** · Purposes: **Crash prevention, Diagnostics**
- Encrypted in transit: **Yes** · Deletable by user: **Yes**
- Note: gated behind the in-app consent banner; nothing is sent before opt-in.

### Other user-generated content
- Collected: **Yes** · Shared: **No** · Purposes: **App functionality**
- Encrypted in transit: **Yes** · Deletable by user: **Yes**

---

## Security practices section

| Question | Answer |
|---|---|
| Data encrypted in transit? | **Yes** — TLS to Supabase and all processors |
| Users can request data deletion? | **Yes** — in-app plus a web deletion URL |
| Committed to Play Families Policy? | Not applicable (not child-directed) |
| Independent security review? | **No** |

---

## Account deletion (mandatory — enforced since 15 April 2024)

Because the app lets users create an account, Play requires **both**:

1. **In-app deletion** — a path inside the app that deletes the account and all
   associated data. Deactivating, disabling, or freezing does not qualify.
2. **A public web URL** where deletion can be requested *without* installing the
   app. This URL is entered in the Data Safety form.

```
Delete account URL: {{deletion_url}}
```

> ⛔ **Neither exists yet.** This is a hard submission blocker, not a
> nice-to-have — see the launch checklist. Supabase has no client-side user
> deletion API, so the in-app path needs an Edge Function using the service-role
> key to call `auth.admin.deleteUser`, with the database cascade removing
> `profiles` → `dietary_profiles`, scan history, lists, and favourites.

---

## Processors (for your GDPR records, not the Play form)

| Processor | Data | Region | Role |
|---|---|---|---|
| Supabase | Account, dietary profile, history, lists | EU (`eu-central-1`) | Primary datastore |
| Sentry | Crash reports, diagnostics | Per account config | Crash reporting |
| PostHog | Product analytics (consent-gated) | EU cloud | Analytics |
| Open Food Facts | Barcode lookups only — no user identifiers | EU | Product data source |
| OpenAI *(from Phase 3)* | Ingredient names only — never user data | US | Ingredient explanations |

Dietary and allergy data must never reach Sentry, PostHog, or OpenAI. The
telemetry layer scrubs it before capture; that scrub is a release gate.
