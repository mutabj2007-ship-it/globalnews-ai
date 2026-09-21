'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { AnalysisApiResponse, LanguageCode, StoryContext } from '@globalnews-ai/shared';
import { analyzeNews } from '@/lib/api/analysisApi';
import { LoadingStages } from '@/components/search/LoadingStages';
import { resolveAnalysisErrorMessage } from '@/components/search/SearchPageClient';
import { AskCompactResult } from '@/components/ask/AskCompactResult';
import { COMPACT_TOP_PX } from '@/components/ask/launcherAnchor';
import { useLauncherAnchor } from '@/components/ask/useLauncherAnchor';
import { transportableContext, useAskStoryContext } from '@/lib/ask/storyContextStore';
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
 * NO SECOND ANALYSIS PRESENTATION — AND, SINCE REV A, NO NESTED FRAME.
 * This dock used to mount `AnalysisFrameSurface` here. Rev A §2 rules that
 * out and names the root cause, which is NOT css: the frame sizes itself
 * from `window.innerWidth`, and its own accepted geometry states in-file
 * that "SURFACE B IS THE ONLY CONSUMER". Mounting it inside
 * `lg:w-[min(720px,52vw)]` created a second consumer measuring the whole
 * viewport while drawing into half of it.
 *
 * What replaces it is a PROJECTION, not a second presentation:
 * `AskCompactResult` renders four permitted elements of the response the
 * engine already returned, each through the reader Surface B uses
 * (`AnalysisModeBadge`, `buildBriefModel`, `analysis.sources`,
 * `buildBriefTelemetry`). Full analytical detail TRANSITIONS to the
 * workspace (§4.5); it never expands in place.
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
 * REV A MOVES THE ENFORCEMENT, NOT THE RULE. Phase 1 satisfied ASK RULE A
 * by sending nothing at all. Rev A §1 rules that the dock may send exactly
 * `{title, articleId?, countryCode?}` — the EXISTING `StoryContext`, no new
 * type and no DTO field — and nothing else.
 *
 * WHAT IS STILL FORBIDDEN, and why it is a contract question rather than a
 * tidiness one (§1.4): evidence, report and cluster identities are OUTPUTS
 * of a prior analysis. Feeding them back makes results into inputs and
 * requires a service path that consumes supplied evidence — the second
 * retrieval architecture the contract exists to prevent. The anchor is
 * IDENTITY; the service re-retrieves. Also excluded: the previous
 * `AnalysisApiResponse`, source lists, dimension state, any page object.
 *
 * The bound is enforced in one place — `transportableContext` — so there is
 * no call site able to widen it, and `askAiDock.spec.ts` asserts the bound
 * rather than the old absence (§7).
 */

type AskPhase =
  | { kind: 'idle' }
  | { kind: 'loading'; question: string }
  | { kind: 'answered'; question: string; response: AnalysisApiResponse; context: StoryContext | undefined }
  | { kind: 'failed'; question: string; message: string };

type SettledAskTurn = Extract<AskPhase, { kind: 'answered' | 'failed' }>;

interface AskAiDockProps {
  language?: LanguageCode;
}

