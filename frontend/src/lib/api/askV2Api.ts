import { ASK_INPUT_TOO_LONG } from '@globalnews-ai/shared';
import type { AnalysisApiResponse, DisplayLocale, MultiStoryAction } from '@globalnews-ai/shared';
import { accountFetch } from './accountFetch';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE F — THE ASK V2 CLIENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The one client for `/ask-v2`. Contract §15: the canonical result identity is the Ask V2
 * OPERATION, read through `GET /ask-v2/operations/:id` — owner-scoped, private, display-only,
 * provider-free. There is no second result store and no client-side result cache here.
 *
 * AVAILABILITY IS A FACT THE SERVER STATES. `ASK_V2_ENABLED` is default OFF and the routes
 * then answer 404; a signed-out reader gets 401. Both are NAMED outcomes, so the caller acts
 * on what the server said rather than guessing: `UNAVAILABLE` (Ask V2 disabled) takes the
 * existing Ask — the contract's rollback path — while `SIGNED_OUT` is a sign-in requirement
 * and NEVER falls back to it (PR #66). Every mutation goes through `accountFetch` (session
 * cookie + CSRF).
 */

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 · SEVEN-LANGUAGE ASK CLIENT PIN — CTO AUTHORIZED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * It was `'en' | 'pl'`, and that single line made the FRONTEND the thing that narrowed a
 * reader's language: an `fr` request could not be EXPRESSED, so the server never learned
 * what had been asked and could not refuse, disclose or record it. The narrowing happened
 * before the request, where nothing downstream could see it.
 *
 * The server remains the authority on what it can ANSWER — `ask-v2.dto.ts:19` is still
 * `@IsIn(['en','pl'])` and this lane does not touch backend routing. THAT IS PRECISELY WHY
 * THE REQUEST MUST CARRY THE TRUTH: a server that is told `fr` can refuse it as `fr`, and a
 * frontend that pre-clamped would make that refusal unreachable and its disclosure
 * impossible. `lib/ask/askLocale.ts` names the boundary once and `askLanguageDisposition`
 * returns the gap as data so the surface discloses it to the reader.
 *
 * NOTHING ELSE IN THIS FILE CHANGES. The widening is one type; every request body, route,
 * header and outcome shape is untouched, which is what keeps the Unified Intelligence
 * Binding R2 contract intact while the language it carries stops being a lie.
 */
export type AskV2Language = DisplayLocale;
export type AskV2Intent = 'ask' | 'deep-analysis' | 'research-report';

/**
 * UNIFIED INTELLIGENCE BINDING R2B/R2C — the ONE optional context reference an Ask V2 turn may
 * carry. REFERENCES ONLY: a story by its persisted article id (or its {articleRef, url}), or a
 * governed country code. The server resolves every fact (title, source, country, display name);
 * nothing the browser holds about the story is sent as evidence. One kind per turn.
 */
export type AskV2ContextRef =
  | { readonly kind: 'STORY'; readonly articleId: string }
  | { readonly kind: 'STORY'; readonly articleRef: string; readonly url: string }
  | { readonly kind: 'GEOGRAPHY'; readonly countryCode: string }
  /* R2D — a My Intelligence selection: the action and its SelectedStoryRefs (references only). */
  | {
      readonly kind: 'SELECTION';
      readonly action: MultiStoryAction;
      readonly stories: readonly { readonly articleRef: string; readonly url: string }[];
    }
  /* R2F — a dashboard record by its module and stable key (references only, never values). */
  | {
      readonly kind: 'MODULE';
      readonly module: 'CONFLICT' | 'IMIHIGO' | 'ECONOMY' | 'MARKET';
      readonly observationKey: string;
    };

/** A server refusal of the context itself (unresolvable / unknown) — never a generic Ask. */
export function isAskContextRefusal(code: string | undefined): boolean {
  return typeof code === 'string' && code.startsWith('ASK_CONTEXT_');
}

export type AskAnswerState =
  | 'REFERENCE_BACKGROUND'
  | 'CURRENTLY_VERIFIED'
  | 'CURRENT_REPORTING'
  | 'PARTIAL'
  | 'INSUFFICIENT'
  | 'CLARIFICATION_REQUIRED'
  | 'CAPABILITY_UNAVAILABLE'
  /* ASK INTELLIGENCE BINDING LIVE ACCEPTANCE REPAIR R1 — a governed retained record (or its
     stated absence), answered with zero AI. Never current, never verified. */
  | 'RETAINED_RECORD'
  /* CURRENT-REPORTING TRUTH R1 — an AI answer from retained (not current) reporting. */
  | 'RETAINED_REPORTING'
  /* ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — a deterministic computation over the
     reader's own values: zero AI, zero sources. */
  | 'COMPUTED_RESULT';

/** ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — a computation the server owns. */
export interface AskComputation {
  readonly kind: string;
  readonly inputs: readonly {
    readonly name: string;
    readonly value: number;
    readonly unit: string;
    readonly quoted: string;
  }[];
  readonly steps: readonly {
    readonly label: string;
    readonly expression: string;
    readonly value: number;
    readonly unit: string;
  }[];
  readonly result: { readonly name: string; readonly value: number; readonly unit: string };
  readonly conventions: readonly string[];
}

export interface AskPlanChip {
  readonly kind: 'GEOGRAPHY' | 'TOPIC' | 'DOMAIN' | 'TIME' | 'SELECTION' | 'SOURCE';
  readonly value: string;
  readonly source: string;
  readonly applied: boolean;
}

export type AskPlanChips =
  | { readonly kind: 'SCOPED'; readonly chips: readonly AskPlanChip[] }
  | { readonly kind: 'NONE' }
  | { readonly kind: 'PENDING' };

