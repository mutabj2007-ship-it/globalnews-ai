'use client';

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { Bell, ExternalLink, X } from 'lucide-react';
import { safeExternalHref, type LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { fill } from '@/components/home/reva/homeRevaModel';
import { applyAlertOp, fetchInbox, listAlerts, markAllRead, markEventRead, type AlertOp, type AlertView, type InboxView } from '@/lib/stories/stageBApi';
import { closePanel, openAlertsCentre, setAlertFor, setUnread, useStageB } from '@/lib/stories/stageBStore';
import { useHomeSession } from '@/components/home/reva/HomeSession';
import { dashboardHref } from '@/lib/ask/dashboardContext';

/**
 * HOME R1 · STAGE B — THE ALERTS CENTRE (in-app only) and its header entry.
 *
 * Developments are rows the server wrote when a story's brief version rose; Replies are
 * replies to the reader's own comments (only while discussion.read exists). Statuses are the
 * server's: "No meaningful change yet", "Changed since you set this alert", or "No retained
 * reporting" — never a guess. Nothing here sends anything anywhere.
 */
type Tab = 'developments' | 'replies' | 'manage';
type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; inbox: InboxView; alerts: readonly AlertView[] };

const unreadOf = (inbox: InboxView, replies: boolean): number => inbox.unread.developments + (replies ? inbox.unread.replies : 0);

/** Signed-in readers only: the centre is account-owned. Signed out, nothing is drawn. */
export function AlertsBell({ language, replies }: { readonly language: LanguageCode; readonly replies: boolean }): JSX.Element | null {
  const { user } = useHomeSession();
  return user === null ? null : <SignedInBell language={language} replies={replies} />;
}

