'use client';

import { useState } from 'react';
import type { PublicRacketImage } from '../lib/catalogue-images';

export function RacketVisual({ entry }: { entry: { image?: PublicRacketImage } }) {
  const [failedUrl, setFailedUrl] = useState('');
  const image = entry.image;
  const showImage = image && failedUrl !== image.url;
  return <figure className={`racket-visual ${showImage ? 'has-image' : 'no-image'}`}>
    {showImage ? <><img src={image.url} alt={image.alt} width="120" height="160" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(image.url)} />
      <figcaption><a href={image.sourceUrl} rel="noreferrer">{image.credit}</a>{image.licence !== 'written-permission' && <><span> · </span><a href={image.licence === 'CC0' ? 'https://creativecommons.org/publicdomain/zero/1.0/' : 'https://creativecommons.org/licenses/by/4.0/'} rel="noreferrer">{image.licence === 'CC0' ? 'CC0' : 'CC BY 4.0'}</a></>}</figcaption></>
      : <><svg width="90" height="130" viewBox="0 0 90 130" fill="none" aria-hidden="true"><path d="M45 7C21 7 10 27 13 48c2 18 16 31 25 35v31h14V83c11-5 23-17 25-35C80 27 69 7 45 7Z" stroke="currentColor" strokeWidth="3" /><path d="M38 114h14v9H38zM37 83h16" stroke="currentColor" strokeWidth="3" />{[30,45,60].flatMap((x)=>[30,44,58].map((y)=><circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" fill="currentColor" />))}</svg><figcaption>Zdjęcie niedostępne</figcaption></>}
  </figure>;
}
