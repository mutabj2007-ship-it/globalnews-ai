'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { AnalysisApiResponse, LanguageCode } from '@globalnews-ai/shared';
import { analyzeNews } from '@/lib/api/analysisApi';
import { LoadingStages } from '@/components/search/LoadingStages';
import { resolveAnalysisErrorMessage } from '@/components/search/SearchPageClient';
import { AnalysisFrameSurface } from '@/components/analysis-frame/AnalysisFrameSurface';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * ═══ ASK AI — PHASE 1 ════════════════════════════════════════════════════
 *
 * A visible Ask AI surface over the Analysis engine that is ALREADY LIVE.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ─────────────────────────────────
 *
 * NO SECOND AI ENGINE. Every answer on this surface comes from
 * `analyzeNews()` -> `POST /analysis/news`, the same client, the same route
 * and the same service that `/search` has always used. This file contains no
 * provider, no model name, no prompt, no retrieval strategy and no ranking.
 *
 * NO SECOND ANALYSIS PRESENTATION. The answer, its citations, the evidence
 * library, the sources dock, retrieval context, trust and diversity are
 * rendered by `AnalysisFrameSurface` — the accepted R4 frame — not by
 * anything authored here. The frame also owns the four evidence states
 * (`populated`, `analysis-failed`, `no-evidence`, `provider-unavailable`),
 * so the no-evidence and provider-unavailable cases this surface must show
 * are the SAME ones `/search` shows, resolved by the same function.
 *
 * NO QUERY REWRITING. The reader's question is passed verbatim. Retrieval
 * quality is the backend's to own, and a frontend that quietly reshapes the
 * question to get better results would hide the very defect that has to be
 * fixed upstream — and would make the two surfaces disagree about what was
 * actually asked.
 *
 * NO REQUEST ON OPEN. Opening a panel is navigation, not a question. The
 * request is issued from `onSubmit` and from nowhere else, so a reader who
 * opens the dock and closes it again has cost nothing and asked nothing.
 *
 * ── CONTEXTUAL ASK IS PRESENT AS AN AFFORDANCE ONLY ────────────────────
 *
 * ASK RULE A — caller context is not evidence.
 * ASK RULE B — the model prompt is the export boundary.
 *
 * Phase 1 sends NO structured Map/Situation context: `analyzeNews` is called
 * with two arguments, so the optional `storyContext` parameter is not passed
 * at all. The contextual control renders DISABLED and carries no submit
 * path, so the affordance can be seen and reasoned about without any caller
 * context crossing the boundary before Main's context interface exists.
 */

type AskPhase =
  /* opened, nothing asked. NOT a failure, and NOT a request. */
  | { kind: 'idle' }
  | { kind: 'loading'; question: string }
  | { kind: 'answered'; question: string; response: AnalysisApiResponse }
  | { kind: 'failed'; question: string; message: string };

interface AskAiDockProps {
  language?: LanguageCode;
}

