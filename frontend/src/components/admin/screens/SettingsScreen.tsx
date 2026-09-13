'use client';

import { useAdminContext } from '../shell/AdminContext';
import { AdminPanel } from '../primitives/AdminPanel';
import { PlaceholderPanel } from '../primitives/PlaceholderPanel';
import { ScreenHeading } from './SystemHealthScreen';

/**
 * SETTINGS — the one screen with a genuinely true group.
 *
 * Localisation states presentation-layer facts that are real: the admin
 * surface ships in English and Polish, dates render DD.MM.YYYY, numbers
 * render `1 234,56`, the working timezone is Europe/Warsaw. Those are
 * not measurements, so they are safe to display.
 *
 * Every other group needs a runtime settings store, and this platform has
 * none — configuration is read from the environment at start-up. Nothing
 * here is editable, and per CTO decision no mutation exists yet.
 *
 * NO SECRET IS DISPLAYED. The API keys, OAuth secrets and connection
 * string live in the environment and are deliberately absent from this
 * screen. Whether any of them may ever be surfaced through a browser is
 * an open decision, and the default answer stated here is "none".
 */
export function SettingsScreen(): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.settings;

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={screen.title} purpose={screen.purpose} />

      <AdminPanel
        title={screen.groups.localisation}
        field="settings.localisation"
        note={screen.secretsNote}
      >
        <dl className="grid grid-cols-1 gap-2 adm-rail:grid-cols-2">
          <SettingRow
            label={screen.localisation.adminLanguages}
            value={screen.localisation.adminLanguagesValue}
          />
          <SettingRow label={screen.localisation.dateFormat} value="DD.MM.YYYY" />
          <SettingRow label={screen.localisation.numberFormat} value="1 234,56" />
          <SettingRow label={screen.localisation.timezone} value="Europe/Warsaw" />
        </dl>
      </AdminPanel>

      <div className="grid grid-cols-1 gap-4 adm-rail:grid-cols-2">
        <PlaceholderPanel
          title={screen.groups.taxInvoicing}
          purpose={screen.purpose}
          requirement={screen.requirement}
          field="settings.taxInvoicing"
          ratio="min-h-[140px]"
        />
        <PlaceholderPanel
          title={screen.groups.ksef}
          purpose={screen.purpose}
          requirement={screen.requirement}
          field="settings.ksef"
          ratio="min-h-[140px]"
        />
        <PlaceholderPanel
          title={screen.groups.providers}
          purpose={screen.purpose}
          requirement={screen.requirement}
          field="settings.providers"
          ratio="min-h-[140px]"
        />
        <PlaceholderPanel
          title={screen.groups.access}
          purpose={screen.purpose}
          requirement={screen.requirement}
          field="settings.access"
          ratio="min-h-[140px]"
        />
        <PlaceholderPanel
          title={screen.groups.retention}
          purpose={screen.purpose}
          requirement={screen.requirement}
          field="settings.retention"
          ratio="min-h-[140px]"
        />
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-adm-edge px-3 py-2.5">
      <dt className="text-[11px] text-adm-ink-dim">{label}</dt>
      <dd className="font-cd-mono text-[11px] text-adm-ink-2">{value}</dd>
    </div>
  );
}
