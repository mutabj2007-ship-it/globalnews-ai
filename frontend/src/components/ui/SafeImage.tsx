'use client';

import { useEffect, useState } from 'react';
import Image, { type ImageProps } from 'next/image';
import { resolvePublisherImage, mayDisplayPublisherImage } from '@/lib/rights/publisherImageDisplay';

const FALLBACK_SRC = '/images/article-placeholder.jpg';

type SafeImageProps = Omit<ImageProps, 'onError'> & {
  /** Local image path to fall back to if the remote src fails to load. */
  fallbackSrc?: string;
  /**
   * E1 U-1. The publisher whose photograph `src` is, as the record names it
   * (`article.sourceId`). Supply it ONLY at a call site that has already put
   * the reference through `resolvePublisherImage` and received a CLEARED
   * verdict; it exists so the backstop below can tell a cleared external URL
   * apart from one that reached here ungoverned.
   */
  clearedPublisherKey?: string;
};

/**
 * Drop-in replacement for next/image used anywhere an article's remote
 * image (GNews or any future live provider) is rendered.
 *
 * Live provider images come from an unbounded set of external hosts and
 * can 404, time out, or otherwise fail to load. This swaps to a local
 * placeholder on error instead of leaving a broken image (or crashing
 * the surrounding layout) in the UI.
 *
 * ── E1 U-1 · PUBLISHER IMAGE RIGHTS CONTAINMENT — THE BACKSTOP ───────────
 *
 * This component is the single widest door to an external image in the
 * product: seven surfaces render through it. It therefore refuses one too.
 *
 * An absolute http(s) `src` is NOT RENDERED unless it carries a cleared
 * publisher key AND the governed decision clears it again here. Everything
 * else — every first-party path under `/images/` — is untouched.
 *
 * WHY A SECOND CHECK AT ALL, when every call site already gates its own
 * reference: so that a surface added later, by someone who has not read this
 * header, cannot put a publisher photograph on the page by accident. A call
 * site that forgets the gate gets the fallback, not the photograph. The
 * refusal is the default and there is no argument that turns it off — the
 * key alone does nothing; the decision still has to clear.
 *
 * It does not reach the network to decide, and it does not rewrite the record:
 * the caller's `src` prop is unchanged, only what is handed to the browser.
 */
export function SafeImage({
  src,
  alt,
  fallbackSrc = FALLBACK_SRC,
  clearedPublisherKey,
  ...rest
}: SafeImageProps): JSX.Element {
  /*
    The governed src, decided before any state. A string src that is an
    absolute http(s) URL is external; anything else (a local path, a static
    import object) is first-party and passes through as it always has.
  */
  const governed = governSrc(src, clearedPublisherKey, fallbackSrc);
  const [currentSrc, setCurrentSrc] = useState(governed);

  // If the underlying article changes (e.g. a new list of search
  // results), make sure we start from the new src rather than staying
  // stuck on a previous fallback.
  useEffect(() => {
    setCurrentSrc(governSrc(src, clearedPublisherKey, fallbackSrc));
  }, [src, clearedPublisherKey, fallbackSrc]);

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

/**
 * Exported so the contract can be driven directly. An `onError` handler never
 * appears in server-rendered markup, and neither does a decision that
 * prevented an element from being written — a rendered-markup assertion can
 * show the URL is absent but not that the refusal is the reason.
 */
export function governSrc(
  src: ImageProps['src'],
  clearedPublisherKey: string | undefined,
  fallbackSrc: ImageProps['src'],
): ImageProps['src'] {
  if (typeof src !== 'string') return src;
  if (!/^https?:\/\//i.test(src)) return src;
  const decision = resolvePublisherImage(src, clearedPublisherKey);
  return mayDisplayPublisherImage(decision) ? decision.src : fallbackSrc;
}
