import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getHomeFeed } from '@/lib/homeFeed';
import { allocateHomeFirstScreen } from '@/components/home/reva/worldIn60Allocation';
import { articleRefFor } from '@/lib/identity/articleRefServer';
import { homeR1Gates } from '@/lib/platform/homeR1Gates';
import { standaloneAskRoot } from '@/lib/ask/standaloneRoot';
import { THEME_COOKIE_NAME, parseThemePreference } from '@/lib/theme/theme';
import { VisualHomePage } from '@/components/visual/VisualHomePage';
import type { VisualStory } from '@/components/visual/VisualStoryFeed';

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
  const feed = await getHomeFeed(language);
  const firstScreen = allocateHomeFirstScreen(feed);
  const whats = firstScreen.whats;

  /* One de-duplicated list from the ONE response: the first-screen stories, then the 60-second set. */
  const seen = new Set<string>();
  const stories: VisualStory[] = [
    ...(whats.featured === null ? [] : [whats.featured]),
    ...whats.inFocus,
    ...whats.discovery,
    ...firstScreen.worldIn60,
  ]
    .filter((article) => {
      if (seen.has(article.id)) return false;
      seen.add(article.id);
      return true;
    })
    .slice(0, 12)
    .map((article) => ({ article, articleRef: articleRefFor(article.url) }));

  return (
    <VisualHomePage
      language={language}
      gates={gates}
      stories={stories}
      dataMode={feed.dataMode}
      examples={dict.hero.exampleQuestions}
      theme={parseThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)}
    />
  );
}
