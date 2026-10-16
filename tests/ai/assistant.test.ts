import { describe, expect, it } from 'vitest';
import { answerTurn, planTurn, racketName, type StructuredEntry } from '@padlownia/ai';

const evidence = (observationId: string, sourceCode = 'padelhow', sourceName = 'padel.how') => ({ observationId, sourceCode, sourceName });
const entry = (id: string, brand: string, model: string, modelYear: number | null, power: number | null, extra: Partial<StructuredEntry> = {}): StructuredEntry => ({
  id, brand, model, variant: '', modelYear,
  specs: [{ key: 'shape', normalizedText: 'round', numericValue: null, valueMin: null, valueMax: null, unit: null, conflict: false, validationStatus: 'valid', evidence: evidence(`${id}-shape`) }],
  ratings: power === null ? [] : [{ dimension: 'power_ceiling', value: power, scaleMin: 0, scaleMax: 10, kind: 'editorial', evidence: evidence(`${id}-power`) }],
  ...extra,
});
const catalogue = [
  entry('viper', 'Babolat', 'Babolat Air Viper 2.6', 2026, 8),
  entry('vertex', 'Bullpadel', 'Bullpadel Vertex 05', 2027, 7),
  entry('genius-12', 'Nox', 'Nox AT10 Genius 12K', 2025, 6),
  entry('genius-18', 'Nox', 'Nox AT10 Genius 18K', 2025, null),
];

describe('assistant turn (deterministic writer)', () => {
  it('answers "stats of X" only from cited catalogue evidence and passes the server checks', () => {
    const turn = answerTurn('Jaka jest moc Babolat Air Viper 2.6?', catalogue);
    expect(turn.answer).toMatchObject({ intent: 'stats', rackets: ['viper'] });
    expect(turn.validation.ok).toBe(true);
    const power = turn.answer.segments.find((segment) => segment.kind === 'spec_fact')!;
    expect(power.citations).toEqual(['viper-power']);
    expect(power.text).toContain('8/10');
  });
  it('compares two rackets per aspect without a winner or a combined score', () => {
    const turn = answerTurn('Porównaj moc Babolat Air Viper 2.6 i Bullpadel Vertex 05', catalogue);
    expect(turn.answer.intent).toBe('compare');
    expect(turn.validation.ok).toBe(true);
    const text = turn.answer.segments.map((segment) => segment.text).join(' ');
    expect(text).toContain(racketName(catalogue[0]!));
    expect(text).toContain(racketName(catalogue[1]!));
    expect(text).not.toMatch(/lepsz|wygrywa|zwyci|łącznie/i);
  });
  it('says what the sources do not cover instead of guessing (P-034)', () => {
    const turn = answerTurn('Jak Babolat Air Viper 2.6 sprawdza się w obronie?', catalogue);
    expect(turn.answer.segments).toEqual([expect.objectContaining({ kind: 'uncertainty', text: 'Źródła nie opisują: obrona.' })]);
    expect(turn.validation.ok).toBe(true);
  });
  it('asks instead of picking when the racket is ambiguous, offering only known IDs', () => {
    const turn = answerTurn('statystyki Nox AT10 Genius', catalogue);
    expect(turn.answer.intent).toBe('clarify');
    expect(turn.answer.clarification!.options.sort()).toEqual(['genius-12', 'genius-18']);
    expect(turn.validation.ok).toBe(true);
  });
  it('does not treat words of a racket name as the question aspect', () => {
    const named = [...catalogue, entry('ionic', 'Bullpadel', 'Bullpadel Ionic Control', 2026, 5)];
    expect(planTurn('statystyki Bullpadel Ionic Control', named).asked).toEqual([]);
    expect(planTurn('jaka kontrola w Bullpadel Ionic Control?', named).asked).toEqual(['control']);
  });
  it('reports an unknown racket without inventing one', () => {
    const turn = answerTurn('jaka rakieta do obrony?', catalogue);
    expect(turn.answer).toMatchObject({ intent: 'out_of_scope', rackets: [] });
    expect(turn.validation.ok).toBe(true);
  });
});
