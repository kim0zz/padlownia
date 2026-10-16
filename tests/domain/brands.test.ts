import { describe, expect, it } from 'vitest';
import { brandSpellings, canonicalBrand } from '@padlownia/domain';

describe('canonicalBrand', () => {
  it('merges source spellings of one brand into a single display name', () => {
    expect(canonicalBrand('Cork Padel')).toBe('Cork');
    expect(canonicalBrand('Cork')).toBe('Cork');
    expect(canonicalBrand('STARVIE')).toBe('StarVie');
    expect(canonicalBrand('StarVie')).toBe('StarVie');
    expect(canonicalBrand('star vie')).toBe('StarVie');
  });

  it('replaces all-caps source spellings of known brands', () => {
    expect(canonicalBrand('QUAD')).toBe('Quad');
    expect(canonicalBrand('SANE')).toBe('Sane');
    expect(canonicalBrand('VOLT')).toBe('Volt');
    expect(canonicalBrand('NOX')).toBe('Nox');
  });

  it('keeps unknown brands as published, only trimmed', () => {
    expect(canonicalBrand(' Royal Padel ')).toBe('Royal Padel');
    expect(canonicalBrand('TESTLAB')).toBe('TESTLAB');
    expect(canonicalBrand('')).toBe('');
  });
});

describe('brandSpellings', () => {
  it('lists the canonical name first, then aliases', () => {
    expect(brandSpellings('Cork')).toEqual(['Cork', 'Cork Padel']);
    expect(brandSpellings('Cork Padel')).toEqual(['Cork', 'Cork Padel']);
  });

  it('returns the brand itself when it is not in the table', () => {
    expect(brandSpellings('Bullpadel')).toEqual(['Bullpadel']);
  });
});
