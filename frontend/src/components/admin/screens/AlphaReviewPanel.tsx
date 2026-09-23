'use client';

import { ADMIN_API } from '@/lib/admin/adminRoutes';
import type { AdminAlphaReviewResponse } from '@/lib/admin/adminApiTypes';
import { useAdminResource } from '@/lib/admin/useAdminResource';
import { useAdminContext } from '../shell/AdminContext';
import { AdminPanel } from '../primitives/AdminPanel';

function countLabel(value: number | null): string {
  return value === null ? 'UNMEASURED' : String(value);
}

/**
 * Product Owner Alpha review: what the platform already retains, before any
 * public-gate decision. This is not a publication surface.
 */
export function AlphaReviewPanel(): JSX.Element | null {
  const { can } = useAdminContext();
  if (!can('evidence.export')) return null;
  return <AlphaReviewData />;
}

function AlphaReviewData(): JSX.Element {
  const review = useAdminResource<AdminAlphaReviewResponse>(ADMIN_API.alphaReview);

  if (review.state === 'loading') {
    return (
      <AdminPanel title="ALPHA REVIEW" field="admin.alphaReview">
        <p className="text-[12px] text-adm-ink-dim">Loading retained evidence inventory…</p>
      </AdminPanel>
    );
  }

  if (review.state === 'error' || !review.data) {
    return (
      <AdminPanel title="ALPHA REVIEW" field="admin.alphaReview">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-adm-chip-warn-ink">
            Review inventory unavailable. This is not a zero-holdings statement.
          </p>
          <button
            type="button"
            onClick={review.reload}
            className="rounded-md border border-adm-edge px-3 py-1.5 text-[11px] text-adm-ink-2"
          >
            Retry
          </button>
        </div>
      </AdminPanel>
    );
  }

  return (
    <AdminPanel
      title="ALPHA PRODUCT OWNER REVIEW"
      field="admin.alphaReview"
      note="Internal Alpha inspection only · public gates are unchanged"
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-adm-chip-warn-edge bg-adm-chip-warn-bg px-3 py-2">
          <p className="text-[11px] leading-relaxed text-adm-chip-warn-ink">
            Everything below is a read of what Alpha already retains or can validate. RECORDS means
            retained records exist. EMPTY means the reviewed store is genuinely empty. UNAVAILABLE
            means the review role could not measure it and must never be interpreted as zero.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 adm-full:grid-cols-2">
          {review.data.domains.map((domain) => (
            <section key={domain.id} className="rounded-lg border border-adm-edge bg-adm-card-soft p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-adm-ink">
                    {domain.id}
                  </h3>
                  <p className="mt-0.5 font-cd-mono text-[10px] text-adm-ink-dim">
                    {domain.state} · {countLabel(domain.count)} · PUBLIC {domain.publicGate}
                  </p>
                </div>
                <a
                  href={domain.route}
                  className="rounded-md border border-adm-edge px-2.5 py-1.5 text-[11px] font-semibold text-adm-accent"
                >
                  Open dashboard ↗
                </a>
              </div>

              <p className="mt-2 text-[11px] leading-relaxed text-adm-ink-3">{domain.note}</p>

              {domain.records.length > 0 && (
                <details className="mt-3 rounded-md border border-adm-edge-mute bg-adm-void/40">
                  <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold text-adm-ink-2">
                    Inspect retained records ({domain.records.length})
                  </summary>
                  <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words border-t border-adm-edge-mute p-3 font-cd-mono text-[10px] leading-relaxed text-adm-ink-3">
                    {JSON.stringify(domain.records, null, 2)}
                  </pre>
                </details>
              )}
            </section>
          ))}
        </div>

        <details className="rounded-lg border border-adm-edge px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-adm-ink-2">
            Deliberately omitted from this review export
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-adm-ink-dim">
            {review.data.omissions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </details>
      </div>
    </AdminPanel>
  );
}
