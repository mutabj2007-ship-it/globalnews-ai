import { Suspense } from 'react';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import styles from '@/components/ask-frame/askDashboard.module.css';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
import { AskShellFrame } from '@/components/ask-nav/AskShellFrame';
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n/languages';
export const metadata: Metadata = {
  title: 'Ask AI — GlobalNews AI',
  robots: { index: false, follow: false },
};
/**
 * STANDALONE ASK — /ask NO LONGER RENDERS THE PLATFORM HEADER.
 *
 * `<NavBar />` was here. It is the GlobalNews AI PLATFORM header: its wordmark
 * links to `/`, it carries a Search control, and its account menu offers
 * `/my-intelligence`, `/history`, `/support` and `/account/settings`. Four of
 * those are on the ASK GLOBALNEWSAI STANDALONE BETA removal list, and `/history`
 * is the legacy Search history that must never be presented as Ask Recent, so no
 * subset of that bar is the ruled Ask menu. `<AskNavShell />` renders the ruled
 * set instead. NavBar is untouched and still serves every other route.
 *
 * PR #66's COLUMN IS PRESERVED EXACTLY. `styles.page` is the one viewport-high
 * flex column the composer clipping fix introduced: the header is
 * `flex-shrink: 0`, the frame is `flex: 1 1 0`, and the page itself never
 * scrolls. The only change here is WHICH header sits in that first slot.
 *
 * Both of the elements that column sizes are still DIRECT children of it —
 * `AskNavProvider` and `Suspense` render no DOM, and neither does
 * `AskShellFrame`. The Suspense fallback keeps #66's `min-h-0 flex-1` for the
 * same reason.
 */
export default function AskPage(): JSX.Element {
  const locale = cookies().get(LANGUAGE_COOKIE_NAME)?.value === 'pl' ? 'pl' : 'en';
  return (
    <div className={styles.page}>
      <AskNavProvider>
        <AskNavShell language={locale} />
        <Suspense fallback={<main className="min-h-0 flex-1 bg-void" />}>
          <AskShellFrame locale={locale} />
        </Suspense>
      </AskNavProvider>
    </div>
  );
}
