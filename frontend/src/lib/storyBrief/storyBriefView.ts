/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMPACT VISUAL PRODUCT R1 — THE STORY BRIEF FRONTEND CONSUMER CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The presentation states Design R1 renders, RE-AUTHORED TO THE SERVER'S TRUTH. Claude H's H0
 * proposal (H0/27, package 3187cb79…486c) was accepted as the frontend consumer boundary ONLY
 * (H0 ruling 3); the backend authority is the East Africa controller's canonical Story Brief R1
 * (EA-STORY-BRIEF-01, docs/convergence/east-africa/STORY-BRIEF-CONTRACT.md, base f0e08de). Where
 * the two differ, this file follows the server and the adapter (lib/api/storyBriefApi.ts) maps.
 *
 * STRUCTURAL GUARANTEES (CTO rulings E, E1, E2, E3, F; contract §3–§5):
 *   · The browser never decides materiality: `EvidenceRevision` is opaque; STALE means only "the
 *     evidence set changed since this Brief" (server basis EVIDENCE_SET_CHANGED) — never
 *     "something material happened".
 *   · No fabricated progress: CHECKING carries no stage and no percentage — the server exposes
 *     no progress channel in R1, so there is nowhere to put one.
 *   · No fabricated counts: STALE carries no "N newer reports" (the server supplies none).
 *   · FAILED is not INSUFFICIENT: a failure carries a failure kind and NO stored Brief.
 *   · Reopen costs zero: reads are GET only; the one compute path is the explicit run.
 *   · No client persistence: nothing here is ever written to browser storage.
 */

/* ── IDENTITY ──────────────────────────────────────────────────────────────── */

/** The canonical story id the server issues (an alias resolves to its survivor). Opaque. */
export type StoryId = string & { readonly __brand: 'StoryId' };

/** The server's evidence-set revision (sha256 over the alias set's articleRefs). Opaque. */
export type EvidenceRevision = string & { readonly __brand: 'EvidenceRevision' };

/** The only comparison the browser may make on a revision. */
export function sameRevision(a: EvidenceRevision | null, b: EvidenceRevision | null): boolean {
  return a !== null && b !== null && a === b;
}

/* ── STORED CONTENT (one immutable Brief version) ──────────────────────────── */

export const STORY_BRIEF_CONCLUSIONS = ['READY', 'PARTIAL', 'INSUFFICIENT'] as const;
export type StoryBriefConclusion = (typeof STORY_BRIEF_CONCLUSIONS)[number];

/** One sourced fact from the stored `briefing-blocks/1` keyFacts. Carried verbatim. */
export interface BriefKeyFact {
  readonly claim: string;
  readonly sourceArticleIds: readonly string[];
}

/** A reference to retained evidence — never publisher full text (contract §2). */
export interface BriefEvidenceRef {
  readonly id: string;
  readonly url: string | null;
  readonly title: string;
  readonly publisher: string;
  readonly publishedAt: string | null;
}

/** One immutable Brief version, as the server stored it. Nothing here is authored client-side. */
export interface StoredBriefContent {
  readonly version: number;
  readonly conclusion: StoryBriefConclusion;
  readonly evidenceRevision: EvidenceRevision;
  readonly asOf: string;
  readonly generatedAt: string;
  /** The validated, sourced summary, or null. Never sliced or re-summarised. */
  readonly summary: string | null;
  readonly keyFacts: readonly BriefKeyFact[];
  /** Non-sourced background, explicitly never citable. Shown only as such. */
  readonly background: string | null;
  readonly evidence: readonly BriefEvidenceRef[];
  /** Named gaps, as the server wrote them. */
  readonly coverageGaps: readonly string[];
  readonly uncertainty: readonly string[];
}

/* ── THE SEVEN PRESENTATION STATES (ruling E2) ─────────────────────────────── */

export const STORY_BRIEF_STATES = ['NONE', 'CHECKING', 'READY', 'STALE', 'PARTIAL', 'INSUFFICIENT', 'FAILED'] as const;
export type StoryBriefState = (typeof STORY_BRIEF_STATES)[number];

export const STORY_BRIEF_FAILURE_KINDS = [
  'PROVIDER_DEGRADED',
  'BUDGET_REFUSED',
  'CAPABILITY_UNAVAILABLE',
  'EXECUTION_FAILED',
  'OUTCOME_UNKNOWN',
] as const;
export type StoryBriefFailureKind = (typeof STORY_BRIEF_FAILURE_KINDS)[number];

interface ViewBase {
  readonly storyId: StoryId;
  readonly currentEvidenceRevision: EvidenceRevision;
  /** How many immutable versions exist. */
  readonly versions: number;
  /** False while no governed generator is bound — no surface may offer generation then. */
  readonly generationAvailable: boolean;
}

/** Server NOT_GENERATED: no Brief has been prepared for this story. */
export interface NoBriefView extends ViewBase {
  readonly state: 'NONE';
}

/** One deduplicated attempt is in flight. The latest version (if any) stays inspectable. */
export interface CheckingBriefView extends ViewBase {
  readonly state: 'CHECKING';
  readonly inspectable: StoredBriefContent | null;
}

/** A current Brief for the current evidence revision. */
export interface ConcludedBriefView extends ViewBase {
  readonly state: StoryBriefConclusion;
  readonly brief: StoredBriefContent;
}

/** The evidence set changed since the shown Brief. The old version stays fully inspectable. */
export interface StaleBriefView extends ViewBase {
  readonly state: 'STALE';
  readonly brief: StoredBriefContent;
  /** Set when the latest attempt to refresh failed; the stale Brief is still the one shown. */
  readonly lastAttemptFailure: StoryBriefFailureKind | null;
}

/** An attempt failed and no version exists for the current evidence. Stores NO Brief. */
export interface FailedBriefView extends ViewBase {
  readonly state: 'FAILED';
  readonly failureKind: StoryBriefFailureKind;
}

export type StoryBriefView = NoBriefView | CheckingBriefView | ConcludedBriefView | StaleBriefView | FailedBriefView;

/* ── THE ADAPTER SHAPE ─────────────────────────────────────────────────────── */

export type BriefResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      /**
       * OFF         the Story Brief capability is not served (gate off → 404)
       * UNRESOLVED  this page cannot learn the story's canonical id (see storyBriefApi.ts)
       * NO_STORY    the article is not (yet) part of any canonical story
       */
      readonly reason: 'OFF' | 'UNRESOLVED' | 'NO_STORY' | 'SIGNED_OUT' | 'NOT_FOUND' | 'RATE_LIMITED' | 'INVALID' | 'FAILED';
    };

/**
 * The CLOSED set of reasons a generation may start: the reader's explicit actions. Image, card
 * background, publisher, title, scrolling, filters, map, evidence preview, Discuss and reopening a
 * current Brief are not here, so no call site for them can name a reason.
 */
export const BRIEF_RUN_INTENTS = ['READ_BRIEF', 'STALE_REFRESH', 'EXPLICIT_RETRY'] as const;
export type BriefRunIntent = (typeof BRIEF_RUN_INTENTS)[number];
