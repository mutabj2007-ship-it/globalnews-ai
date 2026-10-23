import { askLanguageDisposition } from '@/lib/ask/askLocale';
import { ASK_PRODUCT_NAME } from '@/lib/ask/askBrand';
import { askDirectionProps } from '@/lib/ask/askDirection';
import { cookies } from 'next/headers';
import type { Metadata, Viewport } from 'next';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
import { AskThemedSurface } from '@/components/ask-nav/AskThemedSurface';
import { THEME_COOKIE_NAME } from '@/lib/theme/theme';
import { askThemeColor, parseAskThemePreference } from '@/lib/ask/askTheme';
import { AskContinuityHeader } from '@/components/ask-nav/AskContinuityHeader';
import { BriefingDetailClient } from '@/components/ask/BriefingDetailClient';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
import { briefingOriginOf } from '@/lib/ask/followedQuestions';

/**
 * R2 · D1 — `/saved/briefing?id=…&v=…`: one of the reader's briefings, a stored version at a time.
 * A query, not a dynamic segment: the app has none by design (N5, seoFoundation.spec).
 *
 * NOINDEX and signed-in only (the server answers 401 / 404, and the page reports it). Same
 * standalone shell and theme as `/saved`. REASON TO RETURN R1 (PO contract 2026-10-09): in the
 * Standalone allowlist as a followed question's saved answers; the capability itself stays off
 * wherever ASK_BRIEFINGS_ENABLED is not 'true' (the page then reports "not available").
 */
export const metadata: Metadata = {
  /* R4 · CTO brand ruling — one canonical product name, never an authored variant */
  title: `Briefing — ${ASK_PRODUCT_NAME}`,
  robots: { index: false, follow: false },
};

/** ASK DESIGN AUTHORITY R3 — the browser chrome follows the reader's Ask treatment (Light unless
    they saved another), so a Light page is not framed by the layout's navy status-bar colour. */
export function generateViewport(): Viewport {
  return { themeColor: askThemeColor(parseAskThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)) };
}

export default function BriefingPage({
  searchParams,
}: {
  readonly searchParams: { readonly id?: string; readonly v?: string; readonly from?: string; readonly check?: string };
}): JSX.Element {
  /* R4 · SEVEN-LANGUAGE ASK FRONTEND — the reader's own locale, resolved once and not clamped.
     This line was `=== 'pl' ? 'pl' : 'en'`; see lib/ask/askLocale.ts for the one declared
     boundary between the seven-locale interface and the two-locale answer engine. */
  /* T2 — through the display-locale authority: the effective locale of this surface (the reader's
     own while H's Ask shell is complete for it, English with the declared notice otherwise). */
  const locale = surfaceLocale('saved').effective;
  /* R4 · one disposition per surface. The nav and continuity chrome read the two-locale
     catalogues (`askNavStrings` / `askContinuityStrings`); the Ask frame renders in the
     reader's locale. Reading both from one disposition is what stops them drifting. */
  const chrome = askLanguageDisposition(locale).catalogueLocale;
  const v = Number(searchParams.v);
  const requestedVersion = Number.isInteger(v) && v >= 1 ? v : null;
  /* ASK R3 NAVIGATION / USABILITY R1 — opened from My updates (?from=updates) or from Saved: the
     header section, the back link and the post-delete destination follow the opener (audit D09). */
  const origin = briefingOriginOf(searchParams.from);
  /* ASK R3 · D09 — one recorded check's Before / Latest (an id or 'latest'; anything else is no check) */
  const checkId =
    typeof searchParams.check === 'string' && /^(latest|[0-9a-zA-Z-]{1,64})$/.test(searchParams.check)
      ? searchParams.check
      : null;

  return (
    <AskThemedSurface theme={parseAskThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)}>
      <AskNavProvider>
        <AskNavShell language={chrome} selected={locale} section={origin} />
        <AskContinuityHeader locale={chrome} surface={origin} />
        {/* R4 · the detail is outside the nav shell's direction scope: Arabic laid it out LTR */}
        <div className="contents" {...askDirectionProps(locale)}>
          <BriefingDetailClient
            id={typeof searchParams.id === 'string' ? searchParams.id : ''}
            requestedVersion={requestedVersion}
            locale={locale}
            origin={origin}
            checkId={checkId}
          />
        </div>
      </AskNavProvider>
    </AskThemedSurface>
  );
}
