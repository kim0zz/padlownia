'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicRacketImage } from '../lib/catalogue-images';

/** Image credit and licence links, shared by the figure caption and the comparison footer. */
export function ImageCredit({ image }: { image: PublicRacketImage }) {
  return <><a href={image.sourceUrl} rel="noreferrer">{image.credit}</a>{image.licence !== 'written-permission' && <><span> · </span><a href={image.licence === 'CC0' ? 'https://creativecommons.org/publicdomain/zero/1.0/' : 'https://creativecommons.org/licenses/by/4.0/'} rel="noreferrer">{image.licence === 'CC0' ? 'CC0' : 'CC BY 4.0'}</a></>}</>;
}

/**
 * `compact` is the comparison-header thumbnail: no visible caption (the credit is printed once
 * below the comparison); the fallback caption stays available to assistive technology.
 */
export function RacketVisual({ entry, compact = false }: { entry: { image?: PublicRacketImage }; compact?: boolean }) {
  const [failedUrl, setFailedUrl] = useState('');
  const ref = useRef<HTMLImageElement>(null);
  const image = entry.image;
  const imageUrl = image?.url;
  // A load error can fire before React hydrates and attaches onError; check the settled state on mount.
  useEffect(() => {
    const node = ref.current;
    if (imageUrl && node && node.complete && node.naturalWidth === 0) setFailedUrl(imageUrl);
  }, [imageUrl]);
  const showImage = image && failedUrl !== image.url;
  const size = compact ? { width: '48', height: '64' } : { width: '120', height: '160' };
  return <figure className={`racket-visual ${showImage ? 'has-image' : 'no-image'}${compact ? ' racket-visual-compact' : ''}`}>
    {showImage ? <><img ref={ref} src={image.url} alt={image.alt} {...size} decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(image.url)} />
      {!compact && <figcaption><ImageCredit image={image} /></figcaption>}</>
      : <><svg width="90" height="130" viewBox="0 0 90 130" fill="none" aria-hidden="true"><path d="M45 7C21 7 10 27 13 48c2 18 16 31 25 35v31h14V83c11-5 23-17 25-35C80 27 69 7 45 7Z" stroke="currentColor" strokeWidth="3" /><path d="M38 114h14v9H38zM37 83h16" stroke="currentColor" strokeWidth="3" />{[30,45,60].flatMap((x)=>[30,44,58].map((y)=><circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" fill="currentColor" />))}</svg><figcaption className={compact ? 'sr-only' : undefined}>Zdjęcie niedostępne</figcaption></>}
  </figure>;
}
