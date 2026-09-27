'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import { StoryBookmark } from '@/components/bookmark/StoryBookmark';

/**
 * Home bookmark backed by the live My Intelligence saved-story API.
 *
 * Saving remains ordinary account persistence: it performs no AI and no live
 * provider retrieval. The server resolves the story from retained reporting
 * and returns the governed SHA-256 articleRef.
 *
 * UNIVERSAL BOOKMARK R1 — now the shared StoryBookmark, so every Home card
 * reads the ONE saved-story store (one GET for the page, not one per card)
 * and a signed-out reader gets the governed sign-in instead of a silent
 * failure. The overlay position is unchanged.
 */
export function HomeSaveControl({
  url,
  language,
}: {
  url: string;
  language: LanguageCode;
}): JSX.Element {
  return (
    <span className="absolute bottom-[10px] right-[10px] z-10 lg:bottom-[12px] lg:right-[12px]">
      <StoryBookmark url={url} language={language} />
    </span>
  );
}
