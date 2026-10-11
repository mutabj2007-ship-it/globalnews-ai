'use client';

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askV2Api, type AskV2Outcome, type AskV2RecentThread } from '@/lib/api/askV2Api';
import {
  ASK_RECENT_GROUPS,
  askReopenHref,
  filterRecent,
  groupRecentThreads,

} from '@/lib/ask/askRecentGrouping';
import { cleanAskDestination, isAskConversationSurface, isPlainClick } from '@/lib/ask/askCleanNavigation';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { askFormatLocalDay, askFormatLocalTime } from '@/lib/ask/askDirection';
import { useAskNavOptional } from '@/components/ask-nav/AskNavShell';
import { followStrings } from '@/lib/ask/followStrings';
import styles from './askDashboard.module.css';
import { AskConfirmDialog } from './AskConfirmDialog';
import { askR3FullStrings } from '@/lib/ask/askR3FullStrings';
import { askSettingsR2Strings } from '@/lib/ask/askSettingsR2Strings';
import { AskSettingsGlyph } from './AskSettingsGlyph';

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
 * REASON TO RETURN R1 · G7 — Delete is real now (`DELETE /ask-v2/threads/:id`, owner-scoped,
 * CSRF, confirmed first; it removes the conversation and its answers, never followed questions).
 * Search goes to the server (`?q=`) and matches EVERY turn of the reader's own conversations,
 * not only the previews on screen; the local filter still answers instantly while it runs.
 * CAPABILITY-BLOCKED — Rename: there is no thread title store (the title is the reader's own
 * first question, by design). "What Ask remembers" (Design D6) has no preferences endpoint.
 */
