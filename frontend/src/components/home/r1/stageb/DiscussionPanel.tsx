'use client';

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { ExternalLink, Flag, Lock, MessagesSquare, Pencil, Reply, Trash2, X } from 'lucide-react';
import { safeExternalHref, type LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { accountSignInUrl } from '@/lib/api/accountLinks';
import { fill } from '@/components/home/reva/homeRevaModel';
import {
  deleteComment,
  editComment,
  fetchThread,
  newIdempotencyKey,
  postComment,
  reportComment,
  type CommentView,
  type ThreadView,
} from '@/lib/stories/stageBApi';
import { closePanel, setCount, type StoryTarget } from '@/lib/stories/stageBStore';
import { saveStoryTask } from '@/lib/stories/storyTask';

/**
 * HOME R1 · STAGE B — THE DISCUSSION PANEL (desktop side panel, phone full screen).
 *
 * Bound to the CANONICAL story of the article the reader opened it from; the server resolves
 * that (merge continuity included). Reading is public. Writing needs discussion.write, a
 * session and the CSRF double-submit — all enforced by the server; this panel only reflects
 * the answer. A failed post KEEPS the draft. Signed out, Post saves the draft in the same-tab
 * continuation record and goes through the existing sign-in to '/', where the panel reopens
 * with the draft (it never posts by itself).
 *
 * Comments are reader conversation, never evidence: nothing here talks to Ask.
 */
const MAX = 2000;
type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'off' } | { kind: 'ready'; thread: ThreadView };

