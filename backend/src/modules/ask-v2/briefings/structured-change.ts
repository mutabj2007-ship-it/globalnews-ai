import { createHash } from 'node:crypto';
import type {
  AskContribution,
  AskContributionObservation,
} from '../../ask-intelligence/ask-contribution.contract';
import type { BriefingIntelligence } from './briefing-snapshot';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R1-B §3 (EA C-3) — STRUCTURED SPECIALIST EVIDENCE IN A FOLLOWED-QUESTION CHECK
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Compares the governed specialist contributions a followed question's baseline version stored
 * (`blocks.intelligence`, written by the ONE coordinator → payload.intelligence) with the ones the
 * check's own Ask turn stored. Pure and deterministic: no reader is called here, no clock is
 * read, nothing is fetched — so a check can never trigger an extra specialist read (test J).
 *
 * IDENTITY. One record = (contributorId, the scope it was read for, the contributor's own stable
 * `reference`). Its CONTENT FINGERPRINT is a hash of the source-stated fields only (kind, label,
 * value, unit, period, geography, source name/url, detail) — never `retainedAt`, so a re-ingest of
 * the same content is not a change, and never ordering.
 *
 *   newly admitted        a record not in the baseline whose `retainedAt` is after the baseline
 *                         → MATERIAL_CHANGE when its source-stated period starts after the baseline
 *                           (a new underlying event / period), otherwise NEW_EVIDENCE
 *                           (late-admitted, earlier-dated: found now ≠ happened now)
 *   content changed       same identity, different fingerprint → the record's CONTENT differs from
 *                         the baseline. CTO review of cf7a5d1: the shared observation contract carries
 *                         NO authoritative revision/correction metadata, so this is NEVER called a
 *                         correction or retraction — it is changed evidence content (NEW_EVIDENCE),
 *                         and the reader is told the source has not stated why it changed
 *   not previously shown  a record not in the baseline that was ALREADY retained before it (a
 *                         reader window / ordering effect) → listed, never a change
 *   not seen this check   a baseline record the check did not return → counted, NEVER a retraction
 *                         (the readers return current revisions only and carry no retraction flag)
 *
 * COMPLETENESS. A contributor that was relevant (considered, not CONTEXT-only) is COMPARED only
 * when the check read it completely: USED or NO_MATCH. DEGRADED / NOT_ASSESSED / REFUSED / NO_DATA,
 * a contributor considered in the baseline but not in the check, or a whole intelligence block
 * missing from either side, makes that class UNASSESSED — the caller then never says "unchanged".
 * Only USED contributions' observations are compared (a non-displayable record is never exposed).
 */

export interface StructuredRecordChange {
  readonly contributorId: string;
  readonly scope: string | null;
  readonly reference: string;
  readonly kind: string;
  readonly label: string | null;
  readonly period: string;
  readonly geography: string;
  readonly source: { readonly name: string; readonly url: string | null };
  readonly retainedAt: string | null;
}

export interface StructuredComparison {
  /** false when no specialist evidence was relevant on either side (nothing to compare). */
  readonly applicable: boolean;
  /** The baseline carried no comparable structured record set (absent, or every class unassessed). */
  readonly baselineMissing: boolean;
  readonly newEvents: readonly StructuredRecordChange[];
  readonly lateAdmitted: readonly StructuredRecordChange[];
  /** Same identity, different source-stated content — NOT a source-authorized correction. */
  readonly contentChanged: readonly StructuredRecordChange[];
  readonly notPreviouslyShownCount: number;
  readonly notSeenThisCheckCount: number;
  readonly carriedOverCount: number;
  /** `CONTRIBUTOR:scope:STATUS` for every relevant class this check could not compare. */
  readonly unassessed: readonly string[];
  /** Contributor classes that were compared completely. */
  readonly compared: readonly string[];
}

const COMPLETE: ReadonlySet<string> = new Set(['USED', 'NO_MATCH']);

function classOf(c: Pick<AskContribution, 'contributorId' | 'geographyBasis'>): string {
  return `${c.contributorId}:${c.geographyBasis ?? '*'}`;
}

function relevant(c: AskContribution): boolean {
  return c.applicability !== 'CONTEXT' && c.contributorId !== 'GEOGRAPHY';
}

