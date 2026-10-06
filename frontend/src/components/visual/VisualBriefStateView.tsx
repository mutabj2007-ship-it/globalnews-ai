'use client';

import type { JSX } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { fill } from '@/components/home/reva/homeRevaModel';
import type { BriefEvidenceRef, StoredBriefContent, StoryBriefView } from '@/lib/storyBrief/storyBriefView';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMPACT VISUAL PRODUCT R1 — THE SEVEN STORY BRIEF STATES, FROM THE SERVER'S VIEW ONLY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Pure presentation of a parsed server StoryBriefView (EA-STORY-BRIEF-01). It authors nothing:
 *
 *   NONE          "no brief yet"; a Prepare control ONLY when the server says generation is
 *                 available AND the reader may generate (signed in) — guests read only (Beta policy)
 *   CHECKING      the generic checking line — the server has no progress channel, so no stage,
 *                 timer or percentage exists here; the previous version stays inspectable
 *   READY         the stored version: "saved … reopened, no new check" (reopen is a zero-compute GET)
 *   STALE         "the evidence has changed since this brief" — never "something material happened"
 *                 and never a count (the server supplies none); Refresh only for an allowed reader
 *   PARTIAL       the stored version plus the server's named coverage gaps
 *   INSUFFICIENT  the check ran and did not support a brief
 *   FAILED        a failure KIND from the server; nothing stored; never worded as INSUFFICIENT
 *
 * Every control it renders is passed in as a callback that the panel only supplies when the
 * capability truly exists; `null` renders nothing — no disabled teaser.
 */
export interface VisualBriefActions {
  /** NONE: explicit generation (signed-in, generation available). */
  readonly prepare: (() => void) | null;
  /** STALE: explicit refresh (signed-in, generation available). */
  readonly refresh: (() => void) | null;
  /** FAILED: explicit retry (signed-in, generation available, a retryable kind). */
  readonly retry: (() => void) | null;
  /** CHECKING: a zero-compute re-read. */
  readonly recheck: (() => void) | null;
  /** Shown instead of a generation control to a guest, only when generation is available. */
  readonly signInHref: string | null;
  readonly busy: boolean;
  readonly onPreviewEvidence: (ref: BriefEvidenceRef) => void;
}

export function VisualBriefStateView({
  view,
  language,
  actions,
}: {
  readonly view: StoryBriefView;
  readonly language: LanguageCode;
  readonly actions: VisualBriefActions;
}): JSX.Element {
  const t = getDictionary(language).visual.brief;

  switch (view.state) {
    case 'NONE':
      return (
        <div data-visual-brief-state="NONE" className="rounded-[0.625rem] border border-[var(--gt-line)] bg-[var(--gt-sunk)] p-4">
          <p className="text-[0.9375rem] font-semibold text-[var(--gt-ink)]">{t.unavailableTitle}</p>
          <p className="mt-1 text-[0.875rem] text-[var(--gt-ink2)]">{view.generationAvailable ? t.noneBody : t.noneUnavailableBody}</p>
          <Generate label={t.prepare} run={actions.prepare} signInHref={actions.signInHref} signInLabel={t.signInToPrepare} busy={actions.busy} />
        </div>
      );
    case 'CHECKING':
      return (
        <div data-visual-brief-state="CHECKING" className="flex flex-col gap-4">
          <div role="status" className="rounded-[0.625rem] border border-[var(--gt-line)] bg-[var(--gt-sunk)] p-4">
            <p className="text-[0.9375rem] font-semibold text-[var(--gt-ink)]">{t.checking}</p>
            {view.inspectable !== null && <p className="mt-1 text-[0.875rem] text-[var(--gt-ink2)]">{t.checkingInspectable}</p>}
            {actions.recheck !== null && <ActionButton label={t.checkStatus} onClick={actions.recheck} busy={actions.busy} />}
          </div>
          {view.inspectable !== null && <StoredContent brief={view.inspectable} language={language} onPreviewEvidence={actions.onPreviewEvidence} />}
        </div>
      );
    case 'FAILED':
      return (
        <div data-visual-brief-state="FAILED" data-visual-brief-failure={view.failureKind} role="alert" className="rounded-[0.625rem] border border-[var(--gt-danger)] p-4">
          <p className="text-[0.9375rem] font-semibold text-[var(--gt-danger)]">{t.failedTitle}</p>
          <p className="mt-1 text-[0.875rem] text-[var(--gt-ink)]">{t.failedKinds[view.failureKind]}</p>
          <p className="mt-1 text-[0.875rem] text-[var(--gt-ink2)]">{t.failedNote}</p>
          {actions.retry !== null && <ActionButton label={t.retry} onClick={actions.retry} busy={actions.busy} />}
        </div>
      );
    case 'STALE':
      return (
        <div data-visual-brief-state="STALE" className="flex flex-col gap-4">
          <div data-visual-brief-stale="" className="rounded-[0.625rem] border border-[var(--gt-amberBd)] bg-[var(--gt-amberBg)] p-3 text-[var(--gt-amberInk)]">
            <p className="text-[0.875rem] font-semibold">{t.staleTitle}</p>
            <p className="text-[0.8125rem]">{fill(t.staleNote, { version: view.brief.version })}</p>
            {view.lastAttemptFailure !== null && <p className="mt-1 text-[0.8125rem]">{t.staleRefreshFailed}</p>}
            {actions.refresh !== null && (
              <>
                <ActionButton label={t.refresh} onClick={actions.refresh} busy={actions.busy} />
                <p className="mt-1 text-[0.8125rem]">{t.refreshNote}</p>
              </>
            )}
            {actions.refresh === null && actions.signInHref !== null && view.generationAvailable && (
              <a href={actions.signInHref} className="mt-2 inline-flex min-h-[44px] items-center text-[0.875rem] font-semibold underline underline-offset-4">
                {t.signInToPrepare}
              </a>
            )}
          </div>
          <StoredContent brief={view.brief} language={language} onPreviewEvidence={actions.onPreviewEvidence} />
        </div>
      );
    case 'INSUFFICIENT':
      return (
        <div data-visual-brief-state="INSUFFICIENT" className="flex flex-col gap-3">
          <VersionLine brief={view.brief} language={language} />
          <div className="rounded-[0.625rem] border border-[var(--gt-line)] bg-[var(--gt-sunk)] p-4">
            <p className="text-[0.9375rem] font-semibold text-[var(--gt-ink)]">{t.insufficientTitle}</p>
            <p className="mt-1 text-[0.875rem] text-[var(--gt-ink2)]">{t.insufficientNote}</p>
          </div>
          <GapsAndUncertainty brief={view.brief} language={language} />
        </div>
      );
    case 'PARTIAL':
    case 'READY':
      return (
        <div data-visual-brief-state={view.state} className="flex flex-col gap-4">
          {view.state === 'PARTIAL' && (
            <p className="w-fit rounded-[0.375rem] bg-[var(--gt-amberBg)] px-2 py-0.5 text-[0.8125rem] font-semibold text-[var(--gt-amberInk)]">{t.partialTitle}</p>
          )}
          <StoredContent brief={view.brief} language={language} onPreviewEvidence={actions.onPreviewEvidence} />
        </div>
      );
  }
}

