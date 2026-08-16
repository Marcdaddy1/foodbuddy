# FoodBuddy — Google Play Release Runbook

Everything needed to get a signed `.aab` into Play, in the order it has to
happen. Windows PowerShell commands.

---

## 1. Create the upload keystore (you must do this — it holds your passwords)

The keystore is your signing identity. **Never commit it. Never paste its
password into a chat, an issue, or a config file that is tracked by git.**
`.gitignore` already blocks `*.jks`, `*.keystore`, and `keystore.properties`.

`keytool` ships with the JDK, which is not installed on this machine yet:

```powershell
winget install EclipseAdoptium.Temurin.21.JDK
```

Open a **new** terminal so `PATH` picks it up, then generate the key:

```powershell
keytool -genkeypair -v -keystore foodbuddy-upload.jks -keyalg RSA -keysize 4096 -validity 10000 -alias foodbuddy-upload
```

It prompts for a password and your details. Store the file **outside the repo**
(e.g. `C:\Users\AegeanPulse\Keys\`) and put the password in your password
manager immediately.

### Why losing it is survivable (but still avoid it)

New apps enrol in **Play App Signing** by default: Google holds the real *app
signing key*, you hold an *upload key*. If you lose the upload key, Google can
reset it — you are not locked out of your own listing, which used to be the
nightmare scenario. Keep a backup regardless; a reset takes days.

---

## 2. Add the GitHub secrets

Encode the keystore for CI:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\AegeanPulse\Keys\foodbuddy-upload.jks")) | Set-Clipboard
```

At `https://github.com/Marcdaddy1/foodbuddy/settings/secrets/actions`, add:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the clipboard contents from above |
| `ANDROID_KEYSTORE_PASSWORD` | your keystore password |
| `ANDROID_KEY_ALIAS` | `foodbuddy-upload` |
| `ANDROID_KEY_PASSWORD` | your key password |
| `VITE_SUPABASE_URL` | `https://uytsmrunqexuqtvwztlz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_U01-2O1z329xhWgrSDxWig_uAfyNpsm` |
| `VITE_SENTRY_DSN` | optional, once Sentry exists |
| `VITE_POSTHOG_KEY` | optional, once PostHog exists |

The Supabase publishable key is designed to be public (it ships inside the app
either way and is protected by row-level security) — it lives in secrets only to
keep build config in one place.

---

## 3. Build the signed bundle

GitHub → Actions → **Android Release AAB** → *Run workflow* → enter the version
name (e.g. `1.0.0`).

The workflow refuses to build if typecheck, lint, or tests fail, signs the
bundle, shreds the key material, and uploads `app-release.aab` as an artifact.
`versionCode` comes from the run number, so it always increases — Play rejects a
reused `versionCode`, and that is the single most common first-upload error.

---

## 4. Capture screenshots (Play requires at least 2)

Play wants real screenshots of the real app, and these have to come off a
device — the browser preview cannot produce them.

1. Install the debug APK from the **Android Debug APK** workflow.
2. Set up a dietary profile with a milk allergy so the verdict screen shows a
   real triggered rule.
3. Capture (power + volume-down), in this order — Play shows the first two in
   search results, so lead with the payoff, not the splash screen:

   | # | Screen | Why |
   |---|---|---|
   | 1 | Product verdict, showing an **Avoid** with the triggering rule | The whole product in one image |
   | 2 | Product verdict scrolled to score breakdown + ingredients | Proves the depth |
   | 3 | Scanner with the viewfinder | Shows the core action |
   | 4 | Dietary profile with allergies set | Shows personalisation |
   | 5 | History or Lists | Shows retention value |

4. Pull them off the phone into `store/play/screenshots/`.

Requirements: PNG or JPEG, 2–8 images, each 320–3840px on its longest edge,
9:16 portrait. A standard phone screenshot already complies. Do not add
marketing text overlays claiming health benefits.

---

## 5. Play Console setup

Order matters — the listing cannot be submitted until the app content
declarations are complete.

1. **Create the app** — name, default language (English UK), app (not game),
   free.
2. **Store listing** — paste from `store-listing.md`; upload the icon, feature
   graphic, and screenshots.
3. **App content** — privacy policy URL, ads declaration (no ads), app access
   (see below), content rating questionnaire, target audience (18+), data
   safety (paste from `data-safety.md`), government apps (no), financial
   features (none), health apps declaration.
4. **App access** — the reviewer needs a working account. Provide a demo login
   *or* state that all functionality is reachable without signing in. Include
   the note below.
5. **Release** → Testing → Closed testing → upload the `.aab`.

### Reviewer notes (paste into "App access" / review instructions)

```
FoodBuddy scans packaged-food barcodes and returns a health score plus a
personal dietary verdict.

Full functionality is available WITHOUT an account. Sign-in only enables
cross-device sync of history and lists.

To test scanning without physical products: open the Scan tab and use the
manual barcode entry field. Example barcodes that return results:
  3017620422003  (Nutella)
  5000159407236  (Mars bar)
  5449000000996  (Coca-Cola)

To see a personal allergen verdict: Profile > add a "Milk" allergy, then scan
3017620422003. The verdict changes to "Avoid" and names the triggering rule.

Health positioning: FoodBuddy is a general-wellness informational tool. It does
not diagnose, treat, or prevent disease and makes no medical claims. A
persistent disclaimer on every result screen states that the app is not medical
advice and that users with allergies must check the physical product label.

Product data is supplied by the Open Food Facts community database under ODbL,
attributed on every product screen.
```

---

## 6. Closed testing, then production

If your Play account is a **personal** account created after 13 Nov 2023, you
must run closed testing with **12 testers opted in continuously for 14 days**
before you can apply for production access. Since April 2026 Google also checks
that testing was *real* — that testers used the app and that you shipped
improvements during the window. Uploading once and waiting 14 days gets
rejected.

**Organization accounts registered with a D-U-N-S number are exempt from this
entirely.** Given AegeanPulse is a business, this is worth checking before you
register — see the launch checklist.

Production rollout: staged, 10% → 50% → 100%, watching Sentry crash-free rate
between steps.

---

## 7. Blocked items before you can submit

| Blocker | Why | Status |
|---|---|---|
| In-app account deletion | Play User Data policy, enforced since Apr 2024 | ⛔ Not built |
| Web account-deletion URL | Required field in the Data Safety form | ⛔ Not built |
| Hosted privacy policy URL | Required whenever personal data is collected | ⛔ Not hosted |
| Real device screenshots | Listing requires 2–8 | ⛔ Not captured |
| Play Console account | $25 one-time, plus identity verification | ⛔ Not created |
| Phase 2 (dietary profile persistence) | The app's core promise; profile is local-only today | ⛔ In progress |

Target API level is already satisfied: the app targets **API 36**, ahead of the
31 August 2026 deadline for new submissions.
