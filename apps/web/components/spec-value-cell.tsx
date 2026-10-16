import type { CatalogueSpec } from '@padlownia/database';
import { claimLabel, isUnverifiedClaim } from '../lib/catalogue';
import { canonicalSpecKey, specDisplayValue } from '../lib/comparison';
import { displayMaterial } from '../lib/display';
import { Badge } from './ui/badge';
import { SourceInfo } from './ui/source-info';

/** Display text of one selected value; core and surface materials get the same casing everywhere. */
export function specValueText(spec: CatalogueSpec): string {
  const value = specDisplayValue(spec);
  const key = canonicalSpecKey(spec.key);
  return ['core', 'surface', 'frame', 'texture'].includes(key) ? displayMaterial(value) ?? value : value;
}

/**
 * Everything one racket shows for one parameter: the chosen values, each with its source
 * popover, plus the badges that must stay on the first layer (unverified claim, conflicting sources).
 * `observations` are all observations of the parameter; a conflict among them is flagged once.
 */
export function SpecValueCell({ specs, observations = specs, specLabel, dev = false }: { specs: CatalogueSpec[]; observations?: CatalogueSpec[]; specLabel: string; dev?: boolean }) {
  return <>
    {specs.length > 0 ? specs.map((spec) => <div className="comparison-value" key={spec.evidence.observationId}>
      <strong>{specValueText(spec)}</strong>
      <SourceInfo label={`Źródło: ${specLabel}`} items={[{ evidence: spec.evidence, claim: claimLabel(spec) }]} dev={dev} />
      {/* Systemic for some sources (~1/3 of values), so a quiet marker rather than a warning; conflicts keep the warning tone. */}
      {isUnverifiedClaim(spec) && <Badge><span title={claimLabel(spec)}>Niezweryfikowane</span></Badge>}
    </div>) : <p className="comparison-unknown">{observations.some((spec) => spec.conflict) ? 'Źródła podają różne wartości' : <><span aria-hidden="true">—</span><span className="sr-only">brak wartości</span></>}</p>}
    {observations.some((spec) => spec.conflict) && <p className="comparison-badges"><Badge tone="warning">Rozbieżne źródła</Badge></p>}
  </>;
}
