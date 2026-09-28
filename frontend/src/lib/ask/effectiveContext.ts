/**
 * EFFECTIVE CONTEXT — G producer D, at G's declared target path.
 *
 * ASK R2 CONSOLIDATED INTEGRATION R1 · Gate C. Ported unchanged in meaning from
 * G-ASK-R2-CONTEXT-PRODUCER-CLOSURE-R1 `src/effective-context.ts` (vendored byte-identical
 * on the backend at `analysis/context-producers/effective-context.ts`, where its own spec
 * runs). The dock renders the Map chip from WHAT THE SERVER SAYS IT USED, not from which
 * store happens to be occupied (G 01-SEAM §D) — so a Map country the server did not use
 * (suppressed for "What is NATO?", or outranked by a typed place) is never shown as the
 * scope of an answer.
 *
 * Four states, as the landed service stamps them:
 *   USED            the server says it scoped retrieval
 *   PRESENT_UNUSED  eligible, and outranked — the reader's selection still stands
 *   NOT_ELIGIBLE    never in contention (the server stamped nothing)
 *   ABSENT          the reader never supplied it
 */

export type ContextEffect = 'USED' | 'PRESENT_UNUSED' | 'NOT_ELIGIBLE' | 'ABSENT';

export interface EffectiveContextReading {
  readonly story: ContextEffect;
  readonly mapGeography: ContextEffect;
  /** True only when NOTHING scoped the answer. A positive claim, never a floor. */
  readonly globalScopeIsHonest: boolean;
}

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

function effectFor(present: boolean, facts: object, key: string): ContextEffect {
  if (!present) return 'ABSENT';
  if (!has(facts, key)) return 'NOT_ELIGIBLE';
  const value = (facts as Record<string, unknown>)[key];
  if (value === true) return 'USED';
  if (value === false) return 'PRESENT_UNUSED';
  return 'NOT_ELIGIBLE';
}

/** After an answer: what the server said it used. */
export function readEffectiveContext(
  facts: RetrievalContextFacts,
  stores: ContextStoresPresent,
): EffectiveContextReading {
  const story = effectFor(stores.storyContextPresent, facts, 'storyContextUsed');
  const mapGeography = effectFor(stores.geographyContextPresent, facts, 'geographyContextUsed');
  return { story, mapGeography, globalScopeIsHonest: story !== 'USED' && mapGeography !== 'USED' };
}

/** Before an answer: what is on offer. Nothing has been used yet, so no global claim. */
export function readDraftContext(stores: ContextStoresPresent): EffectiveContextReading {
  return {
    story: stores.storyContextPresent ? 'PRESENT_UNUSED' : 'ABSENT',
    mapGeography: stores.geographyContextPresent ? 'PRESENT_UNUSED' : 'ABSENT',
    globalScopeIsHonest: false,
  };
}

/**
 * Whether the dock may name the Map country as the scope. While drafting (or before any
 * answer) the country on offer is shown; once answered, only a country the server says
 * it USED is.
 */
export function mapGeographyChipShown(
  phase: 'draft' | 'answered',
  facts: RetrievalContextFacts,
  stores: ContextStoresPresent,
): boolean {
  if (stores.storyContextPresent || !stores.geographyContextPresent) return false;
  return phase === 'draft'
    ? readDraftContext(stores).mapGeography === 'PRESENT_UNUSED'
    : readEffectiveContext(facts, stores).mapGeography === 'USED';
}
