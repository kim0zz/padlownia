import Link from 'next/link';
import type { CatalogueEntry } from '@padlownia/database';
import { comparisonRatingRows, comparisonRatingSources, comparisonRows, racketLabel, rowDiffers } from '../lib/comparison';
import { displayBrand, displayModel, identityDetails } from '../lib/display';
import { groupMethodology, ratingDimensionLabels, sortDimensions } from '../lib/ratings';
import { approvedImageFor } from '../lib/catalogue-images';
import { ObservationDetails } from './racket-details';
import { ImageCredit, RacketVisual } from './racket-visual';
import { RemoveComparisonItem } from './comparison-selection';
import { ChangePairLink } from './change-pair-link';
import { SpecValueCell } from './spec-value-cell';
import { RatingEntry, RatingGroupHeader } from './rating-parts';

type Row = ReturnType<typeof comparisonRows>[number];
const columns = ['a', 'b'] as const;

function ColumnMark({ column }: { column: 'a' | 'b' }) {
  return <span className="column-mark" data-column={column} aria-hidden="true">{column.toUpperCase()}</span>;
}

/** Sticky identity bar: stays under the site header while the parameters scroll. */
function ComparisonHeader({ entries }: { entries: readonly [CatalogueEntry, CatalogueEntry] }) {
  return <div className="comparison-header" role="group" aria-label="Porównywane rakiety">
    <div className="comparison-header-corner"><ChangePairLink /></div>
    {entries.map((entry, index) => {
      const column = columns[index]!;
      const image = approvedImageFor(entry);
      return <div key={entry.id} className="comparison-header-cell" data-column={column}>
        {image && <RacketVisual compact entry={{ image }} />}
        <div className="comparison-header-copy">
          <p className="comparison-header-name"><ColumnMark column={column} /><span className="comparison-header-brand">{displayBrand(entry.brand)}</span> <Link href={`/rakiety/${encodeURIComponent(entry.id)}`}>{displayModel(entry)}</Link></p>
          {identityDetails(entry).length > 0 && <p className="comparison-identity-meta">{identityDetails(entry).join(' · ')}</p>}
        </div>
        <RemoveComparisonItem id={entry.id} label={racketLabel(entry)} />
      </div>;
    })}
  </div>;
}

function SpecComparisonTable({ rows, entries, dev }: { rows: Row[]; entries: readonly [CatalogueEntry, CatalogueEntry]; dev: boolean }) {
  return <section className="comparison-specs" aria-labelledby="comparison-specs-title">
    <div className="comparison-section-heading"><h2 id="comparison-specs-title">Parametry</h2></div>
    <div className="comparison-toolbar">
      <label className="only-diff"><input type="checkbox" id="only-diff" className="only-diff-toggle" /> Tylko różnice</label>
      <p className="comparison-legend"><span className="diff-dot" aria-hidden="true" /> różnica między rakietami</p>
    </div>
    {!rows.some(rowDiffers) && <p className="comparison-no-diff">Parametry są takie same</p>}
    <div className="comparison-table">
      {rows.map((row) => {
        const differs = rowDiffers(row);
        return <section className="comparison-row" key={row.key} aria-label={row.label} data-differs={differs ? 'true' : undefined}>
          <h3 className="comparison-row-label">{differs && <span className="diff-dot" aria-hidden="true" />}{row.label}{differs && <span className="sr-only"> (różnica)</span>}</h3>
          {row.cells.map((cell, index) => <div className="comparison-cell" key={cell.entryId} data-column={columns[index]} aria-label={`${row.label}: ${racketLabel(entries[index]!)}`}>
            <SpecValueCell specs={cell.selected} observations={cell.observations} specLabel={row.label} dev={dev} />
          </div>)}
        </section>;
      })}
    </div>
  </section>;
}