export function structuredFingerprint(o: AskContributionObservation): string {
  const content = {
    kind: o.kind,
    label: o.label,
    value: o.value,
    unit: o.unit,
    period: o.period,
    geography: o.geography,
    source: { name: o.source.name, url: o.source.url },
    detail: o.detail ?? null,
  };
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

function recordsOf(intel: BriefingIntelligence | null) {
  const out = new Map<string, { change: StructuredRecordChange; fingerprint: string }>();
  for (const c of intel?.contributions ?? []) {
    if (!relevant(c) || c.status !== 'USED') continue;
    for (const o of c.observations ?? []) {
      out.set(`${c.contributorId}|${c.geographyBasis ?? '*'}|${o.reference}`, {
        fingerprint: structuredFingerprint(o),
        change: {
          contributorId: c.contributorId,
          scope: c.geographyBasis,
          reference: o.reference,
          kind: o.kind,
          label: o.label,
          period: o.period,
          geography: o.geography,
          source: { name: o.source.name, url: o.source.url },
          retainedAt: o.retainedAt,
        },
      });
    }
  }
  return out;
}

/** The start of a source-stated period ('2026-08-31', '2026-08', '2026', '2024/2025'), or null. */
export function periodStart(period: string): number | null {
  const m = /^(\d{4})(?:[-/](\d{2}))?(?:-(\d{2}))?/.exec(period.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const second = m[2] === undefined ? null : Number(m[2]);
  /* "2024/2025" is a cycle, not a month */
  const month = second !== null && second >= 1 && second <= 12 && period.includes('-') ? second : 1;
  const day = m[3] === undefined ? 1 : Number(m[3]);
  const at = Date.UTC(year, month - 1, day);
  return Number.isFinite(at) ? at : null;
}

const after = (iso: string | null, baselineMs: number) => {
  if (iso === null) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t > baselineMs;
};

export function compareStructured(
  baseline: BriefingIntelligence | null | undefined,
  candidate: BriefingIntelligence | null | undefined,
  baselineAsOf: string,
): StructuredComparison {
  const baseRelevant = (baseline?.contributions ?? []).filter(relevant);
  const candRelevant = (candidate?.contributions ?? []).filter(relevant);
  const empty = {
    newEvents: [],
    lateAdmitted: [],
    contentChanged: [],
    notPreviouslyShownCount: 0,
    notSeenThisCheckCount: 0,
    carriedOverCount: 0,
  };
  if (baseRelevant.length === 0 && candRelevant.length === 0) {
    return { applicable: false, baselineMissing: false, ...empty, unassessed: [], compared: [] };
  }

  const unassessed = new Set<string>();
  const compared = new Set<string>();
  const candByClass = new Map(candRelevant.map((c) => [classOf(c), c]));
  const baseByClass = new Map(baseRelevant.map((c) => [classOf(c), c]));
  /* the whole structured read is missing on one side while the other had relevant specialists */
  if (candidate == null && baseRelevant.length > 0) {
    for (const c of baseRelevant) unassessed.add(`${classOf(c)}:NOT_READ`);
  }
  for (const c of candRelevant) {
    if (!COMPLETE.has(c.status)) unassessed.add(`${classOf(c)}:${c.status}`);
  }
  if (candidate != null) {
    for (const [cls] of baseByClass) {
      if (!candByClass.has(cls)) unassessed.add(`${cls}:NOT_CONSIDERED`);
    }
  }
  /* the baseline's own read of a class was incomplete: nothing comparable was recorded for it */
  const baselineMissing =
    baseline == null ||
    baseRelevant.length === 0 ||
    baseRelevant.every((c) => !COMPLETE.has(c.status));
  for (const c of candRelevant) {
    const base = baseByClass.get(classOf(c));
    if (COMPLETE.has(c.status) && base !== undefined && COMPLETE.has(base.status)) {
      compared.add(classOf(c));
    } else if (COMPLETE.has(c.status) && (base === undefined || !COMPLETE.has(base.status))) {
      unassessed.add(`${classOf(c)}:NO_COMPARABLE_BASELINE`);
    }
  }

  const baselineMs = Date.parse(baselineAsOf);
  const baseRecords = recordsOf(baseline ?? null);
  const candRecords = recordsOf(candidate ?? null);
  const newEvents: StructuredRecordChange[] = [];
  const lateAdmitted: StructuredRecordChange[] = [];
  const contentChanged: StructuredRecordChange[] = [];
  let notPreviouslyShownCount = 0;
  let carriedOverCount = 0;
  for (const [key, rec] of candRecords) {
    const cls = `${rec.change.contributorId}:${rec.change.scope ?? '*'}`;
    if (!compared.has(cls)) continue;
    const prior = baseRecords.get(key);
    if (prior === undefined) {
      if (!after(rec.change.retainedAt, baselineMs)) {
        notPreviouslyShownCount += 1;
        continue;
      }
      const start = periodStart(rec.change.period);
      if (start !== null && start > baselineMs) newEvents.push(rec.change);
      else lateAdmitted.push(rec.change);
    } else if (prior.fingerprint !== rec.fingerprint) {
      contentChanged.push(rec.change);
    } else {
      carriedOverCount += 1;
    }
  }
  let notSeenThisCheckCount = 0;
  for (const [key, rec] of baseRecords) {
    const cls = `${rec.change.contributorId}:${rec.change.scope ?? '*'}`;
    if (compared.has(cls) && !candRecords.has(key)) notSeenThisCheckCount += 1;
  }
  return {
    applicable: true,
    baselineMissing,
    newEvents,
    lateAdmitted,
    contentChanged,
    notPreviouslyShownCount,
    notSeenThisCheckCount,
    carriedOverCount,
    unassessed: [...unassessed].sort(),
    compared: [...compared].sort(),
  };
}
