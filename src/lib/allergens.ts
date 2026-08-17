/**
 * Canonical allergen resolution — the single place where any allergen-ish
 * string becomes one of the 14 EU-designated allergen groups.
 *
 * WHY THIS EXISTS
 * Open Food Facts tags are contributed worldwide and arrive in whatever locale
 * and spelling the contributor used: `en:milk`, `fr:lait`, `de:milch`,
 * `en:Milk`, `en:milks`, `en:dairy`, `en:cows-milk`. Comparing those to the
 * user's stored `en:milk` with string equality means a French product declaring
 * `fr:lait` reads "Safe for you" to someone with a severe milk allergy.
 *
 * Everything that compares allergens MUST go through `canonicalAllergen` or
 * `canonicalAllergenSet`. Never compare raw tags.
 *
 * Unknown tags resolve to `null` — the caller must treat an unresolved tag on a
 * product as *potentially* the user's allergen (conservative), never as absent.
 */

/** The 14 allergen groups the app reasons about, in OFF `en:` canonical form. */
export const CANONICAL_ALLERGENS = [
  'en:milk',
  'en:eggs',
  'en:peanuts',
  'en:nuts',
  'en:soybeans',
  'en:gluten',
  'en:fish',
  'en:crustaceans',
  'en:molluscs',
  'en:celery',
  'en:mustard',
  'en:sesame-seeds',
  'en:sulphur-dioxide-and-sulphites',
  'en:lupin',
] as const

export type CanonicalAllergen = (typeof CANONICAL_ALLERGENS)[number]

/**
 * Locale variants, plurals, synonyms, and sub-species that map onto a group.
 * Keys are locale-stripped and lowercased before lookup.
 *
 * Sub-species map UP to their group deliberately: someone allergic to tree nuts
 * must be warned about `almonds`, and OFF frequently tags the specific nut
 * rather than the group.
 */
