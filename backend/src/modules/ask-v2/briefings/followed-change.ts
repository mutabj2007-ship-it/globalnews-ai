import type { BriefingEvidenceRef, BriefingIntelligence } from './briefing-snapshot';
import { compareStructured, type StructuredRecordChange } from './structured-change';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REASON TO RETURN R1 · §8 (+ CTO R1-B §3) — WHAT CHANGED SINCE THE LAST CHECK OF A FOLLOWED QUESTION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Pure and deterministic: the same baseline version and the same check always give the same
 * assessment. No AI, no clock beyond the timestamps passed in, no retrieval and no specialist read.
 * TWO evidence classes are compared: news reporting (cited references) and governed specialist
 * records (the contributions the ONE coordinator stored on each version — structured-change.ts).
 *
 * THE OUTCOMES (CTO R1-B §3, reconciled with this enum):
 *   NEW_EVIDENCE           newly admitted relevant evidence — including late-discovered reporting or
 *                          records dated before the baseline (found now ≠ happened now)
 *   MATERIAL_CHANGE        a supported change in the underlying event/condition/claim: a key point of
 *                          the new answer cites reporting published after the baseline, or a newly
 *                          admitted structured record whose source period starts after the baseline
 *   CORRECTION             a governed record revised by its source (same identity, new content), or
 *                          a newly published report whose headline announces a correction/retraction
 *                          (flagged — Ask does not adjudicate what it overturns)
 *   UNCHANGED              (≙ R1-B NO_RELEVANT_UPDATE, complete) every relevant class was compared
 *                          and the same relevant evidence was found; new wording is never a change
 *   NO_RELEVANT_UPDATE     (≙ R1-B NO_RELEVANT_UPDATE, complete) the check completed and found no
 *                          relevant evidence at all — which never means nothing is happening
 *   INSUFFICIENT_BASELINE  no valid prior comparable evidence (or the question was edited)
 *   INCOMPLETE_CHECK       (≙ R1-B CHECK_INCOMPLETE) the search failed, or a relevant structured
 *                          reader was degraded / not assessed / refused / held no displayable data /
 *                          not compared, AND nothing supported was found in the part that was checked
 *
 * NEVER "UNCHANGED" WITH A HOLE IN IT. When any relevant class was not compared, the outcome cannot
 * be UNCHANGED or NO_RELEVANT_UPDATE: it is INCOMPLETE_CHECK, or — when the checked part found
 * something — that finding plus PARTIAL_CHECK and the unassessed classes. A failed or partial check
 * never writes a version, so the last successful baseline stays intact and visible with its age.
 * Changes are never inferred from a new title alone, a retrieval timestamp, ordering or wording.
 * Expired notices are NOT assessed: no current source carries notice expiry.
 */

export const FOLLOWED_CHECK_OUTCOMES = [
  'INCOMPLETE_CHECK',
  'INSUFFICIENT_BASELINE',
  'CORRECTION',
  'MATERIAL_CHANGE',
  'NEW_EVIDENCE',
  'UNCHANGED',
  'NO_RELEVANT_UPDATE',
] as const;
export type FollowedCheckOutcome = (typeof FOLLOWED_CHECK_OUTCOMES)[number];

/** Outcomes whose candidate becomes the next stored version (a usable, changed reading). */
export const VERSIONING_OUTCOMES: ReadonlySet<FollowedCheckOutcome> = new Set([
  'INSUFFICIENT_BASELINE',
  'CORRECTION',
  'MATERIAL_CHANGE',
  'NEW_EVIDENCE',
]);

