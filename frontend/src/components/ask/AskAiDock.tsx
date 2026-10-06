'use client';

import {
  askLanguageDisposition,
  askLocaleForLegacyCatalogue,
  resolveAskLocale,
} from '@/lib/ask/askLocale';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import type { DisplayLocale, LanguageCode } from '@globalnews-ai/shared';
import { askDirectionProps } from '@/lib/ask/askDirection';
import { AskWorkingStatus } from '@/components/ask-frame/AskWorkingStatus';
import { AskEmblem } from '@/components/ask-frame/AskEmblem';
import { AskSourcesPanelProvider } from '@/components/ask-frame/AskSourcesPanel';
import { AskR2TurnView } from '@/components/ask-frame/AskR2TurnView';
import { COMPACT_TOP_PX } from '@/components/ask/launcherAnchor';
import { mapAskLayoutFor, mapAskPanelStyle, type MapAskLayout } from '@/lib/ask/mapAskGeometry';
import { dashboardHref } from '@/lib/ask/dashboardContext';
import { ASK_CANONICAL_ROUTE } from '@/lib/ask/askFrame';
import { ADMIN_ROUTES } from '@/lib/admin/adminRoutes';
import { useLauncherAnchor } from '@/components/ask/useLauncherAnchor';
import { useAskStoryContext } from '@/lib/ask/storyContextStore';
import { useAskGeographyContext } from '@/lib/ask/geographyContextStore';
import {
  sanitizeReturnPath,
  useAskR2Conversation,
  type AskR2Turn,
} from '@/lib/ask/useAskR2Conversation';
import { askContextKey, askContextRefOf } from '@/lib/ask/askContextRef';
import { askR2Strings } from '@/lib/ask/askR2Strings';
import { ASK_SIGN_IN_HREF, keepQuestion } from '@/lib/ask/askKeptQuestion';
import { localisedCountryName } from '@/lib/map/geography/displayName';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { AdaptiveTextarea } from '@/components/ui/AdaptiveTextarea';
import { GLOBAL_ASK_OPEN_EVENT, type GlobalAskOpenDetail } from '@/lib/ask/openGlobalAsk';
import { GLOBAL_ASK_SUBMIT_EVENT, type GlobalAskSubmitDetail } from '@/lib/ask/submitGlobalAsk';
import { useThemePreference } from '@/lib/theme/themeStore';
import { usePlatformGates } from '@/components/platform/PlatformGates';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';

/**
 * ═══ ASK AI — PHASE 1 ════════════════════════════════════════════════════
 *
 * A visible Ask AI surface over the Analysis engine that is ALREADY LIVE.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ─────────────────────────────────
 *
 * NO SECOND AI ENGINE. UNIFIED INTELLIGENCE BINDING R2C — every answer on this
 * surface is a CANONICAL Ask V2 operation (`useAskR2Conversation` → /ask-v2), in
 * an Ask thread: the same idempotency, switches, breaker, meter, guest allowance,
 * StoredResult, Recent/Saved and continuity as /ask. The legacy anonymous
 * `POST /analysis/news` transport is gone from the dock. This file contains no
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

interface AskAiDockProps {
  language?: LanguageCode;
  /**
   * STANDALONE PUBLIC BETA CONVERGENCE R1 — `/` is the standalone Ask (server-decided in the
   * layout). The root owns its composer, exactly as /ask does, so the dock unmounts there.
   */
  standaloneRoot?: boolean;
  /**
   * R4 · CTO DOCK-DIRECTION RULING — the reader's selected DisplayLocale (layout, resolveAskLocale).
   * `language` is the platform's two-catalogue code (an Arabic reader arrives here as 'en'), so
   * it cannot carry direction; the floating launcher takes the reader's direction from this.
   */
  displayLocale?: DisplayLocale;
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
/* COMPACT VISUAL PRODUCT R1 — '/visual' is the future '/', where the hero composer and the Ask tab replace the floating button. */
const LAUNCHER_SUPPRESSED_ROUTES: ReadonlySet<string> = new Set(['/my-intelligence', '/', '/visual']);

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

const ASK_STANDALONE_UTILITY_ROUTES: ReadonlySet<string> = new Set([
  '/support',
  '/account/settings',
]);

const ASK_CONTINUITY_ROUTES: ReadonlySet<string> = new Set([
  `${ASK_CANONICAL_ROUTE}/recent`,
  '/saved',
]);

