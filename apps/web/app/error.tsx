'use client';

import { Notice } from '../components/ui/notice';
import { PageHeader } from '../components/ui/page-header';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main" className="main-shell">
    <PageHeader title="Nie udało się otworzyć strony." />
    <Notice tone="warning" role="alert"><p>Spróbuj ponownie. Szczegóły połączenia i dane techniczne nie są wyświetlane publicznie.</p></Notice>
    <p className="page-actions"><button type="button" className="button" onClick={reset}>Spróbuj ponownie</button></p>
  </main>;
}
