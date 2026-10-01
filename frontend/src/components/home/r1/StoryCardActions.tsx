'use client';

import { useState } from 'react';
import { Check, SquarePlus } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { StoryBookmark } from '@/components/bookmark/StoryBookmark';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { toggleHeldStory, useHeldStories, type HeldStoryCard } from '@/lib/home/heldStoriesStore';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME R1 · STAGE A — THE SHARED STORY-ACTION PRESENTATION (FINAL spec §13 StoryCardActions)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Design's row is Discuss · Alert · Save · Compare, as SIBLINGS of the publisher link —
 * never inside it, so the headline, image and "Read source" keep opening the publisher
 * exactly as before (WP2; Claude H T-14).
 *
 * ONLY WHAT EXISTS IS DRAWN. Discussion and Alerts have no backend yet (Stage B, schema-
 * dependent): their slots are part of this architecture but are declared OFF
 * (`STAGE_A_UNAVAILABLE`) and render NOTHING — no disabled teaser, no count, no "coming
 * soon" control that quietly does nothing. Save is the EXISTING StoryBookmark. Compare holds
 * the story in the zero-network held-stories store (8 max, the ninth refused and said so).
 *
 * Every control here is local or the existing Save call: no AI, no provider, no analysis.
 */
export function StoryCardActions({
  articleRef,
  url,
  card,
  language,
  compare,
}: {
  readonly articleRef: string;
  readonly url: string;
  readonly card: HeldStoryCard;
  readonly language: LanguageCode;
  /** compare.tray — Hold for comparison. */
  readonly compare: boolean;
}): JSX.Element {
  const t = getDictionary(language).homeR1;
  const held = useHeldStories();
  const isHeld = held.some((s) => s.articleRef === articleRef);
  const [refused, setRefused] = useState(false);

  return (
    <div role="group" aria-label={t.stories.actionsAria} data-story-actions="" className="flex items-stretch border-t border-[#E3E8EE]">
      {/* Discuss / Alert slots: Stage B (STAGE_A_UNAVAILABLE) — nothing is rendered for them. */}
      <span data-story-action="save" className="flex flex-1 items-center justify-center">
        <StoryBookmark url={url} language={language} className="!border-[#C9D3DE] !bg-white !text-[#245FC7] !ring-offset-white" />
      </span>
      {compare && (
        <button
          type="button"
          data-story-action="compare"
          aria-pressed={isHeld}
          onClick={() => {
            const outcome = toggleHeldStory({ articleRef, url, card });
            setRefused(outcome === 'full');
          }}
          className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245FC7] ${
            isHeld ? 'bg-[#EAF1FC] text-[#245FC7]' : 'text-[#526174] hover:text-[#14243B]'
          }`}
        >
          {isHeld ? <Check aria-hidden="true" className="h-4 w-4" /> : <SquarePlus aria-hidden="true" className="h-4 w-4" />}
          <span>{isHeld ? t.stories.selected : t.stories.compare}</span>
        </button>
      )}
      {refused && (
        <span role="status" className="sr-only">
          {t.tray.max}
        </span>
      )}
    </div>
  );
}
