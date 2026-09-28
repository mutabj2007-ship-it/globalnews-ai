/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADDENDUM R1 — INHERITED-CONTEXT ELIGIBILITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ADDITIVE ONLY. The six accepted files of CONTEXT PRODUCER CLOSURE R1 are
 * byte-identical and are not imported-into or modified by this addendum; it
 * imports FROM them.
 *
 * THE RULING THIS ENCODES
 *
 *   An explicitly named subject/entity in a stable reference/identity question
 *   must SUPPRESS unrelated inherited Map/story geography from becoming
 *   effective scope merely because no typed country was supplied.
 *
 * WHY THIS IS AN ELIGIBILITY DECISION AND NOT A PRECEDENCE CHANGE
 *
 * The frozen table is total: `CLASSIFIED_SHAPE` guarantees a plan always exists,
 * so when ranks 1–6 are empty rank 7 (`MAP_GEOGRAPHY_CONTEXT`) is REACHED — not
 * chosen. That is correct for "what happened at the convention centre
 * yesterday", where the reader's selection is the only scope on offer. It is
 * wrong for "Who is Kagame?", where the reader named their subject and the
 * selection is simply the last thing they clicked.
 *
 * So the fix is not to reorder ranks. It is to decide, before rank 7 is
 * consulted, whether inherited context is ELIGIBLE for this question at all —
 * the same shape as the DTO's governed-country check, which refuses rather than
 * silently accepting, and the same shape as the frozen router's
 * `requirednessSource`, which records whether an axis was declared or defaulted.
 *
 * WHAT THIS IS NOT
 *
 *   NOT a person gazetteer. Nothing here knows, asserts or looks up who any
 *     person is. The test is GRAMMATICAL, not encyclopaedic.
 *   NOT names-as-countries. The country vocabulary is consulted only to EXCLUDE
 *     a subject it claims; a name it does not claim never becomes a country.
 *   NOT classifier #7. No intent, class, terminal or verdict is produced. One
 *     boolean eligibility decision plus a reason code, and nothing routes on it —
 *     the precedence table still routes, over a smaller set of eligible inputs.
 *   NOT a DTO change. Server-side, pure, zero clock, zero I/O, nothing transmitted.
 *   NOT an execution block. Reference execution remains possible; only the
 *     geography INHERITANCE is suppressed. Asserted by `blocksExecution: false`.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · THE SUBJECT SHAPE — GRAMMATICAL, NOT ENCYCLOPAEDIC
 * ══════════════════════════════════════════════════════════════════════════ */

export const SUBJECT_SHAPES = [
  /** "Who is Kagame?" — a bare, determiner-less name the country vocabulary does not claim. */
  'EXPLICIT_NAMED_SUBJECT',
  /** "Who is the president?" — a definite description. A ROLE, not a name. */
  'DEFINITE_DESCRIPTION',
  /** "Who is Rwanda?" — the subject IS a place. Typed geography owns this. */
  'GEOGRAPHIC_SUBJECT',
  /** Not a reference/identity question at all. */
  'NOT_A_REFERENCE_QUESTION',
] as const;
export type SubjectShape = (typeof SUBJECT_SHAPES)[number];

