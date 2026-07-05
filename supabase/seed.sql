-- FoodBuddy — dev seed data
-- Runs automatically on `supabase start` / `supabase db reset`.
-- Small, realistic catalog sample: 5 real products (real EAN barcodes from
-- Open Food Facts), a handful of ingredients, and the min-version config row.
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- app_config
-- ---------------------------------------------------------------------------

insert into public.app_config (key, value)
values (
  'min_app_version',
  '{"ios": "0.1.0", "android": "0.1.0", "message": "Please update FoodBuddy to keep scanning."}'::jsonb
)
on conflict (key) do update set value = excluded.value;

-- ---------------------------------------------------------------------------
-- products (real barcodes, data simplified from Open Food Facts)
-- ---------------------------------------------------------------------------

insert into public.products
  (barcode, name, brand, categories, ingredients_raw, nutriments, nova_group, allergen_tags, off_last_fetched_at, data_source)
values
  (
    '3017620422003',
    'Nutella',
    'Ferrero',
    array['spreads', 'sweet-spreads', 'hazelnut-spreads'],
    'Sugar, palm oil, hazelnuts 13%, skimmed milk powder 8.7%, fat-reduced cocoa 7.4%, emulsifier: lecithin (soya), vanillin.',
    '{"energy-kcal_100g": 539, "fat_100g": 30.9, "saturated-fat_100g": 10.6, "carbohydrates_100g": 57.5, "sugars_100g": 56.3, "proteins_100g": 6.3, "salt_100g": 0.107}'::jsonb,
    4,
    array['en:milk', 'en:nuts', 'en:soybeans'],
    now(),
    'openfoodfacts'
  ),
  (
    '5449000000996',
    'Coca-Cola',
    'Coca-Cola',
    array['beverages', 'carbonated-drinks', 'sodas'],
    'Carbonated water, sugar, colour: caramel E150d, acid: phosphoric acid, natural flavourings including caffeine.',
    '{"energy-kcal_100g": 42, "fat_100g": 0, "carbohydrates_100g": 10.6, "sugars_100g": 10.6, "proteins_100g": 0, "salt_100g": 0}'::jsonb,
    4,
    array[]::text[],
    now(),
    'openfoodfacts'
  ),
  (
    '5000157024671',
    'Tomato Ketchup',
    'Heinz',
    array['condiments', 'sauces', 'ketchup'],
    'Tomatoes (148g per 100g Tomato Ketchup), spirit vinegar, sugar, salt, spice and herb extracts (contain celery), spice.',
    '{"energy-kcal_100g": 102, "fat_100g": 0.1, "carbohydrates_100g": 23.2, "sugars_100g": 22.8, "proteins_100g": 1.2, "salt_100g": 1.8}'::jsonb,
    3,
    array['en:celery'],
    now(),
    'openfoodfacts'
  ),
  (
    '8076800105057',
    'Spaghetti n.5',
    'Barilla',
    array['pastas', 'durum-wheat-pasta', 'spaghetti'],
    'Durum wheat semolina, water. May contain traces of soy.',
    '{"energy-kcal_100g": 359, "fat_100g": 2, "saturated-fat_100g": 0.5, "carbohydrates_100g": 70.9, "sugars_100g": 3.5, "proteins_100g": 12.5, "salt_100g": 0.013}'::jsonb,
    1,
    array['en:gluten'],
    now(),
    'openfoodfacts'
  ),
  (
    '7622210449283',
    'Oreo Original',
    'Mondelez',
    array['snacks', 'biscuits', 'sandwich-biscuits'],
    'Wheat flour, sugar, palm oil, rapeseed oil, fat-reduced cocoa powder 4.6%, wheat starch, glucose-fructose syrup, raising agents, salt, emulsifiers (soya lecithin, sunflower lecithin), flavouring (vanillin). May contain milk.',
    '{"energy-kcal_100g": 480, "fat_100g": 20, "saturated-fat_100g": 6.1, "carbohydrates_100g": 69, "sugars_100g": 38, "proteins_100g": 5, "salt_100g": 0.9}'::jsonb,
    4,
    array['en:gluten', 'en:soybeans'],
    now(),
    'openfoodfacts'
  )
on conflict (barcode) do nothing;

-- ---------------------------------------------------------------------------
-- ingredients
-- ---------------------------------------------------------------------------

insert into public.ingredients (off_taxonomy_id, name, risk_class, parent_allergens)
values
  ('en:hazelnut',            'Hazelnut',            'allergen',                array['en:nuts']),
  ('en:skimmed-milk-powder', 'Skimmed milk powder', 'allergen',                array['en:milk']),
  ('en:soya-lecithin',       'Soya lecithin',       'allergen',                array['en:soybeans']),
  ('en:durum-wheat-semolina','Durum wheat semolina','allergen',                array['en:gluten']),
  ('en:palm-oil',            'Palm oil',            'controversial',           array[]::text[]),
  ('en:e150d',               'Caramel colour E150d','additive',                array[]::text[]),
  ('en:sugar',               'Sugar',               'benign',                  array[]::text[])
on conflict (off_taxonomy_id) do nothing;

-- ---------------------------------------------------------------------------
-- ingredient_explanations — one cached example so the UI has data in dev
-- ---------------------------------------------------------------------------

insert into public.ingredient_explanations (ingredient_id, locale, prompt_version, model, explanation)
select
  i.id,
  'en',
  'v1',
  'dev-seed',
  '{"summary": "Soya lecithin is an emulsifier made from soybeans that keeps fats and water mixed.", "risk_note": "It is a soy-derived ingredient: people with a soy allergy should check with their clinician, though most tolerate highly refined lecithin.", "sources": ["seed-data"]}'::jsonb
from public.ingredients i
where i.off_taxonomy_id = 'en:soya-lecithin'
on conflict (ingredient_id, locale, prompt_version) do nothing;
