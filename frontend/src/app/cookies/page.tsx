import { cookies } from 'next/headers';
import Link from 'next/link';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { PreferenceStorageControl } from '@/components/privacy/PreferenceStorageControl';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';
import { COOKIES_PAGE } from '@/lib/privacy/cookiesPageStrings';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { STORAGE_INVENTORY, type StorageCategory } from '@/lib/privacy/storageInventory';

/**
 * TRUST & CONVERSATIONAL EXPERIENCE R1 §12 + CTO addendum — the detailed "Cookies and similar
 * technologies" notice, public and readable before sign-in. Rendered from the one inventory
 * (lib/privacy/storageInventory.ts), so the page cannot list something the code does not do.
 */
function localeOf(): 'en' | 'pl' {
  const value = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  return value && isActiveLanguageCode(value) && value === 'pl' ? 'pl' : 'en';
}

export async function generateMetadata(): Promise<Metadata> {
  const language = localeOf();
  const t = COOKIES_PAGE[language];
  /* The registry (lib/seo/routes.ts) decides robots: noindex until the notice is reviewed. */
  return buildPageMetadata({
    path: '/cookies',
    title: `${t.title} — GlobalNews AI`,
    description: t.intro,
    language,
  });
}

export default async function CookiesPage(): Promise<JSX.Element> {
  const language = localeOf();
  const t = COOKIES_PAGE[language];
  const sections: ReadonlyArray<[StorageCategory, string, string]> = [
    ['STRICTLY_NECESSARY', t.necessaryHeading, t.necessaryBody],
    ['PREFERENCES', t.preferencesHeading, t.preferencesBody],
  ];

  return (
    <div className="flex min-h-screen flex-col bg-void">
      <NavBar language={language} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-semibold text-ink-primary sm:text-3xl">{t.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-secondary">{t.intro}</p>
        <p
          data-privacy="no-tracking"
          className="mt-3 text-sm font-semibold leading-relaxed text-ink-primary"
        >
          {t.noTracking}
        </p>

        {sections.map(([category, heading, body]) => (
          <section key={category} data-privacy-category={category} className="mt-10">
            <h2 className="text-lg font-semibold text-ink-primary">{heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{body}</p>
            <ul className="mt-4 flex flex-col gap-3">
              {STORAGE_INVENTORY.filter((item) => item.category === category).map((item) => (
                <li
                  key={item.name}
                  data-privacy-item={item.name}
                  className="rounded-[10px] border border-white/10 p-3 text-sm text-ink-secondary"
                >
                  <p className="font-mono text-[13px] font-semibold text-ink-primary break-all">
                    {item.name}{' '}
                    <span className="font-body font-normal text-ink-tertiary">
                      · {t.kinds[item.kind]}
                    </span>
                  </p>
                  <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr]">
                    <dt className="text-ink-tertiary">{t.columns.purpose}</dt>
                    <dd>{item.purpose[language]}</dd>
                    <dt className="text-ink-tertiary">{t.columns.data}</dt>
                    <dd>{item.data[language]}</dd>
                    <dt className="text-ink-tertiary">{t.columns.lifetime}</dt>
                    <dd>{item.lifetime[language]}</dd>
                    <dt className="text-ink-tertiary">{t.columns.whenSet}</dt>
                    <dd>{item.whenSet[language]}</dd>
                  </dl>
                </li>
              ))}
            </ul>
            {category === 'PREFERENCES' && (
              <div id="settings" className="mt-6">
                <h3 className="text-base font-semibold text-ink-primary">{t.settingsHeading}</h3>
                <PreferenceStorageControl locale={language} />
              </div>
            )}
          </section>
        ))}

        <p className="mt-10 text-sm">
          <Link href="/privacy" className="text-signal underline-offset-2 hover:underline">
            {t.privacyLink}
          </Link>
        </p>
      </main>
      <Footer language={language} />
    </div>
  );
}
