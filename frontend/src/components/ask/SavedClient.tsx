'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { askV2Api, type AskV2Bookmark, type AskV2Outcome } from '@/lib/api/askV2Api';
import { askBookmarkReopenHref, filterBookmarks } from '@/lib/ask/askRecentGrouping';
import { askContinuityStrings } from '@/lib/ask/askContinuityStrings';
import type { AskLocale } from '@/lib/ask/askStrings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK RECENT + SAVED CONTINUITY R1 — SAVED QUESTIONS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * STANDALONE ASK. This surface reads ONE substrate: `GET /ask-v2/bookmarks`, the
 * `AskBookmark` relation joined to its turns. It does not import My Intelligence,
 * does not read Saved Stories, and does not touch the Home experience — per the
 * Product Owner's standalone ruling. The existing saved-story code is left exactly
 * as it is; this surface simply does not expose it.
 *
 * A BOOKMARK IS A LINK, NEVER A COPY. The question and the answer live on `AskTurn`
 * and its `ComputeOperation` -> `StoredResult`. Nothing is duplicated into the
 * bookmark row, so a saved question cannot drift from the question, and saving
 * cannot keep an expired artifact readable past its own expiry.
 *
 * COST: 0 model · 0 provider · 0 Sand in every path here, including the mutation —
 * removing a bookmark deletes one row and touches no evidence.
 */
export function SavedClient({ locale }: { readonly locale: AskLocale }): JSX.Element {
  const t = askContinuityStrings(locale);
  const [questions, setQuestions] = useState<AskV2Outcome<readonly AskV2Bookmark[]> | null>(null);
  const [term, setTerm] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void askV2Api.bookmarks().then((result) => {
      if (!cancelled) setQuestions(result);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => (questions?.ok === true ? questions.value : []), [questions]);
  const filtered = useMemo(() => filterBookmarks(rows, term), [rows, term]);

  /*
    The row leaves the list only after the server confirms. An optimistic removal
    would tell the reader their bookmark is gone before anything deleted it.
  */
  const unsave = useCallback(async (turnId: string) => {
    setRemoving(turnId);
    const result = await askV2Api.unbookmark(turnId);
    setRemoving(null);
    if (result.ok !== true) return;
    setQuestions((current) =>
      current?.ok === true
        ? { ok: true, value: current.value.filter((row) => row.turnId !== turnId) }
        : current,
    );
  }, []);

  return (
    <main data-saved="surface" className="min-h-screen bg-void px-4 py-8 md:px-8">
      <header className="mx-auto max-w-3xl">
        <h1 className="font-display text-[26px] font-semibold text-ink-primary">{t.savedTitle}</h1>
        <p className="mt-1 text-[13.5px] text-ink-tertiary">{t.savedIntro}</p>
      </header>

      <section data-saved-panel="questions" className="mx-auto mt-6 max-w-3xl">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
          {t.tabs.questions}
        </h2>

        {questions === null ? (
          <p data-saved="loading" className="mt-2 text-[13px] text-ink-tertiary" aria-live="polite">
            {'—'}
          </p>
        ) : questions.ok === false ? (
          <p
            data-saved={`refused-${questions.reason}`}
            role="status"
            className="mt-2 text-[13.5px] text-ink-secondary"
          >
            {questions.reason === 'SIGNED_OUT'
              ? t.states.signedOut
              : questions.reason === 'UNAVAILABLE'
                ? t.states.unavailable
                : questions.reason === 'NETWORK'
                  ? t.states.network
                  : t.states.refused}
          </p>
        ) : rows.length === 0 ? (
          <p data-saved="empty-questions" className="mt-2 text-[13.5px] text-ink-secondary">
            {t.empty.questions}
          </p>
        ) : (
          <>
            <label className="mt-3 flex flex-col gap-1 text-[12px] text-ink-tertiary">
              <span>{t.filterLabel}</span>
              <input
                data-saved="filter"
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder={t.filterPlaceholder}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] text-ink-primary"
              />
            </label>

            {filtered.length === 0 ? (
              <p data-saved="filtered-empty" className="mt-4 text-[13.5px] text-ink-secondary">
                {t.empty.filtered}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {filtered.map((row) => (
                  <li
                    key={row.id}
                    data-saved-row={row.turnId}
                    className="rounded-xl border border-line bg-surface p-3"
                  >
                    <p className="text-[14.5px] leading-snug text-ink-primary">
                      {`${row.question}${row.questionTruncated ? '…' : ''}`}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-tertiary">
                      <span data-saved="saved-at">
                        {new Date(row.savedAt).toLocaleString(locale)}
                      </span>
                      <span aria-hidden="true">{'·'}</span>
                      <span data-saved="language">{row.language.toUpperCase()}</span>
                      {row.state === null ? null : (
                        <>
                          <span aria-hidden="true">{'·'}</span>
                          <span data-saved="state">{row.state}</span>
                        </>
                      )}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      {askBookmarkReopenHref(row) !== null ? (
                        <Link
                          data-saved="reopen"
                          href={askBookmarkReopenHref(row) as string}
                          className="text-[13px] font-medium text-signal underline decoration-signal/50 underline-offset-4"
                        >
                          {t.reopen}
                        </Link>
                      ) : (
                        /* No stored operation: no Reopen, and no rerun — say so. */
                        <span
                          data-saved="no-stored-result"
                          className="text-[12px] text-ink-tertiary"
                        >
                          {t.noStoredResult}
                        </span>
                      )}
                      <button
                        type="button"
                        data-saved="unsave"
                        disabled={removing === row.turnId}
                        onClick={() => void unsave(row.turnId)}
                        className="text-[13px] text-ink-tertiary hover:text-ink-secondary disabled:opacity-50"
                      >
                        {t.unsave}
                      </button>
                    </div>
                    <p data-saved="reopen-note" className="mt-1 text-[11.5px] text-ink-tertiary">
                      {t.reopenNote}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </main>
  );
}