export function AskAiDock({ language = 'en' }: AskAiDockProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<AskPhase>({ kind: 'idle' });
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  /* guards a response arriving after the reader asked something else */
  const requestSeq = useRef(0);

  const dictionary = getDictionary(language);
  const t = dictionary.askAi;

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  /* Escape closes, because a panel that traps the reader is a trap. */
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      const asked = question.trim();
      if (asked.length === 0) return;

      const seq = requestSeq.current + 1;
      requestSeq.current = seq;
      setPhase({ kind: 'loading', question: asked });

      /*
        TWO ARGUMENTS, ON PURPOSE. `analyzeNews(query, language, storyContext?)`
        accepts a third; Phase 1 does not pass one. ASK RULE A holds here by
        construction rather than by a promise in a comment.
      */
      analyzeNews(asked, language)
        .then((response) => {
          if (requestSeq.current !== seq) return;
          setPhase({ kind: 'answered', question: asked, response });
        })
        .catch((error: unknown) => {
          if (requestSeq.current !== seq) return;
          /* the SAME error mapping /search uses, imported rather than copied */
          setPhase({
            kind: 'failed',
            question: asked,
            message: resolveAnalysisErrorMessage(error, dictionary),
          });
        });
    },
    [question, language, dictionary],
  );

  return (
    <>
      {/* ── THE ENTRY CONTROL ───────────────────────────────────────────
          Mounted from the root layout as its own element, exactly like
          ServiceWorkerRegistrar. It does NOT enter the NavBar's released
          GN-CD item row: that geometry is accepted design, and Ask AI's own
          chrome/geometry reconciliation is still held. */}
      <button
        type="button"
        data-ask="launcher"
        aria-expanded={isOpen}
        aria-controls="ask-ai-panel"
        onClick={() => setIsOpen((open) => !open)}
        className="fixed bottom-4 end-4 z-40 inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink-primary shadow-lg transition-colors hover:border-signal focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
      >
        <span aria-hidden="true" className="font-mono text-[11px] text-signal">◆</span>
        {t.launcher}
      </button>

      {!isOpen ? null : (
        <section
          id="ask-ai-panel"
          data-ask="panel"
          data-ask-phase={phase.kind}
          aria-label={t.panelLabel}
          className={[
            'fixed z-50 flex flex-col border border-border-strong bg-surface',
            /* MOBILE — a bottom sheet. Full width, capped height, rounded top. */
            'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl',
            /* TABLET and up — a right-hand dock, full height. */
            'sm:inset-y-0 sm:end-0 sm:start-auto sm:w-[min(560px,92vw)] sm:max-h-none sm:rounded-none sm:rounded-s-2xl',
            /* DESKTOP — a wider dock, so evidence and answer sit side by side. */
            'lg:w-[min(720px,52vw)]',
          ].join(' ')}
        >
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="font-display text-base font-medium text-ink-primary">{t.title}</h2>
            <button
              type="button"
              data-ask="close"
              onClick={() => setIsOpen(false)}
              className="min-h-[44px] rounded-xl px-3 text-sm text-ink-secondary hover:text-ink-primary"
            >
              {t.close}
            </button>
          </header>

          <form onSubmit={submit} data-ask="form" className="flex flex-col gap-2 border-b border-border px-4 py-3">
            <label className="sr-only" htmlFor="ask-ai-question">
              {t.inputLabel}
            </label>
            <textarea
              id="ask-ai-question"
              ref={inputRef}
              rows={2}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t.inputPlaceholder}
              maxLength={1000}
              className="w-full resize-none rounded-2xl border border-border bg-void px-4 py-3 text-sm text-ink-primary placeholder:text-ink-tertiary focus:border-signal focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/*
                THE CONTEXTUAL AFFORDANCE — VISIBLE, DISABLED, NON-SUBMITTING.
                It has no onClick and is `disabled`, so no caller context can
                cross the model boundary before Main's interface exists.
              */}
              <span
                data-ask="context-affordance"
                aria-disabled="true"
                title={t.contextPendingHint}
                className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-tertiary opacity-60"
              >
                {t.contextPending}
              </span>

              <button
                type="submit"
                data-ask="submit"
                disabled={question.trim().length === 0 || phase.kind === 'loading'}
                className="min-h-[44px] rounded-2xl bg-signal px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.submit}
              </button>
            </div>
          </form>

          <div className="flex-1 overflow-y-auto px-4 py-4" data-ask="body">
            {phase.kind === 'idle' ? (
              /* No request has been made and none will be until a question is
                 submitted. This is the honest empty state, not a failure. */
              <p data-ask="idle" className="text-sm text-ink-tertiary">
                {t.idle}
              </p>
            ) : null}

            {phase.kind === 'loading' ? (
              /* the SAME loading presentation /search uses, same stages */
              <LoadingStages stages={[...dictionary.loadingStages]} />
            ) : null}

            {phase.kind === 'failed' ? (
              <div data-ask="error" role="alert" className="rounded-2xl border border-border bg-void p-6 text-center">
                <p className="text-sm text-ink-secondary">{phase.message}</p>
              </div>
            ) : null}

            {phase.kind === 'answered' ? (
              /*
                THE ACCEPTED ANALYSIS PRESENTATION, UNMODIFIED.

                Answer, citations, evidence library, sources dock, retrieval
                context, trust and diversity all come from here — and so do
                the no-evidence and provider-unavailable states, which the
                frame resolves itself. Nothing about them is re-implemented,
                re-worded or re-decided on this surface.
              */
              <AnalysisFrameSurface response={phase.response} language={language} />
            ) : null}
          </div>
        </section>
      )}
    </>
  );
}
