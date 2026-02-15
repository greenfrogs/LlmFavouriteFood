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

export interface Dish {
  id: string;
  name: string;
  image: string;
  cuisines: string[];
  ingredients: string[];
  categories: string[]; // e.g. "Dessert", "Main Course" derived from subclass or specific properties
  ai?: DishAiMeta;
}

export interface GameState {
  pool: Dish[];
  currentQuestion?: Question;
  duelPairs: [Dish, Dish][];
  winner?: Dish;
  phase: 'loading' | 'narrowing' | 'duel' | 'result';
}

export interface Question {
  id: string;
  text: string;
  attribute: keyof Dish | 'category'; // 'category' is a derived helper
  options: string[];
  optionLabels?: string[];
  optionHints?: string[];
  filter: (dish: Dish, option: string) => boolean;
}
