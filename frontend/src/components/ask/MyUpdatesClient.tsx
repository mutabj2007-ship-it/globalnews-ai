'use client';

import { useCallback, useEffect, useId, useRef, useState, type JSX } from 'react';
import Link from 'next/link';
import type { DisplayLocale } from '@globalnews-ai/shared';
import {
  askV2Api,
  type AskV2BriefingDetail,
  type AskV2BriefingSummary,
  type AskV2Outcome,
} from '@/lib/api/askV2Api';
import { followStrings, type FollowStrings } from '@/lib/ask/followStrings';
import {
  ageText,
  followCheckHref,
  isFollowedQuestion,
  recheckWaitMinutes,
  summarizeFollows,
} from '@/lib/ask/followedQuestions';
import { askPrimaryNavStrings } from '@/lib/ask/askPrimaryNavStrings';
import { LATEST_CHECK, checkComparisonHref, recordStatus, selectCheck } from '@/lib/ask/followComparison';
import { AskCheckComparison } from './AskCheckComparison';
import { followComparisonStrings } from '@/lib/ask/followComparisonStrings';
import { askFormatLocalDay, askFormatLocalDayCompact, askFormatLocalTime } from '@/lib/ask/askDirection';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { briefingHref } from './BriefingViews';
import {
  followOutcomePresentation,
  type FollowOutcomeTone,
} from '@/lib/ask/followOutcomePresentation';
import { AskUpdatesChecking } from './AskUpdatesChecking';
import { AskFollowAssessment } from '@/components/ask-frame/AskFollowAssessment';
import { d01Strings } from '@/lib/ask/d01Strings';
import { askR38Strings } from '@/lib/ask/askR38Strings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REASON TO RETURN R1 · §8 — MY UPDATES: THE READER'S FOLLOWED QUESTIONS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Grouped by followed question, nothing else: no regional headline feed, no unsolicited items,
 * no badge counts. Each row shows the last saved answer with its AGE (an old baseline is never
 * presented as fresh), the latest check's server outcome, and the last check that completed.
 * Reading this page is a database read (0 AI · 0 provider). "Check for changes" opens Ask with
 * the question as a draft — the reader sends it; nothing runs from this page. Pause / Resume /
 * Edit / Stop following are the reader's own controls; edits are owner-scoped server-side.
 */
