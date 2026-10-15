import type { Metadata } from 'next';
import type { CatalogueRating, CatalogueSpec } from '@padlownia/database';
import { ModeNotice, RacketCard, Unavailable } from '../../components/catalogue';
import { ObservationDetails } from '../../components/racket-details';
import { RatingGroups } from '../../components/rating-groups';
import { SpecValueCell } from '../../components/spec-value-cell';
import { StructuredView } from '../../components/structured-view';
import { ComparisonFeedback, EmptyComparison } from '../../components/comparison-state';
import { Badge } from '../../components/ui/badge';
import { Notice } from '../../components/ui/notice';
import { PageHeader } from '../../components/ui/page-header';
import { SourceInfo } from '../../components/ui/source-info';
import { StatBar } from '../../components/ui/stat-bar';
import { fixtureCatalogue } from '../../lib/fixtures';
import { showDevDetails } from '../../lib/dev-ui';

export const dynamic = 'force-dynamic'; // SHOW_DEV_DETAILS is read per request, not frozen at build time.
export const metadata: Metadata = { title: 'Galeria komponentów' };

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** One labelled row of the value gallery; same markup as a row of the profile's parameter table. */
function ValueRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="spec-row"><dt className="spec-row-label">{label}</dt><dd className="spec-row-cell">{children}</dd></div>;
}

