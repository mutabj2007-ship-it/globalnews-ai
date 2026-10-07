'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  askR2PayloadOf,
  askV2Api,
  isAskContextRefusal,
  type AskV2ContextRef,
  newIdempotencyKey,
  type AskGuestStatus,
  type AskR2Payload,
  type AskV2Language,
  type AskV2Operation,
  type AskV2Outcome,
  type AskV2ThreadHistory,
} from '@/lib/api/askV2Api';
import { guestNoticeOf, guestSignInHref, isGuestMode, type GuestNotice } from './askGuestTrial';
import { ASK_SIGN_IN_HREF, keepQuestion } from './askKeptQuestion';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE F — THE ASK R2 CONVERSATION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ZERO-COMPUTE OPEN (§22). Nothing that can spend is requested on mount, focus or typing:
 * whether Ask V2 is available is learned at the first explicit Send, from the server's own
 * answer. A 404 (ASK_V2_ENABLED off — the default) makes the hook report `legacy`, and the
 * screen sends that question down the existing Ask path — the contract's rollback path.
 *
 * ASK GUEST TRIAL R3 — ONE READ ON OPEN: `GET /ask-v2/guest/status` (0 AI · 0 provider · no
 * session minted) tells the composer whether a first-visit guest may ask and how many guest
 * questions remain, and restores a guest conversation after a reload or a cancelled sign-in,
 * or the continued conversation after a completed one. It never starts research.
 *
 * SIGNED OUT IS NOT A ROLLBACK (SIGNED-OUT FALLBACK REMOVAL R1). A 401 means Ask V2 is ON
 * and the reader must sign in — unless the guest trial is available, in which case the
 * question goes to the guest surface. It never goes to /analysis/news, a provider or a model
 * outside Ask V2.
 *
 * ONE OPERATION PER SEND. Each Send carries a fresh idempotency key; a retried request with
 * the same key is the same operation server-side, so a double click cannot run twice.
 *
 * DEEP WORK STOPS AT A QUOTE. `runDeeper` submits `deep-analysis`; the server answers with a
 * quote (`requiresAcceptance`) and NOTHING runs until `confirmDeeper` accepts, reserves and
 * executes it. `cancelDeeper` releases the quote. Guests are asked to sign in instead.
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
  /** ASK GUEST TRIAL R3 — a guest answer that did NOT use a guest question (server-decided). */
  readonly uncounted?: boolean;
}

export type AskR2Availability = 'unknown' | 'r2' | 'legacy';

export interface AskR2DeepQuote {
  readonly question: string;
  readonly operation: AskV2Operation;
}

/**
 * UNIFIED INTELLIGENCE BINDING R2C — `context-unavailable`: the server could not resolve the
 * context reference sent with the question (an unknown story, an ungoverned country). NOTHING
 * ran — no operation, no slot, no meter — and the question is NEVER re-sent without its context
 * (that would silently answer a different, generic question). The caller keeps the draft.
 */
export type AskR2SubmitOutcome =
  | 'legacy'
  | 'signed-out'
  | 'sent'
  | 'busy'
  | 'failed'
  | 'kept'
  | 'context-unavailable';

/** The same shape the server accepts (`safeReturnPath`): strict local path, or null. */
export function sanitizeReturnPath(path: string | null | undefined): string | null {
  if (typeof path !== 'string' || path.length === 0 || path.length > 500) return null;
  return /^\/(?!\/)[a-zA-Z0-9/_?=&.\-]*$/.test(path) ? path : null;
}

const RESTORE_TURN_LIMIT = 10;

