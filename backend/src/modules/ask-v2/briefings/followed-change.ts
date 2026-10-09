import type { BriefingEvidenceRef } from './briefing-snapshot';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REASON TO RETURN R1 · §8 — WHAT CHANGED SINCE THE READER LAST CHECKED A FOLLOWED QUESTION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Pure and deterministic: the same baseline version and the same check always give the same
 * assessment. No AI, no clock beyond the timestamps passed in, no retrieval.
 *
 * WHAT COUNTS AS A CHANGE, AND WHAT DOES NOT.
 *   - NEW EVIDENCE is a cited report that was not in the baseline AND was published after the
 *     baseline was taken. A newly discovered report published BEFORE the baseline is "earlier
 *     reporting found now" — it is listed, never counted as an event change. An undated report
 *     is never fresh.
 *   - A SOURCE-SUPPORTED CHANGE is a key point of the new answer that cites new evidence. New
 *     wording of an old point is not a change: a key point that cites only evidence the baseline
 *     already had is not counted, whatever its words.
 *   - A POSSIBLE CORRECTION is new evidence whose headline says it corrects, retracts or
 *     clarifies. It is flagged for the reader to open — we do not decide what it overturns.
 *   - Evidence that the new search did not return again is "not seen in this check". That is NOT
 *     a retraction and NOT a sign the situation ended: a search that missed it proves nothing.
 *   - A check whose search failed or was cut short is INCOMPLETE: the baseline stays as it was,
 *     visible with its age, and is never overwritten by empty data. A partial check that still
 *     found new evidence reports it, together with which part could not be checked.
 *   - Expired notices are NOT assessed: no current source carries notice expiry. The assessment
 *     never claims one.
 */

export const FOLLOWED_CHECK_OUTCOMES = [
  'INCOMPLETE_CHECK',
  'INSUFFICIENT_BASELINE',
  'POSSIBLE_CORRECTION',
  'MATERIAL_CHANGE',
  'NEW_EVIDENCE',
  'UNCHANGED',
  'NO_RELEVANT_UPDATE',
] as const;
export type FollowedCheckOutcome = (typeof FOLLOWED_CHECK_OUTCOMES)[number];

/** Outcomes whose candidate becomes the next stored version (a usable, changed reading). */
export const VERSIONING_OUTCOMES: ReadonlySet<FollowedCheckOutcome> = new Set([
  'INSUFFICIENT_BASELINE',
  'POSSIBLE_CORRECTION',
  'MATERIAL_CHANGE',
  'NEW_EVIDENCE',
]);

export interface FollowedBaseline {
  readonly version: number;
  readonly asOf: string;
  readonly answerState: string | null;
  readonly summaryPresent: boolean;
  readonly evidenceRefs: readonly BriefingEvidenceRef[];
  /** The scope revision the baseline was taken under (editing the question bumps it). */
  readonly scopeRevision: number;
}

export interface FollowedCandidate {
  /** null when the check's operation did not complete with a stored, snapshot-able result. */
  readonly snapshot: {
    readonly asOf: string;
    readonly answerState: string | null;
    readonly summaryPresent: boolean;
    readonly keyFacts: readonly { readonly claim: string; readonly sourceArticleIds: readonly string[] }[];
    readonly evidenceRefs: readonly BriefingEvidenceRef[];
  } | null;
  /** Every attempted source failed or was cut (search could not run). */
  readonly retrievalFailed: boolean;
  /** Some sources answered and some did not: the names of the ones that did not. */
  readonly unassessedSources: readonly string[];
  readonly scopeRevision: number;
}

export interface ChangedEvidence {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly publisher: string;
  readonly publishedAt: string | null;
}

