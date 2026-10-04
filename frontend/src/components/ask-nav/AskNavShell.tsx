'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { DisplayLocale, LanguageCode } from '@globalnews-ai/shared';
import { accountSignInUrl } from '@/lib/api/accountBase';
import {
  askLocation,
  cleanAskDestination,
  isAskConversationSurface,
  isPlainClick,
} from '@/lib/ask/askCleanNavigation';
import { useAccount } from '@/lib/hooks/useAccount';
import { persistLanguageSelection, displayLocaleOf } from '@/lib/i18n/languages';
import { LanguageSelector } from '@/components/search/LanguageSelector';
import { ThemeControl, ThemeScopeContext } from '@/components/platform/ThemeControl';
import type { ThemePreference } from '@/lib/theme/theme';
import type { AskNavStrings } from '@/lib/ask/askNavStrings';
import {
  askMenuFor,
  askUtilitiesFor,
  type AskMenuAudience,
  type AskMenuEntry,
} from '@/lib/askNavModel';
import styles from './askNav.module.css';
import { askProductName, askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { askDirectionProps } from '@/lib/ask/askDirection';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE STANDALONE ASK NAVIGATION SHELL — Ask GlobalNewsAI Public Beta
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHAT THIS REPLACES, AND WHY IT IS A REPLACEMENT RATHER THAN AN EDIT.
 *
 * `/ask` rendered the platform `NavBar`. That bar is the GlobalNewsAI PLATFORM
 * header: it carries the platform wordmark linking to `/`, a Search control, and
 * an account menu whose rows are `/my-intelligence`, `/history`,
 * `/account/settings` and `/support`. Four of those destinations are on the
 * Product Owner's removal list for the standalone Ask navigation, and `/history`
 * is the legacy Search history that must never be presented as Ask Recent. There
 * is no subset of NavBar that is the ruled Ask menu, so /ask gets its OWN shell
 * and NavBar is left BYTE-IDENTICAL for the twenty-odd other routes that are
 * still the platform. This is a one-line swap in app/ask/page.tsx.
 *
 * ── THE TWO-VIEWPORT PROBLEM, WHICH IS THE REAL WORK HERE ──────────────────
 *
 * D25 makes phone Ask FULL SCREEN: askDashboard.module.css turns `.frame` into
 * `position: fixed; inset: 0; z-index: 60` under
 * `(max-width: 860px), (orientation: portrait) and (max-width: 1100px)`.
 *
 * A header at z-50 is therefore PAINTED OVER on a phone. That is not a styling
 * detail — it is the reason a signed-in reader on a phone currently has NO
 * reachable way to sign out, change language, open Settings or reach Help from
 * `/ask`: the platform NavBar's hamburger is behind an opaque full-screen layer.
 * Verified by inspection, not assumed: NavBar's mobile row is z-50 inside a
 * z-50 <header>; the Ask frame is z-60 and covers the viewport.
 *
 * So this shell has two presentations of ONE model:
 *
 *   ≥ the full-screen threshold   a 62px bar above the Ask frame (`.shell`).
 *   below it                      a trigger inside D25's own 56px phone header,
 *                                 opening a z-80 drawer (`.drawer`).
 *
 * WHY 62px IS NOW A FREE CHOICE, AND WHAT REPLACED THE CONSTRAINT.
 *
 * Before PR #66 the frame sized itself from a one-time JS measurement,
 * `calc(var(--ask-visible-height,100dvh) - var(--ask-top, 62px))`, so the bar
 * had to be exactly 62px or the surface resized on hydration. THE COMPOSER
 * CLIPPING FIX IN #66 DELETED THAT MECHANISM. `--ask-top` is gone; the route is
 * now one viewport-high flex column (`.page`: `height:100dvh; overflow:hidden`)
 * in which `.page > header` is `flex-shrink: 0` and `.frame` is `flex: 1 1 0`.
 * The frame takes exactly the height the header leaves, BY CONSTRUCTION, at
 * every height and in every phase.
 *
 * Two consequences this file depends on:
 *
 *   1  This component's root MUST be a `<header>` and MUST be a direct child of
 *      `.page`, or `.page > :global(header) { flex-shrink: 0 }` does not apply
 *      and the bar can be squeezed. `AskNavProvider` renders no element and
 *      neither does `Suspense`, so the header stays a direct child.
 *
 *   2  There is no longer any measurement to desynchronise, so no overlap and
 *      no 1px gap are possible between bar and frame — and the page cannot
 *      become a scroll container, because `.page` is fixed-height and hidden.
 *      The runtime harness asserts all four rather than assuming them.
 *
 * 62px is therefore kept because it is the released header rhythm, not because
 * the geometry forces it.
 *
 * ── THE PHONE TRIGGER LIVES IN D25's OWN HEADER, AND COSTS NO GEOMETRY ─────
 *
 * It has to live there: every alternative hides ruled content. A z-61 bar of
 * our own covers D25's header entirely, and a floating corner control sits on
 * top of either the ruled back/close button or the ruled source-count readout.
 *
 * An earlier iteration gave the frame a generic `navSlot?: React.ReactNode` and
 * rendered a FOURTH control into that header. CTO refused the generic slot — it
 * lets any caller render any tree into a frozen surface — and ruled the narrow
 * form instead, which is also the better design: the trigger REPLACES the left
 * control rather than adding to it, and only where that control is meaningless.
 * "Close" on a standalone application with no governed return destination
 * dismisses it to nowhere; where a real `return` exists, the ruled Back stays
 * and this shell contributes nothing. So the header still holds exactly three
 * controls at the same sizes, the title stays centred, and the right-hand state
 * readout is untouched. See lib/ask/askShellMenu.ts.
 *
 * ── COST ───────────────────────────────────────────────────────────────────
 *
 * ZERO AI and ZERO provider calls. The shell's only network call is the single
 * `GET /users/me` session read that `useAccount` performs once on mount — the
 * SAME read `AccountControl` performed here before, via the same hook, so the
 * request count on /ask is unchanged rather than merely small. `useAccount` is a
 * hook with local state and no provider, so calling it twice would mean two
 * reads: this file calls it EXACTLY ONCE and the drawer consumes that state
 * rather than reading again. Opening the menu, moving through it and changing
 * language issue nothing.
 */

interface AskNavState {
  readonly open: boolean;
  readonly setOpen: (next: boolean) => void;
  /**
   * ALPHA VISUAL ACCEPTANCE REPAIR R1 — true from the moment New question or Sign out is
   * pressed until the clean document navigation replaces the page. Every private Ask body
   * reads it (AskShellFrame, AskClearedBoundary) and renders nothing of the previous state.
   */
  readonly cleared: boolean;
  /** Hide private Ask content now, then load `url` as a fresh document. */
  readonly clearAndGo: (url: string) => void;
  /** Hide private Ask content now (sign-out clears before its request resolves). */
  readonly clear: () => void;
}

const AskNavContext = createContext<AskNavState | null>(null);

/**
 * Wraps the shell AND the Ask frame, because the trigger that opens the drawer
 * renders inside the frame's header while the drawer itself renders beside the
 * bar. One piece of state, two mount points.
 */
export function AskNavProvider({ children }: { readonly children: React.ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [cleared, setCleared] = useState(false);
  const clear = useCallback(() => {
    setOpen(false);
    setCleared(true);
  }, []);
  const clearAndGo = useCallback(
    (url: string) => {
      clear();
      askLocation.assign(url);
    },
    [clear],
  );
  const value = useMemo<AskNavState>(
    () => ({ open, setOpen, cleared, clearAndGo, clear }),
    [open, cleared, clearAndGo, clear],
  );
  return <AskNavContext.Provider value={value}>{children}</AskNavContext.Provider>;
}

export function useAskNav(): AskNavState {
  const context = useContext(AskNavContext);
  /*
   * Deliberately loud. A silently absent provider would render a trigger that
   * opens nothing — a dead control, which is the exact defect class this round
   * exists to remove. Failing at development time is the cheaper outcome.
   */
  if (context === null) {
    throw new Error('AskNav components must be rendered inside <AskNavProvider>.');
  }
  return context;
}

/**
 * The cleared flag without the loud failure: a private body that is also rendered outside
 * the standalone shell (platform mode) reads `false` there and behaves exactly as before.
 */
export function useAskNavCleared(): boolean {
  return useContext(AskNavContext)?.cleared ?? false;
}

/** The label a row renders. Falls back to the model's English wording so a
 *  missing key can never produce an unlabelled control; askNavShell.spec.ts
 *  asserts every labelKey resolves in both locales, so it is never reached. */
function labelOf(entry: AskMenuEntry, strings: AskNavStrings): string {
  const table = strings as unknown as Record<string, string | undefined>;
  return table[entry.labelKey] ?? entry.label;
}

const FOCUSABLE = 'a[href], button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])';

export function AskNavShell({
  language,
  selected,
  theme,
}: {
  readonly language: DisplayLocale;
  /**
   * SEVEN-LANGUAGE CORRECTION — THE READER'S OWN SELECTION, SHOWN BACK TO THEM.
   *
   * `language` indexes this shell's EN/PL label catalogue (`askNavStrings` is a total record
   * over two locales). It was also being used as the language selector's VALUE, which meant a
   * reader who chose Arabic saw the control read "English" — their own choice displayed back
   * to them as something they did not pick. Those are two different facts about two different
   * things, and conflating them downgraded seven-language support in the one control whose
   * entire job is to show it.
   *
   * Optional, defaulting to the old behaviour, so every caller that has not been updated
   * renders exactly as before.
   */
  readonly selected?: DisplayLocale;
  /**
   * TRUST & CONVERSATIONAL EXPERIENCE R1 — present only on a themed page (AskThemedPage): the
   * server-read preference, so the control's first frame matches. Absent → no theme control (a
   * page with no theme scope offers no switch that would change nothing).
   */
  readonly theme?: ThemePreference;
}): JSX.Element {
  const { open, setOpen, clearAndGo, clear } = useAskNav();
  /* TRUST R1 — the page passes its server-read theme, or the nearest theme scope supplies it. */
  const scopeTheme = useContext(ThemeScopeContext);
  const controlTheme = theme ?? scopeTheme ?? undefined;
  const pathname = usePathname();
  const router = useRouter();
  /* THE ONE SESSION READ. See this file's header. */
  const { user, isLoading, signOut } = useAccount();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(false);

  const s = askShellStrings(language).askNavStrings;
  /* R4 · PHASE B — the shell's own direction scope. See the note at the header below. */
  const shellDirection = askDirectionProps(language);
  const audience: AskMenuAudience = user === null ? 'signed-out' : 'signed-in';
  const items = askMenuFor(audience);
  const utilities = askUtilitiesFor(audience);
  const signInEntry = utilities.find((entry) => entry.action === 'signIn');
  const signOutEntry = utilities.find((entry) => entry.action === 'signOut');
  const languageEntry = utilities.find((entry) => entry.action === 'language');

  /* The reader's own selection when the caller knows it; the catalogue locale otherwise. */
  const selectedLocale: DisplayLocale = selected ?? displayLocaleOf(language);

  const changeLanguage = useCallback(
    (next: DisplayLocale): void => {
      /* NavBar's guard, kept verbatim in behaviour: re-selecting the current
         language is a complete no-op, so it cannot cost a reload. */
      if (next === selectedLocale) return;
      persistLanguageSelection(next);
      /*
        ALPHA VISUAL ACCEPTANCE REPAIR R1 — the same two steps as the platform NavBar: persist,
        then re-render the Server Components that read the cookie, so the shell AND the page
        switch language at once. Client state (an open conversation) is kept; no AI call.
      */
      router.refresh();
    },
    [selectedLocale, router],
  );

  /*
    ALPHA VISUAL ACCEPTANCE REPAIR R1 — SIGN OUT CLEARS PRIVATE ASK CONTENT IMMEDIATELY.
    Clear first (nothing of the signed-in reader stays visible while the request runs), then
    end the session, then load the clean Ask opening screen as a new document so no client
    state of the previous account survives. If the request failed, that fresh load tells the
    truth about the session instead of a signed-out header over signed-in content.
  */
  const signOutClean = useCallback(async (): Promise<void> => {
    clear();
    try {
      await signOut();
    } catch {
      /* the fresh load below shows the session as it really is */
    }
    askLocation.assign(cleanAskDestination(pathname));
  }, [clear, signOut, pathname]);

  /*
    ALPHA VISUAL ACCEPTANCE REPAIR R1 — NEW QUESTION STARTS A NEW QUESTION. On an Ask
    conversation surface a same-route <Link> does not remount the frame, so it is replaced by
    one explicit action: clear, then a clean document load. Elsewhere (Recent, Saved, Help,
    Settings) the ordinary route change already mounts a fresh Ask frame.
  */
  const onNewQuestion = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    if (!isAskConversationSurface(pathname) || !isPlainClick(event)) return;
    event.preventDefault();
    clearAndGo(cleanAskDestination(pathname));
  };

  /* Desktop account disclosure — Escape and outside pointerdown, the same two
     dismissals AccountControl uses, so the two menus behave identically. */
  useEffect(() => {
    if (!accountOpen) return;
    function onPointerDown(event: PointerEvent): void {
      if (accountRef.current !== null && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setAccountOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [accountOpen]);

  /*
   * FOCUS RETURNS TO THE TRIGGER THAT OPENED THE DRAWER.
   *
   * Queried from the DOM rather than held as a ref on purpose: the trigger is
   * rendered by AskFrameScreen from the `shellMenu` contract, and passing a ref
   * back up would re-couple the frame to this component — the very coupling the
   * narrow contract exists to avoid. `data-ask="shell-menu"` is that control's
   * stable handle, and askNavShell.spec.ts asserts the frame still carries it.
   */
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    document.querySelector<HTMLElement>('[data-ask="shell-menu"]')?.focus();
  }, [open]);

  /*
   * Drawer keyboard contract. Escape closes, and Tab is CONTAINED.
   *
   * Containment is not a nicety here: the drawer sits at z-80 over a
   * full-screen Ask frame that is still in the document, so without it a
   * keyboard reader tabbing past the last row lands on the composer underneath
   * an opaque overlay with no visible focus. That is a trap in the other
   * direction, and it is the reason this is implemented rather than deferred.
   */
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        /* ALPHA VISUAL ACCEPTANCE REPAIR R1 — an open language list closes first; the next
           Escape closes the drawer. */
        const active = document.activeElement;
        if (
          active !== null &&
          drawerRef.current?.contains(active) === true &&
          active.getAttribute('aria-expanded') === 'true'
        ) {
          return;
        }
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || drawerRef.current === null) return;
      const nodes = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (first === undefined || last === undefined) return;
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, setOpen]);

  const itemClass =
    'flex min-h-11 items-center rounded-[9px] px-3 font-cd-body text-[14px] text-[#cfe2f2] transition-colors hover:bg-[rgba(56,189,248,0.10)] hover:text-white';
  const drawerRowClass = 'flex min-h-[52px] items-center font-cd-body text-[17px] text-[#e6eef6]';

  function renderRoutes(className: string, onNavigate?: () => void): JSX.Element[] {
    return items.map((entry) => (
      <Link
        key={entry.id}
        href={entry.href ?? '/ask'}
        prefetch={false}
        data-ask-nav="item"
        data-ask-nav-id={entry.id}
        className={className}
        onClick={(event) => {
          if (entry.id === 'new-question') onNewQuestion(event);
          onNavigate?.();
        }}
      >
        {labelOf(entry, s)}
      </Link>
    ));
  }

  /* Matches AccountControl's loading branch: a reserved, empty, aria-hidden box
     of the same size, so the bar does not reflow when the session resolves and
     no reader is briefly told they are signed out. */
  const accountSlot =
    isLoading || signInEntry === undefined ? null : (
      <a
        href={accountSignInUrl(pathname ?? undefined)}
        data-ask-nav="utility"
        data-ask-nav-id={signInEntry.id}
        className="flex min-h-11 items-center rounded-[9px] border border-[#1d4a73] px-3 font-cd-body text-[14px] text-[#cfe2f2] hover:border-[rgba(34,211,238,0.55)]"
      >
        {labelOf(signInEntry, s)}
      </a>
    );

  return (
    <>
      {/*
        R4 · PHASE B — ARABIC RTL ACROSS THE WHOLE LOCALIZED SURFACE, NOT JUST THE FRAME.

        The Ask FRAME has carried a `lang`/`dir` scope since the direction work landed
        (`AskFrameScreen`), but this shell sits OUTSIDE it — and this shell is where every
        defect the Product Owner named by hand lives: New question, Recent, Saved,
        Help & feedback, Settings, Account, the language menu. An Arabic reader got RTL
        answers under a left-to-right navigation bar, which is the mixed-direction version of
        the mixed-language defect.

        Both values come from `askDirectionProps`, which reads the shared contract's own
        direction table. Nothing here decides a direction; a component that computed its own
        would be the second authority the shared contract exists to prevent.
      */}
      <header
        data-ask-nav="shell"
        lang={shellDirection.lang}
        dir={shellDirection.dir}
        data-ask-nav-dir={shellDirection.dir}
        data-ask-nav-audience={isLoading ? 'pending' : audience}
        className={`${styles.shell} sticky top-0 z-50 h-[62px] items-center border-b border-[#0a2744] bg-[rgba(2,15,32,0.96)] backdrop-blur-[10px]`}
      >
        <div className="mx-auto flex h-[62px] w-full max-w-cd-page items-center gap-6 px-[26px]">
          {/*
            IDENTITY, NOT NAVIGATION. The wordmark is plain text with no href on
            purpose: a link here would point at `/ask`, duplicating New question
            exactly, and the Product Owner's ruled set is explicit — adding a
            control that is on neither the keep list nor the remove list is not
            this round's decision to make. The string is the frozen D25 title.
          */}
          <span className="shrink-0 font-cd-display text-[15px] font-semibold tracking-[-0.01em] text-white">
            {askProductName(language)}
          </span>

          <nav aria-label={s.navAriaLabel} className="flex items-center gap-1">
            {renderRoutes(itemClass)}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {languageEntry !== undefined && (
              <LanguageSelector
                /* R4 · the selector speaks the contracted seven; this crossing is named once. */
                value={selectedLocale}
                onChange={changeLanguage}
                label={s.language}
                actionLabel={s.languageSelectorAction}
                variant="desktop"
              />
            )}
            {controlTheme !== undefined && (
              <ThemeControl
                language={language as LanguageCode}
                initial={controlTheme}
                tone="surface"
              />
            )}
            {accountSlot}
            {/*
              SIGN OUT IS DISCLOSED, NOT INLINE. It is the only entry the model
              marks `destructive`, and the governing rule keeps destructive
              actions out of the navigation row itself. A one-item menu is the
              correct shape here, not an oversight.

              NO ACCOUNT EMAIL. An earlier draft of this menu printed "Signed in
              as <address>", copying AccountControl's identity row. That is
              pinned authority: headerAccountPrivacy.spec.ts holds the list of
              files allowed to render an account address CLOSED at exactly two —
              AccountControl and /account/settings — after the R4 defect where an
              address appeared in the public header of nine surfaces. Its own
              test caught this file as a third. Widening an accepted privacy pin
              is not this lane's decision, and the address was never in the
              Product Owner's ruled set, so the row is GONE rather than
              permitted. The reader's identity is not needed to sign out.
            */}
            {!isLoading && user !== null && signOutEntry !== undefined && (
              <div ref={accountRef} className="relative">
                {/*
                  STANDALONE PUBLIC BETA CONVERGENCE R1 — a DISCLOSURE, not an ARIA menu.
                  role="menu"/"menuitem" promises arrow-key roving focus, typeahead and
                  Home/End that this one-item panel does not implement; a button that
                  expands a region, with plain buttons inside, is the honest pattern and
                  is fully usable with Tab, Enter and Space.
                */}
                <button
                  type="button"
                  aria-expanded={accountOpen}
                  aria-controls="ask-nav-account-panel"
                  aria-label={s.accountMenuAriaLabel}
                  onClick={() => setAccountOpen(!accountOpen)}
                  className="flex min-h-11 items-center rounded-[9px] border border-[#1d4a73] px-3 font-cd-body text-[14px] text-[#cfe2f2] hover:border-[rgba(34,211,238,0.55)]"
                >
                  {s.account}
                </button>
                {accountOpen && (
                  <div
                    id="ask-nav-account-panel"
                    data-ask-nav="account-menu"
                    className="absolute end-0 top-[calc(100%+6px)] z-[60] flex w-[240px] flex-col gap-1 rounded-[10px] border border-[#1d4a73] bg-[rgba(2,15,32,0.98)] p-2"
                  >
                    <button
                      type="button"
                      data-ask-nav="utility"
                      data-ask-nav-id={signOutEntry.id}
                      onClick={() => void signOutClean()}
                      className="flex min-h-11 items-center rounded-[8px] px-2 text-start font-cd-body text-[14px] text-[#cfe2f2] hover:bg-[rgba(56,189,248,0.10)]"
                    >
                      {labelOf(signOutEntry, s)}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {open && (
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label={s.navAriaLabel}
          data-ask-nav="drawer"
          data-ask-nav-audience={isLoading ? 'pending' : audience}
          className={styles.drawer}
        >
          <div className={styles.drawerHead}>
            <span className="font-cd-display text-[15px] font-semibold text-white">
              {askProductName(language)}
            </span>
            <button
              ref={closeRef}
              type="button"
              aria-label={s.closeMenuAriaLabel}
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-[20px] text-[#cfe2f2]"
            >
              ×
            </button>
          </div>

          <nav aria-label={s.navAriaLabel} className={styles.drawerGroup}>
            {renderRoutes(drawerRowClass, () => setOpen(false))}
          </nav>

          <div className={styles.drawerGroup}>
            {languageEntry !== undefined && (
              <div className="flex min-h-[52px] items-center">
                <LanguageSelector
                  value={selectedLocale}
                  onChange={changeLanguage}
                  label={s.language}
                  actionLabel={s.languageSelectorAction}
                  variant="mobile"
                  anchor="self"
                />
              </div>
            )}
            {controlTheme !== undefined && (
              <div className="flex min-h-[52px] items-center" data-ask-nav="theme">
                <ThemeControl
                  language={language as LanguageCode}
                  initial={controlTheme}
                  tone="surface"
                />
              </div>
            )}
            {!isLoading && signInEntry !== undefined && (
              <a
                href={accountSignInUrl(pathname ?? undefined)}
                data-ask-nav="utility"
                data-ask-nav-id={signInEntry.id}
                className={drawerRowClass}
              >
                {labelOf(signInEntry, s)}
              </a>
            )}
            {!isLoading && user !== null && signOutEntry !== undefined && (
              <>
                <button
                  type="button"
                  data-ask-nav="utility"
                  data-ask-nav-id={signOutEntry.id}
                  onClick={() => {
                    setOpen(false);
                    void signOutClean();
                  }}
                  className={`${drawerRowClass} text-start`}
                >
                  {labelOf(signOutEntry, s)}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
