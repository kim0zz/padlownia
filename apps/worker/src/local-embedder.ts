import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env, pipeline } from '@huggingface/transformers';
import type { Embedder } from '@padlownia/ai';

/**
 * Free local embeddings (no API, no cost). The model is downloaded once from Hugging Face into
 * the ignored `.local/models` folder; vectors of private source text are cached under `.local/embeddings`.
 */
export interface LocalModel { id: string; queryPrefix: string; passagePrefix: string }
export const LOCAL_MODELS: Record<string, LocalModel> = {
  // E5 models are trained with these prefixes; omitting them measurably hurts retrieval.
  'e5-small': { id: 'Xenova/multilingual-e5-small', queryPrefix: 'query: ', passagePrefix: 'passage: ' },
  'minilm-multi': { id: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', queryPrefix: '', passagePrefix: '' },
};

export async function createLocalEmbedder(name: string): Promise<Embedder & { model: string }> {
  const model = LOCAL_MODELS[name];
  if (!model) throw new Error('LOCAL_MODEL_UNKNOWN');
  env.cacheDir = resolve('.local/models');
  const extractor = await pipeline('feature-extraction', model.id, { dtype: 'q8' });
  const embed = async (texts: string[], prefix: string) => {
    const vectors: Float32Array[] = [];
    for (let start = 0; start < texts.length; start += 32) {
      const batch = texts.slice(start, start + 32).map((text) => prefix + text);
      const output = await extractor(batch, { pooling: 'mean', normalize: true });
      const [rows, dims] = output.dims as [number, number];
      const data = output.data as Float32Array;
      for (let row = 0; row < rows; row += 1) vectors.push(data.slice(row * dims, (row + 1) * dims));
    }
    return vectors;
  };
  return { model: model.id, embedQueries: (texts) => embed(texts, model.queryPrefix), embedPassages: (texts) => embed(texts, model.passagePrefix) };
}

/** Passage vectors keyed by chunk ID, cached per model and exact chunk texts. */
export async function cachedPassageVectors(embedder: Embedder & { model: string }, items: { id: string; text: string }[]): Promise<Map<string, Float32Array>> {
  const key = createHash('sha256').update(embedder.model + '\n' + items.map((item) => `${item.id}:${item.text}`).join('\n')).digest('hex').slice(0, 16);
  const file = resolve('.local/embeddings', `${embedder.model.replace(/\W+/g, '_')}-${key}.json`);
  try {
    const stored = JSON.parse(await readFile(file, 'utf8')) as Record<string, number[]>;
    return new Map(Object.entries(stored).map(([id, vector]) => [id, Float32Array.from(vector)]));
  } catch { /* Not cached yet. */ }
  const vectors = await embedder.embedPassages(items.map((item) => item.text));
  const map = new Map(items.map((item, index) => [item.id, vectors[index]!]));
  await mkdir(resolve('.local/embeddings'), { recursive: true });
  await writeFile(file, JSON.stringify(Object.fromEntries([...map].map(([id, vector]) => [id, Array.from(vector, (value) => Math.round(value * 1e5) / 1e5)]))));
  return map;
}
