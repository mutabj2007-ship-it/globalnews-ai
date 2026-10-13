import type { JSX } from 'react';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { ASK_PRODUCT_NAME } from '@/lib/ask/askBrand';
import { askLanguageDisposition } from '@/lib/ask/askLocale';
import { askThemeColor, parseAskThemePreference } from '@/lib/ask/askTheme';
import { designPreviewAvailable } from '@/lib/ask/designPreviewGate';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
import { THEME_COOKIE_NAME } from '@/lib/theme/theme';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
import { AskThemedSurface } from '@/components/ask-nav/AskThemedSurface';
import { AskDesignPreview } from '@/components/ask/AskDesignPreview';

/**
 * CTO R28 — `/ask/preview`: the remaining approved Ask R3 presets as LABELLED DESIGN PREVIEWS, for
 * Product Owner review on Alpha.
 *
 * ALPHA-ONLY BY CONSTRUCTION, with no new variable — the same gate as `/visual`:
 *   · Production runs the standalone Ask root (GNA_PUBLIC_ROOT ≠ platform): this page is a 404.
 *   · NOINDEX unconditionally; not in the sitemap; no link from the approved navigation.
 * Static and non-actionable: no fetch, no account call, no Ask submit (components/ask/AskDesignPreview).
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `Design previews — ${ASK_PRODUCT_NAME}`,
  robots: { index: false, follow: false },
};

export function generateViewport(): Viewport {
  return { themeColor: askThemeColor(parseAskThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)) };
}

export default function AskDesignPreviewPage(): JSX.Element {
  if (!designPreviewAvailable()) notFound();
  const locale = surfaceLocale('saved').effective;
  const chrome = askLanguageDisposition(locale).catalogueLocale;
  return (
    <AskThemedSurface theme={parseAskThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)}>
      <AskNavProvider>
        <AskNavShell language={chrome} selected={locale} />
        <AskDesignPreview locale={locale} />
      </AskNavProvider>
    </AskThemedSurface>
  );
}
