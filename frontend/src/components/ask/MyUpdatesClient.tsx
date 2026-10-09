'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
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
} from '@/lib/ask/followedQuestions';
import { askFormatLocalDay, askFormatLocalTime } from '@/lib/ask/askDirection';
import { briefingHref } from './BriefingViews';
import {
  followOutcomePresentation,
  type FollowOutcomeTone,
} from '@/lib/ask/followOutcomePresentation';
import { AskUpdatesChecking } from './AskUpdatesChecking';
import { AskFollowAssessment } from '@/components/ask-frame/AskFollowAssessment';

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
  return (
    <main data-ask="my-updates" className="min-h-screen bg-void px-4 py-8 md:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-semibold text-ink-primary">{s.myUpdates}</h1>
        <p className="text-[13.5px] text-ink-tertiary">{s.myUpdatesIntro}</p>
      </header>
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
        <ul className="flex flex-col gap-3">
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

  return (
    <li
      data-ask="followed-question"
      data-ask-followed-status={row.status}
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4"
    >
      <h2 className="text-[15px] font-semibold leading-snug text-ink-primary">{row.title}</h2>
      {row.scope.question !== row.title && (
        <p className="text-[14px] leading-snug text-ink-secondary">{row.scope.question}</p>
      )}
      {paused && (
        <p data-ask="followed-paused" className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
          {s.paused}
        </p>
      )}
      <p className="text-[0.875rem] text-ink-tertiary">
        {row.latestAsOf === null || age === null
          ? s.noBaseline
          : s.baseline(askFormatLocalDay(new Date(row.latestAsOf), locale), age)}
      </p>
      {latestCheck === null ? (
        <p className="text-[0.875rem] text-ink-tertiary">{s.neverChecked}</p>
      ) : (
        /*
          CLAUDE DESIGN R3 · D08 — ONE compact status for this row, and ONE detail sentence under
          it. This replaced a bold run of `s.outcome[...]` inside the "last checked" line, which
          gave every outcome the same weight and left `s.outcomeDetail` — authored, qualified in
          EN and PL, and the only place the seven outcomes explain themselves — rendered nowhere.

          The chip IS the details toggle, so the outcome is named once on the row instead of
          twice (it was also the label of a separate button below). `data-ask="followed-details"`
          moved here with it, so anything selecting that control still finds it.

          The tone comes from the total map in `followOutcomePresentation`; the WORDS come only
          from `followStrings`. All seven outcomes keep their own label and their own detail.
        */
        <>
          <p className="text-[0.875rem] text-ink-tertiary">{s.lastChecked(when(latestCheck.checkedAt))}</p>
          <button
            type="button"
            data-ask="followed-details"
            data-ask-follow-outcome={latestCheck.outcome}
            data-ask-follow-tone={followOutcomePresentation(latestCheck.outcome).tone}
            data-ask-follow-attention={
              followOutcomePresentation(latestCheck.outcome).attention ? 'true' : 'false'
            }
            /* R1-B §3 — a partial check keeps its finding outcome and says so; it is never
               presented as a complete one. The qualifier's own wording and its source list are
               `s.partial(…)` in the assessment this control opens, and `s.structuredUnassessed`
               below, both unchanged. */
            data-ask-follow-partial={latestCheck.partial ? 'true' : 'false'}
            aria-expanded={detail !== null}
            className={`inline-flex min-h-[44px] w-fit items-center gap-2 self-start rounded-full border px-3 text-[13px] font-semibold hover:border-signal/60 ${
              FOLLOW_TONE_CLASS[followOutcomePresentation(latestCheck.outcome).tone]
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
          <p data-ask="followed-latest-outcome" className="text-[13.5px] leading-snug text-ink-secondary">
            {s.outcomeDetail[latestCheck.outcome]}
          </p>
        </>
      )}
      {/* CTO R1-B §3 — the structured evidence this check could not assess, never hidden */}
      {latestCheck !== null && (latestCheck.structuredUnassessed ?? []).length > 0 && (
        <p data-ask="followed-structured-unassessed" className="text-[0.875rem] text-ink-tertiary">
          {s.structuredUnassessed((latestCheck.structuredUnassessed ?? []).join(', '))}
        </p>
      )}
      {latestCheck !== null &&
        latestCheck.outcome === 'INCOMPLETE_CHECK' &&
        row.lastSuccessfulCheckAt != null && (
          <p className="text-[0.875rem] text-ink-tertiary">{s.lastSuccessful(when(row.lastSuccessfulCheckAt))}</p>
        )}

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        {!paused &&
          (wait > 0 ? (
            <span data-ask="followed-check-wait" className="text-[13px] text-ink-tertiary">{s.checkTooSoon(wait)}</span>
          ) : (
            <Link href={followCheckHref(row.id)} prefetch={false} data-ask="followed-check" className="text-[13px] font-medium text-signal underline decoration-signal/50 underline-offset-4">
              {s.checkForChanges}
            </Link>
          ))}
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
        <button type="button" disabled={busy} data-ask="followed-edit" className="inline-flex min-h-[44px] items-center text-[13px] text-ink-secondary hover:text-ink-primary disabled:opacity-50" onClick={() => setEditing((v) => !v)}>
          {s.edit}
        </button>
        {/* D08 — the details control is the compact status chip above: the outcome is named
            once per row, not twice. Same handler, same `aria-expanded`, same data attribute. */}
        {row.latestVersion !== null && (
          <Link href={briefingHref(row.id, row.latestVersion)} prefetch={false} data-ask="followed-history" className="inline-flex min-h-[44px] items-center text-[13px] text-ink-secondary hover:text-ink-primary disabled:opacity-50">
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
      {!paused && wait === 0 && <p className="text-[0.8125rem] text-ink-tertiary">{s.checkCost}</p>}

      {editing && (
        <form
          data-ask="followed-edit-form"
          className="mt-2 flex flex-col gap-2 text-[13px] text-ink-secondary"
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
            <button type="submit" className="text-[13px] font-medium text-signal underline decoration-signal/50 underline-offset-4">{s.save}</button>
            <button type="button" className="inline-flex min-h-[44px] items-center text-[13px] text-ink-secondary hover:text-ink-primary disabled:opacity-50" onClick={() => setEditing(false)}>
              {s.cancel}
            </button>
          </div>
        </form>
      )}

      {detail !== null && (detail.checks ?? []).length > 0 && (
        <div data-ask="followed-checks" className="mt-2 flex flex-col gap-4 border-t border-line pt-3 text-[13.5px] text-ink-secondary">
          {(detail.checks ?? []).slice(0, 5).map((check) => (
            <div key={check.id} className="flex flex-col gap-1">
              <p className="text-[0.8125rem] text-ink-tertiary">{when(check.checkedAt)}</p>
              <AskFollowAssessment check={check} locale={locale} />
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
