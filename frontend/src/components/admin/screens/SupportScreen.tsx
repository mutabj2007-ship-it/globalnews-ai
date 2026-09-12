'use client';

import { useCallback, useState } from 'react';
import { useAdminContext } from '../shell/AdminContext';
import { useAdminResource } from '@/lib/admin/useAdminResource';
import { useAdminMutation } from '@/lib/admin/useAdminMutation';
import { ADMIN_SUPPORT_API } from '@/lib/admin/adminRoutes';
import { SUPPORT_TICKET_STATUSES } from '@/lib/admin/adminApiTypes';
import type {
  AdminSupportMessageView,
  AdminSupportQueueResponse,
  AdminSupportTicketDetail,
  AdminSupportTicketSummary,
  SupportMessageVisibility,
  SupportTicketStatus,
} from '@/lib/admin/adminApiTypes';
import { AdminPanel } from '../primitives/AdminPanel';
import { AdminDataTable, type AdminColumn } from '../primitives/AdminDataTable';
import { StatusChip, type ChipTone } from '../primitives/StatusChip';
import { PlaceholderPanel } from '../primitives/PlaceholderPanel';
import { ScreenHeading } from './SystemHealthScreen';

/**
 * ADMIN-05 — Feedback & support. THE SUPPORT QUEUE, WITH REAL DATA.
 *
 * F1.b shipped this screen as structure with the queue, the thread and
 * both composers laid out but inert, because no ticket model existed.
 * S1 built the models, S2 built the user API, and S3 builds this: the
 * queue reads real tickets, the thread reads a real conversation, and
 * both composers post real messages.
 *
 * THE ONE THING F1.b COMMITTED TO IS PRESERVED, NOT REBUILT. A
 * user-visible reply and an internal note are still two different
 * things, rendered differently, labelled differently and announced
 * differently to a screen reader. What changed is that the distinction
 * is now backed by a stored, server-filtered `visibility` column rather
 * than by this file's layout. THE RENDERING IS NOT THE PROTECTION: an
 * internal note never reaches the requester because their query filters
 * it at the database, and this screen could not disclose one to them
 * even if every style below were deleted.
 *
 * THE REQUESTER IS A TICKET REFERENCE (CTO decision, S3). No email
 * address, display name or account identifier appears on this screen,
 * because none appears in the response — the admin API does not select
 * the column. The queue cannot be used as a user directory.
 *
 * TWO PANELS STAY PLACEHOLDERS, AND MUST. Ticket audit history and SLA
 * both remain provenance tag C: there is no audit store and no SLA
 * model in this platform. Rendering a plausible timeline from message
 * timestamps, or a "target" from nothing, would be exactly the
 * invention this codebase's provenance contract exists to prevent.
 */
const STATUS_TONE: Record<SupportTicketStatus, ChipTone> = {
  OPEN: 'info',
  AWAITING_USER: 'warn',
  AWAITING_ADMIN: 'bad',
  RESOLVED: 'good',
};

