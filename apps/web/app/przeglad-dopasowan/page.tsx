import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { CatalogueEntry } from '@padlownia/database';
import { Unavailable } from '../../components/catalogue';
import { Badge } from '../../components/ui/badge';
import { Notice } from '../../components/ui/notice';
import { PageHeader } from '../../components/ui/page-header';
import { getCatalogue } from '../../lib/catalogue-server';
import { entrySpecRows, specDisplayValue } from '../../lib/comparison';
import { displayBrand, displayModel, identityDetails } from '../../lib/display';
import { matchReviewDir, readReviewState, recordAnswer, type MatchAnswer } from '../../lib/match-review';
import '../styles/match-review.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Przegląd dopasowań' };

const reasonLabels: Readonly<Record<string, string>> = {
  same_brand: 'ta sama marka', same_year: 'ten sam rocznik', year_from_one_source: 'rocznik podaje tylko jedno źródło',
  same_model_codes: 'te same numery modelu', no_model_codes: 'brak numerów w nazwie', same_variant_words: 'zgodny wariant',
  same_model_words: 'te same słowa nazwy', one_name_extends_the_other: 'jedna nazwa rozszerza drugą', most_model_words_shared: 'większość słów wspólna',
};
const answerLabels: Readonly<Record<MatchAnswer, string>> = { same: 'Ta sama rakieta', different: 'Różne rakiety', unsure: 'Nie wiem' };

async function answer(formData: FormData) {
  'use server';
  const dir = matchReviewDir();
  if (!dir) return;
  await recordAnswer(dir, String(formData.get('key') ?? ''), String(formData.get('answer') ?? ''));
  revalidatePath('/przeglad-dopasowan');
}

function Side({ entry }: { entry: CatalogueEntry }) {
  const sources = [...new Set([...entry.specs, ...entry.ratings].map((item) => item.evidence.sourceName))];
  const rows = entrySpecRows(entry).filter((row) => ['shape', 'weight', 'balance', 'core', 'surface', 'thickness'].includes(row.key));
  return <div className="match-side">
    <p className="racket-brand">{displayBrand(entry.brand)} · {sources.join(', ')}</p>
    <h3><Link href={`/rakiety/${encodeURIComponent(entry.id)}`}>{displayModel(entry)}</Link></h3>
    <p className="match-identity">{identityDetails(entry).join(' · ') || '—'}</p>
    <p className="match-source-name">Nazwa w źródle: {entry.model}</p>
    <dl className="spec-table">{rows.map((row) => <div className="spec-row" key={row.key}><dt className="spec-row-label">{row.label}</dt>
      <dd className="spec-row-cell">{row.selected.map(specDisplayValue).join(' / ') || '—'}</dd></div>)}</dl>
  </div>;
}

export default async function MatchReviewPage() {
  const dir = matchReviewDir();
  if (!dir) notFound();
  const [result, state] = await Promise.all([getCatalogue(), readReviewState(dir).catch(() => null)]);
  if (result.status !== 'ready') return <main id="main" className="main-shell"><Unavailable setup={result.status === 'setup'} /></main>;
  if (!state) return <main id="main" className="main-shell"><Notice tone="warning"><p>Brak pliku kandydatów. Uruchom <code>npm run candidates</code>.</p></Notice></main>;
  const byId = new Map(result.entries.map((entry) => [entry.id, entry]));
  const stale = result.entries[0]?.releaseId !== state.releaseId;
  const answered = state.candidates.filter((candidate) => state.answers[candidate.key]).length;
  return <main id="main" className="main-shell">
    <PageHeader title="Przegląd dopasowań" meta={`${state.candidates.length} par do decyzji · ${answered} rozstrzygniętych`} />
    <Notice><p>Czy to ta sama rakieta opisana przez dwa źródła? Odpowiedzi zapisują się lokalnie; połączenie wymaga nowego wydania danych. Nic nie łączy się automatycznie.</p></Notice>
    {stale && <Notice tone="warning"><p>Kandydaci powstali dla innego wydania danych. Wygeneruj listę ponownie.</p></Notice>}
    <ol className="match-list">{state.candidates.map((candidate) => {
      const left = byId.get(candidate.leftId), right = byId.get(candidate.rightId);
      const current = state.answers[candidate.key]?.answer;
      return <li key={candidate.key} className="match-item" data-answer={current ?? 'open'}>
        <p className="match-meta"><Badge tone={candidate.confidence === 'high' ? 'info' : 'neutral'}>{candidate.confidence === 'high' ? 'Wysoka pewność' : 'Średnia pewność'}</Badge>
          {candidate.ambiguous && <> <Badge tone="warning">Więcej niż jedna możliwość</Badge></>} {candidate.reasons.map((reason) => reasonLabels[reason] ?? reason).join(' · ')}</p>
        {left && right ? <div className="match-pair"><Side entry={left} /><Side entry={right} /></div> : <p>Rakieta nie istnieje w bieżącym katalogu.</p>}
        <form action={answer} className="match-answers">
          <input type="hidden" name="key" value={candidate.key} />
          {(Object.keys(answerLabels) as MatchAnswer[]).map((value) => <button key={value} type="submit" name="answer" value={value}
            className={current === value ? 'button' : 'button button-secondary'} aria-pressed={current === value}>{answerLabels[value]}</button>)}
        </form>
      </li>;
    })}</ol>
    {state.yearMismatches.length > 0 && <details className="match-years"><summary>Ta sama nazwa, inny rocznik ({state.yearMismatches.length}) — tylko do wglądu</summary>
      <p>Rocznik jest częścią tożsamości rakiety, więc tych par nie łączymy. Warto sprawdzić, czy jedno ze źródeł nie datuje recenzji zamiast rakiety.</p>
      <ul>{state.yearMismatches.map(({ leftId, rightId }) => { const l = byId.get(leftId), r = byId.get(rightId);
        return l && r ? <li key={`${leftId}~${rightId}`}>{l.model} ({l.modelYear}) ↔ {r.model} ({r.modelYear})</li> : null; })}</ul>
    </details>}
  </main>;
}
