# FoodBuddy — Supabase Setup (Windows / PowerShell)

Everything below is copy-paste-ready PowerShell, run from the repo root:
`C:\Users\AegeanPulse\Desktop\Claude Code Projects\projects\foodbuddy`

The repo already contains the full Supabase layout — do **not** run `supabase init`:

```
supabase/
  config.toml                        # local config (project_id "foodbuddy")
  migrations/0001_initial_schema.sql # tables, indexes, triggers
  migrations/0002_rls_policies.sql   # RLS + profile auto-provisioning
  seed.sql                           # 5 dev products, ingredients, app_config
```

## 1. Install the Supabase CLI

Option A — Scoop (recommended, gives you a plain `supabase` command):

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

Option B — no install, via npx (prefix every command below with `npx`):

```powershell
npx supabase --version
```

## 2. Run locally (needs Docker Desktop running)

```powershell
supabase start
```

First run downloads containers (a few minutes). It applies both migrations and
`seed.sql` automatically, then prints your local credentials:

- **API URL** → `http://127.0.0.1:54321`
- **anon key** → printed in the output (also via `supabase status`)
- **Studio** → `http://127.0.0.1:54323` (browse tables, run SQL)

Useful commands:

```powershell
supabase status     # re-print URLs and keys
supabase db reset   # drop + re-run all migrations + seed (local only)
supabase stop       # shut down containers
```

## 3. Cloud project (when ready)

Create a project at https://supabase.com/dashboard (region: `eu-west-2` London — dietary data is GDPR-sensitive, keep it in the EU/UK), then:

```powershell
supabase login
supabase link --project-ref <your-project-ref>   # ref is in the dashboard URL
supabase db push                                  # applies migrations/*.sql to the cloud DB
```

`supabase db push` does **not** run `seed.sql` — the seed is dev-only by design.
If you want the 5 sample products in the cloud, paste `supabase/seed.sql` into
the dashboard SQL Editor once.

## 4. Auth providers

### Email (works out of the box)

Enabled locally in `config.toml` and by default in the cloud.
Cloud: **Authentication → Providers → Email** — leave enabled; for production
turn ON "Confirm email". Locally, confirmation emails land in Inbucket at
`http://127.0.0.1:54324`.

### Google

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** (type: Web application).
2. Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Supabase dashboard → **Authentication → Providers → Google** → enable, paste Client ID + Secret, save.
4. For the Capacitor app you'll later add an Android/iOS OAuth client in Google Console too, but the web client is enough to get sign-in working.

### Apple (required by App Store if you offer Google sign-in)

1. Apple Developer → Certificates, Identifiers & Profiles → create a **Services ID** (this is the client ID) with "Sign in with Apple" enabled.
2. Set the return URL to `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Create a **Sign in with Apple key** (.p8), note Key ID + Team ID, and generate the client secret JWT (the dashboard links Apple's instructions; the secret expires every 6 months — calendar it).
4. Supabase dashboard → **Authentication → Providers → Apple** → enable, paste Services ID + secret.

### Redirect URLs (cloud)

**Authentication → URL Configuration**: set Site URL to your production URL and
add these to Redirect URLs (already in `config.toml` for local):

```
http://localhost:5173
capacitor://localhost
http://localhost
```

`capacitor://localhost` covers the iOS WebView, `http://localhost` covers Android.

## 5. Where to get URL + anon key, and fill .env

- **Local**: `supabase status` → API URL + anon key.
- **Cloud**: dashboard → **Settings → API** → Project URL + `anon` `public` key.

Create `.env` in the repo root (already gitignored — never commit it):

```powershell
@'
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<paste-anon-key-here>
'@ | Out-File -FilePath .env -Encoding utf8
```

Swap in the cloud URL/key for production builds. The anon key is safe to ship
in the app (RLS enforces access); the `service_role` key is **server-only** —
never put it in `.env` or the client bundle.

## 6. Regenerate TypeScript types

`src/lib/database.types.ts` is a hand-written placeholder. Once the local stack
is running:

```powershell
npx supabase gen types typescript --local | Out-File -FilePath src\lib\database.types.ts -Encoding utf8
```

(Or `--linked` after `supabase link` to generate from the cloud project.)

## 7. GDPR note — dietary data

`dietary_profiles` (allergies, intolerances, diet patterns, avoid lists) is
health-adjacent personal data:

- **Excluded from analytics/telemetry** — never send its contents to any analytics tool, crash reporter, or log line. Scan verdicts are derived from it, so treat `scan_history.verdict`/`score` the same way.
- **Deleted with the account** — deleting the `auth.users` row cascades through `profiles` → `dietary_profiles`, plus `scan_history`, `favorites`, `lists`, and `list_members`. Account deletion is the complete erasure path; no manual cleanup needed.
- **Consent first** — the app must set `consent_given_at` before writing any dietary data.
- RLS locks the table to its owner; catalog tables are the only publicly readable ones.
