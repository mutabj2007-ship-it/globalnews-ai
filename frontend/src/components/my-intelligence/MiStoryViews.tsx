'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { MI_CARD, MI_UNAVAILABLE } from './miPresentation';
import { BookmarkButton, CategoryChip, CountryChip, SelectionHook, fill } from './MiPrimitives';
import { hasObservationTime } from './newSince';
import type { FixtureStory } from './devFixtures';
import type { SyntheticEvent } from 'react';
import { safeExternalHref } from '@globalnews-ai/shared';

/**
 * COLOR / ACTION-AWARENESS R1 — THE STORY'S OWN IMAGE, OR AN HONEST FALLBACK.
 *
 * The defect: both saved-story views rendered the "no image" placeholder
 * unconditionally, so a retained story that DID carry an imageUrl never
 * showed it. The mapping from the live API already carries imageUrl; only the
 * view discarded it.
 *
 * Only an absolute http(s) URL on the story itself is used — nothing is
 * invented and no decorative stand-in is ever presented as the story's image.
 * The designed placeholder sits UNDER the image, so a URL that 404s or times
 * out is hidden and reveals the placeholder instead of a broken-image glyph.
 */
export function storyImageSrc(story: Pick<FixtureStory, 'imageUrl'>): string | undefined {
  const raw = story.imageUrl;
  if (typeof raw !== 'string' || raw.trim().length === 0) return undefined;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Stateless, so it works identically for every card. */
export function hideFailedStoryImage(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = 'none';
}

export function StoryImage({
  story,
  fallback,
  className,
  fallbackClassName,
}: {
  story: FixtureStory;
  fallback: string;
  className: string;
  fallbackClassName: string;
}): JSX.Element {
  const src = storyImageSrc(story);

  return (
    <span data-mi-story-image={src ? 'present' : 'missing'} className={`relative overflow-hidden ${className}`}>
      <span aria-hidden={src ? 'true' : undefined} className={fallbackClassName}>
        {fallback}
      </span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={hideFailedStoryImage}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}

/**
 * INTEREST + SELECTION HOOK R1 — WHERE THE HOOK SITS.
 *
 * Absolute at the LEFT-MIDDLE, never a flex column, so it takes no width from
 * the headline. Rows (What changed, the phone Saved list) put it in the card's
 * own left padding, straddling the card edge from md; below md the row gives
 * it a 16px inset. Cards straddle their own left edge; the card grid's gap is
 * wider than the straddle, so a hook never reaches the neighbouring card.
 */
const ROW_HOOK = 'absolute left-[-30px] top-1/2 -translate-y-1/2 md:left-[-44px]';
const ROW_INSET = 'pl-[16px] md:pl-0';
const CARD_HOOK = 'absolute left-[-14px] top-1/2 -translate-y-1/2 md:left-[-22px]';

interface CommonProps {
  story: FixtureStory;
  language: LanguageCode;
  isSaved: boolean;
  onToggleSaved: () => void;
  selecting: boolean;
  isSelected: boolean;
  onToggleSelected: () => void;
}

/**
 * The publisher link.
 *
 * `target="_blank"` with `rel="noopener noreferrer"` because that is what
 * activating a story does on this product today — the Home click contract
 * records `now.card` as an EXTERNAL destination opening in a new tab, and this
 * surface does not invent a different behaviour for the same object.
 *
 * A story whose source is unavailable is not a link at all. Rendering a dead
 * anchor would promise the reader something the product knows is false.
 */
export function StoryTitle({
  story,
  className,
}: {
  story: FixtureStory;
  className: string;
}): JSX.Element {
  if (story.sourceUnavailable === true) {
    return <span className={className}>{story.title}</span>;
  }

  return (
    <a
      href={safeExternalHref(story.url)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} hover:text-[#bfe0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50`}
    >
      {story.title}
    </a>
  );
}

/**
 * The meta line.
 *
 * "identified … · published …" is the governed shape, and the "identified"
 * half is OMITTED — not substituted — when the record carries no observation
 * time. That omission is the honest form of a gap in our own records; filling
 * it with `publishedAt` would manufacture a first-observation claim.
 *
 * "Sample" is the frozen design's own marker and doubles here as the per-card
 * statement that this is fixture data.
 */
function MetaLine({
  story,
  language,
  showObservation,
  savedAge,
}: {
  story: FixtureStory;
  language: LanguageCode;
  showObservation: boolean;
  savedAge?: string;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence;
  const parts: string[] = [story.sourceName, t.sampleLabel];

  if (savedAge !== undefined) {
    parts.push(savedAge);
  } else {
    if (showObservation && hasObservationTime(story)) {
      parts.push(fill(t.newSince.identifiedAgo, { age: formatRelativeTime(story.firstSeenAt as string, language) }));
    }
    parts.push(fill(t.newSince.publishedAgo, { age: formatRelativeTime(story.publishedAt, language) }));
  }

  return (
    <p className="text-[12.5px] leading-[1.5] text-[#7d92aa]">{parts.join(' · ')}</p>
  );
}

function UnavailableNotice({ language }: { language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).myIntelligence.saved;

  return (
    <p className={`mt-1.5 flex items-start gap-1.5 text-[12px] leading-[1.45] ${MI_UNAVAILABLE}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-[2px] h-[14px] w-[14px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 3.5 8.5M3 3l18 18" />
      </svg>
      <span>{t.sourceUnavailable}</span>
    </p>
  );
}

/**
 * The compact New-since row. No image on purpose: this section is a change
 * list, not a second feed, and an image would make it read like one.
 */
export function NewSinceRow({
  story,
  language,
  isSaved,
  onToggleSaved,
  selecting,
  isSelected,
  onToggleSelected,
}: CommonProps): JSX.Element {
  const t = getDictionary(language).myIntelligence;
  const blocked = story.sourceUnavailable === true;

  return (
    <li data-mi-story-row="" className={`relative flex items-start gap-3 border-b border-[#0a2744] py-3 last:border-b-0 ${ROW_INSET}`}>
      <SelectionHook
        checked={isSelected}
        disabled={blocked}
        onChange={onToggleSelected}
        title={story.title}
        language={language}
        className={ROW_HOOK}
      />
      <span className="mt-[3px] shrink-0">
        <CountryChip code={story.countryCode} />
      </span>
      <span className="min-w-0 flex-1">
        <StoryTitle
          story={story}
          className="block text-[14.5px] font-bold leading-[1.3] text-white [overflow-wrap:anywhere]"
        />
        <span className="mt-1 block">
          <MetaLine story={story} language={language} showObservation />
        </span>
        {blocked && <UnavailableNotice language={language} />}
      </span>
      <BookmarkButton
        isSaved={isSaved}
        onToggle={onToggleSaved}
        language={language}
        className="shrink-0"
      />
    </li>
  );
}

/** The phone row form of a saved story: 84px square thumb, text, 44px bookmark. */
export function SavedRow(props: CommonProps): JSX.Element {
  const { story, language, isSaved, onToggleSaved, selecting, isSelected, onToggleSelected } = props;
  const t = getDictionary(language).myIntelligence;
  const blocked = story.sourceUnavailable === true;

  return (
    <li data-mi-story-row="" className={`relative flex items-start gap-3 border-b border-[#0a2744] py-3 last:border-b-0 ${ROW_INSET}`}>
      <SelectionHook
        checked={isSelected}
        disabled={blocked}
        onChange={onToggleSelected}
        title={story.title}
        language={language}
        className={ROW_HOOK}
      />
      <StoryImage
        story={story}
        fallback={t.saved.noImage}
        className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-[10px] border border-[#0e2d4d] bg-[linear-gradient(140deg,#0b2742,#061a30)]"
        fallbackClassName="px-1.5 text-center text-[10px] leading-[1.3] text-[#54687e]"
      />
      <span className="min-w-0 flex-1">
        <span className="mb-1 block">
          <CategoryChip label={getDictionary(language).map.categories[story.category] ?? story.category} />
        </span>
        <StoryTitle
          story={story}
          className="block text-[14.5px] font-bold leading-[1.3] text-white [overflow-wrap:anywhere]"
        />
        <span className="mt-1 block">
          <MetaLine
            story={story}
            language={language}
            showObservation={false}
            savedAge={fill(t.saved.savedAgo, {
              age: formatRelativeTime(story.savedAt ?? story.publishedAt, language),
            })}
          />
        </span>
        {blocked && <UnavailableNotice language={language} />}
      </span>
      <BookmarkButton isSaved={isSaved} onToggle={onToggleSaved} language={language} className="shrink-0" />
    </li>
  );
}

/**
 * The tablet/desktop card form. The headline is NOT clamped: R1.2 rules that a
 * long headline wraps in full, because truncating a saved reference hides the
 * very thing the reader chose to keep.
 */
export function SavedCard(props: CommonProps & { reason?: string; compact?: boolean; dense?: boolean }): JSX.Element {
  const { story, language, isSaved, onToggleSaved, isSelected, onToggleSelected, reason, compact = false } = props;
  /* The small-thumbnail geometry. `compact` (For you) also clamps; `dense` alone (the Saved destination) keeps full headlines. */
  const dense = compact || props.dense === true;
  const t = getDictionary(language).myIntelligence;
  const blocked = story.sourceUnavailable === true;

  /*
    DENSITY R1 — an intelligence row, not a photo card: the story's own image
    (76px phone, 96px tablet, 104px desktop, object-cover) beside the text.

    INTEREST + SELECTION HOOK R1 — CARD GEOMETRY RECOVERY. The selection
    control used to be a flex column that appeared only in selection mode, and
    For you inherited Saved's "headline never clamps" rule, so opening the
    360px selection rail turned the cards into narrow skyscrapers. Now:
      · the sand hook is ABSOLUTE at the left-middle and always present — it
        takes no width, in or out of selection mode;
      · a `compact` card (For you) clamps its headline (3 lines) and bounds
        the reason and meta lines to one line each; the Saved destination
        keeps full titles, as R1.2 ruled for saved references — it takes
        the `dense` geometry (small thumbnail, bookmark on the meta line) and
        a 360px grid track, so a full headline never becomes a 104px strip;
      · a compact card takes a smaller thumbnail and carries its bookmark on
        the meta line, so a ~320px card still gives the headline ~200px;
      · the bookmark is never inside the link.
    Selected: a restrained sand edge and halo on the card, not cyan.
  */
  return (
    <li
      data-mi-story-card=""
      data-mi-card-compact={compact ? 'true' : undefined}
      className={`${MI_CARD} relative flex items-start gap-3 p-3 pl-[38px] md:pl-[32px] ${
        isSelected ? 'border-[#6A5634] shadow-[0_0_0_1px_rgba(217,185,138,0.28),0_0_22px_-10px_rgba(217,185,138,0.45)]' : ''
      }`}
    >
      <SelectionHook
        checked={isSelected}
        disabled={blocked}
        onChange={onToggleSelected}
        title={story.title}
        language={language}
        className={CARD_HOOK}
      />
      <StoryImage
        story={story}
        fallback={t.saved.noImage}
        className={`flex shrink-0 items-center justify-center rounded-[10px] border border-[#0e2d4d] bg-[linear-gradient(140deg,#0b2742,#061a30)] ${
          dense ? 'h-[72px] w-[72px] xl:h-[80px] xl:w-[80px]' : 'h-[76px] w-[76px] md:h-[96px] md:w-[96px] xl:h-[104px] xl:w-[104px]'
        }`}
        fallbackClassName="px-1.5 text-center text-[10px] leading-[1.3] text-[#54687e]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <CategoryChip label={getDictionary(language).map.categories[story.category] ?? story.category} />
        <StoryTitle
          story={story}
          className={`text-[14.5px] font-bold leading-[1.28] text-white [overflow-wrap:anywhere] md:text-[15px] ${compact ? 'line-clamp-3' : 'block'}`}
        />
        {reason !== undefined && (
          <p className={`text-[12px] leading-[1.4] text-[#5abff5] ${compact ? 'truncate' : ''}`} title={reason}>
            {reason}
          </p>
        )}
        <div className={dense ? 'flex min-w-0 items-center gap-1' : ''}>
          <div className={dense ? 'min-w-0 flex-1 truncate [&>p]:truncate' : ''}>
            <MetaLine
              story={story}
              language={language}
              showObservation={story.savedAt === undefined}
              savedAge={
                story.savedAt === undefined
                  ? undefined
                  : fill(t.saved.savedAgo, { age: formatRelativeTime(story.savedAt, language) })
              }
            />
          </div>
          {dense && <BookmarkButton isSaved={isSaved} onToggle={onToggleSaved} language={language} className="-mb-[8px] shrink-0" />}
        </div>
        {blocked && <UnavailableNotice language={language} />}
      </div>
      {!dense && <BookmarkButton isSaved={isSaved} onToggle={onToggleSaved} language={language} className="shrink-0" />}
    </li>
  );
}
