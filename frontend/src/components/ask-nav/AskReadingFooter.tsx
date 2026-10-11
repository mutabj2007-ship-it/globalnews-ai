'use client';

import { useCallback, useContext, type JSX } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { DisplayLocale, LanguageCode } from '@globalnews-ai/shared';
import { accountSignInUrl } from '@/lib/api/accountBase';
import { persistLanguageSelection } from '@/lib/i18n/languages';
import { LanguageSelector } from '@/components/search/LanguageSelector';
import { ThemeControl, ThemeScopeContext } from '@/components/platform/ThemeControl';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { askDirectionProps } from '@/lib/ask/askDirection';
import { followStrings } from '@/lib/ask/followStrings';
import { MY_UPDATES_HREF } from '@/lib/ask/followedQuestions';
import styles from './askNav.module.css';
import { useAskNavOptional } from './AskNavShell';

/**
 * ASK DESIGN AUTHORITY R3 — CTO RULINGS 1–3: THE CONVERSATIONS FOOTER.
 *
 * Standalone Ask's reading surface carries no platform navigation bar and no navigation menu
 * under the conversation list. What a reader still needs on that surface sits here, in the
 * Design's own footer slot at the bottom of the conversations column (≥1024) and of the drawer:
 *
 * - the reader's language and appearance (Light is the default; Navy stays one choice away),
 * - Saved and Help & feedback as explicit standalone Ask utilities,
 * - Settings plus an explicit session action: Sign out when signed in, Sign in when signed out,
 * - the quiet legal row: Privacy · Cookies (TRUST R1 §12: reachable before sign-in and before
 *   the first question), moved off the composer so it no longer distorts the READY composition.
 *
 * The account state is the shell's one session read, passed in (no second read here).
 */
export function AskReadingFooter({
  language,
  selected,
  account,
  onSignOut,
}: {
  /** The shell catalogue locale (askNavStrings). */
  readonly language: DisplayLocale;
  /** The reader's own selection (shown back to them; the legal row's language). */
  readonly selected: DisplayLocale;
  readonly account: 'pending' | 'signed-in' | 'signed-out';
  /** Uses the shell's existing governed sign-out path; no second session read. */
  readonly onSignOut?: () => void;
}): JSX.Element {
  const theme = useContext(ThemeScopeContext);
  const router = useRouter();
  const pathname = usePathname();
  const s = askShellStrings(language).askNavStrings;
  const r = askShellStrings(selected).askR2Strings;
  /* the verified name only (the shell's one session read); never an email or a guess */
  const displayName = useAskNavOptional()?.displayName ?? null;

  const changeLanguage = useCallback(
    (next: DisplayLocale): void => {
      if (next === selected) return;
      persistLanguageSelection(next);
      router.refresh();
    },
    [selected, router],
  );

  /*
    ASK R3 NAVIGATION / USABILITY R1.1 (CTO, 2026-10-10) — THE COMPACT R3 FOOTER (D12-drawer):
    "Account · {name}" on one row, then small rows of the remaining destinations. It is pinned
    under the scrolling conversation list, so every row it saves is a conversation the reader
    sees. Nothing left: My updates, Saved, Help & feedback, Settings (the Account row opens it, as
    R3's Account row opens Preferences), Sign in / Sign out, language, appearance, Privacy and
    Cookies are all here, each with a 44 px target, in reading order.
  */
  const accountLine = displayName !== null ? `${s.account} · ${displayName}` : s.account;
  return (
    <div data-ask-nav="reading-footer" className={styles.readingFooter} {...askDirectionProps(language)}>
      <div data-ask-nav="footer-account-row" className={styles.readingFooterRow}>
        {account === 'signed-in' && (
          <Link
            href="/account/settings"
            prefetch={false}
            data-ask-nav="footer-settings"
            /* the visible words first (label in name), then the destination they open */
            aria-label={`${accountLine}, ${s.settings}`}
            className={`${styles.readingFooterLink} ${styles.footerAccount}`}
          >
            {/* ASK R3 IA R2 COMPLETION — the reader's name is its own direction run (Arabic
                rendered "Amina K." as ".Amina K"); the accessible name above is unchanged */}
            {displayName !== null ? (
              <>
                {s.account} · <span dir="auto" style={{ unicodeBidi: 'isolate' }}>{displayName}</span>
              </>
            ) : (
              accountLine
            )}
          </Link>
        )}
        {account === 'signed-in' && onSignOut !== undefined && (
          <button type="button" data-ask-nav="footer-sign-out" className={`${styles.readingFooterLink} ${styles.footerSmall}`} onClick={onSignOut}>
            {s.signOut}
          </button>
        )}
        {account === 'signed-out' && (
          <a href={accountSignInUrl(pathname ?? undefined)} data-ask-nav="footer-sign-in" className={`${styles.readingFooterLink} ${styles.footerAccount}`}>
            {s.signIn}
          </a>
        )}
      </div>
      <div data-ask-nav="footer-destinations" className={`${styles.readingFooterRow} ${styles.footerSmallRow}`}>
        {/* R3 FULL DESIGN — My updates is a primary destination (R1 contract §3); it was reachable
            only from a Follow control. Same governed page, no count (no reviewed state yet). */}
        {account === 'signed-in' && (
          <Link href={MY_UPDATES_HREF} prefetch={false} data-ask-nav="footer-updates" className={`${styles.readingFooterLink} ${styles.footerSmall}`}>
            {followStrings(selected).myUpdates}
          </Link>
        )}
        {account === 'signed-in' && (
          <Link href="/saved" prefetch={false} data-ask-nav="footer-saved" className={`${styles.readingFooterLink} ${styles.footerSmall}`}>
            {s.saved}
          </Link>
        )}
        <Link href="/support" prefetch={false} data-ask-nav="footer-help" className={`${styles.readingFooterLink} ${styles.footerSmall}`}>
          {s.help}
        </Link>
      </div>
      <div data-ask-nav="footer-preferences" className={`${styles.readingFooterRow} ${styles.footerSmallRow}`}>
        <LanguageSelector
          value={selected}
          onChange={changeLanguage}
          label={s.language}
          actionLabel={s.languageSelectorAction}
          variant="mobile"
          anchor="self"
        />
        {theme !== null && (
          <ThemeControl language={language as LanguageCode} locale={language} initial={theme} tone="surface" />
        )}
        <p data-ask="privacy-links" className={styles.legalRow}>
          <a href="/privacy">{r.privacyLink}</a>
          <a href="/cookies">{r.cookiesLink}</a>
        </p>
      </div>
    </div>
  );
}
