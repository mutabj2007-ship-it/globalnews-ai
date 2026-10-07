import { Suspense } from 'react';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
import { AskShellFrame } from '@/components/ask-nav/AskShellFrame';
import { AskThemedPage } from '@/components/ask-nav/AskThemedPage';
import type { ThemePreference } from '@/lib/theme/theme';
import { SiteStructuredData } from '@/components/seo/SiteStructuredData';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askLanguageDisposition } from '@/lib/ask/askLocale';

/**
 * STANDALONE PUBLIC BETA CONVERGENCE R1 — `/` as the standalone Ask entry surface.
 *
 * The SAME composition as /ask (G's shell over the D25 frame, one viewport-high column), so
 * the reader gets one Ask, not two. What differs is only what a public root owns: the
 * truthful WebSite/Organization structured data, and (in the page's metadata) the one
 * indexable Ask canonical. /ask stays the operational route for ?operation= reopen and
 * governed returns, and stays noindex.
 */
export function AskStandaloneRoot({
  locale,
  theme,
}: {
  readonly locale: DisplayLocale;
  /** TRUST R1 — the reader's theme cookie, read by the root page (no flash). */
  readonly theme: ThemePreference;
}): JSX.Element {
  /*
    R4 · PHASE B — this note used to read that the shell's labels come from the EN/PL
    catalogue while the frame renders in the reader's locale, "and discloses the difference".
    That difference is what the Product Owner rejected: a French hero over an English
    application. There is no longer a second interface locale — `catalogueLocale` IS the
    reader's locale — so the shell and the frame render in one language by construction
    rather than by two values being kept in step.
  */
  const disposition = askLanguageDisposition(locale);
  return (
    <AskThemedPage theme={theme} root="standalone">
      <SiteStructuredData />
      <AskNavProvider>
        <AskNavShell language={disposition.catalogueLocale} selected={locale} theme={theme} surface="reading" />
        <Suspense fallback={<main className="min-h-0 flex-1 bg-void" />}>
          <AskShellFrame locale={locale} />
        </Suspense>
      </AskNavProvider>
    </AskThemedPage>
  );
}
