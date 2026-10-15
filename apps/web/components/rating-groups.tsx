import type { CatalogueEntry } from '@padlownia/database';
import { entryRatingGroups } from '../lib/comparison';
import { groupMethodology, ratingDimensionLabels } from '../lib/ratings';
import { RatingEntry, RatingGroupHeader } from './rating-parts';

/** Ratings of one racket, one block per source with its own scale. Header and entries are the comparison's, in a single column. */
export function RatingGroups({ entry, dev = false }: { entry: CatalogueEntry; dev?: boolean }) {
  const groups = entryRatingGroups(entry);
  if (groups.length === 0) return <p className="no-ratings">Brak opublikowanych ocen dla tego wariantu. Nie wyliczamy własnej oceny liczbowej.</p>;
  return <>
    {groups.map((group) => {
      const methodology = groupMethodology(group.ratings);
      return <section className="rating-group" key={group.code} aria-label={`Oceny: ${group.name}`}>
        <RatingGroupHeader sourceName={group.name} ratings={group.ratings} />
        {group.rows.map((row) => {
          const label = ratingDimensionLabels[row.dimension] ?? row.dimension;
          return <div className="rating-row" key={row.dimension} data-dimension={row.dimension}>
            <p className="rating-row-label">{label}</p>
            <div className="rating-row-cell">
              {row.ratings.map((rating) => <RatingEntry key={rating.evidence.observationId} rating={rating} group={methodology} tone="a" label={label} dev={dev} />)}
            </div>
          </div>;
        })}
      </section>;
    })}
  </>;
}
