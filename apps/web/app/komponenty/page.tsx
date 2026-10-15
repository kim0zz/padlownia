import type { Metadata } from 'next';
import type { CatalogueRating, CatalogueSpec } from '@padlownia/database';
import Link from 'next/link';
import { Arrow, ModeNotice, SpecSummary, Unavailable } from '../../components/catalogue';
import { ConflictNotice, ObservationDetails, RacketSpecs, RatingCard } from '../../components/racket-details';
import { StructuredView } from '../../components/structured-view';
import { ComparisonFeedback, EmptyComparison } from '../../components/comparison-state';
import { fixtureCatalogue } from '../../lib/fixtures';
import { showDevDetails } from '../../lib/dev-ui';

export const dynamic = 'force-dynamic'; // SHOW_DEV_DETAILS is read per request, not frozen at build time.
export const metadata: Metadata = { title: 'Galeria komponentów' };

// This gallery always uses authored synthetic examples, even when the catalogue
// runs in Supabase mode. It neither reads Dev data nor changes racket selection.
export default function ComponentGalleryPage() {
  const dev = showDevDetails();
  const complete = fixtureCatalogue[0]!;
  const conflict = fixtureCatalogue[2]!;
  const unknown = fixtureCatalogue[5]!;
  const measured = complete.specs.find((spec) => spec.claimType === 'measured_specimen')!;
  const missingUnit: CatalogueSpec = {
    ...complete.specs[0]!, key: 'balance', rawValue: '~26.5', normalizedText: null,
    unit: null, claimType: 'unknown', validationStatus: 'unknown', selected: false, conflict: false,
    evidence: { ...complete.specs[0]!.evidence, observationId: 'gallery-balance-unit-unknown', attribution: null },
  };
  const editorial = complete.ratings[0]!;
  const ruleDerived: CatalogueRating = {
    ...editorial, dimension: 'power_accessibility', kind: 'rule_derived', value: 65,
    scaleMin: 0, scaleMax: 100, rawValue: '65/100',
    methodology: 'Syntetyczny przykład innej metodologii i skali; nie jest oceną prawdziwej rakiety.',
    evidence: { ...editorial.evidence, observationId: 'gallery-rule-derived', sourceName: 'Syntetyczny model regułowy' },
  };
  const unknownRating: CatalogueRating = {
    ...editorial, dimension: 'comfort', value: null, scaleMin: null, scaleMax: null,
    rawValue: null, validationStatus: 'unknown', methodology: '',
    evidence: { ...editorial.evidence, observationId: 'gallery-rating-unknown' },
  };
  const structuredExample = {
    version: 1, datasetVersion: complete.releaseId,
    blocks: [{ type: 'racket_specs', racketId: complete.id }],
  };

  return <main id="main" className="main-shell component-gallery">
    <Link href="/" className="back-link"><Arrow direction="left" /> Wróć do katalogu</Link>
    <header className="component-gallery-intro">
      <p className="section-kicker">WSPÓLNE ELEMENTY INTERFEJSU</p>
      <h1>Galeria komponentów</h1>
      <p>Parametry, oceny i źródła w tych samych komponentach, których używają profile. Każdy przykład poniżej jest syntetyczny.</p>
    </header>
    <ModeNotice mode="fixture" />
    <nav className="component-gallery-links" aria-label="Sekcje galerii">
      <a href="#gallery-summary">Parametry</a><a href="#gallery-observations">Obserwacje</a>
      <a href="#gallery-conflicts">Rozbieżności</a><a href="#gallery-ratings">Oceny</a><a href="#gallery-structured">Dane i komponent</a><a href="#gallery-states">Stany interfejsu</a>
    </nav>

    <section id="gallery-summary" className="component-gallery-section" aria-labelledby="gallery-summary-title">
      <div className="section-heading"><div><p className="section-kicker">WARTOŚĆ I JEJ ŹRÓDŁO</p><h2 id="gallery-summary-title">Parametry znane i nieustalone</h2></div></div>
      <div className="component-gallery-grid">
        <article className="racket-card component-gallery-example">
          <h3>{complete.brand} {complete.model} · {complete.variant} · {complete.modelYear}</h3>
          <p className="component-gallery-caption">Potwierdzone parametry w syntetycznym przykładzie.</p>
          <dl className="card-specs"><SpecSummary entry={complete} field="shape" /><SpecSummary entry={complete} field="weight" /></dl>
        </article>
        <article className="racket-card component-gallery-example">
          <h3>{unknown.brand} {unknown.model} · rok nieznany</h3>
          <p className="component-gallery-caption">Brak wartości i rocznika jest widoczny; nie zastępujemy ich domysłem.</p>
          <dl className="card-specs"><SpecSummary entry={unknown} field="shape" /><SpecSummary entry={unknown} field="weight" /></dl>
        </article>
      </div>
    </section>

    <section id="gallery-observations" className="component-gallery-section" aria-labelledby="gallery-observations-title">
      <div className="section-heading"><div><p className="section-kicker">ORYGINAŁ, KONTEKST, POCHODZENIE</p><h2 id="gallery-observations-title">Deklaracja, pomiar i brak jednostki</h2></div></div>
      <p className="component-gallery-caption">Pomiar z overgripem dotyczy jednego egzemplarza. Nie zmienia deklarowanej masy katalogowej.</p>
      <div className="observation-list">
        <ObservationDetails spec={complete.specs[1]!} releaseId={complete.releaseId} dev={dev} />
        <ObservationDetails spec={measured} releaseId={complete.releaseId} dev={dev} />
        <ObservationDetails spec={missingUnit} releaseId={complete.releaseId} dev={dev} />
      </div>
    </section>

    <section id="gallery-conflicts" className="component-gallery-section" aria-labelledby="gallery-conflicts-title">
      <div className="section-heading"><div><p className="section-kicker">RÓŻNICE POZOSTAJĄ WIDOCZNE</p><h2 id="gallery-conflicts-title">Rozbieżne obserwacje</h2></div></div>
      <p className="component-gallery-caption">{conflict.brand} {conflict.model} · {conflict.variant} · {conflict.modelYear}. Wskazanie wartości katalogowej zachowuje pozostałe obserwacje.</p>
      <ConflictNotice entry={conflict} />
      <RacketSpecs entry={conflict} dev={dev} />
    </section>

    <section id="gallery-ratings" className="component-gallery-section" aria-labelledby="gallery-ratings-title">
      <div className="section-heading"><div><p className="section-kicker">ODDZIELNE METODY I SKALE</p><h2 id="gallery-ratings-title">Oceny źródłowe</h2></div></div>
      <p className="component-gallery-caption">Przykłady techniczne danych syntetycznych. Skale 0–10 i 0–100 pozostają oddzielne; nie powstaje średnia ani ranking.</p>
      <div className="rating-grid"><RatingCard rating={editorial} /><RatingCard rating={ruleDerived} /><RatingCard rating={unknownRating} /></div>
    </section>

    <section id="gallery-structured" className="component-gallery-section" aria-labelledby="gallery-structured-title">
      <div className="section-heading"><div><p className="section-kicker">TEN SAM KOMPONENT</p><h2 id="gallery-structured-title">Widok ze struktury danych</h2></div></div>
      <p className="component-gallery-caption">Sprawdzony opis wybiera komponent parametrów i dokładną rakietę z określonej wersji danych. Przykład nie wykonuje wywołania modelu.</p>
      <pre className="component-gallery-code"><code>{JSON.stringify(structuredExample, null, 2)}</code></pre>
      <StructuredView input={structuredExample} entries={fixtureCatalogue} dev={dev} />
    </section>

    <section id="gallery-states" className="component-gallery-section" aria-labelledby="gallery-states-title">
      <div className="section-heading"><div><p className="section-kicker">KOMUNIKATY I GRANICE DANYCH</p><h2 id="gallery-states-title">Brak danych i błąd odczytu</h2></div></div>
      <p className="component-gallery-caption">Poniżej pokazujemy przykładowe stany. Widoczny komunikat błędu nie oznacza awarii bieżącej aplikacji.</p>
      <RacketSpecs entry={unknown} dev={dev} />
      <p className="no-ratings">Brak opublikowanych ocen dla tego wariantu. Nie wyliczamy własnej oceny liczbowej.</p>
      <Unavailable setup={false} />
      <EmptyComparison />
      <p className="component-gallery-caption">Przykład nieaktualnego odnośnika. W porównywarce poniżej tego komunikatu pojawia się formularz ponownego wyboru.</p>
      <ComparisonFeedback status="stale_release" />
    </section>
  </main>;
}
