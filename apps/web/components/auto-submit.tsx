'use client';

import { useEffect, useRef } from 'react';

/**
 * Submits the surrounding GET form when a select or checkbox changes.
 * Text inputs are left alone (they submit with Enter), and without JavaScript the form's own button still works.
 */
export function AutoSubmit() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = marker.current?.closest('form');
    if (!form) return;
    const onChange = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && target.type === 'checkbox')) form.requestSubmit();
    };
    form.addEventListener('change', onChange);
    form.dataset.autoSubmit = 'ready'; // lets tests wait until the enhancement is active
    return () => { form.removeEventListener('change', onChange); delete form.dataset.autoSubmit; };
  }, []);
  return <span ref={marker} hidden />;
}
