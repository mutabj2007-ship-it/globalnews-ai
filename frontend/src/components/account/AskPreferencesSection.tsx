'use client';

import { useCallback, useContext, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import type { DisplayLocale, LanguageCode } from '@globalnews-ai/shared';
import { persistLanguageSelection } from '@/lib/i18n/languages';
import { LanguageSelector } from '@/components/search/LanguageSelector';
import { ThemeControl, ThemeScopeContext } from '@/components/platform/ThemeControl';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { askR3FullStrings } from '@/lib/ask/askR3FullStrings';

/**
 * ASK R3 FULL DESIGN R1 — D13 "Preferences and privacy": Language (incl. RTL) and Appearance
 * (Light / Dark / System / Scheduled) on the settings page, as the design draws them.
 *
 * NOTHING NEW IS STORED: these are the SAME two controls the conversations footer carries (one
 * first-party language cookie, one theme cookie), mounted here too. "What Ask remembers" is
 * omitted — there is no preferences store, and the design permits omission until one exists.
 */
export function AskPreferencesSection({ locale }: { readonly locale: DisplayLocale }): JSX.Element {
  const theme = useContext(ThemeScopeContext);
  const router = useRouter();
  const nav = askShellStrings(locale).askNavStrings;
  const r3 = askR3FullStrings(locale);
  const changeLanguage = useCallback(
    (next: DisplayLocale): void => {
      if (next === locale) return;
      persistLanguageSelection(next);
      router.refresh();
    },
    [locale, router],
  );
  return (
    <section data-ask="settings-preferences" aria-labelledby="ask-settings-preferences" className="mt-8">
      <h2 id="ask-settings-preferences" className="text-lg font-semibold text-ink-primary">
        {r3.preferencesHeading}
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <LanguageSelector
          value={locale}
          onChange={changeLanguage}
          label={nav.language}
          actionLabel={nav.languageSelectorAction}
          variant="mobile"
          anchor="self"
        />
        {theme !== null && (
          <ThemeControl language={locale as LanguageCode} locale={locale} initial={theme} tone="surface" />
        )}
      </div>
    </section>
  );
}
