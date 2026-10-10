import type {
  AskV2BriefingDetail,
  AskV2BriefingEvidenceRef,
  AskV2BriefingVersion,
  AskV2FollowedCheck,
  AskV2Outcome,
} from '@/lib/api/askV2Api';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 · D09 — BEFORE / LATEST OF ONE RECORDED CHECK (pure; no network, no clock)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The CTO rule (2026-10-10): compare ONLY the `baselineVersion` and the `resultingVersion` of the
 * SAME recorded check (`GET /ask-v2/briefings/:id` → `checks[]`). Never pair two unrelated saved
 * versions, and never use "the saved-answer versions" as a substitute. When either side is
 * missing, unreadable or withheld, the status says so and nothing is compared.
 *
 * Every fact used here was persisted by the server for the owner's account: the check record, its
 * assessment, and the two stored versions. There is no reviewed / unreviewed state, and nothing
 * here derives one.
 */

/** The `check` address value that means "the newest recorded check". */
export const LATEST_CHECK = 'latest';

/** One recorded check of this briefing: by id, or the newest one (`LATEST_CHECK`). */
export function selectCheck(
  detail: Pick<AskV2BriefingDetail, 'checks'>,
  wanted: string,
): AskV2FollowedCheck | null {
  const checks = detail.checks ?? [];
  if (wanted === LATEST_CHECK) {
    let newest: AskV2FollowedCheck | null = null;
    for (const check of checks) {
      if (newest === null || Date.parse(check.checkedAt) > Date.parse(newest.checkedAt)) newest = check;
    }
    return newest;
  }
  return checks.find((check) => check.id === wanted) ?? null;
}

/**
 * The two versions this check's own record names, and nothing else. Null where the record has
 * none. Equal numbers mean the check kept the same saved answer.
 */
export function versionsToCompare(check: AskV2FollowedCheck): {
  readonly before: number | null;
  readonly latest: number | null;
} {
  return { before: check.baselineVersion, latest: check.resultingVersion };
}

export type VersionRead =
  | { readonly kind: 'OK'; readonly version: AskV2BriefingVersion }
  | { readonly kind: 'WITHHELD' }
  | { readonly kind: 'UNAVAILABLE' };

/**
 * What one version read gave. Withheld (source rights) is an HTTP refusal of the content —
 * 451 Unavailable For Legal Reasons or 403 — and is shown withheld, never as text. A read that
 * returned a DIFFERENT version than the one asked for is never used: it would pair unrelated
 * versions.
 */
export function versionReadOf(
  requested: number,
  outcome: AskV2Outcome<AskV2BriefingVersion>,
): VersionRead {
  if (!outcome.ok) {
    return outcome.status === 451 || outcome.status === 403 ? { kind: 'WITHHELD' } : { kind: 'UNAVAILABLE' };
  }
  return outcome.value.version === requested ? { kind: 'OK', version: outcome.value } : { kind: 'UNAVAILABLE' };
}

export type ComparisonStatus =
  | 'READY'
  | 'CHECK_NOT_FOUND'
  | 'NO_BASELINE'
  | 'NO_RESULT'
  | 'SAME_VERSION'
  | 'BEFORE_WITHHELD'
  | 'LATEST_WITHHELD'
  | 'BEFORE_UNAVAILABLE'
  | 'LATEST_UNAVAILABLE';

/** Statuses decided by the check record alone (no version read is needed, or made). */
export function recordStatus(check: AskV2FollowedCheck | null): ComparisonStatus | null {
  if (check === null) return 'CHECK_NOT_FOUND';
  const { before, latest } = versionsToCompare(check);
  if (before === null) return 'NO_BASELINE';
  if (latest === null) return 'NO_RESULT';
  if (before === latest) return 'SAME_VERSION';
  return null;
}

/** The comparison status once both reads are back. Withheld outranks unavailable (it is a fact). */
export function comparisonStatus(
  check: AskV2FollowedCheck | null,
  before: VersionRead | null,
  latest: VersionRead | null,
): ComparisonStatus {
  const fromRecord = recordStatus(check);
  if (fromRecord !== null) return fromRecord;
  if (before?.kind === 'WITHHELD') return 'BEFORE_WITHHELD';
  if (latest?.kind === 'WITHHELD') return 'LATEST_WITHHELD';
  if (before === null || before.kind !== 'OK') return 'BEFORE_UNAVAILABLE';
  if (latest === null || latest.kind !== 'OK') return 'LATEST_UNAVAILABLE';
  return 'READY';
}

/**
 * An incomplete check is disclosed as incomplete, whatever else is shown: the outcome itself, or a
 * check the server marked partial (a news or structured class it could not assess).
 */
export function isIncompleteCheck(check: AskV2FollowedCheck): boolean {
  return check.outcome === 'INCOMPLETE_CHECK' || check.assessment.reasons.includes('PARTIAL_CHECK');
}

/**
 * The evidence behind one source-supported change: the LATEST version's own stored references the
 * claim cites (publisher, date, link). An id the latest version does not hold is not linked, and
 * no reference is made up.
 */
export function evidenceForClaim(
  sourceArticleIds: readonly string[],
  latest: AskV2BriefingVersion,
): readonly AskV2BriefingEvidenceRef[] {
  const byId = new Map(latest.evidenceRefs.map((ref) => [ref.id, ref]));
  const out: AskV2BriefingEvidenceRef[] = [];
  for (const id of sourceArticleIds) {
    const ref = byId.get(id);
    if (ref !== undefined && !out.includes(ref)) out.push(ref);
  }
  return out;
}

/**
 * ACTUAL CHANGES vs NEW REPORTING. A change is a point of the latest answer that cites reporting
 * published after the baseline (the server's `supportedChanges`), or a governed record for a new
 * period (`structured.newEvents`). New reporting (`newEvidence`), earlier-dated reporting found now,
 * and changed or late-admitted records are NOT changes to the answer, and are never presented as
 * one.
 */
export function changeClasses(check: AskV2FollowedCheck): {
  readonly changes: number;
  readonly newReporting: number;
} {
  const a = check.assessment;
  return {
    changes: a.supportedChanges.length + (a.structured?.newEvents.length ?? 0),
    newReporting:
      a.newEvidence.length +
      a.earlierReportingFoundNow.length +
      (a.structured?.contentChanged.length ?? 0) +
      (a.structured?.lateAdmitted.length ?? 0),
  };
}

/** `/saved/briefing?id=…&check=…&from=updates` — the change detail of one recorded check. */
export function checkComparisonHref(briefingId: string, check: string): string {
  return `/saved/briefing?id=${encodeURIComponent(briefingId)}&check=${encodeURIComponent(check)}&from=updates`;
}