/** The `ask-r2-result/1` display artifact the execution adapter stores. */
/** TRUST R1 — see AskRecentReporting component. */
export type AskCompanionTopic = 'TRAVEL' | 'ECONOMY' | 'SECURITY' | 'BUSINESS' | 'SCIENCE';
export interface AskRecentReporting {
  /** CTO P0 · Defect E — the reader's task the listed items serve; absent on older answers. */
  readonly topic?: AskCompanionTopic;
  readonly country: string;
  readonly status: 'LISTED' | 'NONE_RETAINED' | 'UNAVAILABLE';
  readonly windowDays: number;
  readonly items: readonly {
    readonly title: string;
    readonly url: string;
    readonly sourceName: string;
    readonly publishedAt: string;
  }[];
}

/**
 * ASK R3 RESEARCH ACTIVITY R1 — the backend's stored account of the search this answer followed
 * (research-record.ts, same classifier as AskObservation.retrievalOutcome). Absent on answers
 * stored before it; the reader's Search activity is derived from it, never from `analysis`.
 */
export type AskResearchOutcome =
  | 'MATCHED'
  | 'RETAINED_ONLY'
  | 'COMPLETED_NO_MATCH'
  | 'RIGHTS_WITHHELD'
  | 'ALL_FILTERED'
  | 'PARTIAL'
  | 'PARTIAL_NO_MATCH'
  | 'PROVIDER_FAILED'
  /* R1.1 — a retrieval call was made but returned no typed outcome */
  | 'OUTCOME_UNAVAILABLE';
export interface AskResearchRecord {
  readonly schema: 'ask-research/1';
  /** P0 NEWS R1 (Claude G G-ASK-4) — the reader named a publisher: its verdict (identity only). */
  readonly requestedPublisher?: {
    readonly phrase: string;
    readonly state: 'CARRIED' | 'RECOGNISED_NOT_CARRIED' | 'UNRECOGNISED';
    readonly reason: string;
    readonly displayName: string | null;
    readonly topic: string | null;
  };
  /** P0 NEWS R1 (P3) — a reviewed spelling variant was searched under its canonical name. */
  readonly entitySpellings?: readonly { readonly asked: string; readonly searched: string }[];
  /** MASTER CTO P0 RIGHTS CONTAINMENT R1 — items found but withheld: source reuse rights not cleared */
  readonly rightsWithheld?: number;
  readonly performed: boolean;
  readonly outcome: AskResearchOutcome | null;
  readonly reused: boolean;
  readonly lanes: {
    readonly attempted: readonly string[];
    readonly succeeded: readonly string[];
    readonly unavailable: readonly { readonly lane: string; readonly reason: string }[];
  };
  readonly candidatesSeen: number | null;
  readonly candidatesAdmitted: number | null;
}

export interface AskR2Payload {
  readonly schema: 'ask-r2-result/1';
  readonly route: {
    readonly questionClass: string;
    readonly terminalState: string;
    readonly scopedBy: string;
    readonly refusals: readonly string[];
    readonly disclosures: readonly string[];
    readonly clarification: readonly string[];
    readonly normalization: string;
    readonly questionLanguage: string | null;
    /** ALPHA ENABLEMENT R1 (MC-055) — the personal library asked about; selects wording only. */
    readonly personalScope?: 'SAVED_STORIES' | 'INTERESTS' | null;
  };
  readonly chips: AskPlanChips;
  readonly answer: {
    readonly state: AskAnswerState;
    readonly basis: string;
    readonly missingRoles: readonly string[];
    /** A clarification the executor asked, with its choices (ISO3 codes), e.g. COD/COG. */
    readonly candidates?: readonly string[];
  };
  /** When the server decided the answer (execution time). */
  readonly checkedAt?: string;
  readonly aiExecuted: boolean;
  readonly modelPriorCitable: false;
  readonly analysis: AnalysisApiResponse | null;
  /**
   * ASK GENERAL BACKGROUND EXECUTION R1 — plain-text model background for stable,
   * non-time-sensitive questions (`answer.state === 'REFERENCE_BACKGROUND'`). This is
   * NOT retrieved evidence, NOT a Reference source, NOT an Official source, and NOT a
   * citation — `modelPriorCitable` above stays `false` regardless. Mutually exclusive
   * with `analysis`: exactly one of the two carries body text for a given payload.
   */
  readonly background?: { readonly text: string } | null;
  /** ASK R3 RESEARCH ACTIVITY R1 — what the search actually did (absent before R1). */
  readonly research?: AskResearchRecord;
  /** TRUST R1 — retained reporting listed beside a place-background answer (listed, not analysed). */
  readonly recentReporting?: AskRecentReporting;
  /** ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — the deterministic computation. */
  readonly computation?: AskComputation;
  /**
   * CURRENT STATUS CORROBORATION R1 — present only for a current-status plan: the executor's
   * frozen verification outcome, decided by DETERMINISTIC corroboration (never a model's
   * agreement), the number of independent agreeing reports, and the as-of time of the
   * freshest of them. Absent on older payloads.
   */
  readonly verification?: {
    readonly outcome: string;
    readonly reason: string;
    readonly family: string | null;
    readonly reports: number;
    readonly asOf: string | null;
    readonly fact: { readonly family: string; readonly value: string | number } | null;
  } | null;
  /**
   * ASK INTELLIGENCE BINDING R1 — the governed structured contributions considered for this
   * answer (read-only retained stores; zero AI). Absent on older payloads, null when none
   * applied.
   */
  readonly intelligence?: {
    readonly considered: readonly string[];
    readonly contributions: readonly AskContribution[];
  } | null;
  /**
   * R2-S1 — the evidence-linked comparison table, projected by the server from the validated
   * analysis (agreements and difference positions with their sources; zero AI). Absent when
   * there is nothing to compare.
   */
  readonly comparisonTable?: AskComparisonTable;
  /**
   * CTO checkpoint 5 §5 — present when the reader's turn ("And in Kenya?") was answered as their
   * earlier question for the new place. Absent on every other payload.
   */
  /**
   * CTO P0 — present for advice / decision support: general guidance from model reasoning (never
   * current sourced research); a mixed question lists the parts that need current evidence.
   */
  readonly guidance?: {
    /* R3 — DECISION_SUPPORT (weighed against an objective) and MIXED_REFERENCE_CURRENT (a
       partial answer: the stable part answered, the current part not verified) */
    readonly kind:
      | 'ADVISORY'
      | 'MIXED_ADVISORY_CURRENT'
      | 'DECISION_SUPPORT'
      | 'MIXED_REFERENCE_CURRENT'
      /* CTO R4 — conceptual analysis / work on this conversation (plan, table…) by model reasoning */
      | 'CONCEPTUAL_ANALYSIS'
      | 'CONVERSATION_WORK';
    readonly currentEvidenceNeeded: readonly string[];
    readonly objective?: string;
    /** R3 §6 — the current part could not be verified; R4 ALPHA R-2 — or it was SOURCED */
    readonly currentPart?: 'UNAVAILABLE' | 'NO_EVIDENCE' | 'SOURCED';
    /** R4 ALPHA R-2 — a MIXED answer's explanatory part, beside a sourced current part */
    readonly stablePart?: 'ANSWERED' | 'UNAVAILABLE';
  };
  readonly continuation?: {
    readonly readerQuestion: string;
    readonly answeredAs: string;
    readonly fromQuestion: string;
    /** R3 — the place was carried (CROSS_COUNTRY) or the reader's trip / decision (JOB_CONTEXT). */
    readonly kind?: 'CROSS_COUNTRY' | 'JOB_CONTEXT';
  };
  /**
   * ASK RETRIEVAL / CONVERSATION R2 (§7) — a follow-up executed on the earlier answer ("put those in
   * a table", "revise your answer"): what that answer found (NO_FINDINGS — its search found nothing,
   * so nothing is revised) and whether its evidence was re-read or a new search ran in its scope.
   */
  readonly priorAnswer?: {
    readonly form: string;
    readonly outcome: 'FINDINGS' | 'NO_FINDINGS' | 'INCOMPLETE';
    readonly evidence: 'REUSED' | 'SEARCHED_AGAIN';
  };
  /**
   * CTO R4 — the reusable structure this answer established (a framework, diagnosis, plan…): the
   * conversation's memory for "that idea" / "which part". Model reasoning; never a source.
   */
  readonly artifact?: {
    readonly kind: string;
    readonly label: string;
    readonly components: readonly string[];
    readonly provenance: 'MODEL_REASONING';
    readonly citable: false;
  };
  /** R3 §14 — the two-sided scope of a relationship question. */
  readonly relationship?: {
    readonly countries: readonly string[];
    readonly relations: readonly string[];
    readonly domain: string;
    readonly corridor: string | null;
  };
}

