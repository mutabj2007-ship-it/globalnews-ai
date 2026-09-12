'use client';

import { useId, useState } from 'react';
import {
  SUPPORT_CATEGORIES,
  type SupportCategory,
  type SupportTicketDetail,
} from '@globalnews-ai/shared';
import type { SupportDictionary } from '@/lib/i18n/dictionaries/supportEn';
import { SUPPORT_API, SUPPORT_INPUT_BOUNDS } from '@/lib/support/supportRoutes';
import { useSupportMutation } from '@/lib/support/useSupportApi';
import { CategorySelect } from './CategorySelect';

/**
 * S4 — open a support request.
 *
 * THE CATEGORY LIST IS NOT WRITTEN DOWN HERE. It is `SUPPORT_CATEGORIES` from
 * `@globalnews-ai/shared`, the same array the backend DTO validates against
 * with `@IsIn` and the same list the Prisma enum mirrors. A category added to
 * the vocabulary appears here automatically; a category removed from it stops
 * being offered. The LABELS are dictionary-keyed by the member name and typed
 * `Record<SupportCategory, string>`, so a new member without a label is a
 * compile error rather than a blank option in a select.
 *
 * THE LENGTH LIMITS MIRROR THE DTO AND ARE MEASURED ON THE TRIMMED VALUE,
 * because the server trims before it measures. The server stays the authority:
 * this only saves a round trip and produces a better message than a
 * validation-pipe array would.
 *
 * NO STATUS FIELD EXISTS ANYWHERE IN THIS FORM. A new ticket is OPEN because
 * the database says so, not because anything here asked for it.
 */
export function NewSupportRequestForm({
  t,
  language,
  onCreated,
  onCancel,
}: {
  t: SupportDictionary;
  /** The language the agent's stored reply is written in. */
  language: 'en' | 'pl';
  onCreated: (created: SupportTicketDetail) => void;
  onCancel: () => void;
}): JSX.Element {
  const [category, setCategory] = useState<SupportCategory | ''>('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);

  const fieldIds = useId();
  const categoryLabelId = `${fieldIds}-category-label`;
  const categoryErrorId = `${fieldIds}-category-error`;

  const mutation = useSupportMutation<
    {
      category: SupportCategory;
      subject: string;
      message: string;
      language: 'en' | 'pl';
    },
    SupportTicketDetail
  >(SUPPORT_API.tickets);

  const trimmedSubject = subject.trim();
  const trimmedMessage = message.trim();

  const categoryMissing = category === '';
  const subjectTooShort = trimmedSubject.length < SUPPORT_INPUT_BOUNDS.subject.min;
  const messageTooShort = trimmedMessage.length < SUPPORT_INPUT_BOUNDS.message.min;
  const canSubmit = !categoryMissing && !subjectTooShort && !messageTooShort && !mutation.pending;

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) return;

    const created = await mutation.submit({
      category: category as SupportCategory,
      subject: trimmedSubject,
      message: trimmedMessage,
      language,
    });

    // ONLY on a stored ticket. A response that came back is not a message that
    // was sent, and clearing these fields on anything less would destroy what
    // the person wrote while telling them it had gone through.
    if (created) {
      setCategory('');
      setSubject('');
      setMessage('');
      setTouched(false);
      // SUPPORT-AI-1 — the created THREAD is handed up, so the agent's stored
      // first response is on screen without a second request.
      onCreated(created);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex flex-col gap-4 rounded-lg border border-cyan-500/15 p-5"
    >
      <h2 className="text-lg font-semibold text-ink-primary">{t.form.heading}</h2>

      {/*
        R4 SUPPORT UX CLOSURE — NOT A NATIVE `<select>` ANY MORE.

        The category list still comes from SUPPORT_CATEGORIES and the labels
        are still dictionary-keyed; only the control that renders them changed.
        A native select's option popup is painted by the browser outside the
        page, from its LIGHT palette, and no class on the control reaches it —
        which is why the opened list was white in a dark product. See
        CategorySelect for why `color-scheme: dark`, already declared at
        `:root`, was not enough.

        The label is a <div> rather than a <label> because the control is a
        button, not a form element, and an implicit label would not name it.
        The name is carried explicitly by aria-labelledby.
      */}
      <div className="flex flex-col gap-1.5">
        <span id={categoryLabelId} className="text-sm text-ink-secondary">
          {t.form.categoryLabel}
        </span>
        <CategorySelect
          value={category}
          options={SUPPORT_CATEGORIES.map((member) => ({
            value: member,
            label: t.categories[member],
          }))}
          placeholder={t.form.categoryPlaceholder}
          label={t.form.categoryLabel}
          labelledBy={categoryLabelId}
          invalid={touched && categoryMissing}
          describedBy={touched && categoryMissing ? categoryErrorId : undefined}
          onChange={(next) => setCategory(next)}
        />
        {touched && categoryMissing && (
          <span id={categoryErrorId} className="text-sm text-red-400">
            {t.form.categoryRequired}
          </span>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-secondary">{t.form.subjectLabel}</span>
        <input
          type="text"
          value={subject}
          maxLength={SUPPORT_INPUT_BOUNDS.subject.max}
          placeholder={t.form.subjectPlaceholder}
          onChange={(event) => setSubject(event.target.value)}
          className="rounded border border-cyan-500/20 bg-transparent px-3 py-2 text-ink-primary"
        />
        {touched && subjectTooShort && (
          <span className="text-sm text-red-400">{t.form.tooShortSubject}</span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-secondary">{t.form.messageLabel}</span>
        <textarea
          value={message}
          rows={7}
          maxLength={SUPPORT_INPUT_BOUNDS.message.max}
          placeholder={t.form.messagePlaceholder}
          onChange={(event) => setMessage(event.target.value)}
          className="rounded border border-cyan-500/20 bg-transparent px-3 py-2 text-ink-primary"
        />
        <span className="text-xs text-ink-secondary">
          {SUPPORT_INPUT_BOUNDS.message.max - message.length} {t.form.charactersRemaining}
        </span>
        {touched && messageTooShort && (
          <span className="text-sm text-red-400">{t.form.tooShortMessage}</span>
        )}
      </label>

      {/*
        A TRANSIENT PROGRESS STATE, AND ONLY THAT. It is not persisted, never
        becomes a SupportMessage, and disappears when the request settles.

        R4 SUPPORT UX CLOSURE RETEXTED IT. It used to say the agent was
        looking at the request. Six of the seven categories now never reach
        the agent at all, so on those it would have been a claim about work
        nobody was doing — the same class of untruth as a stored "we are
        checking" acknowledgement, just briefer. It now says only what is
        true of every category: the request is being sent.
      */}
      {mutation.pending && (
        <p role="status" className="text-sm text-ink-secondary">
          {t.form.sendingNotice}
        </p>
      )}

      {mutation.state === 'error' && (
        <div role="alert" className="rounded border border-red-500/40 px-3 py-2">
          <p className="text-sm font-semibold text-red-300">{t.errors.sendFailedTitle}</p>
          <p className="text-sm text-ink-secondary">{t.errors.sendFailedBody}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={mutation.pending}
          className="rounded-full border border-cyan-500/40 px-4 py-1.5 text-sm text-ink-primary hover:border-cyan-400/70 disabled:opacity-50"
        >
          {mutation.pending ? t.form.submitting : t.form.submit}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-cyan-500/15 px-4 py-1.5 text-sm text-ink-secondary hover:border-cyan-400/40"
        >
          {t.form.cancel}
        </button>
      </div>
    </form>
  );
}
