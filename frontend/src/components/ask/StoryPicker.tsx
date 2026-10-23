'use client';

import { useEffect, useId, useRef, useState, type JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { safeExternalHref } from '@globalnews-ai/shared';
import { d01Strings, fillD01 } from '@/lib/ask/d01Strings';
import { searchPickerStories, type PickerSearchResult, type PickerStory } from '@/lib/api/storyPickerApi';
import { readStoryBrief } from '@/lib/api/storyBriefApi';
import type { BriefResult, StoredBriefContent, StoryBriefView } from '@/lib/storyBrief/storyBriefView';
import { askDirectionProps, askFormatLocalDayCompact } from '@/lib/ask/askDirection';
import { r23PickerStrings } from '@/lib/ask/r23PickerStrings';
import { askR38Strings } from '@/lib/ask/askR38Strings';
import { PICKER_PUBLISHER_CONTENT } from '@/lib/rights/pickerPublisherContent';
import tokens from '../account/settingsTokens.module.css';
import styles from './d01.module.css';

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
 *
 * Drawn with the R3 Settings/drawer token scope (settingsScope), so it follows the reader's Ask
 * treatment; a sheet over the dimmed Ask page on phones, a centred dialog from 700 px.
 */
type View =
  | { readonly kind: 'search' }
  | { readonly kind: 'story'; readonly story: PickerStory };

type BriefLoad = { readonly kind: 'loading' } | { readonly kind: 'done'; readonly result: BriefResult<StoryBriefView> };

/**
 * CTO R23 (PO phone defect) — on a phone the on-screen keyboard shrinks the VISUAL viewport, not the
 * layout viewport the fixed backdrop fills, so the sheet's bottom (and its action) sat under the
 * keyboard. The backdrop follows window.visualViewport when the browser has one (the same API
 * AskAiDock already uses); without it (desktop, tests) nothing changes.
 */
function useVisualViewportBox(): { readonly top: number; readonly height: number; readonly bottom: 'auto' } | undefined {
  const [box, setBox] = useState<{ readonly top: number; readonly height: number } | null>(null);
  useEffect(() => {
    const viewport = typeof window === 'undefined' ? null : window.visualViewport;
    if (viewport === null || viewport === undefined) return undefined;
    const update = () => setBox({ top: viewport.offsetTop, height: viewport.height });
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return box === null ? undefined : { top: box.top, height: box.height, bottom: 'auto' };
}

export function StoryPicker({
  locale,
  onClose,
  onStageDraft,
  existingDraft = '',
  onReplaceDraft,
  onAsk,
  initialDescribed = '',
}: {
  readonly locale: DisplayLocale;
  readonly onClose: () => void;
  /** Stages the composer draft; never submits. The parent keeps a reader's unsent question. */
  readonly onStageDraft: (draft: string) => void;
  /** CTO R23 — the reader's unsent composer text, so the picker can say it will be kept. */
  readonly existingDraft?: string;
  /** CTO R23 — an explicit choice to replace that unsent text with the search words. Never submits. */
  readonly onReplaceDraft?: (draft: string) => void;
  /**
   * MASTER CTO R98 (PO iPhone proof) — when given, the held form's primary action ASKS: one explicit
   * tap submits the reader's exact words through the parent's ordinary Ask submission. Opening,
   * typing, focus, Enter and Close still issue nothing. Without it the action only stages (R23).
   */
  readonly onAsk?: (question: string) => void;
  /** R98 — the reader's words, restored when an ask from this form was refused and Ask's box was taken. */
  readonly initialDescribed?: string;
}): JSX.Element {
  const titleId = useId();
  const viewportBox = useVisualViewportBox();
  /*
    MASTER CTO R38 · U-2 — while E1 holds publisher content no stored story can ever be listed, so
    the search sheet was a dead end (an empty 760 px dialog, the action far below the field). Held,
    the dialog says so FIRST and asks for the story in the reader's own words; its one action sits
    under the field and only stages an unsent draft. CLEARED keeps the search picker unchanged.
  */
  const held = PICKER_PUBLISHER_CONTENT !== 'CLEARED';
  const [view, setView] = useState<View>({ kind: 'search' });
  /* The query and its result live HERE, not in the search view, so "‹ Explain a story" from a story
     returns to the same results (S05 → S02) without a second request. */
  const [q, setQ] = useState('');
  const [result, setResult] = useState<PickerSearchResult>({ kind: 'TOO_SHORT' });
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
    <div
      className={`${tokens.settingsScope} ${styles.backdrop}`}
      data-ask="story-picker-backdrop"
      onClick={onClose}
      style={viewportBox}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-ask="story-picker"
        data-ask-picker-mode={held ? 'describe' : 'search'}
        className={held ? `${styles.sheet} ${styles.sheetContent}` : styles.sheet}
        onClick={(event) => event.stopPropagation()}
        {...askDirectionProps(locale)}
        onKeyDown={(event) => {
          /* G2-10 — Esc closes; the draft is kept and focus returns to the cue (parent) */
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
            return;
          }
          /* aria-modal is a promise: Tab stays inside the sheet, exactly as the J01 jobs sheet does */
          if (event.key !== 'Tab') return;
          const nodes = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input, [href]'),
          );
          const first = nodes[0];
          const last = nodes[nodes.length - 1];
          if (first === undefined || last === undefined) return;
          if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        }}
      >
        {held ? (
          <PickerDescribe
            locale={locale}
            titleId={titleId}
            onClose={onClose}
            existingDraft={existingDraft}
            onStageDraft={onStageDraft}
            onReplaceDraft={onReplaceDraft}
            onAsk={onAsk}
            initialDescribed={initialDescribed}
          />
        ) : view.kind === 'search' ? (
          <PickerSearch
            locale={locale}
            titleId={titleId}
            q={q}
            onQ={setQ}
            result={result}
            onClose={onClose}
            onOpen={(story) => setView({ kind: 'story', story })}
            existingDraft={existingDraft}
            onContinue={onStageDraft}
            onReplaceDraft={onReplaceDraft}
          />
        ) : (
          <PickerStoryView
            locale={locale}
            titleId={titleId}
            story={view.story}
            onBack={() => setView({ kind: 'search' })}
            onStageDraft={onStageDraft}
          />
        )}
      </section>
    </div>
  );
}

