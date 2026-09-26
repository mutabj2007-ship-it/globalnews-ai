'use client';

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import Image from 'next/image';

/**
 * The story card's publisher photograph, layered OVER its category artwork.
 *
 * Completion ruling item 3:
 *
 *   "If a publisher image is genuinely unavailable: use the approved
 *    category-specific fallback artwork/visual system. Do not leave an
 *    empty-looking generic box. Do not invent photographs."
 *
 * The shared `SafeImage` swaps a failed remote image for ONE generic local
 * placeholder, which is the generic box the ruling rejects — and it is used by
 * other surfaces, so it is not changed here.
 *
 * Instead this component simply stops rendering when the image fails. The
 * card's category artwork is already painted underneath it, so a failure
 * reveals the subject's own artwork rather than a broken frame or a stand-in
 * photograph. Nothing is invented: the artwork is a gradient, and the card's
 * category label above it says what the colour means.
 *
 * It is the only client code on the card. No article data is computed here and
 * no request is made beyond the one the browser makes for the image itself.
 */
interface StoryPhotoProps {
  src: string;
  sizes: string;
}

export function StoryPhoto({ src, sizes }: StoryPhotoProps): JSX.Element | null {
  const [failed, setFailed] = useState(false);

  /* A new article in this slot deserves a fresh attempt. */
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) return null;

  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      fill
      sizes={sizes}
      unoptimized
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}