/** R2-S1 — one row per validated agreement / difference position, with its source ids. */
export interface AskComparisonTable {
  readonly schema: 'ask-comparison-table/1';
  readonly rows: readonly {
    readonly kind: 'AGREEMENT' | 'DIFFERENCE';
    readonly topic: string | null;
    readonly statement: string;
    readonly sourceArticleIds: readonly string[];
  }[];
  readonly omittedRows: number;
}

/** ASK INTELLIGENCE BINDING R1 — one governed observation, with its provenance. */
export interface AskContributionObservation {
  readonly reference: string;
  readonly kind: string;
  readonly label: string | null;
  readonly value: string | null;
  readonly unit: string | null;
  readonly period: string;
  readonly geography: string;
  readonly source: {
    readonly name: string;
    readonly url: string | null;
    readonly licence: string | null;
  };
  readonly retainedAt: string | null;
  /** LIVE ACCEPTANCE REPAIR R1 — source-verbatim display fields (Conflict records). */
  readonly detail?: {
    readonly place: string | null;
    readonly parties: readonly string[];
    readonly headline: string | null;
    readonly citedOutlets: readonly string[];
  };
}

export interface AskContribution {
  readonly contributorId: string;
  readonly domain: string;
  readonly status: 'USED' | 'NO_MATCH' | 'NO_DATA' | 'NOT_ASSESSED' | 'DEGRADED' | 'REFUSED';
  readonly applicability: 'REQUIRED' | 'SUPPLEMENTARY' | 'CONTEXT';
  readonly observations: readonly AskContributionObservation[];
  readonly temporalBasis: string;
  readonly geographyBasis: string | null;
  readonly disclosures: readonly string[];
  readonly degradationReason: string | null;
}

export interface AskV2Operation {
  readonly operationId: string;
  /**
   * STANDALONE PUBLIC BETA CONVERGENCE R1 — the reader's own turn for this operation, and
   * whether THEY saved it. Owner-scoped server-side; absent on older responses.
   */
  readonly turnId?: string | null;
  readonly bookmarked?: boolean;
  /**
   * ALPHA VISUAL ACCEPTANCE REPAIR R1 — the owning turn's canonical facts (owner-scoped
   * server-side): the question a reopened result answered, and the thread + sequence an
   * explicit follow-up continues. Absent on older responses.
   */
  readonly question?: string | null;
  readonly threadId?: string | null;
  readonly sequence?: number | null;
  readonly language?: AskV2Language | null;
  readonly computeClass: string;
  readonly status: string;
  readonly quotedSand: number;
  readonly chargingEnabled: boolean;
  readonly requiresAcceptance: boolean;
  readonly quoteExpiresAt: string;
  readonly acceptedAt: string | null;
  readonly storedResultId: string | null;
  readonly storedResultReused: boolean;
  readonly failureCode: string | null;
  readonly result: {
    readonly id: string;
    readonly payload: unknown;
    readonly evidenceRevision: string;
    readonly expiresAt: string;
    readonly expired: boolean;
    readonly displayOnly: true;
  } | null;
}

export interface AskV2Thread {
  readonly id: string;
  readonly language: AskV2Language;
  readonly returnPath: string | null;
}

/**
 * PUBLIC BETA ASK CONTINUITY R1 — one Recent row, entirely stored facts.
 *
 * `firstQuestion` is the reader's OWN first question, clamped server-side at a
 * fixed length with `firstQuestionTruncated` saying whether anything was removed.
 * NO TITLE IS GENERATED — a generated title would be a model call on a surface
 * whose contract is that opening it spends nothing.
 *
 * `latestState` is the newest operation's lifecycle status and nothing more. It
 * does NOT promise the artifact is still readable: expiry is resolved on reopen,
 * by `operation()`, which is the only read that can tell the truth about it.
 */