function Notice({ children, kind }: { readonly children: string; readonly kind: string }): JSX.Element {
  return (
    <p role="status" data-ask={`picker-notice-${kind}`} className={styles.notice}>
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
  q,
  onQ,
  result,
  onClose,
  onOpen,
  existingDraft,
  onContinue,
  onReplaceDraft,
}: {
  readonly locale: DisplayLocale;
  readonly titleId: string;
  readonly q: string;
  readonly onQ: (q: string) => void;
  readonly result: PickerSearchResult;
  readonly onClose: () => void;
  readonly onOpen: (story: PickerStory) => void;
  readonly existingDraft: string;
  readonly onContinue: (draft: string) => void;
  readonly onReplaceDraft?: (draft: string) => void;
}): JSX.Element {
  const s = d01Strings(locale);
  const r23 = r23PickerStrings(locale);
  const input = useRef<HTMLInputElement | null>(null);
  /*
    CTO R23 — the way back into Ask, always present (empty or typed, any search state, including the
    rights HOLD where no row can ever appear). It only STAGES: the reader's exact words go to the Ask
    composer UNSENT; the composer's own Send is the only submit. A search term is not evidence that a
    story is held, so nothing here invents a story, title or link.
      · empty search         → "Ask a question": close, focus the composer, no text invented
      · typed, composer empty → the typed words become the unsent draft
      · typed, composer has unsent words → those are KEPT (the parent's stageGuidedDraft rule) and
        the conflict is shown, with an explicit choice to use the search words instead
  */
  const typed = q.trim();
  const kept = existingDraft.trim();
  const conflict = typed.length > 0 && kept.length > 0 && kept !== typed && onReplaceDraft !== undefined;

  useEffect(() => input.current?.focus(), []);

  return (
    <>
      <header className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {s.storyTitle}
        </h2>
        <button type="button" data-ask="picker-close" aria-label={s.close} onClick={onClose} className={styles.iconButton}>
          <span aria-hidden="true">✕</span>
        </button>
      </header>
      <div className={styles.body}>
        <label className={styles.search}>
          <span aria-hidden="true" className={styles.searchGlyph}>
            ⌕
          </span>
          <input
            ref={input}
            type="search"
            data-ask="picker-search"
            value={q}
            onChange={(event) => onQ(event.target.value)}
            placeholder={s.storySearch}
            aria-label={s.storySearch}
          />
        </label>
        <p className={styles.small}>{s.pickerNote}</p>
        <PickerResults result={result} q={q} locale={locale} onOpen={onOpen} />
      </div>
      <footer className={styles.foot} data-ask="picker-continue-foot">
        {conflict && (
          <p role="status" data-ask="picker-draft-kept" className={styles.small} style={{ textAlign: 'center' }}>
            {r23.keptDraft}
          </p>
        )}
        <button
          type="button"
          data-ask="picker-continue"
          data-staged={!conflict && typed.length > 0 ? 'typed' : 'none'}
          onClick={() => onContinue(conflict ? '' : typed)}
          className={styles.primary}
          style={{ flexDirection: 'column', gap: 2, padding: '6px 16px' }}
        >
          <span>{r23.askLabel}</span>
          {!conflict && typed.length > 0 && (
            <span dir="auto" data-ask="picker-continue-text" className={styles.continueText}>
              “{typed}”
            </span>
          )}
        </button>
        {conflict && onReplaceDraft !== undefined && (
          <button
            type="button"
            data-ask="picker-replace-draft"
            onClick={() => onReplaceDraft(typed)}
            className={styles.secondary}
            style={{ flexDirection: 'column', gap: 2, padding: '6px 16px' }}
          >
            <span>{r23.useSearchText}</span>
            <span dir="auto" className={styles.continueText}>
              “{typed}”
            </span>
          </button>
        )}
      </footer>
    </>
  );
}

