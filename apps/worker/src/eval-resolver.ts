import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { RacketResolver, type Resolution } from '@padlownia/ai';

/** Offline eval of the racket mention resolver against padel.how catalogue names. No network, no cost. */
const { values } = parseArgs({ options: {
  catalogue: { type: 'string', default: 'sources/rackets.json' },
  golden: { type: 'string', default: 'evals/resolver/golden-v0.jsonl' },
  out: { type: 'string' },
} });

const expectation = z.union([z.strictObject({ id: z.string() }), z.strictObject({ ambiguous: z.array(z.string()).min(2) }), z.strictObject({ none: z.literal(true) })]);
const caseSchema = z.strictObject({ id: z.string(), question: z.string(), expect: z.array(expectation).min(1) });
const cases = (await readFile(values.golden, 'utf8')).split(/\r?\n/).filter((line) => line.trim() && !line.startsWith('//')).map((line) => caseSchema.parse(JSON.parse(line)));

const catalogue = JSON.parse(await readFile(values.catalogue, 'utf8')) as { rackets: { slug: string; brand: string; name: string; year: unknown }[] };
const resolver = new RacketResolver(catalogue.rackets.map((row) => ({
  id: row.slug, brand: row.brand, name: row.name, year: Number.isInteger(row.year) ? row.year as number : null,
})));

const passes = (actual: Resolution, expected: z.infer<typeof expectation>) => {
  if ('id' in expected) return actual.status === 'resolved' && actual.id === expected.id;
  // A best guess with the other expected options offered as alternatives also lets the user choose.
  const offered = actual.status === 'ambiguous' ? actual.ids : actual.status === 'resolved' ? [actual.id, ...actual.alternatives] : [];
  if ('ambiguous' in expected) return expected.ambiguous.every((id) => offered.includes(id));
  return actual.status === 'not_found';
};
const results = cases.map((item) => {
  const actual = resolver.resolveAll(item.question);
  const ok = actual.length === item.expect.length && item.expect.every((expected, index) => passes(actual[index]!, expected));
  return { id: item.id, ok, actual: actual.map((entry) => entry.status === 'resolved' ? `${entry.id}${entry.alternatives.length ? ` (+${entry.alternatives.join(',')})` : ''}` :entry.status === 'ambiguous' ? `ambiguous[${entry.ids.join(',')}]` : 'not_found') };
});
const report = { date: new Date().toISOString().slice(0, 10), resolver: 'deterministic-v1', cases: results.length,
  accuracy: Math.round(results.filter((result) => result.ok).length / results.length * 1000) / 1000,
  failures: results.filter((result) => !result.ok) };
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (values.out) { await mkdir(resolve(values.out, '..'), { recursive: true }); await writeFile(values.out, JSON.stringify(report, null, 2) + '\n'); }
