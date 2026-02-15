import {
  enrichmentSchemaDescription,
  sanitizeAiMeta,
  type DishAiMeta,
  type RawDish,
} from './enrichmentSchema';

const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'qwen3:30b';
const MAX_RETRIES = Number(process.env.ENRICH_RETRIES ?? 3);
const REQUEST_TIMEOUT_MS = Number(process.env.ENRICH_TIMEOUT_MS ?? 120000);

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return JSON.parse(trimmed);
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error('AI response did not contain a JSON object.');
}

export class AiClient {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    this.baseUrl = DEFAULT_OLLAMA_BASE_URL;
    this.model = DEFAULT_MODEL;
  }

  getModel(): string {
    return this.model;
  }

  async enrichDish(dish: RawDish, promptVersion: string): Promise<{ ai: DishAiMeta; rawOutput: string }> {
    const prompt = `
You are enriching metadata for a food dish. Infer likely properties from dish name and metadata.
Be conservative. If unknown, use empty arrays, "unknown", or low confidence.
Do not use tools. Return JSON only.
Do not invent allergens, dietary labels, or protein type unless there is clear evidence in name/metadata.

Confidence rubric:
- 0.15-0.35: weak inference from name only
- 0.35-0.6: moderate inference with some metadata support
- 0.6-0.85: strong evidence from multiple metadata signals

Dish:
${JSON.stringify(dish, null, 2)}

promptVersion=${promptVersion}

${enrichmentSchemaDescription}
`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        console.log(`[enrich] calling Ollama (attempt ${attempt}/${MAX_RETRIES}): ${this.baseUrl}/api/generate model=${this.model}`);

        const response = await fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.model,
            prompt,
            stream: false,
            options: {
              temperature: 0.1,
            },
          }),
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Ollama error ${response.status}: ${errText}`);
        }

        const payload = (await response.json()) as { response?: string };
        const rawOutput = (payload.response ?? '').trim();
        if (!rawOutput) {
          throw new Error('Ollama returned empty output.');
        }
        const parsed = extractJson(rawOutput);
        return { ai: sanitizeAiMeta(parsed), rawOutput };
      } catch (error) {
        if (attempt === MAX_RETRIES) throw error;
        const waitMs = attempt * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }

    return { ai: sanitizeAiMeta({}), rawOutput: '{}' };
  }
}
