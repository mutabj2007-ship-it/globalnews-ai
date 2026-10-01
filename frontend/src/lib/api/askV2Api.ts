import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { accountFetch } from './accountFetch';
import type { AskContextRefWire } from '@/lib/ask/askContextRef';

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

export type AskV2Language = 'en' | 'pl';
export type AskV2Intent = 'ask' | 'deep-analysis' | 'research-report';

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
  /**
   * HOME R1 STAGE A — what the SERVER made of the context references this turn was sent with
   * (Inspect). Present only when some were sent; resolution is never client-decided.
   */
  readonly context?: AskV2OperationContext;
  readonly result: {
    readonly id: string;
    readonly payload: unknown;
    readonly evidenceRevision: string;
    readonly expiresAt: string;
    readonly expired: boolean;
    readonly displayOnly: true;
  } | null;
}

/** HOME R1 STAGE A — one server-resolved context reference. `label` is server-sourced. */
export interface AskV2ContextRef {
  readonly kind: 'story' | 'country';
  readonly ref: string;
  readonly status: 'available' | 'unavailable' | 'excluded';
  readonly reason?: string;
  readonly label?: string;
}

export interface AskV2OperationContext {
  readonly entry: string;
  readonly scope: 'story' | 'selection' | 'geography' | 'none';
  readonly refs: readonly AskV2ContextRef[];
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

export interface AskV2BookmarkWrite {
  readonly turnId: string;
  readonly bookmarked: boolean;
}

export type AskV2Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly reason: 'UNAVAILABLE' | 'SIGNED_OUT' | 'REFUSED' | 'NETWORK';
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
  method: 'GET' | 'POST' | 'DELETE',
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
    /* HOME R1 STAGE A — governed references only; absent ⇒ the body is exactly as before. */
    context?: AskContextRefWire,
  ) {
    return call<AskV2Operation>(`/ask-v2/threads/${encodeURIComponent(threadId)}/turns`, 'POST', {
      idempotencyKey: key,
      question,
      language,
      intent,
      ...(context === undefined ? {} : { context }),
    });
  },
  /**
   * PUBLIC BETA ASK CONTINUITY R1 — Recent. A read: 0 AI · 0 provider · 0 Sand.
   * Signed out is `SIGNED_OUT` and Ask V2 off is `UNAVAILABLE`; neither is an
   * empty list, because an empty list would say "you have no conversations".
   */
  threads() {
    return call<readonly AskV2RecentThread[]>('/ask-v2/threads', 'GET');
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
  execute(id: string) {
    return call<AskV2Operation>(`/ask-v2/operations/${encodeURIComponent(id)}/execute`, 'POST');
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
    /* HOME R1 STAGE A — governed references only; absent ⇒ the body is exactly as before. */
    context?: AskContextRefWire,
  ) {
    return call<AskV2Operation>(
      `/ask-v2/guest/threads/${encodeURIComponent(threadId)}/turns`,
      'POST',
      {
        idempotencyKey: key,
        question,
        language,
        intent: 'ask',
        ...(context === undefined ? {} : { context }),
      },
      GUEST_FIRST_WRITE,
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
