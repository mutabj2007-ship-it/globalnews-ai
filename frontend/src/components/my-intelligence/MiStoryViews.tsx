'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { MI_CARD, MI_UNAVAILABLE } from './miPresentation';
import { BookmarkButton, CategoryChip, CountryChip, SelectCheckbox, fill } from './MiPrimitives';
import { hasObservationTime } from './newSince';
import type { FixtureStory } from './devFixtures';
import type { SyntheticEvent } from 'react';

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

function StoryImage({
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
function StoryTitle({
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
      href={story.url}
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
    <li className={`flex items-start gap-3 border-b border-[#0a2744] py-3 last:border-b-0`}>
      {selecting && (
        <SelectCheckbox
          checked={isSelected}
          disabled={blocked}
          onChange={onToggleSelected}
          label={blocked ? t.selection.cannotSelect : story.title}
        />
      )}
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
    <li className="flex items-start gap-3 border-b border-[#0a2744] py-3 last:border-b-0">
      {selecting && (
        <SelectCheckbox
          checked={isSelected}
          disabled={blocked}
          onChange={onToggleSelected}
          label={blocked ? t.selection.cannotSelect : story.title}
        />
      )}
      <StoryImage
        story={story}
        fallback={t.saved.noImage}
        className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-[10px] border border-[#0e2d4d] bg-[linear-gradient(140deg,#0b2742,#061a30)]"
        fallbackClassName="px-1.5 text-center text-[10px] leading-[1.3] text-[#54687e]"
      />
      <span className="min-w-0 flex-1">
        <span className="mb-1 block">
          <CategoryChip label={story.category} />
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
export function SavedCard(props: CommonProps & { reason?: string }): JSX.Element {
  const { story, language, isSaved, onToggleSaved, selecting, isSelected, onToggleSelected, reason } =
    props;
  const t = getDictionary(language).myIntelligence;
  const blocked = story.sourceUnavailable === true;

  /*
    DENSITY R1 — an intelligence row, not a photo card. The story's own image
    stays (76px phone, 96px tablet, 104px desktop, cropped with object-cover,
    never stretched), beside the text instead of above it, so a desktop
    viewport shows materially more stories. The selection checkbox leads and
    the bookmark trails, so the two can never overlap.
  */
  return (
    <li
      data-mi-story-card=""
      className={`${MI_CARD} relative flex items-start gap-3 p-3 ${
        isSelected ? 'border-[#5abff5] bg-[#061c33]' : ''
      }`}
    >
      {selecting && (
        <span className="shrink-0 self-center">
          <SelectCheckbox
            checked={isSelected}
            disabled={blocked}
            onChange={onToggleSelected}
            label={blocked ? t.selection.cannotSelect : story.title}
          />
        </span>
      )}
      <StoryImage
        story={story}
        fallback={t.saved.noImage}
        className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[10px] border border-[#0e2d4d] bg-[linear-gradient(140deg,#0b2742,#061a30)] md:h-[96px] md:w-[96px] xl:h-[104px] xl:w-[104px]"
        fallbackClassName="px-1.5 text-center text-[10px] leading-[1.3] text-[#54687e]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <CategoryChip label={story.category} />
        <StoryTitle
          story={story}
          className="block text-[14.5px] font-bold leading-[1.28] text-white [overflow-wrap:anywhere] md:text-[15px]"
        />
        {reason !== undefined && (
          <p className="text-[12px] italic leading-[1.4] text-[#93a7bd]">{reason}</p>
        )}
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
        {blocked && <UnavailableNotice language={language} />}
      </div>
      <BookmarkButton isSaved={isSaved} onToggle={onToggleSaved} language={language} className="shrink-0" />
    </li>
  );
}
