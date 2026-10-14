import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow, ModeNotice, Unavailable } from '../../components/catalogue';
import { StructuredView } from '../../components/structured-view';
import { RememberComparison } from '../../components/comparison-selection';
import { ComparisonFeedback, EmptyComparison } from '../../components/comparison-state';
import { filterCatalogue, parseFilters, type SearchParams } from '../../lib/catalogue';
import { getCatalogue } from '../../lib/catalogue-server';
import { racketLabel } from '../../lib/comparison';
import { resolveComparison } from '../../lib/comparison-request';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Porównaj rakiety' };

export default async function ComparisonPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const result = await getCatalogue();
  const request = resolveComparison(params, result.entries);
  const options = filterCatalogue(result.entries, parseFilters({}));
  return <main id="main" className="main-shell comparison-page">
    <Link href="/" className="back-link"><Arrow direction="left" />Katalog rakiet</Link>
    <section className="comparison-intro"><p className="eyebrow"><span /> SZCZEGÓŁY ROBIĄ RÓŻNICĘ</p><h1>Dwie rakiety.<br /><span>Pełny kontekst.</span></h1>
      <p className="intro-copy">Zestaw dokładne warianty i roczniki. Sprawdź parametry, rozbieżności oraz oceny w oryginalnych skalach.</p></section>
    {result.status !== 'ready' ? <Unavailable setup={result.status === 'setup'} /> : <>
      <ModeNotice mode={result.mode} />
      <ComparisonFeedback status={request.status} />
      {options.length === 0 || !request.currentRelease ? <section className="empty-state"><h2>Brak danych do porównania.</h2><p>Katalog potrzebuje jednej opublikowanej wersji danych.</p></section> : <>
        <form key={`${request.currentRelease}:${request.left}:${request.right}:${request.status}`} action="/porownaj" method="get" className="search-panel comparison-picker" aria-label="Wybierz dwie rakiety">
          <input type="hidden" name="release" value={request.currentRelease} />
          {(['left', 'right'] as const).map((side, index) => <div className="filter-field" key={side}><label htmlFor={`compare-${side}`}>Rakieta {index + 1} · model, wariant i rok</label>
            <select id={`compare-${side}`} name={side} defaultValue={request[side]} required><option value="">Wybierz rakietę</option>{options.map((entry) => <option value={entry.id} key={entry.id}>{racketLabel(entry)}</option>)}</select>
          </div>)}
          <button type="submit" className="button">{request.status === 'stale_release' ? 'Porównaj w aktualnej wersji' : 'Porównaj rakiety'}<Arrow /></button>
        </form>
        {request.status === 'ready' ? <><RememberComparison selection={{ releaseId: request.currentRelease, items: [request.left, request.right].map((id) => ({ id, label: racketLabel(result.entries.find((entry) => entry.id === id)!) })) }} /><StructuredView input={request.payload} entries={result.entries} /></>
          : (request.status === 'empty' || request.status === 'partial') && <EmptyComparison partial={request.status === 'partial'} />}
      </>}
    </>}
  </main>;
}
