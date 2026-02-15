import fs from 'fs';
import path from 'path';
import { AiClient } from './lib/aiClient';
import {
  ENRICHMENT_PROMPT_VERSION,
  calibrateAiMeta,
  sanitizeAiMeta,
  type EnrichedDish,
  type RawDish,
} from './lib/enrichmentSchema';

const INPUT_FILE = path.join(process.cwd(), 'src', 'data', 'dishes.json');
const OUTPUT_FILE = path.join(process.cwd(), 'src', 'data', 'dishes.enriched.json');
const CHECKPOINT_FILE = path.join(process.cwd(), 'src', 'data', 'dishes.enriched.progress.json');
const CACHE_FILE = path.join(process.cwd(), 'src', 'data', 'dishes.enrichment.cache.json');
const BATCH_SIZE = Number(process.env.ENRICH_BATCH_SIZE ?? 25);
const TEST_LIMIT = Number(process.env.ENRICH_TEST_LIMIT ?? 5);
const IS_TEST_MODE = process.argv.includes('--test');
const FORCE_FRESH = process.argv.includes('--fresh') || process.env.ENRICH_FRESH === '1' || IS_TEST_MODE;
const TEST_STRICT = process.env.ENRICH_TEST_STRICT !== '0';
const BYPASS_CACHE = process.env.ENRICH_BYPASS_CACHE === '1' || IS_TEST_MODE;
const TEST_OUTPUT_FILE = path.join(process.cwd(), 'src', 'data', 'dishes.enriched.test.json');

interface CacheEntry {
  dishId: string;
  promptVersion: string;
  model: string;
  signature: string;
  updatedAt: string;
  rawOutput: string;
  ai: EnrichedDish['ai'];
}

interface CacheState {
  promptVersion: string;
  entries: Record<string, CacheEntry>;
}

interface ProgressState {
  index: number;
  total: number;
  enriched: EnrichedDish[];
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as T;
}