/**
 * ADMIN OPERATIONS R1 — ALPHA FINISH. Admin is an operator console with its own
 * shell, not a reader surface. Measured on the Incident controls screen: the fixed
 * launcher sat over the "Last change" line and the confirm panel at 390, and over
 * the Advanced panel's right edge at 1440. Nothing under /admin opens the dock by
 * intent, so it unmounts there entirely — the screen used to pause AI answers does
 * not also carry a reader AI entry point. Every other route is unchanged.
 */
export function isAdminRoute(pathname: string | null): boolean {
  /* The Admin root comes from adminRoutes.ts, the only place an /admin path is written. */
  const root = ADMIN_ROUTES.overview;
  return pathname === root || (pathname?.startsWith(`${root}/`) ?? false);
}

export function AskAiDock(props: AskAiDockProps): JSX.Element | null {
  const pathname = usePathname();
  // The dedicated dashboard owns its composer; unmount the global dock entirely.
  if (pathname === ASK_CANONICAL_ROUTE) return null;
  if (isAdminRoute(pathname)) return null;
  if (props.standaloneRoot === true && pathname === '/') return null;
  /* STANDALONE CONTINUITY SHELL CLOSURE — Recent and Saved are standalone Ask surfaces
     whose "New question" already opens Ask, so the platform dock unmounts, as on /ask. */
  if (pathname !== null && ASK_CONTINUITY_ROUTES.has(pathname)) return null;
  /* ALPHA VISUAL ACCEPTANCE REPAIR R1 — standalone Help & feedback and Settings stay inside Ask. */
  if (
    props.standaloneRoot === true &&
    pathname !== null &&
    ASK_STANDALONE_UTILITY_ROUTES.has(pathname)
  ) {
    return null;
  }
  return (
    <GlobalAskAiDock
      language={props.language}
      {...(props.displayLocale === undefined ? {} : { displayLocale: props.displayLocale })}
      returnPath={pathname}
      showLauncher={!LAUNCHER_SUPPRESSED_ROUTES.has(pathname ?? '')}
      mapSurface={pathname === MAP_ROUTE}
    />
  );
}

