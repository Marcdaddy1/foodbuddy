export * from './types'
export {
  additiveTagsFromText,
  classifyIngredient,
  normalizedFromProductRow,
  normalizedToScoringInput,
  normalizeOffProduct,
  nutrimentsFromOff,
  offProductSchema,
  offResponseSchema,
  splitIngredientsText,
  stripLocale,
  tracesFromText,
  type OffProduct,
  type OffResponse,
  type ProductRow,
} from './normalize'
export {
  fetchOffProduct,
  offProductUrl,
  OffNetworkError,
  OffNotFoundError,
  OffParseError,
  type OffFetchResult,
} from './client'
