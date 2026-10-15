import type { CatalogueRating } from '@padlownia/database';
import { methodologyCitation, rawText, ratingLabels, safeSourceUrl } from '../lib/catalogue';
import { groupKindLabel, groupMethodology, groupScaleLabel, isIncompleteModel, ratingDimensionLabels } from '../lib/ratings';
import { Badge } from './ui/badge';
import { SourceInfo } from './ui/source-info';

/**
 * Header of the ratings of one source: scale, kind, methodology link and the caveat shared by
 * the whole group, stated once. Ratings of one source are never merged with another source's.
 */
export function RatingGroupHeader({ sourceName, ratings }: { sourceName: string; ratings: CatalogueRating[] }) {
  const { url, sharedNote, hasDistinctNotes } = groupMethodology(ratings);
  const href = safeSourceUrl(url);
  return <header className="rating-group-header">
    <h3 className="rating-group-title">{sourceName}</h3>
    <p className="rating-group-meta">
      <span>{groupScaleLabel(ratings)}</span><span aria-hidden="true"> · </span><span>{groupKindLabel(ratings)}</span>
      {href && <><span aria-hidden="true"> · </span><a className="source-link" href={href} rel="noreferrer">Metodologia<span className="sr-only"> ocen — {sourceName}</span> <span aria-hidden="true">↗</span></a></>}
      {ratings.some(isIncompleteModel) && <Badge tone="warning">Niepełne dane modelu</Badge>}
    </p>
    {sharedNote && <p className="rating-group-note">{sharedNote}</p>}
    {hasDistinctNotes && <p className="rating-group-note">Zastrzeżenia metodologii różnią się między ocenami — są przy każdej ocenie.</p>}
    {!href && !sharedNote && !hasDistinctNotes && <p className="rating-group-note">Metodologia nie została podana.</p>}
  </header>;
}

/** The number in the source's own scale. An unverified interpretation is "Nieustalona", never a guess. */
export function RatingValue({ rating }: { rating: CatalogueRating }) {
  return <p className="rating-value">
    {rating.validationStatus === 'valid' && rating.value !== null
      ? <>{rating.value}<span className="rating-scale"> / {rating.scaleMax ?? '?'}</span></>
      : 'Nieustalona'}
    {isIncompleteModel(rating) && <><span aria-hidden="true">*</span><span className="sr-only"> niepełne dane modelu</span></>}
  </p>;
}

/** Source popover of one rating: kind, citation, scale and original value, plus caveats that are not shared by the group. */
export function RatingSourceInfo({ rating, group, dev = false, label }: { rating: CatalogueRating; group: ReturnType<typeof groupMethodology>; dev?: boolean; label?: string }) {
  const dimension = ratingDimensionLabels[rating.dimension] ?? rating.dimension;
  const methodology = methodologyCitation(rating.methodology);
  const ownHref = methodology.url !== group.url ? safeSourceUrl(methodology.url) : null;
  const ownNote = group.hasDistinctNotes && methodology.note ? methodology.note : null;
  return <SourceInfo label={label ?? `Źródło oceny: ${dimension}`} items={[{ evidence: rating.evidence, claim: ratingLabels[rating.kind] ?? 'Ocena źródła' }]} dev={dev}>
    <p>{`Skala źródła: ${rating.scaleMin ?? '?'}–${rating.scaleMax ?? '?'}. Oryginał: ${rawText(rating.rawValue)}.`}</p>
    {rating.validationStatus !== 'valid' && <p>Interpretacja oceny niepotwierdzona.</p>}
    {ownHref && <p><a className="source-link" href={ownHref} rel="noreferrer">Metodologia ocen ↗</a></p>}
    {ownNote && <p className="source-info-note">{ownNote}</p>}
  </SourceInfo>;
}
