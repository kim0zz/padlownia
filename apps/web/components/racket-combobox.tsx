'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export type RacketOption = { id: string; label: string; brand: string; year: number | null };
const fold = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('pl').replaceAll('ł', 'l');
export function searchRacketOptions(options: RacketOption[], query: string) {
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  return options.filter((option) => words.every((word) => fold(option.label).includes(word)));
}

export function RacketCombobox({ name, label, options, initialId }: { name: string; label: string; options: RacketOption[]; initialId: string }) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const initial = options.find((option) => option.id === initialId);
  const [selectedId, setSelectedId] = useState(initial?.id ?? '');
  const [query, setQuery] = useState(initial?.label ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState('');
  const selected = options.find((option) => option.id === selectedId);
  const matches = searchRacketOptions(options, selected && query === selected.label ? '' : query);
  const visible = matches.slice(0, 30);
  const activeIndex = Math.min(active, visible.length - 1);
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, listId, activeIndex]);
  useEffect(() => {
    inputRef.current?.setCustomValidity(selectedId ? '' : 'Wyszukaj i wybierz rakietę z listy.');
  }, [selectedId]);
  function choose(option: RacketOption) {
    setSelectedId(option.id); setQuery(option.label); setOpen(false); setNotice(`Wybrano: ${option.label}`);
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      setActive((index) => !open ? 0 : Math.max(0, Math.min(visible.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault(); if (visible[activeIndex]) choose(visible[activeIndex]);
    } else if (event.key === 'Escape') { setOpen(false); }
  }
  return <div className="racket-combobox" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={`racket-${name}`}>{label}</label>
    <div className="combobox-input-wrap"><input id={`racket-${name}`} role="combobox" type="text" value={query} maxLength={500} autoComplete="off"
      aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && visible[activeIndex] ? `${listId}-${activeIndex}` : undefined}
      aria-describedby={`${listId}-help`} placeholder="Wpisz markę, model lub rok…" required
      onFocus={() => { setOpen(true); setActive(0); }} onKeyDown={onKeyDown}
      onChange={(event) => { setQuery(event.target.value); setSelectedId(''); setActive(0); setOpen(true); setNotice(''); }}
      onInvalid={(event) => event.currentTarget.setCustomValidity('Wyszukaj i wybierz rakietę z listy.')}
      ref={inputRef} />
      <button type="button" className="combobox-toggle" aria-label={`Pokaż podpowiedzi: ${label}`} onClick={() => { inputRef.current?.focus(); setOpen(!open); setActive(0); }}>⌄</button>
    </div>
    <input type="hidden" name={name} value={selectedId} />
    <span id={`${listId}-help`} className="sr-only">Wpisz nazwę. Strzałki wybierają podpowiedź, Enter zatwierdza, Escape zamyka listę.</span>
    {open && <div className="combobox-popup"><ul id={listId} role="listbox" aria-label={`Podpowiedzi: ${label}`}>
      {visible.map((option, index) => <li id={`${listId}-${index}`} key={option.id} role="option" aria-selected={index === activeIndex}
        className={index === activeIndex ? 'active-option' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>
        <span>{option.label}</span><small>{option.brand} · {option.year ?? 'Rok nieznany'}</small>
      </li>)}
    </ul>{!visible.length && <p role="status">Brak wyników. Spróbuj innej nazwy.</p>}
      {matches.length > 30 && <p>{matches.length} wyników — dopisz nazwę lub rok, aby zawęzić listę.</p>}
    </div>}
    <span className="sr-only" role="status">{notice}</span>
    <noscript>Wybór z podpowiedzi wymaga JavaScript.</noscript>
  </div>;
}
