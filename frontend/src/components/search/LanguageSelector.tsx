'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { ACTIVE_LANGUAGES, LANGUAGE_NATIVE_LABELS } from '@/lib/i18n/languages';

export type LanguageSelectorVariant = 'desktop' | 'mobile';

interface LanguageSelectorProps {
  value: LanguageCode;
  onChange: (language: LanguageCode) => void;
  /** navBar.languageSelectorLabel — "Language" / "Jezyk". */
  label: string;
  /** M66.11 — navBar.languageSelectorAction — "Select language" / "Wybierz jezyk". */
  actionLabel: string;
  /**
   * M66.11 — which released chrome this instance belongs to. Desktop and mobile
   * are two DIFFERENT released presentations of ONE control (CTO decision D-3:
   * the divergence is existing approved chrome and is kept), so this is a
   * presentation switch, never a second implementation. Every behaviour below —
   * the state machine, the ARIA model, the commit path — is shared.
   */
  variant?: LanguageSelectorVariant;
}

/**
 * M66.11 — CUSTOM LANGUAGE SELECTOR. GN-CD-M66.11, released 2026-08-20.
 *
 * WHAT THIS REPLACES. Until now this component rendered a native <select>. The
 * collapsed control could be styled; the dropped list could not, because the
 * browser paints it outside the page's compositing tree. On Windows/Chrome that
 * surface rendered white on a dark application. M66.8a's `color-scheme: dark`
 * was the only standards-based lever available at the time and it was integrated
 * and then FAILED visual acceptance — which is what authorized this rebuild.
 *
 * That declaration is NOT removed (CTO decision 2). It still governs UA-owned
 * scrollbars, the canvas backdrop and the four other native controls in this
 * application. GN-CD-M66.11 §14's "delete the mitigation" instruction is correct
 * about the <select> and over-broad about a `:root` declaration.
 *
 * THE ARCHITECTURE IS PRESCRIBED, NOT CHOSEN. §7 names one pattern: a native
 * <button role="combobox"> plus an authored role="listbox" popup, with focus
 * STAYING ON THE TRIGGER for the whole interaction and the active row
 * communicated by aria-activedescendant. No visually hidden <select> is retained
 * — two announcements of one control is worse than either alone, and it would
 * leave the native popup keyboard-reachable, which is the defect being removed.
 *
 * WHAT DID NOT CHANGE, AND MUST NOT.
 *   - ACTIVE_LANGUAGES is still the only source of which languages exist, and
 *     LANGUAGE_NATIVE_LABELS the only source of their names. Neither 'English'
 *     nor 'Polski' appears as a literal in this file — a rule M66.8a asserted
 *     and M66.11 keeps.
 *   - Persistence is still entirely the caller's. This component holds no
 *     localStorage, no cookie, no fetch and no router. It calls onChange and
 *     nothing else. NavBar.handleLanguageChange still runs
 *     persistLanguageSelection() then router.refresh(), unchanged.
 *   - Committing the already-selected language stays a complete no-op, because
 *     NavBar's existing `if (next === language) return;` guard already makes it
 *     one. No second guard is added here; duplicating it would create two places
 *     for that rule to live.
 *
 * NO ANIMATION. §12 is explicit and verified: zero transition, zero animation,
 * zero fade, zero slide, zero scale, and the chevron glyph is SWAPPED, never
 * rotated. There is no motion to suppress, so the component renders identically
 * under `prefers-reduced-motion: reduce` with no override.
 */
