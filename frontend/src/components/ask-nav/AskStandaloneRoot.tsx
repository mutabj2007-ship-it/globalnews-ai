import { Suspense } from 'react';
import styles from '@/components/ask-frame/askDashboard.module.css';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
import { AskShellFrame } from '@/components/ask-nav/AskShellFrame';
import { SiteStructuredData } from '@/components/seo/SiteStructuredData';
import type { AskR2Locale } from '@/lib/ask/askR2Strings';

/**
 * STANDALONE PUBLIC BETA CONVERGENCE R1 — `/` as the standalone Ask entry surface.
 *
 * The SAME composition as /ask (G's shell over the D25 frame, one viewport-high column), so
 * the reader gets one Ask, not two. What differs is only what a public root owns: the
 * truthful WebSite/Organization structured data, and (in the page's metadata) the one
 * indexable Ask canonical. /ask stays the operational route for ?operation= reopen and
 * governed returns, and stays noindex.
 */
export function AskStandaloneRoot({ locale }: { readonly locale: AskR2Locale }): JSX.Element {
  return (
    <div className={styles.page} data-ask-root="standalone">
      <SiteStructuredData />
      <AskNavProvider>
        <AskNavShell language={locale} />
        <Suspense fallback={<main className="min-h-0 flex-1 bg-void" />}>
          <AskShellFrame locale={locale} />
        </Suspense>
      </AskNavProvider>
    </div>
  );
}
