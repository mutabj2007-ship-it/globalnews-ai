import { findCountryByIso2 } from '@globalnews-ai/shared';
import type { SituationObservation } from './situation.contract';
import {
  InvalidSituationIdentityError,
  MAX_DISCRIMINATOR_LENGTH,
  MAX_PARTITION_KEY_LENGTH,
  assertStorableIdentityValue,
  type AttachmentDecision,
  type SituationAnchor,
  type SituationIdentityPort,
} from './situation-identity.port';

/**
 * SITUATION IDENTITY — THE CANONICAL CONTRACT.  MAIN-CONFLICT-D1.
 *
 *     baseline   C34  20E1116244EC516A64BF9F05A627F20CEB5AFBF6F7E5198BA63D86196D16DC2B
 *     authority  MAIN-CONFLICT-RUNTIME-CONTRACT R3 + Addendum A1
 *     implements SituationIdentityPort — the seam that already existed
 *
 * ── THERE IS ONE IDENTITY MODEL, AND THIS FILE DOES NOT INTRODUCE A SECOND ──
 *
 * `situation-identity.port.ts` already declared the canonical shapes. This file
 * IMPLEMENTS that port. It exports no parallel `deriveSituationKey`, no second
 * `SituationAnchor` and no second `AttachmentDecision` — the port's are imported
 * and used as-is. That is the whole point of D1: G's S1 package shipped a
 * PARALLEL API, and the fix is convergence onto the seam, not a third shape.
 *
 * ── THE TWO COLLISIONS, RESOLVED ────────────────────────────────────────────
 *
 * `SituationAnchor`
 *   PORT  {situationId, discriminator, anchorArticleUrl, anchorTitle, anchorObservedAt: Date}
 *   S1    {title, publishedAt: string}
 *   CANONICAL: THE PORT'S. S1's two fields are a strict subset — `title` is
 *   `anchorTitle` and `publishedAt` is `anchorObservedAt` parsed to a Date. What
 *   S1 could not express is what Main needs to store: WHICH situation was
 *   compared (`situationId`, `discriminator`) and WHICH article anchored it
 *   (`anchorArticleUrl`). A decision row that cannot name what it compared
 *   against is not re-examinable, and PF-5 policies 6 and 7 are built on being
 *   able to ask "the same as what?".
 *   `Date` over `string` because an ISO string admits two spellings of one
 *   instant, and two spellings of one instant is a false split waiting to happen.
 *
 * `AttachmentDecision`
 *   PORT  {attached, bestScore: number|null, reason, features, anchorArticleUrl, shadowOnly}
 *   S1    {attached, matchedAnchorTitle?, bestScore: number, policyId, reason, shadowOnly}
 *   CANONICAL: THE PORT'S, on three counts.
 *     · `anchorArticleUrl` replaces `matchedAnchorTitle`. A URL is a key; a
 *       title is not. `shared/src/news.ts` already documents that a rolling-hash
 *       article id is unsafe as a key, and a headline is weaker still — two
 *       publishers routinely ship the same words.
 *     · `bestScore: number | null` replaces `bestScore: number`. An empty bucket
 *       produced no comparison, and 0 is a score meaning "compared, no overlap".
 *       Collapsing those two is how "we never looked" becomes "we looked and
 *       found nothing".
 *     · `policyId` is NOT per-decision. It is a property of the POLICY and lives
 *       on the port, so two decisions from one policy cannot disagree about which
 *       policy they came from.
 *   S1's optional `matchedAnchorTitle` is preserved as a `features` entry, where
 *   diagnostics belong, rather than as a second identity field.
 *
 * ── CALLER IDENTITY IS NOT ASSESSMENT IDENTITY ──────────────────────────────
 *
 * Nothing in this file takes a caller, a user, a session or a request. A
 * situation's identity is a property of the EVIDENCE, and it must be identical
 * whoever asks — otherwise two callers observing one event get two situations,
 * and the cache partitions by requester rather than by subject.
 *
 * PF-5 policy 4 (per-identity control) is keyed on the CALLER; policies 3, 6 and
 * 7 are keyed on the ASSESSMENT. They are different keys and this file supplies
 * only the second. A per-caller rate limiter composes the two at its own layer;
 * it does not reach in here.
 */