export interface AskV2RecentThread {
  readonly id: string;
  readonly language: AskV2Language;
  readonly returnPath: string | null;
  readonly createdAt: string;
  readonly lastActiveAt: string;
  readonly turnCount: number;
  readonly firstQuestion: string | null;
  readonly firstQuestionTruncated: boolean;
  /** ALPHA VISUAL ACCEPTANCE REPAIR R1 (D) — the question of the turn Open displays. */
  readonly latestQuestion?: string | null;
  readonly latestQuestionTruncated?: boolean;
  readonly latestTurnId: string | null;
  readonly latestOperationId: string | null;
  readonly latestState: string | null;
  readonly latestComputeClass: string | null;
}

/** PUBLIC BETA ASK CONTINUITY R1 — a bookmark is a link to a turn, never a copy of it. */
export interface AskV2Bookmark {
  readonly id: string;
  readonly turnId: string;
  readonly savedAt: string;
  readonly threadId: string;
  readonly sequence: number;
  readonly language: AskV2Language;
  readonly question: string;
  readonly questionTruncated: boolean;
  readonly operationId: string | null;
  readonly state: string | null;
  readonly computeClass: string | null;
}

/* ════ R2 · D1 — DURABLE BRIEFINGS (backend ask-v2/briefings; ASK_BRIEFINGS_ENABLED) ════ */
export interface AskV2BriefingScope {
  readonly kind: string;
  readonly question?: string;
  readonly language?: string;
  readonly countryCode?: string;
  readonly storyId?: string;
}
export interface AskV2BriefingSummary {
  readonly id: string;
  readonly title: string;
  readonly scope: AskV2BriefingScope;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly latestVersion: number | null;
  readonly latestAsOf: string | null;
  /** REASON TO RETURN R1 — absent from a backend that predates followed-question checks. */
  readonly latestCheck?: AskV2FollowedCheckSummary | null;
  readonly lastSuccessfulCheckAt?: string | null;
}

/* ════ REASON TO RETURN R1 · §8 — followed-question checks (backend followed-change.ts) ════ */
export type AskV2FollowedOutcome =
  | 'INCOMPLETE_CHECK'
  | 'INSUFFICIENT_BASELINE'
  | 'CORRECTION'
  | 'MATERIAL_CHANGE'
  | 'NEW_EVIDENCE'
  | 'UNCHANGED'
  | 'NO_RELEVANT_UPDATE';
export interface AskV2FollowedCheckSummary {
  readonly outcome: AskV2FollowedOutcome;
  readonly checkedAt: string;
  readonly resultingVersion: number | null;
  readonly newEvidenceCount: number;
  readonly possibleCorrectionCount: number;
  readonly supportedChangeCount: number;
  /** CTO R1-B §3 — governed specialist records new / late-admitted / content-changed; absent on older rows. */
  readonly structuredChangeCount?: number;
  readonly structuredUnassessed?: readonly string[];
  readonly partial: boolean;
}
/** CTO R1-B §3 — one governed specialist record that changed (source-stated fields only). */
export interface AskV2StructuredRecordChange {
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
export interface AskV2ChangedEvidence {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly publisher: string;
  readonly publishedAt: string | null;
}
export interface AskV2FollowedAssessment {
  readonly schema: 'followed-assessment/1' | 'followed-assessment/2';
  readonly outcome: AskV2FollowedOutcome;
  readonly reasons: readonly string[];
  readonly baselineVersion: number | null;
  readonly baselineAsOf: string | null;
  readonly checkedAsOf: string | null;
  readonly newEvidence: readonly AskV2ChangedEvidence[];
  readonly earlierReportingFoundNow: readonly AskV2ChangedEvidence[];
  readonly possibleCorrections: readonly AskV2ChangedEvidence[];
  readonly supportedChanges: readonly {
    readonly claim: string;
    readonly sourceArticleIds: readonly string[];
  }[];
  readonly carriedOverCount: number;
  readonly notSeenThisCheckCount: number;
  readonly unassessedSources: readonly string[];
  /** Absent on /1 assessments (recorded before structured comparison existed). */
  readonly structured?: {
    readonly applicable: boolean;
    readonly newEvents: readonly AskV2StructuredRecordChange[];
    readonly lateAdmitted: readonly AskV2StructuredRecordChange[];
    readonly contentChanged: readonly AskV2StructuredRecordChange[];
    readonly carriedOverCount: number;
    readonly notSeenThisCheckCount: number;
    readonly notPreviouslyShownCount: number;
    readonly unassessed: readonly string[];
    readonly compared: readonly string[];
  };
  readonly expiredNotices: 'NOT_ASSESSED';
}
export interface AskV2FollowedCheck {
  readonly id: string;
  readonly turnId: string;
  readonly outcome: AskV2FollowedOutcome;
  readonly assessment: AskV2FollowedAssessment;
  readonly baselineVersion: number | null;
  readonly resultingVersion: number | null;
  readonly checkedAt: string;
  readonly aiExecuted: false;
}
export interface AskV2BriefingUpdate {
  readonly kind: 'STORY_MATERIAL_UPDATE';
  readonly available: boolean;
  readonly recordedBriefVersion?: number;
  readonly currentBriefVersion?: number;
  readonly updatedAt?: string | null;
  readonly storyGone?: boolean;
}
export interface AskV2BriefingDetail {
  readonly id: string;
  readonly title: string;
  readonly scope: AskV2BriefingScope;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly versions: readonly {
    readonly version: number;
    readonly asOf: string;
    readonly windowFrom: string | null;
    readonly windowTo: string | null;
    readonly createdAt: string;
  }[];
  readonly update: AskV2BriefingUpdate | null;
  /** REASON TO RETURN R1 — newest first; absent from an older backend. */
  readonly checks?: readonly AskV2FollowedCheck[];
}
export interface AskV2BriefingEvidenceRef {
  readonly id: string;
  readonly host: string | null;
  readonly url: string;
  readonly title: string;
  readonly publisher: string;
  readonly publishedAt: string | null;
}
export interface AskV2BriefingVersion {
  readonly briefingId: string;
  readonly title: string;
  readonly version: number;
  readonly asOf: string;
  readonly windowFrom: string | null;
  readonly windowTo: string | null;
  readonly blocks: {
    readonly schema: string;
    readonly answerState: string | null;
    readonly summary: string | null;
    readonly keyFacts: readonly {
      readonly claim: string;
      readonly sourceArticleIds: readonly string[];
    }[];
    readonly comparisonTable: AskComparisonTable | null;
    readonly background: { readonly text: string; readonly citable: false } | null;
    /** The governed specialist basis the answer used (payload.intelligence), as stored; absent on old versions. */
    readonly intelligence?: AskR2Payload['intelligence'] | null;
  };
  readonly evidenceRefs: readonly AskV2BriefingEvidenceRef[];
  readonly evidenceRevision: string;
  readonly coverageGaps: readonly string[];
  readonly createdAt: string;
  readonly supersededBy: number | null;
  readonly aiExecuted: false;
}

export interface AskV2BookmarkWrite {
  readonly turnId: string;
  readonly bookmarked: boolean;
}

export type AskV2Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      /* ASK R2 — the documented input limit is its own reason (shared ASK_INPUT_TOO_LONG). */
      /* CTO P0 ALPHA PROXY TIMEOUT R1 — UNCONFIRMED: the submission may have run; it was not proven either way. */
      readonly reason:
        | 'UNAVAILABLE'
        | 'SIGNED_OUT'
        | 'REFUSED'
        | 'NETWORK'
        | 'UNCONFIRMED'
        | typeof ASK_INPUT_TOO_LONG;
      readonly status?: number;
      /** ASK GUEST TRIAL R3 — the server's typed refusal code, when it gave one. */
      readonly code?: string;
      readonly retryAfterS?: number;
    };