// This gallery always uses authored synthetic examples, even when the catalogue
// runs in Supabase mode. It neither reads Dev data nor changes racket selection.
export default function ComponentGalleryPage() {
  const dev = showDevDetails();
  const complete = fixtureCatalogue[0]!;
  const conflict = fixtureCatalogue[2]!;
  const unknown = fixtureCatalogue[5]!;
  const shapeSpec = complete.specs[0]!;
  const declared = complete.specs[1]!;
  const measured = complete.specs.find((spec) => spec.claimType === 'measured_specimen')!;
  const missingUnit: CatalogueSpec = {
    ...shapeSpec, key: 'balance', rawValue: '~26.5', normalizedText: null,
    unit: null, claimType: 'unknown', validationStatus: 'unknown', selected: false, conflict: false,
    evidence: { ...shapeSpec.evidence, observationId: 'gallery-balance-unit-unknown', attribution: null },
  };
  const unverified: CatalogueSpec = {
    ...shapeSpec, evidence: { ...shapeSpec.evidence, observationId: 'gallery-shape-unverified', attribution: { name: 'Syntetyczny producent', url: 'https://example.invalid/manufacturer/unverified', verified: false } },
  };
  const editorial = complete.ratings[0]!;
  const ruleDerived: CatalogueRating = {
    ...editorial, dimension: 'power_accessibility', kind: 'rule_derived', value: 65,
    scaleMin: 0, scaleMax: 100, rawValue: '65/100',
    methodology: 'https://example.invalid/synthetic-methodology\nModel oparty na niepełnych danych: brakujące pola uzupełniono wartością neutralną. Syntetyczny przykład, nie ocena prawdziwej rakiety.',
    evidence: { ...editorial.evidence, observationId: 'gallery-rule-derived', sourceCode: 'gallery-model', sourceName: 'Syntetyczny model regułowy' },
  };
  const unknownRating: CatalogueRating = {
    ...editorial, dimension: 'comfort', value: null, scaleMin: null, scaleMax: null,
    rawValue: null, validationStatus: 'unknown', methodology: '',
    evidence: { ...editorial.evidence, observationId: 'gallery-rating-unknown', sourceCode: 'gallery-unknown', sourceName: 'Syntetyczne źródło bez ustalonej oceny' },
  };
  const rated = { ...complete, ratings: [editorial, ruleDerived, unknownRating] };
  // Racket B of the comparison carries a rating from the second source only, so each source shows "brak oceny" for the other racket.
  const comparisonRight = { ...conflict, ratings: [{ ...ruleDerived, dimension: 'control', evidence: { ...ruleDerived.evidence, observationId: 'gallery-rule-derived-control' } }] };
  const specsExample = { version: 1, datasetVersion: complete.releaseId, blocks: [{ type: 'racket_specs', racketId: complete.id }] };
  const comparisonExample = { version: 1, datasetVersion: complete.releaseId, blocks: [{ type: 'racket_comparison', racketIds: [complete.id, conflict.id] }] };

  return <main id="main" className="main-shell component-gallery">
    <PageHeader title="Galeria komponentów" back={{ href: '/', label: 'Katalog' }}
      meta="Parametry, oceny i źródła w tych samych komponentach, których używają katalog, profil i porównanie. Każdy przykład jest syntetyczny." />
    <ModeNotice mode="fixture" />
    <nav className="component-gallery-links" aria-label="Sekcje galerii">
      <a href="#gallery-badges">Znaczniki</a><a href="#gallery-summary">Wartości</a><a href="#gallery-observations">Obserwacje</a>
      <a href="#gallery-ratings">Oceny</a><a href="#gallery-comparison">Porównanie</a><a href="#gallery-cards">Karta rakiety</a>
      <a href="#gallery-structured">Dane i komponent</a><a href="#gallery-states">Stany interfejsu</a>
    </nav>

    <section id="gallery-badges" className="component-gallery-section" aria-labelledby="gallery-badges-title">
      <h2 id="gallery-badges-title">Znaczniki, źródło i pasek skali</h2>
      <p className="component-gallery-caption">Znacznik ostrzegawczy jest zarezerwowany dla rozbieżności, braków i danych niezweryfikowanych. Ikona źródła otwiera rodzaj informacji, odnośnik i datę pobrania.</p>
      <div className="component-gallery-row">
        <Badge>Wartość katalogowa</Badge>
        <Badge tone="warning">Rozbieżne źródła</Badge>
        <Badge tone="info">Informacja</Badge>
        <span className="component-gallery-inline">Źródło wartości <SourceInfo label="Źródło: przykład" dev={dev} items={[{ evidence: declared.evidence, claim: 'Deklaracja producenta' }, { evidence: measured.evidence, claim: 'Pomiar egzemplarza' }]} /></span>
      </div>
      <div className="component-gallery-bars">
        <div><p className="component-gallery-caption">Skala 0–10, wartość 8 (kolumna A)</p><StatBar tone="a" min={0} max={10} value={8} label="Przykład: 8 w skali 0–10" /></div>
        <div><p className="component-gallery-caption">Skala 0–100, wartość 65 (kolumna B)</p><StatBar tone="b" min={0} max={100} value={65} label="Przykład: 65 w skali 0–100" /></div>
        <div><p className="component-gallery-caption">Wartość 0 w skali 0–10</p><StatBar tone="a" min={0} max={10} value={0} label="Przykład: 0 w skali 0–10" /></div>
      </div>
      <p className="component-gallery-caption">Kolor paska oznacza kolumnę, nie jakość. Długość odpowiada wartości w skali własnego źródła.</p>
    </section>

    <section id="gallery-summary" className="component-gallery-section" aria-labelledby="gallery-summary-title">
      <h2 id="gallery-summary-title">Wartość parametru</h2>
      <p className="component-gallery-caption">Ta sama komórka w profilu i w porównaniu. Rozbieżność i brak weryfikacji producenta zostają na pierwszym planie.</p>
      <dl className="spec-table">
        <ValueRow label="Pełna wartość"><SpecValueCell specs={[declared]} specLabel="Masa" dev={dev} /></ValueRow>
        <ValueRow label="Brak wartości"><SpecValueCell specs={[]} specLabel="Core" dev={dev} /></ValueRow>
        <ValueRow label="Konflikt źródeł"><SpecValueCell specs={[conflict.specs[0]!]} observations={conflict.specs} specLabel="Kształt" dev={dev} /></ValueRow>
        <ValueRow label="Bez weryfikacji producenta"><SpecValueCell specs={[unverified]} specLabel="Kształt" dev={dev} /></ValueRow>
        <ValueRow label="Nieznana jednostka"><SpecValueCell specs={[missingUnit]} specLabel="Balans" dev={dev} /></ValueRow>
        <ValueRow label="Pomiar egzemplarza"><SpecValueCell specs={[measured]} specLabel="Masa" dev={dev} /></ValueRow>
      </dl>
    </section>

    <section id="gallery-observations" className="component-gallery-section" aria-labelledby="gallery-observations-title">
      <h2 id="gallery-observations-title">Deklaracja, pomiar i brak jednostki</h2>
      <p className="component-gallery-caption">Pomiar z overgripem dotyczy jednego egzemplarza. Nie zmienia deklarowanej masy katalogowej. Wartość o nieznanej jednostce zachowuje oryginał i nie jest zgadywana.</p>
      <div className="observation-list">
        <ObservationDetails spec={declared} releaseId={complete.releaseId} dev={dev} />
        <ObservationDetails spec={measured} releaseId={complete.releaseId} dev={dev} />
        <ObservationDetails spec={missingUnit} releaseId={complete.releaseId} dev={dev} />
      </div>
    </section>

    <section id="gallery-ratings" className="component-gallery-section" aria-labelledby="gallery-ratings-title">
      <h2 id="gallery-ratings-title">Oceny źródłowe</h2>
      <p className="component-gallery-caption">Trzy syntetyczne źródła: skala 0–10, skala 0–100 z niepełnymi danymi modelu i ocena nieustalona. Skale pozostają oddzielne; nie powstaje średnia ani ranking.</p>
      <RatingGroups entry={rated} dev={dev} />
      <p className="component-gallery-caption">Rakieta bez ocen:</p>
      <RatingGroups entry={unknown} dev={dev} />
    </section>

    <section id="gallery-comparison" className="component-gallery-section" aria-labelledby="gallery-comparison-title">
      <h2 id="gallery-comparison-title">Porównanie dwóch rakiet</h2>
      <p className="component-gallery-caption">Nagłówek z tożsamością obu rakiet, wiersze z oznaczoną różnicą i oceny źródeł obok siebie. Odnośnik „Zmień” prowadzi do wyboru rakiet na stronie porównania.</p>
      <pre className="component-gallery-code"><code>{json(comparisonExample)}</code></pre>
      <StructuredView input={comparisonExample} entries={[complete, comparisonRight]} dev={dev} />
    </section>

    <section id="gallery-cards" className="component-gallery-section" aria-labelledby="gallery-cards-title">
      <h2 id="gallery-cards-title">Karta rakiety</h2>
      <p className="component-gallery-caption">Karta katalogu bez przycisku wyboru do porównania: galeria nie zmienia wyboru użytkownika. Rakieta bez roku i z rozbieżnymi źródłami zachowuje znaczniki.</p>
      <div className="racket-grid">
        <RacketCard entry={complete} comparable={false} />
        <RacketCard entry={conflict} comparable={false} />
        <RacketCard entry={unknown} comparable={false} />
      </div>
    </section>

    <section id="gallery-structured" className="component-gallery-section" aria-labelledby="gallery-structured-title">
      <h2 id="gallery-structured-title">Widok ze struktury danych</h2>
      <p className="component-gallery-caption">Sprawdzony opis wybiera komponent parametrów i dokładną rakietę z określonej wersji danych. Przykład nie wykonuje wywołania modelu.</p>
      <pre className="component-gallery-code"><code>{json(specsExample)}</code></pre>
      <StructuredView input={specsExample} entries={fixtureCatalogue} dev={dev} />
    </section>

    <section id="gallery-states" className="component-gallery-section" aria-labelledby="gallery-states-title">
      <h2 id="gallery-states-title">Brak danych i błąd odczytu</h2>
      <p className="component-gallery-caption">Przykładowe stany. Widoczny komunikat błędu nie oznacza awarii bieżącej aplikacji.</p>
      <StructuredView input={{ version: 1, datasetVersion: unknown.releaseId, blocks: [{ type: 'racket_specs', racketId: unknown.id }] }} entries={fixtureCatalogue} dev={dev} />
      <Notice tone="warning"><p>Źródła podają rozbieżne parametry. Rozbieżność nie jest uśredniana.</p></Notice>
      <Unavailable setup={false} />
      <EmptyComparison />
      <EmptyComparison partial />
      <p className="component-gallery-caption">Nieaktualny odnośnik. W porównywarce pod tym komunikatem pojawia się formularz ponownego wyboru.</p>
      <ComparisonFeedback status="stale_release" />
    </section>
  </main>;
}