function RatingComparison({ left, right, dev }: { left: CatalogueEntry; right: CatalogueEntry; dev: boolean }) {
  const entries = [left, right] as const;
  const sources = comparisonRatingSources(left, right);
  return <section className="comparison-ratings" aria-labelledby="comparison-ratings-title">
    <div className="comparison-section-heading"><h2 id="comparison-ratings-title">Oceny</h2><span>Każde źródło ma własną skalę i metodę. Skal nie łączymy ani nie uśredniamy.</span></div>
    {sources.length === 0 && <p className="no-ratings">Brak opublikowanych ocen dla obu rakiet.</p>}
    {sources.map((source) => {
      const ratings = source.cells.flatMap((cell) => cell.ratings);
      const group = groupMethodology(ratings);
      const rows = comparisonRatingRows(source);
      const order = sortDimensions(rows.map((row) => row.dimension));
      return <section className="comparison-rating-source" key={source.code} aria-label={`Oceny: ${source.name}`}>
        <RatingGroupHeader sourceName={source.name} ratings={ratings} />
        {order.map((dimension) => rows.find((row) => row.dimension === dimension)!).map((row) => {
          const label = ratingDimensionLabels[row.dimension] ?? row.dimension;
          return <div className="comparison-rating-row" key={row.dimension} data-dimension={row.dimension}>
            <p className="comparison-row-label">{label}</p>
            {row.cells.map((cell, index) => <div key={cell.entryId} className="comparison-rating-cell" data-column={columns[index]} aria-label={`${label}: ${racketLabel(entries[index]!)}`}>
              {cell.ratings.length ? cell.ratings.map((rating) => <RatingEntry key={rating.evidence.observationId} rating={rating} group={group} tone={columns[index]!} label={label} dev={dev} />) : <p className="comparison-unknown">brak oceny</p>}
            </div>)}
          </div>;
        })}
      </section>;
    })}
  </section>;
}

/** Every original observation of both rackets stays one click away, including raw values and measurement context. */
function AllObservations({ rows, entries, dev }: { rows: Row[]; entries: readonly [CatalogueEntry, CatalogueEntry]; dev: boolean }) {
  const withObservations = rows.filter((row) => row.cells.some((cell) => cell.observations.length > 0));
  const total = withObservations.reduce((sum, row) => sum + row.cells.reduce((inner, cell) => inner + cell.observations.length, 0), 0);
  if (total === 0) return null;
  return <details className="comparison-all-observations">
    <summary>Wszystkie obserwacje źródeł ({total})</summary>
    {withObservations.map((row) => <div className="all-observations-row" key={row.key} data-spec={row.key}>
      <h3 className="all-observations-label">{row.label}</h3>
      <div className="all-observations-columns">
        {row.cells.map((cell, index) => <div key={cell.entryId} data-column={columns[index]}>
          <p className="all-observations-who"><ColumnMark column={columns[index]!} />{racketLabel(entries[index]!)}</p>
          {cell.observations.length ? <div className="observation-list">
            {cell.observations.map((spec) => <ObservationDetails key={spec.evidence.observationId} spec={spec} releaseId={entries[index]!.releaseId} dev={dev} />)}
          </div> : <p className="comparison-unknown">Brak obserwacji</p>}
        </div>)}
      </div>
    </div>)}
  </details>;
}

export function RacketComparison({ left, right, dev = false }: { left: CatalogueEntry; right: CatalogueEntry; dev?: boolean }) {
  const entries = [left, right] as const;
  const rows = comparisonRows(left, right);
  const credits = entries.flatMap((entry, index) => { const image = approvedImageFor(entry); return image ? [{ column: columns[index]!, image }] : []; });
  return <section className="racket-comparison" aria-label="Zestawienie dwóch rakiet">
    <ComparisonHeader entries={entries} />
    <SpecComparisonTable rows={rows} entries={entries} dev={dev} />
    <RatingComparison left={left} right={right} dev={dev} />
    <AllObservations rows={comparisonRows(left, right, true)} entries={entries} dev={dev} />
    {credits.length > 0 && <p className="comparison-image-credits">Zdjęcia: {credits.map(({ column, image }, index) => <span key={column}>{index > 0 && '; '}{column.toUpperCase()} — <ImageCredit image={image} /></span>)}</p>}
    {dev && <details className="comparison-release"><summary>Wersja porównywanych danych</summary><p>{left.releaseId}</p><p>Obie rakiety pochodzą z jednej publikacji katalogu. Stare odnośniki wymagają świadomego odświeżenia po kolejnej publikacji.</p></details>}
  </section>;
}