/* ════════════════════════════════════════════════════════════════════════════
   ASK GUEST TRIAL R3 — the first-visit guest surface (`/ask-v2/guest/*`).
   ════════════════════════════════════════════════════════════════════════════ */

/** What the composer shows. Server-authoritative; the client only mirrors it. */
export interface AskGuestStatus {
  readonly signedIn: boolean;
  readonly available: boolean;
  readonly session?: { readonly expiresAt: string } | null;
  readonly allowance?: number;
  readonly remaining?: number;
  readonly committed?: number;
  readonly reserved?: number;
  readonly state?: 'OPEN' | 'EXHAUSTED' | 'COOLDOWN' | 'ATTEMPTS_EXHAUSTED';
  readonly cooldownUntil?: string | null;
}

export interface AskGuestThreadSummary {
  readonly id: string;
  readonly language: AskV2Language;
  readonly createdAt: string;
  readonly lastActiveAt: string;
  readonly firstQuestion: string | null;
}

export interface AskV2ThreadHistory {
  readonly id: string;
  readonly language: AskV2Language;
  readonly turns: readonly {
    readonly id: string;
    readonly sequence: number;
    readonly question: string;
    readonly operationId: string;
  }[];
}

/** The non-simple header the FIRST guest submission carries (no guest session exists yet). */
const GUEST_FIRST_WRITE = { 'X-Requested-With': 'globalnews-ask' } as const;

/**
 * PUBLIC BETA ASK CONTINUITY R1 — the reads whose 404 means "Ask V2 is off".
 *
 * A 404 is AMBIGUOUS on this API and the ambiguity matters: on a collection route
 * it can only mean the guard refused the whole surface, but on
 * `/ask-v2/operations/:id` it means the operation is missing OR not the caller's —
 * the deliberate owner-404. Mapping that to UNAVAILABLE would tell a reader the
 * feature is off when in fact their own id was wrong, and would send the caller
 * down the rollback path for a per-row problem. So the mapping stays an explicit
 * allow-list of collection paths rather than a rule about the status code.
 */
const UNAVAILABLE_ON_404: readonly string[] = ['/ask-v2/threads', '/ask-v2/bookmarks'];
/* ASK GUEST TRIAL R3 — the guest COLLECTION routes: a 404 there is the disabled surface too. */
const GUEST_UNAVAILABLE_ON_404: readonly string[] = [
  '/ask-v2/guest/status',
  '/ask-v2/guest/threads',
];

async function call<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
  headers?: Readonly<Record<string, string>>,
): Promise<AskV2Outcome<T>> {
  let response: Response;
  try {
    response = await accountFetch(
      path,
      body === undefined ? { method, headers } : { method, body, headers },
    );
  } catch {
    return { ok: false, reason: 'NETWORK' };
  }
  /* a search (`?q=`) on a collection is still that collection */
  const collection = path.split('?')[0];
  if (response.status === 404 && method === 'GET' && UNAVAILABLE_ON_404.includes(collection))
    return { ok: false, reason: 'UNAVAILABLE', status: 404 };
  if (response.status === 404 && UNAVAILABLE_ON_404.includes(path))
    return { ok: false, reason: 'UNAVAILABLE', status: 404 };
  if (response.status === 404 && GUEST_UNAVAILABLE_ON_404.includes(path))
    return { ok: false, reason: 'UNAVAILABLE', status: 404 };
  if (response.status === 404 && method === 'POST' && path.startsWith('/ask-v2/threads')) {
    return { ok: false, reason: 'UNAVAILABLE', status: 404 };
  }
  if (response.status === 401) return { ok: false, reason: 'SIGNED_OUT', status: 401 };
  if (!response.ok) {
    /* ASK GUEST TRIAL R3 — a typed refusal (`code`) is kept; anything else stays generic. */
    let code: string | undefined;
    let retryAfterS: number | undefined;
    try {
      const refusal = (await response.json()) as { code?: unknown; retryAfterS?: unknown };
      if (typeof refusal?.code === 'string' && /^[A-Z_]{3,60}$/.test(refusal.code))
        code = refusal.code;
      if (typeof refusal?.retryAfterS === 'number') retryAfterS = refusal.retryAfterS;
    } catch {
      /* no body */
    }
    return {
      ok: false,
      reason: 'REFUSED',
      status: response.status,
      ...(code === undefined ? {} : { code }),
      ...(retryAfterS === undefined ? {} : { retryAfterS }),
    };
  }
  try {
    return { ok: true, value: (await response.json()) as T };
  } catch {
    return { ok: false, reason: 'REFUSED', status: response.status };
  }
}

