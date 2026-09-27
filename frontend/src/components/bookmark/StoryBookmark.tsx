'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { accountSignInUrl } from '@/lib/api/accountLinks';
import { useSavedStories } from '@/lib/myIntelligence/hooks';
import { findSavedStory, getSavedStoriesSnapshot } from '@/lib/myIntelligence/savedStoriesStore';
import { BookmarkButton } from '@/components/my-intelligence/MiPrimitives';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * UNIVERSAL BOOKMARK R1 — ONE SAVE AFFORDANCE FOR EVERY REAL STORY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Rendered beside (never inside) a real story's link wherever the product shows
 * one. It reads and writes the ONE shared saved-story store, so N cards on a
 * page share one saved-list read, and every card showing the same story
 * updates together after a save or unsave.
 *
 * FREE PERSONALISATION: cyan outline / filled, never sand, mint, violet or red.
 * Save and unsave are one account request each — no AI and no live provider.
 *
 * SIGNED OUT, it stays visible and honest: pressing it goes to the existing
 * sign-in, returning to this page where the backend allows that destination.
 * Nothing is shown as saved that is not.
 *
 * A story the server cannot resolve from retained reporting is refused by the
 * server; the refusal is shown, and no identity is invented on the client.
 */

/**
 * The exact destinations the backend's return validator accepts
 * (auth/return-destination.util.ts). Mirrored, not widened: any other page
 * signs in and returns to Home, as the backend itself would.
 */
export const SIGN_IN_RETURN_DESTINATIONS: ReadonlySet<string> = new Set([
  '/',
  '/history',
  '/support',
  '/map',
  '/search',
  '/workspace',
  '/my-intelligence',
]);

export function signInReturnFor(pathname: string | null): string | undefined {
  return pathname !== null && SIGN_IN_RETURN_DESTINATIONS.has(pathname) ? pathname : undefined;
}

export function StoryBookmark({
  url,
  language,
  className = '',
  size = 'default',
}: {
  /** The story's own publisher URL — the identity the server resolves and hashes. */
  url: string;
  language: LanguageCode;
  className?: string;
  size?: 'default' | 'compact';
}): JSX.Element {
  const saved = useSavedStories();
  const pathname = usePathname();
  const t = getDictionary(language).myIntelligence.saved;
  const [notice, setNotice] = useState<string | null>(null);

  const existing = findSavedStory(saved.data, url);
  const isSaved = existing !== undefined;
  const signedOut = saved.signedOut;

  const flash = (message: string): void => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2800);
  };

  const onToggle = (): void => {
    if (signedOut) {
      window.location.assign(accountSignInUrl(signInReturnFor(pathname)));
      return;
    }
    if (saved.pendingRef !== null) return;
    void (async () => {
      if (existing !== undefined) {
        flash((await saved.remove(existing.articleRef)) ? t.unsavedToast : t.saveFailed);
        return;
      }
      const result = await saved.save({ url });
      if (result !== null) {
        flash(t.savedToast);
        return;
      }
      /* The store records WHY a save failed; read it once the attempt has settled. */
      flash(getSavedStoriesSnapshot().failureKind === 'unavailable' ? t.saveUnavailable : t.saveFailed);
    })();
  };

  return (
    <>
      <BookmarkButton
        isSaved={isSaved}
        language={language}
        onToggle={onToggle}
        className={className}
        size={size}
      />
      {notice !== null && (
        <span
          role="status"
          data-bookmark-notice=""
          className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[70] flex justify-center px-4 lg:bottom-6"
        >
          <span className="pointer-events-auto flex items-center gap-4 rounded-[12px] border border-[#0e2d4d] bg-[#04162b] px-4 py-3 text-[13px] text-[#e4eefb] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.95)]">
            <span>{notice}</span>
            {notice === t.savedToast && (
              <a href="/my-intelligence" className="font-semibold text-[#5abff5]">
                {t.toastView}
              </a>
            )}
          </span>
        </span>
      )}
    </>
  );
}
