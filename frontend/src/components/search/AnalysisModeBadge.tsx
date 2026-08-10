import type { LucideIcon } from 'lucide-react';
import {
  Sparkles,
  FlaskConical,
  AlertTriangle,
  ShieldAlert,
  CircleSlash,
  Clock3,
} from 'lucide-react';
import type { AnalysisProvenance } from '@globalnews-ai/shared';

interface AnalysisModeBadgeProps {
  provenance: AnalysisProvenance;
  className?: string;
}

interface BadgeVisual {
  label: string;
  icon: LucideIcon;
  className: string;
}

/**
 * Milestone #30 — the badge now reads the full AnalysisProvenance
 * instead of just NewsAnalysisResult.analysisMode, so it can render a
 * truthful state even when `analysis` is null (failure,
 * validation-rejected, not-attempted) instead of only ever being able
 * to say "live" or "demo".
 *
 * `status` / `failureReason` drive which state is shown.
 * `analysisMode` only matters for a successful response, where it
 * distinguishes live AI from mock/demo analysis.
 */
function resolveBadgeVisual(provenance: AnalysisProvenance): BadgeVisual {
  if (provenance.status === 'success') {
    return provenance.analysisMode === 'live-ai'
      ? {
          label: 'LIVE AI ANALYSIS · Powered by OpenAI',
          icon: Sparkles,
          className: 'border-signal/50 bg-signal/10 text-signal-bright',
        }
      : {
          label: 'DEMO AI ANALYSIS',
          icon: FlaskConical,
          className: 'border-border-strong bg-surface text-ink-tertiary',
        };
  }

  if (provenance.status === 'validation-rejected') {
    return {
      label: 'AI ANALYSIS REJECTED · Failed validation',
      icon: ShieldAlert,
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
    };
  }

  if (provenance.status === 'not-attempted') {
    return {
      label: 'AI ANALYSIS NOT ATTEMPTED',
      icon: CircleSlash,
      className: 'border-border-strong bg-surface text-ink-tertiary',
    };
  }

  // provenance.status === 'failed'
  //
  // Distinguish an absent/unreachable provider ("UNAVAILABLE")
  // from an attempted analysis call that failed ("FAILED").
  const isUnavailable =
    provenance.failureReason === 'provider-not-configured' ||
    provenance.failureReason === 'provider-unavailable';

  return isUnavailable
    ? {
        label: 'AI UNAVAILABLE',
        icon: CircleSlash,
        className: 'border-border-strong bg-surface text-ink-tertiary',
      }
    : {
        label: 'AI ANALYSIS FAILED',
        icon: AlertTriangle,
        className: 'border-red-500/40 bg-red-500/10 text-red-400',
      };
}

export function AnalysisModeBadge({
  provenance,
  className = '',
}: AnalysisModeBadgeProps): JSX.Element {
  const visual = resolveBadgeVisual(provenance);
  const Icon = visual.icon;

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${visual.className} ${className}`}
    >
      <Icon size={12} strokeWidth={2} aria-hidden="true" />

      <span>{visual.label}</span>

      {provenance.cached && (
        <span className="inline-flex items-center gap-1 opacity-80">
          <Clock3 size={11} strokeWidth={2} aria-hidden="true" />
          Cached
        </span>
      )}
    </span>
  );
}