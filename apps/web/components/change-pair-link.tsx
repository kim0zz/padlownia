'use client';

import { useEffect } from 'react';

function openPicker(focus: boolean) {
  const picker = document.getElementById('change-pair');
  if (!(picker instanceof HTMLDetailsElement)) return false;
  picker.open = true;
  picker.scrollIntoView({ block: 'start' });
  if (focus) picker.querySelector('input')?.focus({ preventScroll: true });
  return true;
}

/** Without JavaScript this is a plain anchor to the collapsed picker; with it the picker opens too. */
export function ChangePairLink() {
  useEffect(() => { if (window.location.hash === '#change-pair') openPicker(false); }, []);
  return <a className="comparison-change-link" href="#change-pair" aria-label="Zmień porównywane rakiety"
    onClick={(event) => { if (openPicker(true)) event.preventDefault(); }}>Zmień</a>;
}
