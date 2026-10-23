import type { RightsClass, SourceRightsRecord } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * E1 U-1 — PUBLISHER IMAGE RIGHTS CONTAINMENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────
 *
 * Every surface that shows an article rendered the publisher's own photograph
 * straight from the record: `article.imageUrl`, `item.thumbnailUrl`,
 * `story.imageUrl`. The only condition any of them applied was "is the string
 * non-empty". Nothing anywhere asked whether this product is permitted to
 * DISPLAY that photograph, because no part of the product can answer it: the
 * source matrix records acquisition rights for data, and carries no publisher
 * image-display clearance at all.
 *
 * A photograph is not the article text. Reproducing a publisher's photograph
 * on our own surface is a separate use from quoting, linking or summarising
 * their reporting, and it is the use no instrument in this repository covers.
 *
 * ── WHAT THIS MODULE IS, AND WHAT IT DELIBERATELY IS NOT ──────────────────
 *
 * It is a PRESENTATION decision and nothing else. It does not fetch, admit,
 * retain, score or activate anything. It does not touch an API, a provider or
 * a source record. `imageUrl` stays in the record, in the props and in the
 * metadata exactly as it arrives — this module decides only whether a browser
 * is told to go and load it.
 *
 * It creates NO second rights registry, and it does not widen anything. The
 * vocabulary is `shared/src/rights/source-rights.ts`, imported, not restated.
 * That module's own rule is the one this file makes mechanical for images:
 *
 *   "Absence of a rights record is a refusal, not a permission."
 *
 * SOURCE ACTIVATION AUTHORITY IS E1'S AND IS NOT TOUCHED HERE. Nothing in this
 * file can enable a provider, widen a grade or weaken a control. Every path
 * through it either refuses, or passes through a clearance some other
 * authority supplied. It can only ever subtract.
 *
 * ── FAIL-CLOSED, STRUCTURALLY ─────────────────────────────────────────────
 *
 * `evaluatePublisherImageDisplay` has exactly one way to return CLEARED, and
 * it requires a clearance object that names an instrument and carries a grade
 * in the permitting set. There is no `allow`, no override argument, no
 * environment flag and no "unknown means yes" branch. A caller that passes
 * nothing is refused, and a caller that forgets to call it does not get an
 * image, because the call sites render the element only from a CLEARED
 * verdict.
 *
 * ── WHY EVERY ARTICLE IS REFUSED TODAY ────────────────────────────────────
 *
 * `publisherImageClearanceFor` returns `null` for every article, and that is
 * the correct state, not scaffolding. No publisher image-display clearance
 * exists anywhere in this product to return. This mirrors the precedent the
 * repository already set for location photography in
 * `components/analysis-frame/locationAssets.ts`: "THE REGISTRY SHIPS EMPTY IN
 * R1, AND THAT IS THE CORRECT STATE."
 *
 * The mechanism is complete and tested. Supplying clearance later is a DATA
 * change made by the rights authority, not a code change made here.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · THE REFUSALS
 * ═══════════════════════════════════════════════════════════════════════════ */

export const PUBLISHER_IMAGE_REFUSAL_CODES = [
  /** The record carries no usable image reference at all. Not a rights state. */
  'IMAGE-NO-REFERENCE',
  /** The reference is not an absolute http(s) URL we could render anyway. */
  'IMAGE-REFERENCE-NOT-ABSOLUTE',
  /**
   * E1 U-1's finding, and today the reason for every external photograph on
   * every surface: no image-display clearance is recorded for this use.
   */
  'IMAGE-NO-DISPLAY-CLEARANCE',
  /** A clearance was supplied with no citable instrument. SI-17.4: not a record. */
  'IMAGE-NO-INSTRUMENT',
  /** A clearance was supplied whose grade is not in the permitting set. */
  'IMAGE-GRADE-NOT-PERMITTING',
  /** The clearance resolved under a different key than the one requested. */
  'IMAGE-CLEARANCE-KEY-MISMATCH',
] as const;
export type PublisherImageRefusalCode = (typeof PUBLISHER_IMAGE_REFUSAL_CODES)[number];

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · THE CLEARANCE — THE SI-17 SHAPE, NARROWED TO ONE USE
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The grades that permit DISPLAY of a publisher photograph on our surfaces.
 *
 * Deliberately a declared set and deliberately NOT inherited from
 * `GRADES_PERMITTING_ACTIVATION`. Permission to acquire and retain a source's
 * data is not permission to republish that source's photography, and wiring
 * the display decision to the activation set would make every activated
 * source an image licence the rights lane never granted.
 *
 * It is EMPTY. Nothing is permitted until a rights authority names a grade
 * here with an instrument behind it, and widening it is a rights-lane act.
 */