/** G's SITUATION_KEY_VERSION. Persisted on every situation row. */
export const SITUATION_KEY_VERSION = 'v1';

/**
 * The tier-2 candidate policy, as accepted. `shadowOnly` is true for it, so
 * every decision it produces is recorded and governs nothing.
 */
export const SITUATION_CONTINUITY_CANDIDATE = {
  id: 'situation-continuity-candidate',
  threshold: 0.35,
} as const;

/** The scope used when the evidence supports no country. */
export const WORLD_SCOPE = 'world';

const PARTITION_PREFIX = 'sit';

/**
 * TIER 1 — PARTITION IDENTITY.  SETTLED.
 *
 * `sit:v1:RWA`, or `sit:v1:world` where the evidence supports no country.
 *
 * A pure function of ONE observation, and deliberately of ONE FIELD of it. It
 * reads no title, no summary, no URL and no timestamp, because the partition
 * must be identical for two observations of the same event that were worded
 * differently, published by different outlets and seen at different times. That
 * is exactly what makes it usable as a CACHE KEY: it is stable across the things
 * that vary and sensitive only to the thing that does not.
 *
 * THE PARTITION IS NOT THE IDENTITY. `sit:v1:RWA` holds every Rwandan
 * situation; the discriminator separates them, is assigned once, and is never
 * recomputed here.
 *
 * The alpha-2 -> ISO3 mapping is not cosmetic: the stored format is ISO3, and
 * deriving it here rather than at the call site is what stops `RW` and `RWA`
 * becoming two buckets for one country.
 */
export function derivePartitionKey(observation: SituationObservation): string {
  if (observation === null || typeof observation !== 'object') {
    throw new InvalidSituationIdentityError(
      'derivePartitionKey received no observation. Nothing was derived.',
    );
  }

  const scope = deriveScope(observation.countryCode);
  const key = `${PARTITION_PREFIX}:${SITUATION_KEY_VERSION}:${scope}`;

  return assertStorableIdentityValue(
    key,
    'partitionKey',
    MAX_PARTITION_KEY_LENGTH,
    'situation-identity.contract',
  );
}

/**
 * AN UNRECOGNISED COUNTRY CODE FAILS. IT DOES NOT BECOME `world`.
 *
 * Silently widening an unknown `ZZ` into the world bucket would merge a
 * situation with every country-less one on earth, and nothing downstream could
 * tell that from a genuine absence of evidence. `null` is a statement — "the
 * evidence supports no country" — and it maps to `world`. A string that is not a
 * country is a defect in the caller, and it is reported as one.
 */
function deriveScope(countryCode: string | null | undefined): string {
  if (countryCode === null || countryCode === undefined) return WORLD_SCOPE;

  if (typeof countryCode !== 'string') {
    throw new InvalidSituationIdentityError(
      `countryCode must be an ISO-3166 alpha-2 string or null, received ${typeof countryCode}.`,
    );
  }
  if (countryCode !== countryCode.trim()) {
    throw new InvalidSituationIdentityError(
      'countryCode has leading or trailing whitespace. It is rejected rather than trimmed, ' +
        'because a trimmed value would not match the one the next lookup produces.',
    );
  }
  if (countryCode.length === 0) {
    throw new InvalidSituationIdentityError(
      'countryCode is an empty string. Use null to state that the evidence supports no country.',
    );
  }

  const country = findCountryByIso2(countryCode);
  if (country === undefined) {
    throw new InvalidSituationIdentityError(
      `countryCode "${countryCode}" is not a recognised ISO-3166 alpha-2 code. It is rejected ` +
        'rather than folded into the world scope, which would merge this situation with every ' +
        'country-less one.',
    );
  }

  return country.iso3;
}

