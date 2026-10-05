import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { HOME_REGION_ORDER, type HomeEditorialDomain, type HomeRegionId } from '@globalnews-ai/shared';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
import { homeR1Gates } from '@/lib/platform/homeR1Gates';
import { standaloneAskRoot } from '@/lib/ask/standaloneRoot';
import { THEME_COOKIE_NAME, parseThemePreference } from '@/lib/theme/theme';
import { fetchStorySearch, type StorySearchParams } from '@/lib/api/homeEditorialApi';
import { StorySearchPage } from '@/components/visual/home/StorySearchPage';

/**
 * PHONE-FIRST HOME CORRECTION R1 · §7 — `/stories`: PERSISTED STORY SEARCH (Alpha).
 *
 * Server-rendered from the URL, so the query, filters and scroll position survive Back. The search
 * reads only the retained store (GET /stories/search): no Ask conversation, no AI, no quota, no
 * provider. Results open the in-app Story Brief; Read Original is the only exit to a publisher.
 * Like /visual, it is not on the Standalone allowlist (Production redirects it) and is a 404 there.
 */
export const metadata: Metadata = {
  title: 'GlobalNewsAI — Story search',
  robots: { index: false, follow: false },
};

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function StoriesRoute({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  if (standaloneAskRoot()) notFound();
  const language = surfaceLocale('home').language;
  const rawRegion = one(searchParams.region);
  const rawDomain = one(searchParams.domain);
  const rawDays = Number(one(searchParams.days));
  const params: StorySearchParams = {
    q: one(searchParams.q).trim().slice(0, 120),
    region: (HOME_REGION_ORDER as readonly string[]).includes(rawRegion) ? (rawRegion as HomeRegionId) : null,
    domain: rawDomain === 'business' || rawDomain === 'conflict' ? (rawDomain as HomeEditorialDomain) : null,
    days: [3, 7, 30].includes(rawDays) ? rawDays : null,
    scope: one(searchParams.scope) === 'all' ? 'all' : 'home',
  };
  const searchable = params.q.length >= 2 || (params.q.length === 0 && params.region !== null);
  const result = searchable ? await fetchStorySearch(params) : null;

  return (
    <StorySearchPage
      language={language}
      gates={homeR1Gates()}
      params={params}
      searchable={searchable}
      result={result}
      theme={parseThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)}
    />
  );
}
