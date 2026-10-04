import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
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
  const language = surfaceLocale('myIntelligence').language;
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
