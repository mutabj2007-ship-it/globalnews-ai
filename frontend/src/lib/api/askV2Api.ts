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
  };
  readonly chips: AskPlanChips;
  readonly answer: {
    readonly state: AskAnswerState;
    readonly basis: string;
    readonly missingRoles: readonly string[];
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

export type AskV2Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly reason: 'UNAVAILABLE' | 'SIGNED_OUT' | 'REFUSED' | 'NETWORK';
      readonly status?: number;
    };

async function call<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<AskV2Outcome<T>> {
  let response: Response;
  try {
    response = await accountFetch(path, body === undefined ? { method } : { method, body });
  } catch {
    return { ok: false, reason: 'NETWORK' };
  }
  if (response.status === 404 && path === '/ask-v2/threads')
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
