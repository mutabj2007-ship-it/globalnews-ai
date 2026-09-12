import type { SituationObservation } from './situation.contract';

/**
 * SITUATION MEMORY — S1-R2. THE PORT ONTO G'S RATIFIED IDENTITY CONTRACT.
 *
 * G owns the derivation; Main owns the storage. This file is the seam, and it
 * exists rather than a direct import for one measured reason: G's package
 * (`situation-identity.contract.ts`, its spec and its 24-article fixture
 * corpus) IS NOT PRESENT IN THE C2 WORKTREE. It is an accepted but unconverged
 * package. Importing it today would not compile, and copying it would modify an
 * immutable accepted input — so the dependency is DECLARED here instead of
 * being worked around.
 *
 * WIRING IT IS ONE SMALL FILE, and deliberately not written yet because it
 * cannot compile until G's package is converged:
 *
 *     import { deriveSituationKey, decideAttachment,
 *              SITUATION_CONTINUITY_CANDIDATE, SITUATION_KEY_VERSION }
 *       from './situation-identity.contract';
 *
 *     export const G_SITUATION_IDENTITY_PORT: SituationIdentityPort = {
 *       keyVersion: SITUATION_KEY_VERSION,
 *       policyId: 'SITUATION_CONTINUITY_CANDIDATE',
 *       policyThreshold: SITUATION_CONTINUITY_CANDIDATE.minOverlap,
 *       derivePartitionKey: (o) => deriveSituationKey(toArticle(o)).key,
 *       decideAttachment: (o, anchors) => decideAttachment(o, anchors),
 *     };
 *
 * WHAT THIS PORT DOES NOT DO. It does not identify a situation. G's tier 1 is
 * settled and returns a BUCKET; tier 2 — which situation inside that bucket an
 * observation belongs to — is explicitly NOT settled, and its threshold has a
 * separation margin of 0.042 measured over eighteen hand-built pairs, which G
 * declined to certify. That is why `decideAttachment` returns `shadowOnly` and
 * why nothing in this namespace acts on its answer.
 */

/** Nest injection token for G's derivation. */
export const SITUATION_IDENTITY_PORT = Symbol('SITUATION_IDENTITY_PORT');

/** G's tier-2 decision, as the handoff document specifies it. */
export interface AttachmentDecision {
  /** Whether the policy would attach — a RECOMMENDATION while shadowOnly is true. */
  readonly attached: boolean;
  /** The best similarity found. Null when the bucket held no anchor to score. */
  readonly bestScore: number | null;
  /** G's own explanation, recorded verbatim. */
  readonly reason: string;
  /** The features the score was computed from, recorded so a row is re-examinable. */
  readonly features: Readonly<Record<string, number | string | boolean | null>>;
  /** The anchor compared against, when there was one. */
  readonly anchorArticleUrl: string | null;
  /**
   * TRUE FOR THE CANDIDATE POLICY. While this is true the decision governs
   * NOTHING: it is recorded and acted on by nobody.
   */
  readonly shadowOnly: boolean;
}

/** One situation already in the bucket, as offered to tier 2 for comparison. */
export interface SituationAnchor {
  readonly situationId: string;
  readonly discriminator: string;
  readonly anchorArticleUrl: string;
  readonly anchorTitle: string;
  readonly anchorObservedAt: Date;
}

export interface SituationIdentityPort {
  /** G's SITUATION_KEY_VERSION. Persisted on every situation row. */
  readonly keyVersion: string;
  /** Which policy produced a decision, recorded on every shadow row. */
  readonly policyId: string;
  /** The threshold that policy used, recorded on every shadow row. */
  readonly policyThreshold: number;

  /**
   * TIER 1 — SETTLED. A pure function of ONE observation: deterministic,
   * order-insensitive, time-free, URL-free, headline-free.
   */
  derivePartitionKey(observation: SituationObservation): string;

  /** TIER 2 — NOT SETTLED. Returns a recommendation carrying `shadowOnly`. */
  decideAttachment(
    observation: SituationObservation,
    anchors: readonly SituationAnchor[],
  ): AttachmentDecision;
}

export class SituationIdentityPortNotWiredError extends Error {
  constructor() {
    super(
      "G's situation identity contract is not wired. The package " +
        '(situation-identity.contract.ts + its corpus) has been accepted but is ' +
        'NOT present in this worktree, so no partition key can be derived and ' +
        'nothing is written. Converge G\'s package, then bind the real port in ' +
        'SituationModule.',
    );
    this.name = 'SituationIdentityPortNotWiredError';
  }
}

/**
 * THE DEFAULT, AND IT DERIVES NOTHING.
 *
 * Bound in SituationModule until G's package is converged. There is no
 * fallback: not the query, not a hash, not the country code. A plausible-looking
 * partition would put rows in buckets G never sanctioned, and every tier-2
 * comparison afterwards would be bounded by the wrong set.
 */
export const UNWIRED_SITUATION_IDENTITY_PORT: SituationIdentityPort = {
  keyVersion: 'UNWIRED',
  policyId: 'UNWIRED',
  policyThreshold: Number.NaN,
  derivePartitionKey(): string {
    throw new SituationIdentityPortNotWiredError();
  },
  decideAttachment(): AttachmentDecision {
    throw new SituationIdentityPortNotWiredError();
  },
};

export class InvalidSituationIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSituationIdentityError';
  }
}

export const MAX_PARTITION_KEY_LENGTH = 512;
export const MAX_DISCRIMINATOR_LENGTH = 128;

/**
 * MAIN-OWNED CONSTRAINT ON A G-OWNED VALUE.
 *
 * Main does not decide what a partition key means, but Main owns the column and
 * its index, so Main decides what is STORABLE. Blank, whitespace-padded and
 * over-length values are rejected at the door rather than becoming rows nothing
 * can match again.
 *
 * Surrounding whitespace is REJECTED, NOT TRIMMED: a trimmed value in the table
 * is not the value the contract produces, so the next lookup — which trims
 * nothing — would miss it, and a missed lookup is a false split.
 */
export function assertStorableIdentityValue(
  value: unknown,
  field: string,
  maxLength: number,
  source: string,
): string {
  if (typeof value !== 'string') {
    throw new InvalidSituationIdentityError(
      `${source} returned ${typeof value} for ${field}, not a string. Nothing was written.`,
    );
  }
  if (value.trim().length === 0) {
    throw new InvalidSituationIdentityError(
      `${source} returned a blank ${field}. Nothing was written.`,
    );
  }
  if (value !== value.trim()) {
    throw new InvalidSituationIdentityError(
      `${source} returned a ${field} with leading or trailing whitespace. It is rejected ` +
        'rather than trimmed, because a trimmed value would not match the one the ' +
        'contract produces on the next lookup.',
    );
  }
  if (value.length > maxLength) {
    throw new InvalidSituationIdentityError(
      `${source} returned a ${field} of ${value.length} characters, over the storable ` +
        `ceiling of ${maxLength}. Nothing was written.`,
    );
  }
  return value;
}
