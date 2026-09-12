'use client';

import { useEffect, useState } from 'react';
import Image, { type ImageProps } from 'next/image';

const FALLBACK_SRC = '/images/article-placeholder.jpg';

type SafeImageProps = Omit<ImageProps, 'onError'> & {
  /** Local image path to fall back to if the remote src fails to load. */
  fallbackSrc?: string;
};

/**
 * Drop-in replacement for next/image used anywhere an article's remote
 * image (GNews or any future live provider) is rendered.
 *
 * Live provider images come from an unbounded set of external hosts and
 * can 404, time out, or otherwise fail to load. This swaps to a local
 * placeholder on error instead of leaving a broken image (or crashing
 * the surrounding layout) in the UI.
 */
export function SafeImage({
  src,
  alt,
  fallbackSrc = FALLBACK_SRC,
  ...rest
}: SafeImageProps): JSX.Element {
  const [currentSrc, setCurrentSrc] = useState(src);

  // If the underlying article changes (e.g. a new list of search
  // results), make sure we start from the new src rather than staying
  // stuck on a previous fallback.
  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

return (
  <Image
    {...rest}
    src={currentSrc}
    alt={alt}
    unoptimized
    onError={() => setCurrentSrc(fallbackSrc)}
  />
);
}