export const GRADES_PERMITTING_IMAGE_DISPLAY: readonly RightsClass[] = [];

/**
 * A recorded permission to display one publisher's photographs.
 *
 * `SourceRightsRecord` is reused unchanged rather than re-derived — same key,
 * same grade vocabulary, same instrument requirement, same product
 * conditions — so a clearance cannot be written in a shape the rights lane
 * would not recognise.
 */
export type PublisherImageClearance = SourceRightsRecord;

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · THE EVALUATOR
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface PublisherImageCandidate {
  /** The reference exactly as the record carries it. Never rewritten here. */
  readonly reference: string | null | undefined;
  /**
   * The CANONICAL INTERNAL SOURCE ID the clearance record is filed under.
   *
   * R3B — NEVER A PUBLISHER DISPLAY NAME. A display name is self-asserted,
   * not unique and not stable: two outlets can share one ("The Observer"),
   * one outlet renames itself, and a crafted name can be made to collide with
   * whatever a future clearance is filed under. Keying a rights decision on it
   * would mean a record could be matched by a string anybody can choose.
   *
   * Also never the article URL's host, for the same reason in a different
   * costume: the host is asserted by the link, not by the registry.
   */
  readonly clearanceKey: string;
  /** The record the authority holds, or null where it holds none. */
  readonly clearance: PublisherImageClearance | null;
}

export type PublisherImageDecision =
  | { readonly kind: 'CLEARED'; readonly src: string; readonly clearance: PublisherImageClearance }
  | { readonly kind: 'REFUSED'; readonly refusals: readonly PublisherImageRefusalCode[] };

/**
 * Every refusal is collected, in evaluation order — the same choice
 * `evaluateSourceRights` makes and for the same reason: a verdict that names
 * only the first failure teaches that the others do not exist.
 */
export function evaluatePublisherImageDisplay(c: PublisherImageCandidate): PublisherImageDecision {
  const refusals: PublisherImageRefusalCode[] = [];

  const raw = typeof c.reference === 'string' ? c.reference.trim() : '';
  let absolute = '';
  if (raw.length === 0) {
    refusals.push('IMAGE-NO-REFERENCE');
  } else {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') absolute = parsed.toString();
      else refusals.push('IMAGE-REFERENCE-NOT-ABSOLUTE');
    } catch {
      refusals.push('IMAGE-REFERENCE-NOT-ABSOLUTE');
    }
  }

  if (c.clearance === null) {
    refusals.push('IMAGE-NO-DISPLAY-CLEARANCE');
    return { kind: 'REFUSED', refusals };
  }

  if (c.clearance.instrument.trim().length === 0) refusals.push('IMAGE-NO-INSTRUMENT');
  if (GRADES_PERMITTING_IMAGE_DISPLAY.indexOf(c.clearance.rightsClass) === -1) {
    refusals.push('IMAGE-GRADE-NOT-PERMITTING');
  }
  if (c.clearance.rightsRecordKey !== c.clearanceKey) refusals.push('IMAGE-CLEARANCE-KEY-MISMATCH');

  if (refusals.length > 0) return { kind: 'REFUSED', refusals };
  return { kind: 'CLEARED', src: absolute, clearance: c.clearance };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · THE ONE PLACE A CLEARANCE COULD COME FROM
 * ═══════════════════════════════════════════════════════════════════════════ */

