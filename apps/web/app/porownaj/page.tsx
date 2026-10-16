import type { Metadata } from 'next';
import { ModeNotice, Unavailable } from '../../components/catalogue';
import { PageHeader } from '../../components/ui/page-header';
import { StructuredView } from '../../components/structured-view';
import { ClearComparison, RememberComparison } from '../../components/comparison-selection';
import { ComparisonFeedback, EmptyComparison } from '../../components/comparison-state';
import { filterCatalogue, parseFilters, type SearchParams } from '../../lib/catalogue';
import { getCatalogue } from '../../lib/catalogue-server';
import { showDevDetails } from '../../lib/dev-ui';
import { racketLabel } from '../../lib/comparison';
import { resolveComparison } from '../../lib/comparison-request';
import { ComparisonPicker } from '../../components/comparison-picker';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Porównaj rakiety' };

export default async function ComparisonPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const result = await getCatalogue();
  const request = resolveComparison(params, result.entries);
  const dev = showDevDetails();
  const options = filterCatalogue(result.entries,parseFilters({ sort: 'name' }));
  return <main id="main" className="main-shell comparison-page">
    <PageHeader title="Porównanie" back={{ href: '/', label: 'Katalog rakiet' }} actions={<ClearComparison />} />
    {result.status !== 'ready' ? <Unavailable setup={result.status === 'setup'} /> : <>
      {result.mode !== 'supabase' && <ModeNotice mode={result.mode} />}
      <ComparisonFeedback status={request.status} />
      {options.length === 0 || !request.currentRelease ? <section className="empty-state"><h2>Brak danych do porównania.</h2><p>Katalog potrzebuje jednej opublikowanej wersji danych.</p></section> : <>
        {request.status === 'ready' ? <><details className="comparison-change" id="change-pair"><summary>Zmień porównywane rakiety</summary><ComparisonPicker entries={options} request={request} /></details><RememberComparison selection={{ releaseId: request.currentRelease, items: [request.left, request.right].map((id) => ({ id, label: racketLabel(result.entries.find((entry) => entry.id === id)!) })) }} /><StructuredView input={request.payload} entries={result.entries} dev={dev} /></>
          : <><ComparisonPicker entries={options} request={request} />{(request.status === 'empty' || request.status === 'partial') && <EmptyComparison partial={request.status === 'partial'} />}</>}
        {result.mode === 'supabase' && dev && <ModeNotice mode={result.mode} dev={dev} />}
      </>}
    </>}
  </main>;
}