function Generate({
  label,
  run,
  signInHref,
  signInLabel,
  busy,
}: {
  readonly label: string;
  readonly run: (() => void) | null;
  readonly signInHref: string | null;
  readonly signInLabel: string;
  readonly busy: boolean;
}): JSX.Element | null {
  if (run !== null) return <ActionButton label={label} onClick={run} busy={busy} primary />;
  if (signInHref !== null)
    return (
      <a href={signInHref} data-visual-brief-sign-in="" className="mt-3 inline-flex min-h-[44px] items-center text-[0.875rem] font-semibold text-[var(--gt-link)] underline underline-offset-4">
        {signInLabel}
      </a>
    );
  return null;
}

function ActionButton({ label, onClick, busy, primary = false }: { readonly label: string; readonly onClick: () => void; readonly busy: boolean; readonly primary?: boolean }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      data-visual-brief-action=""
      className={`mt-3 inline-flex min-h-[44px] items-center rounded-[0.5rem] px-3 text-[0.875rem] font-semibold disabled:opacity-60 ${
        primary ? 'bg-[var(--gt-act)] text-white hover:brightness-110' : 'border border-[var(--gt-line)] text-[var(--gt-ink)] hover:border-[var(--gt-act)]'
      }`}
    >
      {label}
    </button>
  );
}

function VersionLine({ brief, language }: { readonly brief: StoredBriefContent; readonly language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).visual.brief;
  return (
    <p className="text-[0.8125rem] text-[var(--gt-ink2)]">
      <span className="font-mono font-semibold uppercase tracking-[0.08em] text-[var(--gt-link)]">{fill(t.versionLine, { version: brief.version })}</span>
      <br />
      <span data-visual-brief-saved="">{fill(t.savedLine, { time: formatRelativeTime(brief.asOf, language) })}</span>
    </p>
  );
}