/**
 * MASTER CTO R38 · U-2 — Explain a story while stored stories are held: the limitation first, one
 * field for the story in the reader's words, the action directly under it. Nothing is searched,
 * read or sent; the action only STAGES a draft (R23 rules: an unsent question in the Ask box is
 * kept unless the reader explicitly chooses to replace it; empty → close and focus the composer).
 */
function PickerDescribe({
  locale,
  titleId,
  onClose,
  existingDraft,
  onStageDraft,
  onReplaceDraft,
  onAsk,
  initialDescribed = '',
}: {
  readonly locale: DisplayLocale;
  readonly titleId: string;
  readonly onClose: () => void;
  readonly existingDraft: string;
  readonly onStageDraft: (draft: string) => void;
  readonly onReplaceDraft?: (draft: string) => void;
  readonly onAsk?: (question: string) => void;
  readonly initialDescribed?: string;
}): JSX.Element {
  const s = d01Strings(locale);
  const r23 = r23PickerStrings(locale);
  const r38 = askR38Strings(locale);
  const input = useRef<HTMLInputElement | null>(null);
  const noticeId = useId();
  const [described, setDescribed] = useState(initialDescribed);
  const typed = described.trim();
  const draft = typed.length > 0 ? r38.storyDraft(typed) : '';
  const kept = existingDraft.trim();
  const conflict = typed.length > 0 && kept.length > 0 && kept !== draft && onReplaceDraft !== undefined;

  useEffect(() => input.current?.focus(), []);

  return (
    <>
      <header className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {s.storyTitle}
        </h2>
        <button type="button" data-ask="picker-close" aria-label={s.close} onClick={onClose} className={styles.iconButton}>
          <span aria-hidden="true">✕</span>
        </button>
      </header>
      {/* R23 — Enter in the field never stages anything; only the explicit action below does. */}
      <div className={styles.bodyContent} data-ask="picker-describe-form">
        <p id={noticeId} data-ask="picker-notice-rights-hold" className={styles.notice}>
          {r38.storyHeldNotice}
        </p>
        <label className={styles.describeLabel}>
          <span>{r38.storyDescribeLabel}</span>
          <input
            ref={input}
            type="text"
            data-ask="picker-describe"
            value={described}
            onChange={(event) => setDescribed(event.target.value)}
            placeholder={r38.storyDescribePlaceholder}
            aria-describedby={noticeId}
            className={styles.describeInput}
            dir="auto"
          />
        </label>
        {conflict && (
          <p role="status" data-ask="picker-draft-kept" className={styles.small}>
            {r23.keptDraft}
          </p>
        )}
        {/*
          MASTER CTO R98 — with words typed and an ask handler, ONE explicit tap asks: the reader's exact
          words (no "Explain this story:" prefix, no story id: nothing is stored or cleared here). An
          unsent question already in the Ask box is never touched by this (the kept-draft line says so).
          Empty, the action stays the way back into Ask and spends nothing.
        */}
        {onAsk !== undefined && typed.length > 0 ? (
          <button
            type="button"
            data-ask="picker-continue"
            data-staged="ask"
            onClick={() => onAsk(typed)}
            className={styles.primary}
          >
            {r38.storyAskAbout}
          </button>
        ) : (
          <button
            type="button"
            data-ask="picker-continue"
            onClick={() => onStageDraft(conflict ? '' : draft)}
            data-staged={!conflict && typed.length > 0 ? 'typed' : 'none'}
            className={styles.primary}
          >
            {typed.length > 0 && !conflict ? r38.storyAskAbout : r23.askLabel}
          </button>
        )}
        {conflict && onReplaceDraft !== undefined && (
          <button
            type="button"
            data-ask="picker-replace-draft"
            onClick={() => onReplaceDraft(draft)}
            className={styles.secondary}
            style={{ flexDirection: 'column', gap: 2, padding: '6px 16px' }}
          >
            <span>{r38.storyReplaceDraft}</span>
            <span dir="auto" className={styles.continueText}>
              “{draft}”
            </span>
          </button>
        )}
        {/*
          MASTER CTO R104 — "Nothing is sent until you press Send" is true only where the action STAGES an
          unsent draft. On the one-tap ask path the tap sends, so that claim would be false: it is not shown.
        */}
        {!(onAsk !== undefined && typed.length > 0) && <p className={styles.small}>{r38.storyNothingSent}</p>}
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
        <ul data-ask="picker-results" className={styles.list}>
          {result.stories.map((story) => (
            <li key={story.articleRef}>
              <button type="button" data-ask="picker-row" onClick={() => onOpen(story)} className={styles.row}>
                <span className={styles.rowMain}>
                  <span dir="auto" className={styles.rowTitle}>
                    {story.title}
                  </span>
                  <span className={styles.rowMeta}>
                    {story.publisher} · {dateLine(story, locale)}
                  </span>
                </span>
                <span aria-hidden="true" className={styles.chevron}>
                  ›
                </span>
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

  const readable = brief?.kind === 'done' && brief.result.ok ? readableBrief(brief.result.value) : null;
  const sources = readable?.evidence.length
    ? readable.evidence
    : [{ id: story.articleRef, url: story.url, title: story.title, publisher: story.publisher, publishedAt: story.date }];
  return (
    <>
      <header className={styles.head}>
        <button type="button" data-ask="picker-back" onClick={onBack} className={styles.back}>
          ‹ {s.storyTitle}
        </button>
      </header>
      <div className={styles.body}>
        <h2 id={titleId} dir="auto" className={styles.storyTitle}>
          {story.title}
        </h2>
        <p className={styles.small}>
          {story.publisher} · {dateLine(story, locale)}
        </p>
        {story.storyId === null ? (
          <Notice kind="no-story-id">{s.noStoryId}</Notice>
        ) : brief === null || brief.kind === 'loading' ? null : (
          <BriefSection result={brief.result} readable={readable} locale={locale} />
        )}
        <h3 className={styles.small}>{s.sourcesH}</h3>
        <ul className={styles.list}>
          {sources.map((source, index) => {
            const link = safeExternalHref(source.url ?? undefined);
            return (
              <li key={source.id} className={styles.row} style={{ cursor: 'default' }}>
                <span className={styles.chevron}>{index + 1}</span>
                <span className={`${styles.rowMain} ${styles.rowMeta}`} style={{ marginTop: 0 }}>
                  {source.publisher}
                </span>
                {link !== undefined && (
                  <a href={link} target="_blank" rel="noopener noreferrer" data-ask="picker-read-original" className={styles.link}>
                    {s.readOriginal}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <footer className={styles.foot}>
        <button
          type="button"
          data-ask={readable === null ? 'picker-ask-about' : 'picker-follow-up'}
          onClick={() => onStageDraft(`${s.draftCtx}: ${story.title}`)}
          className={readable === null ? styles.primary : styles.secondary}
        >
          {readable === null ? s.askAbout : s.followUp}
        </button>
        <p className={styles.small} style={{ textAlign: 'center' }}>
          {s.askNote}
        </p>
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
  const gaps = [...readable.coverageGaps, ...readable.uncertainty];
  return (
    <section data-ask="picker-brief" data-brief-state={view.state} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 className={styles.sectionTitle}>
        {s.storedH} <span className={styles.sectionSub}>· {fillD01(s.checked, { d: checkedDay })}</span>
      </h3>
      {readable.summary !== null && (
        <p dir="auto" className={styles.prose}>
          {readable.summary}
        </p>
      )}
      {readable.keyFacts.length > 0 && (
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {readable.keyFacts.map((fact, index) => (
            <li key={index} dir="auto" className={styles.prose}>
              {fact.claim}
              {fact.sourceArticleIds.map((id) => {
                const n = readable.evidence.findIndex((source) => source.id === id);
                return n < 0 ? null : (
                  <sup key={id} className={styles.cite}>
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
          {gaps.length > 0 && (
            <ul data-ask="picker-gaps" className={styles.small} style={{ paddingInlineStart: 18 }}>
              {gaps.map((gap, index) => (
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
