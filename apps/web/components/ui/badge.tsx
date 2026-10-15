import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'warning' | 'info';

/** Short status label. Warning is reserved for conflicts, unknowns and unverified data. */
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
