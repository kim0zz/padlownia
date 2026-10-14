import Link from 'next/link';
import type { CatalogueEntry } from '@padlownia/database';
import { claimLabel } from '../lib/catalogue';
import { comparisonRows, comparisonRatingRows, comparisonRatingSources, racketLabel, specDisplayValue } from '../lib/comparison';
import { SourceCitation } from './evidence';
import { ObservationDetails, RatingCard } from './racket-details';

export function RacketComparison({ left, right }: { left: CatalogueEntry; right: CatalogueEntry }) {
  const entries = [left, right];
  const ratingSources = comparisonRatingSources(left, right);
  return <section className="racket-comparison" aria-label="Zestawienie dwóch rakiet">
    <div className="comparison-pair comparison-identities">{entries.map((entry, index) => <div key={entry.id} className="comparison-identity">
      <span className="section-kicker">RAKIETA {index + 1} · {entry.modelYear ?? 'ROK NIEZNANY'}</span>
      <p className="racket-brand">{entry.brand}</p><h2><Link href={`/rakiety/${encodeURIComponent(entry.id)}`}>{entry.model}</Link></h2>
      <p>{entry.variant || 'Wariant nieustalony'}</p>
      {entry.modelYear === null && <span className="conflict-label">Rocznik niepotwierdzony</span>}
    </div>)}</div>
    <div className="comparison-section-heading"><h2>Parametry ze źródłami</h2><p>Wartości wybrane w opublikowanym katalogu. Rozwiń obserwacje, aby sprawdzić rozbieżności i kontekst pomiarów.</p></div>
    {comparisonRows(left, right).map((row) => <section className="comparison-row" key={row.key} aria-label={row.label}>
      <h3>{row.label}</h3><div className="comparison-pair">{row.cells.map((cell, index) => <div className="comparison-cell" key={cell.entryId} aria-label={`${row.label}: ${racketLabel(entries[index]!)}`}>
        <span className="comparison-column-label">Rakieta {index + 1}</span>
        {cell.selected.length ? cell.selected.map((spec) => <div className="comparison-value" key={spec.evidence.observationId}>
          <strong>{specDisplayValue(spec)}</strong><small>{claimLabel(spec)}</small><SourceCitation evidence={spec.evidence} />
        </div>) : <p className="comparison-unknown">Brak danych</p>}
        {cell.observations.some((spec) => spec.conflict) && <p><span className="conflict-label">Rozbieżne źródła</span></p>}
        {cell.observations.length > 0 && <details className="comparison-observations"><summary>Obserwacje ({cell.observations.length})</summary>
          <div className="observation-list">{cell.observations.map((spec) => <ObservationDetails key={spec.evidence.observationId} spec={spec} releaseId={left.releaseId} />)}</div>
        </details>}
      </div>)}</div>
    </section>)}
    <div className="comparison-section-heading"><h2>Oceny poszczególnych źródeł</h2><p>Każda ocena zachowuje własną skalę, rodzaj i metodologię. Nie wyliczamy wspólnej punktacji ani zwycięzcy.</p></div>
    {ratingSources.length === 0 && <p className="no-ratings">Brak opublikowanych ocen dla obu rakiet.</p>}
    {ratingSources.map((source) => <section className="comparison-rating-source" key={source.code} aria-label={`Oceny: ${source.name}`}>
      <h3>{source.name}</h3><div className="comparison-pair">{entries.map((entry, index) => <p className="comparison-column-label" key={entry.id}>Rakieta {index + 1} · {racketLabel(entry)}</p>)}</div>
      {comparisonRatingRows(source).map((row) => <div className="comparison-pair comparison-rating-row" key={row.dimension} data-dimension={row.dimension}>{row.cells.map((cell, index) => <div key={cell.entryId} className="comparison-rating-cell">
        <span className="comparison-column-label">Rakieta {index + 1}</span>
        {cell.ratings.length ? cell.ratings.map((rating) => <RatingCard key={rating.evidence.observationId} rating={rating} />) : <p className="no-ratings">Brak ocen z tego źródła dla tej kategorii.</p>}
      </div>)}</div>)}
    </section>)}
    <details className="comparison-release"><summary>Wersja porównywanych danych</summary><p>{left.releaseId}</p><p>Obie rakiety pochodzą z jednej publikacji katalogu. Stare odnośniki wymagają świadomego odświeżenia po kolejnej publikacji.</p></details>
  </section>;
}