const ALIASES: Readonly<Record<string, CanonicalAllergen>> = {
  // --- milk ---------------------------------------------------------------
  milk: 'en:milk', milks: 'en:milk', dairy: 'en:milk', 'milk-proteins': 'en:milk',
  'cows-milk': 'en:milk', 'cow-milk': 'en:milk', lactose: 'en:milk', casein: 'en:milk',
  caseinate: 'en:milk', whey: 'en:milk', butter: 'en:milk', cream: 'en:milk',
  cheese: 'en:milk', yoghurt: 'en:milk', yogurt: 'en:milk',
  lait: 'en:milk', 'proteines-de-lait': 'en:milk', milch: 'en:milk', leche: 'en:milk',
  latte: 'en:milk', melk: 'en:milk', mjolk: 'en:milk', mleko: 'en:milk', leite: 'en:milk',

  // --- eggs ---------------------------------------------------------------
  egg: 'en:eggs', eggs: 'en:eggs', albumen: 'en:eggs', albumin: 'en:eggs',
  ovalbumin: 'en:eggs', lysozyme: 'en:eggs',
  oeuf: 'en:eggs', oeufs: 'en:eggs', ei: 'en:eggs', eier: 'en:eggs',
  huevo: 'en:eggs', huevos: 'en:eggs', uovo: 'en:eggs', uova: 'en:eggs',
  ovo: 'en:eggs', agg: 'en:eggs',

  // --- peanuts ------------------------------------------------------------
  peanut: 'en:peanuts', peanuts: 'en:peanuts', groundnut: 'en:peanuts',
  groundnuts: 'en:peanuts', arachis: 'en:peanuts', 'arachis-oil': 'en:peanuts',
  'arachis-hypogaea': 'en:peanuts',
  arachide: 'en:peanuts', arachides: 'en:peanuts', cacahuete: 'en:peanuts',
  cacahuetes: 'en:peanuts', erdnuss: 'en:peanuts', erdnusse: 'en:peanuts',
  arachidi: 'en:peanuts', pinda: 'en:peanuts',

  // --- tree nuts ----------------------------------------------------------
  nut: 'en:nuts', nuts: 'en:nuts', 'tree-nuts': 'en:nuts', 'tree-nut': 'en:nuts',
  almond: 'en:nuts', almonds: 'en:nuts', hazelnut: 'en:nuts', hazelnuts: 'en:nuts',
  walnut: 'en:nuts', walnuts: 'en:nuts', cashew: 'en:nuts', cashews: 'en:nuts',
  'cashew-nuts': 'en:nuts', pecan: 'en:nuts', pecans: 'en:nuts',
  pistachio: 'en:nuts', pistachios: 'en:nuts', 'macadamia-nuts': 'en:nuts',
  macadamia: 'en:nuts', 'brazil-nuts': 'en:nuts', 'brazil-nut': 'en:nuts',
  'pine-nuts': 'en:nuts', pignoli: 'en:nuts', marzipan: 'en:nuts',
  praline: 'en:nuts', nougat: 'en:nuts', gianduja: 'en:nuts', frangipane: 'en:nuts',
  'fruits-a-coque': 'en:nuts', 'noix-de-cajou': 'en:nuts', noisette: 'en:nuts',
  noisettes: 'en:nuts', amande: 'en:nuts', amandes: 'en:nuts',
  nusse: 'en:nuts', haselnusse: 'en:nuts', mandeln: 'en:nuts',
  nueces: 'en:nuts', almendra: 'en:nuts', avellana: 'en:nuts',
  noci: 'en:nuts', nocciole: 'en:nuts', mandorle: 'en:nuts',

  // --- soy ----------------------------------------------------------------
  soy: 'en:soybeans', soya: 'en:soybeans', soybean: 'en:soybeans',
  soybeans: 'en:soybeans', 'soy-beans': 'en:soybeans', 'soya-beans': 'en:soybeans',
  'soja': 'en:soybeans', tofu: 'en:soybeans', miso: 'en:soybeans',
  tempeh: 'en:soybeans', tamari: 'en:soybeans', edamame: 'en:soybeans',
  'textured-vegetable-protein': 'en:soybeans',

  // --- gluten -------------------------------------------------------------
  gluten: 'en:gluten', wheat: 'en:gluten', barley: 'en:gluten', rye: 'en:gluten',
  oat: 'en:gluten', oats: 'en:gluten', spelt: 'en:gluten', kamut: 'en:gluten',
  durum: 'en:gluten', 'durum-wheat': 'en:gluten', semolina: 'en:gluten',
  triticale: 'en:gluten', farro: 'en:gluten', couscous: 'en:gluten',
  bulgur: 'en:gluten', seitan: 'en:gluten', einkorn: 'en:gluten',
  'graham-flour': 'en:gluten', 'matzo-meal': 'en:gluten',
  'cereals-containing-gluten': 'en:gluten',
  ble: 'en:gluten', 'ble-tendre': 'en:gluten', froment: 'en:gluten',
  weizen: 'en:gluten', gerste: 'en:gluten', roggen: 'en:gluten', dinkel: 'en:gluten',
  trigo: 'en:gluten', cebada: 'en:gluten', centeno: 'en:gluten',
  frumento: 'en:gluten', grano: 'en:gluten', orzo: 'en:gluten',
  tarwe: 'en:gluten', hvete: 'en:gluten',

  // --- fish ---------------------------------------------------------------
  fish: 'en:fish', anchovy: 'en:fish', anchovies: 'en:fish', cod: 'en:fish',
  salmon: 'en:fish', tuna: 'en:fish', surimi: 'en:fish', bonito: 'en:fish',
  caviar: 'en:fish', 'worcestershire-sauce': 'en:fish',
  poisson: 'en:fish', fisch: 'en:fish', pescado: 'en:fish', pesce: 'en:fish',
  vis: 'en:fish', peixe: 'en:fish',

  // --- crustaceans --------------------------------------------------------
  crustacean: 'en:crustaceans', crustaceans: 'en:crustaceans',
  shellfish: 'en:crustaceans', prawn: 'en:crustaceans', prawns: 'en:crustaceans',
  shrimp: 'en:crustaceans', shrimps: 'en:crustaceans', crab: 'en:crustaceans',
  lobster: 'en:crustaceans', krill: 'en:crustaceans', langoustine: 'en:crustaceans',
  scampi: 'en:crustaceans',
  crustaces: 'en:crustaceans', krebstiere: 'en:crustaceans',
  crustaceos: 'en:crustaceans', crostacei: 'en:crustaceans',

  // --- molluscs -----------------------------------------------------------
  mollusc: 'en:molluscs', molluscs: 'en:molluscs', mollusk: 'en:molluscs',
  mollusks: 'en:molluscs', squid: 'en:molluscs', cuttlefish: 'en:molluscs',
  octopus: 'en:molluscs', mussel: 'en:molluscs', mussels: 'en:molluscs',
  oyster: 'en:molluscs', oysters: 'en:molluscs', clam: 'en:molluscs',
  clams: 'en:molluscs', scallop: 'en:molluscs', scallops: 'en:molluscs',
  snail: 'en:molluscs', snails: 'en:molluscs', abalone: 'en:molluscs',
  mollusques: 'en:molluscs', weichtiere: 'en:molluscs', moluscos: 'en:molluscs',
  molluschi: 'en:molluscs',

  // --- celery -------------------------------------------------------------
  celery: 'en:celery', celeriac: 'en:celery',
  celeri: 'en:celery', sellerie: 'en:celery', apio: 'en:celery', sedano: 'en:celery',
  selderij: 'en:celery',

  // --- mustard ------------------------------------------------------------
  mustard: 'en:mustard',
  moutarde: 'en:mustard', senf: 'en:mustard', mostaza: 'en:mustard',
  senape: 'en:mustard', mosterd: 'en:mustard',

  // --- sesame -------------------------------------------------------------
  sesame: 'en:sesame-seeds', 'sesame-seeds': 'en:sesame-seeds',
  'sesame-seed': 'en:sesame-seeds', tahini: 'en:sesame-seeds',
  halva: 'en:sesame-seeds', 'gingelly-oil': 'en:sesame-seeds',
  'benne-seed': 'en:sesame-seeds',
  sesam: 'en:sesame-seeds', sesamo: 'en:sesame-seeds', sesamo_it: 'en:sesame-seeds',

  // --- sulphites ----------------------------------------------------------
  sulphites: 'en:sulphur-dioxide-and-sulphites',
  sulfites: 'en:sulphur-dioxide-and-sulphites',
  sulphite: 'en:sulphur-dioxide-and-sulphites',
  sulfite: 'en:sulphur-dioxide-and-sulphites',
  'sulphur-dioxide': 'en:sulphur-dioxide-and-sulphites',
  'sulfur-dioxide': 'en:sulphur-dioxide-and-sulphites',
  'sulphur-dioxide-and-sulphites': 'en:sulphur-dioxide-and-sulphites',
  'sulfur-dioxide-and-sulphites': 'en:sulphur-dioxide-and-sulphites',
  'anhydride-sulfureux-et-sulfites': 'en:sulphur-dioxide-and-sulphites',
  sulfiti: 'en:sulphur-dioxide-and-sulphites',
  sulfitos: 'en:sulphur-dioxide-and-sulphites',

  // --- lupin --------------------------------------------------------------
  lupin: 'en:lupin', lupine: 'en:lupin', lupins: 'en:lupin', lupini: 'en:lupin',
  altramuces: 'en:lupin',
}

