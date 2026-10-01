'use client';

import { useState } from 'react';
import { Bell, BellRing, Check, MessagesSquare, SquarePlus } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { StoryBookmark } from '@/components/bookmark/StoryBookmark';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { toggleHeldStory, useHeldStories, type HeldStoryCard } from '@/lib/home/heldStoriesStore';
import { openAlertSetup, openAlertsCentre, openDiscussion, useStageB } from '@/lib/stories/stageBStore';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME R1 · STAGE A — THE SHARED STORY-ACTION PRESENTATION (FINAL spec §13 StoryCardActions)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Design's row is Discuss · Alert · Save · Compare, as SIBLINGS of the publisher link —
 * never inside it, so the headline, image and "Read source" keep opening the publisher
 * exactly as before (WP2; Claude H T-14).
 *
 * ONLY WHAT EXISTS IS DRAWN. STAGE B: Discuss renders only under discussion.read and Alert
 * only under alerts.inApp; with either gate OFF its slot renders NOTHING — no disabled
 * teaser, no "coming soon". Discuss shows a number ONLY when the server reported one (> 0);
 * otherwise the plain word. Alert shows "Alert on" only when the server says this reader
 * alerts on the story. Save is the EXISTING StoryBookmark. Compare holds the story in the
 * zero-network held-stories store (8 max, the ninth refused and said so).
 *
 * Every control here is local, the existing Save call, or opens a Stage B panel: no AI, no
 * provider, no analysis.
 */
export function StoryCardActions({
  articleRef,
  url,
  card,
  language,
  compare,
  discuss = false,
  alert = false,
}: {
  readonly articleRef: string;
  readonly url: string;
  readonly card: HeldStoryCard;
  readonly language: LanguageCode;
  /** compare.tray — Hold for comparison. */
  readonly compare: boolean;
  /** discussion.read — the Discuss sibling. */
  readonly discuss?: boolean;
  /** alerts.inApp — the Alert sibling. */
  readonly alert?: boolean;
}): JSX.Element {
  const t = getDictionary(language).homeR1;
  const held = useHeldStories();
  const isHeld = held.some((s) => s.articleRef === articleRef);
  const [refused, setRefused] = useState(false);
  const { counts, alertsByRef } = useStageB();
  const count = counts[articleRef];
  const alertOn = alertsByRef[articleRef] !== undefined;
  const target = { articleRef, url, title: card.title, sourceName: card.sourceName };
  const BUTTON =
    'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]';

  return (
    <div role="group" aria-label={t.stories.actionsAria} data-story-actions="" className="flex items-stretch border-t border-[var(--gt-line2)]">
      {discuss && (
        <button
          type="button"
          data-story-action="discuss"
          data-discussion-count={count ?? 0}
          onClick={() => openDiscussion(target)}
          className={`${BUTTON} text-[var(--gt-ink2)] hover:text-[var(--gt-ink)]`}
        >
          <MessagesSquare aria-hidden="true" className="h-4 w-4" />
          <span>{count !== undefined && count > 0 ? `${t.stories.discuss} · ${count}` : t.stories.discuss}</span>
        </button>
      )}
      {alert && (
        <button
          type="button"
          data-story-action="alert"
          aria-pressed={alertOn}
          onClick={() => (alertOn ? openAlertsCentre() : openAlertSetup(target))}
          className={`${BUTTON} ${alertOn ? 'bg-[var(--gt-amberBg)] text-[var(--gt-amberInk)]' : 'text-[var(--gt-ink2)] hover:text-[var(--gt-ink)]'}`}
        >
          {alertOn ? <BellRing aria-hidden="true" className="h-4 w-4" /> : <Bell aria-hidden="true" className="h-4 w-4" />}
          <span>{alertOn ? t.alerts.alertOn : t.stories.alert}</span>
        </button>
      )}
      <span data-story-action="save" className="flex flex-1 items-center justify-center">
        <StoryBookmark url={url} language={language} className="!border-[var(--gt-pgLine2)] !bg-[var(--gt-card)] !text-[var(--gt-link)] !ring-offset-[var(--gt-card)]" />
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
          className={`${BUTTON} ${isHeld ? 'bg-[var(--gt-actSoft)] text-[var(--gt-link)]' : 'text-[var(--gt-ink2)] hover:text-[var(--gt-ink)]'}`}
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
