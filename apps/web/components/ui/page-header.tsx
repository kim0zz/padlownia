import Link from 'next/link';
import type { ReactNode } from 'react';
import { Arrow } from '../catalogue';

/** The single page-title pattern for catalogue, profile and comparison. */
export function PageHeader({ title, meta, actions, back }: { title: string; meta?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return <header className="page-header">
    {back && <Link href={back.href} className="back-link page-header-back"><Arrow direction="left" />{back.label}</Link>}
    <div className="page-header-main">
      <h1 className="page-header-title">{title}</h1>
      {meta && <div className="page-header-meta">{meta}</div>}
    </div>
    {actions && <div className="page-header-actions">{actions}</div>}
  </header>;
}
