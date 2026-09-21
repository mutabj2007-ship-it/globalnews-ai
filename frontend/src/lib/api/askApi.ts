import type {
  AskContext,
  AskThread,
  AskThreadWithTurns,
  AskTurnResponse,
  LanguageCode,
} from '@globalnews-ai/shared';

/**
 * BETA-SIMPLE-ASK-SAND-1 §3 — the Ask API client.
 *
 * Mirrors the existing analysisApi.ts conventions deliberately: same
 * base-URL resolution, same error taxonomy shape, same timeout
 * discipline. A second, differently-behaved HTTP client for the same
 * backend would be a maintenance trap.
 *
 * ONE DELIBERATE DIFFERENCE: there is no in-flight request
 * deduplication map here, which analysisApi.ts does have.
 *
 * That map exists in analysisApi.ts to defeat React Strict Mode's
 * development-only double effect invocation, because /analysis/news
 * has no other protection against a duplicate. Ask does: §12's
 * idempotency key means a duplicate submission reaches the server and
 * is resolved there, against a UNIQUE index, across replicas and
 * across retries — which is strictly stronger than a per-tab Map, and
 * is the mechanism §12 actually requires. Adding a client-side map on
 * top would hide duplicates from the very mechanism built to handle
 * them, making the server-side behavior untestable in practice.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Matches analysisApi.ts's own 30s budget, and for the same reason:
 * the backend's ANALYSIS_TIMEOUT_MS (default 20s) needs room to
 * complete, plus network overhead. Ask reaches the same provider
 * through the same service, so a shorter budget here would abort work
 * that was about to succeed — and, because the reservation is
 * released on the server's own failure path rather than on the
 * client's, an early client abort would leave the user with no answer
 * for work that completed.
 */
const REQUEST_TIMEOUT_MS = 30000;

/** Reuses analysisApi.ts's taxonomy verbatim so the UI maps one set of codes. */
export type AskApiErrorCode =
  | 'timeout'
  | 'network'
  | 'invalid-query'
  | 'rate-limited'
  | 'server'
  | 'not-found'
  | 'unknown';

function codeForStatus(status: number): AskApiErrorCode {
  if (status === 429) return 'rate-limited';
  if (status === 404) return 'not-found';
  if (status === 400 || status === 422) return 'invalid-query';
  if (status >= 500) return 'server';
  return 'unknown';
}

export class AskApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code: AskApiErrorCode = 'unknown',
  ) {
    super(message);
    this.name = 'AskApiError';
  }
}

export interface AddAskTurnInput {
  question: string;
  language?: LanguageCode;
  threadId?: string;
  context?: AskContext;
  /** §12 — required. See createIdempotencyKey in lib/ask/askConversation.ts. */
  idempotencyKey: string;
  /** §9 — echoed back after the user confirms a quote. */
  confirmedOperationId?: string;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      // Required: the guest-identity and session cookies are what
      // establish thread ownership, and a cross-origin fetch omits
      // cookies unless this is set. Without it every Ask turn would
      // be issued a brand-new guest identity and no conversation
      // would ever have more than one turn.
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AskApiError('Ask is taking longer than expected. Please try again.', undefined, 'timeout');
    }
    throw new AskApiError(
      error instanceof Error ? error.message : 'Failed to reach the GlobalNews AI backend',
      undefined,
      'network',
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Developer-facing message; the UI chooses what the user sees from
    // `code`, exactly as analysisApi.ts documents.
    throw new AskApiError(`Backend responded with ${response.status}`, response.status, codeForStatus(response.status));
  }

  return response.json() as Promise<T>;
}

/** §3 — add a turn, creating the thread on the first one. */
export function addAskTurn(input: AddAskTurnInput): Promise<AskTurnResponse> {
  return request<AskTurnResponse>('/ask/turns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: input.question,
      language: input.language ?? 'en',
      threadId: input.threadId,
      context: input.context,
      idempotencyKey: input.idempotencyKey,
      confirmedOperationId: input.confirmedOperationId,
    }),
  });
}

/** §3 — reopen a conversation. Runs no AI and costs nothing. */
export function fetchAskThread(threadId: string): Promise<AskThreadWithTurns> {
  return request<AskThreadWithTurns>(`/ask/threads/${encodeURIComponent(threadId)}`, {
    method: 'GET',
  });
}

/** §3 — the caller's conversations, most recently active first. */
export function fetchAskThreads(): Promise<AskThread[]> {
  return request<AskThread[]>('/ask/threads', { method: 'GET' });
}
