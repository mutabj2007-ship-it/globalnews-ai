'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { LanguageCode } from '@globalnews-ai/shared';
import {
  INITIAL_ASK_CONVERSATION,
  askConversationReducer,
  canSubmit,
  createIdempotencyKey,
  visibleTurns,
  type AskConversationError,
} from '@/lib/ask/askConversation';
import { readAskContext } from '@/lib/ask/askNavigationContext';
import { addAskTurn, AskApiError, fetchAskThread } from '@/lib/api/askApi';
import { ContextualReturnBar } from './ContextualReturnBar';
import { SandQuotePanel } from './SandQuotePanel';
import { AskTurnView } from './AskTurnView';

/**
 * BETA-SIMPLE-ASK-SAND-1 §3 — the conversational Ask surface.
 *
 * This component is deliberately thin. Every decision that could be
 * wrong — turn ordering, duplicate suppression, idempotency-key
 * lifetime, quote handling, composer availability — lives in
 * lib/ask/askConversation.ts as pure functions with real tests,
 * because this repository has no jsdom or React Testing Library and a
 * reducer inside a component body could only be checked by reading
 * its source.
 *
 * §3's layout requirements, and how each is met:
 *
 *   "scrollable conversation"           → the transcript is the
 *                                         page's normal flow, so it
 *                                         uses the browser's own
 *                                         scrolling.
 *   "composer remains reachable after
 *    long responses"                    → the composer is
 *                                         position: sticky at the
 *                                         bottom of the viewport, so
 *                                         it never scrolls away no
 *                                         matter how long an answer
 *                                         is.
 *   "previous answers remain visible"   → turns accumulate; nothing
 *                                         is replaced.
 *   "mobile usability"                  → a single column, 44px
 *                                         minimum touch targets, and
 *                                         a 16px side gutter.
 *
 * WHY STICKY RATHER THAN A FIXED-HEIGHT SCROLL PANE: an inner
 * scrolling container is the usual way to build a chat, and it is the
 * wrong choice here. Analysis answers are long and contain their own
 * nested regions (the Sources Dock, the Complete Analysis Record), and
 * nesting those inside a second scroll container produces the
 * scroll-trapping that makes them unusable on a phone. Page-level
 * scrolling with a sticky composer gives §3 what it asks for without
 * that cost.
 */
