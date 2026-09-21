import { Suspense } from 'react';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { AskConversationClient } from '@/components/ask/AskConversationClient';

/**
 * BETA-SIMPLE-ASK-SAND-1 §3/§21 — the public Ask route.
 *
 * §21: "Do not create SEO pages for arbitrary user questions by
 * default. Search/Ask/private histories should generally remain
 * noncanonical/nonindex unless explicitly published through a future
 * publication contract."
 *
 * Hence `robots: { index: false, follow: false }` below. This is not
 * a precaution against thin content — it is a privacy requirement. An
 * Ask URL carries the navigation context (and, once a thread is
 * resumed, a thread id) in its query string, and an indexed Ask page
 * would publish one person's line of enquiry. Nothing here is
 * indexable until a publication contract exists that says otherwise.
 */
export const metadata: Metadata = {
  title: 'Ask GlobalNews AI',
  description: 'Ask a question and get an answer grounded in retrieved, cited sources.',
  robots: { index: false, follow: false },
};

export default function AskPage(): JSX.Element {
  return (
    <>
      <NavBar />
      {/*
        The Suspense boundary is required, not optional:
        AskConversationClient calls useSearchParams(), and Next.js 14
        opts any route using it into client-side rendering unless the
        component is wrapped — without this the whole route would be
        forced dynamic and the build would warn.
      */}
      <main className="min-h-screen bg-void">
        <Suspense
          fallback={
            <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
              <p className="text-sm text-ink-secondary">Loading Ask…</p>
            </div>
          }
        >
          <AskConversationClient />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
