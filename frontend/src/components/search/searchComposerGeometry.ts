/**
 * ═══ SEARCH COMPOSER 1000-CHARACTER GEOMETRY R1 ═══════════════════════════
 *
 * THE DEFECT. The /search workspace composer sits in normal page flow and was
 * given the most permissive ceiling of any AdaptiveTextarea caller: 460px, or
 * 56% of the visible viewport. A 1000-character question — a supported,
 * ordinary case under maxLength=1000 — kept the composer growing to that
 * ceiling, pushing the workspace (and, on phones, the Analyze button) further
 * down with every line.
 *
 * THE RULING. A bounded conversational composer: compact when empty, natural
 * growth for medium text, a READABLE ceiling, then internal (scrollbar-hidden)
 * scrolling. About ten lines at the composer's `text-sm leading-6` (24px) plus
 * its py-3 padding on large screens; about a third of the visible viewport on
 * phones, which is what keeps the text and the Analyze control above a
 * software keyboard (VisualViewport shrinks, the ceiling shrinks with it).
 *
 * SEARCH ONLY. AdaptiveTextarea's shared defaults and every other caller —
 * the Ask dock, the Ask frame, the Hero field — are untouched.
 */
export const SEARCH_COMPOSER_GEOMETRY = {
  minHeight: 48,
  /* 10 lines × 24px + 24px padding + 2px border ≈ 266 → a 264px ceiling. */
  maxHeight: 264,
  maxViewportFraction: 0.34,
} as const;
