import type { SectionKind } from './chunking';

/**
 * Structured evidence: answer from the catalogue's numbers and specs first, prose second.
 * A question is mapped to aspects (deterministic keywords), each aspect to rating dimensions and
 * spec keys per source, and every value becomes a citable evidence item keyed by its observation ID.
 * Scales are never mixed: padel.how ratings are editorial 0–10, PadelTrue ratings are rule-derived 0–100.
 */

/** Minimal shape of a published catalogue entry (`@padlownia/database` CatalogueEntry) this module reads. */
export interface StructuredEntry {
  id: string; brand: string; model: string; variant: string; modelYear: number | null;
  specs: { key: string; rawValue?: unknown; normalizedText: string | null; numericValue: number | null; valueMin: number | null; valueMax: number | null; unit: string | null;
    conflict: boolean; validationStatus: string; evidence: { observationId: string; sourceCode: string; sourceName: string } }[];
  ratings: { dimension: string; value: number | null; scaleMin: number | null; scaleMax: number | null; kind: string;
    evidence: { observationId: string; sourceCode: string; sourceName: string } }[];
}

export const ASPECT_IDS = ['power', 'control', 'defense', 'net', 'sweet_spot', 'stability', 'spin', 'handling', 'comfort', 'stiffness',
  'level', 'style', 'target', 'shape', 'weight', 'balance', 'materials', 'core', 'thickness', 'court_side', 'durability'] as const;
export type Aspect = typeof ASPECT_IDS[number];

interface AspectDefinition {
  label: string;
  /** Matched against the question lowercased, without diacritics. */
  keywords: RegExp;
  ratings: { source: 'padelhow' | 'padeltrue'; dimension: string }[];
  specs: string[];
  /** Review sections that usually discuss this aspect (for retrieval and evals). */
  reviewKinds: SectionKind[];
}

