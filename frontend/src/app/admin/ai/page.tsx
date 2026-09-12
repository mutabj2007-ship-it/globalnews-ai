import { OperationsScreen } from '@/components/admin/screens/OperationsScreen';

/**
 * F1.b — ADMIN-06 AI intelligence tab.
 *
 * Thin by design: every admin page is a Server Component that renders one
 * screen component and nothing else. Identity, capabilities and the
 * dictionary all come from AdminShell, so a page can neither fetch its own
 * identity nor render before the access boundary has resolved.
 */
export default function Page(): JSX.Element {
  return <OperationsScreen tab="ai" />;
}
