import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildDenseIndex, buildLexicalIndex, chunkReviewDetail, chunkReviewMarkdown, parseGoldenJsonl, passageText, retrieveBalanced, retrieveHybrid,
  retrieveDense, scoreCase, stripNames, summarize, CHUNKER_VERSION, type CaseResult, type RetrievedChunk, type ReviewChunk } from '@padlownia/ai';
import { catalogueLinks, parseKnowledge } from './knowledge.js';
import { cachedPassageVectors, createLocalEmbedder } from './local-embedder.js';

/**
 * Offline retrieval eval over the private local corpus. No paid calls. With --model, a free local
 * embedding model is downloaded once (Hugging Face) and dense/hybrid variants are measured too.
 * Writes only aggregate metrics and case IDs/ranks (never source text), so results can be committed.
 */
const { values } = parseArgs({ options: {
  file: { type: 'string', default: 'sources/LLM FULL TEXT.txt' },
  catalogue: { type: 'string', default: 'sources/rackets.json' },
  details: { type: 'string', default: '.local/knowledge/review-details' },
  golden: { type: 'string', default: 'evals/retrieval/golden-v0.jsonl' },
  model: { type: 'string' },
  out: { type: 'string' },
  verbose: { type: 'boolean', default: false },
} });

const links = catalogueLinks(await readFile(values.catalogue));
const corpus = parseKnowledge(await readFile(values.file), links);
const chunks: ReviewChunk[] = corpus.documents
  .filter((doc) => doc.kind === 'racket_review' && doc.productSlugs.length === 1)
  .flatMap((doc) => chunkReviewMarkdown({ text: doc.text, sha256: doc.sha256, slug: doc.productSlugs[0]!, url: doc.url }));

let detailFiles = 0;
try {
  for (const name of (await readdir(values.details)).filter((file) => file.endsWith('.json'))) {
    const slug = name.replace(/\.json$/, '');
    const link = links.find((item) => item.slug === slug);
    if (!link) continue;
    const text = await readFile(resolve(values.details, name), 'utf8');
    chunks.push(...chunkReviewDetail({ json: JSON.parse(text), sha256: 'detail-' + slug, slug, url: link.url }));
    detailFiles += 1;
  }
} catch { /* Detail JSONs are optional. */ }

const lexical = buildLexicalIndex(chunks);
const cases = parseGoldenJsonl(await readFile(values.golden, 'utf8'));
// Rank up to 20 so one run yields hit@1/3/5 and hit@20 (found but "drowned" below the top 5).
const limit = 20;
const kinds: Record<string, number> = {};
for (const chunk of chunks) kinds[chunk.kind] = (kinds[chunk.kind] ?? 0) + 1;

// What a resolver knows about the rackets it matched: brand plus slug words (stand-in for display names).
const nameText = (slugs: string[]) => slugs.map((slug) => { const link = links.find((item) => item.slug === slug); return `${link?.brand ?? ''} ${slug.replace(/-review$/, '').replace(/-/g, ' ')}`; }).join(' ');
type Retriever = (question: string, scope: string[], index: number) => RetrievedChunk[];
const evaluate = (retrieve: Retriever) => cases.map((item, index): CaseResult & { top: string[] } => {
  const results = retrieve(item.question, item.scope, index);
  return { ...scoreCase(item, results), top: results.slice(0, 5).map((result) => `${result.chunk.slug.slice(0, 18)}:${result.chunk.kind}`) };
});
const bm25 = (expandPolishQuery: boolean, strip: boolean): Retriever => (question, scope) =>
  retrieveBalanced(lexical, question, { slugs: scope, limit, expandPolishQuery, ignoreText: strip ? nameText(scope) : undefined });

const variants: Record<string, ReturnType<typeof evaluate>> = {
  bm25Plain: evaluate(bm25(false, false)),
  bm25AspectGlossary: evaluate(bm25(true, true)),
};

let embedding: { model: string; seconds: number } | undefined;
if (values.model) {
  const started = performance.now();
  const embedder = await createLocalEmbedder(values.model);
  const vectors = await cachedPassageVectors(embedder, chunks.map((chunk) => ({ id: chunk.id, text: passageText(chunk) })));
  const dense = buildDenseIndex(chunks, vectors);
  const raw = await embedder.embedQueries(cases.map((item) => item.question));
  const aspect = await embedder.embedQueries(cases.map((item) => stripNames(item.question, nameText(item.scope))));
  embedding = { model: embedder.model, seconds: Math.round((performance.now() - started) / 1000) };
  const denseOnly = (queries: Float32Array[]): Retriever => (_question, scope, index) => {
    const perSlug = Math.ceil(limit / scope.length);
    const lists = scope.map((slug) => retrieveDense(dense, queries[index]!, { slugs: [slug], limit: perSlug }));
    const merged: RetrievedChunk[] = [];
    for (let rank = 0; rank < perSlug; rank += 1) for (const list of lists) if (list[rank]) merged.push(list[rank]!);
    return merged.slice(0, limit);
  };
  const hybrid = (queries: Float32Array[], weights?: [number, number]): Retriever => (question, scope, index) =>
    retrieveHybrid(lexical, dense, question, queries[index]!, { slugs: scope, limit, expandPolishQuery: true, ignoreText: nameText(scope), weights });
  Object.assign(variants, {
    denseRaw: evaluate(denseOnly(raw)),
    denseAspect: evaluate(denseOnly(aspect)),
    hybridRaw: evaluate(hybrid(raw)),
    hybridAspect: evaluate(hybrid(aspect)),
    hybridAspectDense2x: evaluate(hybrid(aspect, [1, 2])),
  });
}

const byTag = (results: CaseResult[]) => Object.fromEntries([...new Set(results.flatMap((result) => result.tags))].sort()
  .map((tag) => [tag, summarize(results.filter((result) => result.tags.includes(tag)))]));
const report = {
  date: new Date().toISOString().slice(0, 10), chunkerVersion: CHUNKER_VERSION, embedding,
  corpus: { sha256: corpus.sha256, reviewDocuments: corpus.documents.filter((doc) => doc.kind === 'racket_review').length, detailFiles, chunks: chunks.length,
    approxTokens: chunks.reduce((sum, chunk) => sum + chunk.approxTokens, 0), kinds },
  golden: { file: values.golden, cases: cases.length },
  results: Object.fromEntries(Object.entries(variants).map(([name, results]) => [name, { overall: summarize(results), byTag: byTag(results),
    misses: results.filter((result) => result.firstHitRank === null || result.firstHitRank > 5).map((result) => `${result.id}@${result.firstHitRank ?? '-'}`) }])),
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (values.verbose) {
  const best = variants.hybridAspect ?? variants.bm25AspectGlossary!;
  for (const result of best) process.stdout.write(`${String(result.firstHitRank ?? '-').padStart(2)} ${result.id.padEnd(28)} ${result.top.join(' | ')}\n`);
}
if (values.out) { await mkdir(resolve(values.out, '..'), { recursive: true }); await writeFile(values.out, JSON.stringify(report, null, 2) + '\n'); }
