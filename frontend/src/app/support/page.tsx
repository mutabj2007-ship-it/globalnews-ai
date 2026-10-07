import { cookies } from 'next/headers';
import type { Metadata, Viewport } from 'next';
import type { LanguageCode } from '@globalnews-ai/shared';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
import { effectiveWithin } from '@/lib/i18n/surfaceLocale';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SupportScreen } from '@/components/support/SupportScreen';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
import { AskThemedSurface } from '@/components/ask-nav/AskThemedSurface';
import { THEME_COOKIE_NAME } from '@/lib/theme/theme';
import { askThemeColor, parseAskThemePreference } from '@/lib/ask/askTheme';
import { AskContinuityHeader } from '@/components/ask-nav/AskContinuityHeader';
import { AskClearedBoundary } from '@/components/ask-nav/AskClearedBoundary';
import { standaloneAskRoot } from '@/lib/ask/standaloneRoot';

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
  /* T2 — the display-locale authority + effective-locale rule (was the EN/PL clamp). */
  return surfaceLocale('support').language;
}

function resolveSupportDictionary(): ReturnType<typeof getDictionary>['support'] {
  return getDictionary(currentLanguage()).support;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = resolveSupportDictionary();

  /*
    ALPHA-SEO-FOUNDATION-1 — the `robots: index false` this page already
    carried is PRESERVED, not re-decided: the registry classifies
    /support as user-dependent (§B, "support conversations/tickets") and
    the builder emits the identical directive. Routing it through the one
    builder is what stops this page and the sitemap from ever disagreeing.
  */
  return buildPageMetadata({
    path: '/support',
    title: t.meta.title,
    description: t.meta.description,
    language: currentLanguage(),
  });
}

/** ASK DESIGN AUTHORITY R3 — the browser chrome follows the reader's Ask treatment (Light unless
    they saved another), so a Light page is not framed by the layout's navy status-bar colour. */
export function generateViewport(): Viewport {
  return { themeColor: askThemeColor(parseAskThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)) };
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
  const language = effectiveWithin(surfaceLocale('support'), ['en', 'pl']);

  /*
    ALPHA VISUAL ACCEPTANCE REPAIR R1 — in the standalone Public Beta, Help & feedback stays
    INSIDE Ask: the standalone Ask navigation only (no platform header, Footer or dock). The
    Support surface itself — data, backend, copy, noindex — is the same one. The wider
    platform presentation remains behind GNA_PUBLIC_ROOT=platform.
  */
  if (standaloneAskRoot()) {
    return (
      <AskThemedSurface theme={parseAskThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)}>
        <AskNavProvider>
          <AskNavShell language={language} />
          <AskContinuityHeader locale={language} surface="help" />
          <AskClearedBoundary>
            <SupportScreen t={resolveSupportDictionary()} language={language} chrome="standalone" />
          </AskClearedBoundary>
        </AskNavProvider>
      </AskThemedSurface>
    );
  }
  return <SupportScreen t={resolveSupportDictionary()} language={language} />;
}