export function AskConversationClient(): JSX.Element {
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(askConversationReducer, INITIAL_ASK_CONVERSATION);
  const [draft, setDraft] = useState('');

  const context = readAskContext(new URLSearchParams(searchParams.toString()));
  const language = (searchParams.get('lang') as LanguageCode | null) ?? 'en';
  const resumeThreadId = searchParams.get('thread') ?? undefined;

  /**
   * Keeps the latest state available to the submit handler without
   * making the handler depend on it.
   *
   * Without this, `send` would close over a stale `state` (React
   * closures capture the render they were created in), and the
   * confirm path would resubmit with an out-of-date idempotency key —
   * silently defeating §12 in exactly the case it matters most.
   */
  const stateRef = useRef(state);
  stateRef.current = state;

  // §3 "reload/resume" — restores a conversation from ?thread=.
  useEffect(() => {
    if (!resumeThreadId) return;

    // Guards against a slow resume landing after the user has already
    // started typing a new turn — the same stale-response discipline
    // SearchPageClient already applies (see staleResponseProtection).
    let cancelled = false;

    fetchAskThread(resumeThreadId)
      .then((thread) => {
        if (cancelled) return;
        dispatch({ type: 'resume', threadId: thread.thread.id, turns: [...thread.turns] });
      })
      .catch(() => {
        // A thread that cannot be loaded (expired guest cookie,
        // someone else's link) starts a fresh conversation rather
        // than showing an error the user cannot act on.
        if (!cancelled) dispatch({ type: 'reset' });
      });

    return () => {
      cancelled = true;
    };
  }, [resumeThreadId]);

  const send = useCallback(
    async (question: string, idempotencyKey: string, confirmedOperationId?: string) => {
      try {
        const response = await addAskTurn({
          question,
          language,
          threadId: stateRef.current.threadId,
          context,
          idempotencyKey,
          confirmedOperationId,
        });
        dispatch({ type: 'resolved', response });
      } catch (error) {
        const code: AskConversationError =
          error instanceof AskApiError
            ? error.code === 'not-found' || error.code === 'unknown'
              ? 'unknown'
              : error.code === 'invalid-query'
                ? 'invalid-question'
                : error.code
            : 'unknown';
        dispatch({ type: 'failed', error: code });
      }
    },
    // `context` is derived from searchParams each render; depending on
    // the primitive string keeps this callback stable across renders
    // that did not actually change the context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, searchParams.toString()],
  );

  const onSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const question = draft.trim();
      if (!canSubmit(stateRef.current, question)) return;

      // §12 — minted once here, and reused for every retry of this
      // same question (including the confirmation round trip). See
      // askConversation.ts for why the key must not be regenerated
      // per attempt.
      const idempotencyKey = stateRef.current.idempotencyKey ?? createIdempotencyKey();

      dispatch({ type: 'submit', question, idempotencyKey });
      setDraft('');
      void send(question, idempotencyKey);
    },
    [draft, send],
  );

  const onConfirmQuote = useCallback(() => {
    const { pendingQuote, pendingQuestion, idempotencyKey } = stateRef.current;
    if (!pendingQuote || !pendingQuestion || !idempotencyKey) return;

    dispatch({ type: 'confirm' });
    // The SAME key and the quoted operation id, so the server
    // recognises this as the operation it already quoted rather than
    // classifying and pricing a second one.
    void send(pendingQuestion, idempotencyKey, pendingQuote.operationId);
  }, [send]);

  const turns = visibleTurns(state);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-40 pt-6 sm:px-6 lg:px-8">
      <ContextualReturnBar context={context} />

      <h1 className="mt-6 font-display text-2xl text-ink-primary sm:text-3xl">
        Ask GlobalNews AI
      </h1>

      {turns.length === 0 && !state.pending && (
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          Ask about a country, a situation, or a trend. Every answer is grounded in retrieved
          sources, and you can keep asking follow-up questions.
        </p>
      )}

      {/*
        aria-live="polite" so a screen-reader user is told when an
        answer arrives. "polite" rather than "assertive": an answer is
        not an emergency, and assertive would interrupt whatever the
        user is reading.
      */}
      <section
        aria-label="Conversation"
        aria-live="polite"
        aria-busy={state.pending}
        className="mt-8 space-y-8"
      >
        {turns.map((turn) => (
          <AskTurnView key={turn.id} turn={turn} />
        ))}

        {state.pending && (
          <p role="status" className="text-sm text-ink-secondary">
            Retrieving evidence and analysing…
          </p>
        )}

        {state.error && (
          <p role="alert" className="rounded-xl border border-border bg-surface p-4 text-sm text-ink-secondary">
            {ERROR_MESSAGES[state.error]}
          </p>
        )}
      </section>

      {state.pendingQuote && (
        <div className="mt-8">
          <SandQuotePanel
            quote={state.pendingQuote}
            onConfirm={onConfirmQuote}
            onCancel={() => dispatch({ type: 'dismiss-quote' })}
            busy={state.pending}
          />
        </div>
      )}

      {/*
        §3 "composer remains reachable after long responses". Sticky to
        the bottom of the viewport, so it stays put however long the
        transcript grows.
      */}
      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-border bg-void/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        <label htmlFor="ask-composer" className="sr-only">
          Ask a question
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="ask-composer"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter inserts a newline — the
              // convention every conversational surface uses. Without
              // it, Enter would insert a newline in a textarea and the
              // user would have to reach for the button every time.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSubmit(event);
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="Ask a follow-up question…"
            disabled={state.pending || state.pendingQuote !== undefined}
            className="min-h-[44px] flex-1 resize-y rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink-primary placeholder:text-ink-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canSubmit(state, draft)}
            className="min-h-[44px] shrink-0 rounded-xl bg-signal px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-signal-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-40"
          >
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}

const ERROR_MESSAGES: Record<AskConversationError, string> = {
  network: 'Could not reach GlobalNews AI. Check your connection and try again.',
  timeout: 'That took longer than expected. Please try again.',
  'rate-limited': 'Too many questions in a short time. Please wait a moment and try again.',
  'invalid-question': 'That question could not be processed. Try rephrasing it.',
  server: 'Something went wrong on our side. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};
