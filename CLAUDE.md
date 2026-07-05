# CLAUDE.md — FoodBuddy

## What this is

Capacitor 8 + React 19 + Vite 8 + TypeScript app. Scans packaged food, computes a
deterministic health score and a personal Safe / Caution / Avoid verdict from the
user's allergy/dietary profile. AI explains results; it never computes them.

## Plan docs (read before feature work)

Phase plan and PRD live in `../FoodInsight Mobile App/FoodInsight Mobile Development/`:

- `FoodBuddy-PRD-v2.md` — product requirements
- `FoodBuddy-Implementation-Plan-v2.md` — phased build plan
- `FoodBuddy-Modernization-Report.md` — stack decisions

## Stack + commands

React 19, TanStack Router/Query, Zustand, Zod, Tailwind 4, Supabase, Sentry, PostHog (EU).

```
npm run dev         # Vite dev server
npm run typecheck   # tsc -b
npm run lint        # oxlint (.oxlintrc.json)
npm run test        # vitest run
npm run build       # tsc -b && vite build
npx cap sync        # copy dist/ into android/ + ios/
```

Android needs JDK 21 + Android Studio (not installed on this dev machine — use the
`Android Debug APK` GitHub workflow). iOS needs macOS/Xcode.

## Hard rules

1. **Scoring is deterministic TypeScript.** Health score and Safe/Caution/Avoid
   verdict logic must be pure, testable TS functions. AI (LLM) output must never
   feed into, override, or compute a score or verdict — explanation text only.
2. **Allergen logic fails conservative.** Unknown/unparseable ingredient + a
   declared allergy → **Caution**, never Safe. When in doubt, downgrade the verdict.
3. **Dietary/allergy data is sensitive.** Never write it to logs, Sentry events,
   PostHog payloads, or any analytics/telemetry. Scrub before capture.
4. **Allergen test matrix is a release gate.** Verdict/allergen changes must keep
   the allergen matrix tests passing; no release ships with it red or skipped.
5. **No AI provider keys in the client.** VITE_* env is public; OpenAI etc. keys
   live only in Supabase Edge Function secrets.
