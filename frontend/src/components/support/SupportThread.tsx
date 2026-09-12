'use client';

import { useState } from 'react';
import type { SupportTicketDetail } from '@globalnews-ai/shared';
import type { SupportDictionary } from '@/lib/i18n/dictionaries/supportEn';
import { SUPPORT_API, SUPPORT_INPUT_BOUNDS } from '@/lib/support/supportRoutes';
import { useSupportMutation, useSupportResource } from '@/lib/support/useSupportApi';

/**
 * S4 — one of the caller's own requests, and the conversation on it.
 *
 * WHAT THIS SCREEN CANNOT SHOW, BY CONSTRUCTION RATHER THAN BY DISCIPLINE.
 * The response type is `SupportTicketDetail`, whose `messages` are
 * `SupportMessageView` — a shape with no `visibility` field at all. Internal
 * admin notes are excluded in the backend's SQL `WHERE` clause, so they are
 * never loaded, and even if one somehow were, this type has no field it could
 * be rendered through. Two audiences, two declarations, one compile error the
 * moment they are confused.
 *
 * AUTHORSHIP IS ALWAYS VISIBLE. `USER`, `ADMIN` and `SYSTEM_AI` render
 * distinctly, and the SYSTEM_AI branch exists even though nothing writes that
 * value today. It is built and unexercised deliberately: the moment machine
 * output can appear in a ticket, it must already be labelled as machine
 * output, not be labelled later once somebody notices.
 *
 * STATUS IS DISPLAYED AND NEVER SUBMITTED. There is no control here that sets
 * a status, because no user route accepts one. Replying to a resolved request
 * reopens it, and that is a server-side consequence of the reply — which is
 * why the notice below says so plainly rather than offering a "reopen" button
 * that would imply a field exists.
 */
export function SupportThread({
  t,
  reference,
  onBack,
}: {
  t: SupportDictionary;
  reference: string;
  onBack: () => void;
}): JSX.Element {
  const ticket = useSupportResource<SupportTicketDetail>(SUPPORT_API.ticket(reference));
  const mutation = useSupportMutation<{ message: string }>(SUPPORT_API.messages(reference));
  const [reply, setReply] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmedReply = reply.trim();
  const replyTooShort = trimmedReply.length < SUPPORT_INPUT_BOUNDS.reply.min;

  async function handleReply(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setTouched(true);
    if (replyTooShort || mutation.pending) return;

    const sent = await mutation.submit({ message: trimmedReply });

    // Cleared ONLY on a true result, and the thread is re-read only then too.
    if (sent) {
      setReply('');
      setTouched(false);
      ticket.reload();
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-sm text-ink-secondary hover:text-ink-primary"
      >
        ← {t.thread.back}
      </button>

      {ticket.state === 'loading' && <p className="text-ink-secondary">{t.thread.loading}</p>}

      {ticket.state === 'error' && (
        <div role="alert" className="rounded-lg border border-red-500/40 p-5">
          <p className="font-semibold text-red-300">{t.thread.errorTitle}</p>
          <p className="mt-1 text-sm text-ink-secondary">{t.thread.errorBody}</p>
          <button
            type="button"
            onClick={ticket.reload}
            className="mt-3 rounded-full border border-cyan-500/25 px-4 py-1.5 text-sm text-ink-secondary hover:border-cyan-400/60"
          >
            {t.list.retry}
          </button>
        </div>
      )}

      {ticket.state === 'real' && ticket.data && (
        <>
          <header className="flex flex-col gap-1.5 rounded-lg border border-cyan-500/15 p-5">
            <h1 className="text-xl font-semibold text-ink-primary">{ticket.data.subject}</h1>
            <p className="text-sm text-ink-secondary">
              {t.thread.reference}: <span className="font-mono">{ticket.data.reference}</span>
            </p>
            <p className="text-sm text-ink-secondary">
              {t.categories[ticket.data.category]} · {t.statuses[ticket.data.status]}
            </p>
          </header>

          <ol className="flex flex-col gap-3">
            {ticket.data.messages.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-cyan-500/15 p-4">
                <p className="text-xs uppercase tracking-wide text-ink-secondary">
                  {t.authors[entry.authorType]}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-ink-primary">{entry.body}</p>
                <p className="mt-2 text-xs text-ink-secondary">{entry.createdAt}</p>
              </li>
            ))}
          </ol>

          {ticket.data.status === 'RESOLVED' && (
            <p className="text-sm text-ink-secondary">{t.thread.resolvedNotice}</p>
          )}

          <form
            onSubmit={(event) => void handleReply(event)}
            className="flex flex-col gap-3 rounded-lg border border-cyan-500/15 p-5"
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-secondary">{t.thread.replyLabel}</span>
              <textarea
                value={reply}
                rows={5}
                maxLength={SUPPORT_INPUT_BOUNDS.reply.max}
                placeholder={t.thread.replyPlaceholder}
                onChange={(event) => setReply(event.target.value)}
                className="rounded border border-cyan-500/20 bg-transparent px-3 py-2 text-ink-primary"
              />
              {touched && replyTooShort && (
                <span className="text-sm text-red-400">{t.thread.tooShortReply}</span>
              )}
            </label>

            {mutation.state === 'error' && (
              <div role="alert" className="rounded border border-red-500/40 px-3 py-2">
                <p className="text-sm font-semibold text-red-300">{t.errors.sendFailedTitle}</p>
                <p className="text-sm text-ink-secondary">{t.errors.sendFailedBody}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={mutation.pending}
              className="self-start rounded-full border border-cyan-500/40 px-4 py-1.5 text-sm text-ink-primary hover:border-cyan-400/70 disabled:opacity-50"
            >
              {mutation.pending ? t.thread.sending : t.thread.send}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
