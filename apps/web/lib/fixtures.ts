import type { CatalogueEntry } from '@padlownia/database';
import type { IllustratedCatalogueEntry } from './catalogue-images';

// Authored synthetic examples, CC0. These are not claims about real rackets.
const evidence = (id: string, manufacturer = true) => ({
  observationId: id, sourceCode: manufacturer ? 'fixture-manufacturer' : 'fixture-editor',
  sourceName: manufacturer ? 'Syntetyczny producent' : 'Syntetyczna redakcja',
  sourceUrl: `https://example.invalid/fixtures/${id}`, retrievedAt: '2026-10-13T08:00:00Z', path: `fixture.${id}`,
  attribution: manufacturer ? { name: 'Syntetyczny producent', url: `https://example.invalid/manufacturer/${id}`, verified: true } : null,
});

function racket(id: string, model: string, year: number | null, variant: string, shape: string | null, min: number | null, max: number | null): CatalogueEntry {
  return {
    releaseId: 'fixture-release-01', id, brand: 'TESTLAB', model, variant, modelYear: year,
    shape, weightMinG: min, weightMaxG: max, balanceCm: null, core: null, surface: null,
    specs: [
      ...(shape ? [{ key: 'shape', rawValue: shape, normalizedText: shape, numericValue: null, valueMin: null, valueMax: null, unit: null,
        claimType: 'manufacturer_declared' as const, validationStatus: 'valid' as const, measurementContext: {}, selected: true, conflict: false, evidence: evidence(`${id}-shape`) }] : []),
      ...(min !== null && max !== null ? [{ key: 'weight', rawValue: `${(min + max) / 2} ± ${(max - min) / 2} g`, normalizedText: null, numericValue: null,
        valueMin: min, valueMax: max, unit: 'g', claimType: 'manufacturer_declared' as const, validationStatus: 'valid' as const, measurementContext: {},
        selected: true, conflict: false, evidence: evidence(`${id}-weight`) }] : []),
    ], ratings: [],
  };
}

export const fixtureCatalogue: IllustratedCatalogueEntry[] = [
  racket('fixture-orbit-control-2026', 'Orbit', 2026, 'Control', 'round', 360, 370),
  racket('fixture-orbit-control-2025', 'Orbit', 2025, 'Control', 'round', 355, 365),
  racket('fixture-orbit-pro-2026', 'Orbit', 2026, 'Pro', 'teardrop', 360, 375),
  racket('fixture-vector-attack-2026', 'Vector', 2026, 'Attack', 'diamond', 365, 375),
  racket('fixture-vector-lite-2026', 'Vector', 2026, 'Lite', 'teardrop', 345, 355),
  racket('fixture-arc-unknown', 'Arc', null, 'Standard', null, null, null),
];

for (const entry of [fixtureCatalogue[0]!, fixtureCatalogue[2]!]) entry.image = {
  racketId: entry.id, releaseId: entry.releaseId, url: '/media/rackets/fixture-orbit.svg',
  alt: `Ilustracja syntetycznej rakiety TESTLAB ${entry.model} ${entry.variant}; nie fotografia produktu`,
  credit: 'Ilustracja TESTLAB', sourceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  rightsStatus: 'approved', licence: 'CC0', permissionReference: 'https://creativecommons.org/publicdomain/zero/1.0/',
};

fixtureCatalogue[2]!.specs[0]!.conflict = true;
fixtureCatalogue[2]!.specs.push({
  key: 'shape', rawValue: 'Diamond', normalizedText: 'diamond', numericValue: null, valueMin: null, valueMax: null, unit: null,
  claimType: 'editorial_assessment', validationStatus: 'valid', measurementContext: {}, selected: false, conflict: true,
  evidence: evidence('orbit-pro-shape-secondary', false),
});
fixtureCatalogue[0]!.specs.push({
  key: 'weight', rawValue: '372 g with one overgrip', normalizedText: null, numericValue: 372, valueMin: 372, valueMax: 372, unit: 'g',
  claimType: 'measured_specimen', validationStatus: 'valid', measurementContext: { configuration: 'Jeden overgrip; pojedynczy egzemplarz' }, selected: false, conflict: false,
  evidence: evidence('orbit-control-measurement', false),
});
fixtureCatalogue[0]!.ratings.push({
  dimension: 'control', rawValue: '8/10', value: 8, scaleMin: 0, scaleMax: 10, kind: 'editorial', validationStatus: 'valid',
  methodology: 'Syntetyczny przykład oceny redakcyjnej, nie wynik testu prawdziwej rakiety.', evidence: evidence('orbit-control-editorial', false),
});