/** Opaque, unique per user action — the server's idempotency key. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/*
  ════════════════════════════════════════════════════════════════════════════
  CTO P0 ALPHA PROXY TIMEOUT R1 — A LOST RESPONSE IS NOT "NOTHING RAN"
  ════════════════════════════════════════════════════════════════════════════

  Live Alpha db95d4e: the first-party proxy closed an Ask turn at ~30 s and answered 500 while the
  backend went on to complete it (201, aiExecuted=true). The reader was told "Nothing was run" —
  untrue. Once a submission has been DISPATCHED, a dropped connection or a generic gateway/server
  failure (500/502/503/504 with no typed code) establishes nothing about whether it ran.

  So an ambiguous outcome is RECOVERED, never asserted:
    1. the SAME idempotency key is replayed. The server answers a replay with the operation that
       key already created — no planner, no slot, no meter, no second execution (proven on
       PostgreSQL in ask-v2.lost-response-replay.postgres.spec) — or, if the first request never
       arrived, runs this ONE submission once;
    2. while that operation is still running, the reader's own owner-scoped operation read is
       polled until it settles;
    3. if nothing can be confirmed in the bounded window, the outcome is UNCONFIRMED ("may have
       run"), and the key is KEPT for this exact submission: the reader's next Send of the same
       question in the same thread reuses it, so a manual retry can never run the work twice.

  A genuine pre-dispatch failure — the browser reports itself offline before anything is sent —
  stays NETWORK: nothing was sent, so "nothing was run" is then true. Typed refusals (4xx, a 5xx
  with a code) are definitive and returned unchanged. The key lives in this module's memory only
  (never browser storage), for 15 minutes.
*/
const AMBIGUOUS_STATUSES: ReadonlySet<number> = new Set([500, 502, 503, 504]);
/** The operation statuses that are still on their way to an answer. */
const SETTLING: ReadonlySet<string> = new Set(['QUOTED', 'ACCEPTED', 'RESERVED', 'RUNNING']);
export const SUBMIT_RECOVERY = {
  /** Waits before each same-key replay (ms). */
  replayDelaysMs: [1_000, 2_000, 4_000, 8_000] as readonly number[],
  pollIntervalMs: 3_000,
  /** The backend's RUNNING lease is 300 s; recovery never waits longer than that plus a margin. */
  settleDeadlineMs: 330_000,
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
};
const UNCONFIRMED_KEY_TTL_MS = 15 * 60_000;
const unconfirmedKeys = new Map<string, { readonly key: string; readonly at: number }>();

/** True when a POST's outcome says nothing about whether the server ran it. */
export function isAmbiguousSubmitFailure(outcome: AskV2Outcome<unknown>): boolean {
  if (outcome.ok) return false;
  if (outcome.reason === 'NETWORK') return true;
  return (
    outcome.reason === 'REFUSED' &&
    outcome.code === undefined &&
    outcome.status !== undefined &&
    AMBIGUOUS_STATUSES.has(outcome.status)
  );
}

function submissionIdentity(path: string, body: Readonly<Record<string, unknown>>): string {
  return JSON.stringify([path, body.question, body.language, body.intent, body.context ?? null]);
}

/** The key an earlier UNCONFIRMED submission of exactly this question left behind, if any. */
function keptKeyFor(identity: string): string | null {
  const kept = unconfirmedKeys.get(identity);
  if (kept === undefined) return null;
  if (SUBMIT_RECOVERY.now() - kept.at > UNCONFIRMED_KEY_TTL_MS) {
    unconfirmedKeys.delete(identity);
    return null;
  }
  return kept.key;
}

/** Test seam: forget every kept key. */
export function forgetUnconfirmedSubmissions(): void {
  unconfirmedKeys.clear();
}

function browserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * One logical submission: ONE key, recovered on an ambiguous outcome (see above). `read` is the
 * reader's own operation read (account or guest surface, matching the submission).
 */
async function submitRecovering(
  path: string,
  body: Readonly<Record<string, unknown>> & { readonly idempotencyKey: string },
  headers: Readonly<Record<string, string>> | undefined,
  read: (operationId: string) => Promise<AskV2Outcome<AskV2Operation>>,
): Promise<AskV2Outcome<AskV2Operation>> {
  const identity = submissionIdentity(path, body);
  const kept = keptKeyFor(identity);
  const key = kept ?? body.idempotencyKey;
  const payload = { ...body, idempotencyKey: key };
  /* genuine pre-dispatch failure: nothing is sent now, so nothing ran — unless an earlier attempt
     of this same submission is still unconfirmed, which an offline browser cannot settle */
  if (browserOffline()) return { ok: false, reason: kept === null ? 'NETWORK' : 'UNCONFIRMED' };
  const send = () => call<AskV2Operation>(path, 'POST', payload, headers).then(namedInputRefusal);
  const started = SUBMIT_RECOVERY.now();

  const unconfirmed = (status?: number): AskV2Outcome<AskV2Operation> => {
    unconfirmedKeys.set(identity, { key, at: SUBMIT_RECOVERY.now() });
    return { ok: false, reason: 'UNCONFIRMED', ...(status === undefined ? {} : { status }) };
  };
  const settled = (outcome: AskV2Outcome<AskV2Operation>): AskV2Outcome<AskV2Operation> => {
    unconfirmedKeys.delete(identity);
    return outcome;
  };
  /* a replay may find the operation still running: follow it through the owner-scoped read */
  const follow = async (operation: AskV2Operation): Promise<AskV2Outcome<AskV2Operation>> => {
    let current = operation;
    while (SETTLING.has(current.status) && !current.requiresAcceptance) {
      if (SUBMIT_RECOVERY.now() - started >= SUBMIT_RECOVERY.settleDeadlineMs) return unconfirmed();
      await SUBMIT_RECOVERY.sleep(SUBMIT_RECOVERY.pollIntervalMs);
      const next = await read(current.operationId);
      if (next.ok) current = next.value;
      else if (!isAmbiguousSubmitFailure(next)) return unconfirmed(next.status);
    }
    return settled({ ok: true, value: current });
  };

  let outcome = await send();
  if (!isAmbiguousSubmitFailure(outcome)) {
    if (!outcome.ok) return settled(outcome);
    return SETTLING.has(outcome.value.status) && !outcome.value.requiresAcceptance
      ? follow(outcome.value)
      : settled(outcome);
  }
  for (const delay of SUBMIT_RECOVERY.replayDelaysMs) {
    await SUBMIT_RECOVERY.sleep(delay);
    outcome = await send();
    if (outcome.ok) return follow(outcome.value);
    if (!isAmbiguousSubmitFailure(outcome)) return settled(outcome);
  }
  return unconfirmed(outcome.ok ? undefined : outcome.status);
}

