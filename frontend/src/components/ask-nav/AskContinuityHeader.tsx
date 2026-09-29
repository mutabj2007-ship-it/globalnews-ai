'use client';

import { askContinuityStrings } from '@/lib/ask/askContinuityStrings';
import { askNavStringsFor, type AskNavLocale } from '@/lib/ask/askNavStrings';
import { useAskNav } from './AskNavShell';
import styles from './askNav.module.css';

/**
 * STANDALONE CONTINUITY SHELL CLOSURE — the phone / 768-portrait header of the two
 * standalone continuity surfaces, `/ask/recent` and `/saved`.
 *
 * Those surfaces are scrolling lists, not the D25 conversation frame, so they have no
 * `.phoneHeader` of their own to carry the menu trigger. This is that header and
 * nothing more: 56px, the trigger in the LEFT slot, the localized page title, an
 * empty right slot so the title stays centred. It is NARROW on purpose — it takes a
 * surface name, never a React node, so no caller can render an arbitrary tree into it.
 *
 * ONE NAVIGATION MODEL. It opens the same `AskNavShell` drawer through the same
 * `useAskNav` state, and its trigger carries `data-ask="shell-menu"`, the handle
 * AskNavShell returns focus to when the drawer closes. Above the full-screen
 * threshold it is `display: none` and AskNavShell's 62px bar takes over, under the
 * identical media query (askNav.module.css), so exactly one header is ever shown.
 *
 * The title is a plain label, not a heading: each surface already renders its own
 * <h1> with the same words, and a second one would duplicate the page outline.
 */
export type AskContinuitySurface = 'recent' | 'saved' | 'help' | 'settings';

export function AskContinuityHeader({
  locale,
  surface,
}: {
  readonly locale: AskNavLocale;
  readonly surface: AskContinuitySurface;
}): JSX.Element {
  const { open, setOpen } = useAskNav();
  const nav = askNavStringsFor(locale);
  const t = askContinuityStrings(locale);
  /* ALPHA VISUAL ACCEPTANCE REPAIR R1 — Help & feedback and Settings are standalone surfaces too. */
  const title =
    surface === 'recent'
      ? t.recentTitle
      : surface === 'saved'
        ? t.savedTitle
        : surface === 'help'
          ? nav.help
          : nav.settings;

  return (
    <header data-ask-continuity="phone-header" className={styles.continuityHeader}>
      <button
        type="button"
        data-ask="shell-menu"
        aria-label={open ? nav.closeMenuAriaLabel : nav.openMenuAriaLabel}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-[4px] text-[#cfe2f2]"
      >
        <span aria-hidden="true" className="block h-[2px] w-[18px] rounded-sm bg-current" />
        <span aria-hidden="true" className="block h-[2px] w-[18px] rounded-sm bg-current" />
        <span aria-hidden="true" className="block h-[2px] w-[18px] rounded-sm bg-current" />
      </button>
      <span
        data-ask-continuity="title"
        className="flex-1 truncate text-center font-cd-display text-[16px] font-bold text-white"
      >
        {title}
      </span>
      <span aria-hidden="true" className="min-w-11" />
    </header>
  );
}
