import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { answerTurn, racketName, type AssistantTurn } from '@padlownia/ai';
import { Unavailable } from '../../components/catalogue';
import { Badge } from '../../components/ui/badge';
import { Notice } from '../../components/ui/notice';
import { PageHeader } from '../../components/ui/page-header';
import { getCatalogue } from '../../lib/catalogue-server';
import { first, type SearchParams } from '../../lib/catalogue';
import '../styles/assistant.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Asystent (podgląd)' };

/** Dev-only preview of the first assistant (AI plan step 5): two intents, deterministic writer, no model calls. */
const enabled = () => process.env.APP_ENV === 'development' && process.env.ASSISTANT_PREVIEW === '1';
const kindLabels = { spec_fact: 'Dane', source_opinion: 'Opinia źródła', ai_inference: 'Wniosek AI', uncertainty: 'Brak danych' } as const;
const examples = ['Jaka jest moc i komfort Babolat Air Viper 2.6?', 'Porównaj Nox AT10 Luxury Genius 12K Alum Xtrem 2026 i Bullpadel Vertex 05 2027', 'statystyki Nox AT10'];

function Answer({ turn, names }: { turn: AssistantTurn; names: Map<string, string> }) {
  return <section className="assistant-answer" aria-label="Odpowiedź">
    {!turn.validation.ok && <Notice tone="warning"><p>Odpowiedź nie przeszła kontroli serwera i nie zostałaby pokazana użytkownikowi.</p></Notice>}
    {turn.answer.rackets.length > 0 && <p className="assistant-rackets">{turn.answer.rackets.map((id) => <Link key={id} className="chip-link" href={`/rakiety/${encodeURIComponent(id)}`}>{names.get(id)}</Link>)}</p>}
    <ul className="assistant-segments">{turn.answer.segments.map((segment, index) => <li key={index} data-kind={segment.kind}>
      <Badge tone={segment.kind === 'uncertainty' ? 'warning' : 'neutral'}>{turn.answer.intent === 'clarify' ? 'Pytanie' : kindLabels[segment.kind]}</Badge>
      {/* The writer separates rackets with " | "; one line per racket reads better. */}
      {segment.text.split(' | ').map((line, lineIndex) => <p key={lineIndex} className="assistant-line">{line}</p>)}
      {segment.citations.length > 0 && <details className="assistant-citations"><summary>Źródła ({segment.citations.length})</summary>
        <ul>{segment.citations.map((id) => <li key={id}>{turn.citations.get(id)}</li>)}</ul></details>}
    </li>)}</ul>
    {turn.answer.clarification && <div className="assistant-clarify"><p>{turn.answer.clarification.question}</p>
      <p className="assistant-rackets">{turn.answer.clarification.options.map((id) => <Link key={id} className="chip-link" href={`/rakiety/${encodeURIComponent(id)}`}>{names.get(id)}</Link>)}</p></div>}
    <p className="profile-section-note">Intencja: {turn.answer.intent} · aspekty: {turn.plan.aspects.join(', ') || '—'} · autor: {turn.writer} · kontrola: {turn.validation.ok ? 'OK' : turn.validation.violations.map((v) => v.code).join(', ')}</p>
  </section>;
}

export default async function AssistantPreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!enabled()) notFound();
  const question = first((await searchParams).q).trim().slice(0, 300);
  const result = await getCatalogue();
  if (result.status !== 'ready') return <main id="main" className="main-shell"><Unavailable setup={result.status === 'setup'} /></main>;
  const names = new Map(result.entries.map((entry) => [entry.id, racketName(entry)]));
  const turn = question ? answerTurn(question, result.entries) : null;
  return <main id="main" className="main-shell">
    <PageHeader title="Asystent — podgląd" meta="Tylko tryb deweloperski · bez modelu językowego · odpowiedź złożona wyłącznie z danych katalogu z przypisami" />
    <form action="/asystent" method="get" className="assistant-form" role="search">
      <label htmlFor="q">Pytanie</label>
      <input id="q" name="q" defaultValue={question} maxLength={300} placeholder="np. Porównaj moc Babolat Air Viper 2.6 i Bullpadel Vertex 05" />
      <button type="submit" className="button">Zapytaj</button>
    </form>
    {!question && <p className="assistant-examples">Przykłady: {examples.map((example) => <Link key={example} href={`/asystent?q=${encodeURIComponent(example)}`}>{example}</Link>)}</p>}
    {turn && <Answer turn={turn} names={names} />}
  </main>;
}
