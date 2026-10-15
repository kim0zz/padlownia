import type { CatalogueEntry, CatalogueRating, CatalogueSpec } from '@padlownia/database';
import { claimLabel, formatDate, ratingLabels, rawText, specLabels } from '../lib/catalogue';
import { RatingCitation, SourceCitation } from './evidence';
import { ratingDimensionLabels, ratingPosition } from '../lib/ratings';
import { specValueText } from './spec-value-cell';
import { Badge } from './ui/badge';
import { Notice } from './ui/notice';

export { ratingDimensionLabels, ratingPosition } from '../lib/ratings';

/** Full observation: the normalised value first, the source's original wording second, then kind, context, citation and (developer mode) the source trail. */
export function ObservationDetails({ spec, releaseId, dev = false }: { spec: CatalogueSpec; releaseId: string; dev?: boolean }) {
  return <article className="observation">
    <div className="observation-title">
      <h3>{specLabels[spec.key] ?? spec.key}</h3>
      <div className="observation-badges">
        {spec.selected && <Badge>Wartość katalogowa</Badge>}
        {spec.conflict && <Badge tone="warning">Rozbieżność</Badge>}
      </div>
    </div>
    <p className="observation-value">{specValueText(spec)}</p>
    <p className="observation-original">Oryginał: <span className="raw-value">{rawText(spec.rawValue)}</span></p>
    <p className="observation-kind">{claimLabel(spec)}</p>
    {Object.keys(spec.measurementContext).length > 0 && <p className="context-note">
      Kontekst: {Object.entries(spec.measurementContext).map(([key, value]) => `${key}: ${rawText(value)}`).join('; ')}
    </p>}
    {spec.validationStatus !== 'valid' && <p className="context-note">Interpretacja niepotwierdzona — zachowano wartość oryginalną.</p>}
    <div className="observation-source"><SourceCitation evidence={spec.evidence} /><span>Pobrano {formatDate(spec.evidence.retrievedAt)}</span></div>
    {dev && <details>
      <summary>Ślad pochodzenia danych</summary>
      <dl className="provenance-details">
        <div><dt>Obserwacja</dt><dd>{spec.evidence.observationId}</dd></div>
        <div><dt>Pole źródłowe</dt><dd>{spec.evidence.path}</dd></div>
        <div><dt>Wersja danych</dt><dd>{releaseId}</dd></div>
      </dl>
    </details>}
  </article>;
}

export function RatingCard({ rating }: { rating: CatalogueRating }) {
  const hasPosition = ratingPosition(rating) !== null;
  return <article className="rating-card">
    <span className="rating-kind">{ratingLabels[rating.kind] ?? 'Ocena źródła'}</span>
    <h3>{ratingDimensionLabels[rating.dimension] ?? rating.dimension}</h3>
    <p className="rating-value">
      {rating.validationStatus === 'valid' && rating.value !== null
        ? <>{rating.value}<span> / {rating.scaleMax ?? '?'}</span></>
        : 'Nieustalona'}
    </p>
    {hasPosition && <meter className="rating-meter" min={rating.scaleMin!} max={rating.scaleMax!} value={rating.value!} aria-label={`${ratingDimensionLabels[rating.dimension] ?? rating.dimension}: ${rating.value} w skali ${rating.scaleMin}–${rating.scaleMax}`} />}
    <p>Skala źródła: {rating.scaleMin ?? '?'}–{rating.scaleMax ?? '?'}. Oryginał: {rawText(rating.rawValue)}.</p>
    {rating.validationStatus !== 'valid' && <p>Interpretacja oceny niepotwierdzona.</p>}
    <RatingCitation rating={rating} />
  </article>;
}

export function ConflictNotice({ entry }: { entry: CatalogueEntry }) {
  if (!entry.specs.some((spec) => spec.conflict)) return null;
  return <Notice tone="warning">
    <p><strong>Źródła podają rozbieżne parametry.</strong> Wartość katalogowa i alternatywne obserwacje pozostają widoczne poniżej. Rozbieżność nie jest uśredniana.</p>
  </Notice>;
}

/** Presentational only: works with an already selected, released exact variant. */
export function RacketSpecs({ entry, dev = false }: { entry: CatalogueEntry; dev?: boolean }) {
  return <div className="observation-list">
    {entry.specs.length
      ? entry.specs.map((spec) => <ObservationDetails key={spec.evidence.observationId} spec={spec} releaseId={entry.releaseId} dev={dev} />)
      : <div className="empty-state compact"><h3>Parametry jeszcze nieustalone.</h3><p>Brak zatwierdzonych obserwacji dla tego wariantu.</p></div>}
  </div>;
}
