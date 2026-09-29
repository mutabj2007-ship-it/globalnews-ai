import type { AnalysisApiResponse } from '@globalnews-ai/shared';
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
 * then answer 404; a signed-out reader gets 401. Both are NAMED outcomes (`UNAVAILABLE`,
 * `SIGNED_OUT`), so the caller falls back to the existing Ask — the contract's rollback path —
 * rather than guessing. Every mutation goes through `accountFetch` (session cookie + CSRF).
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
  | 'CAPABILITY_UNAVAILABLE';

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
}

export interface AskV2Operation {
  readonly operationId: string;
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
    };

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

async function call<T>(
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown,
): Promise<AskV2Outcome<T>> {
  let response: Response;
  try {
    response = await accountFetch(path, body === undefined ? { method } : { method, body });
  } catch {
    return { ok: false, reason: 'NETWORK' };
  }
  if (response.status === 404 && UNAVAILABLE_ON_404.includes(path))
    return { ok: false, reason: 'UNAVAILABLE', status: 404 };
  if (response.status === 404 && method === 'POST' && path.startsWith('/ask-v2/threads')) {
    return { ok: false, reason: 'UNAVAILABLE', status: 404 };
  }
  if (response.status === 401) return { ok: false, reason: 'SIGNED_OUT', status: 401 };
  if (!response.ok) return { ok: false, reason: 'REFUSED', status: response.status };
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
  ) {
    return call<AskV2Operation>(`/ask-v2/threads/${encodeURIComponent(threadId)}/turns`, 'POST', {
      idempotencyKey: key,
      question,
      language,
      intent,
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
