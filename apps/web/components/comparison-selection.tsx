'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { comparisonUrl, readSelection, toggleSelection, type ComparisonSelection, type SelectionItem } from '../lib/comparison-selection';

const storageKey = 'padlownia:comparison:v1';
type SelectionContext = {
  selection: ComparisonSelection | null;
  ready: boolean;
  message: string;
  toggle: (releaseId: string, item: SelectionItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  remember: (next: ComparisonSelection) => void;
};
const Context = createContext<SelectionContext | null>(null);

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<ComparisonSelection | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    try { setSelection(readSelection(sessionStorage.getItem(storageKey))); } catch { /* Selection still works in memory when storage is unavailable. */ }
    setReady(true);
  }, []);
  const save = useCallback((next: ComparisonSelection | null, notice: string) => {
    setSelection(next);
    setMessage(notice);
    try {
      if (next) sessionStorage.setItem(storageKey, JSON.stringify(next));
      else sessionStorage.removeItem(storageKey);
    } catch { /* Persistence is optional; authoritative validation happens on the server. */ }
  }, []);
  const remember = useCallback((next: ComparisonSelection) => save(next, ''), [save]);
  return <Context.Provider value={{ selection, ready, message,
    toggle(releaseId, item) { const next = toggleSelection(selection, releaseId, item); save(next.selection, next.message); },
    remove(id) { const items = selection?.items.filter((item) => item.id !== id) ?? []; save(selection && items.length ? { ...selection, items } : null, 'Usunięto rakietę z porównania.'); },
    clear() { save(null, 'Wyczyszczono wybór do porównania.'); },
    remember,
  }}>{children}</Context.Provider>;
}

// Only called by the server-validated comparison page. An explicit URL wins
// over a previous session selection, without re-adding items after user removal.
export function RememberComparison({ selection }: { selection: ComparisonSelection }) {
  const context = useContext(Context);
  const ready = context?.ready;
  const remember = context?.remember;
  const { releaseId } = selection;
  const left = selection.items[0];
  const right = selection.items[1];
  useEffect(() => {
    if (ready && remember && left && right) remember({ releaseId, items: [{ id: left.id, label: left.label }, { id: right.id, label: right.label }] });
  }, [ready, remember, releaseId, left?.id, left?.label, right?.id, right?.label]);
  return null;
}

export function ComparisonNav() {
  const context = useContext(Context);
  return <Link className="nav-link" href={context?.selection ? comparisonUrl(context.selection) : '/porownaj'}>Porównaj{context?.selection ? ` (${context.selection.items.length}/2)` : ''}</Link>;
}

export function RemoveComparisonItem({ id, label }: { id: string; label: string }) {
  const context = useContext(Context);
  if (!context?.selection || !context.selection.items.some((item) => item.id === id)) return null;
  const remaining = { ...context.selection, items: context.selection.items.filter((item) => item.id !== id) };
  return <Link className="comparison-remove" href={remaining.items.length ? comparisonUrl(remaining) : '/porownaj'} aria-label={`Usuń z wyboru: ${label}`} onClick={() => context.remove(id)}><svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></Link>;
}

export function ClearComparison() {
  const context = useContext(Context);
  return context?.selection ? <Link className="text-button" href="/porownaj" onClick={context.clear}>Wyczyść wybór</Link> : null;
}

export function AddToComparison({ id, releaseId, label }: SelectionItem & { releaseId: string }) {
  const context = useContext(Context);
  if (!context) return <Link className="button button-secondary comparison-add" href={comparisonUrl({ releaseId, items: [{ id, label }] })}>Wybierz do porównania</Link>;
  const selected = context.selection?.releaseId === releaseId && context.selection.items.some((item) => item.id === id);
  return <button type="button" className="button button-secondary comparison-add" disabled={!context.ready} aria-pressed={Boolean(selected)}
    aria-label={`${selected ? 'Usuń z porównania' : 'Dodaj do porównania'}: ${label}`} onClick={() => context.toggle(releaseId, { id, label })}>
    {selected ? 'Wybrano do porównania' : 'Dodaj do porównania'} <span aria-hidden="true">{selected ? '✓' : '+'}</span>
  </button>;
}

export function ComparisonTray() {
  const context = useContext(Context);
  const pathname = usePathname();
  if (!context || pathname === '/porownaj') return null;
  return <div className="selection-shell">
    <p className="selection-status" role="status" aria-live="polite">{context.message}</p>
    {context.selection && <aside className="selection-tray" aria-label="Wybrane rakiety">
      <div><strong>Do porównania · {context.selection.items.length}/2</strong><ul>{context.selection.items.map((item) => <li key={item.id}>
        <span>{item.label}</span><button type="button" className="text-button" aria-label={`Usuń z wyboru: ${item.label}`} onClick={() => context.remove(item.id)}>Usuń</button>
      </li>)}</ul></div>
      <div className="selection-actions"><Link className="button" href={comparisonUrl(context.selection)}>{context.selection.items.length === 2 ? 'Porównaj rakiety' : 'Wybierz drugą rakietę'}</Link>
        <button type="button" className="text-button" onClick={context.clear}>Wyczyść wybór</button></div>
    </aside>}
  </div>;
}