export interface FollowedAssessment {
  readonly schema: 'followed-assessment/1';
  readonly outcome: FollowedCheckOutcome;
  /** Why the outcome is what it is, as codes (never prose). */
  readonly reasons: readonly string[];
  readonly baselineVersion: number | null;
  readonly baselineAsOf: string | null;
  readonly checkedAsOf: string | null;
  readonly newEvidence: readonly ChangedEvidence[];
  readonly earlierReportingFoundNow: readonly ChangedEvidence[];
  readonly possibleCorrections: readonly ChangedEvidence[];
  /** Key points of the new answer that cite new evidence (our output, with their source ids). */
  readonly supportedChanges: readonly { readonly claim: string; readonly sourceArticleIds: readonly string[] }[];
  readonly carriedOverCount: number;
  readonly notSeenThisCheckCount: number;
  readonly unassessedSources: readonly string[];
  /** Fixed: no source in the register carries notice expiry. */
  readonly expiredNotices: 'NOT_ASSESSED';
}

/*
  Headlines that announce a correction, retraction or clarification, in the supported languages.
  A flag for the reader, never a verdict.
*/
const CORRECTION_HEADLINE =
  /\b(correction|corrected|corrects|retract(?:s|ed|ion)?|clarification|update:? correction|sprostowanie|korekta|rectificatif|rectification|berichtigung|richtigstellung|correcci[oó]n|rectificaci[oó]n|corre[cç][aã]o|retifica[cç][aã]o)\b|تصحيح/iu;

/** One key per report: the link without fragment, trailing slash or tracking parameters. */
export function evidenceKey(ref: { readonly url: string; readonly id: string }): string {
  try {
    const url = new URL(ref.url);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|ref$|cmpid$)/i.test(key)) url.searchParams.delete(key);
    }
    return `${url.hostname.replace(/^www\./, '').toLowerCase()}${url.pathname.replace(/\/+$/, '')}${url.search}`;
  } catch {
    return `id:${ref.id}`;
  }
}

function changed(ref: BriefingEvidenceRef): ChangedEvidence {
  return {
    id: ref.id,
    url: ref.url,
    title: ref.title,
    publisher: ref.publisher,
    publishedAt: ref.publishedAt,
  };
}

function after(publishedAt: string | null, baselineAsOf: string): boolean {
  if (publishedAt === null) return false;
  const published = Date.parse(publishedAt);
  const baseline = Date.parse(baselineAsOf);
  return Number.isFinite(published) && Number.isFinite(baseline) && published > baseline;
}

const SOURCED_ANSWER_STATES = new Set([
  'CURRENT_REPORTING',
  'CURRENTLY_VERIFIED',
  'RETAINED_REPORTING',
  'PARTIAL',
]);

function baselineUsable(baseline: FollowedBaseline): boolean {
  return (
    baseline.evidenceRefs.length > 0 &&
    baseline.summaryPresent &&
    (baseline.answerState === null || SOURCED_ANSWER_STATES.has(baseline.answerState))
  );
}

