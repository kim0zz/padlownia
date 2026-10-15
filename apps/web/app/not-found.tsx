import Link from 'next/link';
import { Notice } from '../components/ui/notice';
import { PageHeader } from '../components/ui/page-header';

export default function NotFound() {
  return <main id="main" className="main-shell">
    <PageHeader title="Nie znaleźliśmy tej rakiety." />
    <Notice tone="info"><p>Ten profil nie występuje w bieżącej opublikowanej wersji katalogu.</p></Notice>
    <p className="page-actions"><Link href="/" className="button">Wróć do katalogu</Link></p>
  </main>;
}
