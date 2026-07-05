-- FoodBuddy — 0001_initial_schema
-- Initial schema: user profiles, sensitive dietary profiles, product catalog,
-- scan history, favorites, shared lists, and app config.
-- Target: Postgres 15+ (Supabase). RLS is enabled in 0002_rls_policies.sql.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Row trigger: sets updated_at to now() on every UPDATE.';

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user (auto-created by trigger in 0002)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  display_name         text,
  onboarding_completed boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.profiles is
  'App-level user profile, 1:1 with auth.users. Deleted with the account (cascade).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- dietary_profiles — SENSITIVE health-adjacent data (GDPR special-category
-- adjacent). One row per user. Must never be sent to analytics; deleted with
-- the account via cascade. Client access is strictly owner-only (see 0002).
-- ---------------------------------------------------------------------------

create table public.dietary_profiles (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  -- jsonb array of objects: [{"allergen": "peanut", "severity": "anaphylaxis"}, ...]
  allergies         jsonb not null default '[]'::jsonb,
  intolerances      text[] not null default '{}',
  diet_patterns     text[] not null default '{}',
  custom_avoid_list text[] not null default '{}',
  -- explicit consent timestamp required before storing/processing this data
  consent_given_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint dietary_profiles_allergies_is_array
    check (jsonb_typeof(allergies) = 'array')
);

comment on table public.dietary_profiles is
  'SENSITIVE: health-adjacent dietary data (allergies, intolerances, diet patterns). GDPR-sensitive — exclude from analytics/telemetry, owner-only access via RLS, deleted with account (cascade from auth.users -> profiles).';
comment on column public.dietary_profiles.allergies is
  'SENSITIVE: jsonb array of {allergen text, severity text} objects. Health-adjacent data — never log, never export to analytics.';
comment on column public.dietary_profiles.intolerances is
  'SENSITIVE: food intolerances (e.g. lactose, gluten). Health-adjacent data.';
comment on column public.dietary_profiles.diet_patterns is
  'Dietary patterns (e.g. vegan, halal, keto). Treated as sensitive alongside the rest of this table.';
comment on column public.dietary_profiles.custom_avoid_list is
  'User-defined ingredients/terms to avoid. Treated as sensitive.';
comment on column public.dietary_profiles.consent_given_at is
  'When the user gave explicit consent to store and process dietary data. NULL = no consent recorded; the app must not populate the other columns without it.';

create trigger dietary_profiles_set_updated_at
  before update on public.dietary_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- products — catalog (read-public, writes via service role / ingestion only)
-- ---------------------------------------------------------------------------

create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  barcode             text not null,
  name                text,
  brand               text,
  categories          text[] not null default '{}',
  ingredients_raw     text,
  nutriments          jsonb not null default '{}'::jsonb,
  nova_group          smallint check (nova_group between 1 and 4),
  allergen_tags       text[] not null default '{}',
  off_last_fetched_at timestamptz,
  data_source         text not null default 'openfoodfacts',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint products_barcode_unique unique (barcode)
);

comment on table public.products is
  'Product catalog cached from Open Food Facts (and future sources). Read-public; written only by service-role ingestion jobs.';
comment on column public.products.barcode is
  'EAN/UPC barcode. Unique — the products_barcode_unique constraint provides the unique index used for scan lookups.';
comment on column public.products.nutriments is
  'Raw nutriments object as returned by Open Food Facts (per 100g keys etc.).';
comment on column public.products.allergen_tags is
  'Normalised allergen tags, OFF taxonomy style (e.g. en:milk, en:nuts).';

-- Fuzzy product-name search
create index products_name_trgm_idx
  on public.products
  using gin (name extensions.gin_trgm_ops);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ingredients — catalog of known ingredients (read-public)
-- ---------------------------------------------------------------------------

create table public.ingredients (
  id               uuid primary key default gen_random_uuid(),
  off_taxonomy_id  text unique,
  name             text not null,
  risk_class       text,
  parent_allergens text[] not null default '{}',
  created_at       timestamptz not null default now()
);

comment on table public.ingredients is
  'Ingredient taxonomy (seeded from Open Food Facts). Read-public; written only by service role.';
comment on column public.ingredients.off_taxonomy_id is
  'Open Food Facts taxonomy id (e.g. en:soya-lecithin).';
