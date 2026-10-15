import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildLexicalIndex, chunkReviewDetail, chunkReviewMarkdown, parseGoldenJsonl, retrieveBalanced, scoreCase, summarize,
  CHUNKER_VERSION, type CaseResult, type ReviewChunk } from '@padlownia/ai';
import { catalogueLinks, parseKnowledge } from './knowledge.js';

/**
 * Offline retrieval eval over the private local corpus. No network, no model calls, no cost.
 * Writes only aggregate metrics and case IDs/ranks (never source text), so results can be committed.
 */
const { values } = parseArgs({ options: {
  file: { type: 'string', default: 'sources/LLM FULL TEXT.txt' },
  catalogue: { type: 'string', default: 'sources/rackets.json' },
  details: { type: 'string', default: '.local/knowledge/review-details' },
  golden: { type: 'string', default: 'evals/retrieval/golden-v0.jsonl' },
  limit: { type: 'string', default: '5' },
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

const index = buildLexicalIndex(chunks);
const cases = parseGoldenJsonl(await readFile(values.golden, 'utf8'));
const limit = Number(values.limit);
const kinds: Record<string, number> = {};
for (const chunk of chunks) kinds[chunk.kind] = (kinds[chunk.kind] ?? 0) + 1;

// What a resolver knows about the rackets it matched: brand plus slug words (stand-in for display names).
const nameText = (slugs: string[]) => slugs.map((slug) => { const link = links.find((item) => item.slug === slug); return `${link?.brand ?? ''} ${slug.replace(/-review$/, '').replace(/-/g, ' ')}`; }).join(' ');
const run = (expandPolishQuery: boolean, stripNames: boolean) => cases.map((item): CaseResult & { top: string[] } => {
  const results = retrieveBalanced(index, item.question, { slugs: item.scope, limit, expandPolishQuery, ignoreText: stripNames ? nameText(item.scope) : undefined });
  return { ...scoreCase(item, results), top: results.map((result) => `${result.chunk.slug.slice(0, 18)}:${result.chunk.kind}`) };
});
const variants = { plain: run(false, false), polishGlossary: run(true, false), aspectOnly: run(false, true), aspectOnlyPolishGlossary: run(true, true) };
const byTag = (results: CaseResult[]) => Object.fromEntries([...new Set(results.flatMap((result) => result.tags))].sort()
  .map((tag) => [tag, summarize(results.filter((result) => result.tags.includes(tag)))]));

const report = {
  date: new Date().toISOString().slice(0, 10), chunkerVersion: CHUNKER_VERSION, retriever: 'bm25-lexical-v1', limit,
  corpus: { sha256: corpus.sha256, reviewDocuments: corpus.documents.filter((doc) => doc.kind === 'racket_review').length, detailFiles, chunks: chunks.length,
    approxTokens: chunks.reduce((sum, chunk) => sum + chunk.approxTokens, 0), kinds },
  golden: { file: values.golden, cases: cases.length },
  results: Object.fromEntries(Object.entries(variants).map(([name, results]) => [name, { overall: summarize(results), byTag: byTag(results),
    misses: results.filter((result) => result.firstHitRank === null).map((result) => result.id) }])),
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (values.verbose) for (const result of variants.aspectOnlyPolishGlossary) process.stdout.write(`${String(result.firstHitRank ?? '-').padStart(2)} ${result.id.padEnd(28)} ${result.top.join(' | ')}\n`);
if (values.out) { await mkdir(resolve(values.out, '..'), { recursive: true }); await writeFile(values.out, JSON.stringify(report, null, 2) + '\n'); }
