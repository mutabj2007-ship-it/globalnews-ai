/**
 * ════════════════════════════════════════════════════════════════════════════
 * J-2 — AN EMPTY DIMENSION HAS TWO CAUSES, AND THEY ARE NOT THE SAME ANSWER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"Distinguish these two states: model returned no items; model
 * returned candidate items but grounding/validation rejected all of them. Do not
 * collapse both into an indistinguishable generic zero if the backend already
 * knows which occurred."*
 *
 * THE BACKEND DID ALREADY KNOW. `validateSourcedClaims` sees the raw candidate
 * array and builds the accepted one, so the difference between them was
 * available at every call — and discarded at the `return`. A reader was then
 * shown a zero that could mean either:
 *
 *   NOTHING_GENERATED  the evidence supported nothing here, and the model
 *                      correctly said so. The dimension is genuinely empty.
 *   ALL_REJECTED       the model DID propose items and every one failed
 *                      grounding — an ungrounded citation, a contradicted
 *                      entity/role/geography relation, or a malformed claim.
 *
 * Those are opposite facts about the evidence. The first says the reporting is
 * silent; the second says the reporting did not support what was drafted. A
 * single "0" tells the reader neither, and quietly implies the first.
 *
 * ─── WHAT THIS IS NOT ─────────────────────────────────────────────────────
 *
 * NOT a threshold change. Nothing here admits, re-scores or rescues a single
 * rejected entry; every grounding rule is untouched and every rejection still
 * happens for exactly the reason it happened before. This only RECORDS what the
 * validator already decided.
 *
 * NOT a content generator. The ruling is explicit — *"Do not fabricate content
 * simply to avoid a zero."* A census of zero accepted items stays zero accepted
 * items; all that changes is that the product can now say WHY.
 *
 * NOT reader-facing jargon. These counts are diagnostics. The surface renders a
 * truthful sentence derived from them, never the numbers themselves.
 */

export interface DimensionGroundingCensus {
  /** Entries the model proposed for this dimension, before any validation. */
  readonly generated: number;
  /** Entries that survived every grounding rule unchanged. */
  readonly accepted: number;
  /** generated - accepted. Carried explicitly so a reader of the JSON need not subtract. */
  readonly rejected: number;
}

/**
 * Why a dimension is empty, or that it is not.
 *
 * Deliberately three values rather than a boolean: "empty" is the question a
 * caller asks, and the answer is useless without the reason, which is the whole
 * point of this module.
 */
export type DimensionEmptiness = 'NOT_EMPTY' | 'NOTHING_GENERATED' | 'ALL_REJECTED';

export function buildCensus(generated: number, accepted: number): DimensionGroundingCensus {
  /*
    Defensive rather than trusting: `accepted` can never exceed `generated`
    because it is built by filtering, but a future refactor that pushed a
    synthesised entry would make `rejected` negative and silently nonsensical.
    Clamping here turns that into a visible zero instead.
  */
  const safeAccepted = Math.min(accepted, generated);

  return {
    generated,
    accepted: safeAccepted,
    rejected: Math.max(0, generated - safeAccepted),
  };
}

export function emptinessOf(census: DimensionGroundingCensus): DimensionEmptiness {
  if (census.accepted > 0) return 'NOT_EMPTY';

  return census.generated > 0 ? 'ALL_REJECTED' : 'NOTHING_GENERATED';
}

/** The per-dimension census carried on a result. Keyed by response field name. */
export type DimensionGroundingReport = Readonly<Record<string, DimensionGroundingCensus>>;
