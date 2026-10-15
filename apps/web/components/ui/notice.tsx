import type { ReactNode } from 'react';

/** One-line notice. Pass role="status" or "alert" only when the message appears dynamically. */
export function Notice({ tone = 'info', role, children }: { tone?: 'info' | 'warning'; role?: 'status' | 'alert'; children: ReactNode }) {
  return <div className={`notice notice-${tone}`} role={role}>{children}</div>;
}
