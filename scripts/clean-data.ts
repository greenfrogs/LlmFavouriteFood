import fs from 'node:fs';
import path from 'node:path';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface DishLike {
  id?: string;
  name?: string;
  image?: string;
}

interface CacheEntry {
  dishId?: string;
  [key: string]: JsonValue;
}

interface CacheState {
  promptVersion?: string;
  entries?: Record<string, CacheEntry>;
}

interface ProgressState {
  index?: number;
  total?: number;
  enriched?: JsonValue[];
}

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const RAW_FILE = path.join(DATA_DIR, 'dishes.json');
const ENRICHED_FILE = path.join(DATA_DIR, 'dishes.enriched.json');
const CACHE_FILE = path.join(DATA_DIR, 'dishes.enrichment.cache.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'dishes.enriched.progress.json');

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function extractQidFromId(id: string): string | null {
  const match = id.match(/\/(Q\d+)$/i);
  return match ? match[1].toUpperCase() : null;
}

function isPlaceholderWikiName(dish: DishLike): boolean {
  if (!dish.id || !dish.name) return false;
  const trimmedName = dish.name.trim();
  if (!/^Q\d+$/i.test(trimmedName)) return false;
  const qid = extractQidFromId(dish.id);
  return qid ? trimmedName.toUpperCase() === qid : true;
}

function isValidDish(dish: DishLike): dish is Required<Pick<DishLike, 'id' | 'name' | 'image'>> {
  return Boolean(dish.id && dish.name && dish.image);
}

function cleanDishFile(filePath: string): Set<string> {
  const dishes = readJson<DishLike[]>(filePath, []);
  const cleaned = dishes.filter((dish) => isValidDish(dish) && !isPlaceholderWikiName(dish));
  writeJson(filePath, cleaned);
  console.log(`[clean-data] ${path.basename(filePath)}: ${dishes.length} -> ${cleaned.length} (removed ${dishes.length - cleaned.length})`);
  return new Set(cleaned.map((dish) => dish.id));
}

function cleanCache(validIds: Set<string>): void {
  const cache = readJson<CacheState>(CACHE_FILE, {});
  const before = cache.entries ? Object.keys(cache.entries).length : 0;
  const nextEntries: Record<string, CacheEntry> = {};

  if (cache.entries) {
    for (const [key, entry] of Object.entries(cache.entries)) {
      const dishId = entry.dishId ?? key;
      if (!dishId || !validIds.has(dishId)) continue;
      nextEntries[key] = entry;
    }
  }

  const nextCache: CacheState = {
    promptVersion: cache.promptVersion,
    entries: nextEntries,
  };
  writeJson(CACHE_FILE, nextCache);
  const after = Object.keys(nextEntries).length;
  console.log(`[clean-data] ${path.basename(CACHE_FILE)}: ${before} -> ${after} (removed ${before - after})`);
}

function cleanProgress(validIds: Set<string>): void {
  if (!fs.existsSync(PROGRESS_FILE)) return;
  const progress = readJson<ProgressState>(PROGRESS_FILE, {});
  const enriched = Array.isArray(progress.enriched) ? progress.enriched : [];
  const cleaned = enriched.filter((value) => {
    if (!value || typeof value !== 'object') return false;
    const dish = value as DishLike;
    return isValidDish(dish) && validIds.has(dish.id) && !isPlaceholderWikiName(dish);
  });

  const nextProgress: ProgressState = {
    ...progress,
    enriched: cleaned,
    total: cleaned.length,
    index: Math.min(Number(progress.index ?? 0), cleaned.length),
  };
  writeJson(PROGRESS_FILE, nextProgress);
  console.log(`[clean-data] ${path.basename(PROGRESS_FILE)}: ${enriched.length} -> ${cleaned.length} (removed ${enriched.length - cleaned.length})`);
}

function main(): void {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`Data directory not found: ${DATA_DIR}`);
  }

  const rawIds = cleanDishFile(RAW_FILE);
  const enrichedIds = fs.existsSync(ENRICHED_FILE) ? cleanDishFile(ENRICHED_FILE) : new Set<string>();

  // Prefer enriched IDs when available, else fallback to raw IDs.
  const validIds = enrichedIds.size > 0 ? enrichedIds : rawIds;
  cleanCache(validIds);
  cleanProgress(validIds);
  console.log('[clean-data] complete');
}

main();
