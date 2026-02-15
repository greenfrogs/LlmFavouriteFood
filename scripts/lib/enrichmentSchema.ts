export interface RawDish {
  id: string;
  name: string;
  image: string;
  cuisines: string[];
  ingredients: string[];
  categories: string[];
}

export type ServingTemperature = 'hot' | 'cold' | 'room' | 'mixed';
export type ProteinType = 'meat' | 'seafood' | 'vegetarian' | 'vegan' | 'mixed' | 'unknown';
export type ComfortVsLight = 'comfort' | 'balanced' | 'light' | 'unknown';

export interface DishAiMeta {
  flavorProfile: string[];
  mealContext: string[];
  dietaryTags: string[];
  keyIngredients: string[];
  textureProfile: string[];
  servingTemperature: ServingTemperature;
  spiceLevel: 0 | 1 | 2 | 3 | 4 | 5;
  allergenRiskTags: string[];
  proteinType: ProteinType;
  courseType: string[];
  cookingMethodTags: string[];
  comfortVsLight: ComfortVsLight;
  adventureLevel: 1 | 2 | 3 | 4 | 5;
  aiConfidence: number;
}

export interface EnrichedDish extends RawDish {
  ai: DishAiMeta;
}

export const ENRICHMENT_PROMPT_VERSION = 'v3-ollama-local';

const LIST_LIMIT = 8;

const FLAVOR_ALLOWED = new Set(['sweet', 'savory', 'spicy', 'umami', 'sour', 'bitter', 'salty', 'rich', 'smoky', 'tangy']);
const MEAL_CONTEXT_ALLOWED = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'appetizer', 'late_night']);
const DIETARY_ALLOWED = new Set([
  'vegetarian',
  'vegan',
  'gluten_free',
  'dairy_free',
  'nut_free',
  'egg_free',
  'halal',
  'kosher',
  'pescatarian',
]);
const TEXTURE_ALLOWED = new Set(['crispy', 'crunchy', 'creamy', 'chewy', 'brothy', 'tender', 'silky', 'sticky']);
const ALLERGEN_ALLOWED = new Set([
  'contains_nuts',
  'contains_dairy',
  'contains_gluten',
  'contains_shellfish',
  'contains_egg',
  'contains_soy',
  'contains_fish',
  'contains_sesame',
]);
const COURSE_ALLOWED = new Set(['starter', 'main', 'side', 'dessert', 'street_food', 'snack']);
const METHOD_ALLOWED = new Set([
  'fried',
  'stir_fried',
  'grilled',
  'baked',
  'steamed',
  'raw',
  'stewed',
  'boiled',
  'roasted',
  'braised',
  'sauteed',
  'smoked',
]);
const SERVING_ALLOWED = new Set<ServingTemperature>(['hot', 'cold', 'room', 'mixed']);
const PROTEIN_ALLOWED = new Set<ProteinType>(['meat', 'seafood', 'vegetarian', 'vegan', 'mixed', 'unknown']);
const COMFORT_ALLOWED = new Set<ComfortVsLight>(['comfort', 'balanced', 'light', 'unknown']);

function toSnakeCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cleanList(values: unknown, allowed: Set<string>, fallback: string[] = []): string[] {
  if (!Array.isArray(values)) return fallback;
  const unique = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = toSnakeCase(value);
    if (!normalized) continue;
    if (!allowed.has(normalized)) continue;
    unique.add(normalized);
    if (unique.size >= LIST_LIMIT) break;
  }
  return [...unique];
}

