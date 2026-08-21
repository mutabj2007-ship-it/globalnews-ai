'use client';

import { useAdminContext } from '../shell/AdminContext';
import { AdminPanel } from '../primitives/AdminPanel';
import { AdminFilterBar } from '../primitives/AdminFilterBar';
import { PlaceholderPanel } from '../primitives/PlaceholderPanel';
import { ScreenHeading } from './SystemHealthScreen';

/**
 * ADMIN-05 — Feedback & support. STRUCTURE ONLY.
 *
 * There is no ticket model, no message model and no outbound messaging
 * capability anywhere in the backend, so the queue is empty of records
 * rather than filled with invented ones. No ticket reference, no user
 * address and no correspondence appears in this file.
 *
 * THE ONE THING THIS SCREEN COMMITS TO NOW is the separation the design
 * insists on: a user-visible reply and an internal note are two
 * different things, rendered differently, labelled differently, and
 * announced differently to a screen reader. When the backend arrives,
 * `visibility` will be a stored, server-filtered column — never a
 * display convention — and the composers are laid out here so that
 * distinction is designed in from the start rather than retrofitted.
 */
export function SupportScreen(): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.support;

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={screen.title} purpose={screen.purpose} />

      <div className="rounded-lg border border-adm-chip-warn-edge bg-adm-chip-warn-bg px-3.5 py-3">
        <p className="text-[11px] leading-relaxed text-adm-chip-warn-ink">
          {screen.notImplementedBody}
        </p>
      </div>

      <AdminFilterBar labels={[screen.queueTitle, screen.threadTitle, screen.requestTypesTitle]} />

      <div className="grid grid-cols-1 gap-4 adm-full:grid-cols-3">
        <div className="adm-full:col-span-1">
          <PlaceholderPanel
            title={screen.queueTitle}
            purpose={screen.purpose}
            requirement={screen.notImplementedBody}
            field="admin-05.tickets"
            ratio="min-h-[220px]"
          />
        </div>

        <div className="flex flex-col gap-4 adm-full:col-span-2">
          <PlaceholderPanel
            title={screen.threadTitle}
            purpose={screen.purpose}
            requirement={screen.notImplementedBody}
            field="admin-05.userReplies"
            ratio="min-h-[160px]"
          />

          <AdminPanel
            title={screen.replyComposer}
            field="admin-05.userReplies"
            note={screen.visibilityNote}
          >
            <div className="rounded-lg border border-adm-chip-info-edge bg-adm-chip-info-bg/40 px-3 py-2.5">
              <p className="font-cd-mono text-[9px] uppercase tracking-[0.12em] text-adm-chip-info-ink">
                {screen.visibilityUser}
              </p>
              <p className="mt-1.5 text-[11px] text-adm-ink-dim">{t.states.notImplementedNote}</p>
            </div>
          </AdminPanel>

          <AdminPanel title={screen.noteComposer} field="admin-05.internalNotes">
            <div className="ml-[22px] rounded-lg border border-adm-chip-violet-edge border-l-[3px] border-l-adm-chip-violet-ink bg-adm-chip-violet-bg/50 px-3 py-2.5">
              <p className="font-cd-mono text-[9px] uppercase tracking-[0.12em] text-adm-chip-violet-ink">
                {screen.visibilityInternal}
              </p>
              <p className="mt-1.5 text-[11px] text-adm-ink-dim">{t.states.notImplementedNote}</p>
            </div>
          </AdminPanel>
        </div>
      </div>
    </div>
  );
}
