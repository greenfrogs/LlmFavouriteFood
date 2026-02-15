import type { Dish, DishAiMeta } from '../types';
import rawDishes from '../data/dishes.enriched.json';

const defaultAiMeta: DishAiMeta = {
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

function extractQidFromEntityUrl(entityUrl: string): string | null {
  const match = entityUrl.match(/\/(Q\d+)$/i);
  return match ? match[1].toUpperCase() : null;
}

function isPlaceholderDishName(dish: Dish): boolean {
  const name = dish.name.trim();
  if (!/^Q\d+$/i.test(name)) return false;
  const qid = extractQidFromEntityUrl(dish.id);
  return qid ? name.toUpperCase() === qid : true;
}

const dishes: Dish[] = (rawDishes as Dish[])
  .map((dish) => ({
    ...dish,
    ai: dish.ai ? { ...defaultAiMeta, ...dish.ai } : { ...defaultAiMeta },
  }))
  .filter((dish) => !isPlaceholderDishName(dish));

export async function fetchDishes(): Promise<Dish[]> {
  return new Promise((resolve) => {
    // Shuffle the results on client side to ensure variety
    const shuffled = [...dishes].sort(() => 0.5 - Math.random());
    resolve(shuffled);
  });
}