export function MyUpdatesClient({ locale }: { readonly locale: DisplayLocale }): JSX.Element {
  const s = followStrings(locale);
  const [list, setList] = useState<AskV2Outcome<readonly AskV2BriefingSummary[]> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    void askV2Api.briefings().then(setList);
  }, []);
  useEffect(load, [load]);

  if (list === null) return <main className="min-h-screen bg-void px-4 py-8 md:px-8" />;

  const rows = list.ok ? list.value.filter(isFollowedQuestion) : [];
  /* ASK R3 NAVIGATION / USABILITY R1 — the page summary "{N} followed" (D08), from this same read;
     "with changes you haven't reviewed" stays off until a reviewed state exists (B2). */
  const summary = list.ok ? summarizeFollows(list.value) : null;
  const n = askPrimaryNavStrings(locale);
  return (
    <main data-ask="my-updates" className="min-h-screen bg-void px-4 py-8 md:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
      {/* R3.2 MOBILE COMPACT — one heading, the summary, the manual-check sentence and the cost said
          ONCE for the page (it was repeated under every row). The checking options stay collapsed. */}
      <header className="flex flex-col gap-0.5">
        <h1 className="font-display text-[24px] font-semibold text-ink-primary">{s.myUpdates}</h1>
        <p className="text-[13px] leading-snug text-ink-tertiary">{s.myUpdatesIntro}</p>
        {/* MASTER CTO R38 · U-5 — nothing is monitored: a follow is re-asked only when the reader
            chooses, at the cost of one question, and compared with the last saved answer. */}
        <p data-ask="my-updates-check-cost" className="text-[13px] leading-snug text-ink-tertiary">{askR38Strings(locale).updatesManualNote}</p>
        {summary !== null && (
          <p data-ask="my-updates-summary" className="text-[13.5px] font-medium text-ink-secondary">
            {[n.followedCount(summary.followed), summary.withChanges > 0 ? n.withChangesAtLastCheck(summary.withChanges) : null]
              .filter((part): part is string => part !== null)
              .join(' · ')}
          </p>
        )}
      </header>
      {/* ASK D0.1 · D2 — the separate Choose a place drill-in (D06); the followed questions below are unchanged */}
      <Link href="/saved/updates/place" prefetch={false} data-ask="my-updates-choose-place" className="inline-flex min-h-[44px] w-fit items-center text-[13.5px] font-medium text-signal underline decoration-signal/50 underline-offset-4">
        {d01Strings(locale).choosePlace} ›
      </Link>
      {notice !== null && <p role="status" className="text-[13.5px] text-ink-secondary">{notice}</p>}
      {/* R3 FULL DESIGN · D14 — manual checking only; later options labelled, never active */}
      {list.ok && <AskUpdatesChecking locale={locale} />}
      {!list.ok ? (
        <p role="status" data-ask="my-updates-state" className="text-[13.5px] text-ink-secondary">
          {list.reason === 'SIGNED_OUT' ? s.signedOut : list.reason === 'NETWORK' ? s.network : s.unavailable}
        </p>
      ) : rows.length === 0 ? (
        <p data-ask="my-updates-state" className="text-[13.5px] text-ink-secondary">{s.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <FollowedRow
              key={row.id}
              row={row}
              locale={locale}
              s={s}
              onChanged={(message) => {
                setNotice(message);
                load();
              }}
            />
          ))}
        </ul>
      )}
      </div>
    </main>
  );
}

/**
 * CLAUDE DESIGN R3 · D08 — the four tones, painted with the tokens this page already uses.
 *
 * Total over `FollowOutcomeTone`, like the map it consumes: a fifth tone fails to compile rather
 * than falling back to a neutral chip that would quietly flatten a distinction.
 *
 * NO NEW COLOUR IS INTRODUCED. The semantic palette here is `signal`, `ice` and the `ink` ladder;
 * `tailwind.config.ts` records that the GN-CD-300 §W.4 amber "does not exist and must not appear"
 * and that red is never decorative, so an incomplete check is NOT painted as a warning. The four
 * tones separate by WEIGHT and by border style instead:
 *
 *   REPORTED    the one accent border — there is something new to read.
 *   SETTLED     quiet: default border, secondary ink. A completed check that found nothing.
 *   BASELINE    default border, primary ink. Informational, and deliberately not quiet: an
 *               absent baseline is not a "no change" result.
 *   INCOMPLETE  a DASHED border, as the reference-background card uses for "not solid ground".
 *               It must not read as SETTLED: an incomplete check never means nothing changed.
 */
const FOLLOW_TONE_CLASS: Readonly<Record<FollowOutcomeTone, string>> = Object.freeze({
  REPORTED: 'border-signal/60 text-ink-primary',
  SETTLED: 'border-line text-ink-secondary',
  BASELINE: 'border-line text-ink-primary',
  INCOMPLETE: 'border-dashed border-line text-ink-primary',
});

