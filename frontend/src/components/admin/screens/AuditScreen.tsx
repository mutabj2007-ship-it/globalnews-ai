'use client';

import { useAdminContext } from '../shell/AdminContext';
import { AdminPanel } from '../primitives/AdminPanel';
import { AdminFilterBar } from '../primitives/AdminFilterBar';
import { ScreenHeading } from './SystemHealthScreen';

/**
 * ADMIN-08 — Audit logs & admin security.
 *
 * THE COPY ON THIS SCREEN IS THE POINT. The approved contract says an
 * empty audit view must never be presented as "no records", because a
 * reader who cannot tell "nothing happened" from "we are not recording"
 * has been actively misled about a security control.
 *
 * There is no append-only audit store in this platform. So this screen
 * says exactly that — not "no results", not "no events match your
 * filters" — and then shows the fifteen action classes as the contract
 * for when one is built.
 *
 * F1.b ships no mutating admin action of any kind, which is why the
 * absence of the store is not yet a live gap. The moment the first admin
 * action lands, the store becomes a prerequisite in the same milestone,
 * not a follow-up to it.
 */
const ACTION_CLASSES = [
  'admin.login',
  'admin.login.failed',
  'role.changed',
  'account.disabled',
  'content.action',
  'support.ticket.action',
  'support.note.added',
  'system.config.changed',
  'provider.config.changed',
  'payment.action',
  'invoice.action',
  'ksef.submit',
  'ksef.result',
  'tax.setting.changed',
  'export.generated',
];

const RECORD_FIELDS = [
  'eventId',
  'timestamp',
  'actor',
  'actorType',
  'action',
  'resource',
  'resourceId',
  'result',
  'correlationId',
  'context',
  'before',
  'after',
  'session',
  'ip',
];

export function AuditScreen(): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.audit;

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={screen.title} purpose={screen.purpose} />

      <div className="rounded-lg border border-adm-chip-bad-edge bg-adm-chip-bad-bg px-3.5 py-3">
        <p className="text-[12px] font-semibold text-adm-chip-bad-ink">{screen.noStoreTitle}</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-adm-chip-bad-ink">
          {screen.noStoreBody}
        </p>
      </div>

      <AdminFilterBar labels={[screen.title, t.states.correlationId, screen.actionClassesTitle]} />

      <div className="grid grid-cols-1 gap-4 adm-full:grid-cols-2">
        <AdminPanel title={screen.actionClassesTitle} field="admin-08.auditStore">
          <ul className="flex flex-wrap gap-1.5">
            {ACTION_CLASSES.map((actionClass) => (
              <li
                key={actionClass}
                className="rounded-full border border-adm-edge bg-adm-card px-2.5 py-1 font-cd-mono text-[10px] text-adm-ink-mute"
              >
                {actionClass}
              </li>
            ))}
          </ul>
        </AdminPanel>

        <AdminPanel
          title={screen.recordShapeTitle}
          field="admin-08.beforeAfter"
          note={screen.separationNote}
        >
          <ul className="flex flex-wrap gap-1.5">
            {RECORD_FIELDS.map((field) => (
              <li
                key={field}
                className="rounded-full border border-adm-edge bg-adm-card px-2.5 py-1 font-cd-mono text-[10px] text-adm-ink-mute"
              >
                {field}
              </li>
            ))}
          </ul>
        </AdminPanel>
      </div>

      <p className="text-[11px] leading-relaxed text-adm-ink-dim">{screen.readOnlyNote}</p>
    </div>
  );
}
