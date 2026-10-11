import type { JSX } from 'react';
import type { NewsArticle } from '@globalnews-ai/shared';

import { StoryPhoto } from '@/components/home/StoryPhoto';
import { CATEGORY_ARTWORK, CATEGORY_ARTWORK_FALLBACK } from '@/components/home/homePresentation';
import { publisherImageIsDisplayable } from '@/lib/rights/publisherImageDisplay';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE STORY VISUAL — ARTWORK FIRST, PHOTOGRAPH OVER IT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Completion ruling item 3, and repeated in the simplification ruling for the
 * rail's lead story:
 *
 *   "If a publisher image is genuinely unavailable: use the approved
 *    category-specific fallback artwork/visual system. Do not leave an
 *    empty-looking generic box. Do not invent photographs."
 *
 * ── HOW IT GUARANTEES THAT ──────────────────────────────────────────────
 *
 * The category's artwork is painted UNCONDITIONALLY: a fixed gradient in the
 * subject's own sampled hue, a fine diagonal weave, a corner bloom and a
 * corner shadow. The publisher photograph is then layered over it when the
 * feed supplies one, and `StoryPhoto` removes itself if that image fails to
 * load, revealing the artwork underneath.
 *
 * There is therefore no state in which a story shows a broken frame, an
 * "image unavailable" strip, or the shared generic placeholder — the three
 * shapes of the empty box the rulings reject. It also means the fallback can
 * never be mistaken for evidence: it is a gradient, it depicts nothing, and
 * the card's own category label sits above it saying what the colour means.
 *
 * ── WHY IT IS SHARED ────────────────────────────────────────────────────
 *
 * Both `What's happening now` and the rail's `Your world in 60 seconds` show
 * article imagery, and both were told the same thing about fallbacks. Two
 * copies of this logic would be two places for the generic placeholder to
 * creep back in. One component, used by both, cannot drift.
 */
interface StoryVisualProps {
  article: Pick<NewsArticle, 'category' | 'imageUrl'>;
  /**
   * E1 U-1 — WHOSE photograph `article.imageUrl` is, as the record names it:
   * `sourceId` where the surface holds an article, the publisher identity
   * where it holds an editorial card.
   *
   * REQUIRED, and nullable. Required so that a surface cannot be added
   * without deciding; nullable so that "this surface does not know whose
   * photograph this is" is representable, and can therefore be REFUSED. An
   * optional prop would let the absence be an oversight; a required nullable
   * one makes it a statement — the same shape `OfficialSourceEntry.rights`
   * uses, for the same reason.
   */
  publisherKey: string | null;
  /** Aspect and radius utilities from the calling surface. */
  className: string;
  /** Accessible description used only when there is no photograph. */
  missingLabel: string;
  sizes: string;
}

export function StoryVisual({
  article,
  publisherKey,
  className,
  missingLabel,
  sizes,
}: StoryVisualProps): JSX.Element {
  const artwork = CATEGORY_ARTWORK[article.category] ?? CATEGORY_ARTWORK_FALLBACK;
  /*
    E1 U-1 — PUBLISHER IMAGE RIGHTS CONTAINMENT.

    The condition was "is the string non-empty". It is now "may this product
    display this publisher's photograph", and no clearance exists, so the
    answer is no on every card today.

    NOTHING ELSE CHANGES, and that is the whole reason this component was the
    right place: the category artwork was already painted underneath, already
    carries `role="img"` and the surface's own `missingLabel` when no
    photograph shows, and is a gradient that depicts nothing. A refusal is not
    a new empty state — it is the state this component already had.

    The element is NOT WRITTEN rather than hidden: a hidden <img> is still
    fetched, and the point of the containment is that the request is never
    made.
  */
  const hasPhoto = publisherImageIsDisplayable(article.imageUrl, publisherKey);

  return (
    <span
      role={hasPhoto ? undefined : 'img'}
      aria-label={hasPhoto ? undefined : missingLabel}
      className={`relative block w-full overflow-hidden bg-gradient-to-br ${artwork} ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.45] [background-image:repeating-linear-gradient(115deg,rgba(255,255,255,0.055)_0_1px,transparent_1px_13px)]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_72%_95%_at_16%_6%,rgba(255,255,255,0.14),transparent_60%)]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_92%_104%,rgba(0,0,0,0.42),transparent_62%)]"
      />
      {/*
        The slow zoom lives INSIDE the clipping box, so the picture grows
        behind a fixed frame rather than resizing the card. Frozen under
        `prefers-reduced-motion`. Shared by the story cards, the 60-second
        card and the For-you cards, so the whole page hovers the same way.
      */}
      {hasPhoto ? (
        <span className="absolute inset-0 block transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <StoryPhoto src={article.imageUrl as string} sizes={sizes} />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 block transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      )}
    </span>
  );
}
