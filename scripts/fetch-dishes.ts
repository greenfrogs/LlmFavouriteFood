import fs from 'fs';
import path from 'path';
import { setGlobalDispatcher, Agent } from 'undici';

setGlobalDispatcher(
  new Agent({
    connect: {
      rejectUnauthorized: false,
    },
  }),
);

interface Dish {
  id: string;
  name: string;
  image: string;
  cuisines: string[];
  ingredients: string[];
  categories: string[];
}

interface BindingValue {
  value: string;
}

interface SPARQLResponse {
  results: {
    bindings: Array<{
      dish: BindingValue;
      dishLabel: BindingValue;
      image: BindingValue;
      cuisines?: BindingValue;
      ingredients?: BindingValue;
      characteristics?: BindingValue;
    }>;
  };
}

const ENDPOINT = 'https://query.wikidata.org/sparql';
const OUTPUT_FILE = path.join(process.cwd(), 'src', 'data', 'dishes.json');
const PAGE_SIZE = 2000;
const REQUEST_DELAY_MS = 300;
const MAX_RETRIES = 3;

const KEYWORD_CATEGORIES: Record<string, RegExp[]> = {
  sweet: [/\bcake\b/i, /\bcookie\b/i, /\bchocolate\b/i, /\bdessert\b/i, /\bice cream\b/i, /\bsweet\b/i],
  savory: [/\bsoup\b/i, /\bstew\b/i, /\bcurry\b/i, /\broast\b/i, /\bgrill(?:ed)?\b/i, /\bsavory\b/i],
  spicy: [/\bspicy\b/i, /\bchili\b/i, /\bpepper\b/i, /\bmasala\b/i],
  vegetarian: [/\bvegetarian\b/i, /\bveggie\b/i, /\btofu\b/i, /\blentil\b/i, /\bchickpea\b/i],
  vegan: [/\bvegan\b/i],
  meat: [/\bbeef\b/i, /\bpork\b/i, /\bchicken\b/i, /\blamb\b/i, /\bbacon\b/i, /\bsausage\b/i],
  seafood: [/\bfish\b/i, /\bsalmon\b/i, /\btuna\b/i, /\bshrimp\b/i, /\bprawn\b/i, /\bcrab\b/i],
  noodle: [/\bnoodle\b/i, /\bramen\b/i, /\budon\b/i, /\bspaghetti\b/i, /\bpasta\b/i],
  rice: [/\brice\b/i, /\brisotto\b/i, /\bbiryani\b/i, /\bpaella\b/i],
  bread: [/\bbread\b/i, /\bsandwich\b/i, /\btoast\b/i, /\bpizza\b/i, /\bburger\b/i],
  breakfast: [/\bbreakfast\b/i, /\bomelette\b/i, /\bpancake\b/i, /\bwaffle\b/i],
  snack: [/\bsnack\b/i, /\bfry\b/i, /\bfries\b/i, /\bnugget\b/i, /\bchip\b/i],
};

function buildQuery(offset: number): string {
  return `
SELECT ?dish ?dishLabel ?image
  (GROUP_CONCAT(DISTINCT ?cuisineLabel; separator=",") AS ?cuisines)
  (GROUP_CONCAT(DISTINCT ?ingredientLabel; separator=",") AS ?ingredients)
  (GROUP_CONCAT(DISTINCT ?characteristicLabel; separator=",") AS ?characteristics)
WHERE {
  ?dish wdt:P31/wdt:P279* wd:Q746549 .
  ?dish wdt:P18 ?image .

  OPTIONAL {
    ?dish wdt:P2012 ?cuisine .
    ?cuisine rdfs:label ?cuisineLabel .
    FILTER(LANG(?cuisineLabel) = "en")
  }

  OPTIONAL {
    ?dish wdt:P527 ?ingredient .
    ?ingredient rdfs:label ?ingredientLabel .
    FILTER(LANG(?ingredientLabel) = "en")
  }

  OPTIONAL {
    ?dish wdt:P1552 ?characteristic .
    ?characteristic rdfs:label ?characteristicLabel .
    FILTER(LANG(?characteristicLabel) = "en")
  }

  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
}
GROUP BY ?dish ?dishLabel ?image
ORDER BY ?dish
LIMIT ${PAGE_SIZE}
OFFSET ${offset}
`;
}

function splitCsv(str?: string): string[] {
  if (!str) return [];
  return str
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractQidFromEntityUrl(entityUrl: string): string | null {
  const match = entityUrl.match(/\/(Q\d+)$/i);
  return match ? match[1].toUpperCase() : null;
}

function isPlaceholderDishName(id: string, name: string): boolean {
  const trimmedName = name.trim();
  if (!/^Q\d+$/i.test(trimmedName)) return false;
  const qid = extractQidFromEntityUrl(id);
  return qid ? trimmedName.toUpperCase() === qid : true;
}

function uniqueLower(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function inferKeywordCategories(name: string, cuisines: string[], ingredients: string[]): string[] {
  const haystack = `${name} ${cuisines.join(' ')} ${ingredients.join(' ')}`.toLowerCase();
  const categories: string[] = [];

  for (const [category, patterns] of Object.entries(KEYWORD_CATEGORIES)) {
    if (patterns.some((regex) => regex.test(haystack))) {
      categories.push(category);
    }
  }

  return categories;
}

function normalizeDish(binding: SPARQLResponse['results']['bindings'][number]): Dish {
  const cuisines = uniqueLower(splitCsv(binding.cuisines?.value));
  const ingredients = uniqueLower(splitCsv(binding.ingredients?.value));
  const characteristics = uniqueLower(splitCsv(binding.characteristics?.value));
  const inferred = inferKeywordCategories(binding.dishLabel.value, cuisines, ingredients);

  const dish: Dish = {
    id: binding.dish.value,
    name: binding.dishLabel.value,
    image: binding.image.value,
    cuisines,
    ingredients,
    // Categories are optional, but we precompute as much as possible.
    categories: uniqueLower([...characteristics, ...inferred]),
  };

  return dish;
}

async function fetchPage(offset: number): Promise<SPARQLResponse['results']['bindings']> {
  const query = buildQuery(offset);
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'FoodPickerApp/1.0 (mailto:your-email@example.com)',
        },
      });

      if (!response.ok) {
        throw new Error(`Wikidata API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as SPARQLResponse;
      return data.results.bindings;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      const delay = attempt * 1000;
      console.warn(`Request failed at offset ${offset} (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return [];
}

async function fetchAllDishes(): Promise<Dish[]> {
  const deduped = new Map<string, Dish>();
  let offset = 0;
  let pageNumber = 1;

  while (true) {
    const bindings = await fetchPage(offset);
    if (bindings.length === 0) {
      break;
    }

    for (const binding of bindings) {
      const dish = normalizeDish(binding);
      if (!dish.image) continue;
      if (isPlaceholderDishName(dish.id, dish.name)) continue;
      deduped.set(dish.id, dish);
    }

    console.log(`Page ${pageNumber}: fetched ${bindings.length} records, total unique dishes ${deduped.size}`);

    if (bindings.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
    pageNumber += 1;
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  return [...deduped.values()];
}

async function main(): Promise<void> {
  console.log('Prefetching all dishes from Wikidata...');
  try {
    const dishes = await fetchAllDishes();
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dishes, null, 2));
    console.log(`Done. Wrote ${dishes.length} dishes to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error('Failed to prefetch dishes:', error);
    process.exit(1);
  }
}

void main();
