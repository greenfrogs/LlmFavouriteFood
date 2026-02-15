# Favourite Food Picker

A mobile-first webapp to help you decide what to eat.

This is a hobby project focused on learning how to optimize real-world LLM-assisted development as projects grow in complexity. A core experiment is using LLMs inside the project itself (for example, in data enrichment and workflow tooling) to create a practical self-cycling improvement loop.

## Features
- **Dynamic Questions**: Narrows down options based on cuisine, taste (sweet/savory), and ingredients.
- **Duel Mode**: Pick your favorite between two dishes until one remains.
- **Wikidata Integration**: Fetches real dishes and images from Wikidata.

## Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start dev server:
   ```bash
   npm run dev
   ```

## Data Pipeline

1. Prefetch all dishes from Wikidata:
   ```bash
   npm run prefetch
   ```
2. Test prompts on a tiny sample first (recommended to avoid wasting credits):
   ```bash
   npm run enrich:test
   ```
   This runs in fresh mode (ignores checkpoint), fails fast on bad outputs, and writes to:
   `src/data/dishes.enriched.test.json`
3. Run full AI enrichment through local Ollama:
   ```bash
   npm run enrich
   ```
4. Run both steps:
   ```bash
   npm run prepare-data
   ```
5. Optional Ollama overrides:
   ```bash
   OLLAMA_MODEL=qwen3:30b OLLAMA_BASE_URL=http://127.0.0.1:11434 npm run enrich
   ```

Enrichment persistence and cost control:
- Final enriched dataset: `src/data/dishes.enriched.json`
- Reusable cache for future incremental reruns: `src/data/dishes.enrichment.cache.json`
- Resume checkpoint (during long runs): `src/data/dishes.enriched.progress.json`

The script reuses cache entries by dish ID + signature + prompt version, so reruns only spend
credits on new or changed dishes.

## Deployment

To deploy to GitHub Pages:

1. Update `vite.config.ts` if your repository name is not `FavouriteFood`:
   ```typescript
   base: '/YourRepoName/'
   ```
2. Run deployment script:
   ```bash
   npm run deploy
   ```
   This will build the project and push the `dist` folder to the `gh-pages` branch.

## Technologies
- React + Vite
- TypeScript
- Tailwind CSS
- Wikidata SPARQL API
- Ollama local model (`OLLAMA_MODEL`, default `qwen3:30b`)
