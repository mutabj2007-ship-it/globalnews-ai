'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import type { AnalysisApiResponse, LanguageCode, StoryContext } from '@globalnews-ai/shared';
import { analyzeNews } from '@/lib/api/analysisApi';
import { LoadingStages } from '@/components/search/LoadingStages';
import { resolveAnalysisErrorMessage } from '@/components/search/SearchPageClient';
import { AskCompactResult } from '@/components/ask/AskCompactResult';
import { COMPACT_TOP_PX } from '@/components/ask/launcherAnchor';
import { mapAskLayoutFor, mapAskPanelStyle, type MapAskLayout } from '@/lib/ask/mapAskGeometry';
import { dashboardHref } from '@/lib/ask/dashboardContext';
import { ASK_CANONICAL_ROUTE } from '@/lib/ask/askFrame';
import { useLauncherAnchor } from '@/components/ask/useLauncherAnchor';
import { usesStoryContextLabel } from '@/lib/ask/turnContext';
import { transportableContext, useAskStoryContext } from '@/lib/ask/storyContextStore';
import { useAskGeographyContext } from '@/lib/ask/geographyContextStore';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { AdaptiveTextarea } from '@/components/ui/AdaptiveTextarea';
import { GLOBAL_ASK_OPEN_EVENT, type GlobalAskOpenDetail } from '@/lib/ask/openGlobalAsk';
import { mapGeographyChipShown } from '@/lib/ask/effectiveContext';

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
  | {
      kind: 'answered';
      question: string;
      response: AnalysisApiResponse;
      context: StoryContext | undefined;
    }
  | { kind: 'failed'; question: string; message: string };

type SettledAskTurn = Extract<AskPhase, { kind: 'answered' | 'failed' }>;

/**
 * TOPIC CONTINUITY R1 — kept OUTSIDE the submit path on purpose: the only
 * thing read from a response is whether the backend continued a subject, and
 * the only thing returned is a question the READER typed (the one sent as
 * priorQuestion). No answer text, source or evidence identity crosses here.
 */
function subjectOriginOf(response: AnalysisApiResponse, sentPrior: string | undefined): string | undefined {
  return response.retrievalContext.conversationSubject !== undefined ? sentPrior : undefined;
}

interface AskAiDockProps {
  language?: LanguageCode;
}

/**
 * MY INTELLIGENCE R1.2 — the one route that suppresses the FLOATING LAUNCHER
 * and nothing else.
 *
 * ── THE COLLISION, MEASURED ──────────────────────────────────────────────
 *
 * At 390 the launcher is `position: fixed`, 92x44 at top 92 / right 16. The
 * frozen My Intelligence Select control is 68x44 at top 73 / right 16. They
 * overlap by 25px vertically and completely horizontally, and the launcher — a
 * later, global addition the frozen R1.2 frames were drawn without — wins.
 *
 * The Product Owner froze the Select placement, so the launcher yields.
 *
 * ── WHAT IS SUPPRESSED, AND WHAT EMPHATICALLY IS NOT ─────────────────────
 *
 * ONLY the standalone floating button. The dock itself stays mounted and stays
 * listening, so everything that opens it by intent keeps working:
 *
 *   - `openGlobalAsk()` and the GLOBAL_ASK_OPEN_EVENT still open the panel;
 *   - "Ask about selected" still hands off to it with the selection attached;
 *   - every explicit Ask / Send / Run still runs;
 *   - "Ask AI" in the header and the bottom navigation still navigate;
 *   - every OTHER route keeps the launcher exactly as it was.
 *
 * This is narrower than the `/ask` case above, which unmounts the dock
 * entirely because that route owns its own composer. Here the dock is still
 * the right surface; it simply must not also advertise itself on top of a
 * frozen control that already offers the same journey.
 */
/*
 * HOME WELCOME & DISCOVERY R1 REV A — Home joins the list. Rev A's IA ruling:
 * the secondary Ask on Home is the compact HEADER launcher once the Hero
 * composer scrolls out (desktop, D2), and phone uses the existing Ask AI tab —
 * "no floating button". Exactly as for My Intelligence, only the floating
 * button yields: the Hero composer's staging still opens this dock.
 */
const LAUNCHER_SUPPRESSED_ROUTES: ReadonlySet<string> = new Set(['/my-intelligence', '/']);

