'use client';

import { useEffect, useState } from 'react';
import type {
  AdminAlphaReviewReportingLane,
  AdminAlphaReviewResponse,
} from '@/lib/admin/adminApiTypes';

export type AlphaReportingDomain =
  | 'politics'
  | 'security'
  | 'conflict'
  | 'market'
  | 'energy'
  | 'humanitarian';

function formatWhen(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Product Owner-only retained reporting overlay.
 *
 * It reads the authenticated /api/admin/alpha-review route and disappears for
 * anonymous/non-authorized users. The records are CONTEXT ONLY: this component
 * never upgrades retained reporting into a specialist observation, assessment,
 * severity, attribution, metric or public admission.
 *
 * No provider and no AI call is reachable from this component.
 */
export function AlphaRetainedReportingDock({
  domain,
}: {
  domain: AlphaReportingDomain;
}): JSX.Element | null {
  const [lane, setLane] = useState<AdminAlphaReviewReportingLane | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void fetch('/api/admin/alpha-review', {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as AdminAlphaReviewResponse;
      })
      .then((review) => {
        if (!review) return;
        setLane(review.reporting.find((candidate) => candidate.id === domain) ?? null);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setLane(null);
      });

    return () => controller.abort();
  }, [domain]);

  if (!lane) return null;

  const count = lane.count === null ? 'UNMEASURED' : String(lane.count);
  const visible = lane.records.slice(0, 8);

  return (
    <details
      open
      data-alpha-retained-reporting={domain}
      className="fixed bottom-3 left-1/2 z-[80] w-[calc(100vw-24px)] max-w-[760px] -translate-x-1/2 overflow-hidden rounded-lg border border-cyan-900/70 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur"
    >
      <summary className="cursor-pointer select-none px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
        Alpha retained data · {domain} · {count} candidates · unassessed
      </summary>

      <div className="max-h-[52vh] overflow-y-auto border-t border-cyan-950/80 px-4 py-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-[590px] text-[11px] leading-relaxed text-slate-300">
            {lane.note}
          </p>
          <span className="rounded border border-amber-700/60 bg-amber-950/40 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-amber-200">
            CONTEXT ONLY · PUBLIC CLOSED
          </span>
        </div>

        {lane.newestFetchedAt && (
          <p className="mb-3 text-[10px] text-slate-500">
            Latest retained: {formatWhen(lane.newestFetchedAt)}
          </p>
        )}

        {visible.length === 0 ? (
          <p className="py-3 text-[12px] text-slate-400">
            {lane.state === 'UNAVAILABLE'
              ? 'Retained reporting could not be measured.'
              : 'No retained reporting candidate matched this review lane.'}
          </p>
        ) : (
          <div className="space-y-2">
            {visible.map((record) => {
              const country =
                record.countries[0]?.countryName ??
                record.countryName ??
                record.countries[0]?.countryCode ??
                record.countryCode ??
                'No country attribution';

              return (
                <article
                  key={record.id}
                  className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] uppercase tracking-[0.08em] text-slate-500">
                    <span>{record.sourceName}</span>
                    <span>·</span>
                    <span>{record.category}</span>
                    <span>·</span>
                    <span>{country}</span>
                    <span>·</span>
                    <span>{formatWhen(record.publishedAt)}</span>
                  </div>
                  <a
                    href={record.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-[12px] font-semibold leading-snug text-cyan-100 hover:underline"
                  >
                    {record.title}
                  </a>
                  {record.summary && (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                      {record.summary}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {lane.count !== null && lane.count > visible.length && (
          <p className="mt-3 text-[10px] text-slate-500">
            Showing {visible.length} newest retained candidates of {lane.count}. No provider
            request was made to open this dashboard.
          </p>
        )}
      </div>
    </details>
  );
}
