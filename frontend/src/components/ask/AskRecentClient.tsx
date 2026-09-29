'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { askV2Api, type AskV2Outcome, type AskV2RecentThread } from '@/lib/api/askV2Api';
import {
  ASK_RECENT_GROUPS,
  askReopenHref,
  filterRecent,
  recentRowPreview,
  groupRecentThreads,
  type AskRecentGroup,
} from '@/lib/ask/askRecentGrouping';
import { askContinuityStrings } from '@/lib/ask/askContinuityStrings';
import type { AskLocale } from '@/lib/ask/askStrings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PUBLIC BETA ASK CONTINUITY R1 — RECENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ONE READ, ON MOUNT. `GET /ask-v2/threads`: 0 model · 0 provider · 0 Sand.
 * Nothing here can start compute — there is no analyze call, no compute-consent
 * grant, and no path from a row to anything but a navigation.
 *
 * Every row is stored fact. The preview is the reader's own first question, and
 * NO TITLE IS GENERATED: a generated title would be a model call on the surface
 * whose whole contract is that opening it spends nothing.
 *
 * REFUSALS ARE NAMED, NEVER AN EMPTY LIST. Signed out, feature off and unreachable
 * each say what happened. Rendering "you have no conversations" to a reader whose
 * session expired is not a smaller failure than an error — it is a different and
 * worse one, because it claims their work is gone.
 */
export function AskRecentClient({ locale }: { readonly locale: AskLocale }): JSX.Element {
  const t = askContinuityStrings(locale);
  /*
    THE LOAD AND THE MOMENT IT LOADED ARE ONE PIECE OF STATE.

    `loadedAt` is captured when the read resolves, not read inside the grouping
    call, so a row cannot move from Today to Yesterday while the reader is looking
    at the same list — which is what a clock read during render would allow at
    midnight. Keeping the two in one state object is also what makes the memo
    dependencies honest: the band a row is in depends on exactly this pair.
  */
  const [loaded, setLoaded] = useState<{
    readonly outcome: AskV2Outcome<readonly AskV2RecentThread[]>;
    readonly loadedAt: Date;
  } | null>(null);
  const [term, setTerm] = useState('');

  useEffect(() => {
    let cancelled = false;
    void askV2Api.threads().then((result) => {
      if (!cancelled) setLoaded({ outcome: result, loadedAt: new Date() });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const outcome = loaded?.outcome ?? null;
  const rows = useMemo(() => (loaded?.outcome.ok === true ? loaded.outcome.value : []), [loaded]);
  const filtered = useMemo(() => filterRecent(rows, term), [rows, term]);
  const grouped = useMemo(
    () => groupRecentThreads(filtered, loaded?.loadedAt ?? new Date()),
    [filtered, loaded],
  );

  return (
    <main data-ask-recent="surface" className="min-h-screen bg-void px-4 py-8 md:px-8">
      <header className="mx-auto max-w-3xl">
        <h1 className="font-display text-[26px] font-semibold text-ink-primary">{t.recentTitle}</h1>
        <p className="mt-1 text-[13.5px] text-ink-tertiary">{t.recentIntro}</p>
      </header>

      <div className="mx-auto mt-6 max-w-3xl">
        {outcome === null ? (
          <p data-ask-recent="loading" className="text-[13px] text-ink-tertiary" aria-live="polite">
            {'—'}
          </p>
        ) : outcome.ok === false ? (
          <p
            data-ask-recent={`refused-${outcome.reason}`}
            role="status"
            className="text-[13.5px] text-ink-secondary"
          >
            {outcome.reason === 'SIGNED_OUT'
              ? t.states.signedOut
              : outcome.reason === 'UNAVAILABLE'
                ? t.states.unavailable
                : outcome.reason === 'NETWORK'
                  ? t.states.network
                  : t.states.refused}
          </p>
        ) : rows.length === 0 ? (
          <p data-ask-recent="empty" className="text-[13.5px] text-ink-secondary">
            {t.empty.recent}
          </p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-[12px] text-ink-tertiary">
              <span>{t.filterLabel}</span>
              <input
                data-ask-recent="filter"
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder={t.filterPlaceholder}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] text-ink-primary"
              />
            </label>

            {filtered.length === 0 ? (
              <p data-ask-recent="filtered-empty" className="mt-5 text-[13.5px] text-ink-secondary">
                {t.empty.filtered}
              </p>
            ) : (
              ASK_RECENT_GROUPS.map((group: AskRecentGroup) =>
                grouped[group].length === 0 ? null : (
                  <section key={group} data-ask-recent-group={group} className="mt-6">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
                      {t.groups[group]}
                    </h2>
                    <ul className="mt-2 flex flex-col gap-2">
                      {grouped[group].map((row) => {
                        const preview = recentRowPreview(row);
                        return (
                          <li
                            key={row.id}
                            data-ask-recent-row={row.id}
                            className="rounded-xl border border-line bg-surface p-3"
                          >
                            <p
                              data-ask-recent="question"
                              className="text-[14.5px] leading-snug text-ink-primary"
                            >
                              {preview.primary === null
                                ? t.noQuestionStored
                                : `${preview.primary}${preview.primaryTruncated ? '…' : ''}`}
                            </p>
                            {preview.startedWith === null ? null : (
                              <p
                                data-ask-recent="started-with"
                                className="mt-0.5 text-[12px] leading-snug text-ink-tertiary"
                              >
                                {`${t.startedWith} ${preview.startedWith}${
                                  preview.startedWithTruncated ? '…' : ''
                                }`}
                              </p>
                            )}
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-tertiary">
                              <span data-ask-recent="turns">
                                {row.turnCount === 1
                                  ? t.turnCountOne
                                  : t.turnCount.replace('{n}', String(row.turnCount))}
                              </span>
                              <span aria-hidden="true">{'·'}</span>
                              <span data-ask-recent="last-active">
                                {`${t.lastActive} ${new Date(row.lastActiveAt).toLocaleString(locale)}`}
                              </span>
                              <span aria-hidden="true">{'·'}</span>
                              <span data-ask-recent="language">{row.language.toUpperCase()}</span>
                              {row.latestState === null ? null : (
                                <>
                                  <span aria-hidden="true">{'·'}</span>
                                  <span data-ask-recent="state">{row.latestState}</span>
                                </>
                              )}
                            </p>
                            <div className="mt-2 flex flex-col items-start gap-0.5">
                              {askReopenHref(row) !== null ? (
                                <>
                                  <Link
                                    data-ask-recent="reopen"
                                    href={askReopenHref(row) as string}
                                    className="text-[13px] font-medium text-signal underline decoration-signal/50 underline-offset-4"
                                  >
                                    {t.reopen}
                                  </Link>
                                  <span
                                    data-ask-recent="reopen-note"
                                    className="text-[11.5px] text-ink-tertiary"
                                  >
                                    {`${t.reopenNote} ${t.continueNote}`}
                                  </span>
                                </>
                              ) : (
                                /* No stored operation: no Reopen, and no rerun — say so. */
                                <span
                                  data-ask-recent="no-stored-result"
                                  className="text-[12px] text-ink-tertiary"
                                >
                                  {t.noStoredResult}
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ),
              )
            )}
          </>
        )}
      </div>
    </main>
  );
}
