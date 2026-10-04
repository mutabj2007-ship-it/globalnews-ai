import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildPageMetadata } from '@/lib/seo/metadata';

/**
 * ALPHA-SEO-FOUNDATION-1 — a metadata-only layout for a client route.
 *
 * WHY A LAYOUT AND NOT A PAGE EXPORT. `history/page.tsx` is a `'use
 * client'` component and a Client Component cannot export
 * `generateMetadata`. A route-segment layout is the only place Next
 * accepts metadata for such a route.
 *
 * IT RENDERS `{children}` AND NOTHING ELSE — no element, no wrapper, no
 * class. The rendered page is byte-identical; this file exists purely so
 * that a surface which reads the account session and shows one person's
 * own query history cannot be indexed (§B, "History where user-specific").
 */
export async function generateMetadata(): Promise<Metadata> {
  const language = surfaceLocale('history').language;
  const t = getDictionary(language);

  return buildPageMetadata({
    path: '/history',
    title: t.homeMetaTitle,
    description: t.homeMetaDescription,
    language,
  });
}

export default function HistoryLayout({ children }: { children: ReactNode }): ReactNode {
  return children;
}
