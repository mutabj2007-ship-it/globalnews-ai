import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { AdminShell } from '@/components/admin/shell/AdminShell';

/**
 * F1.b — the Admin route group's server boundary.
 *
 * ONE COOKIE READ FOR TWENTY ROUTES. The language cookie is read here
 * and the resolved dictionary is handed to AdminShell, which puts it in
 * context for every screen beneath it. This is the same mechanism
 * app/layout.tsx already uses; no second localisation path is
 * introduced, and no page re-reads the cookie for itself.
 *
 * `robots: index false` is not a security control — the admin API
 * enforces authorization on every request regardless — but there is no
 * reason for a crawler to index a surface no anonymous visitor can use.
 *
 * There is deliberately NO middleware.ts. It could not gate this even if
 * it existed: the session cookie is httpOnly and set on the BACKEND
 * origin with no domain attribute, so the Next server never receives it.
 * The real gate is the backend's; the client check inside AdminShell is
 * for the user's benefit, not for protection.
 */
export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';
  const t = getDictionary(language);

  return {
    title: t.admin.meta.title,
    description: t.admin.meta.description,
    robots: { index: false, follow: false },
  };
}

export default function AdminLayout({ children }: { children: React.ReactNode }): JSX.Element {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';
  const t = getDictionary(language);

  return <AdminShell t={t.admin}>{children}</AdminShell>;
}