export function assessFollowedCheck(
  baseline: FollowedBaseline | null,
  candidate: FollowedCandidate,
): FollowedAssessment {
  const base = {
    schema: 'followed-assessment/1' as const,
    baselineVersion: baseline?.version ?? null,
    baselineAsOf: baseline?.asOf ?? null,
    checkedAsOf: candidate.snapshot?.asOf ?? null,
    unassessedSources: [...candidate.unassessedSources],
    expiredNotices: 'NOT_ASSESSED' as const,
  };
  const empty = {
    newEvidence: [],
    earlierReportingFoundNow: [],
    possibleCorrections: [],
    supportedChanges: [],
    carriedOverCount: 0,
    notSeenThisCheckCount: 0,
  };

  const snapshot = candidate.snapshot;
  if (snapshot === null) {
    return {
      ...base,
      ...empty,
      outcome: 'INCOMPLETE_CHECK',
      reasons: [candidate.retrievalFailed ? 'SEARCH_FAILED' : 'CHECK_NOT_COMPLETED'],
    };
  }
  /* the search itself could not run: nothing it "did not find" means anything */
  if (candidate.retrievalFailed && snapshot.evidenceRefs.length === 0) {
    return { ...base, ...empty, outcome: 'INCOMPLETE_CHECK', reasons: ['SEARCH_FAILED'] };
  }

  const candidateSourced =
    snapshot.evidenceRefs.length > 0 &&
    snapshot.summaryPresent &&
    (snapshot.answerState === null || SOURCED_ANSWER_STATES.has(snapshot.answerState));

  if (baseline === null || baseline.scopeRevision !== candidate.scopeRevision || !baselineUsable(baseline)) {
    const reason =
      baseline === null
        ? 'NO_BASELINE'
        : baseline.scopeRevision !== candidate.scopeRevision
          ? 'QUESTION_EDITED_SINCE_BASELINE'
          : 'BASELINE_HAD_NO_SOURCED_ANSWER';
    return {
      ...base,
      ...empty,
      outcome: candidateSourced ? 'INSUFFICIENT_BASELINE' : 'NO_RELEVANT_UPDATE',
      reasons: candidateSourced ? [reason, 'NEW_BASELINE_TAKEN'] : [reason, 'NO_SOURCED_ANSWER'],
    };
  }

  const baselineKeys = new Set(baseline.evidenceRefs.map(evidenceKey));
  const candidateKeys = new Set(snapshot.evidenceRefs.map(evidenceKey));
  const added = snapshot.evidenceRefs.filter((ref) => !baselineKeys.has(evidenceKey(ref)));
  const fresh = added.filter((ref) => after(ref.publishedAt, baseline.asOf));
  const late = added.filter((ref) => !after(ref.publishedAt, baseline.asOf));
  const corrections = fresh.filter((ref) => CORRECTION_HEADLINE.test(ref.title));
  const freshIds = new Set(fresh.map((ref) => ref.id));
  const supportedChanges = snapshot.keyFacts
    .filter((fact) => fact.sourceArticleIds.some((id) => freshIds.has(id)))
    .map((fact) => ({ claim: fact.claim, sourceArticleIds: [...fact.sourceArticleIds] }));
  const carriedOverCount = snapshot.evidenceRefs.filter((ref) => baselineKeys.has(evidenceKey(ref))).length;
  const notSeenThisCheckCount = baseline.evidenceRefs.filter((ref) => !candidateKeys.has(evidenceKey(ref))).length;

  const detail = {
    newEvidence: fresh.map(changed),
    earlierReportingFoundNow: late.map(changed),
    possibleCorrections: corrections.map(changed),
    supportedChanges,
    carriedOverCount,
    notSeenThisCheckCount,
  };
  const partial = candidate.unassessedSources.length > 0 ? ['PARTIAL_CHECK'] : [];

  if (fresh.length > 0) {
    if (corrections.length > 0) {
      return { ...base, ...detail, outcome: 'POSSIBLE_CORRECTION', reasons: ['CORRECTION_HEADLINE', ...partial] };
    }
    if (supportedChanges.length > 0) {
      return { ...base, ...detail, outcome: 'MATERIAL_CHANGE', reasons: ['KEY_POINT_CITES_NEW_EVIDENCE', ...partial] };
    }
    return { ...base, ...detail, outcome: 'NEW_EVIDENCE', reasons: ['NEW_REPORTING_AFTER_BASELINE', ...partial] };
  }
  /* nothing new after the baseline: an incomplete search cannot say "unchanged" */
  if (partial.length > 0) {
    return { ...base, ...detail, outcome: 'INCOMPLETE_CHECK', reasons: ['PARTIAL_CHECK', 'NO_NEW_EVIDENCE_IN_CHECKED_PART'] };
  }
  if (candidateSourced && carriedOverCount > 0) {
    return { ...base, ...detail, outcome: 'UNCHANGED', reasons: ['SAME_RELEVANT_EVIDENCE'] };
  }
  return {
    ...base,
    ...detail,
    outcome: 'NO_RELEVANT_UPDATE',
    reasons: [candidateSourced ? 'NO_NEW_REPORTING_AFTER_BASELINE' : 'SEARCH_COMPLETED_NO_RELEVANT_REPORTING'],
  };
}