function FollowedRow({
  row,
  locale,
  s,
  onChanged,
}: {
  readonly row: AskV2BriefingSummary;
  readonly locale: DisplayLocale;
  readonly s: FollowStrings;
  readonly onChanged: (message: string | null) => void;
}): JSX.Element {
  const [detail, setDetail] = useState<AskV2BriefingDetail | null>(null);
  const [editing, setEditing] = useState(false);
  /* R3.2 MOBILE COMPACT — the secondary controls live behind ONE More control per row */
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement | null>(null);
  const moreId = useId();
  const [title, setTitle] = useState(row.title);
  const [question, setQuestion] = useState(row.scope.question ?? '');
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const when = (iso: string) =>
    `${askFormatLocalDay(new Date(iso), locale)} ${askFormatLocalTime(new Date(iso), locale)}`;
  const age = ageText(row.latestAsOf, now, s);
  const latestCheck = row.latestCheck ?? null;
  const wait = recheckWaitMinutes(latestCheck?.checkedAt, now);
  const paused = row.status === 'PAUSED';
  const presentation = latestCheck === null ? null : followOutcomePresentation(latestCheck.outcome);
  /* A material change, an incomplete check or a partial check is never folded away (CTO R3.2):
     its detail sentence stays on the collapsed row; any other outcome explains itself on demand. */
  const critical =
    latestCheck !== null &&
    (presentation?.attention === true || latestCheck.outcome === 'INCOMPLETE_CHECK' || latestCheck.partial === true);
  const more = askShellStrings(locale).askR2Strings.read.more;

  async function run(action: () => Promise<{ readonly ok: boolean }>, message: string | null) {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await action();
      onChanged(outcome.ok ? message : s.network);
    } finally {
      setBusy(false);
    }
  }
  const closeMore = (): void => {
    setMoreOpen(false);
    moreRef.current?.focus();
  };

  return (
    <li
      data-ask="followed-question"
      data-ask-followed-status={row.status}
      className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface px-3 py-2.5"
    >
      {/*
        R3.2 MOBILE COMPACT (PO physical-iPhone review) — the collapsed row: the title (two lines at
        most; the full text stays the element's text and its tooltip), ONE status line, the outcome
        chip and Check for changes, and ONE More control. Explanations, history and the remaining
        controls open on demand. SUPERSEDED: the always-expanded card with every line and every
        control shown, and the per-row cost note (now said once, at the top of the page).
      */}
      <h2
        dir="auto"
        title={row.title}
        className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink-primary"
      >
        {row.title}
      </h2>
      <p data-ask="followed-status-line" className="text-[12.5px] leading-snug text-ink-tertiary">
        {paused && (
          <span data-ask="followed-paused" className="font-semibold uppercase tracking-[0.06em]">
            {s.paused}
            {' · '}
          </span>
        )}
        {row.latestAsOf === null || age === null
          ? s.noBaseline
          : s.baseline(askFormatLocalDayCompact(new Date(row.latestAsOf), locale, now), age)}
        {latestCheck === null ? ` · ${s.neverChecked}` : ''}
      </p>
      {latestCheck !== null && critical && (
        <p data-ask="followed-latest-outcome" className="text-[13px] leading-snug text-ink-secondary">
          {s.outcomeDetail[latestCheck.outcome]}
        </p>
      )}
      {/* CTO R1-B §3 — the structured evidence this check could not assess, never hidden */}
      {latestCheck !== null && (latestCheck.structuredUnassessed ?? []).length > 0 && (
        <p data-ask="followed-structured-unassessed" className="text-[12.5px] text-ink-tertiary">
          {s.structuredUnassessed((latestCheck.structuredUnassessed ?? []).join(', '))}
        </p>
      )}
      {latestCheck !== null &&
        latestCheck.outcome === 'INCOMPLETE_CHECK' &&
        row.lastSuccessfulCheckAt != null && (
          <p className="text-[12.5px] text-ink-tertiary">{s.lastSuccessful(when(row.lastSuccessfulCheckAt))}</p>
        )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {latestCheck !== null && presentation !== null && (
          /*
            CLAUDE DESIGN R3 · D08 — ONE compact status for this row, and it is the details toggle:
            the outcome is named once. Opening it shows the detail sentence (for a non-critical
            outcome), the time of the check, the Before / Latest link and the recorded checks.
          */
          <button
            type="button"
            data-ask="followed-details"
            data-ask-follow-outcome={latestCheck.outcome}
            data-ask-follow-tone={followOutcomePresentation(latestCheck.outcome).tone}
            data-ask-follow-attention={presentation.attention ? 'true' : 'false'}
            /* R1-B §3 — a partial check keeps its finding outcome and says so; never presented as a
               complete one. Its wording and source list are `s.partial(…)` in the assessment this
               control opens, and `s.structuredUnassessed` above, both unchanged. */
            data-ask-follow-partial={latestCheck.partial ? 'true' : 'false'}
            aria-expanded={detail !== null}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3 text-[13px] font-semibold hover:border-signal/60 ${
              FOLLOW_TONE_CLASS[presentation.tone]
            }`}
            onClick={() => {
              if (detail !== null) return setDetail(null);
              void askV2Api.briefing(row.id).then((read) => {
                if (read.ok) setDetail(read.value);
              });
            }}
          >
            {s.outcome[latestCheck.outcome]}
          </button>
        )}
        {!paused &&
          (wait > 0 ? (
            <span data-ask="followed-check-wait" className="text-[13px] text-ink-tertiary">{s.checkTooSoon(wait)}</span>
          ) : (
            <Link
              href={followCheckHref(row.id)}
              prefetch={false}
              data-ask="followed-check"
              className="inline-flex min-h-[44px] items-center text-[13px] font-semibold text-signal underline decoration-signal/50 underline-offset-4"
            >
              {askR38Strings(locale).updatesAskAgain}
            </Link>
          ))}
        <button
          ref={moreRef}
          type="button"
          data-ask="followed-more"
          aria-expanded={moreOpen}
          aria-controls={moreId}
          aria-label={`${more}: ${row.title}`}
          title={more}
          onClick={() => setMoreOpen((open) => !open)}
          className="ms-auto inline-flex h-11 w-11 items-center justify-center rounded-full text-[18px] font-medium leading-none text-ink-secondary hover:bg-surface-hover hover:text-ink-primary"
        >
          <span aria-hidden="true">⋯</span>
        </button>
      </div>

      {moreOpen && (
        <div
          id={moreId}
          role="group"
          aria-label={`${more}: ${row.title}`}
          data-ask="followed-more-panel"
          className="flex flex-wrap items-center gap-x-4 border-t border-line pt-1"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              closeMore();
            }
          }}
        >
          <button
            type="button"
            disabled={busy}
            data-ask="followed-pause"
            className="inline-flex min-h-[44px] items-center text-[13px] text-ink-secondary hover:text-ink-primary disabled:opacity-50"
            onClick={() =>
              void run(() => askV2Api.updateBriefing(row.id, { status: paused ? 'ACTIVE' : 'PAUSED' }), null)
            }
          >
            {paused ? s.resume : s.pause}
          </button>
          <button
            type="button"
            disabled={busy}
            data-ask="followed-edit"
            className="inline-flex min-h-[44px] items-center text-[13px] text-ink-secondary hover:text-ink-primary disabled:opacity-50"
            onClick={() => setEditing((v) => !v)}
          >
            {s.edit}
          </button>
          {row.latestVersion !== null && (
            <Link
              href={briefingHref(row.id, row.latestVersion, 'updates')}
              prefetch={false}
              data-ask="followed-history"
              className="inline-flex min-h-[44px] items-center text-[13px] text-ink-secondary hover:text-ink-primary"
            >
              {s.history}
            </Link>
          )}
          <button
            type="button"
            disabled={busy}
            data-ask="followed-remove"
            className="inline-flex min-h-[44px] items-center text-[13px] text-ink-secondary hover:text-ink-primary disabled:opacity-50"
            onClick={() => {
              if (!window.confirm(s.removeConfirm)) return;
              void run(() => askV2Api.deleteBriefing(row.id), s.removed);
            }}
          >
            {s.remove}
          </button>
        </div>
      )}

      {editing && (
        <form
          data-ask="followed-edit-form"
          className="mt-1 flex flex-col gap-2 text-[13px] text-ink-secondary"
          onSubmit={(event) => {
            event.preventDefault();
            const change: { title?: string; question?: string } = {};
            if (title.trim() !== row.title) change.title = title;
            if (question.trim() !== (row.scope.question ?? '').trim()) change.question = question;
            setEditing(false);
            if (Object.keys(change).length > 0) void run(() => askV2Api.updateBriefing(row.id, change), null);
          }}
        >
          <label className="flex flex-col gap-1">
            <span>{s.titleLabel}</span>
            <input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] text-ink-primary" />
          </label>
          <label className="flex flex-col gap-1">
            <span>{s.questionLabel}</span>
            <textarea value={question} rows={3} onChange={(e) => setQuestion(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] text-ink-primary" />
          </label>
          <p className="text-[0.8125rem] text-ink-tertiary">{s.editNote}</p>
          <div className="flex gap-3">
            <button type="submit" className="inline-flex min-h-[44px] items-center text-[13px] font-medium text-signal underline decoration-signal/50 underline-offset-4">{s.save}</button>
            <button type="button" className="inline-flex min-h-[44px] items-center text-[13px] text-ink-secondary hover:text-ink-primary disabled:opacity-50" onClick={() => setEditing(false)}>
              {s.cancel}
            </button>
          </div>
        </form>
      )}

      {detail !== null && latestCheck !== null && (
        <div data-ask="followed-detail-panel" className="flex flex-col gap-1 border-t border-line pt-2 text-[13px] text-ink-secondary">
          {row.scope.question !== row.title && (
            <p dir="auto" className="text-[13.5px] leading-snug text-ink-secondary">{row.scope.question}</p>
          )}
          {!critical && (
            <p data-ask="followed-latest-outcome" className="text-[13px] leading-snug text-ink-secondary">
              {s.outcomeDetail[latestCheck.outcome]}
            </p>
          )}
          <p className="text-[12.5px] text-ink-tertiary">{s.lastChecked(when(latestCheck.checkedAt))}</p>
          {/* ASK R3 · D09 — the change detail of this check: its own Before / Latest, or the truthful
              status when the check recorded no pair. A link only; nothing runs. */}
          {/* MASTER CTO R32 · D09 — where the latest check recorded a real Before / Latest pair, it is
              shown HERE, in My updates (two stored-version reads, 0 AI); the link stays for the
              full-page view and for every check that recorded no pair (its truthful status). */}
          {(() => {
            const full = selectCheck(detail, LATEST_CHECK);
            return full !== null && recordStatus(full) === null ? (
              <div data-ask="followed-compare-inline" className="mt-1">
                <AskCheckComparison briefingId={row.id} check={full} locale={locale} />
              </div>
            ) : null;
          })()}
          <Link
            href={checkComparisonHref(row.id, LATEST_CHECK)}
            prefetch={false}
            data-ask="followed-compare"
            className="inline-flex min-h-[44px] w-fit items-center text-[13px] font-medium text-signal underline decoration-signal/50 underline-offset-4"
          >
            {followComparisonStrings(locale).compareLink}
          </Link>
        </div>
      )}

      {detail !== null && (detail.checks ?? []).length > 0 && (
        <div data-ask="followed-checks" className="mt-1 flex flex-col gap-4 border-t border-line pt-3 text-[13.5px] text-ink-secondary">
          {(detail.checks ?? []).slice(0, 5).map((check) => (
            <div key={check.id} className="flex flex-col gap-1">
              <p className="text-[0.8125rem] text-ink-tertiary">{when(check.checkedAt)}</p>
              <AskFollowAssessment check={check} locale={locale} />
              <Link
                href={checkComparisonHref(row.id, check.id)}
                prefetch={false}
                data-ask="followed-check-compare"
                className="inline-flex min-h-[44px] w-fit items-center text-[13px] font-medium text-signal underline decoration-signal/50 underline-offset-4"
              >
                {followComparisonStrings(locale).compareLink}
              </Link>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
