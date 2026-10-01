'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { StoryContext } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { usePublishStoryContext } from '@/lib/ask/storyContextStore';
import { dashboardContext } from '@/lib/ask/dashboardContext';
import { askContextRefOf } from '@/lib/ask/askContextRef';
import { askRecordStrings, dashboardModuleContext } from '@/lib/ask/askModuleRef';
import { resolveAskStrings, type AskLocale } from '@/lib/ask/askStrings';
import { askR2Strings } from '@/lib/ask/askR2Strings';
import { askR2View } from '@/lib/ask/askR2View';
import {
  sanitizeReturnPath,
  useAskR2Conversation,
  type AskR2Turn,
} from '@/lib/ask/useAskR2Conversation';
import { askR2PayloadOf, askV2Api } from '@/lib/api/askV2Api';
import { revokeAnalysisConsent } from '@/lib/analysis/analysisComputeConsent';
import { ASK_SIGN_IN_HREF, keepQuestion, readKeptQuestion } from '@/lib/ask/askKeptQuestion';
import { authReturnNotice, type GuestNotice } from '@/lib/ask/askGuestTrial';
import type { AskShellMenuControl } from '@/lib/ask/askShellMenu';
import { localisedCountryName } from '@/lib/map/geography/displayName';
import { LoadingStages } from '@/components/search/LoadingStages';
import { AskR2TurnView } from './AskR2TurnView';
import { AskSourcesColumn } from './AskSourcesColumn';
import { AskDeepConfirm } from './AskDeepConfirm';
import { ASK_EYEBROW, Composer, QuestionsWorthAsking } from './AskParts';
import styles from './askDashboard.module.css';

/**
 * ASK R2 CLAUDE DESIGN RECONCILIATION R1 — /ask AS THE FROZEN D25 AUTHORITY DRAWS IT.
 *
 *   Authority: GNAI_ASK_INTELLIGENCE_WORKSPACE_R2_FINAL_DESIGN_AUTHORITY_D25
 *   (SHA256 4ca6c22d…ed53). It supersedes the v1.8 map-first dashboard for this route: no
 *   map, no Explore/Question/Answer/Full-map controls, no Situation context, Watch or
 *   Recent alerts on /ask. Ask beside the Map belongs to /map (float 440 · rail 372; 460
 *   pane at 1024 — D26) and is unchanged here.
 *
 *   ≥1280 — one centred column (760 idle; with a question 1100, 1280 at 1920) = thread +
 *   Sources column 340 (400 at 1920), gap 28. 1024 landscape — single 760 column, sources
 *   inline (D25 12). PHONE AND 768 PORTRAIT ARE FULL SCREEN (D25 11: "PHONE MAP MAY BE
 *   PARTIAL. PHONE ASK MAY NOT."): header 56 · context strip 44 · full-width conversation ·
 *   composer on the safe area. One scroll area; the composer is persistent everywhere.
 *
 *   ASK R2 FIRST, EXISTING ASK AS ROLLBACK (§8). A Send goes to Ask V2; if the server says
 *   Ask V2 is off (404, the default) or the reader is signed out (401), that question goes
 *   down the existing /analysis path instead. Opening, focusing and typing request nothing.
 *
 *   `?operation=<id>` is the "Open full analysis" target: a display-only read of a stored
 *   Ask V2 operation — 0 AI · 0 provider · no compute (§15). `?return=<path>` is the return
 *   destination captured at departure (§16), never derived from the answer.
 */
const FULL_SCREEN_QUERY = '(max-width: 860px), (orientation: portrait) and (max-width: 1100px)';

/**
 * STANDALONE ASK SHELL — `shellMenu` IS DATA, NOT A SLOT.
 *
 * It carries a state flag, two localized labels and a callback; this component
 * renders the control itself, so the composition of the frozen D25 header stays
 * decided here. See lib/ask/askShellMenu.ts for why the earlier generic
 * `navSlot?: React.ReactNode` was refused.
 *
 * IT REPLACES THE LEFT CONTROL, IT DOES NOT ADD ONE — and only when there is no
 * governed return destination, where "Close" would dismiss a standalone
 * application to nowhere. With a real `return` destination the ruled Back/Close
 * behaviour is untouched and no navigation is invented. Header height 56,
 * centred title and the right-hand state readout are unchanged in both cases,
 * and omitting the prop renders this header exactly as it renders today.
 */
