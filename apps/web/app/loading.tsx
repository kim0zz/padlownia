/** Skeleton shaped like the catalogue: header, search field, filter row and a card grid. */
export default function Loading() {
  return <main id="main" className="main-shell loading-shell" aria-busy="true">
    <p className="sr-only" role="status">Ładowanie katalogu…</p>
    <div className="skeleton skeleton-title" />
    <div className="skeleton skeleton-search" />
    <div className="skeleton skeleton-filters" />
    <div className="racket-grid">{[1, 2, 3, 4, 5, 6, 7, 8].map((key) => <div key={key} className="skeleton skeleton-card" />)}</div>
  </main>;
}
