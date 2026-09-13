/**
 * CTO final visual directive — Section 4 ("HUD LINE LANGUAGE"):
 * "These borders are NOT ordinary rounded rectangles... Do not simply
 * use rounded-xl border border-cyan-500 everywhere." This file is the
 * concrete answer: a shared clip-path shape (one angled corner cut,
 * not four rounded ones) plus small independent corner-bracket
 * pieces, applied consistently to the highest-visibility panels
 * (Hero visual, Intelligence Engine area, module cards, Situation
 * Map) so the "clipped/angled panel" language is genuinely present
 * in the code, not merely described in a comment.
 *
 * Kept as plain CSS/Tailwind (`clip-path` + small border fragments)
 * — no new dependency, per the explicit "do not introduce an
 * unnecessary dependency merely for visual imitation" constraint.
 */

/** A single-corner-cut clip-path — the panel's top-right corner is angled off rather than rounded, giving it a distinct HUD silhouette instead of an ordinary rounded rectangle. Use on larger panels (Hero visual, engine area). */
export const HUD_PANEL_CLIP = '[clip-path:polygon(0_0,calc(100%-28px)_0,100%_28px,100%_100%,0_100%)]';

/** A gentler two-corner cut (top-right and bottom-left), for medium panels like module cards where a single sharp cut on every card would feel repetitive at scale. */
export const HUD_CARD_CLIP = '[clip-path:polygon(0_0,calc(100%-14px)_0,100%_14px,100%_100%,14px_100%,0_calc(100%-14px))]';

/**
 * Small independent corner-bracket class name (an L-shaped border
 * fragment) for panels that should read as "framed" without being
 * clipped themselves — e.g. the Situation Map, which needs its
 * rectangular hit-area intact for MapLibre interaction; clipping
 * that container would visually cut off map content, so brackets are
 * the safe alternative there (already used there from an earlier
 * round — this function did not exist yet, so that usage was
 * hand-written; new usages should call this instead).
 */
export function hudCornerBracketClassName(position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'): string {
  const base = 'pointer-events-none absolute h-4 w-4 border-cyan-400/60';
  switch (position) {
    case 'top-left':
      return `${base} left-2 top-2 border-l-2 border-t-2`;
    case 'top-right':
      return `${base} right-2 top-2 border-r-2 border-t-2`;
    case 'bottom-left':
      return `${base} bottom-2 left-2 border-b-2 border-l-2`;
    case 'bottom-right':
      return `${base} bottom-2 right-2 border-b-2 border-r-2`;
  }
}
