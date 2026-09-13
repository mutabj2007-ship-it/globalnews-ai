'use client';

import type { ReactNode } from 'react';
import { useAdminContext } from '../shell/AdminContext';
import type { AdminDataState } from '@/lib/admin/adminDataState';

/**
 * F1.b — THE six-state renderer. Every data component composes this one,
 * so no screen can invent its own empty state or its own wording for
 * "we do not have this".
 *
 *   real            the caller renders the value
 *   zero            `0`, plus its window label — a measured zero, said so
 *   loading         a skeleton that PRESERVES layout height, so the grid
 *                   does not reflow when values arrive
 *   unavailable     "No source" plus the field's provenance tag
 *   error           reason, correlation id and a retry — one failing
 *                   panel never blanks the screen
 *   notImplemented  "Planned", visible and explicitly inert, holding its
 *                   layout slot
 *
 * There is no seventh branch and no default that renders a number.
 */
export function AdminStateBlock({
  state,
  children,
  correlationId,
  onRetry,
  className,
}: {
  state: AdminDataState;
  /** Rendered ONLY for 'real' and 'zero'. */
  children?: ReactNode;
  correlationId?: string;
  onRetry?: () => void;
  className?: string;
}): JSX.Element {
  const { t } = useAdminContext();
  const wrap = className ?? '';

  switch (state) {
    case 'real':
    case 'zero':
      return <div className={wrap}>{children}</div>;

    case 'loading':
      return (
        <div className={wrap} aria-busy="true">
          <span className="sr-only">{t.states.loading}</span>
          <span aria-hidden="true" className="block h-6 w-24 animate-pulse rounded bg-adm-edge" />
        </div>
      );

    case 'unavailable':
      return (
        <div className={wrap}>
          <span className="text-[13px] font-semibold text-adm-val-mute">{t.states.noSource}</span>
          <span className="sr-only"> — {t.states.unavailableNote}</span>
        </div>
      );

    case 'error':
      return (
        <div className={wrap} role="alert">
          <span className="text-[13px] font-semibold text-adm-val-bad">{t.states.failed}</span>
          <p className="mt-1 text-[11px] leading-relaxed text-adm-ink-dim">{t.states.errorNote}</p>
          {correlationId && (
            <p className="mt-1 font-cd-mono text-[10px] text-adm-ink-faint">
              {t.states.correlationId}: {correlationId}
            </p>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-lg border border-adm-edge-input px-2.5 py-1 text-[11px] text-adm-accent-hi hover:border-adm-accent/60"
            >
              {t.states.retry}
            </button>
          )}
        </div>
      );

    case 'notImplemented':
      return (
        <div className={wrap}>
          <span className="text-[13px] font-semibold text-adm-val-warn">{t.states.planned}</span>
          <span className="sr-only"> — {t.states.notImplementedNote}</span>
        </div>
      );
  }
}