/**
 * CANONICAL SERIALIZATION — INJECTIVE BY CONSTRUCTION.  D1-CORR-1.
 *
 * The first version joined the halves with a delimiter, and E1 showed it was
 * NOT injective:
 *
 *     {partitionKey: 'sit:v1:RWA#alpha', discriminator: 'beta'}
 *     {partitionKey: 'sit:v1:RWA',       discriminator: 'alpha#beta'}
 *
 * both produced `sit:v1:RWA#alpha#beta`. Two different identities, one string —
 * so a lookup keyed on it could return the wrong situation.
 *
 * IT IS NOT FIXED BY FORBIDDING '#'. That defence rests on what
 * `derivePartitionKey()` happens to emit today and on a discriminator producer
 * that does not exist yet; the first producer to emit a '#' would reintroduce
 * the collision silently, and silently is how it would stay.
 *
 * LENGTH-PREFIXED INSTEAD, so uniqueness follows from the ENCODING rather than
 * from an assumption about content. Each half is written as its character
 * length, a colon, then the half itself. A reader takes exactly that many
 * characters, so no content — including ':' or '#' — can be mistaken for
 * structure. This holds for every string either half can ever contain.
 *
 *     16:sit:v1:RWA#alpha4:beta      !=      10:sit:v1:RWA10:alpha#beta
 *
 * The `sid:1:` prefix versions the ENCODING, separately from
 * SITUATION_KEY_VERSION which versions the KEY. If the encoding ever changes,
 * stored values remain readable and self-identifying.
 */
export const IDENTITY_SERIALIZATION_VERSION = 'sid:1';

export function serializeSituationIdentity(partitionKey: string, discriminator: string): string {
  const key = assertStorableIdentityValue(
    partitionKey,
    'partitionKey',
    MAX_PARTITION_KEY_LENGTH,
    'serializeSituationIdentity',
  );
  const disc = assertStorableIdentityValue(
    discriminator,
    'discriminator',
    MAX_DISCRIMINATOR_LENGTH,
    'serializeSituationIdentity',
  );
  return `${IDENTITY_SERIALIZATION_VERSION}:${key.length}:${key}${disc.length}:${disc}`;
}

/** Two identities are the same identity when their canonical forms are equal. */
export function situationIdentityEquals(
  a: { readonly partitionKey: string; readonly discriminator: string },
  b: { readonly partitionKey: string; readonly discriminator: string },
): boolean {
  return (
    serializeSituationIdentity(a.partitionKey, a.discriminator) ===
    serializeSituationIdentity(b.partitionKey, b.discriminator)
  );
}

/* ── TIER 2 ───────────────────────────────────────────────────────────────── */

const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u;

/** Order-insensitive, case-insensitive, punctuation-insensitive token set. */
function tokens(text: string): ReadonlySet<string> {
  return new Set(
    text
      .toLowerCase()
      .split(TOKEN_SPLIT)
      .filter((t) => t.length > 0),
  );
}

