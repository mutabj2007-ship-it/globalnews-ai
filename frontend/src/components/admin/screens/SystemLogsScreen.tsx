'use client';

import { useAdminContext } from '../shell/AdminContext';
import { AdminPanel } from '../primitives/AdminPanel';
import { AdminFilterBar } from '../primitives/AdminFilterBar';
import { PlaceholderPanel } from '../primitives/PlaceholderPanel';
import { ScreenHeading } from './SystemHealthScreen';

/**
 * ADMIN-07 — System logs.
 *
 * The diagnostic half of this platform's observability is genuinely
 * good: every request carries an X-Request-Id established by middleware
 * that runs before routing, and the access logger writes correlated
 * lines. What does not exist is a STORE — those lines go to process
 * output, which cannot be searched, filtered or paged.
 *
 * So the log stream is NOT IMPLEMENTED, and the panel says which half is
 * missing rather than implying the whole capability is absent. The
 * correlation id is called out separately because it is the join key the
 * audit contract depends on, and it is real today.
 */
export function SystemLogsScreen(): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.systemLogs;

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={screen.title} purpose={screen.purpose} />

      <AdminFilterBar
        labels={[screen.title, t.states.correlationId, t.screens.systemHealth.componentsTitle]}
      />

      <PlaceholderPanel
        title={screen.title}
        purpose={screen.purpose}
        requirement={screen.requirement}
        field="admin-07.logStream"
        ratio="min-h-[220px]"
      />

      <AdminPanel title={t.states.correlationId} field="admin-08.correlationId">
        <p className="text-[11px] leading-relaxed text-adm-ink-4">{screen.correlationNote}</p>
      </AdminPanel>
    </div>
  );
}
