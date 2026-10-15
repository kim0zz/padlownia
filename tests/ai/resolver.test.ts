import { describe, expect, it } from 'vitest';
import { RacketResolver, resolverTokens } from '@padlownia/ai';

// Synthetic catalogue with the real traps: variants, model years, S/W, 12K/18K, shared words across brands.
const resolver = new RacketResolver([
  { id: 'orbit-2026', brand: 'TESTLAB', name: 'TESTLAB Orbit 2026', year: 2026 },
  { id: 'orbit-light-2026', brand: 'TESTLAB', name: 'TESTLAB Orbit Light 2026', year: 2026 },
  { id: 'orbit-2025', brand: 'TESTLAB', name: 'TESTLAB Orbit 2025', year: 2025 },
  { id: 'nova-12k', brand: 'TESTLAB', name: 'TESTLAB Nova Genius 12K', year: 2026 },
  { id: 'nova-18k', brand: 'TESTLAB', name: 'TESTLAB Nova Genius 18K', year: 2026 },
  { id: 'nova-attack-18k', brand: 'TESTLAB', name: 'TESTLAB Nova Genius Attack 18K', year: 2026 },
  { id: 'cube-s', brand: 'Vario', name: 'Vario Cube Elbowcare S', year: null },
  { id: 'cube-w', brand: 'Vario', name: 'Vario Cube Elbowcare W', year: null },
  { id: 'pure-court', brand: 'Dogs', name: 'Dogs Pure Court', year: 2026 },
  { id: 'raptor-plus', brand: 'StarVie', name: 'StarVie Raptor+ 2026', year: 2026 },
  { id: 'air-viper', brand: 'Babolat', name: 'Babolat Air Viper', year: null },
]);

describe('RacketResolver', () => {
  it('resolves an exact product, folding case, diacritics and "+"', () => {
    expect(resolver.resolve('starvie raptor plus')).toMatchObject({ status: 'resolved', id: 'raptor-plus' });
    expect(resolver.resolve('StarVie Raptor+')).toMatchObject({ status: 'resolved', id: 'raptor-plus' });
    expect(resolver.resolve('TESTLAB Orbit Light 2026')).toMatchObject({ status: 'resolved', id: 'orbit-light-2026' });
  });

  it('never picks one model year silently', () => {
    expect(resolver.resolve('TESTLAB Orbit')).toMatchObject({ status: 'ambiguous', ids: expect.arrayContaining(['orbit-2026', 'orbit-2025']) });
    expect(resolver.resolve('Orbit 2025')).toMatchObject({ status: 'resolved', id: 'orbit-2025' });
    expect(resolver.resolve('Orbit 2024')).toMatchObject({ status: 'not_found' });
  });

  it('offers more specific siblings as alternatives and excludes contradicting variants', () => {
    const result = resolver.resolve('Nova 18K');
    expect(result).toMatchObject({ status: 'resolved', id: 'nova-18k', alternatives: ['nova-attack-18k'] });
    expect(resolver.resolve('Nova Light')).toMatchObject({ status: 'not_found' });
  });

  it('treats a capital S/W as a variant but lowercase w as a Polish preposition', () => {
    expect(resolver.resolve('Vario Cube Elbowcare W')).toMatchObject({ status: 'resolved', id: 'cube-w' });
    expect(resolver.resolve('Vario Cube Elbowcare S')).toMatchObject({ status: 'resolved', id: 'cube-s' });
    expect(resolver.resolve('w Vario Cube Elbowcare')).toMatchObject({ status: 'ambiguous', ids: expect.arrayContaining(['cube-s', 'cube-w']) });
    expect(resolverTokens('Elbowcare W i w domu')).toEqual(['elbowcare', 'variantw', 'i', 'w', 'domu']);
  });

  it('a named catalogue brand excludes other brands; generic questions match nothing', () => {
    expect(resolver.resolve('Babolat Pure Drive')).toMatchObject({ status: 'not_found' });
    // Known limitation: a brand absent from the catalogue cannot exclude anything, so a shared word still matches.
    expect(resolver.resolve('Wilson Pure Court')).toMatchObject({ status: 'resolved', id: 'pure-court' });
    expect(resolver.resolve('Szukam miękkiej rakiety do obrony')).toMatchObject({ status: 'not_found' });
    expect(resolver.resolve('TESTLAB')).toMatchObject({ status: 'not_found' });
  });

  it('tolerates one typo in long words', () => {
    expect(resolver.resolve('Vario Cube Elbowcar S')).toMatchObject({ status: 'resolved', id: 'cube-s' });
  });

  it('finds both rackets of a comparison, including elliptical variants', () => {
    expect(resolver.resolveAll('Porównaj StarVie Raptor+ i Orbit Light 2026').map((item) => item.status === 'resolved' && item.id)).toEqual(['raptor-plus', 'orbit-light-2026']);
    const pair = resolver.resolveAll('TESTLAB Nova Genius 12K czy 18K');
    expect(pair).toHaveLength(2);
    expect(pair[0]).toMatchObject({ status: 'resolved', id: 'nova-12k' });
    expect(pair[1]).toMatchObject({ status: 'resolved', id: 'nova-18k' });
  });
});
