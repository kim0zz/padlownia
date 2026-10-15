import Link from 'next/link';
import { claimLabel, formatWeight, isUnverifiedClaim, shapeLabels } from '../lib/catalogue';
import { AddToComparison } from './comparison-selection';
import { racketLabel } from '../lib/comparison';
import { displayBrand, displayModel, displayVariant } from '../lib/display';
import { ImageCredit, RacketVisual } from './racket-visual';
import { approvedImageFor, type IllustratedCatalogueEntry, type PublicRacketImage } from '../lib/catalogue-images';
import { Badge } from './ui/badge';
import { SourceInfo } from './ui/source-info';

export { SourceCitation, SourceLicenceNotice } from './evidence';

export function Arrow({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={direction === 'left' ? 'arrow-left' : ''}><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** The Supabase notice is technical information: shown only in developer mode. Fixture data is always labelled. */
export function ModeNotice({ mode, dev = false }: { mode: 'fixture' | 'supabase'; dev?: boolean }) {
  if (mode === 'supabase' && !dev) return null;
  return <aside className={`mode-notice ${mode === 'fixture' ? 'fixture-notice' : ''}`} aria-label="Pochodzenie danych">
    <span className="status-dot" aria-hidden="true" />
    {mode === 'fixture' ? <p><strong>Dane demonstracyjne.</strong> Syntetyczne rakiety i źródła do testów interfejsu. Nie opisują rzeczywistych produktów.</p>
      : <p><strong>Supabase Dev.</strong> Wyświetlamy wyłącznie zatwierdzoną, opublikowaną wersję katalogu developerskiego.</p>}
  </aside>;
}

export function Unavailable({ setup }: { setup: boolean }) {
  return <section className="empty-state" role="status">
    <h2>{setup ? 'Katalog czeka na podłączenie danych.' : 'Nie udało się pobrać katalogu.'}</h2>
    <p>{setup ? 'Środowisko developerskie nie ma jeszcze poprawnej konfiguracji źródła danych. Instrukcja uruchomienia znajduje się w README projektu.' : 'Opublikowane dane są chwilowo niedostępne. Spróbuj ponownie za chwilę.'}</p>
    <Link href="/" className="button button-secondary">Odśwież katalog <Arrow /></Link>
  </section>;
}

/** One line of key facts ("Okrągła · 360–375 g") with the shared source popover; the details stay one click away. */
function CardFacts({ entry, image }: { entry: IllustratedCatalogueEntry; image?: PublicRacketImage }) {
  const shapeSpec = entry.specs.find((spec) => spec.selected && spec.key === 'shape');
  const weightSpec = entry.specs.find((spec) => spec.selected && (spec.key === 'weight' || spec.key === 'weight_g'));
  const facts = [
    entry.shape ? shapeLabels[entry.shape] ?? entry.shape : null,
    entry.weightMinG !== null || entry.weightMaxG !== null ? formatWeight(entry.weightMinG, entry.weightMaxG) : null,
  ].filter((fact): fact is string => fact !== null);
  const sources = ([['Kształt', shapeSpec], ['Masa', weightSpec]] as const).flatMap(([name, spec]) => spec ? [{ evidence: spec.evidence, claim: `${name}: ${claimLabel(spec)}` }] : []);
  const unverified = [shapeSpec, weightSpec].some((spec) => spec && isUnverifiedClaim(spec));
  return <>
    <div className="card-facts">
      <p className={facts.length ? 'card-facts-text' : 'card-facts-text muted'}>{facts.length ? facts.join(' · ') : 'Kształt i masa nieustalone'}</p>
      {(sources.length > 0 || image) && <SourceInfo label="Źródło: kształt i masa" items={sources}>
        {image && <p className="source-info-image">Zdjęcie: <ImageCredit image={image} /></p>}
      </SourceInfo>}
    </div>
    {unverified && <Badge tone="warning"><span title="Przypisane producentowi — niezweryfikowane">Niezweryfikowane</span></Badge>}
  </>;
}

/** Catalogue card; also the `racket_card` block of the structured view. The whole card opens the profile via a stretched link. `comparable={false}` omits the selection button (component gallery). */
export function RacketCard({ entry, comparable = true }: { entry: IllustratedCatalogueEntry; comparable?: boolean }) {
  const hasConflict = entry.specs.some((spec) => spec.conflict);
  const image = approvedImageFor(entry);
  const ratingSources = [...new Set(entry.ratings.map((rating) => rating.evidence.sourceName))];
  const variant = displayVariant(entry.variant);
  return <article className="racket-card">
    <div className="card-top">
      <p className="racket-brand">{displayBrand(entry.brand)}</p>
      {entry.modelYear === null ? <Badge tone="warning">Rok nieznany</Badge> : <Badge>{entry.modelYear}</Badge>}
    </div>
    <div className="card-main">
      <div className="card-name">
        <h3><Link href={`/rakiety/${encodeURIComponent(entry.id)}`} aria-label={`Zobacz profil ${entry.brand} ${entry.model} ${entry.variant ?? ''} ${entry.modelYear ?? 'rok nieznany'}`}>{displayModel(entry)}</Link></h3>
        <p className={variant ? 'racket-variant' : 'racket-variant muted'}>{variant ?? 'wariant nieustalony'}</p>
      </div>
      {image && <RacketVisual compact entry={{ image }} />}
    </div>
    <CardFacts entry={entry} image={image} />
    <p className="card-ratings">{ratingSources.length ? `Oceny: ${ratingSources.join(', ')}` : 'Brak ocen'}</p>
    {hasConflict && <Badge tone="warning">Rozbieżne źródła</Badge>}
    {comparable && <AddToComparison id={entry.id} releaseId={entry.releaseId} label={racketLabel(entry)} compact />}
  </article>;
}
