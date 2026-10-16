import Link from 'next/link';
import { Arrow, ModeNotice, RacketCard, Unavailable } from '../components/catalogue';
import { AutoSubmit } from '../components/auto-submit';
import { CatalogueSearch } from '../components/catalogue-search';
import { PageHeader } from '../components/ui/page-header';
import { catalogueUrl, filterCatalogue, PAGE_SIZE, parseFilters, shapeLabels, sortLabels, sortModes, weightFilters, weightLabels, type SearchParams } from '../lib/catalogue';
import { getCatalogue } from '../lib/catalogue-server';
import { showDevDetails } from '../lib/dev-ui';
import { displayLabel } from '../lib/display';

export const dynamic = 'force-dynamic';

/** Polish plural: 1 → one, 2–4 (not 12–14) → few, otherwise many. */
function plural(count: number, [one, few, many]: [string, string, string]) {
  if (count === 1) return one;
  const tens = count % 100;
  return count % 10 >= 2 && count % 10 <= 4 && (tens < 12 || tens > 14) ? few : many;
}

export default async function CataloguePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseFilters(await searchParams);
  const result = await getCatalogue();
  const entries = result.entries;
  const filtered = filterCatalogue(entries, filters);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const brands = [...new Set(entries.map((entry) => entry.brand))].sort();
  const years = [...new Set(entries.flatMap((entry) => entry.modelYear === null ? [] : [entry.modelYear]))].sort((a, b) => b - a);
  const shapes = [...new Set(entries.flatMap((entry) => entry.shape ? [entry.shape] : []))].sort();
  const sources = [...new Set(entries.flatMap((entry) => [...entry.specs, ...entry.ratings].map((item) => item.evidence.sourceName)))].slice(0, 3);
  const options = entries.map((entry) => ({ id: entry.id, label: displayLabel(entry), brand: entry.brand, year: entry.modelYear }));
  const active = Boolean(filters.q || filters.brand || filters.year || filters.shape || filters.weight || filters.rated);
  const meta = `${entries.length} ${plural(entries.length, ['rakieta', 'rakiety', 'rakiet'])}${sources.length ? ` · dane: ${sources.join(', ')}` : ''}`;

  return <main id="main" className="main-shell">
    <PageHeader title="Katalog rakiet" meta={meta} />
    {result.status === 'ready' && <ModeNotice mode={result.mode} dev={showDevDetails()} />}
    {result.status !== 'ready' ? <Unavailable setup={result.status === 'setup'} /> : <>
      <section className="catalogue-section" aria-label="Wyniki wyszukiwania">
        <form action="/" method="get" className="catalogue-form" role="search" aria-label="Wyszukaj rakietę">
          <CatalogueSearch options={options} initialQuery={filters.q} />
          <div className="filter-row">
            <div className="filter-field"><label htmlFor="brand" className="sr-only">Marka</label><select id="brand" name="brand" defaultValue={filters.brand}><option value="">Każda marka</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></div>
            <div className="filter-field"><label htmlFor="year" className="sr-only">Rocznik</label><select id="year" name="year" defaultValue={filters.year}><option value="">Każdy rok</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></div>
            <div className="filter-field"><label htmlFor="shape" className="sr-only">Kształt</label><select id="shape" name="shape" defaultValue={filters.shape}><option value="">Każdy kształt</option>{shapes.map((shape) => <option key={shape} value={shape}>{shapeLabels[shape] ?? shape}</option>)}</select></div>
            <div className="filter-field"><label htmlFor="weight" className="sr-only">Masa</label><select id="weight" name="weight" defaultValue={filters.weight}><option value="">Dowolna masa</option>{weightFilters.map((weight) => <option key={weight} value={weight}>{weightLabels[weight]}</option>)}</select></div>
            <label className="rated-toggle"><input type="checkbox" name="rated" value="1" defaultChecked={filters.rated === '1'} /> Tylko z ocenami</label>
            <div className="filter-field sort-field"><label htmlFor="sort">Sortuj</label><select id="sort" name="sort" defaultValue={filters.sort}>{sortModes.map((mode) => <option key={mode} value={mode}>{sortLabels[mode]}</option>)}</select></div>
          </div>
          <AutoSubmit />
        </form>
        <div className="results-toolbar"><p role="status"><strong>{filtered.length}</strong> {active ? plural(filtered.length, ['wynik', 'wyniki', 'wyników']) : plural(filtered.length, ['rakieta', 'rakiety', 'rakiet']) + ' w katalogu'}{filters.q && <> dla „{filters.q}”</>}</p>{active && <Link href={catalogueUrl({ ...parseFilters({}), sort: filters.sort })} className="clear-link">Wyczyść filtry <span aria-hidden="true">×</span></Link>}</div>
        {visible.length ? <div className="racket-grid">{visible.map((entry) => <RacketCard key={entry.id} entry={entry} />)}</div>
          : <div className="empty-state"><h3>{entries.length ? 'Tym razem bez wyników.' : 'Pierwsza publikacja jeszcze przed nami.'}</h3><p>{entries.length ? 'Spróbuj krótszej nazwy, innego rocznika albo wyczyść filtry.' : 'Po zatwierdzeniu importu pojawią się tu rakiety z aktywnej wersji katalogu.'}</p>{active && <Link className="button button-secondary" href="/">Pokaż cały katalog <Arrow /></Link>}</div>}
        {pages > 1 && <nav className="pagination" aria-label="Strony wyników">{page > 1 && <Link className="button button-secondary" href={catalogueUrl(filters, page - 1)}><Arrow direction="left" /> Poprzednia</Link>}<span>Strona {page} z {pages}</span>{page < pages && <Link className="button button-secondary" href={catalogueUrl(filters, page + 1)}>Następna <Arrow /></Link>}</nav>}
      </section>
    </>}
  </main>;
}
