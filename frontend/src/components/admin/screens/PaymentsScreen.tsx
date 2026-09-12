'use client';

import { useAdminContext } from '../shell/AdminContext';
import { ADMIN_ROUTES } from '@/lib/admin/adminRoutes';
import { AdminPanel } from '../primitives/AdminPanel';
import { AdminFilterBar } from '../primitives/AdminFilterBar';
import { AdminTabs } from '../primitives/AdminTabs';
import { PlaceholderPanel } from '../primitives/PlaceholderPanel';
import { StatusChip } from '../primitives/StatusChip';
import { ScreenHeading } from './SystemHealthScreen';

/**
 * ADMIN-04 — Payments, taxes, Poland & KSeF. STRUCTURE ONLY.
 *
 * This platform has no payment, tax, customer, invoice or KSeF
 * capability of any kind: no payment provider dependency, no ledger, no
 * tax determination, no invoice numbering, no KSeF client, and no
 * database table for any of it. F0 verified that with word-boundary
 * searches — the only "VAT" in the whole repository is the ISO-3166
 * alpha-3 code for Vatican City.
 *
 * So all six tabs render the approved ARCHITECTURE and no data. Not one
 * amount, customer, invoice number, NIP or KSeF reference appears
 * anywhere in this file, and the repository's own legal-copy contract
 * (dictionaries/index.spec.ts) already forbids inventing registration or
 * VAT identifiers even if this screen wanted to.
 *
 * The traceability chain is rendered as its eight labelled nodes with
 * every node empty, because the chain IS the contract: each node must be
 * reachable from the one above, and agreeing that shape before anything
 * is built is the whole value this screen can honestly deliver today.
 */
export type PaymentsTab = 'overview' | 'vat' | 'customers' | 'invoices' | 'ksef' | 'traceability';

export function PaymentsScreen({ tab }: { tab: PaymentsTab }): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.payments;

  const tabs = [
    { id: 'overview', label: screen.tabs.overview, href: ADMIN_ROUTES.payments },
    { id: 'vat', label: screen.tabs.vat, href: ADMIN_ROUTES.paymentsVat },
    { id: 'customers', label: screen.tabs.customers, href: ADMIN_ROUTES.paymentsCustomers },
    { id: 'invoices', label: screen.tabs.invoices, href: ADMIN_ROUTES.paymentsInvoices },
    { id: 'ksef', label: screen.tabs.ksef, href: ADMIN_ROUTES.paymentsKsef },
    {
      id: 'traceability',
      label: screen.tabs.traceability,
      href: ADMIN_ROUTES.paymentsTraceability,
    },
  ] as const;

  const CHAIN = [
    screen.chain.customer,
    screen.chain.subscription,
    screen.chain.payment,
    screen.chain.taxTreatment,
    screen.chain.invoice,
    screen.chain.ksefSubmission,
    screen.chain.ksefResult,
    screen.chain.auditHistory,
  ];

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={screen.title} purpose={screen.purpose} />
      <AdminTabs tabs={tabs} activeId={tab} />

      <div className="rounded-lg border border-adm-chip-warn-edge bg-adm-chip-warn-bg px-3.5 py-3">
        <p className="font-cd-mono text-[10px] uppercase tracking-[0.12em] text-adm-chip-warn-ink">
          {screen.notImplementedTitle}
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-adm-chip-warn-ink">
          {screen.notImplementedBody}
        </p>
      </div>

      <AdminFilterBar labels={[screen.tabs.invoices, screen.tabs.customers, screen.tabs.ksef]} />

      {tab === 'ksef' && (
        <AdminPanel
          title={screen.ksefStatusTitle}
          field="admin-04.ksef"
          note={screen.ksefStatusBody}
        >
          <StatusChip label={screen.ksefStatusValue} tone="mute" />
        </AdminPanel>
      )}

      {tab === 'traceability' && (
        <AdminPanel
          title={screen.traceabilityTitle}
          field="admin-04.traceability"
          note={screen.traceabilityBody}
        >
          <ol className="flex flex-col gap-1.5">
            {CHAIN.map((node, index) => (
              <li
                key={node}
                className="flex items-center gap-3 rounded-lg border border-adm-edge px-3 py-2.5"
              >
                <span className="font-cd-mono text-[9px] text-adm-ink-ghost">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 text-[12px] text-adm-ink-2">{node}</span>
                <span className="font-cd-mono text-[10px] text-adm-val-mute">
                  {t.states.noSource}
                </span>
              </li>
            ))}
          </ol>
        </AdminPanel>
      )}

      {tab === 'overview' && (
        <PlaceholderPanel
          title={screen.tabs.overview}
          purpose={screen.purpose}
          requirement={screen.notImplementedBody}
          field="admin-04.transactions"
          ratio="min-h-[180px]"
        />
      )}

      {tab === 'vat' && (
        <PlaceholderPanel
          title={screen.tabs.vat}
          purpose={screen.purpose}
          requirement={screen.notImplementedBody}
          field="admin-04.vatRegister"
          ratio="min-h-[180px]"
        />
      )}

      {tab === 'customers' && (
        <PlaceholderPanel
          title={screen.tabs.customers}
          purpose={screen.purpose}
          requirement={screen.notImplementedBody}
          field="admin-04.customersNip"
          ratio="min-h-[180px]"
        />
      )}

      {tab === 'invoices' && (
        <PlaceholderPanel
          title={screen.tabs.invoices}
          purpose={screen.purpose}
          requirement={screen.notImplementedBody}
          field="admin-04.invoices"
          ratio="min-h-[180px]"
        />
      )}
    </div>
  );
}
