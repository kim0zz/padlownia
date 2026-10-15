import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ModeNotice, Unavailable } from '../../../components/catalogue';
import { SourceLicenceNotice } from '../../../components/evidence';
import { ConflictNotice, RacketSpecs } from '../../../components/racket-details';
import { RatingGroups } from '../../../components/rating-groups';
import { SpecTable } from '../../../components/spec-table';
import { AddToComparison } from '../../../components/comparison-selection';
import { Badge } from '../../../components/ui/badge';
import { PageHeader } from '../../../components/ui/page-header';
import { racketLabel } from '../../../lib/comparison';
import { displayBrand, displayModel, displayVariant } from '../../../lib/display';
import { getCatalogue } from '../../../lib/catalogue-server';
import { showDevDetails } from '../../../lib/dev-ui';

export const dynamic = 'force-dynamic';

export default async function RacketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCatalogue();
  if (result.status !== 'ready') return <main id="main" className="main-shell"><Unavailable setup={result.status === 'setup'} /></main>;
  const entry = result.entries.find((racket) => racket.id === id);
  if (!entry) notFound();
  const dev = showDevDetails();
  const related = result.entries.filter((racket) => racket.id !== entry.id && racket.brand === entry.brand && racket.model === entry.model);
  const variant = displayVariant(entry.variant);

  return <main id="main" className="main-shell profile-shell">
    <PageHeader back={{ href: '/', label: 'Katalog' }} title={displayModel(entry)}
      meta={<>
        <p className={variant ? 'profile-variant' : 'profile-variant muted'}>{variant ?? 'Wariant nieustalony'}</p>
        <p>{displayBrand(entry.brand)} · {entry.modelYear ?? <Badge tone="warning">Rocznik nieznany</Badge>}</p>
      </>}
      actions={<AddToComparison id={entry.id} releaseId={entry.releaseId} label={racketLabel(entry)} />} />
    <ModeNotice mode={result.mode} dev={dev} />
    {related.length > 0 && <nav className="related-versions" aria-label="Inne wersje">
      <span>Inne wersje:</span>
      <ul>{related.map((racket) => <li key={racket.id}><Link className="chip-link" href={`/rakiety/${encodeURIComponent(racket.id)}`}>{displayVariant(racket.variant) ?? 'wariant nieustalony'} · {racket.modelYear ?? 'rok nieznany'}</Link></li>)}</ul>
    </nav>}
    <div className="profile-columns">
      <section className="profile-specs" aria-labelledby="spec-title">
        <h2 id="spec-title">Parametry</h2>
        {entry.specs.length ? <SpecTable entry={entry} dev={dev} /> : <RacketSpecs entry={entry} />}
      </section>
      <section className="profile-ratings" aria-labelledby="ratings-title">
        <h2 id="ratings-title">Oceny</h2>
        <p className="profile-section-note">Każde źródło ma własną skalę i metodę. Skal nie łączymy ani nie uśredniamy.</p>
        <RatingGroups entry={entry} dev={dev} />
      </section>
    </div>
    <ConflictNotice entry={entry} />
    {entry.specs.length > 0 && <details className="profile-observations">
      <summary>Wszystkie obserwacje źródeł ({entry.specs.length})</summary>
      <p className="profile-legend">Deklaracja producenta: wartość podana przez markę · Pomiar egzemplarza: jedna konkretna sztuka · Ocena redakcyjna: opinia źródła, nie pomiar</p>
      <RacketSpecs entry={entry} dev={dev} />
    </details>}
    <SourceLicenceNotice entries={[entry]} />
  </main>;
}
