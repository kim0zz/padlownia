import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Arrow, ModeNotice, SpecSummary, Unavailable } from '../../../components/catalogue';
import { SourceCitation, SourceLicenceNotice } from '../../../components/evidence';
import { ConflictNotice, RacketSpecs, RatingCard } from '../../../components/racket-details';
import { AddToComparison } from '../../../components/comparison-selection';
import { racketLabel } from '../../../lib/comparison';
import { getCatalogue } from '../../../lib/catalogue-server';

export const dynamic = 'force-dynamic';

export default async function RacketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCatalogue();
  if (result.status !== 'ready') return <main id="main" className="main-shell"><Unavailable setup={result.status === 'setup'} /></main>;
  const entry = result.entries.find((racket) => racket.id === id);
  if (!entry) notFound();
  const related = result.entries.filter((racket) => racket.id !== entry.id && racket.brand === entry.brand && racket.model === entry.model);

  return <main id="main" className="main-shell profile-shell">
    <Link href="/" className="back-link"><Arrow direction="left" /> Wróć do katalogu</Link>
    <ModeNotice mode={result.mode} />
    <section className="profile-hero"><div><p className="eyebrow">{entry.brand} <span className="eyebrow-divider">/</span> {entry.modelYear ?? 'Rocznik nieznany'}</p><h1>{entry.model}</h1><p className="profile-variant">{entry.variant || 'Wariant nieustalony'}</p><p className="profile-description">Ten profil dotyczy dokładnie tego wariantu i rocznika. Parametry innych wersji nie są przenoszone automatycznie.</p><AddToComparison id={entry.id} releaseId={entry.releaseId} label={racketLabel(entry)} /></div>
      <dl className="profile-key-specs"><SpecSummary entry={entry} field="shape" /><SpecSummary entry={entry} field="weight" /></dl>
    </section>
    <ConflictNotice entry={entry} />
    <div className="profile-columns"><section aria-labelledby="spec-title"><div className="section-heading"><div><p className="section-kicker">FAKTY Z KONTEKSTEM</p><h2 id="spec-title">Parametry i źródła</h2></div></div>
      <RacketSpecs entry={entry} />
    </section><aside className="profile-sidebar"><section className="reading-guide"><p className="section-kicker">JAK CZYTAĆ DANE</p><h2>Ta sama rakieta.<br />Różne perspektywy.</h2><ul><li><strong>Deklaracja producenta</strong><span>Podstawowa wartość katalogowa, gdy jest potwierdzona.</span></li><li><strong>Pomiar egzemplarza</strong><span>Dotyczy konkretnej sztuki i jej konfiguracji.</span></li><li><strong>Ocena redakcyjna / algorytm</strong><span>Opisują ocenę źródła, a nie pomiar fizyczny.</span></li></ul></section>
      <section className="missing-specs"><h2>Pozostałe parametry</h2><dl>{[
        { key: 'balance', label: 'Balans od podstawy rączki', value: entry.balanceCm === null ? null : `${entry.balanceCm} cm` },
        { key: 'core', label: 'Rdzeń', value: entry.core },
        { key: 'surface', label: 'Powierzchnia', value: entry.surface },
      ].map((field) => { const observation = entry.specs.find((spec) => spec.selected && (spec.key === field.key || spec.key === `${field.key}_cm`));
        return <div key={field.key}><dt>{field.label}</dt><dd>{field.value ?? 'Brak potwierdzonych danych'}{field.value && observation && <><br /><SourceCitation evidence={observation.evidence} /></>}</dd></div>;
      })}</dl><p>Nie dopowiadamy brakujących jednostek ani parametrów.</p></section>
    </aside></div>
    <section className="ratings-section" aria-labelledby="ratings-title"><p className="section-kicker">PERSPEKTYWA ŹRÓDŁA</p><h2 id="ratings-title">Oceny i metodologia</h2>{entry.ratings.length ? <div className="rating-grid">{entry.ratings.map((rating, index) => <RatingCard key={`${rating.evidence.observationId}-${index}`} rating={rating} />)}</div> : <p className="no-ratings">Brak opublikowanych ocen dla tego wariantu. Nie wyliczamy własnej oceny liczbowej.</p>}</section>
    <SourceLicenceNotice entries={[entry]} />
    {related.length > 0 && <section className="related-section"><h2>Inne warianty i roczniki tej nazwy</h2><p>Każdy z nich ma oddzielny profil i własne źródła.</p><div className="related-links">{related.map((racket) => <Link className="button button-secondary" key={racket.id} href={`/rakiety/${encodeURIComponent(racket.id)}`}>{racket.model} · {racket.variant} · {racket.modelYear ?? 'rok nieznany'} <Arrow /></Link>)}</div></section>}
  </main>;
}
