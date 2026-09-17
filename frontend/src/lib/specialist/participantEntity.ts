import type { SpecialistDomainId } from '@/lib/specialist/specialistDomain';

/**
 * SHARED · ENTITY — ACTOR / PARTICIPANT ENTITY.
 *
 *     promoted   Part V §14 — "no existing surface treats a participant as a
 *                first-class object with evidenced roles"
 *     contract   Shared Specialist Addendum §15
 *     consumers  CONFLICT (1st) · ELECTION (2nd) · DELIVERY (3rd)
 *
 * "ONE IDENTITY SURFACE FOR ANY PARTY TO AN INTELLIGENCE OBJECT."
 *
 * ── THE IMAGE RULE IS THE LOAD-BEARING ONE ────────────────────────────────
 *
 * §15: the image slot "is reserved at 44 / 52 / 64 px and occupies its box
 * whether or not an image resolves", falling back to initials and then to an
 * empty bordered box — and "the platform NEVER GENERATES AN IMAGE".
 *
 * §21 sharpens it into the strongest prohibition in the package: "A generated,
 * substituted or inferred candidate portrait, UNDER ANY CIRCUMSTANCE." A
 * reserved box that collapses when empty is how that rule gets broken by
 * accident — the layout shifts, someone fills the hole, and the filling is an
 * invention. So the box is reserved unconditionally and the fallback is
 * typographic.
 *
 * Conflict has no portraits in practice — an armed group is not portrait-
 * bearing — which makes it the right first consumer to prove the empty path.
 */

export const ENTITY_IMAGE_SIZES = [44, 52, 64] as const;
export type EntityImageSize = (typeof ENTITY_IMAGE_SIZES)[number];

/**
 * Whether an image may be rendered at all.
 *
 * `UNLICENSED` is distinct from `ABSENT` on purpose: one is a gap in the
 * record and the other is a legal state, and the Addendum's open items gate
 * institution logos and authorised portraits on clearance that has not been
 * given. Neither may resolve to a generated image.
 */
export type EntityImageLicence = 'LICENSED' | 'UNLICENSED' | 'ABSENT';

export interface ParticipantEntity {
  readonly entityId: string;
  /** The VERIFIED name from the record. No inferred, translated or shortened name. */
  readonly verifiedName: string;
  /** Domain-configured: actor/participant · candidate · institution. */
  readonly roleType: string;
  readonly affiliation?: string;
  readonly imageRef?: string;
  readonly imageLicence: EntityImageLicence;
  readonly geographyRef?: string;
  /** The record's own precision. NEVER the navigation precision of the viewer. */
  readonly geographyPrecision?: string;
  /** Domain-scoped — `CONFLICT:ACTIVE`, never a bare shared token. */
  readonly currentState?: string;
  readonly stateVocabularyId: SpecialistDomainId;
  readonly measure?: string;
  readonly measureUnit?: string;
  readonly delta?: string;
  readonly evidenceCount: number;
  readonly provenanceRef: readonly string[];
  readonly watchSubjectRef?: string;
}

export type EntityImageResolution =
  | { readonly kind: 'IMAGE'; readonly src: string }
  | { readonly kind: 'INITIALS'; readonly initials: string }
  | { readonly kind: 'EMPTY' };

/**
 * What actually goes in the reserved box.
 *
 * Three outcomes and no fourth. There is deliberately no branch that could
 * produce a placeholder portrait, a silhouette, an avatar service URL or a
 * generated likeness — the type has nowhere to put one.
 */
export function resolveEntityImage(entity: ParticipantEntity): EntityImageResolution {
  if (entity.imageLicence === 'LICENSED' && typeof entity.imageRef === 'string' && entity.imageRef.length > 0) {
    return { kind: 'IMAGE', src: entity.imageRef };
  }

  const initials = entity.verifiedName
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  /* Initials are DERIVED FROM THE VERIFIED NAME, which is not an invention:
     they assert nothing the record does not already state. An empty box is the
     honest outcome when even that is unavailable. */
  return initials.length > 0 ? { kind: 'INITIALS', initials } : { kind: 'EMPTY' };
}

/** §15: "Provenance is always reachable in one tap from the card." */
export function entityProvenanceReachable(entity: ParticipantEntity): boolean {
  return entity.provenanceRef.length > 0;
}

/**
 * §15: "State chip uses the domain's registered vocabulary and ALWAYS CARRIES
 * WORD PLUS MARK." §21 forbids "a state carried by colour alone", so a chip
 * without a word is not renderable rather than merely discouraged.
 */
export function entityStateIsRenderable(entity: ParticipantEntity): boolean {
  return typeof entity.currentState === 'string' && entity.currentState.includes(':');
}
