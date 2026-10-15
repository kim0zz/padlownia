import { Fragment } from 'react';
import type { CatalogueEvidence } from '@padlownia/database';
import { formatDate } from '../../lib/catalogue';
import { SourceCitation } from '../evidence';

/**
 * Second information layer: one interaction away from every displayed value.
 * A native <details> keeps it working without JavaScript and in server-rendered markup.
 */
export function SourceInfo({ items, dev = false, label }: { items: { evidence: CatalogueEvidence; claim: string }[]; label: string; dev?: boolean }) {
  const names = [...new Set(items.map((item) => item.evidence.sourceName))].join(', ');
  return <details className="source-info">
    <summary aria-label={names ? `${label}: ${names}` : label}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="6.75" stroke="currentColor" strokeWidth="1.5" /><path d="M8 7.25v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
      </svg>
    </summary>
    <div className="source-info-panel" role="group" aria-label={label}>
      {items.map(({ evidence, claim }, index) => <Fragment key={`${evidence.observationId}-${index}`}>
        <p className="source-info-claim">{claim}</p>
        <SourceCitation evidence={evidence} />
        <p className="source-info-date">Pobrano {formatDate(evidence.retrievedAt)}</p>
        {dev && <p className="source-info-dev">{evidence.observationId} · {evidence.path}</p>}
      </Fragment>)}
    </div>
  </details>;
}