export function LanguageSelector({
  value,
  onChange,
  label,
  actionLabel,
  variant = 'desktop',
}: LanguageSelectorProps): JSX.Element {
  const isMobile = variant === 'mobile';

  /*
    INSTANCE-UNIQUE IDS. NavBar mounts this component TWICE on every page — once
    in the desktop header row, once in the mobile row — and both are in the DOM
    simultaneously, one hidden by the cd-header breakpoint rather than unmounted.
    A static id string would emit duplicate DOM ids and aria-activedescendant
    would resolve to whichever came first. useId() is the repository's own answer
    to exactly this problem: Logo.tsx uses it for its SVG gradient ids for the
    same reason (it renders in NavBar and Footer), and footerGeometry.spec.ts
    asserts it there.
  */
  const instanceId = useId();
  const listboxId = `${instanceId}-listbox`;
  const optionId = (code: LanguageCode): string => `${instanceId}-option-${code}`;

  const [isOpen, setIsOpen] = useState(false);
  const [activeCode, setActiveCode] = useState<LanguageCode>(value);
  /*
    §9 — the row's active RING is painted from component state, not a CSS
    pseudo-class, because focus never enters the popup. It must appear only when
    the active row was reached by KEYBOARD. When the pointer set it, the hover
    background is the correct and sufficient feedback, and a ring following the
    mouse would read as a bug.
  */
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback((): void => {
    setIsOpen(false);
  }, []);

  /** §6 — on open the active option is ALWAYS the currently selected one, never index 0. */
  const open = useCallback(
    (fromKeyboard: boolean): void => {
      setActiveCode(value);
      setIsKeyboardActive(fromKeyboard);
      setIsOpen(true);
    },
    [value],
  );

  /*
    §6 — the ONLY commit path. Reached from an option click and from Enter/Space
    while open. Arrow keys, Home and End can never reach it, which is what lets a
    keyboard user browse both options without firing the localization system and
    a Server Component refresh on every keypress.
  */
  const commit = useCallback(
    (code: LanguageCode): void => {
      setIsOpen(false);
      onChange(code);
      // §9 — explicit, because an option click may have moved focus to the row.
      triggerRef.current?.focus();
    },
    [onChange],
  );

  /** §6 — wrapping in both directions: (i + d + n) % n. */
  const moveActive = useCallback(
    (delta: number): void => {
      setIsKeyboardActive(true);
      setActiveCode((current) => {
        const index = ACTIVE_LANGUAGES.indexOf(current);
        const from = index === -1 ? ACTIVE_LANGUAGES.indexOf(value) : index;
        const next = (from + delta + ACTIVE_LANGUAGES.length) % ACTIVE_LANGUAGES.length;
        return ACTIVE_LANGUAGES[next] as LanguageCode;
      });
    },
    [value],
  );

  const jumpActive = useCallback((edge: 'first' | 'last'): void => {
    setIsKeyboardActive(true);
    setActiveCode(
      (edge === 'first'
        ? ACTIVE_LANGUAGES[0]
        : ACTIVE_LANGUAGES[ACTIVE_LANGUAGES.length - 1]) as LanguageCode,
    );
  }, []);

  /*
    §8 — CLICK-OUTSIDE. Every clause here is a stated requirement, not a
    preference:

      - `pointerdown`, not `click`: click fires too late and lets a click-through
        reach the element beneath. Not `mousedown` either — pointerdown covers
        mouse, touch and pen in ONE listener.
      - the listener target is `document`.
      - the wrapper ref owns BOTH the trigger and the popup, and the popup is NOT
        portalled, so a single `contains()` test is sufficient. If a future change
        portals the popup this test silently stops working and must be replaced by
        a two-element hit test.
      - the isOpen check comes FIRST. Here that is structural rather than a
        convention: the effect returns early while closed, so no listener is
        attached at all and there is nothing to leak.
      - cleanup is mandatory. §8 names its omission as the second-most likely
        regression in this work. This is the same attach/guard/teardown shape
        NavBar already uses for the mobile menu's Escape handler.

    Selection is UNCHANGED by an outside close, and focus is deliberately NOT
    forced back to the trigger — that would fight whatever the user clicked.

    NO SCROLL LISTENER (CTO decision 3). This repository has no nested mobile
    content scroll container and its header is `sticky`, so the popup travels with
    its trigger and cannot be orphaned. The geometric problem scroll dismissal
    exists to prevent does not occur here.
  */
  useEffect(() => {
    if (!isOpen) return undefined;

    function onPointerDown(event: PointerEvent): void {
      const wrapper = wrapperRef.current;
      if (wrapper && !wrapper.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  /*
    §6 — the full keyboard state machine, on the trigger, because focus never
    leaves it.

    Enter and Space are preventDefault-ed unconditionally. A native <button>
    synthesizes a click from both, so without this the popup would open from the
    keydown branch and immediately toggle shut again from the synthesized click.
    Tab is deliberately NOT prevented: it closes the popup and then lets focus
    move on normally.
  */
  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    const { key } = event;

    if (key === 'Tab') {
      if (isOpen) close();
      return;
    }

    if (key === 'Escape') {
      if (!isOpen) return;
      event.preventDefault();
      close();
      return;
    }

    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      if (isOpen) {
        commit(activeCode);
      } else {
        open(true);
      }
      return;
    }

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        open(true);
        return;
      }
      moveActive(key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (key === 'Home' || key === 'End') {
      // §6 — no effect while closed. CTO decision D-2 implements both for
      // pattern completeness even though, with exactly two options, they are
      // functionally identical to ArrowUp/ArrowDown today.
      if (!isOpen) return;
      event.preventDefault();
      jumpActive(key === 'Home' ? 'first' : 'last');
    }
  }

  /*
    §7 — composed from LOCALIZED strings plus the endonym the language model
    already supplies. Never a concatenated English template, and no new
    interpolation mechanism is introduced (this repository has none, and
    dictionaries/index.spec.ts guards against a second i18n mechanism).
      EN -> "Language: English. Select language"
      PL -> "Jezyk: Polski. Wybierz jezyk"
  */
  const triggerName = `${label}: ${LANGUAGE_NATIVE_LABELS[value]}. ${actionLabel}`;

  /*
    §2 / §5 — TRIGGER GEOMETRY. Padding, border width, radius and font size are
    IDENTICAL in every state, which is what makes the "trigger never changes
    size, header cannot reflow on open" requirement structural rather than
    something to be checked by eye. Only colour, fill, outline and shadow differ
    between states below.

    The desktop values are the released GN-CD-026 pill, carried over unchanged
    from NavBar's own markup — same 9px radius, same 13/7 padding, same 13px
    label, same 13x13 cyan ring. The pill is not re-drawn here; it is re-hosted
    on a real <button>.
  */
  const triggerBase = isMobile
    ? 'inline-flex min-h-11 items-center gap-1.5 px-1 outline-none'
    : 'inline-flex items-center gap-2 rounded-[9px] border px-[13px] py-[7px] text-cd-action text-cd-ink-primary whitespace-nowrap outline-none focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-cd-edge-focus';

  const desktopTriggerState = isOpen
    ? 'border-cd-hub-core-m bg-cd-fill-control-open shadow-cd-control-open'
    : 'border-cd-edge-control hover:border-cd-hub-core hover:bg-cd-nav-hover focus-visible:border-cd-edge-focus focus-visible:bg-cd-hud-sky-06';

  const triggerClass = isMobile ? triggerBase : `${triggerBase} ${desktopTriggerState}`;

  /*
    §3 / §5 — POPUP GEOMETRY.

    DESKTOP anchors to the TRIGGER: right:0 on a position:relative wrapper that
    holds both, so the popup's right edge tracks the trigger's at any trigger
    width and any header width, with no JS measurement and no positioning
    library.

    MOBILE anchors to the HEADER: right:12px, expanding leftward from the
    viewport edge. NavBar's mobile header row carries the `relative` for this,
    which is why this wrapper is NOT relative on mobile. That is deliberate and
    is the whole reason no magic compensation offset is needed: `right-[12px]`
    means literally twelve pixels, measured from the same edge the design
    measured from. The 176px popup plus 24px of insets needs 200px, so it cannot
    overflow at any supported width down to 320px.

    z-[60] is arbitrary because Tailwind's zIndex scale stops at 50 and this
    milestone adds no zIndex key. Note that the header declares
    `backdrop-blur`, which creates a stacking context — so 60 wins INSIDE the
    header (above the z-40 menu overlay) while the header's own z-50 keeps the
    whole assembly above page content. The result is what the design asks for;
    the mechanism is one layer down from what §11 describes.
  */
  const popupClass = isMobile
    ? 'absolute right-[12px] top-[calc(100%+8px)] z-[60] box-border w-[176px] rounded-cd-12 border border-cd-edge-control-active-32 bg-cd-fill-popup p-cd-5 shadow-cd-popup-m'
    : 'absolute right-0 top-[calc(100%+8px)] z-[60] box-border w-[168px] rounded-cd-10 border border-cd-edge-control-active-32 bg-cd-fill-popup p-cd-5 shadow-cd-popup';

  /*
    §4 — ROW GEOMETRY. 40px desktop / 44px mobile (the touch floor), 0 11px
    padding, 9px internal gap, 8px radius nested inside the popup's 10px, and NO
    border or separator on any row in any state. 40px ships as an arbitrary value
    because no cd-40 spacing key exists and M66.8d's own CTO ruling was that 40px
    geometry uses arbitrary values rather than adding one.
  */
  const rowBase = isMobile
    ? 'flex h-cd-44 w-full items-center gap-cd-9 rounded-cd-8 px-cd-11 text-left text-cd-nav-item outline-none'
    : 'flex h-[40px] w-full items-center gap-cd-9 rounded-cd-8 px-cd-11 text-left text-cd-action outline-none';

  return (
    /*
      §8 — the ref-owning wrapper. It contains BOTH the trigger and the popup,
      and the popup is not portalled, which is what makes the single contains()
      test above correct.
    */
    <div ref={wrapperRef} className={isMobile ? 'flex-none' : 'relative flex-none'}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        /* §7 — the active option's id while open; the ATTRIBUTE IS ABSENT while
           closed, not empty. `undefined` is what makes React omit it entirely. */
        aria-activedescendant={isOpen ? optionId(activeCode) : undefined}
        aria-label={triggerName}
        onClick={() => (isOpen ? close() : open(false))}
        onKeyDown={onKeyDown}
        className={triggerClass}
      >
        {isMobile ? (
          <>
            {/* GN-CD-227 — the released mobile globe, unchanged. Its equator and
                meridian embellishments remain out of scope (CTO decision 8). */}
            <span
              aria-hidden="true"
              className="h-[18px] w-[18px] rounded-full border-[1.8px] border-cd-ink-glyph-header"
            />
            <span
              aria-hidden="true"
              className={`font-cd-mono text-cd-mono-lang-m ${
                isOpen ? 'text-cd-ink-label' : 'text-cd-ink-glyph-header'
              }`}
            >
              {value.toUpperCase()}
            </span>
            {/* M66.11 — the released mobile chevron. It did NOT exist in
                production before this milestone; GN-CD-227 specifies it at 8px in
                #5b7fa6, and unlike the label its colour does not change on open.
                Glyph swap only — no rotation (CTO decision 8, §12). */}
            <span aria-hidden="true" className="text-[8px] text-cd-ink-meta">
              {isOpen ? '▲' : '▼'}
            </span>
          </>
        ) : (
          <>
            {/* GN-CD-026 — the released 13x13 cyan ring, unchanged. */}
            <span
              aria-hidden="true"
              className="h-[13px] w-[13px] rounded-full border border-cd-ink-label"
            />
            <span>{LANGUAGE_NATIVE_LABELS[value]}</span>
            {/* §2 — 9px, #5b7fa6 closed and #7dd3fc open, with an additional 2px
                left margin on top of the 8px flex gap. Glyph swap, never a
                rotation. */}
            <span
              aria-hidden="true"
              className={`ml-[2px] text-[9px] ${isOpen ? 'text-cd-ink-label' : 'text-cd-ink-meta'}`}
            >
              {isOpen ? '▲' : '▼'}
            </span>
          </>
        )}
      </button>

      {isOpen && (
        <div id={listboxId} role="listbox" aria-label={actionLabel} className={popupClass}>
          {ACTIVE_LANGUAGES.map((code) => {
            const isSelected = code === value;
            const isActive = code === activeCode;

            /*
              §4 — the row state matrix, exact. Selected and hover/active are
              deliberately DIFFERENT: selected is cyan fill with cyan text, active
              is blue fill with white text. They must not be merged.

              These backgrounds come from component STATE rather than a `hover:`
              utility, because §6 requires pointer and keyboard to share ONE
              active index — a pointer entering a row sets the active option, and
              the same fill then serves both inputs. It is also why the mobile
              variant needs no hover suppression: with no pointer there is no
              pointerenter, so nothing sets the active row.
            */
            const rowState = isSelected
              ? 'bg-cd-hud-cyan-10 text-cd-ink-label'
              : isActive
                ? 'bg-cd-hud-sky-09 text-cd-ink-primary'
                : 'text-cd-ink-secondary';

            /* §4 — an INSET ring, not an outline: an outline on an 8px radius
               inside a 5px-padded popup would collide with the popup border. */
            const rowRing =
              isActive && isKeyboardActive
                ? ' shadow-[inset_0_0_0_1px_rgba(34,211,238,0.7)]'
                : '';

            const codeColour = isSelected
              ? 'text-cd-ink-core-sub'
              : isActive
                ? 'text-cd-ink-label'
                : 'text-cd-ink-meta';

            return (
              <div
                key={code}
                id={optionId(code)}
                role="option"
                aria-selected={isSelected}
                onClick={() => commit(code)}
                onPointerEnter={
                  isMobile
                    ? undefined
                    : () => {
                        setIsKeyboardActive(false);
                        setActiveCode(code);
                      }
                }
                className={`${rowBase} ${rowState}${rowRing}`}
              >
                {/*
                  §4 — the tick column reserves its 14px in EVERY state, so the
                  language name never shifts horizontally as selection moves. The
                  glyph itself is decorative: selection is conveyed by
                  aria-selected, so announcing a check mark would duplicate it.
                */}
                <span
                  aria-hidden="true"
                  className="grid w-cd-14 flex-none place-items-center text-[11px]"
                >
                  {isSelected ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1 whitespace-nowrap">
                  {LANGUAGE_NATIVE_LABELS[code]}
                </span>
                {/* §7 — decorative and redundant with the language name. */}
                <span aria-hidden="true" className={`font-cd-mono text-cd-mono-inspect ${codeColour}`}>
                  {code.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