export function AskConversations({
  locale,
  currentThreadId,
  onNavigate,
  showTitle = true,
}: {
  readonly locale: DisplayLocale;
  /** The conversation on screen, marked `aria-current="page"`. */
  readonly currentThreadId?: string | null;
  /** The drawer closes itself when a row or New question is used. */
  readonly onNavigate?: () => void;
  /** The drawer carries the title in its own header (Design D4); the column shows it here. */
  readonly showTitle?: boolean;
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
  const f = followStrings(locale);
  /* REASON TO RETURN R1 — the server's matches for `term` (every turn), once they arrive */
  const [found, setFound] = useState<{ readonly term: string; readonly ids: ReadonlySet<string> } | null>(null);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteNote, setDeleteNote] = useState<string | null>(null);
  /* R3 FULL DESIGN · D12-delete — the conversation awaiting the reader's confirmation. */
  const [confirming, setConfirming] = useState<{
    readonly id: string;
    readonly title: string;
    readonly opener: HTMLElement | null;
  } | null>(null);
  const r3 = askR3FullStrings(locale);
  const r2 = askSettingsR2Strings(locale);
  /*
    ASK R3 SETTINGS-NAV ENGINEERING §3 (frames 02, 05–07) — Retry re-runs the SAME read
    (`GET /ask-v2/threads`, 0 AI · 0 provider), shows Loading while it runs and ignores further
    presses until it settles, so a double click is still one request.
  */
  const [retrying, setRetrying] = useState(false);
  /* the term whose server search settled with an error: the local matches stay, with no banner */
  const [searchFailed, setSearchFailed] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  function retry(): void {
    if (retrying) return;
    setRetrying(true);
    void askV2Api.threads().then((outcome) => {
      setLoaded({ outcome, loadedAt: new Date() });
      setRetrying(false);
    });
  }
  function clearSearch(): void {
    setTerm('');
    searchRef.current?.focus();
  }

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

  useEffect(() => {
    const q = term.trim();
    if (account !== 'signed-in' || q === '') {
      setFound(null);
      setSearchFailed(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void askV2Api.threads(q).then((outcome) => {
        if (cancelled) return;
        if (outcome.ok) {
          setFound({ term: q, ids: new Set(outcome.value.map((t) => t.id)) });
          setSearchFailed(null);
        } else {
          setSearchFailed(q);
        }
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [account, term]);

  const rows = useMemo(
    () => (loaded?.outcome.ok === true ? loaded.outcome.value.filter((t) => !removed.has(t.id)) : []),
    [loaded, removed],
  );
  /* the server's answer for this exact term wins; until then the instant local filter */
  const filtered = useMemo(
    () =>
      found !== null && found.term === term.trim()
        ? rows.filter((row) => found.ids.has(row.id))
        : filterRecent(rows, term),
    [rows, term, found],
  );

  /*
    SUPERSEDED (R3 FULL DESIGN · D12-delete): the browser's native `window.confirm` box, which
    could not be themed, mirrored or labelled. The same question, the same note and the same ONE
    request now go through AskConfirmDialog, where "Keep" holds focus first.
  */
  async function removeConversation(id: string): Promise<void> {
    if (deleting !== null) return;
    setDeleting(id);
    setDeleteNote(null);
    const outcome = await askV2Api.deleteThread(id);
    setDeleting(null);
    if (outcome.ok) {
      setRemoved((prev) => new Set([...prev, id]));
      setDeleteNote(f.conversationDeleted);
      /* the conversation on screen was this one: leave it for a clean Ask */
      if (id === currentThreadId && nav !== null) nav.clearAndGo(cleanAskDestination(pathname));
    } else {
      setDeleteNote(f.deleteConversationFailed);
    }
  }
  const grouped = useMemo(
    () => groupRecentThreads(filtered, loaded?.loadedAt ?? new Date()),
    [filtered, loaded],
  );
  /* Design D4: "Today, 14:20" and "2 Oct 2026" — the product's day-month-year order and a
     24-hour clock, as the turn footer and the Sources sheet read. */
  const time = { format: (at: Date) => askFormatLocalTime(at, locale) };
  const day = { format: (at: Date) => askFormatLocalDay(at, locale) };

  return (
    <nav
      data-ask="conversations"
      aria-label={r.conversations}
      className={styles.conversations}
    >
      {confirming !== null && (
        <AskConfirmDialog
          title={r3.deleteTitle}
          body={f.deleteConversationConfirm(confirming.title)}
          note={f.deleteConversationNote}
          confirmLabel={f.deleteConversation}
          cancelLabel={r3.keep}
          onCancel={() => {
            const opener = confirming.opener;
            setConfirming(null);
            opener?.focus();
          }}
          onConfirm={() => {
            const { id } = confirming;
            setConfirming(null);
            void removeConversation(id);
          }}
        />
      )}
      {showTitle && <h2>{r.conversations}</h2>}
      <a
        data-ask="conversations-new"
        href={cleanAskDestination(pathname)}
        onClick={(event) => {
          onNavigate?.();
          if (nav === null || !isAskConversationSurface(pathname) || !isPlainClick(event)) return;
          event.preventDefault();
          /* ASK DESIGN COMPLETENESS R2 — the frame's in-place New question (new thread, drawer
             closed, composer focused); the clean document load only when no frame is mounted. */
          if (nav.runNewQuestion()) return;
          nav.clearAndGo(cleanAskDestination(pathname));
        }}
      >
        <span aria-hidden="true">+</span>
        {shell.askNavStrings.newQuestion}
      </a>
      {account === 'signed-in' && loaded?.outcome.ok === true && rows.length > 0 && (
        <div className={styles.conversationsSearch}>
          <AskSettingsGlyph name="search" className={styles.conversationsSearchGlyph} />
          <label className="flex flex-col">
            <span className={styles.visuallyHidden}>{r.searchConversations}</span>
            <input
              ref={searchRef}
              type="search"
              data-ask="conversations-search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => {
                /* §3 — Escape in a field with text clears it; in an empty field the drawer closes */
                if (event.key === 'Escape' && term !== '') {
                  event.preventDefault();
                  clearSearch();
                }
              }}
              placeholder={r.searchConversations}
            />
          </label>
          {/* ASK R3 SETTINGS-NAV ENGINEERING §3 — Clear restores the whole list and returns focus
              to the field; it sends nothing and deletes nothing. */}
          {term !== '' && (
            <button type="button" data-ask="conversations-search-clear" aria-label={r2.clearSearch} onClick={clearSearch}>
              <span className={styles.conversationsClearDot}>
                <AskSettingsGlyph name="clear" />
              </span>
            </button>
          )}
        </div>
      )}
      {/* §3 — the polite count, once the server search for THIS term has settled; never an
          estimate, never on every keystroke */}
      {account === 'signed-in' &&
        loaded?.outcome.ok === true &&
        term.trim() !== '' &&
        ((found !== null && found.term === term.trim()) || searchFailed === term.trim()) &&
        filtered.length > 0 && (
          <p data-ask="conversations-search-count" role="status" aria-live="polite" className={styles.conversationsCount}>
            {r2.conversationsFound(filtered.length)}
          </p>
        )}
      {deleteNote !== null && (
        <p data-ask="conversations-delete-note" role="status">
          {deleteNote}
        </p>
      )}
      {/* ASK R3 NAVIGATION / USABILITY R1 — the list scrolls in its own region, so New question
          and search stay on top and the drawer footer (My updates, Saved, Help, Settings…) stays
          in view with up to 50 conversations (audit gap #1). */}
      <div data-ask="conversations-list" className={styles.conversationsList}>
      {account === 'signed-out' ? (
        <p data-ask="conversations-note">{t.states.signedOut}</p>
      ) : loaded === null || retrying ? (
        <>
          {/* §3 Loading — four quiet bars, no text, no spinner */}
          <div data-ask="conversations-loading" aria-busy="true" className={styles.conversationsLoading}>
            <span />
            <span />
            <span />
            <span />
          </div>
          {retrying && (
            <button type="button" data-ask="conversations-retry" aria-disabled="true" className={styles.conversationsRetry}>
              {r2.retry}
            </button>
          )}
        </>
      ) : loaded.outcome.ok === false ? (
        <>
          <p data-ask="conversations-note" role="status">
            {loaded.outcome.reason === 'SIGNED_OUT'
              ? t.states.signedOut
              : loaded.outcome.reason === 'UNAVAILABLE'
                ? t.states.unavailable
                : loaded.outcome.reason === 'NETWORK'
                  ? t.states.network
                  : t.states.refused}
          </p>
          {/* F07e — a signed-out answer is not a failure to retry; every other reason is */}
          {loaded.outcome.reason !== 'SIGNED_OUT' && (
            <button
              type="button"
              data-ask="conversations-retry"
              className={styles.conversationsRetry}
              onClick={retry}
            >
              {r2.retry}
            </button>
          )}
        </>
      ) : rows.length === 0 ? (
        <p data-ask="conversations-note">{t.empty.recent}</p>
      ) : filtered.length === 0 ? (
        <>
          <p data-ask="conversations-note">{t.empty.filtered}</p>
          {/* §3 No match — a Clear search pill that does exactly what Clear does */}
          <button type="button" data-ask="conversations-search-clear-pill" className={styles.conversationsRetry} onClick={clearSearch}>
            {r2.clearSearch}
          </button>
        </>
      ) : (
        ASK_RECENT_GROUPS.map((group) =>
          grouped[group].length === 0 ? null : (
            <section key={group} data-ask-conversations-group={group}>
              <h3>{t.groups[group]}</h3>
              <ul>
                {grouped[group].map((row) => {
                  const href = askReopenHref(row);
                  const at = new Date(row.lastActiveAt);
                  const when = Number.isNaN(at.getTime())
                    ? ''
                    : group === 'earlier'
                      ? day.format(at)
                      : `${t.groups[group]}, ${time.format(at)}`;
                  /*
                    ASK DESIGN COMPLETENESS R2 — ONE ROW = ONE CONVERSATION, with a STABLE title:
                    the thread's root question (sequence 1), never its latest follow-up. A
                    follow-up is part of the conversation it continues; it never becomes the
                    conversation's name. (No persisted thread title exists in the API.)
                  */
                  const title = conversationTitle(row, t.noQuestionStored);
                  return (
                    <li key={row.id} data-ask-conversation={row.id} className="flex items-stretch">
                      <div className="min-w-0 flex-1">
                      {href === null ? (
                        <span className="flex flex-col gap-0.5 px-2.5 py-2.5">
                          <span dir="auto" style={{ unicodeBidi: 'isolate' }}>{title}</span>
                          <span>{t.noStoredResult}</span>
                        </span>
                      ) : (
                        <Link
                          href={href}
                          prefetch={false}
                          aria-current={row.id === currentThreadId ? 'page' : undefined}
                          onClick={() => onNavigate?.()}
                        >
                          <span dir="auto" style={{ unicodeBidi: 'isolate' }}>{title}</span>
                          <span>{when}</span>
                        </Link>
                      )}
                      </div>
                      <button
                        type="button"
                        data-ask="conversation-delete"
                        disabled={deleting !== null}
                        aria-label={`${r3.deleteConversationAction}: ${title}`}
                        onClick={(event) => setConfirming({ id: row.id, title, opener: event.currentTarget })}
                        /* R3 D12 — the row affordance is the 44 px "⋯" glyph; its name stays
                           "Delete conversation: {title}" for assistive technology */
                        className="min-h-[44px] min-w-[44px] shrink-0 rounded-[10px] px-2 text-[18px] font-medium leading-none text-[var(--ad-ink-2,#93a0b8)]"
                      >
                        {deleting === row.id ? (
                          <span className="text-[0.8125rem]">{f.deleteConversationBusy}</span>
                        ) : (
                          <span aria-hidden="true">⋯</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
        )
      )}
      </div>
    </nav>
  );
}

/**
 * ASK DESIGN COMPLETENESS R2 — the stable conversation title: the thread's root question
 * (`firstQuestion`, the reader's own words at sequence 1). Only a thread whose root turn is not
 * stored falls back to the latest question. Never generated.
 */
export function conversationTitle(
  row: Pick<
    AskV2RecentThread,
    'firstQuestion' | 'firstQuestionTruncated' | 'latestQuestion' | 'latestQuestionTruncated'
  >,
  noQuestionStored: string,
): string {
  if (row.firstQuestion !== null) return `${row.firstQuestion}${row.firstQuestionTruncated ? '…' : ''}`;
  const latest = row.latestQuestion ?? null;
  if (latest !== null) return `${latest}${row.latestQuestionTruncated === true ? '…' : ''}`;
  return noQuestionStored;
}
