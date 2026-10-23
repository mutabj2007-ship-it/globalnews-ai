'use client';

import { askContinuityStrings } from '@/lib/ask/askContinuityStrings';
import { askNavStringsFor, type AskNavLocale } from '@/lib/ask/askNavStrings';
import { useAskNav } from './AskNavShell';
import styles from './askNav.module.css';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { askDirectionProps } from '@/lib/ask/askDirection';
import Link from 'next/link';
import { followStrings } from '@/lib/ask/followStrings';
import { askMenuFor, type AskPrimarySectionId } from '@/lib/askNavModel';
import { AskPrimaryNav } from './AskPrimaryNav';

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
export type AskContinuitySurface = 'recent' | 'saved' | 'updates' | 'help' | 'settings';

/** ASK R3 NAVIGATION / USABILITY R1 — which R3 section each surface belongs to (none for the rest). */
const SECTION_OF: Readonly<Record<AskContinuitySurface, AskPrimarySectionId | null>> = {
  recent: null,
  saved: 'saved',
  updates: 'updates',
  help: null,
  settings: null,
};

export function AskContinuityHeader({
  locale,
  surface,
}: {
  readonly locale: DisplayLocale;
  readonly surface: AskContinuitySurface;
}): JSX.Element {
  const { open, setOpen } = useAskNav();
  const nav = askShellStrings(locale).askNavStrings;
  const t = askShellStrings(locale).askContinuityStrings;
  const direction = askDirectionProps(locale);
  /* New question opens a fresh Ask (an ordinary route change mounts a fresh frame); from the model. */
  const newQuestionHref = askMenuFor('signed-out').find((entry) => entry.id === 'new-question')?.href ?? '/ask';
  /* ALPHA VISUAL ACCEPTANCE REPAIR R1 — Help & feedback and Settings are standalone surfaces too. */
  /* ASK R3 NAVIGATION / USABILITY R1 — My updates and its change detail are titled My updates,
     never "Saved" (audit D08/D09). */
  const title =
    surface === 'updates'
      ? followStrings(locale).myUpdates
      : surface === 'recent'
      ? t.recentTitle
      : surface === 'saved'
        ? t.savedTitle
        : surface === 'help'
          ? nav.help
          : nav.settings;

  return (
    /*
      R4 · PHASE B — the phone header is part of the localized Ask surface, so it carries its
      own `lang`/`dir` scope from the shared contract's direction table. Before this, an
      Arabic reader on a phone got an RTL thread under an LTR header.
    */
    <header
      data-ask-continuity="phone-header"
      lang={direction.lang}
      dir={direction.dir}
      data-ask-continuity-dir={direction.dir}
      className={styles.continuityHeader}
    >
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
      {/*
        ASK R3 NAVIGATION / USABILITY R1 — the R3 header on every Ask page: ☰ · [Ask | My updates |
        Saved] · + (HANDOFF §3 L74). The page title stays for assistive technology (the page's
        own <h1> carries it visibly); the current section is marked in the navigation.
      */}
      <span data-ask-continuity="title" className={styles.continuityTitle}>
        {title}
      </span>
      <AskPrimaryNav locale={locale} current={SECTION_OF[surface]} />
      <Link
        href={newQuestionHref}
        prefetch={false}
        data-ask-continuity="new-question"
        aria-label={nav.newQuestion}
        className={styles.continuityNew}
      >
        <span aria-hidden="true">+</span>
      </Link>
    </header>
  );
}
