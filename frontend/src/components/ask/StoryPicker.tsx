'use client';

import { useEffect, useId, useRef, useState, type JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { safeExternalHref } from '@globalnews-ai/shared';
import { d01Strings, fillD01 } from '@/lib/ask/d01Strings';
import { searchPickerStories, type PickerSearchResult, type PickerStory } from '@/lib/api/storyPickerApi';
import { readStoryBrief } from '@/lib/api/storyBriefApi';
import type { BriefResult, StoredBriefContent, StoryBriefView } from '@/lib/storyBrief/storyBriefView';
import { askFormatLocalDayCompact } from '@/lib/ask/askDirection';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK D0.1 · D1 — "EXPLAIN A STORY": THE ZERO-COMPUTE STORY PICKER (S01–S06)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Built to the accepted Claude Design D0.1 screens and action/API matrix (G2-1 … G2-10):
 *
 *   S01  opens empty, search focused, no request (under 2 characters nothing is sent)
 *   S02  stored results: title, publisher, "Published"/"Seen" by date basis. No summary, image,
 *        stored-explanation tag or other-reports count (D04, U-1)
 *   S03  RIGHTS_HOLD: no rows — the default until E1 clears publisher content (pickerPublisherContent)
 *   S04  UNAVAILABLE: the search gate is off (404) or failing
 *   S05  a story with a storyId: GET /stories/:id/brief (read only). READY/PARTIAL/INSUFFICIENT/STALE
 *        are readable with their notices; CHECKING/NONE/FAILED/off are notices only (Erratum E1, Q3)
 *   S06  no storyId: the article reference only. ensureStoryForArticle is NEVER called (D05)
 *
 * Nothing here generates a Brief, creates a Story or sends a question. "Ask about this story" /
 * "Ask a follow-up" only STAGE a composer draft; the reader sends (G2-7, G2-8).
 */
type View =
  | { readonly kind: 'search' }
  | { readonly kind: 'story'; readonly story: PickerStory };

type BriefLoad = { readonly kind: 'loading' } | { readonly kind: 'done'; readonly result: BriefResult<StoryBriefView> };

export function StoryPicker({
  locale,
  onClose,
  onStageDraft,
}: {
  readonly locale: DisplayLocale;
  readonly onClose: () => void;
  /** Stages the composer draft; never submits. */
  readonly onStageDraft: (draft: string) => void;
}): JSX.Element {
  const s = d01Strings(locale);
  const titleId = useId();
  const [view, setView] = useState<View>({ kind: 'search' });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-ask="story-picker"
      onKeyDown={(event) => {
        /* G2-10 — Esc closes; the draft is kept and focus returns to the cue (parent) */
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex flex-col bg-void md:inset-x-auto md:left-1/2 md:top-10 md:bottom-10 md:w-[30rem] md:-translate-x-1/2 md:rounded-2xl md:border md:border-line md:shadow-xl"
    >
      {view.kind === 'search' ? (
        <PickerSearch locale={locale} titleId={titleId} onClose={onClose} onOpen={(story) => setView({ kind: 'story', story })} />
      ) : (
        <PickerStoryView
          locale={locale}
          titleId={titleId}
          story={view.story}
          onBack={() => setView({ kind: 'search' })}
          onStageDraft={onStageDraft}
        />
      )}
      <span className="sr-only">{s.pickerNote}</span>
    </div>
  );
}

function Notice({ children, kind }: { readonly children: string; readonly kind: string }): JSX.Element {
  return (
    <p role="status" data-ask={`picker-notice-${kind}`} className="rounded-xl bg-surface-raised px-3.5 py-3 text-[14px] leading-snug text-ink-primary">
      {children}
    </p>
  );
}

function dateLine(story: PickerStory, locale: DisplayLocale): string {
  const s = d01Strings(locale);
  const day = askFormatLocalDayCompact(new Date(story.date), locale, new Date());
  return story.dateBasis === 'publisher' ? `${s.published} ${day}` : fillD01(s.seenOn, { d: day });
}

function PickerSearch({
  locale,
  titleId,
  onClose,
  onOpen,
}: {
  readonly locale: DisplayLocale;
  readonly titleId: string;
  readonly onClose: () => void;
  readonly onOpen: (story: PickerStory) => void;
}): JSX.Element {
  const s = d01Strings(locale);
  const [q, setQ] = useState('');
  const [result, setResult] = useState<PickerSearchResult>({ kind: 'TOO_SHORT' });
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    let live = true;
    /* Debounced (G2-2). Under 2 characters searchPickerStories resolves TOO_SHORT without a request. */
    const timer = setTimeout(() => {
      void searchPickerStories(q).then((next) => live && setResult(next));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);

  return (
    <>
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 id={titleId} className="text-[19px] font-semibold text-ink-primary">
          {s.storyTitle}
        </h2>
        <button type="button" data-ask="picker-close" aria-label={s.close} onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full text-ink-secondary">
          <span aria-hidden="true">✕</span>
        </button>
      </header>
      <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-6">
        <label className="flex items-center gap-2 rounded-xl border border-signal bg-surface px-3.5 py-3">
          <span aria-hidden="true" className="text-ink-tertiary">⌕</span>
          <input
            ref={input}
            type="search"
            data-ask="picker-search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={s.storySearch}
            aria-label={s.storySearch}
            className="w-full bg-transparent text-[15px] text-ink-primary outline-none placeholder:text-ink-tertiary"
          />
        </label>
        <p className="text-[13px] text-ink-tertiary">{s.pickerNote}</p>
        <PickerResults result={result} q={q} locale={locale} onOpen={onOpen} />
      </div>
    </>
  );
}

function PickerResults({
  result,
  q,
  locale,
  onOpen,
}: {
  readonly result: PickerSearchResult;
  readonly q: string;
  readonly locale: DisplayLocale;
  readonly onOpen: (story: PickerStory) => void;
}): JSX.Element {
  const s = d01Strings(locale);
  switch (result.kind) {
    case 'TOO_SHORT':
      return <Notice kind="min-chars">{s.minChars}</Notice>;
    case 'RIGHTS_HOLD':
      return <Notice kind="rights-hold">{s.rightsPicker}</Notice>;
    case 'UNAVAILABLE':
      return <Notice kind="unavailable">{s.unavailable}</Notice>;
    case 'NETWORK':
      return <Notice kind="network">{s.network}</Notice>;
    case 'OK':
      if (result.stories.length === 0) return <Notice kind="no-story">{fillD01(s.noStory, { q: q.trim() })}</Notice>;
      return (
        <ul data-ask="picker-results" className="overflow-hidden rounded-xl border border-line bg-surface">
          {result.stories.map((story) => (
            <li key={story.articleRef} className="border-b border-line last:border-b-0">
              <button type="button" data-ask="picker-row" onClick={() => onOpen(story)} className="flex w-full items-center gap-3 px-3.5 py-3 text-start">
                <span className="min-w-0 flex-1">
                  <span dir="auto" className="block text-[15px] font-medium leading-snug text-ink-primary">
                    {story.title}
                  </span>
                  <span className="mt-1 block text-[13px] text-ink-tertiary">
                    {story.publisher} · {dateLine(story, locale)}
                  </span>
                </span>
                <span aria-hidden="true" className="text-ink-tertiary">›</span>
              </button>
            </li>
          ))}
        </ul>
      );
  }
}

function PickerStoryView({
  locale,
  titleId,
  story,
  onBack,
  onStageDraft,
}: {
  readonly locale: DisplayLocale;
  readonly titleId: string;
  readonly story: PickerStory;
  readonly onBack: () => void;
  readonly onStageDraft: (draft: string) => void;
}): JSX.Element {
  const s = d01Strings(locale);
  const [brief, setBrief] = useState<BriefLoad | null>(story.storyId === null ? null : { kind: 'loading' });

  useEffect(() => {
    if (story.storyId === null) return undefined;
    let live = true;
    /* G2-4: the READ path only. POST /stories/:id/brief (generation) is never called from here. */
    void readStoryBrief(story.storyId as never).then((result) => live && setBrief({ kind: 'done', result }));
    return () => {
      live = false;
    };
  }, [story.storyId]);

  const href = safeExternalHref(story.url);
  const readable = brief?.kind === 'done' && brief.result.ok ? readableBrief(brief.result.value) : null;
  return (
    <>
      <header className="border-b border-line px-4 py-3">
        <button type="button" data-ask="picker-back" onClick={onBack} className="min-h-11 text-[15px] font-medium text-signal">
          ‹ {s.storyTitle}
        </button>
      </header>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        <h2 id={titleId} dir="auto" className="text-[19px] font-semibold leading-snug text-ink-primary">
          {story.title}
        </h2>
        <p className="text-[13px] text-ink-tertiary">
          {story.publisher} · {dateLine(story, locale)}
        </p>
        {story.storyId === null ? (
          <Notice kind="no-story-id">{s.noStoryId}</Notice>
        ) : brief === null || brief.kind === 'loading' ? null : (
          <BriefSection result={brief.result} readable={readable} locale={locale} />
        )}
        <section className="flex flex-col gap-2">
          <h3 className="text-[14px] text-ink-secondary">{s.sourcesH}</h3>
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {(readable?.evidence.length ? readable.evidence : [{ id: story.articleRef, url: story.url, title: story.title, publisher: story.publisher, publishedAt: story.date }]).map(
              (source, index) => {
                const link = safeExternalHref(source.url ?? undefined);
                return (
                  <li key={source.id} className="flex items-center gap-2 border-b border-line px-3.5 py-3 text-[13px] last:border-b-0">
                    <span className="text-ink-tertiary">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-secondary">{source.publisher}</span>
                    {link !== undefined && (
                      <a href={link} target="_blank" rel="noopener noreferrer" data-ask="picker-read-original" className="font-medium text-signal">
                        {s.readOriginal}
                      </a>
                    )}
                  </li>
                );
              },
            )}
          </ul>
          {href === undefined ? null : <span className="sr-only">{href}</span>}
        </section>
      </div>
      <footer className="flex flex-col items-center gap-2 border-t border-line px-4 pb-6 pt-3">
        <button
          type="button"
          data-ask={readable === null ? 'picker-ask-about' : 'picker-follow-up'}
          onClick={() => onStageDraft(`${s.draftCtx}: ${story.title}`)}
          className={
            readable === null
              ? 'min-h-12 w-full rounded-full bg-signal px-4 text-[15px] font-semibold text-white'
              : 'min-h-12 w-full rounded-full border border-line bg-surface px-4 text-[15px] font-semibold text-ink-primary'
          }
        >
          {readable === null ? s.askAbout : s.followUp}
        </button>
        <p className="text-center text-[13px] text-ink-tertiary">{s.askNote}</p>
      </footer>
    </>
  );
}

/** Erratum E1 Q3: READY, PARTIAL, INSUFFICIENT and STALE carry a stored, inspectable brief. */
function readableBrief(view: StoryBriefView): StoredBriefContent | null {
  if (view.state === 'READY' || view.state === 'PARTIAL' || view.state === 'INSUFFICIENT' || view.state === 'STALE') return view.brief;
  return null;
}

function BriefSection({
  result,
  readable,
  locale,
}: {
  readonly result: BriefResult<StoryBriefView>;
  readonly readable: StoredBriefContent | null;
  readonly locale: DisplayLocale;
}): JSX.Element {
  const s = d01Strings(locale);
  if (!result.ok) {
    if (result.reason === 'NO_STORY') return <Notice kind="no-story-id">{s.noStoryId}</Notice>;
    return <Notice kind="brief-off">{s.briefOff}</Notice>;
  }
  const view = result.value;
  if (view.state === 'CHECKING') return <Notice kind="checking">{s.checking}</Notice>;
  if (view.state === 'NONE') return <Notice kind="no-brief">{s.noBrief}</Notice>;
  if (view.state === 'FAILED' || readable === null) return <Notice kind="brief-off">{s.briefOff}</Notice>;
  const checkedDay = askFormatLocalDayCompact(new Date(readable.generatedAt), locale, new Date());
  return (
    <section data-ask="picker-brief" data-brief-state={view.state} className="flex flex-col gap-2">
      <h3 className="text-[16px] font-semibold text-ink-primary">
        {s.storedH} <span className="text-[13px] font-normal text-ink-tertiary">· {fillD01(s.checked, { d: checkedDay })}</span>
      </h3>
      {readable.summary !== null && (
        <p dir="auto" className="text-[15px] leading-relaxed text-ink-primary">
          {readable.summary}
        </p>
      )}
      {readable.keyFacts.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {readable.keyFacts.map((fact, index) => (
            <li key={index} dir="auto" className="text-[14px] leading-snug text-ink-primary">
              {fact.claim}{' '}
              {fact.sourceArticleIds.map((id) => {
                const n = readable.evidence.findIndex((source) => source.id === id);
                return n < 0 ? null : (
                  <sup key={id} className="ms-0.5 rounded border border-line px-1 text-[11px] text-ink-tertiary">
                    {n + 1}
                  </sup>
                );
              })}
            </li>
          ))}
        </ul>
      )}
      {view.state === 'STALE' && <Notice kind="stale">{s.stale}</Notice>}
      {view.state === 'PARTIAL' && <Notice kind="partial">{s.partial}</Notice>}
      {view.state === 'INSUFFICIENT' && (
        <>
          <Notice kind="insufficient">{s.insufficient}</Notice>
          {[...readable.coverageGaps, ...readable.uncertainty].length > 0 && (
            <ul data-ask="picker-gaps" className="list-disc ps-5 text-[13px] text-ink-secondary">
              {[...readable.coverageGaps, ...readable.uncertainty].map((gap, index) => (
                <li key={index} dir="auto">
                  {gap}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
