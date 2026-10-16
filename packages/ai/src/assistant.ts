import { validateAnswer, type AnswerViolation, type AssistantAnswer } from './answer';
import { stripNames } from './lexical';
import { RacketResolver, type Resolution } from './resolver';
import { ASPECTS, detectAspects, structuredEvidence, type Aspect, type StructuredEntry, type StructuredEvidence } from './structured';

/**
 * First assistant turn (AI plan step 5): two intents, "stats of X" and "compare X and Y", in developer mode.
 * Fixed pipeline (P-038): resolve rackets → pick aspects → collect citable catalogue evidence → write → validate.
 * The writer here is deterministic (no model, no cost): it only restates evidence lines with their citations,
 * in the same answer contract a model writer will use later, so the server checks stay identical.
 */
export interface TurnPlan {
  intent: AssistantAnswer['intent'];
  resolutions: Resolution[];
  rackets: StructuredEntry[];
  aspects: Aspect[];
  /** Aspects the question itself names (empty: the answer is an overview). */
  asked: Aspect[];
  /** Evidence per racket, in racket order. */
  evidence: StructuredEvidence[][];
}

export interface AssistantTurn {
  plan: TurnPlan;
  answer: AssistantAnswer;
  /** Citation ID → exact evidence text; the only things an answer may cite. */
  citations: Map<string, string>;
  validation: { ok: true } | { ok: false; violations: AnswerViolation[] };
  writer: 'deterministic-v1';
}

const MAX_SEGMENTS = 12;
const MAX_CITATIONS = 8;
// Without a named aspect the answer gives an overview of the aspects players ask about most.
const OVERVIEW: readonly Aspect[] = ['power', 'control', 'comfort', 'handling', 'shape', 'weight', 'balance', 'level'];

export const racketName = (entry: Pick<StructuredEntry, 'brand' | 'model' | 'variant' | 'modelYear'>) => {
  const model = entry.model.toLowerCase().startsWith(`${entry.brand.toLowerCase()} `) ? entry.model : `${entry.brand} ${entry.model}`;
  return entry.modelYear === null || model.includes(String(entry.modelYear)) ? model : `${model} ${entry.modelYear}`;
};

export function resolverFor(catalogue: readonly StructuredEntry[]): RacketResolver {
  return new RacketResolver(catalogue.map((entry) => ({ id: entry.id, brand: entry.brand, name: entry.model, year: entry.modelYear })));
}

export function planTurn(question: string, catalogue: readonly StructuredEntry[], resolver = resolverFor(catalogue)): TurnPlan {
  const byId = new Map(catalogue.map((entry) => [entry.id, entry]));
  const resolutions = resolver.resolveAll(question);
  const resolved = resolutions.flatMap((item) => (item.status === 'resolved' ? [byId.get(item.id)!] : []));
  const rackets = [...new Map(resolved.map((entry) => [entry.id, entry])).values()].slice(0, 2);
  // Racket names carry aspect words ("12K Alum", "Power", "Control"): look for aspects only in the rest of the question.
  const asked = detectAspects(rackets.reduce((text, entry) => stripNames(text, `${entry.brand} ${entry.model}`), question));
  const aspects = asked.length ? asked : [...OVERVIEW];
  const intent: TurnPlan['intent'] = resolutions.some((item) => item.status === 'ambiguous') ? 'clarify'
    : rackets.length >= 2 ? 'compare' : rackets.length === 1 ? 'stats' : 'out_of_scope';
  return { intent, resolutions, rackets, aspects, asked, evidence: rackets.map((entry) => structuredEvidence(entry, aspects)) };
}

/** Restates evidence lines grouped by aspect; never adds a number, ranking or opinion of its own. */
export function writeDeterministic(plan: TurnPlan, catalogue: readonly StructuredEntry[]): AssistantAnswer {
  const base = { version: 1 as const, intent: plan.intent, rackets: plan.rackets.map((entry) => entry.id) };
  if (plan.intent === 'clarify') {
    const ambiguous = plan.resolutions.find((item) => item.status === 'ambiguous') as Extract<Resolution, { status: 'ambiguous' }>;
    const options = ambiguous.ids.slice(0, 6);
    const names = new Map(catalogue.map((entry) => [entry.id, racketName(entry)]));
    return { ...base, rackets: [], segments: [{ kind: 'uncertainty', text: `„${ambiguous.matched}” pasuje do kilku rakiet. Którą masz na myśli?`, citations: [] }],
      clarification: { question: `Którą rakietę wybrać: ${options.map((id) => names.get(id)).join(', ')}?`.slice(0, 300), options } };
  }
  if (plan.intent === 'out_of_scope') {
    return { ...base, rackets: [], segments: [{ kind: 'uncertainty', text: 'Nie rozpoznałem rakiety w pytaniu. Podaj markę i model, np. „Babolat Air Viper”.', citations: [] }] };
  }
  const segments: AssistantAnswer['segments'] = [];
  const missing: string[] = [];
  for (const aspect of plan.aspects) {
    const perRacket = plan.evidence.map((items) => items.filter((item) => item.aspect === aspect));
    if (perRacket.every((items) => !items.length)) { missing.push(ASPECTS[aspect].label); continue; }
    const lines = perRacket.map((items, index) => {
      const text = items.map((item) => item.text).join('; ');
      return plan.rackets.length > 1 ? `${racketName(plan.rackets[index]!)}: ${text || 'brak danych w źródłach'}` : text;
    });
    const citations = perRacket.flat().map((item) => item.id).slice(0, MAX_CITATIONS);
    const conflict = perRacket.flat().some((item) => item.conflict);
    const label = ASPECTS[aspect].label;
    const text = `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${lines.join(' | ')}${conflict ? ' (źródła podają różne wartości)' : ''}`;
    segments.push({ kind: 'spec_fact', text: text.length > 600 ? `${text.slice(0, 597)}…` : text, citations });
  }
  // P-034: say explicitly what the sources do not cover; no inference in this writer.
  if (missing.length) segments.push({ kind: 'uncertainty', text: `Źródła nie opisują: ${missing.join(', ')}.`, citations: [] });
  if (!segments.length) segments.push({ kind: 'uncertainty', text: 'Źródła nie zawierają danych dla tego pytania.', citations: [] });
  return { ...base, segments: segments.slice(0, MAX_SEGMENTS) };
}

export function answerTurn(question: string, catalogue: readonly StructuredEntry[], resolver = resolverFor(catalogue)): AssistantTurn {
  const plan = planTurn(question, catalogue, resolver);
  const answer = writeDeterministic(plan, catalogue);
  const citations = new Map(plan.evidence.flat().map((item) => [item.id, item.text]));
  const allowed = [...plan.rackets.map((entry) => entry.id), ...plan.resolutions.flatMap((item) => (item.status === 'ambiguous' ? item.ids : []))];
  const namesText = catalogue.filter((entry) => allowed.includes(entry.id)).map(racketName).join(' ');
  const result = validateAnswer(answer, { allowedRackets: allowed, evidence: citations, namesText });
  return { plan, answer, citations, validation: result.ok ? { ok: true } : { ok: false, violations: result.violations }, writer: 'deterministic-v1' };
}
