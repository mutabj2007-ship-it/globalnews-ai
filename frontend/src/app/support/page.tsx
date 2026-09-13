import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import type { LanguageCode } from '@globalnews-ai/shared';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { SupportScreen } from '@/components/support/SupportScreen';

/**
 * S4 — the server boundary for the authenticated user Support surface.
 *
 * Reads the language cookie exactly the way `app/admin/layout.tsx` does, and
 * hands the resolved dictionary to the one client component beneath it. No
 * component below re-reads the cookie.
 *
 * RC-1 — the temporary second localization path recorded here is GONE. This
 * page previously resolved `supportEn` / `supportPl` with its own ternary,
 * because F's checkpoint was not permitted to edit en.ts / pl.ts while R4 was
 * in flight. RC-1 folds `support: supportEn` / `support: supportPl` into those
 * two files exactly the way `admin` is folded, so this page now reaches its
 * strings through the SAME getDictionary(language) call as every other section
 * and the ternary is gone. There is one localization path in the product.
 *
 * `robots: index false` because a page of somebody's private correspondence
 * has no business in a search index. It is not a security control — the
 * backend scopes every read to the session and would return 401 or 404 to
 * anyone else regardless — it is simply correct.
 */
function currentLanguage(): LanguageCode {
  const cookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  return cookie && isActiveLanguageCode(cookie) ? cookie : 'en';
}

function resolveSupportDictionary(): ReturnType<typeof getDictionary>['support'] {
  return getDictionary(currentLanguage()).support;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = resolveSupportDictionary();

  return {
    title: t.meta.title,
    description: t.meta.description,
    robots: { index: false, follow: false },
  };
}

export default function SupportPage(): JSX.Element {
  /*
    SUPPORT-AI-1 — the language travels as data, not only as a dictionary.

    The agent's reply is a DURABLE message body an administrator reads back
    later, so the server has to write it in the requester's language. This
    page already resolves that language for the dictionary; handing the same
    value down means there is still exactly one place the language is decided.

    Narrowed to the two the Support surface has reviewed copy in. A third
    active UI language would otherwise silently store English in a thread that
    asked for something else.
  */
  const language = currentLanguage() === 'pl' ? 'pl' : 'en';

  return <SupportScreen t={resolveSupportDictionary()} language={language} />;
}