function GapsAndUncertainty({ brief, language }: { readonly brief: StoredBriefContent; readonly language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).visual.brief;
  return (
    <>
      {brief.uncertainty.length > 0 && (
        <section className="rounded-[0.625rem] border border-[var(--gt-amberBd)] bg-[var(--gt-amberBg)] p-3 text-[var(--gt-amberInk)]">
          <h4 className="text-[0.9375rem] font-bold">{t.uncertain}</h4>
          <ul className="mt-1 list-disc ps-5 text-[0.875rem]">
            {brief.uncertainty.map((line) => (
              <li key={line} dir="auto">
                {line}
              </li>
            ))}
          </ul>
        </section>
      )}
      {brief.coverageGaps.length > 0 && (
        <section data-visual-brief-gaps="">
          <h4 className="text-[0.9375rem] font-bold text-[var(--gt-ink)]">{t.coverageGaps}</h4>
          <ul className="mt-1 list-disc ps-5 text-[0.875rem] text-[var(--gt-ink2)]">
            {brief.coverageGaps.map((gap) => (
              <li key={gap} dir="auto">
                {gap}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function StoredContent({
  brief,
  language,
  onPreviewEvidence,
}: {
  readonly brief: StoredBriefContent;
  readonly language: LanguageCode;
  readonly onPreviewEvidence: (ref: BriefEvidenceRef) => void;
}): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.visual.brief;
  return (
    <div className="flex flex-col gap-4">
      <VersionLine brief={brief} language={language} />
      {brief.summary !== null && (
        <section>
          <h4 className="text-[0.9375rem] font-bold text-[var(--gt-ink)]">{t.summary}</h4>
          {/* ASK RELIABILITY R1 (§9) — the visible brief is short (about 100 words, hard cap 120);
              any longer text is one explicit "Show more" away, collapsed by default. */}
          <p dir="auto" className="mt-1 text-[0.9375rem] leading-[1.55] text-[var(--gt-ink)]">
            {visibleBrief(brief.summary).head}
          </p>
          {visibleBrief(brief.summary).rest !== null && (
            <details data-visual-brief-more="" className="mt-1 text-[0.9375rem] leading-[1.55] text-[var(--gt-ink)]">
              <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[0.875rem] font-semibold text-[var(--gt-link)]">{t.showMore}</summary>
              <p dir="auto">{visibleBrief(brief.summary).rest}</p>
            </details>
          )}
        </section>
      )}
      {brief.keyFacts.length > 0 && (
        <section>
          <h4 className="text-[0.9375rem] font-bold text-[var(--gt-ink)]">{t.keyFacts}</h4>
          <ul className="mt-1 flex list-disc flex-col gap-1 ps-5 text-[0.9375rem] leading-[1.5]">
            {brief.keyFacts.map((fact) => (
              <li key={fact.claim} dir="auto">
                {fact.claim}
                {fact.sourceArticleIds.length > 0 && (
                  <span className="text-[0.8125rem] text-[var(--gt-ink2)]">
                    {' — '}
                    {fill(t.sourcedBy, { count: pluralWithForms(fact.sourceArticleIds.length, language, dict.homeR1.compare.sourceForms) })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <GapsAndUncertainty brief={brief} language={language} />
      {brief.background !== null && (
        <section className="rounded-[0.625rem] border border-dashed border-[var(--gt-line)] p-3">
          <h4 className="text-[0.875rem] font-bold text-[var(--gt-ink2)]">{t.background}</h4>
          <p dir="auto" className="mt-1 text-[0.875rem] text-[var(--gt-ink2)]">
            {brief.background}
          </p>
          <p className="mt-1 text-[0.75rem] text-[var(--gt-ink3)]">{t.backgroundNote}</p>
        </section>
      )}
      {brief.evidence.length > 0 && (
        <section>
          <h4 className="text-[0.9375rem] font-bold text-[var(--gt-ink)]">{t.briefEvidence}</h4>
          <ul data-visual-brief-evidence="" className="mt-2 flex flex-col gap-2">
            {brief.evidence.map((ref) => (
              <li key={ref.id}>
                <button
                  type="button"
                  onClick={() => onPreviewEvidence(ref)}
                  className="flex min-h-[44px] w-full flex-col items-start gap-0.5 rounded-[0.625rem] border border-[var(--gt-line)] p-3 text-start hover:border-[var(--gt-act)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
                >
                  <span className="text-[0.875rem] font-semibold">
                    <bdi>{ref.publisher}</bdi>
                  </span>
                  <span dir="auto" className="line-clamp-2 text-[0.875rem] text-[var(--gt-ink2)]">
                    {ref.title}
                  </span>
                  <span className="text-[0.8125rem] font-semibold text-[var(--gt-link)]">{t.previewEvidence}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** ASK RELIABILITY R1 (§9) — the first ~100 words (ending on a sentence when one ends after 60), the rest folded. */
export function visibleBrief(text: string): { head: string; rest: string | null } {
  const words = text.trim().split(/\s+/);
  if (words.length <= 120) return { head: text.trim(), rest: null };
  let cut = 100;
  for (let i = 100; i >= 60; i--) {
    if (/[.!?]$/.test(words[i - 1])) {
      cut = i;
      break;
    }
  }
  return { head: words.slice(0, cut).join(' '), rest: words.slice(cut).join(' ') };
}