/** Jaccard overlap. Symmetric, so anchor order cannot change a pair's score. */
function overlap(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * TIER 2 — ASSESSMENT IDENTITY.  CANDIDATE, SHADOW-ONLY.
 *
 * DETERMINISTIC BY CONSTRUCTION, which PF-5 policies 6 and 7 require: the same
 * observation and the same anchor set must yield the same decision every time,
 * or "the same assessment" has no meaning and duplicate reuse cannot be defined.
 *
 * Two properties do that work:
 *   · the score is SYMMETRIC, so no pair's score depends on which side it is on;
 *   · ties are broken on `anchorArticleUrl`, a stable total order, so the input
 *     ARRAY ORDER cannot change the winner. Without that tie-break, two callers
 *     handing the same anchors in different orders would get different anchors
 *     back and record two different-looking decisions about one comparison.
 */
export function decideAttachment(
  observation: SituationObservation,
  anchors: readonly SituationAnchor[],
): AttachmentDecision {
  if (observation === null || typeof observation !== 'object') {
    throw new InvalidSituationIdentityError(
      'decideAttachment received no observation. Nothing was decided.',
    );
  }
  if (!Array.isArray(anchors)) {
    throw new InvalidSituationIdentityError(
      'decideAttachment received a non-array anchor set. An empty bucket is [], not undefined.',
    );
  }

  const observed = tokens(observation.title ?? '');

  /*
   * D1-CORR-2 — NO COMPARISON IS NOT A COMPARISON THAT SCORED ZERO.
   *
   * `bestScore: null` means no meaningful comparison was performed.
   * `bestScore: 0` means one WAS performed and measured no overlap.
   *
   * The first version only checked `anchors.length === 0`, so an observation
   * with no comparable content scored 0 against every anchor and then returned
   * the alphabetically first one — reporting a measured zero, and naming an
   * anchor, for a comparison that never happened. E1 found it.
   *
   * A candidate is comparable only if it has content to compare. If the
   * observation has none, or no anchor has any, nothing was compared and the
   * result says so — with no anchor named, because naming one would assert a
   * relationship that was never evaluated.
   */
  const comparable = anchors.filter((a) => tokens(a.anchorTitle ?? '').size > 0);

  if (observed.size === 0 || comparable.length === 0) {
    return {
      attached: false,
      bestScore: null,
      reason:
        anchors.length === 0
          ? 'The partition held no anchor to compare against.'
          : 'No comparison was performed: neither the observation nor any anchor carried ' +
            'comparable content.',
      features: {
        anchorCount: anchors.length,
        comparableAnchorCount: comparable.length,
        observedTokens: observed.size,
        policy: SITUATION_CONTINUITY_CANDIDATE.id,
      },
      anchorArticleUrl: null,
      shadowOnly: true,
    };
  }

  /*
   * TIE-BREAKING APPLIES ONLY AMONG GENUINELY COMPARED CANDIDATES. The stable
   * order on `anchorArticleUrl` exists so array order cannot decide a real tie;
   * it must never be what decides an empty one.
   */
  let best: SituationAnchor = comparable[0];
  let bestScore = overlap(observed, tokens(best.anchorTitle ?? ''));

  for (const anchor of comparable.slice(1)) {
    const score = overlap(observed, tokens(anchor.anchorTitle ?? ''));
    if (score > bestScore) {
      best = anchor;
      bestScore = score;
      continue;
    }
    if (score === bestScore && anchor.anchorArticleUrl < best.anchorArticleUrl) {
      best = anchor;
    }
  }

  const attached = bestScore >= SITUATION_CONTINUITY_CANDIDATE.threshold;

  return {
    attached,
    bestScore,
    reason: attached
      ? `Title overlap ${bestScore.toFixed(4)} met the candidate threshold ` +
        `${SITUATION_CONTINUITY_CANDIDATE.threshold}.`
      : `Best title overlap ${bestScore.toFixed(4)} was below the candidate threshold ` +
        `${SITUATION_CONTINUITY_CANDIDATE.threshold}.`,
    features: {
      anchorCount: anchors.length,
      comparableAnchorCount: comparable.length,
      bestOverlap: bestScore,
      observedTokens: observed.size,
      policy: SITUATION_CONTINUITY_CANDIDATE.id,
      matchedAnchorTitle: best.anchorTitle,
      matchedSituationId: best.situationId,
    },
    anchorArticleUrl: best.anchorArticleUrl,
    shadowOnly: true,
  };
}

/**
 * THE PORT IMPLEMENTATION.
 *
 * NOT BOUND IN `SituationModule` BY THIS TRANCHE. D1 delivers the contract and
 * its proofs; binding it is a one-line provider swap and its own authorization,
 * so that "the identity contract exists" and "the identity contract is live"
 * remain two separately reviewable facts.
 */
export const SITUATION_IDENTITY_CONTRACT: SituationIdentityPort = {
  keyVersion: SITUATION_KEY_VERSION,
  policyId: SITUATION_CONTINUITY_CANDIDATE.id,
  policyThreshold: SITUATION_CONTINUITY_CANDIDATE.threshold,
  derivePartitionKey,
  decideAttachment,
};
