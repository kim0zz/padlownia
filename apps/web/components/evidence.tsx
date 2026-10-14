import type { CatalogueEntry, CatalogueEvidence, CatalogueRating } from '@padlownia/database';
import { formatDate, methodologyCitation, safeSourceUrl } from '../lib/catalogue';

/** Source data is rendered as text and vetted links, never as executable markup. */
export function SourceCitation({ evidence }: { evidence: CatalogueEvidence }) {
  const href = safeSourceUrl(evidence.sourceUrl);
  const attributionHref = safeSourceUrl(evidence.attribution?.url);
  return <span className="source-citation">
    {href
      ? <a className="source-link" href={href} rel="noreferrer">{evidence.sourceName} <span aria-hidden="true">↗</span></a>
      : <span className="source-label">{evidence.sourceName}</span>}
    {attributionHref && attributionHref !== href && <a className="source-link attribution-link" href={attributionHref} rel="noreferrer">
      {evidence.attribution?.name ?? 'Źródło parametru'} <span aria-hidden="true">↗</span>
    </a>}
  </span>;
}

export function RatingCitation({ rating }: { rating: CatalogueRating }) {
  const methodology = methodologyCitation(rating.methodology);
  return <>
    {methodology.url && <p><a className="source-link" href={methodology.url} rel="noreferrer">Metodologia ocen — {rating.evidence.sourceName}</a></p>}
    {methodology.note ? <p>{methodology.note}</p> : !methodology.url && <p>Metodologia nie została podana.</p>}
    <div className="observation-source"><SourceCitation evidence={rating.evidence} /><span>Pobrano {formatDate(rating.evidence.retrievedAt)}</span></div>
  </>;
}

export function SourceLicenceNotice({ entries }: { entries: CatalogueEntry[] }) {
  const hasPadelTrue = entries.some((entry) => [...entry.specs, ...entry.ratings].some((item) => item.evidence.sourceCode === 'padeltrue'));
  if (!hasPadelTrue) return null;
  return <aside className="source-licence" aria-label="Licencja danych PadelTrue">
    <p>Dane <a href="https://padeltrue.com/" rel="noreferrer">PadelTrue</a> udostępniono na licencji <a href="https://creativecommons.org/licenses/by/4.0/" rel="noreferrer">CC BY 4.0</a>. Padłownia normalizuje nazwy, jednostki i strukturę danych; oryginalne obserwacje zachowują wskazanie źródła.</p>
  </aside>;
}