comment on column public.ingredients.risk_class is
  'Coarse risk classification for verdict rules (e.g. allergen, additive, ultra-processed-marker, benign).';
comment on column public.ingredients.parent_allergens is
  'Allergen groups this ingredient maps to (e.g. {en:nuts} for hazelnut).';

-- ---------------------------------------------------------------------------
-- ingredient_explanations — cached LLM explanations per locale/prompt version
-- ---------------------------------------------------------------------------

create table public.ingredient_explanations (
  id             uuid primary key default gen_random_uuid(),
  ingredient_id  uuid not null references public.ingredients (id) on delete cascade,
  locale         text not null default 'en',
  prompt_version text not null,
  model          text,
  explanation    jsonb not null,
  created_at     timestamptz not null default now(),
  constraint ingredient_explanations_unique
    unique (ingredient_id, locale, prompt_version)
);

comment on table public.ingredient_explanations is
  'Cached AI-generated ingredient explanations, keyed by ingredient + locale + prompt version. Read-public; written only by service role (edge function).';

-- ---------------------------------------------------------------------------
-- scan_history — user-owned scan log
-- ---------------------------------------------------------------------------

create table public.scan_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  barcode      text not null,
  scanned_at   timestamptz not null default now(),
  verdict      text,
  score        smallint check (score between 0 and 100),
  rule_version text
);

comment on table public.scan_history is
  'User scan log. Verdicts are derived from dietary_profiles, so treat as sensitive-adjacent: owner-only via RLS, deleted with account (cascade).';
comment on column public.scan_history.verdict is
  'Personal verdict at scan time (e.g. safe / caution / avoid). Derived from the user''s sensitive dietary profile — do not expose or aggregate.';
comment on column public.scan_history.rule_version is
  'Version of the verdict rule set used, so old verdicts can be re-explained or recomputed.';

create index scan_history_user_scanned_at_idx
  on public.scan_history (user_id, scanned_at desc);

-- ---------------------------------------------------------------------------
-- favorites — user-owned
-- ---------------------------------------------------------------------------

create table public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now(),
  constraint favorites_user_product_unique unique (user_id, product_id)
);

comment on table public.favorites is
  'User favourite products. Owner-only via RLS; deleted with account.';

-- ---------------------------------------------------------------------------
-- lists / list_items / list_members — shopping lists (shared lists = future)
-- ---------------------------------------------------------------------------

create table public.lists (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

comment on table public.lists is
  'Shopping lists. Owner has full access; members (list_members) get access for future shared lists.';

create index lists_owner_id_idx on public.lists (owner_id);

create table public.list_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  free_text  text,
  checked    boolean not null default false,
  position   double precision not null default 0,
  updated_at timestamptz not null default now(),
  constraint list_items_has_content
    check (product_id is not null or free_text is not null)
);

comment on table public.list_items is
  'Items on a list. Either a catalog product (product_id) or free text.';
comment on column public.list_items.updated_at is
  'Last-writer-wins (LWW) conflict field for offline sync — clients compare this timestamp when merging.';
comment on column public.list_items.position is
  'Fractional ordering key (insert between a and b as (a+b)/2).';

create index list_items_list_id_idx on public.list_items (list_id);

create trigger list_items_set_updated_at
  before update on public.list_items
  for each row execute function public.set_updated_at();

create table public.list_members (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'editor' check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  constraint list_members_unique unique (list_id, user_id)
);

comment on table public.list_members is
  'Membership for shared lists (future feature). viewer = read-only, editor = read/write items.';

create index list_members_user_id_idx on public.list_members (user_id);

-- ---------------------------------------------------------------------------
-- app_config — public read-only key/value store (e.g. forced-update check)
-- ---------------------------------------------------------------------------

create table public.app_config (
  key   text primary key,
  value jsonb not null
);

comment on table public.app_config is
  'Public, read-only app configuration (min app version for forced updates, feature flags). Written only by service role.';

-- Default row so the forced-update check always has something to read.
insert into public.app_config (key, value)
values (
  'min_app_version',
  '{"ios": "0.1.0", "android": "0.1.0", "message": "Please update FoodBuddy to keep scanning."}'::jsonb
)
on conflict (key) do nothing;
