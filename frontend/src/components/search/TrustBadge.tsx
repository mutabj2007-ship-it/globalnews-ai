import type { LucideIcon } from 'lucide-react';
import { ShieldCheck, Shield, ShieldAlert, ShieldQuestion, FlaskConical } from 'lucide-react';
import type { TrustLevel, TrustState } from '@globalnews-ai/shared';
import { selectPrimaryReason, trustReasonLabel } from '@/lib/trustReasonLabels';

interface TrustBadgeProps {
  trustState: TrustState;
  className?: string;
}

interface TrustVisual {
  label: string;
  icon: LucideIcon;
  className: string;
  primaryReasonText?: string;
}

const LEVEL_COPY: Record<TrustLevel, { label: string; icon: LucideIcon; className: string }> = {
  high: {
    label: 'Strong evidence support',
    icon: ShieldCheck,
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  },
  moderate: {
    label: 'Moderate evidence support',
    icon: Shield,
    className: 'border-signal/40 bg-signal/10 text-signal-bright',
  },
  limited: {
    label: 'Limited evidence support',
    icon: ShieldAlert,
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  },
  insufficient: {
    label: 'Insufficient evidence',
    icon: ShieldQuestion,
    className: 'border-ink-tertiary/40 bg-surface text-ink-tertiary',
  },
};

/**
 * Milestone #44 — pure visual/copy-selection logic, isolated from JSX
 * for testability (mirrors AnalysisModeBadge.tsx's own
 * resolveBadgeVisual pattern, Milestone #30). Driven ONLY by
 * analysis.trustState — never reads analysis.confidence, never
 * recalculates trust; every branch below is a presentation choice over
 * already-authoritative backend data.
 *
 * MOCK SPECIAL CASE: the backend's mock hard override (Milestone #42)
 * always sets trustState = { level: 'insufficient', reasons:
 * ['mock-execution'] } for demo analyses. The backend LEVEL is left
 * completely unchanged here — still 'insufficient' — only the frontend
 * WORDING differs, so a user never reads "insufficient evidence" (which
 * implies a real search came up empty) when this is actually demo data
 * that was never assessed at all.
 */
export function resolveTrustVisual(trustState: TrustState): TrustVisual {
  const isMockOnly =
    trustState.reasons.length === 1 && trustState.reasons[0] === 'mock-execution';

  if (isMockOnly) {
    return {
      label: 'Demo analysis — real evidence trust not assessed',
      icon: FlaskConical,
      className: 'border-border-strong bg-surface text-ink-tertiary',
    };
  }

  const copy = LEVEL_COPY[trustState.level];
  const primaryReason = selectPrimaryReason(trustState.reasons);

  return {
    label: copy.label,
    icon: copy.icon,
    className: copy.className,
    primaryReasonText: primaryReason ? trustReasonLabel(primaryReason) : undefined,
  };
}

/**
 * Milestone #44 — the authoritative, visually-primary trust indicator.
 * Occupies the prominent position analysis.confidence previously held
 * in AnalysisResultView; analysis.confidence is now demoted to a
 * secondary, explicitly-labeled "AI self-assessment" section (see
 * AnalysisResultView.tsx) that visually ranks below this component.
 *
 * Every state pairs a distinct icon with distinct text — color is
 * never the sole carrier of meaning.
 */
export function TrustBadge({ trustState, className = '' }: TrustBadgeProps): JSX.Element {
  const visual = resolveTrustVisual(trustState);
  const Icon = visual.icon;

  return (
    <div className={`rounded-2xl border p-5 ${visual.className} ${className}`}>
      <div className="mb-1 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest">
        <Icon size={14} strokeWidth={2} aria-hidden="true" />
        <span>{visual.label}</span>
      </div>

      {visual.primaryReasonText && (
        <p className="text-sm leading-relaxed opacity-90">{visual.primaryReasonText}</p>
      )}

      {trustState.reasons.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
            Trust details
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {trustState.reasons.map((reason) => (
              <li key={reason} className="text-xs leading-relaxed text-ink-tertiary">
                {trustReasonLabel(reason)}
              </li>
            ))}
          </ul>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-mono text-[10px] text-ink-tertiary">
            <dt>Distinct supporting articles</dt>
            <dd>{trustState.distinctSourceArticleCount}</dd>
            {trustState.uncertaintyCount > 0 && (
              <>
                <dt>Uncertainties</dt>
                <dd>{trustState.uncertaintyCount}</dd>
              </>
            )}
            {trustState.differenceTopicCount > 0 && (
              <>
                <dt>Topics with differing positions</dt>
                <dd>{trustState.differenceTopicCount}</dd>
              </>
            )}
          </dl>
        </details>
      )}
    </div>
  );
}