export function AskAiDock({ language = 'en' }: AskAiDockProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<AskPhase>({ kind: 'idle' });
  const [history, setHistory] = useState<SettledAskTurn[]>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  /* guards a response arriving after the reader asked something else */
  const requestSeq = useRef(0);

  const dictionary = getDictionary(language);
  const t = dictionary.askAi;

  /*
   * §5.2.5 — THE DOCK READS, NEVER WRITES, AND KEEPS NO COPY.
   *
   * No state, no ref, no memo of a previous anchor survives a question
   * here: this is a live read of the store, so a submission always sees
   * what is published AT THAT MOMENT. That is the whole reason L1 (ask
   * after navigating away) and L3 (story A then story B) hold — the dock
   * has nothing of its own to go stale.
   */
  const storyContext = useAskStoryContext();

  /*
   * R2 FINDING 2 — WHERE THE LAUNCHER SITS IS A SURFACE QUESTION.
   *
   * This dock is mounted once, from the root layout, over every route.
   * A width-based rule therefore makes one surface's problem into every
   * surface's problem, which is exactly what R1 did. `useLauncherAnchor`
   * measures what is actually beneath each candidate position and picks
   * the clearer one; at and above `spatial` it returns the released
   * placement without measuring anything.
   */
  const anchor = useLauncherAnchor();

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  /*
   * Conversation scroll belongs to the conversation region, never the page.
   * New turns move the internal reader to the newest exchange while the
   * composer remains reachable at the bottom of the sheet.
   */
  useEffect(() => {
    if (!isOpen) return;
    const node = conversationRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [isOpen, history, phase]);

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

      /*
       * Preserve the previous settled exchange as conversation history before
       * beginning the next turn. Only DISPLAY state is retained: no prior
       * response/evidence is sent back to AnalysisService, so Ask Rule A and
       * the single retrieval architecture remain intact.
       */
      setHistory((turns) =>
        phase.kind === 'answered' || phase.kind === 'failed' ? [...turns, phase] : turns,
      );
      setPhase({ kind: 'loading', question: asked });
      setQuestion('');

      /*
        THE ONE TRANSPORT SITE.
 
        `transportableContext` narrows to `{title, articleId?, countryCode?}`
        (§1.1) — `url` and `sourceName` are display-only and retrieval
        ignores them. With no context published, it returns `undefined` and
        `analyzeNews` is called with TWO arguments, byte-for-byte the Phase
        1 request (§7.5). The generic path is not merely similar; it is the
        same call.
 
        `title` is the SUBJECT and comes from the published context — never
        from the input box (§1.3, §7.4). Passing the follow-up as the title
        is exactly the inversion Rev A's change log owns.
      */
      const sent = transportableContext(storyContext);
      const priorQuestion =
        phase.kind === 'answered' || phase.kind === 'failed'
          ? phase.question
          : history.length > 0
            ? history[history.length - 1].question
            : undefined;

      analyzeNews(asked, language, sent, priorQuestion)
        .then((response) => {
          if (requestSeq.current !== seq) return;
          setPhase({ kind: 'answered', question: asked, response, context: sent });
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
    [question, language, dictionary, storyContext, phase, history],
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
        /*
          ALPHA-MOBILE-SPATIAL-1C — THE LAUNCHER MUST NOT SIT ON ANYTHING
          THE READER NEEDS.

          `spatial:bottom-4 spatial:top-auto` is unconditional, so the
          released desktop placement is restored by CSS at and above the
          breakpoint no matter what the measurement decided — desktop
          geometry cannot be moved by this feature even if the hook
          misbehaves.

          Below it the anchor is MEASURED (see `useLauncherAnchor`).
          `top` is what the Map resolves to, because the Spatial sheet
          owns the bottom at PEEK, HALF and FULL alike; `bottom` is what
          the Analysis workspace resolves to, because its top carries the
          command bar, the mode badge and the reader's own question
          heading — which is where R1 put the launcher, and was wrong.
        */
        style={anchor === 'top' ? { top: COMPACT_TOP_PX, bottom: 'auto' } : undefined}
        data-ask-anchor={anchor}
        className="fixed end-4 bottom-4 z-40 inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink-primary shadow-lg transition-colors spatial:bottom-4 spatial:top-auto hover:border-signal focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
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
            'inset-x-0 bottom-0 h-[92dvh] max-h-[92dvh] rounded-t-2xl',
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

          <div
            ref={conversationRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
            data-ask="body"
            data-ask-scroll="conversation"
          >
            {history.map((turn, index) => (
              <div key={`${index}-${turn.question}`} data-ask="history-turn" className="mb-6 flex flex-col gap-3">
                <div data-ask="user-message" className="ms-auto max-w-[88%] rounded-2xl rounded-br-md bg-signal/15 px-4 py-3 text-sm leading-relaxed text-ink-primary">
                  {turn.question}
                </div>
                {turn.kind === 'answered' ? (
                  <AskCompactResult
                    response={turn.response}
                    question={turn.question}
                    language={language}
                    context={turn.context}
                  />
                ) : (
                  <div role="alert" className="rounded-2xl border border-border bg-void p-4 text-sm text-ink-secondary">
                    {turn.message}
                  </div>
                )}
              </div>
            ))}

            {phase.kind === 'loading' || phase.kind === 'answered' || phase.kind === 'failed' ? (
              <div data-ask="current-turn" className="flex flex-col gap-3">
                <div data-ask="user-message" className="ms-auto max-w-[88%] rounded-2xl rounded-br-md bg-signal/15 px-4 py-3 text-sm leading-relaxed text-ink-primary">
                  {phase.question}
                </div>
              </div>
            ) : null}

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
                §6 — A PROJECTION OF THE RESPONSE, NOT A SECOND WORKSPACE.

                `phase.context` is the context the question was ASKED with,
                not a fresh read: the transition must reproduce the request
                that produced THIS response, and by the time the reader
                presses it the live context may already be a different
                story.
              */
              <AskCompactResult
                response={phase.response}
                question={phase.question}
                language={language}
                context={phase.context}
              />
            ) : null}
          </div>

          <div data-ask="composer" className="shrink-0 border-t border-border bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <form onSubmit={submit} data-ask="form" className="flex flex-col gap-2 px-4 py-3">
            <label className="sr-only" htmlFor="ask-ai-question">
              {t.inputLabel}
            </label>
            <textarea
              id="ask-ai-question"
              ref={inputRef}
              rows={phase.kind === 'idle' && history.length === 0 ? 2 : 1}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t.inputPlaceholder}
              maxLength={1000}
              className="w-full resize-none rounded-2xl border border-border bg-void px-4 py-3 text-sm text-ink-primary placeholder:text-ink-tertiary focus:border-signal focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/*
                THE CONTEXTUAL AFFORDANCE — NOW A TRUTHFUL STATEMENT OF
                WHAT WILL BE SENT.

                It was "coming soon" and disabled while no context could
                cross the boundary. Under Rev A one can, so leaving the
                old label would misdescribe the request the reader is
                about to make. It is still NOT a control: there is no
                onClick and no submit path. It reads the same value the
                submission reads, so the label and the request cannot
                disagree — and `title` is shown so the reader can see
                WHICH story is anchored rather than being told that one
                is.
              */}
              <span
                data-ask="context-affordance"
                data-ask-context={storyContext === undefined ? 'generic' : 'anchored'}
                title={storyContext === undefined ? undefined : storyContext.title}
                className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-tertiary"
              >
                {storyContext === undefined ? t.contextChipGeneric : t.contextChipAnchored}
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
          </div>
        </section>
      )}
    </>
  );
}
