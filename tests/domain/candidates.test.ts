import { describe, expect, it } from 'vitest';
import { candidateTokens, matchCandidates, scorePair, yearMismatches, type CandidateRacket } from '@padlownia/domain';

const r = (id: string, brand: string, model: string, modelYear: number | null, source: string, variant = ''): CandidateRacket => ({ id, brand, model, variant, modelYear, sources: [source] });

describe('candidateTokens', () => {
  it('drops brand, year, player signature, seller noise and unifies spellings', () => {
    expect(candidateTokens(r('a', 'Nox', 'Nox EA10 Ventus Attack 12K XTREME 2026 by Edu Alonso', 2026, 'x'))).toEqual(['ea10', 'ventus', 'attack', '12k', 'xtrem']);
    expect(candidateTokens(r('a', 'Nox', 'NOX EA10 Ventus Attack 12K XTREM 2026', 2026, 'x'))).toEqual(['ea10', 'ventus', 'attack', '12k', 'xtrem']);
    expect(candidateTokens(r('a', 'Hirostar', 'Hirostar Alien Pro 26 - Tolito Aguirre', 2026, 'x'))).toEqual(['alien', 'pro', '26']);
    expect(candidateTokens(r('a', 'QUAD', 'QUAD Leopard Padel Racket', null, 'x'))).toEqual(['leopard']);
  });
});

describe('scorePair', () => {
  it('proposes the same model written differently by two sources, with reasons', () => {
    const pair = scorePair(r('a', 'Nox', 'NOX EA10 Ventus Hybrid 12K XTREM 2026', 2026, 'padelhow'), r('b', 'Nox', 'Nox EA10 Ventus Hybrid 12K XTREME 2026 by Edu Alonso', 2026, 'padeltrue'));
    expect(pair).toMatchObject({ score: 1, confidence: 'high' });
    expect(pair!.reasons).toEqual(expect.arrayContaining(['same_brand', 'same_year', 'same_model_codes', 'same_model_words']));
  });
  it('accepts a missing year on one side and a canonical brand spelling', () => {
    expect(scorePair(r('a', 'STARVIE', 'StarVie Triton Power +', null, 'padelhow'), r('b', 'StarVie', 'StarVie Tritón Power+ 2026', 2026, 'padeltrue'))).toMatchObject({ reasons: expect.arrayContaining(['year_from_one_source']) });
  });
  it.each([
    ['different years are different products (P-024)', r('a', 'Head', 'HEAD Extreme One', 2026, 'padelhow'), r('b', 'Head', 'Head Extreme One 2025', 2025, 'padeltrue')],
    ['different generations', r('a', 'Cork', 'Cork Extreme Deus', 2025, 'padeltrue'), r('b', 'Cork', 'Cork Padel Extreme Deus II', null, 'padelhow')],
    ['different model codes', r('a', 'Bullpadel', 'Bullpadel Vertex 04 2025', 2025, 'padeltrue'), r('b', 'Bullpadel', 'Bullpadel Vertex 05 2025', 2025, 'padelhow')],
    ['different variant words', r('a', 'Nox', 'Nox Ventus Hybrid 12K Lite 2026', 2026, 'padeltrue'), r('b', 'Nox', 'Nox Ventus Hybrid 12K 2026', 2026, 'padelhow')],
    ['each name adds its own model word', r('a', 'Head', 'Head Extreme One X 2025', 2025, 'padeltrue'), r('b', 'Head', 'HEAD Speed One X 2025', 2025, 'padelhow')],
    ['same source', r('a', 'Nox', 'Nox X-One', null, 'padeltrue'), r('b', 'Nox', 'Nox X-One 2026', 2026, 'padeltrue')],
    ['different brands', r('a', 'Nox', 'Nox Ventus', 2026, 'padeltrue'), r('b', 'Siux', 'Siux Ventus', 2026, 'padelhow')],
  ])('never proposes: %s', (_label, left, right) => {
    expect(scorePair(left, right)).toBeNull();
  });
});

describe('matchCandidates', () => {
  it('flags a racket that appears in more than one candidate as ambiguous instead of choosing', () => {
    const base = r('a', 'Siux', 'SIUX Diablo Pro 2026', 2026, 'padelhow');
    const list = matchCandidates([base, r('b', 'Siux', 'Siux Diablo Pro 2026 Night Blue', 2026, 'padeltrue'), r('c', 'Siux', 'Siux Diablo Pro 2026 Royal Blue', 2026, 'padeltrue')]);
    expect(list).toHaveLength(2);
    expect(list.every((pair) => pair.ambiguous)).toBe(true);
  });
  it('lists same-name, different-year pairs separately for information only', () => {
    expect(yearMismatches([r('a', 'Bullpadel', 'Bullpadel Icon 2026', 2026, 'padelhow'), r('b', 'Bullpadel', 'Bullpadel Icon 2027', 2027, 'padeltrue')])).toHaveLength(1);
  });
});
