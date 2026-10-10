'use client';

import { AskSubmittedQuestion } from './AskSubmittedQuestion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ASK_PRODUCT_NAME } from '@/lib/ask/askBrand';
import { useSearchParams } from 'next/navigation';
import type { StoryContext } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { usePublishStoryContext } from '@/lib/ask/storyContextStore';
import { dashboardContext } from '@/lib/ask/dashboardContext';
import { askContextRefOf } from '@/lib/ask/askContextRef';
import { askRecordStrings, dashboardModuleContext } from '@/lib/ask/askModuleRef';
import { askCompareRef, dashboardCompareContext } from '@/lib/ask/askSelectionRef';
import { resolveAskStrings, type AskLocale } from '@/lib/ask/askStrings';
import { sourceLanguageFor, type DisplayLocale } from '@globalnews-ai/shared';
import { askLanguageDisposition } from '@/lib/ask/askLocale';
import { askSevenStrings } from '@/lib/ask/askSevenStrings';
import { askDirectionProps, askForeignCopyProps, isolatedAuto } from '@/lib/ask/askDirection';
import { askR2Strings } from '@/lib/ask/askR2Strings';
import { useRotatingExample } from '@/lib/ask/useRotatingExample';
import { askR2View } from '@/lib/ask/askR2View';
import {
  sanitizeReturnPath,
  useAskR2Conversation,
  type AskR2Turn,
} from '@/lib/ask/useAskR2Conversation';
import { askR2PayloadOf, askV2Api } from '@/lib/api/askV2Api';
import { readEarlierTurns, rememberConversation } from '@/lib/ask/askThreadRestore';
import { revokeAnalysisConsent } from '@/lib/analysis/analysisComputeConsent';
import { ASK_SIGN_IN_HREF, keepQuestion, readKeptQuestion } from '@/lib/ask/askKeptQuestion';
import { authReturnNotice, type GuestNotice } from '@/lib/ask/askGuestTrial';
import type { AskShellMenuControl } from '@/lib/ask/askShellMenu';
import { askCountryName } from '@/lib/ask/askCountryName';
import { AskProgressRunning } from './AskProgressPanel';
import { AskEmblem, AskEmblemMark, AskWordmark } from './AskEmblem';
import { ASK_SIDE_PANEL_QUERY, AskSourcesPanelProvider } from './AskSourcesPanel';
import { AskR2TurnView } from './AskR2TurnView';
import { AskFollowCheck } from './AskFollowCheck';
import { followStrings } from '@/lib/ask/followStrings';
import { AskConversations } from './AskConversations';
import { AskToastProvider, AskToastSlot } from './AskToast';
import { useAskNavOptional } from '@/components/ask-nav/AskNavShell';
import { AskReadingFooter } from '@/components/ask-nav/AskReadingFooter';
import { AskDeepConfirm } from './AskDeepConfirm';
import { AskJobSetupSheet } from './AskJobSetupSheet';
import { AskWelcomeEntries, useResumeConversation } from './AskWelcomeEntries';
import { askR3FullStrings } from '@/lib/ask/askR3FullStrings';
import { Composer } from './AskParts';
import styles from './askDashboard.module.css';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';

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
  readonly locale: DisplayLocale;
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
  /*
    UNIFIED INTELLIGENCE BINDING R2H — Home "Compare stories": 2..8 staged story URLs. The most
    specific context (a chosen SET), so while its chip is shown it is what this screen sends —
    as a COMPARE selection whose references are derived only when the reader presses Ask.
  */
  const incomingCompare = useMemo(() => dashboardCompareContext(new URLSearchParams(urlKey)), [urlKey]);
  const [compareRemovedFor, setCompareRemovedFor] = useState<string>();
  const compareContext = compareRemovedFor === urlKey ? undefined : incomingCompare;
  const [question, setQuestion] = useState(params.get('q') ?? '');
  const [compact, setCompact] = useState(false);
  /* ASK DESIGN COMPLETENESS R1 — the ≥1024 layout: persistent conversations column. */
  const [wide, setWide] = useState(false);
  const nav = useAskNavOptional();
  /*
    R3 FULL DESIGN · PRODUCT OWNER RAIL RULING (9 Oct 2026) — supersedes R3 HANDOFF §3/§7 and the
    Reading Experience guide's persistent desktop column. Where the standalone shell supplies its
    drawer (`shellMenu`), Conversations are HIDDEN BY DEFAULT at every width and open only on
    request through that drawer; no column reserves width. A frame mounted without the drawer keeps
    the column, so no surface loses its history.
  */
  const persistentRail = wide && shellMenu === undefined;
  /* R3 FULL DESIGN · J01 — the optional job setup sheet (opening it runs nothing). */
  const [jobSheetOpen, setJobSheetOpen] = useState(false);

  const reader = useRef<HTMLDivElement>(null);
  const layout = useRef<HTMLDivElement>(null);
  /*
    R4 · SEVEN-LANGUAGE ASK FRONTEND — ONE DISPOSITION, NOT A CLAMP.

    This block used to read `const r2Locale: 'en' | 'pl' = locale === 'pl' ? 'pl' : 'en';`,
    one of ten identical clamps across the Ask surfaces. A French reader was silently given
    English and nothing said so. `askLanguageDisposition` keeps the three facts apart:

      interfaceLocale  the reader's own locale, all seven — direction, Intl, bounded copy
      answerLocale     the language the answer comes back in — the reader's own
      catalogueLocale  which EN/PL copy catalogue to index; a TRANSLATION fact only

    The reader's requested locale also reaches the request unchanged, so the server learns
    what was asked rather than what the frontend decided to ask for.
  */
  const disposition = askLanguageDisposition(locale);
  const interfaceLocale = disposition.interfaceLocale;
  const sevenStrings = askSevenStrings(interfaceLocale);
  const askScope = askDirectionProps(interfaceLocale);
  /* R4 · set only when the scope is RTL and the copy below it is still EN/PL. */
  const foreignCopy = askForeignCopyProps(interfaceLocale);
  /*
    R4 · PHASE B — ONE RESOLVER, AND THE LAST CLAMP IS GONE.

    These four lines each resolved copy their own way: `askStrings` through the legacy
    five-member crossing, `askR2Strings` through `catalogueLocale` (which was 'en' | 'pl'),
    and the dictionary through `sourceLanguageFor`, which returns undefined for a locale with
    no source language and fell back to English. Three mechanisms, three different answers to
    one question, and a French reader could be shown all three at once.

    `askShellStrings(locale)` answers it once, for every catalogue the Ask surface reads, and
    what it cannot word yet is reported by `askShellCoverage` rather than substituted in
    silence.
  */
  const shell = askShellStrings(interfaceLocale);
  const t = shell.askStrings;
  const r2s = shell.askR2Strings;
  const dict = shell.dict;
  /*
    UNIFIED INTELLIGENCE BINDING R2C — ONE ENGINE. The legacy news-analysis conversation that
    used to run here when Ask V2 answered 404 is retired: Ask V2 unavailable is a truthful
    "unavailable" state with the question kept, never a second engine (POST /analysis/news).
  */
  const [askUnavailable, setAskUnavailable] = useState(false);
  /* TRUST R1 — a failed Send keeps the question in the box (retry = press Ask again). */
  const [retryKept, setRetryKept] = useState(false);
  /* TRUST R1 — follow the conversation only while the reader is at its end; otherwise announce
     a new answer below instead of yanking them away from what they are reading. */
  const atEnd = useRef(true);
  const followNext = useRef(false);
  const [newBelow, setNewBelow] = useState(false);
  const returnPath = sanitizeReturnPath(params.get('return'));
  /*
    R4 · THE REQUEST CARRIES WHAT THE READER SELECTED, NOT WHAT THE CHROME RENDERS.

    `disposition.requested` is the reader's own locale, all seven. The EN/PL catalogues above
    still read `catalogueLocale`, because those catalogues have two entries — but the SERVER is
    told what was actually asked, so it answers in `fr` and records `fr` as `fr` instead of
    receiving an `en` the frontend invented. That is the whole point of the client pin.
  */
  const r2 = useAskR2Conversation(disposition.requested, returnPath, { guestTrial: true });
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
  /* REASON TO RETURN R1 · §8 — a followed question's "Check for changes" arrival (an id only) */
  const followId = params.get('follow');
  const [opened, setOpened] = useState<AskR2Turn | null>(null);
  /* CTO P0 · DEFECT F — the reopened conversation's earlier turns (display-only). */
  const [openedEarlier, setOpenedEarlier] = useState<AskR2Turn[]>([]);
  /* operations THIS screen wrote to the address bar: already on screen, never re-opened as a copy
     (Next syncs useSearchParams with history.replaceState) */
  const remembered = useRef(new Set<string>());
  /* ASK DESIGN COMPLETENESS R2 — is a conversation on screen (read by the reopen effect). */
  const liveConversation = useRef(false);
  liveConversation.current = r2.turns.length > 0 || opened !== null;
  const startNewConversationRef = useRef(r2.startNewConversation);
  startNewConversationRef.current = r2.startNewConversation;
  const lastR2 = r2.turns[r2.turns.length - 1] ?? opened ?? undefined;
  const lastR2View =
    lastR2?.payload != null
      ? askR2View(
          lastR2.payload,
          r2s,
          interfaceLocale,
          (iso) => askCountryName(iso, interfaceLocale) ?? iso,
        )
      : null;
  const showR2 = r2.availability === 'r2' || opened !== null;
  const isPending = r2.pending !== null;

  const hasQuestion =
    r2.turns.length > 0 ||
    opened !== null ||
    isPending ||
    r2.signInRequired !== null;
  /*
    ASK DESIGN COMPLETENESS R1 — there is no standing Sources column any more: Design F3 opens
    Sources as a 380 px NON-MODAL side panel only when the reader asks for it (toolbar or a
    citation), and as a sheet below 1024. The attribute stays for the stylesheet: always false.
  */
  const withSourcesColumn = false;
  /*
    CENTERED COMPOSER R1 — THE ENTRY STATE.

    Exactly the condition the empty region already renders on: nothing asked, nothing in
    flight, nothing reopened, no sign-in interruption. The instant a question exists this is
    false and the frame is the frozen D25 workspace again, untouched — which is how the
    contract's "do not redesign the post-answer intelligence workspace" is honoured by
    construction rather than by care.
  */
  const entryState = !hasQuestion;
  /*
    ASK READING EXPERIENCE R1 — the emblem lives in the entry state (ready / typing) and LEAVES
    when the first request starts: a 200 ms fade with its motion stopped, then it unmounts. It is
    never drawn beside an answer, a reopened conversation or a sign-in interruption.
  */
  const [composerFocused, setComposerFocused] = useState(false);
  /* Design A2 — typing collapses the welcome group; only the emblem and the composer remain. */
  const typing = entryState && (composerFocused || question.trim() !== '');
  const emblemState = isPending
    ? 'leaving'
    : composerFocused || question.trim() !== ''
      ? 'typing'
      : 'ready';
  const showEmblem =
    entryState ||
    (isPending && r2.turns.length === 0 && opened === null && r2.signInRequired === null);
  /*
    The rotating examples. Client-side, zero compute, zero network, zero personalisation, and
    every rule decided by the pure machine in `askExampleRotation`. `enabled` is the entry
    state, so no timer runs in the answered workspace.

    REINSTATED BY PRODUCT OWNER DIRECTIVE 9 Oct 2026 / CLAUDE DESIGN R3 §11 (Welcome R1-C).
    The comment block above kept its place while the call below was absent: ASK DESIGN AUTHORITY
    R3 had removed the in-field example (its superseded reasoning is recorded at the `Composer`
    call site). R1-C puts it back, inside the composer, on a 5.2 s hold with 400 ms fades.

    `suspended` is R1-C's rule that rotation "Runs only when ALL are true: … no sheet/drawer/
    dialog open". `nav.open` is the conversations DRAWER, which IS reachable from the entry
    screen and is the live path here. The other two are guards: `hasQuestion` already includes
    `r2.signInRequired !== null`, and `deepQuote` requires a submitted turn, so neither can
    co-occur with `entryState` today — they are wired so that if a later lane makes either
    reachable on the welcome view, the example stops instead of rotating behind it.
  */
  const rotatingExample = useRotatingExample({
    locale: interfaceLocale,
    enabled: entryState,
    compact,
    suspended: nav?.open === true || jobSheetOpen || r2.signInRequired !== null || r2.deepQuote !== null,
  });
  /*
    R3 FULL DESIGN · D02 — "when genuinely available": the signed-in reader's own latest
    conversation (a read of their threads; 0 AI). A guest reads nothing here.
  */
  const signedInReader = !guestMode && nav?.account === 'signed-in';
  const resumeConversation = useResumeConversation(signedInReader && entryState);
  const r3 = askR3FullStrings(interfaceLocale);
  const closeJobSheet = (): void => {
    setJobSheetOpen(false);
    /* focus returns to the entry that opened it (the one placement CSS shows) */
    requestAnimationFrame(() => {
      const entries = Array.from(document.querySelectorAll<HTMLElement>('[data-ask="job-entry"]'));
      entries.find((node) => node.offsetParent !== null)?.focus();
    });
  };

  useEffect(() => {
    setQuestion(new URLSearchParams(urlKey).get('q') ?? '');
  }, [urlKey]);
  /* R2H — a Compare arrival without `q` stages a DRAFT question (declared after the effect
     above, so it wins); like `q`, it is never submitted on arrival. */
  useEffect(() => {
    const url = new URLSearchParams(urlKey);
    if (url.get('q') === null && dashboardCompareContext(url) !== undefined) {
      /* R4 · PHASE B — was a bare `r2Locale === 'pl' ? … : …`. A ternary with no catalogue key
         is unreachable by every localization mechanism; this one now has a key. */
      setQuestion(shell.askContextStrings.compareDraftQuestion);
    }
  }, [urlKey, shell]);
  /*
    SIGNED-OUT FALLBACK REMOVAL R1 — back from sign-in, the kept question returns to the
    composer as a DRAFT. It is read once and removed; nothing is sent until the reader
    presses Ask. A `q` or `operation` in the URL wins over it.
  */
  useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    if (url.has('q') || url.has('operation') || url.has('follow')) return;
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
    if (remembered.current.has(operationId)) return; // DEFECT F: already on screen
    /* GATE H (H-T12 / H-G4) — an operation arrival is a READ. It revokes any pending
       analysis grant, so no later arrival can spend a grant this navigation did not make. */
    revokeAnalysisConsent();
    /*
      ASK DESIGN COMPLETENESS R2 — THREADS, NOT TURNS. A conversation opened from the drawer or the
      conversations column arrives on THIS mounted frame (same route), so whatever conversation
      was on screen is cleared first: otherwise the reopened thread could not be continued
      (continueThread keeps an existing thread) and a follow-up would be filed into the PREVIOUS
      conversation. Local state only — nothing is deleted or sent.
    */
    if (liveConversation.current) {
      startNewConversationRef.current();
      setOpenedEarlier([]);
    }
    let live = true;
    let viaGuest = false;
    void askV2Api
      .operation(operationId)
      /* ASK GUEST TRIAL R3 — a guest reopens its own operation through the guest surface. */
      .then((read) => {
        if (read.ok || read.reason !== 'SIGNED_OUT') return read;
        viaGuest = true;
        return askV2Api.guestOperation(operationId);
      })
      .then((read) => {
        if (!live) return;
        /* ALPHA VISUAL ACCEPTANCE REPAIR R1 (E) — a follow-up continues the reopened thread. */
        if (read.ok && read.value.threadId && read.value.language) {
          continueThread(read.value.threadId, read.value.language);
          /* CTO P0 · DEFECT F — the conversation's earlier turns come back too (reads only). */
          const threadId = read.value.threadId;
          void readEarlierTurns(threadId, operationId, viaGuest).then((earlier) => {
            if (live) setOpenedEarlier(earlier);
          });
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
  /* ASK DESIGN COMPLETENESS R1 — the drawer marks this conversation as the current one. */
  const currentThreadId = lastR2?.operation?.threadId ?? null;
  const setNavThread = nav?.setThreadId;
  useEffect(() => {
    setNavThread?.(currentThreadId);
  }, [currentThreadId, setNavThread]);
  useEffect(() => {
    const media = matchMedia(ASK_SIDE_PANEL_QUERY);
    const update = () => setWide(media.matches);
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
    if (!reader.current || empty) return;
    if (atEnd.current || followNext.current) {
      reader.current.scrollTop = reader.current.scrollHeight;
      setNewBelow(false);
    } else {
      setNewBelow(true);
    }
    if (r2.pending === null) followNext.current = false;
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
        /* ASK RELIABILITY R1 (Q) — iOS PANS the visual viewport when the keyboard opens
           (offsetTop > 0). Sized to the visible height but pinned at top 0, the frame lost its
           header/close above the visible area and showed an empty band below the composer. The
           frame now follows the visible box: its top too, and on scroll as well as resize. */
        node.style.setProperty('--ask-visible-top', `${Math.round(viewport?.offsetTop ?? 0)}px`);
        const keyboard = window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0) > 80;
        if (keyboard) node.setAttribute?.('data-ask-keyboard', '');
        else node.removeAttribute?.('data-ask-keyboard');
      }
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('scroll', update);
      viewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  async function ask() {
    if (isPending || !question.trim()) return;
    const draft = question;
    setQuestion('');
    setRetryKept(false);
    /* The reader just asked: take them to their question and its answer. */
    followNext.current = true;
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
    const compareRef = compareContext === undefined ? undefined : await askCompareRef(compareContext);
    const outcome = await r2.submit(
      draft,
      compareRef ?? moduleContext?.ref ?? askContextRefOf(context, undefined),
    );
    if (outcome === 'context-unavailable') setQuestion(draft);
    else if (outcome === 'legacy') {
      setAskUnavailable(true);
      setQuestion(draft);
    }
    else if (outcome === 'signed-out') setQuestion(draft);
    /* ASK GUEST TRIAL R3 — a guest refusal (exhausted, cooldown, busy) keeps the draft too; nothing ran. */
    else if (outcome === 'kept') setQuestion(draft);
    else if (outcome === 'failed') {
      setQuestion(draft);
      setRetryKept(true);
    }
  }
  /*
    ASK DESIGN COMPLETENESS R1 — "Refresh reporting": a NEW explicit turn for the same question,
    through the same submit path as Ask (same context, same refusals). The reader's own draft in
    the composer is left alone, and the answer on screen stays until the new one arrives.
  */
  async function resubmit(again: string) {
    if (isPending || !again.trim()) return;
    followNext.current = true;
    setAskUnavailable(false);
    const compareRef = compareContext === undefined ? undefined : await askCompareRef(compareContext);
    const outcome = await r2.submit(
      again,
      compareRef ?? moduleContext?.ref ?? askContextRefOf(context, undefined),
    );
    if (outcome === 'legacy') setAskUnavailable(true);
    else if (outcome === 'failed') setRetryKept(true);
  }
  /*
    ASK DESIGN COMPLETENESS R2 — "New question" (CTO live mobile correction). From an open
    conversation: the conversation is left as it is on the server (so it stays in Recent — nothing
    is deleted), the active thread and turns are cleared locally, the composer is emptied and
    focused, and the operation/question-specific URL state is removed (replaceState, no new history
    entry, no reload). The governed `return` destination and any context the reader arrived with
    are kept. From the empty READY state the control is disabled, so it never simulates a reset.
  */
  function focusComposer() {
    requestAnimationFrame(() =>
      document.querySelector<HTMLTextAreaElement>('[data-ask="composer-input"]')?.focus(),
    );
  }
  function newQuestion() {
    /* Already an empty Ask (e.g. New question from the drawer): nothing to reset, just focus. */
    if (entryState) {
      focusComposer();
      return;
    }
    if (!r2.startNewConversation()) return;
    setOpened(null);
    setOpenedEarlier([]);
    remembered.current.clear();
    setQuestion('');
    setRetryKept(false);
    setAskUnavailable(false);
    setNewBelow(false);
    const url = new URLSearchParams(window.location.search);
    url.delete('operation');
    url.delete('q');
    const rest = url.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest === '' ? '' : `?${rest}`}`);
    focusComposer();
  }
  /* Every New question control (header, drawer, column, menu row) runs THIS action. */
  const newQuestionRef = useRef(newQuestion);
  newQuestionRef.current = newQuestion;
  const registerNewQuestion = nav?.registerNewQuestion;
  useEffect(() => {
    registerNewQuestion?.(() => newQuestionRef.current());
    return () => registerNewQuestion?.(null);
  }, [registerNewQuestion]);
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
  /* a guest's own restore (the hook) may already hold the reopened turn: never render it twice */
  const openedInLive =
    opened?.operation !== undefined &&
    r2.turns.some((t) => t.operation?.operationId === opened.operation?.operationId);
  /*
    CTO P0 · DEFECT F — remember this conversation in the address bar after each completed turn
    (replaceState: no new history entry), so a refresh or a Back returns to it instead of an empty
    Ask. Plain /ask ("New question") still starts a new conversation.
  */
  const latestCompletedOperation =
    latestR2?.operation?.status === 'COMPLETED' ? latestR2.operation.operationId : null;
  useEffect(() => {
    if (latestCompletedOperation === null) return;
    remembered.current.add(latestCompletedOperation);
    rememberConversation(latestCompletedOperation);
  }, [latestCompletedOperation]);

  return (
    <main
      ref={layout}
      /*
        R4 · ARABIC RTL — `lang` and `dir` AT THE ASK CONTENT SCOPE, NOT ON <html>.

        The bidi algorithm resolves paragraph direction from the nearest element that
        declares one, so declaring it here gives every answer block, chip row and composer
        inside this tree the right paragraph direction while leaving the product chrome
        outside it untouched. Putting `dir` on <html> would mirror the whole application for
        a reader who selected Arabic for Ask; putting it on each text node would lose
        paragraph direction and reorder punctuation at the boundaries.

        Both values come from `askDirectionProps`, which derives them from the shared
        direction table — so no component decides its own direction, and `lang` describes the
        content that is actually rendered.
      */
      lang={askScope.lang}
      dir={askScope.dir}
      data-ask="frame-screen"
      data-ask-locale={interfaceLocale}
      data-ask-dir={askScope.dir}
      data-ask-rail={persistentRail ? 'column' : 'drawer'}
      data-ask-answer-locale={disposition.answerLocale}
      /* PO ruling — the answer returns in the reader's selected language, so there is no
         answer-language disclosure. What remains is a COPY-coverage fact, exposed as data for
         Claude L's lane and never as a claim to the reader about answers. */
      data-ask-full-copy={disposition.fullAskCopy ? 'true' : 'false'}
      data-ask-surface
      data-ask-path={showR2 ? 'r2' : r2.availability === 'legacy' ? 'legacy' : 'unknown'}
      data-ask-phase={isPending ? 'loading' : hasQuestion ? 'answered' : 'idle'}
      /*
        R4 · PHASE C — the rail's track is now driven by this attribute in BOTH directions.
        It was set only when a rail existed, so an answer with no citable sources still paid
        340px of empty grid track: "zero sources must not leave a large empty rail".
      */
      data-ask-sources-column={withSourcesColumn ? 'true' : 'false'}
      data-ask-read="r4"
      /* CENTERED COMPOSER R1 — the entry geometry is a STATE of this frame; see the CSS. */
      data-ask-entry={entryState ? 'true' : undefined}
      data-ask-typing={typing ? 'true' : undefined}
      className={styles.frame}
    >
      {/* ASK DESIGN COMPLETENESS R1 — Sources: the ≥1024 non-modal side panel or the sheet,
          inside the Ask scope so both inherit its direction, language and theme. */}
      <AskSourcesPanelProvider locale={interfaceLocale}>
      <AskToastProvider>
      {/*
        ASK DESIGN COMPLETENESS R1 — the persistent 280 px conversations column (≥1024, Design
        F2/F3). Mounted only at that layout, so a phone reads nothing for it; below 1024 the same
        list lives in the menu drawer.
      */}
      {persistentRail && (
      <aside data-ask="history" aria-label={r2s.read.conversations} className={styles.history}>
        {wide && (
          <AskConversations
            locale={interfaceLocale}
            currentThreadId={lastR2?.operation?.threadId ?? null}
          />
        )}
        {/* ASK DESIGN AUTHORITY R3 — the column's footer slot (CTO rulings 1–3): language,
            appearance, one account entry and the quiet legal row; the standalone shell only. */}
        {wide && nav !== null && (
          <AskReadingFooter
            language={disposition.catalogueLocale}
            selected={interfaceLocale}
            account={nav.account}
          />
        )}
      </aside>
      )}
      {/* PHONE / TABLET (<1024) — the Design header: menu · emblem 24 + wordmark · New. */}
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
            className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-[4px] text-[var(--ask-read-ink,#cfe2f2)]"
          >
            <span aria-hidden="true" className="block h-[2px] w-[18px] rounded-sm bg-current" />
            <span aria-hidden="true" className="block h-[2px] w-[18px] rounded-sm bg-current" />
            <span aria-hidden="true" className="me-[6px] block h-[2px] w-[12px] rounded-sm bg-current" />
          </button>
        ) : (
          <button
            type="button"
            data-ask={returnsToMap ? 'back' : 'close'}
            aria-label={returnsToMap ? r2s.returnMap : r2s.close}
            onClick={leave}
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-[20px] text-[var(--ask-read-ink,#cfe2f2)]"
          >
            {returnsToMap ? '←' : '×'}
          </button>
        )}
        {/* The static 24 px mark beside the ONE canonical product name (CTO brand ruling). */}
        <h1 className={styles.brand}>
          <AskEmblemMark />
          <AskWordmark name={r2s.askTitle} />
        </h1>
        {/* The source-count readout stays for assistive technology; the Design header shows New. */}
        <span data-ask="header-state" className={styles.visuallyHidden}>
          {lastR2View !== null ? r2s.sourcesLabel(lastR2View.sourceCount) : ''}
        </span>
        {/* New question starts a fresh conversation; it is disabled while Ask is already empty.
            The menu control (left) is the conversations drawer, never this one. */}
        <button
          type="button"
          data-ask="new-question"
          onClick={newQuestion}
          disabled={entryState || isPending}
          className={styles.newButton}
        >
          <span aria-hidden="true">+</span>
          {shell.askNavStrings.newQuestion}
        </button>
      </header>
      {/*
        The return-to-Map strip stays (a governed destination). The scope chips it also carried
        now read in the answer's own quiet footer, so the Design's reading area starts directly
        under the header.
      */}
      {returnsToMap && (
        <div data-ask="context-strip" className={styles.phoneStrip}>
          {returnsToMap && (
            <button
              type="button"
              data-ask="return-to-map"
              onClick={leave}
              className="shrink-0 rounded-full border border-dashed border-[var(--ask-read-line,#1d4a73)] px-2.5 py-1 text-[var(--ask-read-control-ink,#93cdf5)]"
            >
              {r2s.returnMap}
            </button>
          )}
        </div>
      )}

      <div
        ref={reader}
        data-ask="reader"
        className={styles.reader}
        aria-live="polite"
        onScroll={(event) => {
          const node = event.currentTarget;
          atEnd.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
          if (atEnd.current) setNewBelow(false);
          /* TRUST R1 (checkpoint 5, live Alpha) — the reader scrolled away while their answer was
             pending: stop following, so its arrival shows "new answer" instead of yanking them. */
          else followNext.current = false;
        }}
      >
        <div className={styles.grid}>
          <div data-ask="thread" className={styles.thread}>
            {showEmblem && <AskEmblem placement="page" state={emblemState} />}
            {!hasQuestion && (
              <section data-ask="empty" data-ask-entry-view="" className={styles.empty}>
                {/*
                  CENTERED COMPOSER R1 §3 — the hierarchy the contract specifies: the product,
                  then the question, then the composer. The wordmark replaces the "Ask AI"
                  eyebrow here because on the standalone entry view they said the same thing
                  twice. R4 · CTO BRAND RULING: the wordmark is the ONE canonical product name
                  (ASK_PRODUCT_NAME, "Ask GlobalNewsAI"), never a separately authored spelling —
                  this line was a hard-coded "GlobalNews AI", a second brand beside the header's.
                */}
                <p data-ask="entry-brand" className={styles.entryBrand}>
                  {ASK_PRODUCT_NAME}
                </p>
                {/* R4 · the reader's own composer hint. EN/PL read the released dictionary
                    string through the bounded catalogue, so they are unchanged. */}
                {/*
                  ASK DESIGN COMPLETENESS R1 — the Design welcome group (A1/F2): headline, support
                  line and a quiet example sentence (text, not buttons). Typing collapses all three
                  (A2); the emblem above and the composer below remain.
                */}
                {/*
                  ASK DESIGN AUTHORITY R3 — the prototype's group was: [headline + support]
                  (gap 8), then the example sentence 20 px below on phone/tablet, and on desktop
                  that example sentence under the centred composer instead (Design F2).

                  SUPERSEDED BY PRODUCT OWNER / CTO DESIGN R3 REVIEW, 9 Oct 2026 (H-R3-1):
                  "remove the redundant static welcome-example sentence outside the Ask composer,
                  including the desktop variant … The rotating questions belong only inside the
                  empty composer." Both `welcome-example` and `welcome-example-desktop` are gone.
                  What the group keeps is exactly what the ruling preserves: the emblem above it,
                  the approved headline, and ONE supporting sentence (plus the saved-name greeting,
                  which is not an example).
                */}
                <div data-ask-welcome="" className={styles.welcomeCollapsible}>
                  <div className={styles.welcomeTitleGroup}>
                    {/* REASON TO RETURN R1 · G6 — only a name the reader saved; otherwise nothing */}
                    {/* R3 FULL DESIGN · D02 — the verified name, or the neutral greeting; never a guess. */}
                    {signedInReader && (
                      <p data-ask="welcome-greeting" className={styles.emptyLead}>
                        {nav?.displayName != null
                          ? followStrings(interfaceLocale).greeting(nav.displayName)
                          : r3.welcomeBack}
                      </p>
                    )}
                    <h1 className={styles.emptyTitle}>{sevenStrings.composerHint}</h1>
                    {/* R3 FULL DESIGN · WELCOME_PLACEHOLDER_SPEC §Composition 4 (R1-C sentence). */}
                    <p data-ask="welcome-support" className={styles.emptyLead}>
                      {r3.welcomeSupport}
                    </p>
                  </div>
                  <AskWelcomeEntries
                    locale={interfaceLocale}
                    signedIn={signedInReader}
                    latest={resumeConversation}
                    onOpenJobs={() => setJobSheetOpen(true)}
                    placement="welcome"
                  />
                </div>
                {/*
                  THE ANSWER-LANGUAGE DISCLOSURE IS REMOVED (PO ruling).

                  It told a French reader, in French, that the answer would come back in
                  English. That was measured against this lane's base `c7e8c03` and is false
                  on the current backend, which answers in the reader's selected language. The
                  entry view says nothing about answer language now, because there is nothing
                  to say: the reader chose a language and gets it.
                */}
                {guestMode && (
                  /* ASK GUEST TRIAL R3 — restrained, factual; sign-in stays optional. */
                  <div data-ask="guest-intro" className="mt-1 flex flex-col gap-1">
                    <p className="text-[15px] font-semibold text-[var(--ask-read-ink,#cfe2f2)]">{g.intro}</p>
                    <p className="text-[12.5px] leading-[1.45] text-[var(--ask-read-ink2,#8fa6c0)]">{g.privacy}</p>
                  </div>
                )}
                {/*
                  CENTERED COMPOSER R1 §3 / §5 — THE "QUESTIONS WORTH ASKING" CARD IS NOT
                  MOUNTED ON THE ENTRY VIEW.

                  The contract rules that the first viewport must not be dominated by
                  permanent example cards, and that there must be no standing list of example
                  questions OUTSIDE the composer. The card's whole content was the truthful
                  statement that no suggestion was available — and the composer now carries
                  rotating examples itself, so the card would sit under a live suggestion
                  saying there is none. `QuestionsWorthAsking` is kept exported and intact in
                  `AskParts` for whatever later contract wants it back; nothing about it was
                  weakened, it is simply not rendered here.
                */}
              </section>
            )}
            {r2.signInRequired !== null && (
              /* SIGNED-OUT FALLBACK REMOVAL R1 — a sign-in requirement, never a reporting failure. */
              <section data-ask="sign-in-required" role="status" className="mb-6">
                {/* A5: no visible "you asked" label; the bubble carries the question, the name stays for AT */}
                <p className="sr-only">{r2s.youAsked}</p>
                <AskSubmittedQuestion
                  question={r2.signInRequired}
                  headingClassName={styles.question}
                  showFullLabel={r2s.showFullQuestion}
                  showLessLabel={r2s.showLessQuestion}
                />
                <div className="flex flex-col items-start gap-3 rounded-[12px] border border-[var(--ask-read-control-line,#2a6d9e)] [background:var(--ask-read-answer-bg,linear-gradient(#08263f,#051a2e))] p-3.5 md:p-5">
                  <span className="inline-flex h-[26px] items-center rounded-[6px] border border-[var(--ask-read-control-line,#2a6d9e)] bg-[var(--ask-read-sunk,#0a2a47)] px-2.5 text-[0.75rem] font-bold text-[var(--ask-read-control-ink,#bfe3fb)]">
                    {r2s.signInRequired.title}
                  </span>
                  <p className="text-[16px] leading-[1.55] text-[var(--ask-read-ink,#cfe2f2)]">
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
            {/*
              CTO P0 · DEFECT F — the reopened conversation's earlier turns. ASK DESIGN AUTHORITY R3
              (CTO ruling 10): the complete sequence, in order — each earlier question with its own
              answer, read like the latest one, no "Earlier" label and nothing folded away.
            */}
            {opened !== null && !openedInLive && openedEarlier.length > 0 && (
              <section
                data-ask="earlier"
                data-ask-restored=""
                aria-label={r2s.earlier}
                className="mb-5 flex flex-col gap-2"
              >
                {openedEarlier.map((turn, i) => (
                  <div key={`restored-${i}`} data-ask="earlier-turn" data-ask-read="r4">
                    <AskR2TurnView
                      canSave={!guestMode}
                      turn={turn}
                      locale={interfaceLocale}
                      context={context}
                      displayOnly
                    />
                  </div>
                ))}
              </section>
            )}
            {opened !== null && !openedInLive && (
              <div data-ask-latest={r2.turns.length === 0 ? '' : undefined}>
                <AskR2TurnView
                  canSave={!guestMode}
                  turn={opened}
                  locale={interfaceLocale}
                  context={context}
                  displayOnly
                  onUseQuestion={draftQuestion}
                  /* Design D7 — a stored answer read back: its date line and Refresh reporting. */
                  reopenedAt={opened.operation?.acceptedAt ?? null}
                  onRefresh={guestMode ? undefined : (q) => void resubmit(q)}
                />
              </div>
            )}
            {earlierR2.length > 0 && (
              <section
                data-ask="earlier"
                aria-label={r2s.earlier}
                className="mb-5 flex flex-col gap-2"
              >
                {/* CTO R3 ruling 10 — the live conversation's earlier turns, in full and in order. */}
                {earlierR2.map((turn, i) => (
                  <div key={`r2-${i}`} data-ask="earlier-turn" data-ask-read="r4">
                    <AskR2TurnView
                      canSave={!guestMode}
                      turn={turn}
                      locale={interfaceLocale}
                      context={context}
                      onRunDeeper={guestMode ? undefined : (q) => void r2.runDeeper(q)}
                    />
                  </div>
                ))}
              </section>
            )}
            {latestR2 !== undefined && (
              <div data-ask-latest="">
                <AskR2TurnView
                  canSave={!guestMode}
                  turn={latestR2}
                  locale={interfaceLocale}
                  context={context}
                  onRunDeeper={guestMode ? undefined : (q) => void r2.runDeeper(q)}
                  onUseQuestion={draftQuestion}
                  onRefresh={guestMode ? undefined : (q) => void resubmit(q)}
                  /* Design D2 — the failed turn's own panel resends the kept draft. */
                  onRetry={retryKept && !isPending ? () => void ask() : undefined}
                />
                {guestMode && latestR2.uncounted === true && (
                  <p data-ask="guest-not-counted" className="mt-2 text-[13px] text-[var(--ask-read-ink2,#8fa6c0)]">
                    {g.notCounted}
                  </p>
                )}
              </div>
            )}
            {followId !== null && !guestMode && (
              <AskFollowCheck
                followId={followId}
                turns={r2.turns}
                locale={interfaceLocale}
                onDraft={setQuestion}
              />
            )}
            {guestExhausted && (
              /*
                ASK GUEST TRIAL R3 — BELOW the full answer, never over it: every answer and
                citation stays readable. Sign-in continues THIS conversation; the unsent
                question waits in the composer and is not sent on return.
              */
              <section data-ask="guest-continue" role="status" className="mb-6 mt-2">
                <div className="flex flex-col items-start gap-3 rounded-[12px] border border-[var(--ask-read-control-line,#2a6d9e)] [background:var(--ask-read-answer-bg,linear-gradient(#08263f,#051a2e))] p-3.5 md:p-5">
                  <span className="inline-flex h-[26px] items-center rounded-[6px] border border-[var(--ask-read-control-line,#2a6d9e)] bg-[var(--ask-read-sunk,#0a2a47)] px-2.5 text-[0.75rem] font-bold text-[var(--ask-read-control-ink,#bfe3fb)]">
                    {g.exhaustedTitle}
                  </span>
                  <p className="text-[16px] leading-[1.55] text-[var(--ask-read-ink,#cfe2f2)]">{g.exhaustedBody}</p>
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
            {retryKept && !isPending && latestR2?.payload != null && (
              /*
                Design D2 — a failure that produced no failed turn of its own (e.g. a Refresh
                reporting re-send) is said here, in the same panel; a failed turn says it itself.
              */
              <section data-ask="failure" role="alert" className="gna-ask-failure">
                <p data-ask="retry-kept">{r2s.retryKept}</p>
                <button type="button" data-ask="try-again" onClick={() => void ask()}>
                  {sevenStrings.errorRetry}
                </button>
              </section>
            )}
            {isPending && (
              <section data-ask="pending" className="mb-5">
                {/* A5: no visible "you asked" label; the bubble carries the question, the name stays for AT */}
                <p className="sr-only">{r2s.youAsked}</p>
                <AskSubmittedQuestion
                  question={r2.pending ?? ''}
                  headingClassName={styles.question}
                  showFullLabel={r2s.showFullQuestion}
                  showLessLabel={r2s.showLessQuestion}
                />
                {/* ASK READING EXPERIENCE R1 — one truthful working line; the 1.8 s simulated
                    stage timer is retired from Ask (H-FREEZE §5). */}
                <AskProgressRunning locale={interfaceLocale} label={r2s.working} />
              </section>
            )}
          </div>
        </div>
      </div>

      <div
        data-ask="composer-footer"
        /* R3 FULL DESIGN — focusing a desktop welcome entry under the centred composer is not
           typing; counting it as typing unmounted the entry in the middle of its own click. */
        onFocusCapture={(event) => {
          if ((event.target as HTMLElement).closest?.('[data-ask="welcome-entries-desktop"]') != null) return;
          setComposerFocused(true);
        }}
        onBlurCapture={() => setComposerFocused(false)}
        className={styles.composerBar}
      >
        {newBelow && (
          <div className="mx-auto mb-2 flex max-w-[760px] justify-center px-4 md:px-1">
            <button
              type="button"
              data-ask="new-answer"
              onClick={() => {
                if (reader.current) reader.current.scrollTop = reader.current.scrollHeight;
                setNewBelow(false);
              }}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--ask-read-line,#1d4a73)] bg-[var(--ask-read-sunk,#06223d)] px-4 text-[13px] font-semibold text-[var(--ask-read-ink,#cfe2f2)]"
            >
              {r2s.newAnswerBelow} <span aria-hidden="true">↓</span>
            </button>
          </div>
        )}
        {askUnavailable && (
          <p
            data-ask="ask-unavailable"
            role="status"
            className="mx-auto mb-2 max-w-[760px] px-4 md:px-1 text-[13px] leading-[1.45] text-[var(--ask-read-deep-ink,#c9b27a)]"
          >
            {r2s.unified.askUnavailable}
          </p>
        )}
        {r2.contextRefused !== null && (
          <p
            data-ask="context-unavailable"
            role="status"
            className="mx-auto mb-2 max-w-[760px] px-4 md:px-1 text-[13px] leading-[1.45] text-[var(--ask-read-deep-ink,#c9b27a)]"
          >
            {r2s.unified.contextUnavailable}
          </p>
        )}
        {notice !== null && (
          <p
            data-ask="guest-notice"
            role="status"
            className="mx-auto mb-2 max-w-[760px] px-4 md:px-1 text-[13px] leading-[1.45] text-[var(--ask-read-deep-ink,#c9b27a)]"
          >
            {notice}
          </p>
        )}
        {guestMode && (
          /* ASK GUEST TRIAL R3 — the server-authoritative counter; sign-in stays voluntary. */
          <div
            data-ask="guest-counter"
            className="mx-auto mb-2 flex max-w-[760px] items-center justify-between gap-3 px-4 md:px-1 text-[12.5px] text-[var(--ask-read-ink2,#8fa6c0)]"
          >
            <span>{g.remaining(guestRemaining)}</span>
            <button
              type="button"
              data-ask="guest-sign-in-optional"
              onClick={() => void r2.continueWithSignIn(question)}
              className="inline-flex min-h-11 items-center px-2 font-semibold text-[var(--ask-read-control-ink,#93cdf5)] underline-offset-2 hover:underline"
            >
              {g.signInOptional}
            </button>
          </div>
        )}
        <div className={styles.composerGrid}>
          {/* Design C5 — Saved feedback, above the composer; it never covers the toolbar. */}
          <AskToastSlot />
          {/* Design F5 — the story / record / comparison context, removable, above the composer. */}
          <div data-ask="context-chips" className="flex flex-wrap gap-2 empty:hidden">
        {compareContext && (
          <div data-ask="context" data-ask-context-kind="SELECTION" className={styles.contextChip}>
            <span className="truncate">
              {/* R4 · PHASE B — was a bare ternary with a hand-rolled {n} substitution. */}
              {shell.askContextStrings.comparingStories(compareContext.length)}
            </span>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center"
              aria-label={t.controls.removeContext}
              onClick={() => setCompareRemovedFor(urlKey)}
            >
              ×
            </button>
          </div>
        )}
        {!compareContext && moduleContext && (
          <div data-ask="context" data-ask-context-kind="MODULE" className={styles.contextChip}>
            <span className="truncate" {...isolatedAuto()}>
              {moduleContext.label || shell.askRecordStrings.moduleRecord[moduleContext.ref.module]}
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
        {!compareContext && !moduleContext && context && (
          <div data-ask="context" className={styles.contextChip}>
            <span className="truncate" {...isolatedAuto()}>
              {/* TRUST R1 — a country-only context (Map → Ask) names its place; it had an empty title. */}
              {context.title
                ? /* Design F5 — a STORY context reads "About this story: <title>". */
                  r2s.read.aboutStory(context.title)
                : context.countryCode
                  ? (askCountryName(context.countryCode, interfaceLocale) ?? context.countryCode)
                  : ''}
            </span>
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
          </div>
          <Composer
            value={question}
            onChange={(next) => {
              setQuestion(next);
              /* R1-C · typing stops the rotation at once. The value is READ, never written. */
              rotatingExample.onValue(next);
            }}
            inputLabel={dict.askAi.inputLabel}
            /* R4 · same bounded hint, so the placeholder and the empty-state title cannot
               disagree in any locale. */
            /* Design A1/A5 — "Ask anything…" before the first question, "Ask a follow-up…" after. */
            placeholder={entryState ? r2s.read.placeholderFirst : r2s.read.placeholderFollowUp}
            submitLabel={dict.askAi.submit}
            /* ASK DESIGN AUTHORITY R3 (CTO ruling 3) — no operational / cost line under the
               composer on standalone Ask; a frame mounted elsewhere keeps it as before. */
            costNote={nav === null ? t.states.costNotConfigured : undefined}
            /* R4 · still EN/PL copy, so it isolates inside an RTL scope. */
            costNoteProps={foreignCopy}
            onSubmit={() => void ask()}
            pending={isPending}
            /* Design A3 — the field grows to min(168 px, 40 % of the visible height), then scrolls.
               The Alpha line's R2 input-limit contract (limitCopy) is kept as it was. */
            maxHeight={168}
            limitCopy={r2s}
            /*
              SUPERSEDED BY PRODUCT OWNER DIRECTIVE 9 Oct 2026 / CLAUDE DESIGN R3 §11 (R1-C).

              The superseded position, kept on the record with its reasoning:

                "ASK DESIGN AUTHORITY R3 — NO ROTATING EXAMPLE IN THE FIELD. The Design composer
                 (A1, F2, every frame) shows only its static placeholder 'Ask anything…'; the
                 example is the quiet sentence in the welcome group (text, not a control)."

              R1-C reverses the first half and keeps the second: "one example at a time fades
              inside the empty, unfocused composer (5.2 s hold, 400 ms fades)", and it is still
              not a control — the layer takes no pointer events, the words are `aria-hidden`
              plain text, nothing is typed, tapped, submitted or announced, and the field's own
              accessible name (`inputLabel`, via the `sr-only` label) never changes. The static
              placeholder below is still what a reduced-motion reader sees, and the only thing
              an empty field shows once the reader types or focuses it.

              H-R3-1 IS RESOLVED (CTO DESIGN R3 REVIEW, 9 Oct 2026). H raised that a desktop
              reader would see a rotating example in the field AND a static one under it. The
              ruling removes the static sentence in both places, so the rotating questions are
              now the only examples on the entry screen, and they are only ever inside the empty,
              unfocused composer.
            */
            exampleFocus={{ onFocus: rotatingExample.onFocus, onBlur: rotatingExample.onBlur }}
            example={
              rotatingExample.visible && rotatingExample.text !== null
                ? {
                    text: rotatingExample.text,
                    id: rotatingExample.id ?? '',
                    onFocus: rotatingExample.onFocus,
                    onBlur: rotatingExample.onBlur,
                    animationClass: rotatingExample.animate ? styles.exampleEnter : undefined,
                    /* R1-C · 400 ms out, swap, 400 ms in. The view transitions one element. */
                    fading: rotatingExample.fading,
                    generation: rotatingExample.generation,
                    /* The example's own run direction, independent of the reader's chrome. */
                    directionProps: isolatedAuto(),
                  }
                : undefined
            }
          />
          {/* R3 FULL DESIGN · desktop ≥1024: §Composition 6–8 sit under the centred composer. */}
          {entryState && !typing && (
            <AskWelcomeEntries
              locale={interfaceLocale}
              signedIn={signedInReader}
              latest={resumeConversation}
              onOpenJobs={() => setJobSheetOpen(true)}
              placement="desktop"
            />
          )}
          {/*
            Design F2 put a copy of the example sentence under the centred composer on desktop.
            REMOVED BY CTO DESIGN R3 REVIEW, 9 Oct 2026 (H-R3-1), together with the welcome
            group's own copy: with R1-C's rotation inside the field, a static example beside it
            was the redundancy H raised. `r2s.read.welcomeExample` is left in the catalogue
            untouched — removing a qualified key is Claude L's call, not this lane's.
          */}
        </div>
        {/* TRUST R1 §12 — the Privacy Notice and Cookies notice, reachable before sign-in and
            before the first question, without interrupting the conversation. ASK DESIGN
            AUTHORITY R3 (CTO ruling 3): on standalone Ask they are the quiet legal row of the
            conversations footer (drawer / column), not a line under the composer. */}
        {nav === null && (
        <p
          data-ask="privacy-links"
          className="mx-auto mt-1 flex max-w-[760px] gap-3 px-4 md:px-1 text-[0.75rem] text-[var(--ask-read-ink3,#6f89a8)]"
        >
          <a href="/privacy" className="underline-offset-2 hover:underline">
            {r2s.privacyLink}
          </a>
          <a href="/cookies" className="underline-offset-2 hover:underline">
            {r2s.cookiesLink}
          </a>
        </p>
        )}
      </div>
      {entryState && (
        /*
          CENTERED COMPOSER R1 — the flexible spacer below the composer bar. It exists only in
          the entry state and only to lift the heading + composer pair to the optical centre;
          it holds no content and is invisible to assistive technology.
        */
        <div data-ask="entry-spacer" aria-hidden="true" className={styles.entrySpacer} />
      )}
      {jobSheetOpen && (
        <AskJobSetupSheet
          locale={interfaceLocale}
          onClose={closeJobSheet}
          onAskGeneral={() => {
            setJobSheetOpen(false);
            requestAnimationFrame(() =>
              document.querySelector<HTMLTextAreaElement>('[data-ask="composer-input"]')?.focus(),
            );
          }}
        />
      )}
      {r2.deepQuote !== null && (
        <AskDeepConfirm
          locale={interfaceLocale}
          onConfirm={() => void r2.confirmDeeper()}
          onCancel={() => void r2.cancelDeeper()}
        />
      )}
      </AskToastProvider>
      </AskSourcesPanelProvider>
    </main>
  );
}
