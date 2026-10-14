import Link from 'next/link';
import type { ComparisonRequest } from '../lib/comparison-request';
import { Arrow } from './catalogue';

export function ComparisonFeedback({ status }: { status: ComparisonRequest['status'] }) {
  const error = status === 'stale_release' ? 'Wersja danych w tym odnośniku nie jest już aktualna. Wybierz „Porównaj w aktualnej wersji”, aby świadomie użyć najnowszej publikacji.'
    : status === 'unknown_racket' ? 'Co najmniej jedna rakieta nie jest dostępna w tej publikacji. Wybierz dokładny model z aktualnego katalogu.'
      : status === 'invalid_payload' ? 'Nieprawidłowy wybór. Porównanie wymaga dwóch różnych rakiet i poprawnego odnośnika.' : '';
  return error ? <div className="comparison-error conflict-notice" role="status"><strong>Porównanie wymaga uwagi.</strong><p>{error}</p></div> : null;
}

export function EmptyComparison({ partial = false }: { partial?: boolean }) {
  return <section className="empty-state"><span className="section-kicker">WYBÓR {partial ? '1' : '0'} Z 2</span><h2>{partial ? 'Dodaj drugą rakietę.' : 'Co chcesz porównać?'}</h2>
    <p>Wybierz dwie pozycje powyżej lub dodaj je z katalogu. Rocznik i wariant pozostają częścią każdego wyboru.</p><Link href="/" className="button button-secondary">Przejdź do katalogu<Arrow /></Link></section>;
}
