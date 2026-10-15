import type { CatalogueEntry } from '@padlownia/database';
import { racketLabel } from '../lib/comparison';
import type { ComparisonRequest } from '../lib/comparison-request';
import { RacketCombobox } from './racket-combobox';

export function ComparisonPicker({ entries, request }: { entries: CatalogueEntry[]; request: ComparisonRequest }) {
  const options = entries.map((entry) => ({ id: entry.id, label: racketLabel(entry), brand: entry.brand, year: entry.modelYear }));
  return <form key={`${request.currentRelease}:${request.left}:${request.right}:${request.status}`} action="/porownaj" method="get" className="comparison-picker" aria-label="Wybierz dwie rakiety">
    <input type="hidden" name="release" value={request.currentRelease} />
    {(['left', 'right'] as const).map((side, index) => <RacketCombobox key={side} name={side} label={`Rakieta ${index + 1} · model, wariant i rok`} options={options} initialId={request[side]} />)}
    <button type="submit" className="button">{request.status === 'stale_release' ? 'Porównaj w aktualnej wersji' : 'Porównaj rakiety'}<span aria-hidden="true">↗</span></button>
  </form>;
}
