import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildPageMetadata } from '@/lib/seo/metadata';

/**
 * ALPHA-SEO-FOUNDATION-1 — metadata-only layout for the account subtree.
 *
 * Placed at `/account` rather than `/account/settings` so that every
 * account route, including any added later, inherits `noindex` without
 * anyone having to remember (§B: "Account", "account settings"). The
 * registry's prefix match classifies the whole subtree the same way.
 *
 * Renders `{children}` and nothing else — no wrapper, no class, no
 * element. This is a metadata declaration, not a layout change.
 *
 * This is a DISCOVERY control. What actually protects account data is the
 * existing authentication boundary, which this work does not touch.
 */
export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';
  const t = getDictionary(language);

  return buildPageMetadata({
    path: '/account/settings',
    title: t.homeMetaTitle,
    description: t.homeMetaDescription,
    language,
  });
}

export default function AccountLayout({ children }: { children: ReactNode }): ReactNode {
  return children;
}
