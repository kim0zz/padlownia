import type { Metadata } from 'next';
import Link from 'next/link';
import { ComparisonNav, ComparisonProvider, ComparisonTray } from '../components/comparison-selection';
import { SourceInfoCloser } from '../components/ui/source-info-closer';
import { showDevDetails } from '../lib/dev-ui';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/catalogue.css';
import './styles/profile.css';
import './styles/comparison.css';
import './styles/gallery.css';

export const metadata: Metadata = {
  title: { default: 'Padłownia — katalog rakiet z kontekstem', template: '%s · Padłownia' },
  description: 'Katalog rakiet do padla. Dokładne warianty, roczniki i parametry z widocznym źródłem.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const dev = showDevDetails();
  return <html lang="pl"><body>
    <a className="skip-link" href="#main">Przejdź do treści</a>
    <ComparisonProvider><header className="site-header"><div className="header-inner">
      <Link href="/" className="wordmark" aria-label="Padłownia — strona główna"><span className="brand-mark" aria-hidden="true">p.</span>padłownia<span className="wordmark-dot">.</span></Link>
      <nav aria-label="Nawigacja główna"><Link href="/" className="nav-link">Katalog</Link><ComparisonNav /></nav>
      {dev && <span className="environment-label">Wersja developerska</span>}
    </div></header>
    {children}
    <ComparisonTray />
    <footer className="site-footer"><div><span className="footer-wordmark">padłownia.</span>
      <p>Dane: <a href="https://padeltrue.com/" rel="noreferrer">PadelTrue</a> (<a href="https://creativecommons.org/licenses/by/4.0/" rel="noreferrer">CC BY 4.0</a>), <a href="https://padel.how/" rel="noreferrer">padel.how</a>.</p></div>
      {dev && <Link href="/komponenty">Galeria komponentów</Link>}
    </footer></ComparisonProvider>
    <SourceInfoCloser />
  </body></html>;
}
