import type { CatalogueEntry } from '@padlownia/database';
import { entrySpecRows } from '../lib/comparison';
import { SpecValueCell } from './spec-value-cell';

/** Parameters of one racket: one row per parameter, cell content identical to a comparison column. */
export function SpecTable({ entry, dev = false }: { entry: CatalogueEntry; dev?: boolean }) {
  const rows = entrySpecRows(entry);
  if (!rows.length) return <p className="profile-section-note">Brak potwierdzonych parametrów. Wszystkie obserwacje źródeł są niżej.</p>;
  return <dl className="spec-table">
    {rows.map((row) => <div className="spec-row" key={row.key} data-spec={row.key}>
      <dt className="spec-row-label">{row.label}</dt>
      <dd className="spec-row-cell"><SpecValueCell specs={row.selected} observations={row.observations} specLabel={row.label} dev={dev} /></dd>
    </div>)}
  </dl>;
}