function cleanFreeList(values: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(values)) return fallback;
  const unique = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = toSnakeCase(value);
    if (!normalized) continue;
    unique.add(normalized);
    if (unique.size >= LIST_LIMIT) break;
  }
  return [...unique];
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampFloat(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export function defaultAiMeta(): DishAiMeta {
  return {
    flavorProfile: [],
    mealContext: [],
    dietaryTags: [],
    keyIngredients: [],
    textureProfile: [],
    servingTemperature: 'mixed',
    spiceLevel: 0,
    allergenRiskTags: [],
    proteinType: 'unknown',
    courseType: [],
    cookingMethodTags: [],
    comfortVsLight: 'unknown',
    adventureLevel: 3,
    aiConfidence: 0,
  };
}

export function sanitizeAiMeta(input: unknown): DishAiMeta {
  const base = defaultAiMeta();
  if (!input || typeof input !== 'object') return base;
  const raw = input as Record<string, unknown>;

  const servingTemperature = typeof raw.servingTemperature === 'string' && SERVING_ALLOWED.has(raw.servingTemperature as ServingTemperature)
    ? (raw.servingTemperature as ServingTemperature)
    : base.servingTemperature;

  const proteinType = typeof raw.proteinType === 'string' && PROTEIN_ALLOWED.has(raw.proteinType as ProteinType)
    ? (raw.proteinType as ProteinType)
    : base.proteinType;

  const comfortVsLight = typeof raw.comfortVsLight === 'string' && COMFORT_ALLOWED.has(raw.comfortVsLight as ComfortVsLight)
    ? (raw.comfortVsLight as ComfortVsLight)
    : base.comfortVsLight;

  return {
    flavorProfile: cleanList(raw.flavorProfile, FLAVOR_ALLOWED),
    mealContext: cleanList(raw.mealContext, MEAL_CONTEXT_ALLOWED),
    dietaryTags: cleanList(raw.dietaryTags, DIETARY_ALLOWED),
    keyIngredients: cleanFreeList(raw.keyIngredients),
    textureProfile: cleanList(raw.textureProfile, TEXTURE_ALLOWED),
    servingTemperature,
    spiceLevel: clampInt(raw.spiceLevel, 0, 5, base.spiceLevel) as 0 | 1 | 2 | 3 | 4 | 5,
    allergenRiskTags: cleanList(raw.allergenRiskTags, ALLERGEN_ALLOWED),
    proteinType,
    courseType: cleanList(raw.courseType, COURSE_ALLOWED),
    cookingMethodTags: cleanList(raw.cookingMethodTags, METHOD_ALLOWED),
    comfortVsLight,
    adventureLevel: clampInt(raw.adventureLevel, 1, 5, base.adventureLevel) as 1 | 2 | 3 | 4 | 5,
    aiConfidence: clampFloat(raw.aiConfidence, 0, 1, base.aiConfidence),
  };
}

export function calibrateAiMeta(ai: DishAiMeta, dish: RawDish): DishAiMeta {
  let evidence = 0;
  evidence += Math.min(0.25, dish.cuisines.length * 0.08);
  evidence += Math.min(0.35, dish.ingredients.length * 0.06);
  evidence += Math.min(0.2, dish.categories.length * 0.07);

  // Small signal from name richness.
  const tokenCount = dish.name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2).length;
  if (tokenCount >= 2) evidence += 0.08;

  // If model emits concrete tags, treat as weak extra evidence (still capped).
  if (ai.keyIngredients.length > 0) evidence += 0.06;
  if (ai.flavorProfile.length > 0) evidence += 0.06;
  evidence = Math.min(1, evidence);

  // Do not allow confidence to exceed evidence-based ceiling.
  const maxConfidence = 0.15 + evidence * 0.8;
  const calibratedConfidence = Math.min(ai.aiConfidence, maxConfidence);

  const calibrated: DishAiMeta = {
    ...ai,
    aiConfidence: Number(calibratedConfidence.toFixed(2)),
  };

  // When evidence is weak, avoid high-risk hallucinated labels.
  if (evidence < 0.25) {
    calibrated.dietaryTags = [];
    calibrated.allergenRiskTags = [];
    calibrated.proteinType = 'unknown';
  }

  // If source has no ingredients, keep inferred ingredient list conservative.
  if (dish.ingredients.length === 0 && calibrated.keyIngredients.length > 4) {
    calibrated.keyIngredients = calibrated.keyIngredients.slice(0, 4);
  }

  return calibrated;
}

export const enrichmentSchemaDescription = `
Return JSON only. Schema:
{
  "flavorProfile": string[], // allowed: sweet,savory,spicy,umami,sour,bitter,salty,rich,smoky,tangy
  "mealContext": string[],   // allowed: breakfast,lunch,dinner,snack,dessert,appetizer,late_night
  "dietaryTags": string[],   // allowed: vegetarian,vegan,gluten_free,dairy_free,nut_free,egg_free,halal,kosher,pescatarian
  "keyIngredients": string[], // snake_case
  "textureProfile": string[], // allowed: crispy,crunchy,creamy,chewy,brothy,tender,silky,sticky
  "servingTemperature": "hot" | "cold" | "room" | "mixed",
  "spiceLevel": 0..5,
  "allergenRiskTags": string[], // allowed: contains_nuts,contains_dairy,contains_gluten,contains_shellfish,contains_egg,contains_soy,contains_fish,contains_sesame
  "proteinType": "meat" | "seafood" | "vegetarian" | "vegan" | "mixed" | "unknown",
  "courseType": string[], // allowed: starter,main,side,dessert,street_food,snack
  "cookingMethodTags": string[], // allowed: fried,grilled,baked,steamed,raw,stewed,boiled,roasted
  "comfortVsLight": "comfort" | "balanced" | "light" | "unknown",
  "adventureLevel": 1..5,
  "aiConfidence": 0..1
}
Use lowercase snake_case tokens.
If uncertain, prefer empty arrays, "unknown", lower spice level, and low aiConfidence.
`;
