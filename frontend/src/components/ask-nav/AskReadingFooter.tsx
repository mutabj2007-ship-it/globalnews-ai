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
import styles from './askNav.module.css';

/**
 * ASK DESIGN AUTHORITY R3 — CTO RULINGS 1–3: THE CONVERSATIONS FOOTER.
 *
 * Standalone Ask's reading surface carries no platform navigation bar and no navigation menu
 * under the conversation list. What a reader still needs on that surface sits here, in the
 * Design's own footer slot at the bottom of the conversations column (≥1024) and of the drawer:
 *
 * - the reader's language and appearance (Light is the default; Navy stays one choice away),
 * - ONE account entry — Settings when signed in (Recent, Saved, Help and sign-out live on that
 *   Ask page's own shell), Sign in when signed out,
 * - the quiet legal row: Privacy · Cookies (TRUST R1 §12: reachable before sign-in and before
 *   the first question), moved off the composer so it no longer distorts the READY composition.
 *
 * The account state is the shell's one session read, passed in (no second read here).
 */
export function AskReadingFooter({
  language,
  selected,
  account,
}: {
  /** The shell catalogue locale (askNavStrings). */
  readonly language: DisplayLocale;
  /** The reader's own selection (shown back to them; the legal row's language). */
  readonly selected: DisplayLocale;
  readonly account: 'pending' | 'signed-in' | 'signed-out';
}): JSX.Element {
  const theme = useContext(ThemeScopeContext);
  const router = useRouter();
  const pathname = usePathname();
  const s = askShellStrings(language).askNavStrings;
  const r = askShellStrings(selected).askR2Strings;

  const changeLanguage = useCallback(
    (next: DisplayLocale): void => {
      if (next === selected) return;
      persistLanguageSelection(next);
      router.refresh();
    },
    [selected, router],
  );

  return (
    <div data-ask-nav="reading-footer" className={styles.readingFooter} {...askDirectionProps(language)}>
      <div className={styles.readingFooterRow}>
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
        {account === 'signed-in' && (
          <Link href="/account/settings" prefetch={false} data-ask-nav="footer-settings" className={styles.readingFooterLink}>
            {s.settings}
          </Link>
        )}
        {account === 'signed-out' && (
          <a href={accountSignInUrl(pathname ?? undefined)} data-ask-nav="footer-sign-in" className={styles.readingFooterLink}>
            {s.signIn}
          </a>
        )}
      </div>
      <p data-ask="privacy-links" className={styles.legalRow}>
        <a href="/privacy">{r.privacyLink}</a>
        <a href="/cookies">{r.cookiesLink}</a>
      </p>
    </div>
  );
}