export function SupportScreen(): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.support;

  const [statusFilter, setStatusFilter] = useState<SupportTicketStatus | ''>('');
  const [selected, setSelected] = useState<string | null>(null);

  const queuePath =
    statusFilter === ''
      ? ADMIN_SUPPORT_API.tickets
      : `${ADMIN_SUPPORT_API.tickets}?status=${statusFilter}`;

  const queue = useAdminResource<AdminSupportQueueResponse>(queuePath);

  const columns: ReadonlyArray<AdminColumn<AdminSupportTicketSummary>> = [
    {
      id: 'reference',
      header: screen.columns.reference,
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelected(row.reference)}
          aria-label={`${screen.openTicket} ${row.reference}`}
          className="font-cd-mono text-[11px] text-adm-accent-hi underline-offset-2 hover:underline"
        >
          {row.reference}
        </button>
      ),
    },
    {
      id: 'subject',
      header: screen.columns.subject,
      render: (row) => <span className="text-adm-ink">{row.subject}</span>,
    },
    {
      id: 'category',
      header: screen.columns.category,
      secondary: true,
      render: (row) => <StatusChip label={screen.categories[row.category]} tone="mute" />,
    },
    {
      id: 'status',
      header: screen.columns.status,
      render: (row) => (
        <StatusChip label={screen.statuses[row.status]} tone={STATUS_TONE[row.status]} />
      ),
    },
    {
      id: 'replies',
      header: screen.columns.replies,
      align: 'right',
      secondary: true,
      render: (row) => <span>{row.publicMessageCount}</span>,
    },
    {
      id: 'notes',
      header: screen.columns.notes,
      align: 'right',
      secondary: true,
      render: (row) => <span>{row.internalNoteCount}</span>,
    },
    {
      id: 'updated',
      header: screen.columns.updated,
      secondary: true,
      render: (row) => (
        <span className="font-cd-mono text-[10px] text-adm-ink-mute">{row.updatedAt}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={screen.title} purpose={screen.purpose} />

      <p className="rounded-lg border border-adm-edge bg-adm-card-soft px-3.5 py-2.5 text-[11px] leading-relaxed text-adm-ink-dim">
        {screen.identityNote}
      </p>

      <div className="grid grid-cols-1 gap-4 adm-full:grid-cols-3">
        <div className="adm-full:col-span-1">
          <AdminPanel
            title={screen.queueTitle}
            field="admin-05.tickets"
            actions={
              <label className="flex items-center gap-2">
                <span className="sr-only">{screen.filterLabel}</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as SupportTicketStatus | '')
                  }
                  className="rounded-lg border border-adm-edge-input bg-adm-card px-2.5 py-1 font-cd-mono text-[10px] uppercase tracking-[0.1em] text-adm-ink-3"
                >
                  <option value="">{screen.filterAll}</option>
                  {SUPPORT_TICKET_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {screen.statuses[status]}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            <AdminDataTable<AdminSupportTicketSummary>
              caption={screen.queueTitle}
              columns={columns}
              rows={queue.data?.tickets ?? []}
              state={queue.state}
              emptyTitle={queue.state === 'error' ? screen.queueErrorTitle : screen.queueEmptyTitle}
              emptyBody={queue.state === 'error' ? screen.queueErrorBody : screen.queueEmptyBody}
              rowKey={(row) => row.reference}
            />
          </AdminPanel>
        </div>

        <div className="flex flex-col gap-4 adm-full:col-span-2">
          {selected === null ? (
            <AdminPanel title={screen.threadTitle} field="admin-05.userReplies">
              <p className="text-[11px] leading-relaxed text-adm-ink-dim">{screen.selectPrompt}</p>
            </AdminPanel>
          ) : (
            <TicketThread reference={selected} onChanged={queue.reload} />
          )}

          <PlaceholderPanel
            title={screen.auditTitle}
            purpose={screen.purpose}
            requirement={screen.auditRequirement}
            field="admin-05.ticketAudit"
            ratio="min-h-[100px]"
          />

          <PlaceholderPanel
            title={screen.slaTitle}
            purpose={screen.purpose}
            requirement={screen.slaRequirement}
            field="admin-05.sla"
            ratio="min-h-[100px]"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * One ticket: its conversation, both composers and the status controls.
 *
 * Keyed by `reference` from the caller, so selecting a different ticket
 * REMOUNTS this component. That is deliberate: a half-typed reply must
 * never survive a change of ticket and be sent to the wrong person.
 */
function TicketThread({
  reference,
  onChanged,
}: {
  reference: string;
  onChanged: () => void;
}): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.support;

  const ticket = useAdminResource<AdminSupportTicketDetail>(ADMIN_SUPPORT_API.ticket(reference));
  const status = useAdminMutation<{ status: 'RESOLVED' | 'AWAITING_ADMIN' }>(
    ADMIN_SUPPORT_API.status(reference),
  );

  const refresh = useCallback(() => {
    ticket.reload();
    onChanged();
  }, [ticket, onChanged]);

  const setStatus = useCallback(
    async (next: 'RESOLVED' | 'AWAITING_ADMIN') => {
      if (await status.submit({ status: next })) refresh();
    },
    [status, refresh],
  );

  const detail = ticket.data;

  return (
    <>
      <AdminPanel
        title={screen.threadTitle}
        field="admin-05.userReplies"
        note={screen.visibilityNote}
        actions={
          detail === null || detail === undefined ? undefined : (
            <>
              <span className="sr-only">{screen.statusTitle}</span>
              <StatusChip
                label={screen.statuses[detail.status]}
                tone={STATUS_TONE[detail.status]}
              />
              <button
                type="button"
                disabled={status.pending}
                onClick={() => void setStatus('RESOLVED')}
                className="rounded-lg border border-adm-edge-input px-2.5 py-1 text-[11px] text-adm-accent-hi hover:border-adm-accent/60 disabled:opacity-50"
              >
                {screen.resolve}
              </button>
              <button
                type="button"
                disabled={status.pending}
                onClick={() => void setStatus('AWAITING_ADMIN')}
                className="rounded-lg border border-adm-edge-input px-2.5 py-1 text-[11px] text-adm-ink-3 hover:border-adm-accent/60 disabled:opacity-50"
              >
                {screen.reopen}
              </button>
              {/*
                SUPPORT CLOSURE (G4) — placed AT the control, not in a help page
                nobody opens. Resolving closes a REQUEST; it certifies no repair.
                The operator reads this in the moment they are about to assert it.
              */}
              <p className="w-full text-[11px] leading-relaxed text-adm-ink-dim">
                {screen.resolveMeaning}
              </p>
            </>
          )
        }
      >
        <p className="font-cd-mono text-[10px] uppercase tracking-[0.12em] text-adm-ink-faint">
          {reference}
        </p>

        {ticket.state === 'error' && (
          <p role="alert" className="text-[11px] leading-relaxed text-adm-val-bad">
            {screen.threadErrorBody}
          </p>
        )}

        {status.state === 'error' && (
          <p role="alert" className="text-[11px] leading-relaxed text-adm-val-bad">
            {screen.statusFailed}
          </p>
        )}

        {detail !== null && detail !== undefined && (
          <ol className="flex flex-col gap-2.5">
            {detail.messages.map((message) => (
              <li key={message.id}>
                <Message message={message} />
              </li>
            ))}
          </ol>
        )}
      </AdminPanel>

      <Composer
        title={screen.replyComposer}
        field="admin-05.userReplies"
        visibility="PUBLIC"
        reference={reference}
        placeholder={screen.replyPlaceholder}
        submitLabel={screen.sendReply}
        consequence={screen.replyConsequence}
        onSent={refresh}
      />

      <Composer
        title={screen.noteComposer}
        field="admin-05.internalNotes"
        visibility="INTERNAL"
        reference={reference}
        placeholder={screen.notePlaceholder}
        submitLabel={screen.saveNote}
        consequence={screen.noteConsequence}
        onSent={refresh}
      />
    </>
  );
}

/**
 * One message.
 *
 * An INTERNAL note carries the violet left rule, the indent and the
 * explicit "not visible to the user" label the approved design uses; a
 * PUBLIC message carries the info treatment and says it is visible.
 * COLOUR IS NEVER THE ONLY SIGNAL — both states are labelled in text,
 * and the label is what a screen reader announces.
 *
 * The branch reads the STORED `visibility` value from the response. It
 * is a faithful report of what the database holds, not a rule that
 * decides who sees what; that decision was made server-side before this
 * component existed.
 */
function Message({ message }: { message: AdminSupportMessageView }): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.support;
  const internal = message.visibility === 'INTERNAL';

  return (
    <div
      className={
        internal
          ? 'ml-[22px] rounded-lg border border-adm-chip-violet-edge border-l-[3px] border-l-adm-chip-violet-ink bg-adm-chip-violet-bg/50 px-3 py-2.5'
          : 'rounded-lg border border-adm-chip-info-edge bg-adm-chip-info-bg/40 px-3 py-2.5'
      }
    >
      <p
        className={`font-cd-mono text-[9px] uppercase tracking-[0.12em] ${
          internal ? 'text-adm-chip-violet-ink' : 'text-adm-chip-info-ink'
        }`}
      >
        {screen.authors[message.authorType]} —{' '}
        {internal ? screen.visibilityInternal : screen.visibilityUser}
      </p>
      <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-adm-ink-2">
        {message.body}
      </p>
      <p className="mt-1.5 font-cd-mono text-[9px] text-adm-ink-faint">{message.createdAt}</p>
    </div>
  );
}