/** Strips an OFF locale prefix (`fr:`, `en:`, `xx-xx:`) and normalises spacing. */
function stripLocale(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/^[a-z]{2,3}(-[a-z]{2,4})?:/, '')
    .replace(/[_\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Resolves any allergen tag or ingredient-ish token to its canonical group.
 * Returns null when the token is not a recognised allergen — callers must
 * treat that as "unverified", never as "absent".
 */
export function canonicalAllergen(tag: string): CanonicalAllergen | null {
  if (!tag) return null
  const base = stripLocale(tag)
  if (!base) return null

  const direct = ALIASES[base]
  if (direct) return direct

  // Trailing plural, e.g. an unlisted "hazelnuts" style variant.
  if (base.endsWith('s')) {
    const singular = ALIASES[base.slice(0, -1)]
    if (singular) return singular
  }

  // Already canonical (e.g. a group we listed but did not alias to itself).
  const asCanonical = `en:${base}` as CanonicalAllergen
  if ((CANONICAL_ALLERGENS as readonly string[]).includes(asCanonical)) {
    return asCanonical
  }

  return null
}

/** Canonical groups present in a tag list, plus whether anything was unresolved. */
export function canonicalAllergenSet(tags: readonly string[]): {
  resolved: Set<CanonicalAllergen>
  unresolved: string[]
} {
  const resolved = new Set<CanonicalAllergen>()
  const unresolved: string[] = []
  for (const tag of tags) {
    const canonical = canonicalAllergen(tag)
    if (canonical) resolved.add(canonical)
    else if (tag.trim()) unresolved.push(tag)
  }
  return { resolved, unresolved }
}
