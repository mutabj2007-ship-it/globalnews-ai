import { AnalyticsScreen } from '@/components/admin/screens/AnalyticsScreen';

/**
 * F1.b — ADMIN-03 Geography tab — coverage geography, not audience geography.
 *
 * Thin by design: every admin page is a Server Component that renders one
 * screen component and nothing else. Identity, capabilities and the
 * dictionary all come from AdminShell, so a page can neither fetch its own
 * identity nor render before the access boundary has resolved.
 */
export default function Page(): JSX.Element {
  return <AnalyticsScreen tab="geography" />;
}