export const ASPECTS: Record<Aspect, AspectDefinition> = {
  power: { label: 'moc', keywords: /smecz|smash|\bmoc|mocn|power|\bsil[aey]\b|punch|wykonczy|konczy punkt|x3|x4/,
    ratings: [{ source: 'padelhow', dimension: 'power_ceiling' }, { source: 'padelhow', dimension: 'power_accessibility' }, { source: 'padeltrue', dimension: 'power' }],
    specs: [], reviewKinds: ['power'] },
  control: { label: 'kontrola', keywords: /kontrol|control|precyz/,
    ratings: [{ source: 'padelhow', dimension: 'control' }, { source: 'padeltrue', dimension: 'control' }], specs: [], reviewKinds: ['takeaways', 'positioning', 'sweet_spot'] },
  defense: { label: 'obrona', keywords: /obron|broni|defen|\blob|z tylu kortu|od szyby|szyb[ay]/,
    ratings: [{ source: 'padelhow', dimension: 'defensive_output' }], specs: [], reviewKinds: ['defense', 'takeaways', 'positioning', 'stability'] },
  net: { label: 'gra przy siatce', keywords: /siatk|siatc|wolej|volley|\bnet\b|szybkich wymian/,
    ratings: [{ source: 'padelhow', dimension: 'net_performance' }], specs: [], reviewKinds: ['net'] },
  sweet_spot: { label: 'sweet spot', keywords: /sweet ?spot|wybacza|forgiv/,
    ratings: [{ source: 'padelhow', dimension: 'sweet_spot' }, { source: 'padeltrue', dimension: 'forgiveness' }], specs: [], reviewKinds: ['sweet_spot'] },
  stability: { label: 'stabilność', keywords: /stabil|poza srodk|off.?cent|skreca|torsi/,
    ratings: [{ source: 'padelhow', dimension: 'off_center_stability' }, { source: 'padeltrue', dimension: 'forgiveness' }], specs: [], reviewKinds: ['stability', 'sweet_spot'] },
  spin: { label: 'rotacja', keywords: /rotac|podkrec|\bspin|kick|vibor|bandej|szorstk|chropow|faktur/,
    ratings: [{ source: 'padelhow', dimension: 'spin_generation' }], specs: ['texture'], reviewKinds: ['spin', 'power', 'construction'] },
  handling: { label: 'zwrotność', keywords: /zwrotn|w rece|w reku|manewr|maneuv|handling|prowadz/,
    ratings: [{ source: 'padelhow', dimension: 'maneuverability' }, { source: 'padeltrue', dimension: 'handling' }], specs: ['weight', 'balance'], reviewKinds: ['handling', 'net', 'shape'] },
  comfort: { label: 'komfort', keywords: /komfort|wygod|lokc|lokiec|ramie|ramien|na reke|wibrac|elbow|\barm\b|comfort|\bbol/,
    ratings: [{ source: 'padelhow', dimension: 'comfort' }, { source: 'padeltrue', dimension: 'comfort' }], specs: ['firmness', 'core', 'profile_tags'], reviewKinds: ['feel', 'takeaways'] },
  stiffness: { label: 'twardość', keywords: /tward|miekk|sztywn|stiff|\bsoft\b|\bhard\b|odczuci|\bfeel\b/,
    ratings: [{ source: 'padelhow', dimension: 'stiffness_index' }], specs: ['firmness', 'core'], reviewKinds: ['feel', 'construction'] },
  level: { label: 'poziom gracza', keywords: /poczatkuj|beginner|zaawansow|advanced|srednio ?zaaw|intermediate|poziom|dla kogo\b|dla jakiego gracza|nadaje sie dla/,
    ratings: [{ source: 'padelhow', dimension: 'power_accessibility' }, { source: 'padelhow', dimension: 'sweet_spot' }], specs: ['player_level', 'demand', 'profile_tags'], reviewKinds: ['positioning', 'takeaways'] },
  style: { label: 'styl gry', keywords: /styl gry|do ataku|ofensyw|atakuj|wszechstronn|all.?round|do obrony|defensyw|kontrolersk/,
    ratings: [], specs: ['play_style'], reviewKinds: ['positioning', 'takeaways'] },
  target: { label: 'przeznaczenie', keywords: /damsk|kobiet|\bwomen|\blady|junior|dzieci|dziecka|mlodziez|dla dziewczyn/,
    ratings: [], specs: ['gender', 'junior'], reviewKinds: ['positioning', 'identification'] },
  shape: { label: 'kształt', keywords: /ksztalt|shape|diament|diamond|\blz[ay]?\b|teardrop|okragl|\bround\b|hybryd/,
    ratings: [], specs: ['shape'], reviewKinds: ['shape'] },
  weight: { label: 'waga', keywords: /\bwag[aię]|wazy|wazi|gram|weigh|ciezk|lekk/, ratings: [], specs: ['weight'], reviewKinds: ['construction', 'handling', 'faq'] },
  balance: { label: 'balans', keywords: /balans|balance|w glowie|glowow/, ratings: [], specs: ['balance'], reviewKinds: ['construction', 'handling'] },
  materials: { label: 'materiały', keywords: /material|zrobion|carbon|karbon|wegl|wlokn|fiber|szklan|\bglass|\d+k\b|\brama|frame/,
    ratings: [], specs: ['surface', 'frame'], reviewKinds: ['construction'] },
  core: { label: 'rdzeń', keywords: /rdzen|rdzeni|piank|\beva\b|foam|\bcore/, ratings: [], specs: ['core'], reviewKinds: ['construction'] },
  thickness: { label: 'grubość', keywords: /grubos|thick|\d+ ?mm\b/, ratings: [], specs: ['thickness'], reviewKinds: ['construction'] },
  // padel.how editorial classification (imported from parser 1.3.0).
  court_side: { label: 'strona kortu', keywords: /lew[aąey]? stron|praw[aąey]? stron|\blew[aey]\b|\bpraw[aey]\b|left side|right side|strona kortu/,
    ratings: [], specs: ['court_side'], reviewKinds: ['positioning', 'takeaways', 'verdict', 'faq'] },
  durability: { label: 'wytrzymałość', keywords: /wytrzymal|durab|trwal|pek|zlam/, ratings: [], specs: [], reviewKinds: ['construction', 'faq'] },
};

const fold = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();

/** Aspects a question asks about, in order of first mention. Empty means "general" (profile/overview). */
export function detectAspects(question: string): Aspect[] {
  const text = fold(question);
  return ASPECT_IDS.map((aspect) => ({ aspect, index: text.search(ASPECTS[aspect].keywords) }))
    .filter((item) => item.index >= 0).sort((left, right) => left.index - right.index).map((item) => item.aspect);
}

