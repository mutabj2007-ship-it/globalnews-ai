'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askV2Api, type AskV2Outcome, type AskV2RecentThread } from '@/lib/api/askV2Api';
import {
  ASK_RECENT_GROUPS,
  askReopenHref,
  filterRecent,
  groupRecentThreads,
  recentRowPreview,
} from '@/lib/ask/askRecentGrouping';
import { cleanAskDestination, isAskConversationSurface, isPlainClick } from '@/lib/ask/askCleanNavigation';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { useAskNavOptional } from '@/components/ask-nav/AskNavShell';
import styles from './askDashboard.module.css';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK DESIGN COMPLETENESS R1 — CONVERSATIONS (Design D4 drawer · F2/F3 persistent column)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The reader's own Ask conversations, as the Design draws them: New question, a search field,
 * Today / Yesterday / Earlier groups with dates, the current conversation marked
 * `aria-current="page"`. One presentation, two mounts: the persistent 280 px column at ≥1024 and
 * the phone/tablet drawer.
 *
 * REAL CAPABILITY ONLY. The list is `GET /ask-v2/threads` (a read: 0 AI · 0 provider · 0 Sand),
 * the same read and the same pure grouping/filtering Recent uses, and a row opens the stored
 * answer through `askReopenHref` — a display-only read, nothing re-run. It is read only for a
 * reader the shell's one session read found signed in; a signed-out reader is told, never shown
 * an empty list that would claim their work is gone.
 *
 * CAPABILITY-BLOCKED — the Design's per-row "⋯" → Rename / Delete: the backend has no thread
 * rename or delete endpoint (`/ask-v2/threads/:id` is GET only). The control is omitted, never
 * shown disabled. "What Ask remembers" (Design D6) has no preferences endpoint and is omitted.
 */
export function AskConversations({
  locale,
  currentThreadId,
  onNavigate,
}: {
  readonly locale: DisplayLocale;
  /** The conversation on screen, marked `aria-current="page"`. */
  readonly currentThreadId?: string | null;
  /** The drawer closes itself when a row or New question is used. */
  readonly onNavigate?: () => void;
}): JSX.Element {
  const shell = askShellStrings(locale);
  const r = shell.askR2Strings.read;
  const t = shell.askContinuityStrings;
  const nav = useAskNavOptional();
  const pathname = usePathname();
  const account = nav?.account ?? 'signed-out';
  const [loaded, setLoaded] = useState<{
    readonly outcome: AskV2Outcome<readonly AskV2RecentThread[]>;
    readonly loadedAt: Date;
  } | null>(null);
  const [term, setTerm] = useState('');

  useEffect(() => {
    if (account !== 'signed-in') return;
    let cancelled = false;
    void askV2Api.threads().then((outcome) => {
      if (!cancelled) setLoaded({ outcome, loadedAt: new Date() });
    });
    return () => {
      cancelled = true;
    };
  }, [account]);

  const rows = useMemo(() => (loaded?.outcome.ok === true ? loaded.outcome.value : []), [loaded]);
  const filtered = useMemo(() => filterRecent(rows, term), [rows, term]);
  const grouped = useMemo(
    () => groupRecentThreads(filtered, loaded?.loadedAt ?? new Date()),
    [filtered, loaded],
  );
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <nav data-ask="conversations" aria-label={r.conversations} className={styles.conversations}>
      <h2>{r.conversations}</h2>
      <a
        data-ask="conversations-new"
        href={cleanAskDestination(pathname)}
        onClick={(event) => {
          onNavigate?.();
          /* The same explicit New question the shell's menu runs: clear now, then a clean load. */
          if (nav === null || !isAskConversationSurface(pathname) || !isPlainClick(event)) return;
          event.preventDefault();
          nav.clearAndGo(cleanAskDestination(pathname));
        }}
      >
        <span aria-hidden="true">+</span>
        {shell.askNavStrings.newQuestion}
      </a>
      {account === 'signed-in' && loaded?.outcome.ok === true && rows.length > 0 && (
        <label className="flex flex-col">
          <span className={styles.visuallyHidden}>{r.searchConversations}</span>
          <input
            type="search"
            data-ask="conversations-search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={r.searchConversations}
          />
        </label>
      )}
      {account === 'signed-out' ? (
        <p data-ask="conversations-note">{t.states.signedOut}</p>
      ) : loaded === null ? null : loaded.outcome.ok === false ? (
        <p data-ask="conversations-note" role="status">
          {loaded.outcome.reason === 'SIGNED_OUT'
            ? t.states.signedOut
            : loaded.outcome.reason === 'UNAVAILABLE'
              ? t.states.unavailable
              : loaded.outcome.reason === 'NETWORK'
                ? t.states.network
                : t.states.refused}
        </p>
      ) : rows.length === 0 ? (
        <p data-ask="conversations-note">{t.empty.recent}</p>
      ) : filtered.length === 0 ? (
        <p data-ask="conversations-note">{t.empty.filtered}</p>
      ) : (
        ASK_RECENT_GROUPS.map((group) =>
          grouped[group].length === 0 ? null : (
            <section key={group} data-ask-conversations-group={group}>
              <h3>{t.groups[group]}</h3>
              <ul>
                {grouped[group].map((row) => {
                  const href = askReopenHref(row);
                  const preview = recentRowPreview(row);
                  const at = new Date(row.lastActiveAt);
                  const when = Number.isNaN(at.getTime())
                    ? ''
                    : group === 'earlier'
                      ? day.format(at)
                      : `${t.groups[group]}, ${time.format(at)}`;
                  const title =
                    preview.primary === null
                      ? t.noQuestionStored
                      : `${preview.primary}${preview.primaryTruncated ? '…' : ''}`;
                  return (
                    <li key={row.id} data-ask-conversation={row.id}>
                      {href === null ? (
                        <span className="flex flex-col gap-0.5 px-2.5 py-2.5">
                          <span>{title}</span>
                          <span>{t.noStoredResult}</span>
                        </span>
                      ) : (
                        <Link
                          href={href}
                          prefetch={false}
                          aria-current={row.id === currentThreadId ? 'page' : undefined}
                          onClick={() => onNavigate?.()}
                        >
                          <span>{title}</span>
                          <span>{when}</span>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
        )
      )}
    </nav>
  );
}
