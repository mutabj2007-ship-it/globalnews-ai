import { createHash } from 'node:crypto';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * EA-STORY-BRIEF-01 — CANONICAL STORY BRIEF: THE PURE RULES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * docs/convergence/east-africa/STORY-BRIEF-CONTRACT.md. No I/O, no clock reads (callers pass
 * `now`). The states are kept apart on purpose:
 *   a CONCLUSION (READY / PARTIAL / INSUFFICIENT) is persisted, once per evidence revision;
 *   a FAILURE (provider degraded, budget refused, capability unavailable …) is an ATTEMPT outcome
 *   and is never presented as "insufficient evidence";
 *   STALE means "the evidence set changed since this Brief" — never "something material happened";
 *   CHECKING means one generation is in flight for the current evidence.
 */

export const STORY_BRIEF_CONCLUSIONS = ['READY', 'PARTIAL', 'INSUFFICIENT'] as const;
export type StoryBriefConclusion = (typeof STORY_BRIEF_CONCLUSIONS)[number];

export const STORY_BRIEF_FAILURE_KINDS = [
  'PROVIDER_DEGRADED',
  'BUDGET_REFUSED',
  'CAPABILITY_UNAVAILABLE',
  'EXECUTION_FAILED',
  'OUTCOME_UNKNOWN',
] as const;
export type StoryBriefFailureKind = (typeof STORY_BRIEF_FAILURE_KINDS)[number];

export type StoryBriefReadState =
  | 'NOT_GENERATED'
  | 'CHECKING'
  | StoryBriefConclusion
  | 'STALE'
  | 'FAILED';

/** A generation claim lives this long; past it the outcome is unknown and is never re-run. */
export const STORY_BRIEF_LEASE_MS = 5 * 60 * 1000;

const ARTICLE_REF = /^[0-9a-f]{64}$/;

/**
 * The evidence revision: sha256 over the canonical story's admitted evidence set (its member
 * articleRefs, alias set included). Order and duplicates do not matter; every member counts —
 * a same-publisher update changes it although Story.briefVersion (new HOST only) does not.
 */
export function evidenceRevisionOf(articleRefs: readonly string[]): string {
  const refs = [...new Set(articleRefs.filter((r) => ARTICLE_REF.test(r)))].sort();
  return createHash('sha256').update(`story-brief-evidence/1\n${refs.join('\n')}`).digest('hex');
}

export interface VersionFact {
  readonly evidenceRevision: string;
  readonly state: StoryBriefConclusion;
}

export interface AttemptFact {
  readonly evidenceRevision: string;
  readonly status: 'CHECKING' | 'DONE' | 'FAILED';
  readonly failureKind: StoryBriefFailureKind | null;
  readonly leaseExpiresAt: Date;
}

/**
 * The read state, from facts only (zero compute):
 *   current-revision version            → its conclusion
 *   live CHECKING claim for the revision → CHECKING
 *   last current-revision attempt FAILED → FAILED (or STALE when an older Brief exists)
 *   an older Brief only                  → STALE (still inspectable)
 *   nothing                              → NOT_GENERATED
 */
export function readStateOf(input: {
  readonly currentRevision: string;
  readonly versionForCurrent: VersionFact | null;
  readonly latestVersion: VersionFact | null;
  readonly lastAttemptForCurrent: AttemptFact | null;
  readonly now: Date;
}): StoryBriefReadState {
  if (input.versionForCurrent !== null) return input.versionForCurrent.state;
  const attempt = input.lastAttemptForCurrent;
  if (attempt?.status === 'CHECKING' && attempt.leaseExpiresAt.getTime() > input.now.getTime()) {
    return 'CHECKING';
  }
  if (input.latestVersion !== null) return 'STALE';
  if (attempt?.status === 'FAILED') return 'FAILED';
  return 'NOT_GENERATED';
}

export function isConclusion(value: string): value is StoryBriefConclusion {
  return (STORY_BRIEF_CONCLUSIONS as readonly string[]).includes(value);
}
