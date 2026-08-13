/**
 * Milestone #51 (consolidated homepage round) — a shared class-string
 * constant, not a wrapping component. Featured, In Focus, Discovery,
 * and Latest Now cards each have genuinely different internal layouts
 * (image position, metadata arrangement, list vs. grid), so a shared
 * *component* would need heavy prop-branching to accommodate them —
 * trading real abstraction for apparent code reduction. What they DO
 * share is the exact interaction styling itself, which is what this
 * captures: one definition, applied at each card's own anchor/link
 * element.
 *
 * Reference: Milestone #50's CountryArticleCard, which established
 * this vocabulary first (subtle lift + border emphasis + shadow,
 * image scale where an image exists, motion-reduce-gated,
 * focus-visible parity with hover). ~200ms duration throughout.
 */

/** For cards with a full clickable surface (Featured, Discovery, Latest Now) — lift + border + shadow. */
export const CARD_INTERACTION_CLASSES =
  'transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/60 hover:shadow-md focus-visible:-translate-y-0.5 focus-visible:border-signal/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/** For list-style rows with no card border of their own (In Focus, Latest Updates) — subtler, no lift/shadow. */
export const ROW_INTERACTION_CLASSES =
  'transition-colors duration-200 motion-reduce:transition-none';

/** Image scale-on-hover, applied to the group's own image element (parent needs class="group"). */
export const CARD_IMAGE_INTERACTION_CLASSES =
  'transition-transform duration-200 motion-safe:group-hover:scale-105 motion-reduce:transition-none';

/** Headline/title color transition on hover, applied within a `group`-marked ancestor. */
export const CARD_TITLE_INTERACTION_CLASSES = 'transition-colors group-hover:text-signal-bright';