export interface FollowedBaseline {
  readonly version: number;
  readonly asOf: string;
  readonly answerState: string | null;
  readonly summaryPresent: boolean;
  readonly evidenceRefs: readonly BriefingEvidenceRef[];
  /** The governed specialist basis stored on that version; undefined = saved before it existed. */
  readonly intelligence?: BriefingIntelligence | null;
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
    readonly intelligence?: BriefingIntelligence | null;
  } | null;
  /** Every attempted NEWS source failed or was cut (the news search could not run). */
  readonly retrievalFailed: boolean;
  /** Some news sources answered and some did not: the names of the ones that did not. */
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
  readonly schema: 'followed-assessment/2';
  readonly outcome: FollowedCheckOutcome;
  /** Why the outcome is what it is, as codes (never prose). */
  readonly reasons: readonly string[];
  readonly baselineVersion: number | null;
  readonly baselineAsOf: string | null;
  readonly checkedAsOf: string | null;
  /* news reporting */
  readonly newEvidence: readonly ChangedEvidence[];
  readonly earlierReportingFoundNow: readonly ChangedEvidence[];
  readonly possibleCorrections: readonly ChangedEvidence[];
  /** Key points of the new answer that cite reporting published after the baseline. */
  readonly supportedChanges: readonly { readonly claim: string; readonly sourceArticleIds: readonly string[] }[];
  readonly carriedOverCount: number;
  readonly notSeenThisCheckCount: number;
  /** News sources that did not answer in this check. */
  readonly unassessedSources: readonly string[];
  /* governed specialist records */
  readonly structured: {
    readonly applicable: boolean;
    readonly newEvents: readonly StructuredRecordChange[];
    readonly lateAdmitted: readonly StructuredRecordChange[];
    readonly revised: readonly StructuredRecordChange[];
    readonly carriedOverCount: number;
    readonly notSeenThisCheckCount: number;
    readonly notPreviouslyShownCount: number;
    /** `CONTRIBUTOR:scope:STATUS` classes this check could not compare. */
    readonly unassessed: readonly string[];
    readonly compared: readonly string[];
  };
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

function newsUsable(s: {
  readonly evidenceRefs: readonly BriefingEvidenceRef[];
  readonly summaryPresent: boolean;
  readonly answerState: string | null;
}): boolean {
  return (
    s.evidenceRefs.length > 0 &&
    s.summaryPresent &&
    (s.answerState === null || SOURCED_ANSWER_STATES.has(s.answerState))
  );
}

/** Governed specialist observations from USED contributions (relevant classes only). */
function hasStructured(intel: BriefingIntelligence | null | undefined): boolean {
  return (intel?.contributions ?? []).some(
    (c) =>
      c.status === 'USED' &&
      c.applicability !== 'CONTEXT' &&
      c.contributorId !== 'GEOGRAPHY' &&
      (c.observations ?? []).length > 0,
  );
}

const EMPTY_STRUCTURED = {
  applicable: false,
  newEvents: [],
  lateAdmitted: [],
  revised: [],
  carriedOverCount: 0,
  notSeenThisCheckCount: 0,
  notPreviouslyShownCount: 0,
  unassessed: [],
  compared: [],
} as const;