export function DiscussionPanel({
  story,
  language,
  canWrite,
  signedIn,
  initialDraft,
  initialParentId,
}: {
  readonly story: StoryTarget;
  readonly language: LanguageCode;
  /** discussion.write (frontend gate; the server decides again). */
  readonly canWrite: boolean;
  /** null while the session is still being checked. */
  readonly signedIn: boolean | null;
  readonly initialDraft?: string;
  readonly initialParentId?: string | null;
}): JSX.Element {
  const t = getDictionary(language).homeR1.discussion;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [draft, setDraft] = useState(initialDraft ?? '');
  const [parentId, setParentId] = useState<string | null>(initialParentId ?? null);
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const keyRef = useRef<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const read = useCallback(async () => {
    setLoad({ kind: 'loading' });
    const out = await fetchThread(story.articleRef);
    if (out.ok) {
      setLoad({ kind: 'ready', thread: out.value });
      setCount(story.articleRef, out.value.count);
    } else setLoad(out.reason === 'OFF' ? { kind: 'off' } : { kind: 'failed' });
  }, [story.articleRef]);

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

  const goSignIn = (): void => {
    saveStoryTask({ kind: 'discuss', story, draft, parentId });
    window.location.assign(accountSignInUrl('/'));
  };

  const submit = async (): Promise<void> => {
    const body = draft.trim();
    if (body.length === 0 || posting) return;
    if (body.length > MAX) {
      setNotice({ tone: 'error', text: fill(t.tooLong, { n: String(MAX) }) });
      return;
    }
    if (signedIn === false) {
      setNeedsSignIn(true);
      return;
    }
    keyRef.current ??= newIdempotencyKey();
    setPosting(true);
    setNotice(null);
    const out = await postComment({ articleRef: story.articleRef, url: story.url, body, ...(parentId ? { parentId } : {}), idempotencyKey: keyRef.current });
    setPosting(false);
    if (out.ok) {
      setDraft('');
      setParentId(null);
      keyRef.current = null;
      await read();
      return;
    }
    if (out.reason === 'SIGNED_OUT') setNeedsSignIn(true);
    else if (out.reason === 'LOCKED') await read();
    setNotice({ tone: 'error', text: out.reason === 'RATE_LIMITED' ? t.rateLimited : t.postFailed });
  };

  const thread = load.kind === 'ready' ? load.thread : null;
  const locked = thread?.locked === true;
  const topLevel = thread?.comments.filter((c) => c.parentId === null) ?? [];
  const repliesOf = (id: string): CommentView[] => thread?.comments.filter((c) => c.parentId === id) ?? [];
  const versions = new Set(thread?.comments.filter((c) => c.state === 'VISIBLE').map((c) => c.briefVersion) ?? []);
  const showVersions = thread !== null && thread.briefVersion !== null && (versions.size > 1 || [...versions].some((v) => v !== thread.briefVersion));
  const href = safeExternalHref(story.url);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-[var(--gt-scrim)]" data-stage-b-discussion="" onClick={(e) => e.target === e.currentTarget && closePanel()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="stage-b-discussion-title"
        className="flex h-full w-full flex-col bg-[var(--gt-bg)] text-[var(--gt-ink)] shadow-[0_0_40px_rgba(0,0,0,0.25)] sm:max-w-[460px]"
      >
        <header className="flex items-start gap-3 border-b border-[var(--gt-line)] bg-[var(--gt-card)] p-4">
          <MessagesSquare aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-[var(--gt-mintInk)]" />
          <div className="min-w-0 flex-1">
            <h2 id="stage-b-discussion-title" className="font-display text-[18px] font-bold leading-tight">
              {t.title}
              {thread !== null && thread.count > 0 && (
                <span className="ml-2 text-[13px] font-semibold text-[var(--gt-ink2)]" data-discussion-count={thread.count}>
                  {pluralWithForms(thread.count, language, t.countForms)}
                </span>
              )}
            </h2>
            <p className="mt-1 line-clamp-2 text-[13px] text-[var(--gt-ink2)]">{story.title}</p>
            {/* The publisher link stays publisher navigation — a sibling, never the panel itself. */}
            <a href={href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-[32px] items-center gap-1 text-[12.5px] font-semibold text-[var(--gt-link)] hover:underline">
              {t.publisherLink}
              {story.sourceName ? ` · ${story.sourceName}` : ''}
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          </div>
          <button ref={closeRef} type="button" onClick={closePanel} aria-label={t.close} className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-[var(--gt-ink2)] hover:bg-[var(--gt-sunk)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="polite">
          {load.kind === 'loading' && <p role="status" className="text-[13px] text-[var(--gt-ink2)]">{t.loading}</p>}
          {load.kind === 'off' && <p role="status" className="text-[13px] text-[var(--gt-ink2)]">{t.readOnly}</p>}
          {load.kind === 'failed' && (
            <div role="alert" className="flex flex-col items-start gap-2 text-[13px]">
              <p>{t.failed}</p>
              <button type="button" onClick={() => void read()} className="min-h-[40px] rounded-full border border-[var(--gt-line)] px-4 font-semibold text-[var(--gt-link)]">
                {t.retry}
              </button>
            </div>
          )}
          {thread !== null && (
            <>
              {locked && (
                <p data-discussion-locked="" className="mb-3 flex items-start gap-2 rounded-[10px] border border-[var(--gt-amberBd)] bg-[var(--gt-amberBg)] p-3 text-[13px] text-[var(--gt-amberInk)]">
                  <Lock aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
                  {t.locked}
                </p>
              )}
              {showVersions && <p className="mb-3 rounded-[10px] border border-[var(--gt-line)] bg-[var(--gt-card)] p-3 text-[12.5px] text-[var(--gt-ink2)]">{t.updated}</p>}
              {topLevel.length === 0 ? (
                <div data-discussion-empty="" className="rounded-[12px] border border-dashed border-[var(--gt-line)] p-5 text-center">
                  <p className="font-semibold">{t.emptyTitle}</p>
                  <p className="mt-1 text-[13px] text-[var(--gt-ink2)]">{t.emptyBody}</p>
                </div>
              ) : (
                <ol className="flex flex-col gap-3">
                  {topLevel.map((c) => (
                    <li key={c.id}>
                      <Comment c={c} language={language} showVersion={showVersions} canAct={canWrite && !locked && signedIn === true} onReply={() => setParentId(c.id)} onChanged={read} onNotice={setNotice} />
                      {repliesOf(c.id).length > 0 && (
                        <ol className="ml-5 mt-2 flex flex-col gap-2 border-l-2 border-[var(--gt-line2)] pl-3">
                          {repliesOf(c.id).map((r) => (
                            <li key={r.id}>
                              <Comment c={r} language={language} showVersion={showVersions} canAct={canWrite && !locked && signedIn === true} onChanged={read} onNotice={setNotice} />
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
          <p className="mt-4 text-[11.5px] text-[var(--gt-ink3)]">{t.notEvidence}</p>
        </div>

        {thread !== null && !locked && canWrite && (
          <form
            className="border-t border-[var(--gt-line)] bg-[var(--gt-card)] p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {parentId !== null && (
              <p className="mb-2 flex items-center justify-between text-[12px] text-[var(--gt-ink2)]">
                <span>{t.replyingTo}</span>
                <button type="button" onClick={() => setParentId(null)} className="min-h-[32px] px-2 font-semibold text-[var(--gt-link)]">
                  {t.cancel}
                </button>
              </p>
            )}
            <label htmlFor="stage-b-composer" className="sr-only">
              {t.composerLabel}
            </label>
            <textarea
              id="stage-b-composer"
              value={draft}
              maxLength={MAX + 200}
              onChange={(e) => {
                setDraft(e.target.value);
                keyRef.current = null;
              }}
              placeholder={t.placeholder}
              rows={3}
              className="w-full resize-none rounded-[10px] border border-[var(--gt-line)] bg-[var(--gt-bg)] p-2.5 text-[14px] text-[var(--gt-ink)] placeholder:text-[var(--gt-ink3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
            />
            {notice !== null && (
              <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`mt-1 text-[12.5px] ${notice.tone === 'error' ? 'text-[var(--gt-danger)]' : 'text-[var(--gt-ink2)]'}`}>
                {notice.text}
              </p>
            )}
            {needsSignIn || signedIn === false ? (
              <div className="mt-2 flex flex-col gap-1.5">
                <button type="button" onClick={goSignIn} data-discussion-sign-in="" className="min-h-[44px] rounded-full bg-[var(--gt-act)] px-4 text-[14px] font-semibold text-white">
                  {t.signInToComment}
                </button>
                <p className="text-[12px] text-[var(--gt-ink2)]">{t.signInNote}</p>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11.5px] text-[var(--gt-ink3)]">{draft.length > 0 ? `${t.draftLabel} · ${draft.trim().length}/${MAX}` : ''}</span>
                <button type="submit" disabled={posting || draft.trim().length === 0 || signedIn === null} className="min-h-[44px] rounded-full bg-[var(--gt-act)] px-5 text-[14px] font-semibold text-white disabled:opacity-50">
                  {posting ? t.posting : t.post}
                </button>
              </div>
            )}
          </form>
        )}
        {thread !== null && (locked || !canWrite) && (
          <p className="border-t border-[var(--gt-line)] bg-[var(--gt-card)] p-3 text-[12.5px] text-[var(--gt-ink2)]">{locked ? t.lockedShort : t.readOnly}</p>
        )}
      </section>
    </div>
  );
}

function Comment({
  c,
  language,
  showVersion,
  canAct,
  onReply,
  onChanged,
  onNotice,
}: {
  readonly c: CommentView;
  readonly language: LanguageCode;
  readonly showVersion: boolean;
  readonly canAct: boolean;
  readonly onReply?: () => void;
  readonly onChanged: () => Promise<void>;
  readonly onNotice: (n: { tone: 'error' | 'info'; text: string } | null) => void;
}): JSX.Element {
  const t = getDictionary(language).homeR1.discussion;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.body ?? '');
  const [reporting, setReporting] = useState(false);
  const visible = c.state === 'VISIBLE' && c.body !== null;
  const author = c.mine ? t.you : c.authorLabel ?? t.reader;
  const placeholder = c.state === 'HIDDEN' ? t.hidden : c.state === 'REMOVED' ? t.removed : t.deleted;

  return (
    <article data-comment-state={c.state} data-comment-mine={c.mine ? '' : undefined} className="rounded-[12px] border border-[var(--gt-line)] bg-[var(--gt-card)] p-3">
      {visible ? (
        <>
          <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--gt-ink2)]">
            <span className="font-semibold text-[var(--gt-ink)]">{author}</span>
            <span>{formatRelativeTime(c.createdAt, language)}</span>
            {c.editedAt && <span>· {t.edited}</span>}
            {showVersion && <span className="rounded-[5px] bg-[var(--gt-sunk)] px-1.5 font-mono text-[10.5px]">{fill(t.briefVersion, { n: String(c.briefVersion) })}</span>}
          </p>
          {editing ? (
            <form
              className="mt-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const out = await editComment(c.id, text);
                if (out.ok) {
                  setEditing(false);
                  await onChanged();
                } else onNotice({ tone: 'error', text: t.postFailed });
              }}
            >
              <label className="sr-only" htmlFor={`edit-${c.id}`}>
                {t.composerLabel}
              </label>
              <textarea id={`edit-${c.id}`} value={text} maxLength={2200} onChange={(e) => setText(e.target.value)} rows={3} className="w-full rounded-[8px] border border-[var(--gt-line)] bg-[var(--gt-bg)] p-2 text-[14px]" />
              <div className="mt-1 flex gap-2">
                <button type="submit" className="min-h-[40px] rounded-full bg-[var(--gt-act)] px-4 text-[13px] font-semibold text-white">
                  {t.save}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="min-h-[40px] px-3 text-[13px] font-semibold text-[var(--gt-link)]">
                  {t.cancel}
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-snug">{c.body}</p>
          )}
          {canAct && !editing && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {onReply && (
                <Action icon={Reply} label={t.reply} onClick={onReply} />
              )}
              {c.mine ? (
                <>
                  <Action icon={Pencil} label={t.edit} onClick={() => setEditing(true)} />
                  <Action
                    icon={Trash2}
                    label={t.del}
                    onClick={async () => {
                      if (!window.confirm(t.confirmDelete)) return;
                      const out = await deleteComment(c.id);
                      if (out.ok) await onChanged();
                      else onNotice({ tone: 'error', text: t.postFailed });
                    }}
                  />
                </>
              ) : (
                <Action icon={Flag} label={t.report} onClick={() => setReporting((v) => !v)} />
              )}
            </div>
          )}
          {reporting && (
            <fieldset className="mt-2 rounded-[8px] border border-[var(--gt-line)] p-2">
              <legend className="px-1 text-[12px] font-semibold">{t.reportTitle}</legend>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(t.reasons).map(([reason, label]) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={async () => {
                      const out = await reportComment(c.id, reason);
                      setReporting(false);
                      onNotice(out.ok ? { tone: 'info', text: t.reportSent } : { tone: 'error', text: t.failed });
                    }}
                    className="min-h-[36px] rounded-full border border-[var(--gt-line)] px-3 text-[12.5px]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </>
      ) : (
        <p className="text-[13px] italic text-[var(--gt-ink3)]">{placeholder}</p>
      )}
    </article>
  );
}

function Action({ icon: Icon, label, onClick }: { readonly icon: typeof Reply; readonly label: string; readonly onClick: () => void }): JSX.Element {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-2.5 text-[12.5px] font-semibold text-[var(--gt-ink2)] hover:bg-[var(--gt-sunk)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]">
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
