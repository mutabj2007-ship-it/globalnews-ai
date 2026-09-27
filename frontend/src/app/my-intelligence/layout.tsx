import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildPageMetadata } from '@/lib/seo/metadata';

/**
 * Metadata for /my-intelligence.
 *
 * This surface reads one person's own account session and shows their saved
 * stories, the places they follow and their question history. It is
 * user-specific by construction and must not be indexed — the same reasoning
 * that put `/history` behind its own layout, applied here for the same reason.
 */
export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language =
    languageCookie !== undefined && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';
  const t = getDictionary(language).myIntelligence;

  return buildPageMetadata({
    path: '/my-intelligence',
    title: t.metaTitle,
    description: t.metaDescription,
    language,
  });
}

export default function MyIntelligenceLayout({ children }: { children: ReactNode }): ReactNode {
  return children;
}