/**
 * ═══ MAP / SPATIAL VISUAL CONVERGENCE R2 — ASK ON THE MAP ══════════════════
 *
 * MEASURED on the Product Owner's iPhone: opening Ask on /map raised the
 * generic 86dvh phone sheet, which left the map as a strip under the HUD —
 * the country the reader was asking about disappeared behind the question.
 *
 * On /map ONLY, the SAME dock (same state, same submit, same transport, same
 * zero-request open/focus/type) takes the Spatial Ask geometry of the Map R1
 * authority ("Ask on the Map"):
 *
 *   phone  <861    a composer sheet above the bottom nav (or the keyboard),
 *                  sized to its content and capped so the map keeps its ≥26%
 *                  floor under the 82px HUD — the Map sheet's own rule;
 *   861–1279       the contextual rail column: Ask is intelligence, and the
 *                  rail is where intelligence lives, so the map stays whole;
 *   ≥1280          a 440px panel beside the 372px rail, bottom-aligned.
 *
 * The numbers live in `lib/ask/mapAskGeometry`. Every other route renders
 * exactly as before; `/ask` still unmounts the dock.
 */
const MAP_ROUTE = '/map';

export function AskAiDock(props: AskAiDockProps): JSX.Element | null {
  const pathname = usePathname();
  // The dedicated dashboard owns its composer; unmount the global dock entirely.
  if (pathname === ASK_CANONICAL_ROUTE) return null;
  return (
    <GlobalAskAiDock
      {...props}
      showLauncher={!LAUNCHER_SUPPRESSED_ROUTES.has(pathname ?? '')}
      mapSurface={pathname === MAP_ROUTE}
    />
  );
}

