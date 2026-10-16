import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { ASPECT_IDS, coveredAspects, detectAspects, parseGoldenJsonl, stripNames, structuredEvidence, type Aspect, type StructuredEntry } from '@padlownia/ai';

/**
 * Offline eval of the structured-data path: (1) does the question → aspect mapping find the expected
 * aspects, (2) does the published catalogue hold numbers/specs for them for the resolved rackets.
 * Input catalogue: a local export of published_catalogue() (private, ignored). No network, no cost.
 */
const { values } = parseArgs({ options: {
  catalogue: { type: 'string', default: '.local/catalogue-snapshot.json' },
  golden: { type: 'string', default: 'evals/retrieval/golden-v0.jsonl' },
  aspects: { type: 'string', default: 'evals/structured/aspects-v0.jsonl' },
  out: { type: 'string' },
  verbose: { type: 'boolean', default: false },
} });

const entries = JSON.parse((await readFile(values.catalogue, 'utf8')).replace(/^\uFEFF/, '')) as StructuredEntry[];
const cases = parseGoldenJsonl(await readFile(values.golden, 'utf8'));
const labelSchema = z.strictObject({ id: z.string(), aspects: z.array(z.enum(ASPECT_IDS)) });
const labels = new Map((await readFile(values.aspects, 'utf8')).split(/\r?\n/).filter((line) => line.trim() && !line.startsWith('//'))
  .map((line) => labelSchema.parse(JSON.parse(line))).map((label) => [label.id, label.aspects]));

// Golden cases name padel.how slugs; catalogue entries are canonical IDs. Link them through the review URL.
type Evidence = { evidence: { sourceUrl?: string | null } };
const bySlug = (slug: string) => entries.find((entry) => [...entry.ratings, ...entry.specs].some((item) =>
  (item as unknown as Evidence).evidence.sourceUrl === `https://padel.how/equipment/racket/${slug}/`));

let expectedTotal = 0, detectedCorrect = 0, detectedTotal = 0, exact = 0, answerable = 0, partiallyAnswerable = 0, needsProse = 0;
const rows: { id: string; expected: Aspect[]; detected: Aspect[]; covered: string; evidence: number }[] = [];
for (const item of cases) {
  const expected = labels.get(item.id);
  if (!expected) throw new Error(`MISSING_ASPECT_LABEL ${item.id}`);
  const rackets = item.scope.map(bySlug);
  if (rackets.some((entry) => !entry)) throw new Error(`RACKET_NOT_IN_CATALOGUE ${item.id}`);
  // As in the pipeline: the resolver has matched the rackets, so their names are removed before aspect detection
  // ("Ventus Control" or "Power+" in a name is not a question about control or power).
  const names = rackets.map((entry) => `${entry!.brand} ${entry!.model} ${entry!.variant} ${entry!.modelYear ?? ''}`).join(' ');
  const detected = detectAspects(stripNames(item.question, names));
  expectedTotal += expected.length; detectedTotal += detected.length;
  detectedCorrect += detected.filter((aspect) => expected.includes(aspect)).length;
  if (expected.every((aspect) => detected.includes(aspect)) && detected.every((aspect) => expected.includes(aspect))) exact += 1;

  // Answerable from data = every expected aspect has a value for every racket in the question.
  const perAspect = expected.map((aspect) => rackets.every((entry) => coveredAspects(entry!, [aspect]).length === 1));
  if (!expected.length) needsProse += 1;
  else if (perAspect.every(Boolean)) answerable += 1;
  else if (perAspect.some(Boolean)) partiallyAnswerable += 1;
  else needsProse += 1;
  const evidence = rackets.reduce((sum, entry) => sum + structuredEvidence(entry!, expected).length, 0);
  rows.push({ id: item.id, expected, detected, covered: expected.length ? perAspect.map((ok) => ok ? '✓' : '✗').join('') : 'proza', evidence });
}

const round = (value: number) => Math.round(value * 1000) / 1000;
const report = {
  date: new Date().toISOString().slice(0, 10), mapping: 'aspects-v1', cases: cases.length, catalogueEntries: entries.length,
  aspectDetection: { precision: round(detectedCorrect / Math.max(1, detectedTotal)), recall: round(detectedCorrect / Math.max(1, expectedTotal)), exactMatch: round(exact / cases.length) },
  dataCoverage: { fullyAnswerableFromData: answerable, partiallyFromData: partiallyAnswerable, proseOnly: needsProse },
  perCase: rows,
};
process.stdout.write(JSON.stringify({ ...report, perCase: undefined }, null, 2) + '\n');
if (values.verbose) for (const row of rows) process.stdout.write(`${row.id.padEnd(28)} expected=${row.expected.join(',') || '-'} detected=${row.detected.join(',') || '-'} data=${row.covered} items=${row.evidence}\n`);
if (values.out) { await mkdir(resolve(values.out, '..'), { recursive: true }); await writeFile(values.out, JSON.stringify(report, null, 2) + '\n'); }
