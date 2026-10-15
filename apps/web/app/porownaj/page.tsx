import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow, ModeNotice, Unavailable } from '../../components/catalogue';
import { StructuredView } from '../../components/structured-view';
import { ClearComparison, RememberComparison } from '../../components/comparison-selection';
import { ComparisonFeedback, EmptyComparison } from '../../components/comparison-state';
import { filterCatalogue, parseFilters, type SearchParams } from '../../lib/catalogue';
import { getCatalogue } from '../../lib/catalogue-server';
import { racketLabel } from '../../lib/comparison';
import { resolveComparison } from '../../lib/comparison-request';
import { ComparisonPicker } from '../../components/comparison-picker';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Porównaj rakiety' };

export default async function ComparisonPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const result = await getCatalogue();
  const request = resolveComparison(params, result.entries);
  const options = filterCatalogue(result.entries, parseFilters({}));
  return <main id="main" className="main-shell comparison-page">
    <Link href="/" className="back-link"><Arrow direction="left" />Katalog rakiet</Link>
    <div className="comparison-title"><h1>Porównanie rakiet</h1><ClearComparison /></div>
    {result.status !== 'ready' ? <Unavailable setup={result.status === 'setup'} /> : <>
      {result.mode === 'fixture' && <ModeNotice mode={result.mode} />}
      <ComparisonFeedback status={request.status} />
      {options.length === 0 || !request.currentRelease ? <section className="empty-state"><h2>Brak danych do porównania.</h2><p>Katalog potrzebuje jednej opublikowanej wersji danych.</p></section> : <>
        {request.status === 'ready' ? <><RememberComparison selection={{ releaseId: request.currentRelease, items: [request.left, request.right].map((id) => ({ id, label: racketLabel(result.entries.find((entry) => entry.id === id)!) })) }} /><StructuredView input={request.payload} entries={result.entries} /></>
          : <><ComparisonPicker entries={options} request={request} />{(request.status === 'empty' || request.status === 'partial') && <EmptyComparison partial={request.status === 'partial'} />}</>}
        {request.status === 'ready' && <details className="comparison-change"><summary>Zmień porównywane rakiety</summary><ComparisonPicker entries={options} request={request} /></details>}
        {result.mode === 'supabase' && <div className="comparison-data-note"><ModeNotice mode={result.mode} /></div>}
      </>}
    </>}
  </main>;
}
