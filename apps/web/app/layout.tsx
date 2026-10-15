import type { Metadata } from 'next';
import Link from 'next/link';
import { ComparisonNav, ComparisonProvider, ComparisonTray } from '../components/comparison-selection';
import './tokens.css';
import './globals.css';
import './components.css';
import './comparison-ux.css';

export const metadata: Metadata = {
  title: { default: 'Padłownia — katalog rakiet z kontekstem', template: '%s · Padłownia' },
  description: 'Katalog rakiet do padla. Dokładne warianty, roczniki i parametry z widocznym źródłem.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pl"><body>
    <a className="skip-link" href="#main">Przejdź do treści</a>
    <ComparisonProvider><header className="site-header"><div className="header-inner">
      <Link href="/" className="wordmark" aria-label="Padłownia — strona główna"><span className="brand-mark" aria-hidden="true">p.</span>padłownia<span className="wordmark-dot">.</span></Link>
      <nav aria-label="Nawigacja główna"><Link href="/" className="nav-link">Katalog rakiet</Link><ComparisonNav /></nav>
      <span className="environment-label">Wersja developerska</span>
    </div></header>
    <ComparisonTray />
    {children}
    <footer className="site-footer"><div><span className="footer-wordmark">padłownia.</span><p>Rakieta to szczegóły. Sprawdź, skąd pochodzą.</p></div><Link href="/komponenty">Galeria komponentów</Link><span>Katalog i porównania • Sprint 02</span></footer></ComparisonProvider>
  </body></html>;
}
