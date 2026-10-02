/**
 * CROSS-DOMAIN ASK IDENTITY — Contract 4 R2.
 *
 * Conflict + Humanitarian, geography + Humanitarian, retained story + Humanitarian.
 *
 * The risk being guarded is not that two domains answer badly together. It is that a plan
 * assembled from a DIFFERENT set of contributing legs reuses a cached identity, so a
 * Conflict-only answer is served to a Conflict+Humanitarian question, or a Sudan humanitarian
 * leg is served under a Kenya conflict question. Identity must therefore be a function of the
 * whole contributing set, order-independent and omission-sensitive.
 */

import { UNIT_SEPARATOR } from './ports.js';

export type DomainId = 'HUMANITARIAN' | 'CONFLICT' | 'GEOGRAPHY' | 'RETAINED_STORY';

/** One contributing leg. `identity` is that domain's own opaque material. */
export interface ContributingLeg {
  readonly domainId: DomainId;
  readonly identity: string;
  /** REQUIRED legs must be satisfied or the plan is not satisfiable; SUPPLEMENTARY may be absent. */
  readonly requiredness: 'REQUIRED' | 'SUPPLEMENTARY';
}

/**
 * Composite identity material for a multi-domain plan.
 *
 * Legs are sorted by domain then identity, so leg ORDER cannot change the plan identity while
 * leg MEMBERSHIP always does. Each leg is encoded with the same U+001F separator discipline
 * Main ruled load-bearing, and the leg count is included so that a dropped leg cannot be
 * masked by a coincidental concatenation.
 */
export function compositeIdentityMaterial(legs: readonly ContributingLeg[]): string {
  const encoded = legs
    .map((l) => [l.domainId, l.identity, l.requiredness].join(UNIT_SEPARATOR))
    .sort();
  return [`legs:${encoded.length}`, ...encoded].join(UNIT_SEPARATOR);
}

/** The set of domains contributing, sorted and deduplicated. */
export function contributingDomains(legs: readonly ContributingLeg[]): readonly DomainId[] {
  return [...new Set(legs.map((l) => l.domainId))].sort() as DomainId[];
}

/**
 * A Humanitarian leg must never be SUBSTITUTED by reporting from another domain. Carried from
 * the accepted router ruling: `reportingSubstitutionForbidden` for a REQUIRED specialist leg.
 * Answering a required humanitarian question from conflict reporting with a disclosure attached
 * is the failure this prevents.
 */
export function substitutionForbidden(legs: readonly ContributingLeg[]): boolean {
  return legs.some((l) => l.domainId === 'HUMANITARIAN' && l.requiredness === 'REQUIRED');
}
