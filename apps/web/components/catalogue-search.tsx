'use client';

import { useId, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { searchRacketOptions, type RacketOption } from '../lib/search';

const MIN_CHARS = 2;
const MAX_SUGGESTIONS = 8;

/**
 * Search field of the catalogue form. Without JavaScript it is a plain GET field named `q`.
 * With JavaScript it offers suggestions (ARIA combobox + listbox): choosing one opens the profile,
 * Enter without an active suggestion submits the form like a normal search.
 */
export function CatalogueSearch({ options, initialQuery }: { options: RacketOption[]; initialQuery: string }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const term = query.trim();
  const matches = term.length >= MIN_CHARS ? searchRacketOptions(options, term) : [];
  const suggestions = matches.slice(0, MAX_SUGGESTIONS);
  // Last row = "show all results"; it exists only when there is at least one suggestion.
  const rows = suggestions.length;
  const expanded = open && rows > 0;
  const lastIndex = rows; // index of the "show all" row
  const activeIndex = active > lastIndex ? lastIndex : active;
  const optionId = (index: number) => `${listId}-${index}`;

  useEffect(() => {
    if (expanded && activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [expanded, activeIndex, listId]);

  function choose(index: number) {
    setOpen(false);
    const option = suggestions[index];
    if (option) router.push(`/rakiety/${encodeURIComponent(option.id)}`);
    else inputRef.current?.form?.requestSubmit();
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (rows === 0) return;
      event.preventDefault();
      if (!expanded) { setOpen(true); setActive(event.key === 'ArrowDown' ? 0 : lastIndex); return; }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive(Math.max(-1, Math.min(lastIndex, activeIndex + step)));
    } else if (event.key === 'Enter') {
      if (expanded && activeIndex >= 0) { event.preventDefault(); choose(activeIndex); }
    } else if (event.key === 'Escape' && expanded) {
      event.preventDefault(); setOpen(false); setActive(-1);
    }
  }

  return <div className="catalogue-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor="q" className="sr-only">Szukaj marki, modelu lub wariantu</label>
    <div className="search-input-wrap">
      <input id="q" name="q" type="search" role="combobox" maxLength={120} autoComplete="off" value={query}
        placeholder="Marka, model, wariant lub rok…"
        aria-expanded={expanded} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        onChange={(event) => { setQuery(event.target.value); setActive(-1); setOpen(true); }}
        onKeyDown={onKeyDown} ref={inputRef} />
      <button type="submit" className="search-submit" aria-label="Szukaj">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </div>
    {expanded && <div className="combobox-popup search-suggestions">
      <ul id={listId} role="listbox" aria-label="Podpowiedzi rakiet">
        {suggestions.map((option, index) => <li id={optionId(index)} key={option.id} role="option" aria-selected={index === activeIndex}
          className={index === activeIndex ? 'active-option' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>{option.label}</li>)}
        <li id={optionId(lastIndex)} role="option" aria-selected={lastIndex === activeIndex} className={`search-all${lastIndex === activeIndex ? ' active-option' : ''}`}
          onMouseDown={(event) => event.preventDefault()} onClick={() => choose(lastIndex)}>Pokaż wszystkie wyniki dla „{term}” ({matches.length})</li>
      </ul>
    </div>}
    <span className="sr-only" role="status">{expanded ? `Podpowiedzi: ${suggestions.length} z ${matches.length}. Strzałki wybierają, Enter otwiera profil, Escape zamyka.` : ''}</span>
  </div>;
}
