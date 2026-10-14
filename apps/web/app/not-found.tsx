import Link from 'next/link';

export default function NotFound() {
  return <main id="main" className="main-shell"><section className="empty-state"><p className="section-kicker">PROFIL NIEDOSTĘPNY</p><h1>Nie znaleźliśmy tej rakiety.</h1><p>Ten profil nie występuje w bieżącej opublikowanej wersji katalogu.</p><Link href="/" className="button">Wróć do katalogu</Link></section></main>;
}