const RATING_LABELS: Record<string, string> = {
  power_ceiling: 'moc maksymalna', power_accessibility: 'łatwość generowania mocy', control: 'kontrola', defensive_output: 'obrona',
  net_performance: 'gra przy siatce', sweet_spot: 'sweet spot', off_center_stability: 'stabilność poza środkiem', spin_generation: 'rotacja',
  maneuverability: 'zwrotność', comfort: 'komfort', overall: 'ocena ogólna', stiffness_index: 'indeks sztywności (względny w katalogu padel.how)', power: 'moc', handling: 'prowadzenie', forgiveness: 'wybaczalność', value: 'jakość do ceny',
};
const SPEC_LABELS: Record<string, string> = {
  shape: 'kształt', weight: 'waga', balance: 'balans', core: 'rdzeń', surface: 'materiał powierzchni', texture: 'faktura', thickness: 'grubość',
  player_level: 'poziom gracza', firmness: 'twardość', frame: 'rama', court_side: 'strona kortu', play_style: 'styl gry', demand: 'wymagalność',
  gender: 'przeznaczenie', junior: 'juniorska', profile_tags: 'tagi profilu',
};
const KIND_LABELS: Record<string, string> = { editorial: 'ocena redakcji', rule_derived: 'ocena wyliczona z parametrów' };

export interface StructuredEvidence {
  /** Observation ID: the citation the answer contract and validator use. */
  id: string;
  type: 'rating' | 'spec';
  aspect: Aspect;
  source: string;
  key: string;
  /** One self-contained line shown to the model and checked by the validator (numbers must come from here). */
  text: string;
  conflict: boolean;
}

const number = (value: number) => String(value).replace('.', ',');

function specValue(spec: StructuredEntry['specs'][number]): string | null {
  const unit = spec.unit ? ` ${spec.unit}` : '';
  const raw = typeof spec.rawValue === 'string' ? spec.rawValue.trim().slice(0, 160) : '';
  let value: string | null = null;
  if (spec.valueMin !== null && spec.valueMax !== null && spec.valueMin !== spec.valueMax) value = `${number(spec.valueMin)}–${number(spec.valueMax)}${unit}`;
  else if (spec.numericValue !== null) value = `${number(spec.numericValue)}${unit}`;
  else if (spec.normalizedText?.trim()) value = spec.normalizedText.trim();
  // The source's own wording carries context the number drops ("without grip", "+20 g assembled").
  if (!value) return raw ? `„${raw}” (oryginalny zapis źródła)` : null;
  return raw && /[a-z]{4,}/i.test(raw) && !raw.toLowerCase().includes(value.toLowerCase()) ? `${value} (zapis źródła: „${raw}”)` : value;
}

/** Citable rating/spec lines of one racket for the asked aspects (all aspects with data when none were asked). */
export function structuredEvidence(entry: StructuredEntry, aspects: Aspect[]): StructuredEvidence[] {
  const wanted = aspects.length ? aspects : ASPECT_IDS.filter((aspect) => ASPECTS[aspect].ratings.length || ASPECTS[aspect].specs.length);
  const items: StructuredEvidence[] = [];
  const seen = new Set<string>();
  for (const aspect of wanted) {
    const definition = ASPECTS[aspect];
    for (const wantedRating of definition.ratings) {
      for (const rating of entry.ratings) {
        if (rating.dimension !== wantedRating.dimension || rating.evidence.sourceCode !== wantedRating.source || rating.value === null) continue;
        if (seen.has(rating.evidence.observationId)) continue;
        seen.add(rating.evidence.observationId);
        const scale = rating.scaleMax !== null ? `/${number(rating.scaleMax)}` : '';
        items.push({ id: rating.evidence.observationId, type: 'rating', aspect, source: rating.evidence.sourceName, key: rating.dimension, conflict: false,
          text: `${rating.evidence.sourceName} (${KIND_LABELS[rating.kind] ?? rating.kind}): ${RATING_LABELS[rating.dimension] ?? rating.dimension} ${number(rating.value)}${scale}` });
      }
    }
    for (const key of definition.specs) {
      for (const spec of entry.specs) {
        if (spec.key !== key || seen.has(spec.evidence.observationId)) continue;
        const value = specValue(spec);
        if (!value) continue;
        seen.add(spec.evidence.observationId);
        const flags = [spec.conflict ? 'źródła podają różne wartości' : '', spec.validationStatus !== 'valid' ? 'niezweryfikowane' : ''].filter(Boolean).join(', ');
        items.push({ id: spec.evidence.observationId, type: 'spec', aspect, source: spec.evidence.sourceName, key, conflict: spec.conflict,
          text: `${spec.evidence.sourceName}: ${SPEC_LABELS[key] ?? key} ${value}${flags ? ` (${flags})` : ''}` });
      }
    }
  }
  return items;
}

/** Aspects of a question the catalogue can answer with numbers/specs for this racket. */
export function coveredAspects(entry: StructuredEntry, aspects: Aspect[]): Aspect[] {
  return aspects.filter((aspect) => structuredEvidence(entry, [aspect]).length > 0);
}