export interface SubjectReading {
  readonly shape: SubjectShape;
  /** The subject span as the reader wrote it, verbatim. Absent when there is none. */
  readonly subject?: string;
  /**
   * Corroborating evidence only, never a requirement: readers type lower case.
   * Recorded so a reviewer can see the signal was observed and not relied on.
   */
  readonly capitalizedInRawQuery: boolean;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · THE ELIGIBILITY DECISION
 * ══════════════════════════════════════════════════════════════════════════ */

export const INHERITANCE_DECISIONS = ['ELIGIBLE', 'SUPPRESSED'] as const;
export type InheritanceDecision = (typeof INHERITANCE_DECISIONS)[number];

/** Codes, never prose. The frontend owns every word. */
export const SUPPRESSION_REASONS = [
  'EXPLICIT_NAMED_SUBJECT_NO_TYPED_GEOGRAPHY',
] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

export interface InheritedContextEligibility {
  readonly decision: InheritanceDecision;
  /**
   * FINAL ADDENDUM D-4 · the landed `QueryIntent` value that qualified this
   * decision. Provenance, so a decision states what qualified it instead of
   * leaving a reviewer to re-derive it. Never computed by this lane.
   */
  readonly intentClass: string;
  readonly reason?: SuppressionReason;
  readonly subject: SubjectReading;
  /** Which inherited slots are withheld when suppressed. */
  readonly suppresses: readonly ('MAP_GEOGRAPHY_CONTEXT' | 'STORY_COUNTRY_HINT')[];
  /**
   * INVARIANT, held as a literal type: suppressing geography never stops the
   * question running. A reference question with no geography is still a question.
   */
  readonly blocksExecution: false;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · THE QUALIFIED ENTITY GEOGRAPHY SLOT — DECLARED, DELIBERATELY EMPTY
 * ══════════════════════════════════════════════════════════════════════════
 *
 * "Do not guess Rwanda merely from a surname unless a qualified entity producer
 * separately establishes it."
 *
 * The slot is declared so the precedence order can name it, and NO PRODUCER IS
 * SUPPLIED. Same discipline as `specialist-claim.ts` leaving `QuestionKind`
 * unmapped and Main's `candidateKinds: []`: naming the class is what lets the
 * system refuse the right question instead of confidently answering the wrong one.
 *
 * `establishedBy` exists so that when a producer does arrive, an integration
 * cannot pass a guess through this slot without saying what qualified it.
 */
export const ENTITY_GEOGRAPHY_QUALIFICATIONS = [
  'GOVERNED_OFFICE_REGISTRY',   // a governed registry states the office's country
  'RETAINED_EVIDENCE_ANCHOR',   // retained reporting the reader already selected
] as const;
export type EntityGeographyQualification = (typeof ENTITY_GEOGRAPHY_QUALIFICATIONS)[number];

export interface QualifiedEntityGeography {
  readonly countryCode: string;
  readonly entityTerm: string;
  readonly establishedBy: EntityGeographyQualification;
  readonly scopeSource: 'QUALIFIED_ENTITY_GEOGRAPHY';
}

/** There is no producer. Held as a constant so a spec can assert the absence. */
export const QUALIFIED_ENTITY_PRODUCER_EXISTS = false as const;

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · PRECEDENCE — THE BRIEF'S GEOGRAPHY PROJECTION, RECONCILED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The addendum's stated order:
 *
 *   explicit requested place -> typed geography -> qualified entity geography
 *     -> story context -> Map country
 *
 * Mapped onto Main's frozen eight ranks, which are NOT changed:
 *
 *   explicit requested place      = rank 5  DECLARED_REGION
 *   typed geography               = rank 6  TYPED_GEOGRAPHY  (producer A feeds it)
 *   qualified entity geography    = NEW, between 6 and 7, declared and EMPTY
 *   story context                 = the COUNTRY-HINT form of storyContext
 *   Map country                   = rank 7  MAP_GEOGRAPHY_CONTEXT
 *
 * ONE RECONCILIATION MUST BE STATED RATHER THAN GLOSSED. The projection places
 * "story context" BELOW typed geography, while Main's table places
 * `ARTICLE_ANCHOR` at rank 2, ABOVE it. Both are correct because they name
 * different things, and the landed code already distinguishes them:
 *
 *   storyContext.articleId resolved to a real article  = rank 2, outranks typed
 *   storyContext.countryCode as a lingering hint       = below typed
 *                                                        (`typedScopeOverridesStory`)
 *
 * SO SUPPRESSION APPLIES TO THE COUNTRY-HINT FORM AND NOT TO A RESOLVED ARTICLE
 * ANCHOR. A reader pointing at a specific document is a stronger act than a
 * country hint left over from an earlier surface, and this addendum does not
 * overturn it.
 */
export const ADDENDUM_GEOGRAPHY_PROJECTION = [
  'DECLARED_REGION',
  'TYPED_GEOGRAPHY',
  'QUALIFIED_ENTITY_GEOGRAPHY',
  'STORY_COUNTRY_HINT',
  'MAP_GEOGRAPHY_CONTEXT',
] as const;

/** Rank 2 is untouched by this addendum, and a spec asserts it. */
export const ARTICLE_ANCHOR_IS_NEVER_SUPPRESSED = true as const;

/* ══════════════════════════════════════════════════════════════════════════
 * 5 · BASELINE — THE CTO'S DECLARED CANONICAL
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Adopted as the authority. A local worktree is NOT baseline authority, and this
 * session cannot verify the SHA: git identity is unresolvable from the mount
 * (every worktree's `.git` points at a Windows path the Linux side cannot
 * follow). So the SHA is carried as data for the integration to assert, and this
 * package claims no measurement of it.
 */
export const DECLARED_CANONICAL = {
  branch: 'release/alpha-m08-integrated-r1',
  commit: '6a163fdfa06b69b83df22fd0b33888a604c81c7a',
  verifiedByThisPackage: false,
  note: 'assert at integration; a stale local worktree is not baseline authority',
} as const;
