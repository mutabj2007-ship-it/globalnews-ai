import { PaymentsScreen } from '@/components/admin/screens/PaymentsScreen';

/**
 * F1.b — ADMIN-04 KSeF tab. Behind the capability flag; reads DISCONNECTED.
 *
 * Thin by design: every admin page is a Server Component that renders one
 * screen component and nothing else. Identity, capabilities and the
 * dictionary all come from AdminShell, so a page can neither fetch its own
 * identity nor render before the access boundary has resolved.
 */
export default function Page(): JSX.Element {
  return <PaymentsScreen tab="ksef" />;
}
