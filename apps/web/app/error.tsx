'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main" className="main-shell"><section className="empty-state" role="alert"><p className="section-kicker">BŁĄD WYŚWIETLANIA</p><h1>Nie udało się otworzyć strony.</h1><p>Spróbuj ponownie. Szczegóły połączenia i dane techniczne nie są wyświetlane publicznie.</p><button className="button" onClick={reset}>Spróbuj ponownie</button></section></main>;
}
