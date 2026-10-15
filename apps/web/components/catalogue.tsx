import Link from 'next/link';
import type { CatalogueEntry } from '@padlownia/database';
import { claimLabel, formatWeight, shapeLabels } from '../lib/catalogue';
import { SourceCitation } from './evidence';
import { AddToComparison } from './comparison-selection';
import { racketLabel } from '../lib/comparison';
import { RacketVisual } from './racket-visual';
import { approvedImageFor } from '../lib/catalogue-images';

export { SourceCitation, RatingCitation, SourceLicenceNotice } from './evidence';

export function Arrow({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={direction === 'left' ? 'arrow-left' : ''}><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function ModeNotice({ mode }: { mode: 'fixture' | 'supabase' }) {
  return <aside className={`mode-notice ${mode === 'fixture' ? 'fixture-notice' : ''}`} aria-label="Pochodzenie danych">
    <span className="status-dot" aria-hidden="true" />
    {mode === 'fixture' ? <p><strong>Dane demonstracyjne.</strong> Syntetyczne rakiety i źródła do testów interfejsu. Nie opisują rzeczywistych produktów.</p>
      : <p><strong>Supabase Dev.</strong> Wyświetlamy wyłącznie zatwierdzoną, opublikowaną wersję katalogu developerskiego.</p>}
  </aside>;
}

export function Unavailable({ setup }: { setup: boolean }) {
  return <section className="empty-state" role="status"><span className="section-kicker">{setup ? 'Konfiguracja katalogu' : 'Połączenie niedostępne'}</span>
    <h2>{setup ? 'Katalog czeka na podłączenie danych.' : 'Nie udało się pobrać katalogu.'}</h2>
    <p>{setup ? 'Środowisko developerskie nie ma jeszcze poprawnej konfiguracji źródła danych. Instrukcja uruchomienia znajduje się w README projektu.' : 'Opublikowane dane są chwilowo niedostępne. Spróbuj ponownie za chwilę.'}</p>
    <Link href="/" className="button button-secondary">Odśwież katalog <Arrow /></Link>
  </section>;
}

export function SpecSummary({ entry, field }: { entry: CatalogueEntry; field: 'shape' | 'weight' }) {
  const source = entry.specs.find((spec) => spec.selected && (spec.key === field || (field === 'weight' && spec.key === 'weight_g')));
  const value = field === 'shape' ? (entry.shape ? shapeLabels[entry.shape] ?? entry.shape : 'Brak danych') : formatWeight(entry.weightMinG, entry.weightMaxG);
  return <div className="spec-summary"><dt>{field === 'shape' ? 'Kształt' : 'Masa'}</dt><dd><span>{value}</span>
    {source ? <><small>{claimLabel(source)}</small><SourceCitation evidence={source.evidence} /></> : <small>Wartość nieustalona</small>}
  </dd></div>;
}

export function RacketCard({ entry, index }: { entry: CatalogueEntry; index: number }) {
  const hasConflict = entry.specs.some((spec) => spec.conflict);
  return <article className="racket-card">
    <div className="card-heading"><span className="card-number">{String(index + 1).padStart(2, '0')}</span><span className="year-badge">{entry.modelYear ?? 'Rok nieznany'}</span></div>
    <p className="racket-brand">{entry.brand}</p>
    <h3><Link href={`/rakiety/${encodeURIComponent(entry.id)}`}>{entry.model}</Link></h3>
    <p className="racket-variant">{entry.variant || 'Wariant nieustalony'}</p>
    <RacketVisual entry={{ image: approvedImageFor(entry) }} />
    <dl className="card-specs"><SpecSummary entry={entry} field="shape" /><SpecSummary entry={entry} field="weight" /></dl>
    <div className="card-bottom">{hasConflict ? <span className="conflict-label">Rozbieżne źródła</span> : <span className="muted">Parametry ze źródłami</span>}
      <Link className="profile-link" href={`/rakiety/${encodeURIComponent(entry.id)}`} aria-label={`Zobacz profil ${entry.brand} ${entry.model} ${entry.variant ?? ''} ${entry.modelYear ?? 'rok nieznany'}`}><Arrow /></Link>
    </div>
    <AddToComparison id={entry.id} releaseId={entry.releaseId} label={racketLabel(entry)} />
  </article>;
}