/**
 * A composer.
 *
 * `visibility` IS A PROP, NOT A CONTROL. Each composer is constructed
 * for exactly one audience and sends that value on every request; there
 * is no toggle, no default and no code path in which an internal note
 * could be posted as PUBLIC because a control was left in the wrong
 * position. The backend requires the field and rejects a body without
 * it, so the two ends agree that visibility is always stated.
 *
 * The textarea is cleared ONLY after a 2xx. A failed request leaves the
 * administrator's text exactly where it was and says nothing was sent.
 */
function Composer({
  title,
  field,
  visibility,
  reference,
  placeholder,
  submitLabel,
  consequence,
  onSent,
}: {
  title: string;
  field: 'admin-05.userReplies' | 'admin-05.internalNotes';
  visibility: SupportMessageVisibility;
  reference: string;
  placeholder: string;
  submitLabel: string;
  consequence: string;
  onSent: () => void;
}): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.support;
  const [body, setBody] = useState('');

  const mutation = useAdminMutation<{ visibility: SupportMessageVisibility; message: string }>(
    ADMIN_SUPPORT_API.messages(reference),
  );

  const internal = visibility === 'INTERNAL';

  const send = useCallback(async () => {
    const message = body.trim();
    if (message.length === 0) return;

    if (await mutation.submit({ visibility, message })) {
      setBody('');
      onSent();
    }
  }, [body, mutation, visibility, onSent]);

  return (
    <AdminPanel title={title} field={field} note={consequence}>
      <div
        className={
          internal
            ? 'ml-[22px] rounded-lg border border-adm-chip-violet-edge border-l-[3px] border-l-adm-chip-violet-ink bg-adm-chip-violet-bg/50 px-3 py-2.5'
            : 'rounded-lg border border-adm-chip-info-edge bg-adm-chip-info-bg/40 px-3 py-2.5'
        }
      >
        <p
          className={`font-cd-mono text-[9px] uppercase tracking-[0.12em] ${
            internal ? 'text-adm-chip-violet-ink' : 'text-adm-chip-info-ink'
          }`}
        >
          {internal ? screen.visibilityInternal : screen.visibilityUser}
        </p>

        <label className="mt-2 block">
          <span className="sr-only">{screen.messageLabel}</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full rounded-lg border border-adm-edge-input bg-adm-card px-2.5 py-2 text-[11px] leading-relaxed text-adm-ink-2 placeholder:text-adm-ink-ghost"
          />
        </label>

        {mutation.state === 'error' && (
          <p role="alert" className="mt-1.5 text-[11px] leading-relaxed text-adm-val-bad">
            {screen.submitFailed}
          </p>
        )}

        <button
          type="button"
          disabled={mutation.pending || body.trim().length === 0}
          onClick={() => void send()}
          className="mt-2 rounded-lg border border-adm-edge-input px-2.5 py-1 text-[11px] text-adm-accent-hi hover:border-adm-accent/60 disabled:opacity-50"
        >
          {mutation.pending ? screen.sending : submitLabel}
        </button>
      </div>
    </AdminPanel>
  );
}