/**
 * The accepted deep run (`execute`) is the other long POST behind the same proxy. The server's
 * claim is durable and its execute is idempotent — a RUNNING or settled operation is returned,
 * never dispatched again — so an ambiguous outcome replays the execute and follows the
 * operation read until it settles; unprovable within the bounded window → UNCONFIRMED.
 */
async function executeRecovering(
  id: string,
  read: (operationId: string) => Promise<AskV2Outcome<AskV2Operation>>,
): Promise<AskV2Outcome<AskV2Operation>> {
  const send = () => call<AskV2Operation>(`/ask-v2/operations/${encodeURIComponent(id)}/execute`, 'POST');
  const started = SUBMIT_RECOVERY.now();
  let outcome = await send();
  for (const delay of SUBMIT_RECOVERY.replayDelaysMs) {
    if (!isAmbiguousSubmitFailure(outcome)) break;
    await SUBMIT_RECOVERY.sleep(delay);
    outcome = await send();
  }
  if (!outcome.ok)
    return isAmbiguousSubmitFailure(outcome)
      ? { ok: false, reason: 'UNCONFIRMED', ...(outcome.status === undefined ? {} : { status: outcome.status }) }
      : outcome;
  let current = outcome.value;
  while (current.status === 'RUNNING' || current.status === 'RESERVED') {
    if (SUBMIT_RECOVERY.now() - started >= SUBMIT_RECOVERY.settleDeadlineMs)
      return { ok: false, reason: 'UNCONFIRMED' };
    await SUBMIT_RECOVERY.sleep(SUBMIT_RECOVERY.pollIntervalMs);
    const next = await read(id);
    if (next.ok) current = next.value;
    else if (!isAmbiguousSubmitFailure(next)) return { ok: false, reason: 'UNCONFIRMED' };
  }
  return { ok: true, value: current };
}

