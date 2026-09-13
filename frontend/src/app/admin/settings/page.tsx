import { SettingsScreen } from '@/components/admin/screens/SettingsScreen';

/**
 * F1.b — SETTINGS. Localisation is real; every other group needs a settings store.
 *
 * Thin by design: every admin page is a Server Component that renders one
 * screen component and nothing else. Identity, capabilities and the
 * dictionary all come from AdminShell, so a page can neither fetch its own
 * identity nor render before the access boundary has resolved.
 */
export default function Page(): JSX.Element {
  return <SettingsScreen />;
}
