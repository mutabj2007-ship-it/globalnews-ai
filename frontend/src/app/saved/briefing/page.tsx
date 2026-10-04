import { askLanguageDisposition, askLocaleForLegacyCatalogue } from '@/lib/ask/askLocale';
import { resolveAskLocale } from '@/lib/ask/askLocale';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
import { AskThemedSurface } from '@/components/ask-nav/AskThemedSurface';
import { THEME_COOKIE_NAME, parseThemePreference } from '@/lib/theme/theme';
import { AskContinuityHeader } from '@/components/ask-nav/AskContinuityHeader';
import { BriefingDetailClient } from '@/components/ask/BriefingDetailClient';
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n/languages';

/**
 * R2 · D1 — `/saved/briefing?id=…&v=…`: one of the reader's briefings, a stored version at a time.
 * A query, not a dynamic segment: the app has none by design (N5, seoFoundation.spec).
 *
 * NOINDEX and signed-in only (the server answers 401 / 404, and the page reports it). Same
 * standalone shell and theme as `/saved`. Not in the Standalone (Production) allowlist: briefings
 * are an Alpha-only, switched-off capability until the CTO releases them.
 */
export const metadata: Metadata = {
  title: 'Briefing — Ask GlobalNews AI',
  robots: { index: false, follow: false },
};

export default function BriefingPage({
  searchParams,
}: {
  readonly searchParams: { readonly id?: string; readonly v?: string };
}): JSX.Element {
  /* R4 · SEVEN-LANGUAGE ASK FRONTEND — the reader's own locale, resolved once and not clamped.
     This line was `=== 'pl' ? 'pl' : 'en'`; see lib/ask/askLocale.ts for the one declared
     boundary between the seven-locale interface and the two-locale answer engine. */
  const locale = resolveAskLocale(cookies().get(LANGUAGE_COOKIE_NAME)?.value);
  /* R4 · one disposition per surface. The nav and continuity chrome read the two-locale
     catalogues (`askNavStrings` / `askContinuityStrings`); the Ask frame renders in the
     reader's locale. Reading both from one disposition is what stops them drifting. */
  const chrome = askLanguageDisposition(locale).catalogueLocale;
  const v = Number(searchParams.v);
  const requestedVersion = Number.isInteger(v) && v >= 1 ? v : null;

  return (
    <AskThemedSurface theme={parseThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)}>
      <AskNavProvider>
        <AskNavShell language={chrome} selected={locale} />
        <AskContinuityHeader locale={chrome} surface="saved" />
        <BriefingDetailClient
          id={typeof searchParams.id === 'string' ? searchParams.id : ''}
          requestedVersion={requestedVersion}
          locale={askLocaleForLegacyCatalogue(locale)}
        />
      </AskNavProvider>
    </AskThemedSurface>
  );
}