function SignedInBell({ language, replies }: { readonly language: LanguageCode; readonly replies: boolean }): JSX.Element {
  const t = getDictionary(language).homeR1.alerts;
  const { unread } = useStageB();
  useEffect(() => {
    let live = true;
    void fetchInbox().then((out) => {
      if (live && out.ok) setUnread(unreadOf(out.value, replies));
    });
    return () => {
      live = false;
    };
  }, [replies]);
  const label = unread !== null && unread > 0 ? `${t.open} · ${fill(t.unread, { n: String(unread) })}` : t.open;
  return (
    <button type="button" onClick={openAlertsCentre} aria-label={label} data-alerts-bell="" className="relative flex h-[44px] w-[44px] items-center justify-center rounded-full text-[var(--gt-hdrInk)] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]">
      <Bell aria-hidden="true" className="h-5 w-5" />
      {unread !== null && unread > 0 && (
        <span aria-hidden="true" data-alerts-unread={unread} className="absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-[var(--gt-amberBg)] px-1 text-center text-[10.5px] font-bold leading-[18px] text-[var(--gt-amberInk)] ring-1 ring-[var(--gt-amberBd)]">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

export function AlertsCentre({ language, replies }: { readonly language: LanguageCode; readonly replies: boolean }): JSX.Element {
  const t = getDictionary(language).homeR1.alerts;
  const [tab, setTab] = useState<Tab>('developments');
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [undo, setUndo] = useState<AlertView | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const read = useCallback(async () => {
    const [inbox, alerts] = await Promise.all([fetchInbox(), listAlerts()]);
    if (inbox.ok && alerts.ok) {
      setLoad({ kind: 'ready', inbox: inbox.value, alerts: alerts.value.alerts });
      setUnread(unreadOf(inbox.value, replies));
    } else setLoad({ kind: 'failed' });
  }, [replies]);

  useEffect(() => {
    void read();
  }, [read]);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const op = async (alert: AlertView, action: AlertOp): Promise<void> => {
    const out = await applyAlertOp(alert.id, action);
    if (!out.ok) return;
    if (alert.subject) setAlertFor(alert.subject.articleRef, action === 'remove' ? null : { alertId: alert.id, status: out.value.status });
    setUndo(action === 'remove' ? alert : null);
    await read();
  };

  const tabs: readonly { key: Tab; label: string }[] = [
    { key: 'developments', label: t.tabDevelopments },
    ...(replies ? [{ key: 'replies' as const, label: t.tabReplies }] : []),
    { key: 'manage', label: t.tabManage },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-[var(--gt-scrim)]" data-stage-b-alerts="" onClick={(e) => e.target === e.currentTarget && closePanel()}>
      <section role="dialog" aria-modal="true" aria-labelledby="stage-b-alerts-title" className="flex h-full w-full flex-col bg-[var(--gt-bg)] text-[var(--gt-ink)] sm:max-w-[460px]">
        <header className="flex items-center gap-3 border-b border-[var(--gt-line)] bg-[var(--gt-card)] p-4">
          <Bell aria-hidden="true" className="h-5 w-5 text-[var(--gt-amberInk)]" />
          <h2 id="stage-b-alerts-title" className="flex-1 font-display text-[18px] font-bold">
            {t.centreTitle}
          </h2>
          {load.kind === 'ready' && unreadOf(load.inbox, replies) > 0 && (
            <button
              type="button"
              onClick={async () => {
                await markAllRead();
                await read();
              }}
              className="min-h-[40px] rounded-full px-3 text-[13px] font-semibold text-[var(--gt-link)]"
            >
              {t.markAll}
            </button>
          )}
          <button ref={closeRef} type="button" onClick={closePanel} aria-label={t.cancel} className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-[var(--gt-ink2)] hover:bg-[var(--gt-sunk)]">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>
        <div role="tablist" aria-label={t.centreTitle} className="flex border-b border-[var(--gt-line)] bg-[var(--gt-card)] px-2">
          {tabs.map(({ key, label }) => {
            const count = load.kind === 'ready' ? (key === 'developments' ? load.inbox.unread.developments : key === 'replies' ? load.inbox.unread.replies : 0) : 0;
            return (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`min-h-[44px] flex-1 border-b-2 px-2 text-[13px] font-semibold ${tab === key ? 'border-[var(--gt-act)] text-[var(--gt-ink)]' : 'border-transparent text-[var(--gt-ink2)]'}`}
              >
                {label}
                {count > 0 && <span className="ml-1 rounded-full bg-[var(--gt-amberBg)] px-1.5 text-[11px] text-[var(--gt-amberInk)]">{count}</span>}
              </button>
            );
          })}
        </div>
        <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="polite">
          {load.kind === 'loading' && <p role="status" className="text-[13px] text-[var(--gt-ink2)]">{t.loading}</p>}
          {load.kind === 'failed' && <p role="alert" className="text-[13px]">{t.loadFailed}</p>}
          {load.kind === 'ready' && tab === 'developments' && (
            load.inbox.developments.length === 0 ? (
              <Empty title={load.alerts.length === 0 ? t.emptyTitle : t.noChange} body={load.alerts.length === 0 ? t.emptyBody : t.noDevelopments} />
            ) : (
              <ol className="flex flex-col gap-2">
                {load.inbox.developments.map((d) => (
                  <li key={d.id} data-development-read={d.read ? 'true' : 'false'} className={`rounded-[12px] border p-3 ${d.read ? 'border-[var(--gt-line)] bg-[var(--gt-card)]' : 'border-[var(--gt-amberBd)] bg-[var(--gt-amberBg)]'}`}>
                    <p className="text-[12px] text-[var(--gt-ink2)]">
                      {d.kind === 'STORY_MERGED' ? t.kindMerged : t.kindNewEvidence} · {formatRelativeTime(d.createdAt, language)}
                    </p>
                    {d.subject ? (
                      <a
                        href={safeExternalHref(d.subject.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => void markEventRead(d.id).then(read)}
                        className="mt-0.5 flex items-start gap-1 text-[14px] font-semibold text-[var(--gt-ink)] hover:underline"
                      >
                        {d.subject.title}
                        <ExternalLink aria-hidden="true" className="mt-1 h-3.5 w-3.5 shrink-0" />
                      </a>
                    ) : (
                      <p className="mt-0.5 text-[13px] text-[var(--gt-ink3)]">{t.unavailableStory}</p>
                    )}
                    {/* TRUST R1 — what changed, and a contextual Ask that opens as a DRAFT (never auto-runs). */}
                    {d.newEvidence && (
                      <div data-development-new-evidence="" className="mt-2 border-t border-[var(--gt-line)] pt-2">
                        <p className="text-[12px] text-[var(--gt-ink2)]">{t.newReport}</p>
                        <a href={safeExternalHref(d.newEvidence.url)} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[var(--gt-ink)] hover:underline">
                          {d.newEvidence.title}
                        </a>
                        <p className="text-[12px] text-[var(--gt-ink3)]">
                          {d.newEvidence.sourceName} · {formatRelativeTime(d.newEvidence.publishedAt, language)}
                        </p>
                        <a
                          data-development-ask=""
                          href={dashboardHref(t.askAboutUpdateDraft, { title: d.newEvidence.title, articleId: d.newEvidence.articleId })}
                          onClick={() => void markEventRead(d.id).then(read)}
                          className="mt-1 inline-flex min-h-[44px] items-center text-[13px] font-semibold text-[var(--gt-link)] hover:underline"
                        >
                          {t.askAboutUpdate}
                        </a>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )
          )}
          {load.kind === 'ready' && tab === 'replies' && (
            load.inbox.replies.length === 0 ? (
              <Empty title={t.noRepliesTitle} body={t.noRepliesBody} />
            ) : (
              <ol className="flex flex-col gap-2">
                {load.inbox.replies.map((r) => (
                  <li key={r.id} data-reply-read={r.read ? 'true' : 'false'} className={`rounded-[12px] border p-3 text-[13px] ${r.read ? 'border-[var(--gt-line)] bg-[var(--gt-card)]' : 'border-[var(--gt-mint)] bg-[var(--gt-mintBg)]'}`}>
                    {fill(t.replyFrom, { name: r.authorLabel ?? getDictionary(language).homeR1.discussion.reader })} · {formatRelativeTime(r.createdAt, language)}
                  </li>
                ))}
              </ol>
            )
          )}
          {load.kind === 'ready' && tab === 'manage' && (
            <>
              {undo !== null && (
                <p role="status" className="mb-2 flex items-center justify-between rounded-[10px] bg-[var(--gt-sunk)] p-2.5 text-[13px]">
                  {t.removed}
                  <button type="button" onClick={() => void op(undo, 'restore')} className="min-h-[36px] px-2 font-semibold text-[var(--gt-link)]">
                    {t.undo}
                  </button>
                </p>
              )}
              {load.alerts.length === 0 ? (
                <Empty title={t.emptyTitle} body={t.emptyBody} />
              ) : (
                <ol className="flex flex-col gap-2">
                  {load.alerts.map((a) => (
                    <li key={a.id} data-alert-status={a.status} data-alert-change={a.change} className="rounded-[12px] border border-[var(--gt-line)] bg-[var(--gt-card)] p-3">
                      <p className="flex flex-wrap gap-1.5 text-[11.5px] font-semibold">
                        <span className={`rounded-full px-2 ${a.status === 'ACTIVE' ? 'bg-[var(--gt-amberBg)] text-[var(--gt-amberInk)]' : 'bg-[var(--gt-sunk)] text-[var(--gt-ink2)]'}`}>
                          {a.status === 'ACTIVE' ? t.active : t.paused}
                        </span>
                        {a.muted && <span className="rounded-full bg-[var(--gt-sunk)] px-2 text-[var(--gt-ink2)]">{t.muted}</span>}
                      </p>
                      <p className="mt-1 text-[14px] font-semibold">{a.subject?.title ?? t.unavailableStory}</p>
                      <p className="mt-0.5 text-[12.5px] text-[var(--gt-ink2)]">
                        {a.change === 'CHANGED' ? t.changed : a.change === 'NO_RETAINED_EVIDENCE' ? t.noEvidence : t.noChange}
                        {a.lastChangeAt ? ` · ${formatRelativeTime(a.lastChangeAt, language)}` : ''}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Op label={a.status === 'ACTIVE' ? t.pause : t.resume} onClick={() => void op(a, a.status === 'ACTIVE' ? 'pause' : 'resume')} />
                        <Op label={a.muted ? t.unmute : t.mute} onClick={() => void op(a, a.muted ? 'unmute' : 'mute')} />
                        <Op label={t.remove} onClick={() => void op(a, 'remove')} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-4 text-[12px] text-[var(--gt-ink2)]">{t.followsNote}</p>
              <p className="mt-1 text-[12px] text-[var(--gt-ink3)]">{t.delivery}</p>
            </>
          )}
          {load.kind === 'ready' && tab !== 'manage' && unreadOf(load.inbox, replies) === 0 && (load.inbox.developments.length > 0 || load.inbox.replies.length > 0) && (
            <p className="mt-3 text-[12.5px] text-[var(--gt-ink2)]">{t.allRead}</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Empty({ title, body }: { readonly title: string; readonly body: string }): JSX.Element {
  return (
    <div className="rounded-[12px] border border-dashed border-[var(--gt-line)] p-5 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-[13px] text-[var(--gt-ink2)]">{body}</p>
    </div>
  );
}

function Op({ label, onClick }: { readonly label: string; readonly onClick: () => void }): JSX.Element {
  return (
    <button type="button" onClick={onClick} className="min-h-[36px] rounded-full border border-[var(--gt-line)] px-3 text-[12.5px] font-semibold text-[var(--gt-ink2)] hover:text-[var(--gt-ink)]">
      {label}
    </button>
  );
}
