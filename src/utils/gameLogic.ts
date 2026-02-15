import type { Dish, Question } from '../types';

type BucketType =
  | 'proteinType'
  | 'servingTemperature'
  | 'spiceLevel'
  | 'comfortVsLight'
  | 'courseType'
  | 'flavorProfile'
  | 'textureProfile'
  | 'mealContext'
  | 'dietaryTags'
  | 'cookingMethodTags'
  | 'keyIngredients'
  | 'cuisine'
  | 'ingredient'
  | 'category';

interface Candidate {
  type: BucketType;
  value: string;
  count: number;
  weight: number;
}

const MIN_RATIO = 0.07;
const MAX_RATIO = 0.65;
const MIN_OPTIONS = 3;
const MAX_OPTIONS = 4;
const TYPE_PRIORITY: Record<BucketType, number> = {
  proteinType: 1.6,
  servingTemperature: 1.5,
  spiceLevel: 1.45,
  comfortVsLight: 1.35,
  courseType: 1.4,
  flavorProfile: 1.35,
  textureProfile: 1.25,
  mealContext: 1.15,
  dietaryTags: 1.1,
  cookingMethodTags: 1.05,
  keyIngredients: 1,
  cuisine: 0.95,
  ingredient: 0.9,
  category: 0.85,
};

