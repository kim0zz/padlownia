export default function Loading() {
  return <main id="main" className="main-shell loading-shell" aria-busy="true"><p className="section-kicker" role="status">Ładowanie opublikowanego katalogu…</p><div className="skeleton skeleton-title" /><div className="skeleton skeleton-search" /><div className="racket-grid">{[1, 2, 3, 4].map((key) => <div key={key} className="skeleton skeleton-card" />)}</div></main>;
}