export function assessFollowedCheck(
  baseline: FollowedBaseline | null,
  candidate: FollowedCandidate,
): FollowedAssessment {
  const base = {
    schema: 'followed-assessment/2' as const,
    baselineVersion: baseline?.version ?? null,
    baselineAsOf: baseline?.asOf ?? null,
    checkedAsOf: candidate.snapshot?.asOf ?? null,
    unassessedSources: [...candidate.unassessedSources],
    expiredNotices: 'NOT_ASSESSED' as const,
  };
  const emptyNews = {
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
      ...emptyNews,
      structured: EMPTY_STRUCTURED,
      outcome: 'INCOMPLETE_CHECK',
      reasons: [candidate.retrievalFailed ? 'SEARCH_FAILED' : 'CHECK_NOT_COMPLETED'],
    };
  }

  const candidateUsable = newsUsable(snapshot) || hasStructured(snapshot.intelligence);
  const comparable =
    baseline !== null &&
    baseline.scopeRevision === candidate.scopeRevision &&
    (newsUsable(baseline) || hasStructured(baseline.intelligence));

  if (!comparable) {
    const reason =
      baseline === null
        ? 'NO_BASELINE'
        : baseline.scopeRevision !== candidate.scopeRevision
          ? 'QUESTION_EDITED_SINCE_BASELINE'
          : 'BASELINE_HAD_NO_SOURCED_ANSWER';
    if (candidate.retrievalFailed && !candidateUsable) {
      return {
        ...base,
        ...emptyNews,
        structured: EMPTY_STRUCTURED,
        outcome: 'INCOMPLETE_CHECK',
        reasons: [reason, 'SEARCH_FAILED'],
      };
    }
    return {
      ...base,
      ...emptyNews,
      structured: EMPTY_STRUCTURED,
      outcome: candidateUsable ? 'INSUFFICIENT_BASELINE' : 'NO_RELEVANT_UPDATE',
      reasons: candidateUsable ? [reason, 'NEW_BASELINE_TAKEN'] : [reason, 'NO_SOURCED_ANSWER'],
    };
  }

  /* ── news reporting ── */
  const newsCompared = !candidate.retrievalFailed;
  const baselineKeys = new Set(baseline.evidenceRefs.map(evidenceKey));
  const candidateKeys = new Set(snapshot.evidenceRefs.map(evidenceKey));
  const added = newsCompared ? snapshot.evidenceRefs.filter((ref) => !baselineKeys.has(evidenceKey(ref))) : [];
  const fresh = added.filter((ref) => after(ref.publishedAt, baseline.asOf));
  const late = added.filter((ref) => !after(ref.publishedAt, baseline.asOf));
  const corrections = fresh.filter((ref) => CORRECTION_HEADLINE.test(ref.title));
  const freshIds = new Set(fresh.map((ref) => ref.id));
  const supportedChanges = snapshot.keyFacts
    .filter((fact) => fact.sourceArticleIds.some((id) => freshIds.has(id)))
    .map((fact) => ({ claim: fact.claim, sourceArticleIds: [...fact.sourceArticleIds] }));
  const news = {
    newEvidence: fresh.map(changed),
    earlierReportingFoundNow: late.map(changed),
    possibleCorrections: corrections.map(changed),
    supportedChanges,
    carriedOverCount: newsCompared
      ? snapshot.evidenceRefs.filter((ref) => baselineKeys.has(evidenceKey(ref))).length
      : 0,
    notSeenThisCheckCount: newsCompared
      ? baseline.evidenceRefs.filter((ref) => !candidateKeys.has(evidenceKey(ref))).length
      : 0,
  };

  /* ── governed specialist records ── */
  const s = compareStructured(baseline.intelligence, snapshot.intelligence, baseline.asOf);
  const structured = {
    applicable: s.applicable,
    newEvents: s.newEvents,
    lateAdmitted: s.lateAdmitted,
    revised: s.revised,
    carriedOverCount: s.carriedOverCount,
    notSeenThisCheckCount: s.notSeenThisCheckCount,
    notPreviouslyShownCount: s.notPreviouslyShownCount,
    unassessed: s.unassessed,
    compared: s.compared,
  };

  const holes = [
    ...(candidate.retrievalFailed ? ['NEWS_SEARCH_FAILED'] : []),
    ...(candidate.unassessedSources.length > 0 ? ['NEWS_PARTIAL'] : []),
    ...(s.unassessed.length > 0 ? ['STRUCTURED_NOT_ASSESSED'] : []),
  ];
  const partial = holes.length > 0 ? ['PARTIAL_CHECK', ...holes] : [];
  const result = (outcome: FollowedCheckOutcome, reasons: string[]): FollowedAssessment => ({
    ...base,
    ...news,
    structured,
    outcome,
    reasons: [...reasons, ...partial],
  });

  if (s.revised.length > 0) return result('CORRECTION', ['STRUCTURED_RECORD_REVISED']);
  if (corrections.length > 0) return result('CORRECTION', ['CORRECTION_HEADLINE']);
  if (s.newEvents.length > 0) return result('MATERIAL_CHANGE', ['STRUCTURED_RECORD_NEW_PERIOD']);
  if (supportedChanges.length > 0) return result('MATERIAL_CHANGE', ['KEY_POINT_CITES_NEW_EVIDENCE']);
  if (fresh.length > 0) return result('NEW_EVIDENCE', ['NEW_REPORTING_AFTER_BASELINE']);
  if (s.lateAdmitted.length > 0) return result('NEW_EVIDENCE', ['STRUCTURED_RECORD_LATE_ADMITTED']);
  if (late.length > 0) return result('NEW_EVIDENCE', ['EARLIER_DATED_REPORTING_FOUND']);

  /* nothing supported was found: with any unassessed relevant class, the check is incomplete */
  if (holes.length > 0) {
    return {
      ...base,
      ...news,
      structured,
      outcome: 'INCOMPLETE_CHECK',
      reasons: ['NOTHING_NEW_IN_CHECKED_PART', ...holes],
    };
  }
  const carried = news.carriedOverCount + s.carriedOverCount;
  if (carried > 0) return result('UNCHANGED', ['SAME_RELEVANT_EVIDENCE']);
  return result('NO_RELEVANT_UPDATE', [
    newsUsable(snapshot) ? 'NO_NEW_REPORTING_AFTER_BASELINE' : 'SEARCH_COMPLETED_NO_RELEVANT_REPORTING',
  ]);
}
