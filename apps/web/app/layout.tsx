import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Padłownia — katalog rakiet z kontekstem', template: '%s · Padłownia' },
  description: 'Katalog rakiet do padla. Dokładne warianty, roczniki i parametry z widocznym źródłem.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pl"><body>
    <a className="skip-link" href="#main">Przejdź do treści</a>
    <header className="site-header"><div className="header-inner">
      <Link href="/" className="wordmark" aria-label="Padłownia — strona główna"><span className="brand-mark" aria-hidden="true">p.</span>padłownia<span className="wordmark-dot">.</span></Link>
      <nav aria-label="Nawigacja główna"><Link href="/" className="nav-link">Katalog rakiet</Link></nav>
      <span className="environment-label">Wersja developerska</span>
    </div></header>
    {children}
    <footer className="site-footer"><div><span className="footer-wordmark">padłownia.</span><p>Rakieta to szczegóły. Sprawdź, skąd pochodzą.</p></div><span>Katalog • Sprint 01</span></footer>
  </body></html>;
}