export const askV2Api = {
  createThread(language: AskV2Language, returnPath: string | null, key = newIdempotencyKey()) {
    return call<AskV2Thread>('/ask-v2/threads', 'POST', {
      idempotencyKey: key,
      language,
      ...(returnPath === null ? {} : { returnPath }),
    });
  },
  /** One conversational submission. Deep/report work stops at a quote (requiresAcceptance). */
  submit(
    threadId: string,
    question: string,
    language: AskV2Language,
    intent: AskV2Intent,
    key = newIdempotencyKey(),
    context?: AskV2ContextRef,
  ) {
    /* CTO P0 — one key per logical submission; an ambiguous outcome is recovered, never "nothing ran" */
    return submitRecovering(
      `/ask-v2/threads/${encodeURIComponent(threadId)}/turns`,
      {
        idempotencyKey: key,
        question,
        language,
        intent,
        ...(context === undefined ? {} : { context }),
      },
      undefined,
      (id) => askV2Api.operation(id),
    );
  },
  /**
   * PUBLIC BETA ASK CONTINUITY R1 — Recent. A read: 0 AI · 0 provider · 0 Sand.
   * Signed out is `SIGNED_OUT` and Ask V2 off is `UNAVAILABLE`; neither is an
   * empty list, because an empty list would say "you have no conversations".
   */
  threads(search?: string) {
    const q = search?.trim() ?? '';
    return call<readonly AskV2RecentThread[]>(
      q === '' ? '/ask-v2/threads' : `/ask-v2/threads?q=${encodeURIComponent(q.slice(0, 200))}`,
      'GET',
    );
  },
  /** REASON TO RETURN R1 · G7 — delete one of the reader's own conversations (CSRF). */
  deleteThread(threadId: string) {
    return call<{ readonly id: string; readonly removed: boolean }>(
      `/ask-v2/threads/${encodeURIComponent(threadId)}`,
      'DELETE',
    );
  },
  /** Saved -> Questions. A read of the bookmark relation joined to its turns. */
  bookmarks() {
    return call<readonly AskV2Bookmark[]>('/ask-v2/bookmarks', 'GET');
  },
  /** Idempotent: bookmarking twice is bookmarking once. Goes through CSRF. */
  bookmark(turnId: string) {
    return call<AskV2BookmarkWrite>('/ask-v2/bookmarks', 'POST', { turnId });
  },
  /** Idempotent, and scoped to the caller, so it reveals nothing about others. */
  unbookmark(turnId: string) {
    return call<AskV2BookmarkWrite>(`/ask-v2/bookmarks/${encodeURIComponent(turnId)}`, 'DELETE');
  },
  /** R2 · D1 — the reader's briefings. Reads are database reads: 0 AI · 0 provider. */
  briefings() {
    return call<readonly AskV2BriefingSummary[]>('/ask-v2/briefings', 'GET');
  },
  createBriefing(turnId: string, title?: string) {
    return call<{ readonly id: string; readonly title: string; readonly version: number }>(
      '/ask-v2/briefings',
      'POST',
      title === undefined ? { turnId } : { turnId, title },
    );
  },
  addBriefingVersion(briefingId: string, turnId: string) {
    return call<{ readonly briefingId: string; readonly version: number }>(
      `/ask-v2/briefings/${encodeURIComponent(briefingId)}/versions`,
      'POST',
      { turnId },
    );
  },
  briefing(id: string) {
    return call<AskV2BriefingDetail>(`/ask-v2/briefings/${encodeURIComponent(id)}`, 'GET');
  },
  briefingVersion(id: string, version: number) {
    return call<AskV2BriefingVersion>(
      `/ask-v2/briefings/${encodeURIComponent(id)}/versions/${encodeURIComponent(String(version))}`,
      'GET',
    );
  },
  /** REASON TO RETURN R1 · §8 — record a manual check: the turn already ran; 0 AI here. */
  recordFollowedCheck(briefingId: string, turnId: string) {
    return call<AskV2FollowedCheck>(
      `/ask-v2/briefings/${encodeURIComponent(briefingId)}/checks`,
      'POST',
      { turnId },
    );
  },
  /** REASON TO RETURN R1 · G8 — rename, pause/resume, or edit the followed question. */
  updateBriefing(
    id: string,
    change: { readonly title?: string; readonly status?: 'ACTIVE' | 'PAUSED'; readonly question?: string },
  ) {
    return call<{ readonly id: string; readonly title: string; readonly status: string }>(
      `/ask-v2/briefings/${encodeURIComponent(id)}`,
      'PATCH',
      change,
    );
  },
  deleteBriefing(id: string) {
    return call<{ readonly id: string; readonly removed: boolean }>(
      `/ask-v2/briefings/${encodeURIComponent(id)}`,
      'DELETE',
    );
  },
  /** Display-only read of an existing result: 0 AI · 0 provider · no compute (§15). */
  operation(id: string) {
    return call<AskV2Operation>(`/ask-v2/operations/${encodeURIComponent(id)}`, 'GET');
  },
  accept(id: string) {
    return call<AskV2Operation>(`/ask-v2/operations/${encodeURIComponent(id)}/accept`, 'POST');
  },
  reserve(id: string) {
    return call<AskV2Operation>(`/ask-v2/operations/${encodeURIComponent(id)}/reserve`, 'POST');
  },
  /** CTO P0 — an ambiguous outcome of the accepted run is recovered, never "nothing ran". */
  execute(id: string) {
    return executeRecovering(id, (operationId) => askV2Api.operation(operationId));
  },
  release(id: string) {
    return call<AskV2Operation>(`/ask-v2/operations/${encodeURIComponent(id)}/release`, 'POST');
  },
  /** The account's own thread history (turns + operation ids). A read. */
  thread(id: string) {
    return call<AskV2ThreadHistory>(`/ask-v2/threads/${encodeURIComponent(id)}`, 'GET');
  },
  /** ASK GUEST TRIAL R3 — after sign-in: the conversation this account just continued. */
  continuation() {
    return call<{ readonly threadId: string | null }>('/ask-v2/continuation', 'GET');
  },

  /* ── ASK GUEST TRIAL R3 — the guest surface ─────────────────────────── */
  guestStatus() {
    return call<AskGuestStatus>('/ask-v2/guest/status', 'GET');
  },
  guestCreateThread(language: AskV2Language, returnPath: string | null, key = newIdempotencyKey()) {
    return call<AskV2Thread>(
      '/ask-v2/guest/threads',
      'POST',
      { idempotencyKey: key, language, ...(returnPath === null ? {} : { returnPath }) },
      GUEST_FIRST_WRITE,
    );
  },
  guestSubmit(
    threadId: string,
    question: string,
    language: AskV2Language,
    key = newIdempotencyKey(),
    context?: AskV2ContextRef,
  ) {
    /* CTO P0 — the same recovery, through the guest's own operation read */
    return submitRecovering(
      `/ask-v2/guest/threads/${encodeURIComponent(threadId)}/turns`,
      {
        idempotencyKey: key,
        question,
        language,
        intent: 'ask',
        ...(context === undefined ? {} : { context }),
      },
      GUEST_FIRST_WRITE,
      (id) => askV2Api.guestOperation(id),
    );
  },
  guestThreads() {
    return call<readonly AskGuestThreadSummary[]>('/ask-v2/guest/threads', 'GET');
  },
  guestThread(id: string) {
    return call<AskV2ThreadHistory>(`/ask-v2/guest/threads/${encodeURIComponent(id)}`, 'GET');
  },
  guestOperation(id: string) {
    return call<AskV2Operation>(`/ask-v2/guest/operations/${encodeURIComponent(id)}`, 'GET');
  },
  /** Bind THIS guest's own thread to its next sign-in. Nothing identifying is returned. */
  guestClaim(threadId: string) {
    return call<{ readonly claimed: boolean }>(
      '/ask-v2/guest/claim',
      'POST',
      { threadId },
      GUEST_FIRST_WRITE,
    );
  },
};

/** Narrow an operation's stored payload to the R2 artifact, or null. Never throws. */
export function askR2PayloadOf(operation: AskV2Operation | null | undefined): AskR2Payload | null {
  const p = operation?.result?.payload as Partial<AskR2Payload> | undefined;
  return p !== undefined &&
    p !== null &&
    p.schema === 'ask-r2-result/1' &&
    typeof p.answer?.state === 'string'
    ? (p as AskR2Payload)
    : null;
}

/**
 * ASK RETRIEVAL / CONVERSATION R2 — the server's typed length refusal (ASK_INPUT_TOO_LONG) becomes
 * the outcome's REASON, so the conversation records it as the turn's failure and the turn names
 * the documented limit instead of "Ask is unavailable". Every other outcome is returned unchanged.
 */
export function namedInputRefusal<T>(outcome: AskV2Outcome<T>): AskV2Outcome<T> {
  return !outcome.ok && outcome.code === ASK_INPUT_TOO_LONG
    ? { ...outcome, reason: ASK_INPUT_TOO_LONG }
    : outcome;
}
