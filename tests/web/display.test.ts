import { describe, expect, it } from 'vitest';
import type { CatalogueEntry } from '@padlownia/database';
import { displayBrand, displayLabel, displayMaterial, displayModel, displayVariant } from '../../apps/web/lib/display';

type Fields = Pick<CatalogueEntry, 'brand' | 'model' | 'variant' | 'modelYear'>;
const entry = (overrides: Partial<Fields> = {}): Fields => ({
  brand: 'NOX', model: 'ML10', variant: 'Pro', modelYear: 2027, ...overrides,
});

describe('displayModel', () => {
  it('strips the brand prefix and the trailing model year', () => {
    expect(displayModel({ brand: 'Adidas', model: 'adidas Arrow Hit 2026', modelYear: 2026 })).toBe('Arrow Hit');
  });
  it('matches the brand prefix case-insensitively', () => {
    expect(displayModel({ brand: 'NOX', model: 'Nox ML10', modelYear: null })).toBe('ML10');
  });
  it('matches the brand prefix with Polish letters using the pl locale', () => {
    expect(displayModel({ brand: 'Ślęża', model: 'ŚLĘŻA Pro 2025', modelYear: 2025 })).toBe('Pro');
  });
  it('does not strip a brand that is only a partial word of the model', () => {
    expect(displayModel({ brand: 'Ad', model: 'Adidas Arrow', modelYear: null })).toBe('Adidas Arrow');
  });
  it('keeps a model equal to the brand as it is', () => {
    expect(displayModel({ brand: 'NOX', model: 'NOX', modelYear: 2027 })).toBe('NOX');
  });
  it('keeps the year when it sits inside the model name', () => {
    expect(displayModel({ brand: 'Head', model: 'Arrow 2026 Hit', modelYear: 2026 })).toBe('Arrow 2026 Hit');
  });
  it('keeps a leading year that is not the model year', () => {
    expect(displayModel({ brand: 'Head', model: '2026 World Cup Argentina', modelYear: 2026 })).toBe('2026 World Cup Argentina');
  });
  it('keeps a trailing year when the model year is unknown', () => {
    expect(displayModel({ brand: 'Adidas', model: 'Arrow Hit 2026', modelYear: null })).toBe('Arrow Hit 2026');
  });
  it('keeps a trailing year that differs from the model year', () => {
    expect(displayModel({ brand: 'Adidas', model: 'Arrow Hit 2026', modelYear: 2025 })).toBe('Arrow Hit 2026');
  });
  it('does not mutate the entry and treats __proto__ as a plain value', () => {
    const fields = { brand: 'NOX', model: '__proto__', modelYear: null };
    expect(displayModel(fields)).toBe('__proto__');
    expect(fields).toEqual({ brand: 'NOX', model: '__proto__', modelYear: null });
  });
});

describe('displayVariant', () => {
  it('capitalises words and keeps acronyms in capitals', () => {
    expect(displayVariant('ctrl pro')).toBe('CTRL Pro');
  });
  it('returns null for an empty or blank variant', () => {
    expect(displayVariant('')).toBeNull();
    expect(displayVariant('   ')).toBeNull();
  });
  it('recognises numbered acronyms', () => {
    expect(displayVariant('hr3 eva')).toBe('HR3 EVA');
    expect(displayVariant('12k')).toBe('12K');
  });
  it('leaves already capitalised words unchanged', () => {
    expect(displayVariant('EVA Pro')).toBe('EVA Pro');
  });
  it('does not crash on __proto__ or constructor as a variant', () => {
    expect(displayVariant('__proto__')).toBe('__Proto__');
    expect(displayVariant('constructor')).toBe('Constructor');
  });
});

describe('displayMaterial', () => {
  it('capitalises only the first letter of the text', () => {
    expect(displayMaterial('aluminised fibreglass (fiber glass silver)')).toBe('Aluminised fibreglass (fiber glass silver)');
  });
  it('uppercases acronyms and keeps them when they are first', () => {
    expect(displayMaterial('hr3 eva')).toBe('HR3 EVA');
  });
  it('keeps acronyms attached to punctuation', () => {
    expect(displayMaterial('carbon (fiber, mtw),')).toBe('Carbon (fiber, MTW),');
  });
  it('returns null for null or blank input', () => {
    expect(displayMaterial(null)).toBeNull();
    expect(displayMaterial('  ')).toBeNull();
  });
});

describe('displayBrand', () => {
  it('keeps all-caps brands unchanged', () => {
    expect(displayBrand('NOX')).toBe('NOX');
    expect(displayBrand('TESTLAB')).toBe('TESTLAB');
  });
  it('capitalises the first letter of a lowercase brand', () => {
    expect(displayBrand('adidas')).toBe('Adidas');
    expect(displayBrand('ślęża')).toBe('Ślęża');
  });
  it('keeps an already capitalised brand unchanged', () => {
    expect(displayBrand('Adidas')).toBe('Adidas');
  });
  it('keeps the rest of a mixed-case brand unchanged', () => {
    expect(displayBrand('NoX')).toBe('NoX');
  });
});

describe('displayLabel', () => {
  it('joins brand, model, variant and year with middle dots', () => {
    expect(displayLabel({ brand: 'NOX', model: 'ML10 Pro Cup COORP by Miguel Lamperti', variant: 'pro', modelYear: 2027 }))
      .toBe('NOX · ML10 Pro Cup COORP by Miguel Lamperti · Pro · 2027');
  });
  it('uses the placeholders for an unknown variant and year', () => {
    expect(displayLabel(entry({ variant: '', modelYear: null }))).toBe('NOX · ML10 · wariant nieustalony · rok nieznany');
  });
  it('applies the model and brand formatting rules', () => {
    expect(displayLabel({ brand: 'adidas', model: 'adidas Arrow Hit 2026', variant: 'ctrl pro', modelYear: 2026 }))
      .toBe('Adidas · Arrow Hit · CTRL Pro · 2026');
  });
  it('does not crash on __proto__ as a brand', () => {
    expect(displayLabel(entry({ brand: '__proto__', model: 'X', variant: 'Pro', modelYear: null })))
      .toBe('__Proto__ · X · Pro · rok nieznany');
  });
});