function GlobalAskAiDock({
  language = 'en',
  showLauncher = true,
  mapSurface = false,
  returnPath = null,
  displayLocale,
}: AskAiDockProps & {
  showLauncher?: boolean;
  mapSurface?: boolean;
  returnPath?: string | null;
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  /* ASK R2 INTEGRATION R1 · D25 11 — the bottom navigation is hidden while Ask is active. */
  useEffect(() => {
    const body = typeof document === 'undefined' ? undefined : document.body;
    if (!isOpen || body === undefined) return undefined;
    body.dataset.askOpen = 'true';
    return () => {
      delete body.dataset.askOpen;
    };
  }, [isOpen]);
  /*
    ASK R2 INTEGRATION R1 · GATE H (G V8-C1) — below `lg` the dock is FULL SCREEN, so the
    device Back must close it and return to the page beneath (the Map, with its selection
    still in the URL) instead of leaving that page. While open full screen the dock owns
    ONE history entry; Next's own state is copied onto it so the App Router still treats
    both entries as its own. Back pops it (→ closed); closing any other way pops it too.
  */
  const overlayEntry = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.history?.pushState !== 'function') {
      return undefined;
    }
    const fullScreen =
      typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1023px)').matches;
    if (isOpen && fullScreen && !overlayEntry.current) {
      window.history.pushState({ ...(window.history.state ?? {}) }, '', window.location.href);
      overlayEntry.current = true;
    } else if (!isOpen && overlayEntry.current) {
      overlayEntry.current = false;
      window.history.back();
    }
    const onPop = (): void => {
      if (!overlayEntry.current) return;
      overlayEntry.current = false;
      setIsOpen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isOpen]);
  const [question, setQuestion] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  /* ASK RELIABILITY R1 (Q) — the visible box (top + height) of the visual viewport while the
     on-screen keyboard is open on a phone, so the full-screen panel fits exactly above it. */
  const [visibleBox, setVisibleBox] = useState<{ top: number; height: number } | null>(null);
  /* MAP R2 — the Spatial Ask geometry, measured only on /map (see MAP_ROUTE). */
  const [mapLayout, setMapLayout] = useState<MapAskLayout | null>(null);
  const [mapViewport, setMapViewport] = useState<{ height: number; navInset: number }>({ height: 0, navInset: 0 });

  const dictionary = getDictionary(language);
  const t = dictionary.askAi;
  /* R4 · SEVEN-LANGUAGE ASK FRONTEND — one disposition replaces the clamp this line was:
     `const r2Locale: 'en' | 'pl' = language === 'pl' ? 'pl' : 'en';`. The interface locale is
     the reader's own; the answer locale is the measured backend fact; the difference is
     carried end to end. lib/ask/askLocale.ts is the one place a locale is resolved. */
  const askDisposition = askLanguageDisposition(resolveAskLocale(language));
  const r2Locale = askDisposition.catalogueLocale;
  const r2s = askShellStrings(r2Locale).askR2Strings;

  /*
    UNIFIED INTELLIGENCE BINDING R2C — THE CANONICAL CONVERSATION.

    ZERO-REQUEST OPEN. The dock is mounted on every route, so the conversation reads nothing on
    mount (readOnOpen: false); opening, typing and staging send nothing. Only the explicit Send below creates an
    Ask V2 operation — signed-in through the account routes, signed-out through the existing
    guest trial — and nothing is ever sent to POST /analysis/news.
  */
  /*
    R4 · THE REQUEST CARRIES WHAT THE READER SELECTED, NOT WHAT THE CHROME RENDERS.

    `disposition.requested` is the reader's own locale, all seven. The EN/PL catalogues above
    still read `catalogueLocale`, because those catalogues have two entries — but the SERVER is
    told what was actually asked, so it answers in `fr` and records `fr` as `fr` instead of
    receiving an `en` the frontend invented. That is the whole point of the client pin.
  */
  const r2 = useAskR2Conversation(askDisposition.requested, sanitizeReturnPath(returnPath), {
    guestTrial: true,
    readOnOpen: false,
  });
  const { startNewTopic } = r2;
  /** Ask V2 answered "unavailable": nothing ran anywhere; the question is kept. */
  const [askUnavailable, setAskUnavailable] = useState(false);

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
   * MAP R1 item 7 — THE SCOPE, WHICH IS NOT AN ANCHOR. Published by the Map while a country is
   * selected: an ISO code and a label. PRECEDENCE IS STATED, NOT EMERGENT: a story anchor is
   * the more specific fact and wins; the two are never merged (askContextRefOf).
   */
  const geographyContext = useAskGeographyContext();
  /*
    R2C — what the NEXT Send carries, as the bounded reference the server resolves. The chip
    below is derived from this same value, so the label and the request cannot disagree.
  */
  const contextRef = askContextRefOf(storyContext, geographyContext);
  const contextKey = askContextKey(contextRef);
  /*
    ASK R2 INTEGRATION R1 · GATE H (G F3-C1 / F3-C3), now on the canonical thread — when the
    context changes (A→B, and A→B→A) the next question starts a NEW topic, so no earlier
    question continues across a story or country change. Earlier turns stay visible.
  */
  const contextSeen = useRef<string | null>(null);
  /* the reader is SHOWN that the thread ended (G F3-C2) — set on a context change or "New topic" */
  const [topicStarted, setTopicStarted] = useState(false);
  const hasTurns = r2.turns.length > 0;
  useEffect(() => {
    if (contextSeen.current !== null && contextSeen.current !== contextKey) {
      startNewTopic();
      if (hasTurns) setTopicStarted(true);
    }
    contextSeen.current = contextKey;
  }, [contextKey, startNewTopic, hasTurns]);
  /*
    G F3-C3 on the canonical thread — an answer whose context changed while it was in flight
    (A→B, and A→B→A) is not shown in this dock: it answered a question asked under a context the
    reader has since left. It is still a real, stored operation (Recent/Saved), never re-run.
  */
  const contextChanges = useRef(0);
  const lastKey = useRef(contextKey);
  if (lastKey.current !== contextKey) {
    lastKey.current = contextKey;
    contextChanges.current += 1;
  }
  const [staleTurns, setStaleTurns] = useState<ReadonlySet<AskR2Turn>>(() => new Set());
  const visibleTurns = r2.turns.filter((turn) => !staleTurns.has(turn));
  const showStoryLabel = contextRef?.kind === 'STORY';
  const showGeographyLabel = contextRef?.kind === 'GEOGRAPHY';
  const geographyPlace =
    contextRef?.kind === 'GEOGRAPHY'
      ? geographyContext !== undefined &&
        geographyContext.countryCode.toUpperCase() === contextRef.countryCode.toUpperCase()
        ? geographyContext.displayName
        : (localisedCountryName(
            contextRef.countryCode.toUpperCase(),
            /* `LanguageCode` boundary: the one declared crossing, not a cast. */
            askLocaleForLegacyCatalogue(r2Locale),
          ) ??
          contextRef.countryCode.toUpperCase())
      : '';
  const isPending = r2.pending !== null;
  const isIdle = visibleTurns.length === 0 && !isPending;
  /* ASK READING EXPERIENCE R1 — the emblem's ready/typing state: focus or text in the composer. */
  const [composerFocused, setComposerFocused] = useState(false);
  const guestText: Partial<Record<string, string>> = {
    IN_PROGRESS: r2s.guest.inProgress,
    COOLDOWN: r2s.guest.cooldown,
    LIMITED: r2s.guest.limited,
    ATTEMPTS_EXHAUSTED: r2s.guest.attemptsExhausted,
    UNAVAILABLE: r2s.guest.unavailable,
    DEEPER: r2s.guest.signInForDeeper,
    EXHAUSTED: r2s.guest.exhaustedBody,
  };
  const notice: string | null = askUnavailable
    ? r2s.unified.askUnavailable
    : r2.contextRefused !== null
      ? r2s.unified.contextUnavailable
      : r2.guestNotice !== null
        ? (guestText[r2.guestNotice] ?? null)
        : null;

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
  }, [isOpen, r2.turns, r2.pending]);

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
      /* ASK RELIABILITY R1 (Q) — iOS Safari overlays the keyboard and PANS the visual viewport
         (offsetTop > 0) to reveal the focused field. A panel that is inset:0 + 100dvh then keeps
         its composer under the keyboard and its header/close above the visible area. On phones the
         panel instead takes the visible box exactly: top = offsetTop, height = visible height. */
      const phone = window.innerWidth < 1024;
      setVisibleBox(
        phone && obscured > 80
          ? { top: Math.round(viewport.offsetTop), height: Math.round(viewport.height) }
          : null,
      );
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

  /*
    HOME R1 — EXPLICIT HOME SEND (presentation only). The platform Home composer's Send is the
    reader's explicit Ask: it stages the question in THIS dock, opens it, and submits THIS dock's
    own form — so the request is issued by the form handler below (R2's one transport site, with
    its context reference and its one-turn-per-Send guard), exactly as if the reader pressed Send
    here. No second transport, no context of its own; staging (openGlobalAsk) is unchanged.
  */
  const formRef = useRef<HTMLFormElement | null>(null);
  const [homeSendPending, setHomeSendPending] = useState(false);
  useEffect(() => {
    const onHomeSend: EventListener = (event) => {
      const asked = (event as CustomEvent<GlobalAskSubmitDetail>).detail?.question?.trim() ?? '';
      if (asked.length === 0) return;
      setQuestion(asked);
      setIsOpen(true);
      setHomeSendPending(true);
    };
    window.addEventListener(GLOBAL_ASK_SUBMIT_EVENT, onHomeSend);
    return () => window.removeEventListener(GLOBAL_ASK_SUBMIT_EVENT, onHomeSend);
  }, []);
  useEffect(() => {
    if (!homeSendPending || !isOpen || formRef.current === null) return;
    setHomeSendPending(false);
    formRef.current.requestSubmit();
  }, [homeSendPending, isOpen, question]);

  /* HOME R1 · DUAL THEME — the reader's Light / Dark / System choice for this panel (presentation),
     only where the platform Home R1 is released (GNA_HOME_R1). Elsewhere the dock keeps its native
     dark palette, byte for byte. */
  const themePreference = useThemePreference();
  const themed = usePlatformGates().homeR1;

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
      /* ASK/SEARCH R1 — one Send is one execution: a second submit while a turn is in flight
         (Enter/requestSubmit bypass the disabled button) must not issue a second request. */
      if (isPending) return;
      setQuestion('');
      setAskUnavailable(false);
      setTopicStarted(false);
      const askedUnder = contextChanges.current;
      /*
        THE ONE TRANSPORT SITE — the canonical Ask V2 turn, carrying THIS moment's context as a
        bounded reference (story by its persisted id, else the Map country; never both). The
        server resolves every fact; no title, answer, source or evidence is sent. Continuity is
        the Ask thread's own server-derived prior question.
      */
      void r2
        .submit(asked, contextRef, (turn) => {
          if (contextChanges.current !== askedUnder) {
            setStaleTurns((stale) => new Set(stale).add(turn));
          }
        })
        .then((outcome) => {
        if (outcome === 'sent' || outcome === 'failed') return;
        /* Nothing ran (sign-in, a guest refusal, an unresolvable context, Ask unavailable,
           busy): the reader's question returns to the composer — never re-sent elsewhere. */
        if (outcome === 'legacy') setAskUnavailable(true);
        setQuestion((current) => (current.trim().length === 0 ? asked : current));
        });
    },
    [question, isPending, r2, contextRef],
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
      ? /* D25 11 — FULL SCREEN on the phone Map (top edge to keyboard/bottom). */
        'fixed inset-x-0 z-50 flex flex-col overflow-hidden bg-[#04162b] [&_button[aria-pressed]]:h-11 [&_button[aria-pressed]]:w-11'
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
        /* R4 · direction only: the launcher follows the reader's display direction (Arabic RTL) */
        {...(displayLocale === undefined ? {} : askDirectionProps(displayLocale))}
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
          data-ask-surface=""
          data-ask-phase={isPending ? 'loading' : isIdle ? 'idle' : 'answered'}
          aria-label={t.panelLabel}
          data-ask-geometry={mapLayout === null ? 'dock' : `map-${mapLayout}`}
          data-ask-transport="r2"
          data-gna-theme={themed && mapLayout === null ? themePreference : undefined}
          style={
            mapPanelStyle ??
            (visibleBox !== null
              ? { top: `${visibleBox.top}px`, height: `${visibleBox.height}px`, maxHeight: `${visibleBox.height}px`, bottom: 'auto' }
              : { bottom: keyboardInset > 0 ? `${keyboardInset}px` : undefined })
          }
          className={onMap ? mapPanelClass : [
            'fixed z-50 flex flex-col overflow-hidden border border-border-strong bg-surface-raised shadow-2xl',
            /* PHONE and 768 PORTRAIT — FULL SCREEN (D25 11: "PHONE ASK MAY NOT" be partial).
               Was an 86dvh bottom sheet; D25 names that geometry as not permitted. */
            /* ASK RELIABILITY R1 (Q) — the home-indicator inset is applied ONCE, by the composer
               (it was also on this panel: ~68 px of empty strip once viewport-fit=cover made the
               inset real). */
            'inset-0 h-[100dvh] max-h-[100dvh] rounded-none',
            /* 1024 and up — a bounded floating right-hand dock. */
            'lg:inset-y-4 lg:end-4 lg:start-auto lg:h-auto lg:w-[min(600px,92vw)] lg:max-h-[calc(100dvh-2rem)] lg:rounded-2xl',
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
              <a data-ask="dashboard-entry" href={dashboardHref(question, storyContext)}>{t.title} ↗</a>
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
                ? `min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 ${isIdle ? 'py-2' : 'py-4'}`
                : 'min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface px-4 py-4 sm:px-5 sm:py-5'
            }
            data-ask="body"
            data-ask-scroll="conversation"
          >
            {/* ASK READING EXPERIENCE R1 — the dock is always the phone layout: Sources open as a sheet. */}
            <AskSourcesPanelProvider locale={r2Locale}>
            {/*
              UNIFIED INTELLIGENCE BINDING R2C — the canonical turn view, the SAME component /ask
              renders: answer state, provenance, sources, Save, and "Open full analysis" (a
              display-only read of the stored operation, 0 AI). No legacy "Run full analysis".
            */}
            {visibleTurns.map((turn, index) => (
              <div
                key={turn.operation?.operationId ?? `${index}-${turn.question}`}
                data-ask={index === visibleTurns.length - 1 && !isPending ? 'current-turn' : 'history-turn'}
                className="mb-6 flex flex-col gap-3 sm:gap-4"
              >
                <AskR2TurnView
                  turn={turn}
                  locale={r2Locale}
                  context={undefined}
                  canSave={!r2.guestMode}
                  storyBookmarks
                  onUseQuestion={(draft) => {
                    setQuestion(draft);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                />
              </div>
            ))}

            {isPending ? (
              <div data-ask="current-turn" className="flex flex-col gap-3">
                <div data-ask="user-message" className="ms-auto max-w-[88%] rounded-2xl rounded-br-md border border-signal/25 bg-signal/15 px-4 py-3 text-sm leading-relaxed text-ink-primary shadow-sm">
                  {r2.pending}
                </div>
                {/*
                  ASK READING EXPERIENCE R1 — the truthful working line. The simulated four-stage
                  timer (LoadingStages, 1.8 s) is retired from Ask: it claimed retrieval stages the
                  client cannot know are happening (H-FREEZE §5).
                */}
                <AskWorkingStatus label={r2s.working} />
              </div>
            ) : null}

            {/*
              ASK READING EXPERIENCE R1 — the emblem, idle states only (dock: 96 ready · 48 typing).
              A first request fades it out and unmounts it; it never returns into the reading
              content. Not on the Map skin, whose composition is the Map's own.
            */}
            {!onMap && visibleTurns.length === 0 && (isIdle || isPending) ? (
              <AskEmblem
                placement="dock"
                state={isPending ? 'leaving' : composerFocused || question.trim() !== '' ? 'typing' : 'ready'}
              />
            ) : null}

            {isIdle ? (
              /* No request has been made and none will be until a question is
                 submitted. This is the honest empty state, not a failure. */
              <p data-ask="idle" className="text-sm text-ink-tertiary">
                {t.idle}
              </p>
            ) : null}

            {r2.signInRequired !== null ? (
              /* SIGNED OUT, NO GUEST TRIAL: the question is kept in the composer; nothing ran. */
              <div data-ask="sign-in-required" role="status" className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-void p-4 text-sm text-ink-secondary">
                <p className="font-semibold text-ink-primary">{r2s.signInRequired.title}</p>
                <p>{r2s.signInRequired.body}</p>
                <a
                  data-ask="sign-in"
                  href={ASK_SIGN_IN_HREF}
                  onClick={() => keepQuestion(question.trim() ? question : (r2.signInRequired ?? ''))}
                  className="inline-flex min-h-[44px] items-center font-semibold text-signal-bright underline"
                >
                  {r2s.signInRequired.action}
                </a>
              </div>
            ) : null}

            {notice !== null ? (
              <p data-ask="notice" role="status" className="text-[13px] leading-[1.45] text-[var(--ask-read-deep-ink,#c9b27a)]">
                {notice}
              </p>
            ) : null}

            {topicStarted ? (
              <p data-ask="new-topic-started" role="status" className="text-[13px] text-ink-secondary">
                {r2s.unified.newTopicStarted}
              </p>
            ) : null}

            {visibleTurns.length > 0 && !isPending && !topicStarted ? (
              <button
                type="button"
                data-ask="new-topic"
                onClick={() => {
                  startNewTopic();
                  setTopicStarted(true);
                }}
                className="mt-2 min-h-[44px] rounded-xl px-2 text-[13px] text-ink-secondary underline hover:text-ink-primary"
              >
                {r2s.unified.newTopic}
              </button>
            ) : null}
            </AskSourcesPanelProvider>
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
              <form ref={formRef} onSubmit={submit} data-ask="form" className="flex flex-col gap-[10px] px-[14px] py-[12px]">
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
                        ? t.askingAboutGeography.replace('{place}', geographyPlace)
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
                  minHeight={isIdle ? 58 : 44}
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
                    disabled={question.trim().length === 0 || isPending}
                    className="min-h-[44px] min-w-[96px] shrink-0 rounded-[10px] border border-[#d9b98a] bg-[linear-gradient(105deg,#412d9f,#1f328a)] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t.submit}
                  </button>
                </div>
              </form>
            </div>
          ) : (
          <div
            data-ask="composer"
            onFocusCapture={() => setComposerFocused(true)}
            onBlurCapture={() => setComposerFocused(false)}
            className={`shrink-0 border-t border-border bg-surface-raised/95 backdrop-blur ${visibleBox !== null ? 'pb-1' : 'pb-[max(0.75rem,env(safe-area-inset-bottom))]'}`}
          >
          <form ref={formRef} onSubmit={submit} data-ask="form" className="flex flex-col gap-2 px-4 py-3">
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
              minHeight={isIdle ? 58 : 44}
              maxHeight={420}
              maxViewportFraction={0.46}
              keepVisible={false}
              className="w-full rounded-2xl border border-border-strong bg-surface px-4 py-3 text-[16px] leading-6 text-ink-primary shadow-inner placeholder:text-ink-secondary/70 focus:border-signal focus:outline-none"
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
                className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-border-strong bg-surface px-3 py-1 text-[0.75rem] text-ink-secondary"
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
                        ? t.askingAboutGeography.replace('{place}', geographyPlace)
                        : t.contextChipGeneric}
                  </span>

              <button
                type="submit"
                data-ask="submit"
                disabled={question.trim().length === 0 || isPending}
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
