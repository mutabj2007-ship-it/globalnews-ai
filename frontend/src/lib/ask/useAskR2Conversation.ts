'use client';

import { useCallback, useRef, useState } from 'react';
import {
  askR2PayloadOf,
  askV2Api,
  newIdempotencyKey,
  type AskR2Payload,
  type AskV2Language,
  type AskV2Operation,
} from '@/lib/api/askV2Api';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE F — THE ASK R2 CONVERSATION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ZERO-REQUEST OPEN (§22). Nothing is requested on mount, focus or typing: whether Ask V2
 * is available is learned at the first explicit Send, from the server's own answer. A 404
 * (ASK_V2_ENABLED off — the default) or 401 (signed out) makes the hook report `legacy`, and
 * the screen sends that question down the existing Ask path — the contract's rollback path.
 *
 * ONE OPERATION PER SEND. Each Send carries a fresh idempotency key; a retried request with
 * the same key is the same operation server-side, so a double click cannot run twice.
 *
 * DEEP WORK STOPS AT A QUOTE. `runDeeper` submits `deep-analysis`; the server answers with a
 * quote (`requiresAcceptance`) and NOTHING runs until `confirmDeeper` accepts, reserves and
 * executes it. `cancelDeeper` releases the quote.
 *
 * RETURN PATH IS CAPTURED AT DEPARTURE (§16): the caller supplies it when Ask opens, it is
 * stored on the thread, and nothing here derives it from the answer.
 */

export interface AskR2Turn {
  readonly question: string;
  readonly operation?: AskV2Operation;
  readonly payload?: AskR2Payload | null;
  /** A control refused it (failureCode) or the request failed — nothing was stored. */
  readonly failure?: string;
  /** GATE H (MD-005) — a stored result read after its validity: shown as it was, and said so. */
  readonly expired?: boolean;
}

export type AskR2Availability = 'unknown' | 'r2' | 'legacy';

export interface AskR2DeepQuote {
  readonly question: string;
  readonly operation: AskV2Operation;
}

/** The same shape the server accepts (`safeReturnPath`): strict local path, or null. */
export function sanitizeReturnPath(path: string | null | undefined): string | null {
  if (typeof path !== 'string' || path.length === 0 || path.length > 500) return null;
  return /^\/(?!\/)[a-zA-Z0-9/_?=&.\-]*$/.test(path) ? path : null;
}

export function useAskR2Conversation(language: AskV2Language, returnPath: string | null) {
  const [turns, setTurns] = useState<AskR2Turn[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AskR2Availability>('unknown');
  const [deepQuote, setDeepQuote] = useState<AskR2DeepQuote | null>(null);
  const thread = useRef<{ id: string; language: AskV2Language } | null>(null);
  const inFlight = useRef(false);

  const ensureThread = useCallback(async (): Promise<string | 'legacy' | null> => {
    if (thread.current?.language === language) return thread.current.id;
    const created = await askV2Api.createThread(language, sanitizeReturnPath(returnPath));
    if (!created.ok) {
      if (created.reason === 'UNAVAILABLE' || created.reason === 'SIGNED_OUT') {
        setAvailability('legacy');
        return 'legacy';
      }
      return null;
    }
    thread.current = { id: created.value.id, language };
    setAvailability('r2');
    return created.value.id;
  }, [language, returnPath]);

  /**
   * Send one question. Resolves `legacy` when the caller must use the existing Ask path,
   * `sent` when an R2 turn was added, `busy` when a question is already in flight.
   */
  const submit = useCallback(
    async (question: string): Promise<'legacy' | 'sent' | 'busy' | 'failed'> => {
      const q = question.trim();
      if (q.length === 0) return 'failed';
      if (inFlight.current) return 'busy';
      if (availability === 'legacy') return 'legacy';
      inFlight.current = true;
      setPending(q);
      try {
        const id = await ensureThread();
        if (id === 'legacy') return 'legacy';
        if (id === null) {
          setTurns((t) => [...t, { question: q, failure: 'THREAD_UNAVAILABLE' }]);
          return 'failed';
        }
        const sent = await askV2Api.submit(id, q, language, 'ask', newIdempotencyKey());
        if (!sent.ok) {
          setTurns((t) => [...t, { question: q, failure: sent.reason }]);
          return 'failed';
        }
        const op = sent.value;
        setTurns((t) => [
          ...t,
          {
            question: q,
            operation: op,
            payload: askR2PayloadOf(op),
            ...(op.failureCode ? { failure: op.failureCode } : {}),
          },
        ]);
        return 'sent';
      } finally {
        inFlight.current = false;
        setPending(null);
      }
    },
    [availability, ensureThread, language],
  );

  /** Ask for a deeper run: the server quotes it; nothing runs until `confirmDeeper`. */
  const runDeeper = useCallback(
    async (question: string): Promise<boolean> => {
      if (inFlight.current || thread.current === null) return false;
      inFlight.current = true;
      try {
        const quoted = await askV2Api.submit(
          thread.current.id,
          question,
          language,
          'deep-analysis',
          newIdempotencyKey(),
        );
        if (!quoted.ok) return false;
        setDeepQuote({ question, operation: quoted.value });
        return true;
      } finally {
        inFlight.current = false;
      }
    },
    [language],
  );

  /** The explicit acceptance: accept → reserve → execute. The only path to deep compute. */
  const confirmDeeper = useCallback(async (): Promise<boolean> => {
    const quote = deepQuote;
    if (quote === null || inFlight.current) return false;
    inFlight.current = true;
    setPending(quote.question);
    setDeepQuote(null);
    try {
      const id = quote.operation.operationId;
      const accepted = await askV2Api.accept(id);
      const reserved = accepted.ok ? await askV2Api.reserve(id) : accepted;
      const done = reserved.ok ? await askV2Api.execute(id) : reserved;
      setTurns((t) => [
        ...t,
        done.ok
          ? {
              question: quote.question,
              operation: done.value,
              payload: askR2PayloadOf(done.value),
              ...(done.value.failureCode ? { failure: done.value.failureCode } : {}),
            }
          : { question: quote.question, failure: done.reason },
      ]);
      return done.ok;
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }, [deepQuote]);

  /** "Not now": the quote is released; nothing ran. */
  const cancelDeeper = useCallback(async (): Promise<void> => {
    const quote = deepQuote;
    setDeepQuote(null);
    if (quote !== null) await askV2Api.release(quote.operation.operationId);
  }, [deepQuote]);

  return {
    turns,
    pending,
    availability,
    deepQuote,
    submit,
    runDeeper,
    confirmDeeper,
    cancelDeeper,
  };
}

/**
 * "Open full analysis" (D25 10): NAVIGATION to a display-only read of the stored operation.
 * 0 AI · 0 provider · no compute — the target only calls `GET /ask-v2/operations/:id`.
 */
export function openFullAnalysisHref(operationId: string): string {
  return `/ask?operation=${encodeURIComponent(operationId)}`;
}
