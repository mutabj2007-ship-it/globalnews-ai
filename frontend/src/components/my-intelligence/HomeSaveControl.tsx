'use client';

import { useState } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { BookmarkButton } from './MiPrimitives';
import { savedStoryRef } from './savedStoryIdentity';

/**
 * THE HOME BOOKMARK — A SIBLING OF THE CARD LINK, NEVER A CHILD OF IT.
 *
 * ── WHY THIS IS ITS OWN CLIENT COMPONENT ─────────────────────────────────
 *
 * `WhatsHappeningNow` is a Server Component and the frozen Home R6 composition
 * depends on it staying one. Lifting save state into it would turn the whole
 * section into a client tree for the sake of one toggle. So the boundary is
 * drawn here, at the smallest possible leaf: the card, the image, the headline
 * and the meta line all still render on the server.
 *
 * ── WHY IT IS POSITIONED RATHER THAN NESTED ──────────────────────────────
 *
 * The Home story card is one `<a href={article.url} target="_blank">` wrapping
 * image, headline and meta row. An interactive control INSIDE that anchor is
 * a nested-interactive collision: every save would also open a publisher tab,
 * and assistive technology would announce a button inside a link.
 *
 * R1.2 rules the bookmark is a sibling of the card link, in the source/meta
 * row, never overlaid on the image or the headline. It is therefore rendered
 * outside the anchor and positioned over the meta row, and the meta row
 * carries trailing padding so the source line never runs beneath it.
 *
 * ── WHAT PRESSING IT DOES, AND DOES NOT DO ───────────────────────────────
 *
 * It toggles local state and nothing else. There is no SavedStory table, no
 * `/saved` endpoint and no persistence in this lane, so the state lives for
 * the life of the page. Nothing is written to localStorage, sessionStorage,
 * IndexedDB or a cookie. And it runs no AI — saving is a filing action, not an
 * analysis, which is the line the whole surface is built around.
 *
 * The identity it would persist under is already fixed: the canonical,
 * normalized article URL, never the provider article id.
 */
export function HomeSaveControl({
  url,
  language,
}: {
  url: string;
  language: LanguageCode;
}): JSX.Element {
  const [isSaved, setIsSaved] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const t = getDictionary(language).myIntelligence;

  /* Computed so the key this lane would persist under is exercised, not assumed. */
  void savedStoryRef(url);

  return (
    <>
      <span className="absolute bottom-[10px] right-[10px] z-10 lg:bottom-[12px] lg:right-[12px]">
        <BookmarkButton
          isSaved={isSaved}
          language={language}
          onToggle={() => {
            setIsSaved((saved) => !saved);
            setShowToast(true);
            window.setTimeout(() => setShowToast(false), 2600);
          }}
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
