import Link from 'next/link';
import { Arrow, ModeNotice, RacketCard, SourceLicenceNotice, Unavailable } from '../components/catalogue';
import { catalogueUrl, filterCatalogue, PAGE_SIZE, parseFilters, shapeLabels, type SearchParams } from '../lib/catalogue';
import { getCatalogue } from '../lib/catalogue-server';
import { showDevDetails } from '../lib/dev-ui';

export const dynamic = 'force-dynamic';

export default async function CataloguePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseFilters(await searchParams);
  const result = await getCatalogue();
  const entries = result.entries;
  const filtered = filterCatalogue(entries, filters);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const brands = [...new Set(entries.map((entry) => entry.brand))].sort();
  const years = [...new Set(entries.map((entry) => entry.modelYear))].sort((a, b) => (b ?? 0) - (a ?? 0));
  const shapes = [...new Set(entries.flatMap((entry) => entry.shape ? [entry.shape] : []))].sort();
  const active = Boolean(filters.q || filters.brand || filters.year || filters.shape);

  return <main id="main" className="main-shell">
    <section className="catalogue-intro"><div><p className="eyebrow"><span /> TWÓJ NASTĘPNY MECZ ZACZYNA SIĘ TUTAJ</p>
      <h1>Poznaj rakietę.<br /><span>Graj po swojemu.</span></h1>
      <p className="intro-copy">Modele, roczniki i konkretne parametry. Odkrywaj rakiety do padla i sprawdzaj źródło każdego szczegółu.</p></div>
      <div className="intro-note"><span className="note-rule" /><strong>Dobre decyzje<br />zaczynają się od danych.</strong><p>Deklaracje producenta, pomiary i opinie — zawsze z kontekstem.</p></div>
    </section>
    {result.status === 'ready' && <ModeNotice mode={result.mode} dev={showDevDetails()} />}
    {result.status !== 'ready' ? <Unavailable setup={result.status === 'setup'} /> : <>
      <section className="catalogue-section" aria-labelledby="catalogue-title">
        <div className="section-heading"><div><p className="section-kicker">ODKRYWAJ ŚWIADOMIE</p><h2 id="catalogue-title">Katalog rakiet</h2></div><span className="catalogue-total">{entries.length} modeli i wariantów</span></div>
        <form action="/" method="get" className="search-panel" role="search" aria-label="Wyszukaj rakietę">
          <div className="search-field"><label htmlFor="q">Szukaj marki, modelu lub wariantu</label><div className="search-input-wrap"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg><input id="q" name="q" type="search" maxLength={120} defaultValue={filters.q} placeholder="np. Orbit Control 2026" /></div></div>
          <div className="filter-field"><label htmlFor="brand">Marka</label><select id="brand" name="brand" defaultValue={filters.brand}><option value="">Każda marka</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></div>
          <div className="filter-field"><label htmlFor="year">Rocznik</label><select id="year" name="year" defaultValue={filters.year}><option value="">Każdy rok</option>{years.map((year) => <option key={year ?? 'unknown'} value={year ?? 'unknown'}>{year ?? 'Rok nieznany'}</option>)}</select></div>
          <div className="filter-field"><label htmlFor="shape">Kształt</label><select id="shape" name="shape" defaultValue={filters.shape}><option value="">Każdy kształt</option>{shapes.map((shape) => <option key={shape} value={shape}>{shapeLabels[shape] ?? shape}</option>)}</select></div>
          <button type="submit" className="button">Szukaj <Arrow /></button>
        </form>
        <div className="results-toolbar"><p role="status"><strong>{filtered.length}</strong> {active ? 'wyników wyszukiwania' : 'rakiet w katalogu'}{filters.q && <> dla „{filters.q}”</>}</p>{active && <Link href="/" className="clear-link">Wyczyść filtry <span aria-hidden="true">×</span></Link>}</div>
        {visible.length ? <div className="racket-grid">{visible.map((entry, index) => <RacketCard key={entry.id} entry={entry} index={(page - 1) * PAGE_SIZE + index} />)}</div>
          : <div className="empty-state"><h3>{entries.length ? 'Tym razem bez wyników.' : 'Pierwsza publikacja jeszcze przed nami.'}</h3><p>{entries.length ? 'Spróbuj krótszej nazwy, innego rocznika albo wyczyść filtry.' : 'Po zatwierdzeniu importu pojawią się tu rakiety z aktywnej wersji katalogu.'}</p>{active && <Link className="button button-secondary" href="/">Pokaż cały katalog <Arrow /></Link>}</div>}
        {pages > 1 && <nav className="pagination" aria-label="Strony wyników">{page > 1 && <Link className="button button-secondary" href={catalogueUrl(filters, page - 1)}><Arrow direction="left" /> Poprzednia</Link>}<span>Strona {page} z {pages}</span>{page < pages && <Link className="button button-secondary" href={catalogueUrl(filters, page + 1)}>Następna <Arrow /></Link>}</nav>}
      </section>
      <SourceLicenceNotice entries={visible} />
      <aside className="evidence-explainer"><span className="explainer-symbol" aria-hidden="true">i</span><div><h2>Każdy parametr ma swoją historię.</h2><p>Dane producenta i pomiar konkretnego egzemplarza mogą się różnić. W profilu pokazujemy źródła, rozbieżności i brakujące informacje.</p></div><span className="explainer-tag">ŹRÓDŁA, NIE DOMYSŁY</span></aside>
    </>}
  </main>;
}
