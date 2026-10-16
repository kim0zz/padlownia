import { describe, expect, it } from 'vitest';
import { coveredAspects, detectAspects, stripNames, structuredEvidence, validateAnswer, type StructuredEntry } from '@padlownia/ai';

// Synthetic entry in the published-catalogue shape; IDs are invented, values are not real source data.
const evidence = (id: string, sourceCode = 'padelhow', sourceName = 'padel.how') => ({ observationId: id, sourceCode, sourceName });
const rating = (dimension: string, value: number, id: string, source: 'padelhow' | 'padeltrue' = 'padelhow') => ({
  dimension, value, scaleMin: 0, scaleMax: source === 'padelhow' ? 10 : 100, kind: source === 'padelhow' ? 'editorial' : 'rule_derived',
  evidence: source === 'padelhow' ? evidence(id) : evidence(id, 'padeltrue', 'PadelTrue'),
});
const spec = (key: string, fields: Partial<StructuredEntry['specs'][number]>, id: string) => ({
  key, normalizedText: null, numericValue: null, valueMin: null, valueMax: null, unit: null, conflict: false, validationStatus: 'valid', evidence: evidence(id), ...fields,
});
const entry: StructuredEntry = {
  id: 'orbit', brand: 'TESTLAB', model: 'Orbit Control', variant: '', modelYear: 2026,
  ratings: [rating('power_ceiling', 9, 'r-power'), rating('power_accessibility', 7.5, 'r-access'), rating('defensive_output', 6.5, 'r-def'), rating('comfort', 45, 'r-pt-comfort', 'padeltrue')],
  specs: [
    spec('weight', { numericValue: null, rawValue: '321 g without grip; roughly +20 g assembled', validationStatus: 'unknown' }, 's-weight'),
    spec('shape', { normalizedText: 'diamond', conflict: true }, 's-shape'),
    spec('balance', { numericValue: 26.5, valueMin: 26.5, valueMax: 26.5, unit: 'cm' }, 's-balance'),
  ],
};

describe('detectAspects', () => {
  it.each([
    ['Jak zachowuje się przy smeczu?', ['power']],
    ['Czy jest dobra dla kogoś z bólem łokcia?', ['comfort']],
    ['Jak broni z tyłu kortu i jak gra przy siatce?', ['defense', 'net']],
    ['Czy jest miękka czy twarda?', ['stiffness']],
    ['Ile waży i jaki ma balans?', ['weight', 'balance']],
    ['Czy nadaje się dla początkującego?', ['level']],
    ['Czy jest wytrzymała?', ['durability']],
    ['Czym różni się od poprzedniej wersji?', []],
    ['Szukam rakiety damskiej na lewą stronę do ataku', ['target', 'court_side', 'style']],
    ['Coś dla dziecka, junior', ['target']],
  ])('%s → %j', (question, aspects) => expect(detectAspects(question)).toEqual(aspects));

  it('ignores racket names once stripped: "Ventus Control 12K" is not a question about control or materials', () => {
    const question = 'Czy NOX ML10 Ventus Control 12K dobrze broni?';
    expect(detectAspects(question)).toEqual(expect.arrayContaining(['control', 'materials', 'defense']));
    expect(detectAspects(stripNames(question, 'NOX ML10 Ventus Control 12K'))).toEqual(['defense']);
  });

  it('does not read "Babolat" as pain ("ból")', () => {
    expect(detectAspects('Babolat Air Viper przy siatce')).toEqual(['net']);
  });
});

describe('structuredEvidence', () => {
  it('turns ratings into citable lines that name the source, kind and scale', () => {
    const items = structuredEvidence(entry, ['power']);
    expect(items.map((item) => item.id)).toEqual(['r-power', 'r-access']);
    expect(items[0]!.text).toBe('padel.how (ocena redakcji): moc maksymalna 9/10');
    expect(items[1]!.text).toBe('padel.how (ocena redakcji): łatwość generowania mocy 7,5/10');
  });

  it('keeps PadelTrue on its own 0–100 rule-derived scale', () => {
    expect(structuredEvidence(entry, ['comfort'])[0]!.text).toBe('PadelTrue (ocena wyliczona z parametrów): komfort 45/100');
  });

  it('falls back to the source wording when normalization left no value, and flags conflicts and unverified data', () => {
    expect(structuredEvidence(entry, ['weight'])[0]!.text).toBe('padel.how: waga „321 g without grip; roughly +20 g assembled” (oryginalny zapis źródła) (niezweryfikowane)');
    expect(structuredEvidence(entry, ['shape'])[0]).toMatchObject({ conflict: true, text: 'padel.how: kształt diamond (źródła podają różne wartości)' });
  });

  it('reports which asked aspects the catalogue can answer, and lists everything for a general question', () => {
    expect(coveredAspects(entry, ['power', 'net', 'durability', 'balance'])).toEqual(['power', 'balance']);
    expect(structuredEvidence(entry, []).length).toBe(7);
  });

  it('uses the new editorial classifications and the relative stiffness index', () => {
    const classified: StructuredEntry = { ...entry,
      ratings: [...entry.ratings, { ...rating('stiffness_index', 72, 'r-stiff'), scaleMax: 100 }],
      specs: [...entry.specs, spec('court_side', { normalizedText: 'left' }, 's-side'), spec('profile_tags', { normalizedText: 'arm-friendly|control' }, 's-tags')] };
    expect(structuredEvidence(classified, ['court_side'])[0]!.text).toBe('padel.how: strona kortu left');
    expect(structuredEvidence(classified, ['stiffness'])[0]!.text).toBe('padel.how (ocena redakcji): indeks sztywności (względny w katalogu padel.how) 72/100');
    expect(structuredEvidence(classified, ['comfort']).map((item) => item.id)).toContain('s-tags');
  });

  it('feeds the answer validator: numbers must come from the cited evidence lines', () => {
    const lines = new Map(structuredEvidence(entry, ['power', 'defense']).map((item) => [item.id, item.text]));
    const answer = (text: string) => ({ version: 1, intent: 'stats', rackets: ['orbit'], segments: [{ kind: 'spec_fact', text, citations: ['r-power', 'r-def'] }] });
    expect(validateAnswer(answer('Moc maksymalna 9/10, obrona 6,5/10 (padel.how).'), { allowedRackets: ['orbit'], evidence: lines }).ok).toBe(true);
    expect(validateAnswer(answer('Moc maksymalna 9,5/10.'), { allowedRackets: ['orbit'], evidence: lines }).violations).toContainEqual({ code: 'ungrounded_number', segment: 0, number: '9,5' });
  });
});
