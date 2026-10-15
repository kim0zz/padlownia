import type { CatalogueEntry } from '@padlownia/database';
import { validateViewPayload } from '../lib/view-contract';
import { RacketCard, SourceLicenceNotice } from './catalogue';
import { RacketComparison } from './racket-comparison';
import { RacketSpecs } from './racket-details';
import { SpecTable } from './spec-table';

// Shared by classic navigation and a future AI adapter. The caller cannot supply
// HTML, values, claims or citations: every block resolves current published IDs.
export function StructuredView({ input, entries, dev = false }: { input: unknown; entries: CatalogueEntry[]; dev?: boolean }) {
  const result = validateViewPayload(input, entries);
  if (!result.ok) return <p className="conflict-notice" role="status">Nie można wyświetlić widoku. Wybierz rakiety z aktualnej wersji katalogu.</p>;
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const usedIds = new Set(result.payload.blocks.flatMap((block) => block.type === 'racket_comparison' ? block.racketIds : [block.racketId]));
  return <>{result.payload.blocks.map((block, index) => {
    if (block.type === 'racket_comparison') return <RacketComparison key={index} left={byId.get(block.racketIds[0])!} right={byId.get(block.racketIds[1])!} dev={dev} />;
    if (block.type === 'racket_specs') { const entry = byId.get(block.racketId)!; return entry.specs.length ? <SpecTable key={index} entry={entry} dev={dev} /> : <RacketSpecs key={index} entry={entry} dev={dev} />; }
    return <RacketCard key={index} entry={byId.get(block.racketId)!} />;
  })}<SourceLicenceNotice entries={entries.filter((entry) => usedIds.has(entry.id))} /></>;
}