function titleCase(value: string): string {
  if (!value) return value;
  return value
    .replaceAll('_', ' ')
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function addWeight(map: Map<string, number>, key: string, weight = 1): void {
  map.set(key, (map.get(key) ?? 0) + weight);
}

function weightedPick<T extends { weight: number }>(items: T[]): T | null {
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return items[0];

  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function collectCandidates(pool: Dish[]): Candidate[] {
  const total = pool.length;
  const buckets: Record<BucketType, Map<string, number>> = {
    proteinType: new Map(),
    servingTemperature: new Map(),
    spiceLevel: new Map(),
    comfortVsLight: new Map(),
    courseType: new Map(),
    flavorProfile: new Map(),
    textureProfile: new Map(),
    mealContext: new Map(),
    dietaryTags: new Map(),
    cookingMethodTags: new Map(),
    keyIngredients: new Map(),
    cuisine: new Map(),
    ingredient: new Map(),
    category: new Map(),
  };

  const addList = (map: Map<string, number>, values: string[], weight = 1) => {
    const unique = new Set(values.map(normalize).filter(Boolean));
    for (const value of unique) addWeight(map, value, weight);
  };

  for (const dish of pool) {
    const ai = dish.ai;
    if (ai) {
      // Use confidence as soft weight instead of hard cutoff.
      const aiWeight = Math.max(0.2, Math.min(1, ai.aiConfidence));

      if (ai.proteinType && ai.proteinType !== 'unknown') {
        addWeight(buckets.proteinType, normalize(ai.proteinType), aiWeight);
      }
      if (ai.servingTemperature && ai.servingTemperature !== 'mixed') {
        addWeight(buckets.servingTemperature, normalize(ai.servingTemperature), aiWeight);
      }
      if (ai.comfortVsLight && ai.comfortVsLight !== 'unknown') {
        addWeight(buckets.comfortVsLight, normalize(ai.comfortVsLight), aiWeight);
      }

      if (ai.spiceLevel >= 3) addWeight(buckets.spiceLevel, 'spicy', aiWeight);
      if (ai.spiceLevel <= 1) addWeight(buckets.spiceLevel, 'mild', aiWeight);

      addList(buckets.courseType, ai.courseType, aiWeight);
      addList(buckets.flavorProfile, ai.flavorProfile, aiWeight);
      addList(buckets.textureProfile, ai.textureProfile, aiWeight);
      addList(buckets.mealContext, ai.mealContext, aiWeight);
      addList(buckets.dietaryTags, ai.dietaryTags, aiWeight);
      addList(buckets.cookingMethodTags, ai.cookingMethodTags, aiWeight);
      addList(buckets.keyIngredients, ai.keyIngredients, aiWeight);
    }

    addList(buckets.cuisine, dish.cuisines);
    addList(buckets.ingredient, dish.ingredients);
    addList(buckets.category, dish.categories);
  }

  const build = (type: BucketType, entries: Iterable<[string, number]>): Candidate[] => {
    const result: Candidate[] = [];
    for (const [value, count] of entries) {
      if (!value) continue;
      const ratio = count / total;
      if (ratio < MIN_RATIO || ratio > MAX_RATIO) continue;

      const splitScore = (1 - Math.abs(0.5 - ratio)) + 0.01;
      const weight = splitScore * TYPE_PRIORITY[type];
      result.push({ type, value, count, weight });
    }
    return result;
  };

  return (Object.keys(buckets) as BucketType[]).flatMap((type) => build(type, buckets[type].entries()));
}

function collectNameFallbackCandidates(pool: Dish[]): Candidate[] {
  const total = pool.length;
  const tokenCounts = new Map<string, number>();
  const stopWords = new Set(['and', 'with', 'the', 'for', 'style', 'food', 'dish']);

  for (const dish of pool) {
    const tokens = dish.name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !stopWords.has(token));
    const unique = new Set(tokens);
    for (const token of unique) addWeight(tokenCounts, token);
  }

  const fallback: Candidate[] = [];
  for (const [token, count] of tokenCounts.entries()) {
    const ratio = count / total;
    if (ratio < 0.15 || ratio > 0.85) continue;
    fallback.push({
      type: 'ingredient',
      value: token,
      count,
      weight: (1 - Math.abs(0.5 - ratio)) * 0.75 + 0.01,
    });
  }
  return fallback;
}

function questionTextForType(type: BucketType): string {
  const text: Record<BucketType, string> = {
    proteinType: 'Pick A Protein Direction',
    servingTemperature: 'Pick A Temperature Vibe',
    spiceLevel: 'Choose Your Spice Level',
    comfortVsLight: 'Pick Your Food Mood',
    courseType: 'Pick A Course Style',
    flavorProfile: 'Pick A Flavor Profile',
    textureProfile: 'Pick A Texture Profile',
    mealContext: 'What Occasion Is This For?',
    dietaryTags: 'Pick A Dietary Preference',
    cookingMethodTags: 'Pick A Cooking Style',
    keyIngredients: 'Pick An Ingredient Vibe',
    cuisine: 'Pick A Cuisine Direction',
    ingredient: 'Pick An Ingredient Direction',
    category: 'Pick A Food Category',
  };
  return text[type];
}

function matchesCandidate(dish: Dish, type: BucketType, value: string): boolean {
  const ai = dish.ai;
  switch (type) {
    case 'proteinType':
      return normalize(ai?.proteinType ?? '') === value;
    case 'servingTemperature':
      return normalize(ai?.servingTemperature ?? '') === value;
    case 'spiceLevel':
      return value === 'spicy' ? (ai?.spiceLevel ?? 0) >= 3 : (ai?.spiceLevel ?? 0) <= 1;
    case 'comfortVsLight':
      return normalize(ai?.comfortVsLight ?? '') === value;
    case 'courseType':
      return (ai?.courseType ?? []).some((entry) => normalize(entry) === value);
    case 'flavorProfile':
      return (ai?.flavorProfile ?? []).some((entry) => normalize(entry) === value);
    case 'textureProfile':
      return (ai?.textureProfile ?? []).some((entry) => normalize(entry) === value);
    case 'mealContext':
      return (ai?.mealContext ?? []).some((entry) => normalize(entry) === value);
    case 'dietaryTags':
      return (ai?.dietaryTags ?? []).some((entry) => normalize(entry) === value);
    case 'cookingMethodTags':
      return (ai?.cookingMethodTags ?? []).some((entry) => normalize(entry) === value);
    case 'keyIngredients':
      return (ai?.keyIngredients ?? []).some((entry) => normalize(entry) === value);
    case 'cuisine':
      return dish.cuisines.some((entry) => normalize(entry) === value);
    case 'ingredient':
      return dish.ingredients.some((entry) => normalize(entry) === value) || dish.name.toLowerCase().includes(value);
    case 'category':
      return dish.categories.some((entry) => normalize(entry) === value);
    default:
      return false;
  }
}

function buildMultiChoiceQuestion(type: BucketType, options: Candidate[]): Question {
  const values = options.map((option) => option.value);
  const labels = values.map((value) => titleCase(value.replaceAll('_', ' ')));
  const total = options.reduce((sum, option) => sum + option.count, 0);
  const hints = options.map((option) => {
    const pct = total > 0 ? Math.round((option.count / total) * 100) : 0;
    return `${pct}% Of Remaining Dishes`;
  });

  return {
    id: `multi-${type}-${values.join('|')}`,
    text: questionTextForType(type),
    attribute: 'category',
    options: values,
    optionLabels: labels,
    optionHints: hints,
    filter: (dish, selectedOption) => matchesCandidate(dish, type, selectedOption),
  };
}

export const generateQuestion = (
  pool: Dish[],
  excludedQuestionIds: Set<string> = new Set(),
  lastOptionsByQuestionType: Map<string, Set<string>> = new Map()
): Question | null => {
  if (pool.length <= 1) return null;
  const candidates = collectCandidates(pool);
  const effective = candidates.length > 0 ? candidates : collectNameFallbackCandidates(pool);
  if (effective.length === 0) return null;

  const grouped = new Map<BucketType, Candidate[]>();
  for (const candidate of effective) {
    const existing = grouped.get(candidate.type) ?? [];
    existing.push(candidate);
    grouped.set(candidate.type, existing);
  }

  const questionCandidates = [...grouped.entries()]
    .map(([type, list]) => {
      const sorted = [...list].sort((a, b) => b.weight - a.weight);
      const options = sorted.slice(0, MAX_OPTIONS);
      const questionId = `multi-${type}-${options.map((option) => option.value).join('|')}`;
      const weight = options.reduce((sum, option) => sum + option.weight, 0) * TYPE_PRIORITY[type];
      return { type, options, questionId, weight };
    })
    .filter((entry) => entry.options.length >= MIN_OPTIONS);

  if (questionCandidates.length === 0) return null;

  const withoutRepeatIds = questionCandidates.filter((entry) => !excludedQuestionIds.has(entry.questionId));
  const withoutOptionOverlap = withoutRepeatIds.filter((entry) => {
    const previousOptions = lastOptionsByQuestionType.get(entry.type);
    if (!previousOptions || previousOptions.size === 0) return true;
    return entry.options.every((option) => !previousOptions.has(option.value));
  });

  const selected = weightedPick(withoutOptionOverlap);
  if (!selected) return null;

  return buildMultiChoiceQuestion(selected.type, selected.options);
};

export const generateDuel = (pool: Dish[]): [Dish, Dish] | null => {
  if (pool.length < 2) return null;
  // Pick first two available. In a real tournament, we might want random pairs.
  // Using simple index 0 and 1 since the pool is randomized initially.
  return [pool[0], pool[1]];
};
