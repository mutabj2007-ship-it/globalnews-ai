import { IncidentControlsScreen } from '@/components/admin/screens/IncidentControlsScreen';

/**
 * ADMIN OPERATIONS R1 — Admin → Operations → Incident controls.
 *
 * Thin by design, like every other admin page: a Server Component that renders one screen
 * and nothing else. Identity, capabilities and the dictionary come from AdminShell, so the
 * page cannot render before the access boundary has resolved.
 */
export default function Page(): JSX.Element {
  return <IncidentControlsScreen />;
}
