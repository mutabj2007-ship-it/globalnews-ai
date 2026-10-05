import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { fetchHomeEditorial } from '@/lib/api/homeEditorialApi';
import { homeR1Gates } from '@/lib/platform/homeR1Gates';
import { standaloneAskRoot } from '@/lib/ask/standaloneRoot';
import { THEME_COOKIE_NAME, parseThemePreference } from '@/lib/theme/theme';
import { VisualHomePage } from '@/components/visual/VisualHomePage';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMPACT VISUAL PRODUCT R1 — `/visual`: THE FUTURE HOME, FOR PRODUCT OWNER REVIEW ON ALPHA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Not a second application. The SAME backend truth as `/` and `/ask`: the same one getHomeFeed()
 * response and first-screen allocation, the same governed articleRef, the same Stage B
 * Discussion / Alerts, the same canonical Story Brief, the same one Ask (the root-mounted dock),
 * the same real map and country registry. Nothing here owns data of its own.
 *
 * ALPHA-ONLY BY CONSTRUCTION, with no new variable:
 *   · Production runs Standalone (GNA_PUBLIC_ROOT ≠ platform), where the central route gate is an
 *     ALLOWLIST and `/visual` is not on it — every request is redirected to `/` before this file
 *     runs (lib/routing/standaloneRouteGate.ts; asserted by visualRoute.spec.ts).
 *   · Defence in depth: should a Standalone deployment ever reach this page, it is a 404.
 *   · NOINDEX unconditionally; not in the sitemap.
 *
 * `/` and `/ask` are untouched. When the Product Owner approves and the engineering baseline is
 * final, `/visual` is promoted to `/` (only VISUAL_HOME_HREF and this mount move).
 */
export const metadata: Metadata = {
  title: 'GlobalNewsAI — Home preview',
  robots: { index: false, follow: false },
};

export default async function VisualHomeRoute(): Promise<JSX.Element> {
  if (standaloneAskRoot()) notFound();

  /* The Home surface's language rule (T2 display-locale authority): Home copy is EN/PL. */
  const language = surfaceLocale('home').language;
  const dict = getDictionary(language);
  const gates = homeR1Gates();
  /* PHONE-FIRST HOME CORRECTION R1 — ONE retained-store read: hero + three region rows,
     business/conflict only. The reader's own cookies go to our own backend only, so a signed-in
     reader's hero comes from their saved follows/interests. */
  const editorial = await fetchHomeEditorial(headers().get('cookie'));

  return (
    <VisualHomePage
      language={language}
      gates={gates}
      editorial={editorial}
      examples={dict.hero.exampleQuestions}
      theme={parseThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)}
    />
  );
}
