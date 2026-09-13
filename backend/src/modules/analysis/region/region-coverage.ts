import type { CountryMeta, NewsArticle, RequestedRegionScope, RetrievalOutcome } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REGIONAL COVERAGE AND RETRIEVAL OUTCOME — C907 §8 and §0.1(3)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Three pure functions, lifted out of `AnalysisService` so they can be executed
 * by a test without a Nest container, a provider or a database. They decide
 * what a retrieval DID; they perform no retrieval of their own, touch no
 * article and reach no network.
 */

/**
 * WHAT RETRIEVAL ACTUALLY DID, as one machine-readable value.
 *
 * The ruling requires five outcomes to be distinguishable. Four are decided
 * here, from evidence count and the typed provider-failure kinds;
 * RETAINED_ONLY is decided by the caller, because only the caller knows it
 * substituted retained reporting.
 *
 * THE PRECEDENCE IS THE WHOLE POINT. `NO_RELEVANT_EVIDENCE` is the only value
 * that makes a claim about the WORLD — "the providers answered and nothing
 * matched" — and it is therefore reachable only when no provider refused us.
 * A rate limit and an outage are claims about US, and they are reported as
 * such. Collapsing them is precisely the Alpha defect: a reader was told there
 * was no reporting in East Africa when there was no quota left to ask with.
 */
export function retrievalOutcome(
  articleCount: number,
  failureKinds: ReadonlySet<string>,
): RetrievalOutcome {
  if (articleCount > 0) return 'SUCCESS';
  if (failureKinds.has('rate-limited')) return 'PROVIDER_RATE_LIMITED';
  if (failureKinds.size > 0) return 'PROVIDER_UNAVAILABLE';
  return 'NO_RELEVANT_EVIDENCE';
}

/**
 * Which of `members` actually contributed evidence, by ISO3.
 *
 * Read from each ARTICLE'S OWN resolved country, never from the fact that a
 * request was made for that country. A member that was asked and returned
 * nothing is not counted, which is what lets the response say "5 of 11" and
 * mean it.
 *
 * This is a COUNT BESIDE the evidence, not a property ON it: no article is
 * modified and no article's country is rewritten to the region. That is the
 * ruling's *"requested regional scope must never raise evidence precision"*,
 * enforced by this function having no return path that touches an article.
 */
export function memberIso3WithEvidence(
  articles: readonly NewsArticle[],
  members: readonly CountryMeta[],
): Set<string> {
  const present = new Set(
    articles.map((article) => (article.countryCode ?? '').toUpperCase()).filter((code) => code !== ''),
  );

  return new Set(
    members.filter((member) => present.has(member.iso2.toUpperCase())).map((member) => member.iso3),
  );
}

/** What one regional pass did, per member, for the coverage telemetry. */
export interface RegionCoverage {
  readonly attempted: readonly CountryMeta[];
  readonly unreached: readonly CountryMeta[];
  /** ISO3 of members that contributed at least one relevant LIVE article. */
  readonly live: ReadonlySet<string>;
  /** ISO3 of members attempted whose provider response was a failure. */
  readonly unavailable: ReadonlySet<string>;
  /** ISO3 of members that contributed only retained reporting. */
  readonly retainedOnly?: ReadonlySet<string>;
}

/**
 * THE COVERAGE TELEMETRY, ASSEMBLED IN ONE PLACE.
 *
 * *"Return coverage telemetry sufficient to expose: membersDeclared,
 * membersAttempted, membersLiveRetrieved, membersRetainedOnly,
 * membersUnavailable … do not describe partial coverage as complete regional
 * coverage."*
 *
 * `coverageComplete` is the last clause turned into a value. It is true only
 * when every declared member was attempted AND none was unavailable, so a
 * surface cannot accidentally present a throttled half-pass as a regional
 * answer — it has to look at one boolean rather than reason about five counts.
 *
 * A member counted as `retainedOnly` is deliberately NOT also counted as
 * `live`: the two sets are disjoint by construction, because retained
 * reporting is only ever fetched for members live retrieval did not answer for.
 */
export function buildRegionScope(
  region: { id: string; label: string; members: readonly string[] },
  coverage: RegionCoverage,
): RequestedRegionScope {
  const attempted = coverage.attempted.map((member) => member.iso3);
  const unreached = coverage.unreached.map((member) => member.iso3);
  const retainedOnly = coverage.retainedOnly ?? new Set<string>();

  return {
    id: region.id,
    label: region.label,
    members: region.members,
    membersDeclared: region.members.length,
    membersAttempted: attempted.length,
    membersLiveRetrieved: coverage.live.size,
    membersRetainedOnly: retainedOnly.size,
    membersUnavailable: coverage.unavailable.size,
    attempted,
    notReached: unreached,
    coverageComplete: unreached.length === 0 && coverage.unavailable.size === 0,
  };
}