/** Read a thread's turns back as display-only turns: reads only, nothing runs again. */
async function restoreTurns(
  history: AskV2ThreadHistory,
  read: (operationId: string) => Promise<AskV2Outcome<AskV2Operation>>,
): Promise<AskR2Turn[]> {
  const turns = history.turns.slice(-RESTORE_TURN_LIMIT);
  const ops = await Promise.all(turns.map((t) => read(t.operationId)));
  return turns.map((t, i) => {
    const op = ops[i];
    return op.ok
      ? {
          question: t.question,
          operation: op.value,
          payload: askR2PayloadOf(op.value),
          ...(op.value.failureCode ? { failure: op.value.failureCode } : {}),
          ...(op.value.result?.expired === true ? { expired: true } : {}),
        }
      : { question: t.question, failure: op.reason };
  });
}

export interface AskR2ConversationOptions {
  /**
   * ASK GUEST TRIAL R3 — the /ask screen opts in. Without it this hook is exactly the landed
   * hook: no request on open, and a 401 is a sign-in requirement with no guest fallback.
   */
  readonly guestTrial?: boolean;
  /**
   * UNIFIED INTELLIGENCE BINDING R2C — `false` skips the one guest-status read and restore on
   * mount (default `true`, the /ask screen). Surfaces mounted while the reader is NOT asking —
   * the global dock on every route, /search — make ZERO requests until an explicit Send; a
   * signed-out Send still reaches the guest trial (401 → status read → guest surface).
   */
  readonly readOnOpen?: boolean;
}

