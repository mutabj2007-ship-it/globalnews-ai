'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { accountFetch } from '@/lib/api/accountFetch';
import { useAccount } from '@/lib/hooks/useAccount';
import type { DisplayLocale, LanguageCode } from '@globalnews-ai/shared';
import { historyStrings } from '@/lib/history/historyStrings';

interface HistoryEntry {
  id: string;
  query: string;
  countryCode: string | null;
  createdAt: string;
}

/**
 * Milestone #57 — the minimal /history page. Selecting an entry
 * re-runs the question live via the existing /search route (the same
 * q/countryCode URL-param pattern CountryArticleCard and the Hero
 * search input already use) rather than replaying a stored answer —
 * no stale AI response is ever persisted or displayed here, matching
 * the M57 architecture decision.
 */
/**
 * T2 · the /history client, moved out of `app/history/page.tsx` so a Server Component can hand it
 * the surface's EFFECTIVE locale. It rendered five hard-coded English strings and a NavBar/Footer
 * defaulted to English for every reader; the strings now come from `historyStrings` (English
 * verbatim) and the chrome from the same effective locale.
 */
export function HistoryClient({
  locale,
  language,
}: {
  locale: DisplayLocale;
  language: LanguageCode;
}): JSX.Element {
  const t = historyStrings(locale);
  const { user, isLoading: isAccountLoading } = useAccount();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAccountLoading) return;

    if (!user) {
      setIsLoading(false);
      return;
    }

    accountFetch('/history')
      .then((response) => (response.ok ? (response.json() as Promise<HistoryEntry[]>) : []))
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setIsLoading(false));
  }, [user, isAccountLoading]);

  async function handleClear(): Promise<void> {
    await accountFetch('/history', { method: 'DELETE' });
    setEntries([]);
  }

  function historyEntryHref(entry: HistoryEntry): string {
    const params = new URLSearchParams({ q: entry.query });
    if (entry.countryCode) {
      params.set('countryCode', entry.countryCode);
    }
    return `/search?${params.toString()}`;
  }

  return (
    <div className="flex min-h-screen flex-col bg-void">
      <NavBar language={language} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold text-ink-primary">{t.title}</h1>

        {!isAccountLoading && !user && (
          <p className="mt-4 text-ink-secondary">{t.signedOut}</p>
        )}

        {user && !isLoading && entries.length === 0 && (
          <p className="mt-4 text-ink-secondary">{t.empty}</p>
        )}

        {user && entries.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => void handleClear()}
              className="mt-4 rounded-full border border-cyan-500/25 px-4 py-1.5 text-sm text-ink-secondary hover:border-cyan-400/60"
            >
              {t.clear}
            </button>
            <ul className="mt-6 flex flex-col gap-3">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={historyEntryHref(entry)}
                    className="block rounded-lg border border-cyan-500/15 px-4 py-3 text-ink-primary hover:border-cyan-400/40"
                  >
                    {entry.query}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <Footer language={language} />
    </div>
  );
}
