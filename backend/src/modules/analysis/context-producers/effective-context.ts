/**
 * ════════════════════════════════════════════════════════════════════════════
 * D · EFFECTIVE CONTEXT — the chip states what scoped the answer
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT
 *
 *   AskAiDock.tsx:161  showGeographyLabel = storyContext === undefined
 *                                            && geographyContext !== undefined
 *   AskAiDock.tsx:162  showStoryLabel     = storyContext !== undefined
 *                                            && usesStoryContextLabel(q, …storyContextUsed)
 *
 * The anchored state is server-truthed. The geography state reads only whether a
 * store is populated. So a selection the server reports as OUTRANKED is credited
 * with the scope, and `false` and absent collapse into one generic label.
 *
 * SELECTED MAP COUNTRY ≠ MAP COUNTRY USED. That sentence is the whole module.
 *
 * THE THREE STATES ARE ALREADY IN THE WIRE — this adds no field:
 *
 *   absent   never eligible: a selection or a story anchor outranked it
 *   false    eligible, and outranked by a place in the question
 *   true     it scoped retrieval
 *
 * ABSENCE IS TESTED WITH `in`, NOT `=== undefined`. Carried from Main's probe
 * B-P5: `toBeUndefined()` passes for present-with-value-undefined, which is a
 * different fact. A reading built on the weaker test cannot tell a server that
 * omitted the field from one that sent it empty.
 */

import type { ContextEffect, EffectiveContextReading } from './ask-context-producers.contract';

/** Exactly the shape the dock already receives. No new transport. */
export interface RetrievalContextFacts {
  readonly storyContextUsed?: boolean;
  readonly geographyContextUsed?: boolean;
}

export interface ContextStoresPresent {
  readonly storyContextPresent: boolean;
  readonly geographyContextPresent: boolean;
}

function has(facts: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(facts, key);
}

/**
 * One axis, four outcomes. The store tells us what the reader supplied; the
 * server tells us what it did with it. Neither alone is the answer, and reading
 * only the store is the defect.
 */
function effectFor(present: boolean, facts: object, key: string): ContextEffect {
  if (!present) return 'ABSENT';
  if (!has(facts, key)) return 'NOT_ELIGIBLE';
  const value = (facts as Record<string, unknown>)[key];
  if (value === true) return 'USED';
  if (value === false) return 'PRESENT_UNUSED';
  /* Present as a key, and neither true nor false. Not a state we can name, so we
     do not name one: the reader supplied it and we will not claim to know what
     happened to it. */
  return 'NOT_ELIGIBLE';
}

/**
 * Derive the reading. Total, pure, and it never invents a scope.
 *
 * `globalScopeIsHonest` is true only when NOTHING scoped the answer — it is a
 * positive claim about global scope, never a resting state. A chip saying "world
 * events" when a typed place scoped retrieval is the second half of the defect
 * this closes.
 */
export function readEffectiveContext(
  facts: RetrievalContextFacts,
  stores: ContextStoresPresent,
): EffectiveContextReading {
  const story = effectFor(stores.storyContextPresent, facts, 'storyContextUsed');
  const mapGeography = effectFor(stores.geographyContextPresent, facts, 'geographyContextUsed');

  return {
    story,
    mapGeography,
    globalScopeIsHonest: story !== 'USED' && mapGeography !== 'USED',
  };
}

/**
 * Whether a chip may credit the map selection with the scope.
 *
 * ONE FUNCTION, ONE PLACE. The rule is not "is the store populated" and never
 * again will be, because the only way to ask it is to call this.
 */
export function mapCountryMayBeShownAsScope(
  facts: RetrievalContextFacts,
  stores: ContextStoresPresent,
): boolean {
  return readEffectiveContext(facts, stores).mapGeography === 'USED';
}

/**
 * Whether the selection should be shown as available-but-unused.
 *
 * It is NOT cleared and NOT hidden: the reader chose it and it applies to their
 * next question. Hiding it to make one chip simpler destroys the reader's own
 * state.
 */
export function mapCountryIsAvailableUnused(
  facts: RetrievalContextFacts,
  stores: ContextStoresPresent,
): boolean {
  return readEffectiveContext(facts, stores).mapGeography === 'PRESENT_UNUSED';
}

/**
 * A DRAFT reading, for the composer before any answer exists.
 *
 * Nothing has scoped anything yet, so no axis can be `USED` and
 * `globalScopeIsHonest` is false — there is no global claim to make about a
 * question that has not run. A draft that asserted a context "will be" used is
 * the pre-submission form of the same untruth.
 */
export function readDraftContext(stores: ContextStoresPresent): EffectiveContextReading {
  return {
    story: stores.storyContextPresent ? 'PRESENT_UNUSED' : 'ABSENT',
    mapGeography: stores.geographyContextPresent ? 'PRESENT_UNUSED' : 'ABSENT',
    globalScopeIsHonest: false,
  };
}