export function useAskR2Conversation(
  language: AskV2Language,
  returnPath: string | null,
  options: AskR2ConversationOptions = {},
) {
  const guestTrial = options.guestTrial === true;
  const readOnOpen = options.readOnOpen !== false;
  const [turns, setTurns] = useState<AskR2Turn[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AskR2Availability>('unknown');
  const [deepQuote, setDeepQuote] = useState<AskR2DeepQuote | null>(null);
  /** The question a 401 stopped: kept for the reader, sent nowhere. */
  const [signInRequired, setSignInRequired] = useState<string | null>(null);
  /* ASK GUEST TRIAL R3 */
  const [guest, setGuest] = useState<AskGuestStatus | null>(null);
  const [guestNotice, setGuestNotice] = useState<GuestNotice | null>(null);
  /** R2C — the question whose context reference the server could not resolve (kept, not sent). */
  const [contextRefused, setContextRefused] = useState<string | null>(null);
  const thread = useRef<{ id: string; language: AskV2Language } | null>(null);
  const guestThread = useRef<{ id: string; language: AskV2Language } | null>(null);
  const inFlight = useRef(false);

  /** Whether the status has been read at all (a failed read is still a read). */
  const guestRead = useRef(false);
  const refreshGuest = useCallback(async (): Promise<AskGuestStatus | null> => {
    guestRead.current = true;
    const read = await askV2Api.guestStatus();
    const status = read.ok ? read.value : null;
    setGuest(status);
    return status;
  }, []);

  /*
    ASK GUEST TRIAL R3 — the one read on open, and the restore it allows. Signed in, with a
    conversation just continued through a guest claim: that conversation, read back through
    the ACCOUNT routes. A guest with a live session: its latest conversation. Reads only.
  */
  useEffect(() => {
    if (!guestTrial || !readOnOpen) return;
    let live = true;
    void (async () => {
      const status = await refreshGuest();
      if (!live || status === null) return;
      if (status.signedIn) {
        const cont = await askV2Api.continuation();
        if (!live || !cont.ok || cont.value.threadId === null) return;
        const history = await askV2Api.thread(cont.value.threadId);
        if (!live || !history.ok) return;
        const restored = await restoreTurns(history.value, (id) => askV2Api.operation(id));
        if (!live) return;
        thread.current = { id: history.value.id, language: history.value.language };
        setAvailability('r2');
        setTurns((t) => (t.length === 0 ? restored : t));
        setGuestNotice('RESUMED');
        return;
      }
      if (isGuestMode(status) && status.session) {
        const list = await askV2Api.guestThreads();
        if (!live || !list.ok || list.value.length === 0) return;
        const latest = list.value[0];
        const history = await askV2Api.guestThread(latest.id);
        if (!live || !history.ok) return;
        const restored = await restoreTurns(history.value, (id) => askV2Api.guestOperation(id));
        if (!live) return;
        guestThread.current = { id: history.value.id, language: history.value.language };
        setAvailability('r2');
        setTurns((t) => (t.length === 0 ? restored : t));
      }
    })();
    return () => {
      live = false;
    };
  }, [guestTrial, readOnOpen, refreshGuest]);

  const ensureThread = useCallback(async (): Promise<string | 'legacy' | 'signed-out' | null> => {
    if (thread.current?.language === language) return thread.current.id;
    const created = await askV2Api.createThread(language, sanitizeReturnPath(returnPath));
    if (!created.ok) {
      /* Only a disabled Ask V2 is the governed rollback. A 401 is a sign-in requirement. */
      if (created.reason === 'UNAVAILABLE') {
        setAvailability('legacy');
        return 'legacy';
      }
      if (created.reason === 'SIGNED_OUT') return 'signed-out';
      return null;
    }
    thread.current = { id: created.value.id, language };
    setAvailability('r2');
    return created.value.id;
  }, [language, returnPath]);

  /** ASK GUEST TRIAL R3 — one guest Send, entirely server-decided. */
  const submitAsGuest = useCallback(
    async (
      q: string,
      context: AskV2ContextRef | undefined,
      onTurn?: (turn: AskR2Turn) => void,
      retried = false,
    ): Promise<AskR2SubmitOutcome> => {
      let threadId = guestThread.current?.language === language ? guestThread.current.id : null;
      if (threadId === null) {
        const created = await askV2Api.guestCreateThread(language, sanitizeReturnPath(returnPath));
        if (!created.ok) {
          /* APPROVED DEVIATION FROM THE 58f80 BASELINE (CTO checkpoint 5 §3) — BEGIN.
             Live Alpha: a dropped connection on the guest's FIRST send (thread creation) was shown
             as 'The service is busy' (a limit notice) with no retry line. A genuine NETWORK failure
             is a failed send: the draft is kept with the retry line, nothing auto-retries, nothing
             ran. Governed refusals (codes) keep their notices below. */
          if (created.reason === 'NETWORK') {
            const failedTurn: AskR2Turn = { question: q, failure: created.reason };
            setTurns((t) => [...t, failedTurn]);
            onTurn?.(failedTurn);
            return 'failed';
          }
          /* APPROVED DEVIATION FROM THE 58f80 BASELINE — END. */
          if (created.reason === 'UNAVAILABLE') {
            setAvailability('legacy');
            return 'legacy';
          }
          const notice = guestNoticeOf(created.code);
          if (notice === 'UNAVAILABLE' || created.code === 'SIGNED_IN_USE_ACCOUNT') {
            await refreshGuest();
            setSignInRequired(q);
            return 'signed-out';
          }
          setGuestNotice(notice ?? 'LIMITED');
          return 'kept';
        }
        threadId = created.value.id;
        guestThread.current = { id: threadId, language };
        setAvailability('r2');
      }
      const before = guest?.committed ?? 0;
      const sent = await askV2Api.guestSubmit(
        threadId,
        q,
        language,
        newIdempotencyKey(),
        context,
      );
      if (!sent.ok) {
        if (sent.reason === 'SIGNED_OUT' && !retried) {
          /* The guest session ended (absolute expiry, cleared cookie): the server decides anew. */
          guestThread.current = null;
          await refreshGuest();
          return submitAsGuest(q, context, onTurn, true);
        }
        /* R2C — the context could not be resolved: nothing ran, nothing was charged. */
        if (isAskContextRefusal(sent.code)) {
          setContextRefused(q);
          return 'context-unavailable';
        }
        const notice = guestNoticeOf(sent.code);
        if (notice === 'UNAVAILABLE') {
          await refreshGuest();
          setSignInRequired(q);
          return 'signed-out';
        }
        if (notice !== null) {
          setGuestNotice(notice);
          await refreshGuest();
          return 'kept';
        }
        const failedTurn: AskR2Turn = { question: q, failure: sent.reason };
        setTurns((t) => [...t, failedTurn]);
        onTurn?.(failedTurn);
        return 'failed';
      }
      const op = sent.value;
      const after = await refreshGuest();
      const uncounted = op.status === 'COMPLETED' && (after?.committed ?? before) === before;
      const turn: AskR2Turn = {
        question: q,
        operation: op,
        payload: askR2PayloadOf(op),
        ...(op.failureCode ? { failure: op.failureCode } : {}),
        ...(uncounted || op.status === 'RELEASED' ? { uncounted: true } : {}),
      };
      setTurns((t) => [...t, turn]);
      onTurn?.(turn);
      return 'sent';
    },
    [guest, language, refreshGuest, returnPath],
  );

  /**
   * Send one question. Resolves `legacy` when the caller must use the existing Ask path
   * (Ask V2 disabled), `signed-out` when the reader must sign in first (nothing is sent
   * anywhere), `sent` when an R2 turn was added, `busy` when a question is in flight, and
   * `kept` when a guest refusal left the question in the composer (nothing ran).
   */
  const submit = useCallback(
    async (
      question: string,
      context?: AskV2ContextRef,
      /** R2C — receives exactly the turn THIS Send produced (a caller's own staleness guard). */
      onTurn?: (turn: AskR2Turn) => void,
    ): Promise<AskR2SubmitOutcome> => {
      const q = question.trim();
      if (q.length === 0) return 'failed';
      if (inFlight.current) return 'busy';
      if (availability === 'legacy') return 'legacy';
      inFlight.current = true;
      setPending(q);
      setSignInRequired(null);
      setGuestNotice(null);
      setContextRefused(null);
      try {
        if (guestTrial && isGuestMode(guest)) return await submitAsGuest(q, context, onTurn);
        const id = await ensureThread();
        if (id === 'legacy') return 'legacy';
        if (id === 'signed-out') {
          if (guestTrial) {
            /* The status read may not have arrived yet: ask it once before asking to sign in. */
            const status = guestRead.current ? guest : await refreshGuest();
            if (isGuestMode(status)) return await submitAsGuest(q, context, onTurn);
          }
          setSignInRequired(q);
          return 'signed-out';
        }
        if (id === null) {
          const failedTurn: AskR2Turn = { question: q, failure: 'THREAD_UNAVAILABLE' };
          setTurns((t) => [...t, failedTurn]);
          onTurn?.(failedTurn);
          return 'failed';
        }
        const sent = await askV2Api.submit(id, q, language, 'ask', newIdempotencyKey(), context);
        /* A session that ended mid-conversation is the same requirement, never a rollback. */
        if (!sent.ok && sent.reason === 'SIGNED_OUT') {
          thread.current = null;
          setSignInRequired(q);
          return 'signed-out';
        }
        /* R2C — the context could not be resolved: nothing ran, nothing was charged. */
        if (!sent.ok && isAskContextRefusal(sent.code)) {
          setContextRefused(q);
          return 'context-unavailable';
        }
        if (!sent.ok) {
          const failedTurn: AskR2Turn = { question: q, failure: sent.reason };
          setTurns((t) => [...t, failedTurn]);
          onTurn?.(failedTurn);
          return 'failed';
        }
        const op = sent.value;
        const turn: AskR2Turn = {
          question: q,
          operation: op,
          payload: askR2PayloadOf(op),
          ...(op.failureCode ? { failure: op.failureCode } : {}),
        };
        setTurns((t) => [...t, turn]);
        onTurn?.(turn);
        return 'sent';
      } finally {
        inFlight.current = false;
        setPending(null);
      }
    },
    [availability, ensureThread, guest, guestTrial, language, refreshGuest, submitAsGuest],
  );

  /**
   * ASK GUEST TRIAL R3 — sign in to CONTINUE this guest conversation. The guest's own thread
   * is claimed server-side, the unsent draft is kept for the composer, then the browser goes
   * to Google. Nothing is sent automatically on return.
   */
  const continueWithSignIn = useCallback(async (draft: string): Promise<boolean> => {
    keepQuestion(draft);
    const current = guestThread.current;
    if (current === null) {
      window.location.assign(ASK_SIGN_IN_HREF);
      return true;
    }
    const claimed = await askV2Api.guestClaim(current.id);
    if (!claimed.ok) {
      setGuestNotice(guestNoticeOf(claimed.code) ?? 'LIMITED');
      return false;
    }
    window.location.assign(guestSignInHref());
    return true;
  }, []);

  /** Ask for a deeper run: the server quotes it; nothing runs until `confirmDeeper`. */
  const runDeeper = useCallback(
    async (question: string): Promise<boolean> => {
      if (isGuestMode(guest)) {
        setGuestNotice('DEEPER');
        return false;
      }
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
    [guest, language],
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

  /**
   * ALPHA VISUAL ACCEPTANCE REPAIR R1 (E) — a reopened stored result names its own thread
   * (owner-scoped by the server). Remembering it here makes the reader's NEXT explicit Ask
   * a follow-up in that conversation instead of a new one-question thread. It is a local
   * seed only: no request, no mutation, nothing rerun. A conversation already started on
   * this screen is never replaced, and a thread in another language is not continued —
   * `ensureThread` then starts a new one, exactly as for a language switch.
   */
  const continueThread = useCallback((id: string, threadLanguage: AskV2Language): void => {
    if (thread.current !== null) return;
    thread.current = { id, language: threadLanguage };
  }, []);

  /**
   * R2C — "Start a new topic" / the reader's context changed: the NEXT explicit Send opens a new
   * thread, so no earlier question continues into it. A local reset only — no request, nothing
   * rerun; turns already on screen stay visible as history.
   */
  const startNewTopic = useCallback((): void => {
    thread.current = null;
    guestThread.current = null;
  }, []);

  /** "Not now": the quote is released; nothing ran. */
  const cancelDeeper = useCallback(async (): Promise<void> => {
    const quote = deepQuote;
    setDeepQuote(null);
    if (quote !== null) await askV2Api.release(quote.operation.operationId);
  }, [deepQuote]);

  /**
   * ASK DESIGN COMPLETENESS R2 — "New question": leave the conversation on screen and return to
   * an empty Ask. A LOCAL reset only. The previous thread is not deleted or altered on the
   * server (there is no delete call anywhere here), so it stays in Recent; the next explicit Send
   * opens a new thread. Refused while a request is in flight, so nothing that is running is
   * orphaned. An open deep-analysis quote is released exactly as "Not now" releases it.
   */
  const startNewConversation = useCallback((): boolean => {
    if (pending !== null) return false;
    thread.current = null;
    guestThread.current = null;
    setTurns([]);
    setSignInRequired(null);
    setContextRefused(null);
    setGuestNotice(null);
    const quote = deepQuote;
    setDeepQuote(null);
    if (quote !== null) void askV2Api.release(quote.operation.operationId);
    return true;
  }, [pending, deepQuote]);

  return {
    /* ASK DESIGN COMPLETENESS R2 */
    startNewConversation,
    turns,
    pending,
    availability,
    signInRequired,
    deepQuote,
    submit,
    runDeeper,
    confirmDeeper,
    cancelDeeper,
    continueThread,
    /* R2C */
    startNewTopic,
    contextRefused,
    /* ASK GUEST TRIAL R3 */
    guest,
    guestMode: isGuestMode(guest),
    guestNotice,
    setGuestNotice,
    continueWithSignIn,
  };
}

/**
 * "Open full analysis" (D25 10): NAVIGATION to a display-only read of the stored operation.
 * 0 AI · 0 provider · no compute — the target only calls `GET /ask-v2/operations/:id`.
 */
export function openFullAnalysisHref(operationId: string): string {
  return `/ask?operation=${encodeURIComponent(operationId)}`;
}