export function AskFrameScreen({
  locale,
  shellMenu,
}: {
  readonly locale: AskLocale;
  readonly shellMenu?: AskShellMenuControl;
}): JSX.Element {
  const params = useSearchParams();
  const urlKey = params.toString();
  const incoming = useMemo(() => dashboardContext(new URLSearchParams(urlKey)), [urlKey]);
  const [contextOverride, setContextOverride] = useState<{ key: string; context?: StoryContext }>();
  const context = contextOverride?.key === urlKey ? contextOverride.context : incoming;
  usePublishStoryContext(context);
  /*
    UNIFIED INTELLIGENCE BINDING R2F — a dashboard record ("Ask about this record"). It is the
    more specific anchor, so while it is present it is what this screen shows AND sends; removing
    its chip returns the screen to the story/country context (or none). Arrival runs nothing.
  */
  const incomingModule = useMemo(() => dashboardModuleContext(new URLSearchParams(urlKey)), [urlKey]);
  const [moduleRemovedFor, setModuleRemovedFor] = useState<string>();
  const moduleContext = moduleRemovedFor === urlKey ? undefined : incomingModule;
  const [question, setQuestion] = useState(params.get('q') ?? '');
  const [compact, setCompact] = useState(false);
  const reader = useRef<HTMLDivElement>(null);
  const layout = useRef<HTMLDivElement>(null);
  const t = resolveAskStrings(locale).strings;
  /* Ask V2 serves the two ACTIVE languages; any other locale reads and renders as English. */
  const r2Locale: 'en' | 'pl' = locale === 'pl' ? 'pl' : 'en';
  const r2s = askR2Strings(r2Locale);
  const dict = getDictionary(locale);
  /*
    UNIFIED INTELLIGENCE BINDING R2C — ONE ENGINE. The legacy news-analysis conversation that
    used to run here when Ask V2 answered 404 is retired: Ask V2 unavailable is a truthful
    "unavailable" state with the question kept, never a second engine (POST /analysis/news).
  */
  const [askUnavailable, setAskUnavailable] = useState(false);
  const returnPath = sanitizeReturnPath(params.get('return'));
  const r2 = useAskR2Conversation(r2Locale, returnPath, { guestTrial: true });
  const { continueThread, setGuestNotice } = r2;
  /* ASK GUEST TRIAL R3 — the server says a first-visit guest may ask; the client only mirrors it. */
  const guestMode = r2.guestMode;
  const guestRemaining = r2.guest?.remaining ?? r2.guest?.allowance ?? 3;
  const guestExhausted =
    guestMode && (r2.guest?.state === 'EXHAUSTED' || r2.guestNotice === 'EXHAUSTED');
  const g = r2s.guest;
  const noticeText: Partial<Record<GuestNotice, string>> = {
    IN_PROGRESS: g.inProgress,
    COOLDOWN: g.cooldown,
    LIMITED: g.limited,
    ATTEMPTS_EXHAUSTED: g.attemptsExhausted,
    UNAVAILABLE: g.unavailable,
    DEEPER: g.signInForDeeper,
    CANCELLED: g.cancelled,
    FAILED: g.failed,
    RESUMED: g.resumed,
  };
  const notice = r2.guestNotice !== null ? (noticeText[r2.guestNotice] ?? null) : null;
  const operationId = params.get('operation');
  const [opened, setOpened] = useState<AskR2Turn | null>(null);
  const lastR2 = r2.turns[r2.turns.length - 1] ?? opened ?? undefined;
  const lastR2View =
    lastR2?.payload != null
      ? askR2View(
          lastR2.payload,
          r2s,
          r2Locale,
          (iso) => localisedCountryName(iso, r2Locale) ?? iso,
        )
      : null;
  const showR2 = r2.availability === 'r2' || opened !== null;
  const isPending = r2.pending !== null;
  const hasQuestion =
    r2.turns.length > 0 ||
    opened !== null ||
    isPending ||
    r2.signInRequired !== null;
  /* D25 01 region 4 — the Sources column carries the latest R2 turn's own sources. */
  const withSourcesColumn = showR2 && lastR2?.payload != null;

  useEffect(() => {
    setQuestion(new URLSearchParams(urlKey).get('q') ?? '');
  }, [urlKey]);
  /*
    SIGNED-OUT FALLBACK REMOVAL R1 — back from sign-in, the kept question returns to the
    composer as a DRAFT. It is read once and removed; nothing is sent until the reader
    presses Ask. A `q` or `operation` in the URL wins over it.
  */
  useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    if (url.has('q') || url.has('operation')) return;
    const kept = readKeptQuestion();
    if (kept !== null) setQuestion(kept);
  }, []);
  /* ASK GUEST TRIAL R3 — back from a cancelled/failed guest-continuation sign-in: say so. */
  useEffect(() => {
    const back = authReturnNotice(window.location.search);
    if (back !== null) setGuestNotice(back);
  }, [setGuestNotice]);
  /* "Open full analysis": ONE display-only read of the stored operation. No AI, no provider. */
  useEffect(() => {
    if (operationId === null) return;
    /* GATE H (H-T12 / H-G4) — an operation arrival is a READ. It revokes any pending
       analysis grant, so no later arrival can spend a grant this navigation did not make. */
    revokeAnalysisConsent();
    let live = true;
    void askV2Api
      .operation(operationId)
      /* ASK GUEST TRIAL R3 — a guest reopens its own operation through the guest surface. */
      .then((read) =>
        !read.ok && read.reason === 'SIGNED_OUT' ? askV2Api.guestOperation(operationId) : read,
      )
      .then((read) => {
        if (!live) return;
        /* ALPHA VISUAL ACCEPTANCE REPAIR R1 (E) — a follow-up continues the reopened thread. */
        if (read.ok && read.value.threadId && read.value.language) {
          continueThread(read.value.threadId, read.value.language);
        }
        setOpened(
          read.ok
            ? {
                /* (C) the canonical question this result answered, from its own turn */
                question: read.value.question ?? '',
                operation: read.value,
                payload: askR2PayloadOf(read.value),
                expired: read.value.result?.expired === true,
              }
            : { question: '', failure: read.reason },
        );
      });
    return () => {
      live = false;
    };
  }, [operationId, continueThread]);
  useEffect(() => {
    const media = matchMedia(FULL_SCREEN_QUERY);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    /*
      ALPHA ENABLEMENT R1 (D-050/D-052) — the reader follows the CONVERSATION. With nothing
      asked yet it stays at its top: scrolling an empty workspace to its bottom cut the
      opening lines off under the pane title (seen at 1024×768 under the 53 px site header).
    */
    const empty = r2.turns.length === 0 && r2.pending === null;
    if (reader.current && !empty) reader.current.scrollTop = reader.current.scrollHeight;
  }, [r2.turns, r2.pending]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const node = layout.current;
      if (node) {
        /* Full-screen phone / 768 only: the keyboard-aware height. Desktop needs no
           measurement — the page column sizes the frame (composer clipping fix R1). */
        node.style.setProperty(
          '--ask-visible-height',
          `${viewport?.height ?? window.innerHeight}px`,
        );
      }
    };
    update();
    viewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  async function ask() {
    if (isPending || !question.trim()) return;
    const draft = question;
    setQuestion('');
    /*
      Ask R2 first; the existing Ask is the rollback path ONLY when Ask V2 is disabled. A
      signed-out reader is asked to sign in: the question goes back into the composer and
      is sent nowhere — never down the legacy news-analysis path.
    */
    /*
      UNIFIED INTELLIGENCE BINDING R2C — the context this screen SHOWS is the context it SENDS:
      the same published story/country, as a bounded reference the server resolves. A context
      the server cannot resolve runs nothing and keeps the draft (never a silent generic Ask).
    */
    setAskUnavailable(false);
    const outcome = await r2.submit(draft, moduleContext?.ref ?? askContextRefOf(context, undefined));
    if (outcome === 'context-unavailable') setQuestion(draft);
    else if (outcome === 'legacy') {
      setAskUnavailable(true);
      setQuestion(draft);
    }
    else if (outcome === 'signed-out') setQuestion(draft);
    /* ASK GUEST TRIAL R3 — a guest refusal (exhausted, cooldown, busy) keeps the draft too; nothing ran. */
    else if (outcome === 'kept') setQuestion(draft);
  }
  /* Back / Close: the captured return destination, else the previous page, else Home. */
  /* ALPHA VISUAL ACCEPTANCE REPAIR R1 (F) — a clarification's draft goes to the composer; nothing is sent. */
  function draftQuestion(draft: string) {
    setQuestion(draft);
    requestAnimationFrame(() =>
      document.querySelector<HTMLTextAreaElement>('[data-ask="composer-input"]')?.focus(),
    );
  }
  function leave() {
    if (returnPath !== null) {
      window.location.assign(returnPath);
      return;
    }
    if (window.history.length > 1) window.history.back();
    else window.location.assign('/');
  }
  const returnsToMap = returnPath?.startsWith('/map') ?? false;
  /* D25 01 region 3 — earlier turns collapse; each opens in place to its full answer. */
  const earlierR2 = r2.turns.slice(0, -1);
  const latestR2 = r2.turns[r2.turns.length - 1];

  return (
    <main
      ref={layout}
      data-ask="frame-screen"
      data-ask-surface
      data-ask-path={showR2 ? 'r2' : r2.availability === 'legacy' ? 'legacy' : 'unknown'}
      data-ask-phase={isPending ? 'loading' : hasQuestion ? 'answered' : 'idle'}
      data-ask-sources-column={withSourcesColumn ? 'true' : undefined}
      className={styles.frame}
    >
      {/* PHONE / 768 PORTRAIT — header 56 (D25 11). Hidden by CSS on wider layouts. */}
      <header data-ask="header" className={styles.phoneHeader}>
        {/*
          THE LEFT SLOT. One control, 44x44, in the position D25 draws it. Which
          control it is depends on whether this reader has somewhere governed to
          go back to — never on styling, and never on both being present.
        */}
        {returnPath === null && shellMenu !== undefined ? (
          <button
            type="button"
            data-ask="shell-menu"
            aria-label={shellMenu.open ? shellMenu.closeLabel : shellMenu.openLabel}
            aria-expanded={shellMenu.open}
            onClick={shellMenu.onToggle}
            className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-[4px] text-[#cfe2f2]"
          >
            <span aria-hidden="true" className="block h-[2px] w-[18px] rounded-sm bg-current" />
            <span aria-hidden="true" className="block h-[2px] w-[18px] rounded-sm bg-current" />
            <span aria-hidden="true" className="block h-[2px] w-[18px] rounded-sm bg-current" />
          </button>
        ) : (
          <button
            type="button"
            data-ask={returnsToMap ? 'back' : 'close'}
            aria-label={returnsToMap ? r2s.returnMap : r2s.close}
            onClick={leave}
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-[20px] text-[#cfe2f2]"
          >
            {returnsToMap ? '←' : '×'}
          </button>
        )}
        <h1 className="flex-1 truncate text-center text-[16px] font-bold">{r2s.askTitle}</h1>
        <span
          data-ask="header-state"
          className="min-w-11 text-end font-mono text-[11px] leading-tight text-[#8fa6c0]"
        >
          {lastR2View !== null ? r2s.sourcesLabel(lastR2View.sourceCount) : ''}
        </span>
      </header>
      {/* PHONE / 768 PORTRAIT — context strip 44, chips from the plan only (D25 05, 11). */}
      {(returnsToMap || lastR2View !== null) && (
        <div data-ask="context-strip" className={styles.phoneStrip}>
          {returnsToMap && (
            <button
              type="button"
              data-ask="return-to-map"
              onClick={leave}
              className="shrink-0 rounded-full border border-dashed border-[#1d4a73] px-2.5 py-1 text-[#93cdf5]"
            >
              {r2s.returnMap}
            </button>
          )}
          {lastR2View !== null &&
            lastR2View.chips.items.map((chip, i) => (
              <span
                key={`${chip.kind}-${i}`}
                className="shrink-0 rounded-full border border-[#1d4a73] bg-[#06223d] px-2.5 py-1 text-[#cfe2f2]"
              >
                {chip.label}
              </span>
            ))}
          {lastR2View?.chips.note != null && (
            <span className="shrink-0 text-[#8fa6c0]">{lastR2View.chips.note}</span>
          )}
        </div>
      )}

      <div ref={reader} data-ask="reader" className={styles.reader} aria-live="polite">
        <div className={styles.grid}>
          <div data-ask="thread" className={styles.thread}>
            {moduleContext && (
              <div data-ask="context" data-ask-context-kind="MODULE" className={styles.contextChip}>
                <span className="truncate">
                  {moduleContext.label || askRecordStrings(r2Locale).moduleRecord[moduleContext.ref.module]}
                </span>
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center"
                  aria-label={t.controls.removeContext}
                  onClick={() => setModuleRemovedFor(urlKey)}
                >
                  ×
                </button>
              </div>
            )}
            {!moduleContext && context && (
              <div data-ask="context" className={styles.contextChip}>
                <span className="truncate">{context.title}</span>
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center"
                  aria-label={t.controls.removeContext}
                  onClick={() => setContextOverride({ key: urlKey })}
                >
                  ×
                </button>
              </div>
            )}
            {!hasQuestion && (
              <section data-ask="empty" className={styles.empty}>
                <p className="font-mono text-[12px] font-semibold uppercase leading-none tracking-[0.1em] text-[#5abff5]">
                  {t.frameLabel}
                </p>
                <h1 className={styles.emptyTitle}>{dict.askAi.inputPlaceholder}</h1>
                <p className={styles.emptyLead}>{t.metaDescription}</p>
                {guestMode && (
                  /* ASK GUEST TRIAL R3 — restrained, factual; sign-in stays optional. */
                  <div data-ask="guest-intro" className="mt-1 flex flex-col gap-1">
                    <p className="text-[15px] font-semibold text-[#cfe2f2]">{g.intro}</p>
                    <p className="text-[12.5px] leading-[1.45] text-[#8fa6c0]">{g.privacy}</p>
                  </div>
                )}
                <QuestionsWorthAsking
                  label={t.regions.suggestions}
                  statement={t.states.suggestionsUnavailable}
                />
              </section>
            )}
            {r2.signInRequired !== null && (
              /* SIGNED-OUT FALLBACK REMOVAL R1 — a sign-in requirement, never a reporting failure. */
              <section data-ask="sign-in-required" role="status" className="mb-6">
                <p className={ASK_EYEBROW}>{r2s.youAsked}</p>
                <h2 className={styles.question}>{r2.signInRequired}</h2>
                <div className="flex flex-col items-start gap-3 rounded-[12px] border border-[#2a6d9e] bg-[linear-gradient(#08263f,#051a2e)] p-3.5 md:p-5">
                  <span className="inline-flex h-[26px] items-center rounded-[6px] border border-[#2a6d9e] bg-[#0a2a47] px-2.5 font-mono text-[11px] font-bold tracking-[0.08em] text-[#bfe3fb]">
                    {r2s.signInRequired.title}
                  </span>
                  <p className="text-[16px] leading-[1.55] text-[#cfe2f2]">
                    {r2s.signInRequired.body}
                  </p>
                  <a
                    data-ask="sign-in"
                    href={ASK_SIGN_IN_HREF}
                    onClick={() =>
                      keepQuestion(question.trim() ? question : (r2.signInRequired ?? ''))
                    }
                    className="inline-flex min-h-[48px] items-center rounded-[10px] border border-[#1b6fa8] bg-[#0a6bd6] px-5 text-[15px] font-bold text-[#e6f5ff]"
                  >
                    {r2s.signInRequired.action}
                  </a>
                </div>
              </section>
            )}
            {opened !== null && (
              <div data-ask-latest={r2.turns.length === 0 ? '' : undefined}>
                <AskR2TurnView
                  canSave={!guestMode}
                  turn={opened}
                  locale={r2Locale}
                  context={context}
                  displayOnly
                  onUseQuestion={draftQuestion}
                />
              </div>
            )}
            {earlierR2.length > 0 && (
              <section
                data-ask="earlier"
                aria-label={r2s.earlier}
                className="mb-5 flex flex-col gap-2"
              >
                {earlierR2.map((turn, i) => (
                  <details key={`r2-${i}`} data-ask="earlier-turn" className={styles.earlier}>
                    <summary className="cursor-pointer list-none">
                      <span className={ASK_EYEBROW}>{r2s.earlier}</span>
                      <span className="mt-2 block text-[15px] font-bold leading-[1.3] text-[#e6eef6]">
                        {turn.question}
                      </span>
                    </summary>
                    <div className="mt-3">
                      <AskR2TurnView
                        canSave={!guestMode}
                        turn={turn}
                        locale={r2Locale}
                        context={context}
                        onRunDeeper={guestMode ? undefined : (q) => void r2.runDeeper(q)}
                      />
                    </div>
                  </details>
                ))}
              </section>
            )}
            {latestR2 !== undefined && (
              <div data-ask-latest="">
                <AskR2TurnView
                  canSave={!guestMode}
                  turn={latestR2}
                  locale={r2Locale}
                  context={context}
                  onRunDeeper={guestMode ? undefined : (q) => void r2.runDeeper(q)}
                  onUseQuestion={draftQuestion}
                />
                {guestMode && latestR2.uncounted === true && (
                  <p data-ask="guest-not-counted" className="mt-2 text-[13px] text-[#8fa6c0]">
                    {g.notCounted}
                  </p>
                )}
              </div>
            )}
            {guestExhausted && (
              /*
                ASK GUEST TRIAL R3 — BELOW the full answer, never over it: every answer and
                citation stays readable. Sign-in continues THIS conversation; the unsent
                question waits in the composer and is not sent on return.
              */
              <section data-ask="guest-continue" role="status" className="mb-6 mt-2">
                <div className="flex flex-col items-start gap-3 rounded-[12px] border border-[#2a6d9e] bg-[linear-gradient(#08263f,#051a2e)] p-3.5 md:p-5">
                  <span className="inline-flex h-[26px] items-center rounded-[6px] border border-[#2a6d9e] bg-[#0a2a47] px-2.5 font-mono text-[11px] font-bold tracking-[0.08em] text-[#bfe3fb]">
                    {g.exhaustedTitle}
                  </span>
                  <p className="text-[16px] leading-[1.55] text-[#cfe2f2]">{g.exhaustedBody}</p>
                  <button
                    type="button"
                    data-ask="guest-sign-in"
                    onClick={() => void r2.continueWithSignIn(question)}
                    className="inline-flex min-h-[48px] items-center rounded-[10px] border border-[#1b6fa8] bg-[#0a6bd6] px-5 text-[15px] font-bold text-[#e6f5ff]"
                  >
                    {g.continueAction}
                  </button>
                </div>
              </section>
            )}
            {isPending && (
              <section data-ask="pending" className="mb-5">
                <p className={ASK_EYEBROW}>{r2s.youAsked}</p>
                <h2 className={styles.question}>{r2.pending}</h2>
                <LoadingStages stages={dict.loadingStages} />
              </section>
            )}
          </div>
          {withSourcesColumn && (
            <div className={styles.sourcesColumn}>
              <AskSourcesColumn turn={lastR2} locale={r2Locale} />
            </div>
          )}
        </div>
      </div>

      <div data-ask="composer-footer" className={styles.composerBar}>
        {askUnavailable && (
          <p
            data-ask="ask-unavailable"
            role="status"
            className="mx-auto mb-2 max-w-[760px] px-4 md:px-1 text-[13px] leading-[1.45] text-[#c9b27a]"
          >
            {r2s.unified.askUnavailable}
          </p>
        )}
        {r2.contextRefused !== null && (
          <p
            data-ask="context-unavailable"
            role="status"
            className="mx-auto mb-2 max-w-[760px] px-4 md:px-1 text-[13px] leading-[1.45] text-[#c9b27a]"
          >
            {r2s.unified.contextUnavailable}
          </p>
        )}
        {notice !== null && (
          <p
            data-ask="guest-notice"
            role="status"
            className="mx-auto mb-2 max-w-[760px] px-4 md:px-1 text-[13px] leading-[1.45] text-[#c9b27a]"
          >
            {notice}
          </p>
        )}
        {guestMode && (
          /* ASK GUEST TRIAL R3 — the server-authoritative counter; sign-in stays voluntary. */
          <div
            data-ask="guest-counter"
            className="mx-auto mb-2 flex max-w-[760px] items-center justify-between gap-3 px-4 md:px-1 text-[12.5px] text-[#8fa6c0]"
          >
            <span>{g.remaining(guestRemaining)}</span>
            <button
              type="button"
              data-ask="guest-sign-in-optional"
              onClick={() => void r2.continueWithSignIn(question)}
              className="inline-flex min-h-11 items-center px-2 font-semibold text-[#93cdf5] underline-offset-2 hover:underline"
            >
              {g.signInOptional}
            </button>
          </div>
        )}
        <div className={styles.composerGrid}>
          <Composer
            value={question}
            onChange={setQuestion}
            inputLabel={dict.askAi.inputLabel}
            placeholder={dict.askAi.inputPlaceholder}
            submitLabel={dict.askAi.submit}
            costNote={t.states.costNotConfigured}
            onSubmit={() => void ask()}
            pending={isPending}
            maxHeight={compact ? 140 : 220}
          />
        </div>
      </div>
      {r2.deepQuote !== null && (
        <AskDeepConfirm
          locale={r2Locale}
          onConfirm={() => void r2.confirmDeeper()}
          onCancel={() => void r2.cancelDeeper()}
        />
      )}
    </main>
  );
}
