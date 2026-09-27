'use client';

import { useMemo, useState } from 'react';
import { normalizeArticleUrl, type LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { useSavedStories } from '@/lib/myIntelligence/hooks';
import { BookmarkButton } from './MiPrimitives';

/**
 * Home bookmark backed by the live My Intelligence saved-story API.
 *
 * Saving remains ordinary account persistence: it performs no AI and no live
 * provider retrieval. The server resolves the story from retained reporting
 * and returns the governed SHA-256 articleRef.
 */
export function HomeSaveControl({
  url,
  language,
}: {
  url: string;
  language: LanguageCode;
}): JSX.Element {
  const saved = useSavedStories();
  const [showToast, setShowToast] = useState(false);
  const t = getDictionary(language).myIntelligence;
  const normalized = useMemo(() => normalizeArticleUrl(url), [url]);

  const existing = saved.data?.find(
    (story) =>
      normalizeArticleUrl(story.canonicalUrl) === normalized ||
      normalizeArticleUrl(story.sourceUrl) === normalized,
  );
  const isSaved = existing !== undefined;

  const toggle = (): void => {
    void (async () => {
      const ok = existing
        ? await saved.remove(existing.articleRef)
        : (await saved.save({ url })) !== null;
      if (!ok) return;
      setShowToast(true);
      window.setTimeout(() => setShowToast(false), 2600);
    })();
  };

  return (
    <>
      <span className="absolute bottom-[10px] right-[10px] z-10 lg:bottom-[12px] lg:right-[12px]">
        <BookmarkButton
          isSaved={isSaved}
          language={language}
          onToggle={toggle}
        />
      </span>

      {showToast && (
        <span
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[70] flex justify-center px-4 lg:bottom-6"
        >
          <span className="pointer-events-auto flex items-center gap-4 rounded-[12px] border border-[#0e2d4d] bg-[#04162b] px-4 py-3 text-[13px] text-[#e4eefb] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.95)]">
            <span>{isSaved ? t.saved.savedToast : t.saved.unsavedToast}</span>
            <a href="/my-intelligence" className="font-semibold text-[#5abff5]">
              {t.saved.toastView}
            </a>
          </span>
        </span>
      )}
    </>
  );
}
