'use client';

import { useEffect } from 'react';

type Closable = {
  contains(node: unknown): boolean;
  removeAttribute(name: string): void;
  querySelector(selector: string): { focus(): void } | null;
};

/** Closes open source popovers on an outside click, and on Escape returns focus to the icon. */
export function closeSourceInfo(event: { type: string; key?: string; target: unknown }, open: Closable[], active: unknown) {
  if (event.type === 'keydown') {
    if (event.key !== 'Escape' || open.length === 0) return;
    const focused = open.find((details) => details.contains(active)) ?? open[0]!;
    open.forEach((details) => details.removeAttribute('open'));
    focused.querySelector(':scope > summary')?.focus();
    return;
  }
  for (const details of open) if (!details.contains(event.target)) details.removeAttribute('open');
}

/** Mounted once in the layout; no React state. */
export function SourceInfoCloser() {
  useEffect(() => {
    const handler = (event: Event) => {
      const open = Array.from(document.querySelectorAll('details.source-info[open]'));
      if (open.length) closeSourceInfo({ type: event.type, key: (event as KeyboardEvent).key, target: event.target }, open, document.activeElement);
    };
    document.addEventListener('click', handler);
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('click', handler); document.removeEventListener('keydown', handler); };
  }, []);
  return null;
}
