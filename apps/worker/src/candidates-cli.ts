import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { matchCandidates, yearMismatches, type CandidateRacket } from '@padlownia/domain';
import type { CatalogueEntry } from '@padlownia/database';

// ROADMAP R5: cross-source match candidates from a local export of published_catalogue(). Reads files only;
// nothing is merged. The owner decides in the dev-only review view (R6); a release script applies the decisions.
const help = `candidates --snapshot <catalogue export .json> --out <candidates .json>`;

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { snapshot: { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean' } } });
  if (values.help || !values.snapshot || !values.out) { process.stdout.write(`${help}\n`); if (!values.help) process.exitCode = 1; return; }
  const entries = JSON.parse(await readFile(values.snapshot, 'utf8')) as CatalogueEntry[];
  const releases = new Set(entries.map((entry) => entry.releaseId));
  if (releases.size !== 1) throw new Error('SNAPSHOT_MIXED_RELEASES');
  const rackets: CandidateRacket[] = entries.map((entry) => ({ id: entry.id, brand: entry.brand, model: entry.model, variant: entry.variant, modelYear: entry.modelYear,
    sources: [...new Set([...entry.specs, ...entry.ratings].map((item) => item.evidence.sourceCode))].sort() }));
  const candidates = matchCandidates(rackets);
  const mismatches = yearMismatches(rackets);
  await writeFile(values.out, JSON.stringify({ version: 1, releaseId: [...releases][0], createdAt: new Date().toISOString(), candidates, yearMismatches: mismatches }, null, 1));
  process.stdout.write(`${JSON.stringify({ releaseId: [...releases][0], rackets: rackets.length, candidates: candidates.length, high: candidates.filter((c) => c.confidence === 'high').length,
    ambiguous: candidates.filter((c) => c.ambiguous).length, yearMismatches: mismatches.length })}\n`);
}

main().catch((error: unknown) => { process.stdout.write(`${JSON.stringify({ status: 'failed', code: error instanceof Error ? error.message.slice(0, 80) : 'FAILED' })}\n`); process.exitCode = 1; });