/** The minimum an article-like record must carry to be asked about. */
export interface PublisherImageSubject {
  readonly imageReference?: string | null;
  /** The CANONICAL INTERNAL source id, never the publisher's display name. */
  readonly sourceId?: string | null;
}

/**
 * Resolves the display clearance for one publisher. Returns `null` for every
 * publisher, because there is no clearance authority to consult: the source
 * matrix records acquisition rights for DATA and holds no image-display
 * record for any publisher.
 *
 * This is where a real lookup goes the day one exists, and it is deliberately
 * the ONLY door: no call site reads a clearance from anywhere else, so there
 * is exactly one place to change and exactly one place to review.
 *
 * It is not a stub to be filled in by whoever next edits this file. Writing a
 * clearance here is a rights-lane act (E1) with a cited instrument.
 */
export function publisherImageClearanceFor(_canonicalSourceId: string): PublisherImageClearance | null {
  return null;
}

/**
 * The call sites' single entry point: record in, decision out.
 *
 * Takes the reference explicitly rather than guessing a field name, because
 * the surfaces disagree about what the field is called (`imageUrl` on an
 * article, `thumbnailUrl` on a map source card) and a resolver that guessed
 * would silently refuse a surface whose field it did not know — which looks
 * exactly like a correct refusal.
 */
export function resolvePublisherImage(
  reference: string | null | undefined,
  sourceId: string | null | undefined,
): PublisherImageDecision {
  /*
    R3B — FAIL CLOSED ON A MISSING ID, with no fallback of any kind.

    An older payload that carries no `sourceId` yields the empty key, which
    resolves to no clearance and therefore to a refusal. That is the whole
    behaviour: there is no second lookup, no display-name path, no host
    derivation and no "best effort" branch to fall into. The parameter is
    named for what it must be so that a call site reads as the question it is
    asking — `publisherKey` was the name that invited two surfaces to pass a
    display name, and both did.
  */
  const key = typeof sourceId === 'string' && sourceId.trim().length > 0 ? sourceId.trim() : '';
  return evaluatePublisherImageDisplay({
    reference,
    clearanceKey: key,
    clearance: key.length === 0 ? null : publisherImageClearanceFor(key),
  });
}

/** True only for a verdict that cleared. The one question a view should ask. */
export function mayDisplayPublisherImage(decision: PublisherImageDecision): decision is Extract<
  PublisherImageDecision,
  { kind: 'CLEARED' }
> {
  return decision.kind === 'CLEARED';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5 · THE TWO SHAPES THE VIEWS ACTUALLY NEED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Both are one line over `resolvePublisherImage`. They exist so that a call
 * site reads as the question it is asking, and so that no surface re-derives
 * the decision from the parts and gets a different answer.
 */

/**
 * For a slot that must contain SOMETHING: the cleared publisher photograph,
 * or the first-party artwork the surface already ships.
 *
 * The fallback is the CALLER'S, never invented here, and it is first-party by
 * construction — this module has no way to produce an image of its own.
 */
export function publisherImageSrcOrFallback(
  reference: string | null | undefined,
  sourceId: string | null | undefined,
  fallbackSrc: string,
): string {
  const decision = resolvePublisherImage(reference, sourceId);
  return mayDisplayPublisherImage(decision) ? decision.src : fallbackSrc;
}

/**
 * For a slot whose empty state is already designed — a striped panel, a
 * category gradient, a monospace mark. False means the element is NOT WRITTEN,
 * which is the only form of this that stops the browser fetching: a hidden
 * `<img>` is still fetched, and `display:none` is applied after the request.
 */
export function publisherImageIsDisplayable(
  reference: string | null | undefined,
  sourceId: string | null | undefined,
): boolean {
  return mayDisplayPublisherImage(resolvePublisherImage(reference, sourceId));
}
