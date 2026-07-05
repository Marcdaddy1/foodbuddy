# FoodBuddy

FoodBuddy is a mobile app that scans packaged food (barcode → Open Food Facts + label data) and turns it into a deterministic health score plus a personal **Safe / Caution / Avoid** verdict based on your allergies and dietary profile. All scoring and verdict logic is deterministic TypeScript running on-device — AI is only used to *explain* results in plain language, never to compute them.

> **Disclaimer:** FoodBuddy is informational only and is **not medical advice**. Scores and verdicts can be wrong or based on incomplete product data. If you have an allergy or medical dietary requirement, **always check the physical product label** before eating.

## Stack

| Layer | Tech |
|---|---|
| UI | React 19, TanStack Router, Tailwind CSS 4 |
| State/data | Zustand, TanStack Query, Zod |
| Native shell | Capacitor 8 (Android + iOS) |
| Backend | Supabase (Postgres, Auth, Edge Functions) |
| Build | Vite 8, TypeScript |
| Lint/test | oxlint, Vitest + Testing Library |
| Observability | Sentry, PostHog (EU) |

## Quickstart

```powershell
npm install
Copy-Item .env.example .env   # then fill in the values
npm run dev
```

## Native workflow

```powershell
npm run build
npx cap sync
```

- **Android:** `npx cap open android` — requires JDK 21 + Android Studio. **Not currently installed on this dev machine**; use the `Android Debug APK` GitHub Actions workflow to get a debug build in the meantime.
- **iOS:** open `ios/App` in Xcode — requires macOS (or a cloud build service); cannot be built on Windows.

## Testing

```powershell
npm run typecheck   # tsc -b
npm run lint        # oxlint
npm run test        # vitest run
```

The allergen test matrix (allergen detection + verdict edge cases) is a release gate — it must pass before any release.

## Project docs

Product and phase-plan docs live outside this repo in `../FoodInsight Mobile App/FoodInsight Mobile Development/`:

- `FoodBuddy-PRD-v2.md`
- `FoodBuddy-Implementation-Plan-v2.md`
- `FoodBuddy-Modernization-Report.md`

## Data attribution

Product data comes from [Open Food Facts](https://world.openfoodfacts.org/), available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/). Any redistribution of that data must retain this attribution and comply with ODbL share-alike terms.