function GlobalAskAiDock({
  language = 'en',
  showLauncher = true,
  mapSurface = false,
}: AskAiDockProps & { showLauncher?: boolean; mapSurface?: boolean }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<AskPhase>({ kind: 'idle' });
  const [history, setHistory] = useState<SettledAskTurn[]>([]);
  /* TOPIC CONTINUITY R1 — the reader dropped the continued subject; the next Send carries no prior question. */
  const [topicReset, setTopicReset] = useState(false);
  /*
    TOPIC CONTINUITY R1 — USER TEXT ONLY: the reader's own earlier question
    that established the subject the LAST settled answer continued. Undefined
    when it continued nothing, so the next follow-up refers to that question.
  */
  const [subjectOrigin, setSubjectOrigin] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  /* MAP R2 — the Spatial Ask geometry, measured only on /map (see MAP_ROUTE). */
  const [mapLayout, setMapLayout] = useState<MapAskLayout | null>(null);
  const [mapViewport, setMapViewport] = useState<{ height: number; navInset: number }>({ height: 0, navInset: 0 });
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
   * MAP R1 item 7 — THE SCOPE, WHICH IS NOT AN ANCHOR.
   *
   * Published by the Map from its own bounded store while a country is
   * selected: an ISO code and a label, nothing else. Read live here for the
   * same reason the story context is — the dock keeps no copy, so what the
   * reader is shown is always what is published at that moment.
   *
   * PRECEDENCE IS STATED, NOT EMERGENT. A story anchor is the more specific
   * fact, so when one exists it wins and the geography line is not shown. The
   * two are never merged and never silently combined into one claim.
   */
  const geographyContext = useAskGeographyContext();
  /*
   * ASK R2 INTEGRATION R1 · G SEAM D — the chip reads WHAT SCOPED THE ANSWER, not
   * which store is occupied. While drafting, the country on offer is shown; once
   * answered, only a Map country the server says it USED is named. "What is NATO?"
   * with Poland selected is answered without Poland, and the chip no longer says
   * otherwise.
   */
  const showGeographyLabel = mapGeographyChipShown(
    question.trim() || phase.kind !== 'answered' ? 'draft' : 'answered',
    phase.kind === 'answered' ? phase.response.retrievalContext : {},
    {
      storyContextPresent: storyContext !== undefined,
      geographyContextPresent: geographyContext !== undefined,
    },
  );
  const showStoryLabel = storyContext !== undefined && usesStoryContextLabel(
    question.trim() || (phase.kind !== 'idle' ? phase.question : ''),
    question.trim() ? undefined : phase.kind === 'answered'
      ? phase.response.retrievalContext.storyContextUsed : undefined,
  );

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
  const { anchor, bottomOffset, coveredByDialog } = useLauncherAnchor();

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  /*
   * HOME ASK LAUNCH CONTRACT — in-place, zero spend.
   *
   * Home surfaces dispatch one document-local event carrying an optional draft.
   * Receiving it only opens this already-mounted dock and stages text. It does
   * not call analyzeNews(), submit a form, navigate, or mutate retrieval state.
   * The only analysis transport remains the explicit form submit below.
   */
  useEffect(() => {
    const openFromHome: EventListener = (event) => {
      const custom = event as CustomEvent<GlobalAskOpenDetail>;
      if (typeof custom.detail?.question === 'string') {
        setQuestion(custom.detail.question);
      }
      setIsOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    };

    window.addEventListener(GLOBAL_ASK_OPEN_EVENT, openFromHome);
    return () => window.removeEventListener(GLOBAL_ASK_OPEN_EVENT, openFromHome);
  }, []);

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

  /*
   * MOBILE KEYBOARD — VisualViewport is the geometry the reader can
   * actually see after iOS Safari raises the software keyboard. 100dvh
   * alone continues to describe the layout viewport on affected Safari
   * versions, leaving the composer behind the keyboard.
   *
   * Lift the whole bottom sheet by the obscured viewport amount. The
   * conversation remains the only scroll region and the composer stays
   * structurally outside it.
   */
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.visualViewport) {
      setKeyboardInset(0);
      return undefined;
    }
    const viewport = window.visualViewport;
    const update = (): void => {
      const obscured = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      setKeyboardInset(obscured > 80 ? obscured : 0);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [isOpen]);

  /* MAP R2 — which Spatial Ask geometry this width takes. Width only; no request. */
  useEffect(() => {
    if (!mapSurface) {
      setMapLayout(null);
      return undefined;
    }
    const measure = (): void => setMapLayout(mapAskLayoutFor(window.innerWidth));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [mapSurface]);

  /*
    MAP R2 — the phone composer sits ON the Map's bottom nav while the nav is
    shown and on the keyboard while it is not, and never climbs past the map's
    floor. Both are read from the rendered page: the nav's real top edge (the
    Map shell hides it at FULL and while the keyboard is open) and the visual
    viewport. Presentation only — nothing here sends anything.
  */
  useEffect(() => {
    if (!isOpen || mapLayout !== 'compact') return undefined;
    let raf = 0;
    let late = 0;
    const read = (): void => {
      const nav = document.querySelector('[data-gn="map-bottom-nav"]:not([hidden]) nav');
      const top = nav?.getBoundingClientRect().top;
      setMapViewport({
        height: window.visualViewport?.height ?? window.innerHeight,
        navInset:
          top !== undefined && top < window.innerHeight ? Math.max(0, Math.round(window.innerHeight - top)) : 0,
      });
    };
    const measure = (): void => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(late);
      raf = window.requestAnimationFrame(read);
      /* the shell re-renders its nav after a focus change; read once more after it */
      late = window.setTimeout(read, 160);
    };
    measure();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', measure);
    window.addEventListener('resize', measure);
    document.addEventListener('focusin', measure);
    document.addEventListener('focusout', measure);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(late);
      viewport?.removeEventListener('resize', measure);
      window.removeEventListener('resize', measure);
      document.removeEventListener('focusin', measure);
      document.removeEventListener('focusout', measure);
    };
  }, [isOpen, mapLayout]);

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
      /* ASK/SEARCH R1 — one Send is one execution: a second submit while a
         turn is in flight (Enter/requestSubmit bypass the disabled button)
         must not issue a second request. */
      if (phase.kind === 'loading') return;

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
        ignores them. A conversational follow-up may additionally carry the
        immediately preceding USER question. It never carries the preceding
        AI answer, sources, evidence identities or retrieval output.
 
        `title` is the SUBJECT and comes from the published context — never
        from the input box (§1.3, §7.4). Passing the follow-up as the title
        is exactly the inversion Rev A's change log owns.
      */
      const sent = transportableContext(storyContext);
      /*
        TOPIC CONTINUITY R1 — still ONE prior USER question, never an answer.
        When the last answer continued a subject, the question that ESTABLISHED
        that subject is sent again, so a chain ("…this…" → "What about
        businesses?") keeps its subject. "Start a new topic" sends none.
      */
      const lastQuestion =
        phase.kind === 'answered' || phase.kind === 'failed'
          ? phase.question
          : history.length > 0
            ? history[history.length - 1].question
            : undefined;
      const priorQuestion = topicReset || lastQuestion === undefined ? undefined : (subjectOrigin ?? lastQuestion);
      setTopicReset(false);

      /*
        MAP MOBILE R1 CONVERGENCE — SUBMISSION PRECEDENCE, STATED:
          1. story context, when one is published (the more specific anchor);
          2. otherwise the map geography context, when one is published;
          3. otherwise a generic Ask.
        Never both. analyzeNews() narrows the geography to exactly
        { countryCode, displayName }; the chip's label is presentation only.
      */
      const sentGeography = sent === undefined ? geographyContext : undefined;

      analyzeNews(asked, language, sent, priorQuestion, undefined, sentGeography)
        .then((response) => {
          if (requestSeq.current !== seq) return;
          setSubjectOrigin(subjectOriginOf(response, priorQuestion));
          setPhase({ kind: 'answered', question: asked, response, context: sent });
        })
        .catch((error: unknown) => {
          if (requestSeq.current !== seq) return;
          setSubjectOrigin(undefined);
          /* the SAME error mapping /search uses, imported rather than copied */
          setPhase({
            kind: 'failed',
            question: asked,
            message: resolveAnalysisErrorMessage(error, dictionary),
          });
        });
    },
    [question, language, dictionary, storyContext, geographyContext, phase, history, topicReset, subjectOrigin],
  );

  /*
    MAP R2 — the panel geometry per Spatial Ask layout. `null` everywhere but
    /map, where the generic classes below are not used at all.
  */
  const onMap = mapLayout !== null;
  const mapPanelStyle: CSSProperties | undefined =
    mapLayout === null
      ? undefined
      : mapAskPanelStyle(mapLayout, {
          visualViewportHeight: mapViewport.height,
          navInset: mapViewport.navInset,
          keyboardInset,
        });
  const mapPanelClass =
    mapLayout === 'compact'
      ? 'fixed inset-x-0 z-50 flex flex-col overflow-hidden rounded-t-[16px] border border-b-0 border-[#3c2f7a] bg-[#04162b] shadow-[0_-12px_40px_rgba(0,0,0,.45)] [&_button[aria-pressed]]:h-11 [&_button[aria-pressed]]:w-11'
      : mapLayout === 'rail'
        ? 'fixed z-50 flex flex-col overflow-hidden border-s border-[#3c2f7a] bg-[#04162b] shadow-[-12px_0_32px_rgba(0,0,0,.35)]'
        : 'fixed z-50 flex flex-col overflow-hidden rounded-[14px] border border-[#3c2f7a] bg-[#04162b] shadow-2xl';

  return (
    <>
      {/* ── THE ENTRY CONTROL ───────────────────────────────────────────
          Mounted from the root layout as its own element, exactly like
          ServiceWorkerRegistrar. It does NOT enter the NavBar's released
          GN-CD item row: that geometry is accepted design, and Ask AI's own
          chrome/geometry reconciliation is still held.

          `showLauncher` is false on exactly the routes listed in
          LAUNCHER_SUPPRESSED_ROUTES. Only this button disappears — the panel
          below, the open event, the story context and every explicit action
          are untouched. */}
      {/* MAP R2 — on a phone Map the entry is the Map's own "Ask about {country}"
          chip (and the bottom nav's Ask AI); a second floating launcher would
          sit on the map the reader is using. */}
      {showLauncher && (
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
        style={{
          ...(anchor === 'top' ? { top: COMPACT_TOP_PX, bottom: 'auto' } : { bottom: bottomOffset }),
          visibility: coveredByDialog && !isOpen ? 'hidden' : undefined,
          /* MAP R2 — see the note above the gate: not displayed on the phone Map. */
          ...(mapLayout === 'compact' ? { display: 'none' } : {}),
        }}
        data-ask-anchor={anchor}
        className="fixed end-4 bottom-4 z-40 inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink-primary shadow-lg transition-colors spatial:bottom-4 spatial:top-auto hover:border-signal focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
      >
        <span aria-hidden="true" className="font-mono text-[11px] text-signal">◆</span>
        {t.launcher}
      </button>
      )}

      {!isOpen ? null : (
        <section
          id="ask-ai-panel"
          data-ask="panel"
          data-ask-phase={phase.kind}
          aria-label={t.panelLabel}
          data-ask-geometry={mapLayout === null ? 'dock' : `map-${mapLayout}`}
          style={mapPanelStyle ?? { bottom: keyboardInset > 0 ? `${keyboardInset}px` : undefined }}
          className={onMap ? mapPanelClass : [
            'fixed z-50 flex flex-col overflow-hidden border border-border-strong bg-surface-raised shadow-2xl',
            /* MOBILE — a bottom sheet. Full width, capped height, rounded top. */
            'inset-x-0 bottom-0 h-[86dvh] max-h-[86dvh] rounded-t-2xl',
            /* TABLET and up — a bounded floating right-hand dock. */
            'sm:inset-y-4 sm:end-4 sm:start-auto sm:h-auto sm:w-[min(600px,92vw)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl',
            /* DESKTOP — a wider dock, so evidence and answer sit side by side. */
            'lg:w-[min(680px,46vw)]',
          ].join(' ')}
        >
          <header
            className={
              onMap
                ? 'flex items-center justify-between gap-3 border-b border-[#3c2f7a]/60 px-4 py-2'
                : 'flex items-center justify-between gap-3 border-b border-border bg-surface-raised/95 px-4 py-3 backdrop-blur'
            }
          >
            <h2 className={onMap ? 'flex items-center gap-2 text-[15px] font-semibold text-[#ece8ff]' : 'font-display text-base font-medium text-ink-primary'}>
              {onMap ? <span aria-hidden="true" className="font-mono text-[11px] text-[#a78bfa]">◆</span> : null}
              <a data-ask="dashboard-entry" href={dashboardHref(question || (phase.kind !== 'idle' ? phase.question : ''), storyContext)}>{t.title} ↗</a>
            </h2>
            <button
              type="button"
              data-ask="close"
              onClick={() => setIsOpen(false)}
              className={onMap ? 'min-h-[44px] min-w-[44px] rounded-xl px-2 text-sm text-[#b8b2e6] hover:text-white' : 'min-h-[44px] rounded-xl px-3 text-sm text-ink-secondary hover:text-ink-primary'}
            >
              {t.close}
            </button>
          </header>

          <div
            ref={conversationRef}
            className={
              onMap
                ? `min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 ${phase.kind === 'idle' && history.length === 0 ? 'py-2' : 'py-4'}`
                : 'min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface px-4 py-4 sm:px-5 sm:py-5'
            }
            data-ask="body"
            data-ask-scroll="conversation"
          >
            {history.map((turn, index) => (
              <div key={`${index}-${turn.question}`} data-ask="history-turn" className="mb-6 flex flex-col gap-3 sm:gap-4">
                <div data-ask="user-message" className="ms-auto max-w-[88%] rounded-2xl rounded-br-md border border-signal/25 bg-signal/15 px-4 py-3 text-sm leading-relaxed text-ink-primary shadow-sm">
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
                <div data-ask="user-message" className="ms-auto max-w-[88%] rounded-2xl rounded-br-md border border-signal/25 bg-signal/15 px-4 py-3 text-sm leading-relaxed text-ink-primary shadow-sm">
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
                newTopicStarted={topicReset}
                onStartNewTopic={() => setTopicReset(true)}
              />
            ) : null}
          </div>

          {onMap ? (
            /*
              MAP R2 — THE SPATIAL COMPOSER (Map R1 "Ask on the Map"): the
              scope chip and its basis first, then the draft, then the compute
              line beside Send. The SAME form, the SAME `submit`, the SAME
              textarea id and the SAME context read — only the order and the
              skin differ. 16px type so a phone does not zoom on focus.
            */
            <div data-ask="composer" className="shrink-0 border-t border-[#3c2f7a]/60 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <form onSubmit={submit} data-ask="form" className="flex flex-col gap-[10px] px-[14px] py-[12px]">
                <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[4px]">
                  <span
                    data-ask="context-affordance"
                    data-ask-context={
                      showStoryLabel ? 'anchored' : showGeographyLabel ? 'geography' : 'generic'
                    }
                    title={showStoryLabel ? storyContext?.title : undefined}
                    className="inline-flex min-h-[32px] max-w-full items-center truncate rounded-full border border-[#1b6fa8] bg-[#07304f] px-[12px] text-[13px] font-semibold text-[#93cdf5]"
                  >
                    {showStoryLabel
                      ? t.contextChipAnchored
                      : showGeographyLabel
                        ? t.askingAboutGeography.replace('{place}', geographyContext?.displayName ?? '')
                        : t.contextChipGeneric}
                  </span>
                  {showGeographyLabel && (
                    <span data-ask="context-basis" className="text-[12px] text-[#8fa6c0]">
                      {t.geographyBasis}
                    </span>
                  )}
                </div>
                <label className="sr-only" htmlFor="ask-ai-question">
                  {t.inputLabel}
                </label>
                <AdaptiveTextarea
                  id="ask-ai-question"
                  ref={inputRef}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder={t.inputPlaceholder}
                  maxLength={1000}
                  minHeight={phase.kind === 'idle' && history.length === 0 ? 58 : 44}
                  maxHeight={220}
                  maxViewportFraction={0.3}
                  keepVisible={false}
                  className="w-full rounded-[10px] border border-[#3c2f7a] bg-[#12263f] px-[12px] py-[10px] text-[16px] leading-[1.45] text-[#eef2f8] placeholder:text-[#8fa6c0] focus:border-[#a78bfa] focus:outline-none"
                />
                <div className="flex items-center justify-between gap-[10px]">
                  <p data-ask="compute-notice" className="min-w-0 text-[12px] leading-[1.4] text-[#e5d2b0]">
                    <span aria-hidden="true" className="me-1 text-[#d9b98a]">ϟ</span>
                    {t.mapComputeNotice}
                  </p>
                  <button
                    type="submit"
                    data-ask="submit"
                    disabled={question.trim().length === 0 || phase.kind === 'loading'}
                    className="min-h-[44px] min-w-[96px] shrink-0 rounded-[10px] border border-[#d9b98a] bg-[linear-gradient(105deg,#412d9f,#1f328a)] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t.submit}
                  </button>
                </div>
              </form>
            </div>
          ) : (
          <div data-ask="composer" className="shrink-0 border-t border-border bg-surface-raised/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <form onSubmit={submit} data-ask="form" className="flex flex-col gap-2 px-4 py-3">
            <label className="sr-only" htmlFor="ask-ai-question">
              {t.inputLabel}
            </label>
            <AdaptiveTextarea
              id="ask-ai-question"
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t.inputPlaceholder}
              maxLength={1000}
              minHeight={phase.kind === 'idle' && history.length === 0 ? 58 : 44}
              maxHeight={420}
              maxViewportFraction={0.46}
              keepVisible={false}
              className="w-full rounded-2xl border border-border-strong bg-surface px-4 py-3 text-sm leading-6 text-ink-primary shadow-inner placeholder:text-ink-secondary/70 focus:border-signal focus:outline-none"
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
                data-ask-context={
                  showStoryLabel ? 'anchored' : showGeographyLabel ? 'geography' : 'generic'
                }
                title={showStoryLabel ? storyContext?.title : undefined}
                className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-border-strong bg-surface px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-secondary"
              >
                {/*
                  Three states, not two. "Asking about Algeria" names the SCOPE
                  and deliberately does not use the story wording: a country is
                  where the question is being asked, not what it is anchored to,
                  and telling a reader otherwise would be the merge the ruling
                  forbids.
                */}
                {showStoryLabel
                  ? t.contextChipAnchored
                  : showGeographyLabel
                    ? t.askingAboutGeography.replace(
                        '{place}',
                        geographyContext?.displayName ?? '',
                      )
                    : t.contextChipGeneric}
              </span>

              <button
                type="submit"
                data-ask="submit"
                disabled={question.trim().length === 0 || phase.kind === 'loading'}
                className="min-h-[44px] rounded-2xl bg-signal px-5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(61,111,255,0.22)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:shadow-none disabled:opacity-50"
              >
                {t.submit}
              </button>
            </div>
          </form>
          </div>
          )}
        </section>
      )}
    </>
  );
}