function writeJsonFile(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadInputDishes(): RawDish[] {
  const dishes = readJsonFile<RawDish[]>(INPUT_FILE, []);
  return dishes.filter((dish) => {
    if (!dish?.id || !dish?.name || !dish?.image) return false;
    const trimmedName = dish.name.trim();
    const qidMatch = dish.id.match(/\/(Q\d+)$/i);
    if (!/^Q\d+$/i.test(trimmedName)) return true;
    return qidMatch ? trimmedName.toUpperCase() !== qidMatch[1].toUpperCase() : false;
  });
}

function toSignature(dish: RawDish): string {
  return JSON.stringify({
    id: dish.id,
    name: dish.name,
    cuisines: dish.cuisines,
    ingredients: dish.ingredients,
    categories: dish.categories,
  });
}

function startCache(): CacheState {
  return { promptVersion: ENRICHMENT_PROMPT_VERSION, entries: {} };
}

function loadCache(): CacheState {
  const saved = readJsonFile<CacheState | null>(CACHE_FILE, null);
  if (!saved || typeof saved !== 'object' || !saved.entries || typeof saved.entries !== 'object') {
    return startCache();
  }
  if (saved.promptVersion !== ENRICHMENT_PROMPT_VERSION) {
    return startCache();
  }
  return saved;
}

function saveCache(cache: CacheState): void {
  writeJsonFile(CACHE_FILE, cache);
}

function startProgress(total: number): ProgressState {
  return { index: 0, total, enriched: [] };
}

function loadProgress(total: number): ProgressState {
  if (FORCE_FRESH) {
    return startProgress(total);
  }
  const saved = readJsonFile<ProgressState | null>(CHECKPOINT_FILE, null);
  if (!saved || !Array.isArray(saved.enriched) || typeof saved.index !== 'number') {
    return startProgress(total);
  }
  if (saved.total !== total) {
    return startProgress(total);
  }
  return saved;
}

function saveProgress(progress: ProgressState): void {
  writeJsonFile(CHECKPOINT_FILE, progress);
}

function mergeAiIntoDish(dish: RawDish, ai: unknown): EnrichedDish {
  const sanitized = sanitizeAiMeta(ai);
  const calibrated = calibrateAiMeta(sanitized, dish);
  return {
    ...dish,
    ai: calibrated,
  };
}

function printQualitySummary(records: EnrichedDish[]): void {
  if (records.length === 0) return;
  const countWith = (pick: (d: EnrichedDish) => boolean) => records.filter(pick).length;
  const pct = (n: number) => `${((n / records.length) * 100).toFixed(1)}%`;
  const avgConfidence =
    records.reduce((sum, dish) => sum + (dish.ai?.aiConfidence ?? 0), 0) / records.length;

  console.log('[enrich] quality summary');
  console.log(`  dishes: ${records.length}`);
  console.log(`  avg aiConfidence: ${avgConfidence.toFixed(2)}`);
  console.log(`  flavorProfile non-empty: ${pct(countWith((d) => d.ai.flavorProfile.length > 0))}`);
  console.log(`  mealContext non-empty: ${pct(countWith((d) => d.ai.mealContext.length > 0))}`);
  console.log(`  keyIngredients non-empty: ${pct(countWith((d) => d.ai.keyIngredients.length > 0))}`);
  console.log(`  dietaryTags non-empty: ${pct(countWith((d) => d.ai.dietaryTags.length > 0))}`);
}

async function run(): Promise<void> {
  const allDishes = loadInputDishes();
  const dishes = IS_TEST_MODE ? allDishes.slice(0, TEST_LIMIT) : allDishes;
  if (dishes.length === 0) {
    throw new Error('No dishes found. Run `npm run prefetch` first.');
  }

  const aiClient = new AiClient();
  const cache = loadCache();
  const progress = loadProgress(dishes.length);
  console.log(`Starting enrichment at index ${progress.index} / ${dishes.length}${IS_TEST_MODE ? ' (test mode)' : ''}`);
  if (FORCE_FRESH) {
    console.log('[enrich] running in fresh mode (ignoring existing progress checkpoint)');
  }
  if (BYPASS_CACHE) {
    console.log('[enrich] bypassing cache for this run');
  }

  for (let i = progress.index; i < dishes.length; i += 1) {
    const dish = dishes[i];
    const signature = toSignature(dish);
    const cached = cache.entries[dish.id];
    if (!BYPASS_CACHE && cached && cached.signature === signature && cached.promptVersion === ENRICHMENT_PROMPT_VERSION) {
      progress.enriched[i] = mergeAiIntoDish(dish, cached.ai);
      progress.index = i + 1;
      continue;
    }

    try {
      const { ai, rawOutput } = await aiClient.enrichDish(dish, ENRICHMENT_PROMPT_VERSION);
      progress.enriched[i] = mergeAiIntoDish(dish, ai);
      cache.entries[dish.id] = {
        dishId: dish.id,
        promptVersion: ENRICHMENT_PROMPT_VERSION,
        model: aiClient.getModel(),
        signature,
        updatedAt: new Date().toISOString(),
        rawOutput,
        ai,
      };
    } catch (error) {
      if (IS_TEST_MODE && TEST_STRICT) {
        throw new Error(`Test mode failed for "${dish.name}": ${String(error)}`);
      }
      console.warn(`AI enrichment failed for ${dish.name}. Using empty metadata.`, error);
      progress.enriched[i] = mergeAiIntoDish(dish, {});
    }

    progress.index = i + 1;
    if (progress.index % BATCH_SIZE === 0 || progress.index === dishes.length) {
      saveProgress(progress);
      saveCache(cache);
      console.log(`Enriched ${progress.index} / ${dishes.length}`);
    }
  }

  writeJsonFile(IS_TEST_MODE ? TEST_OUTPUT_FILE : OUTPUT_FILE, progress.enriched);
  saveCache(cache);

  if (!IS_TEST_MODE) {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
    }
  } else {
    console.log(`Test mode complete. Wrote sample of ${progress.enriched.length} records to ${TEST_OUTPUT_FILE}`);
    printQualitySummary(progress.enriched);
    return;
  }
  console.log(`Enrichment complete. Wrote ${progress.enriched.length} records to ${OUTPUT_FILE}`);
  printQualitySummary(progress.enriched);
}

void run().catch((error) => {
  console.error('Enrichment failed:', error);
  process.exit(1);
});
