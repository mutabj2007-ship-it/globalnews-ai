import type { LucideIcon } from 'lucide-react';
import {
  Sparkles,
  FlaskConical,
  AlertTriangle,
  ShieldAlert,
  CircleSlash,
  Clock3,
} from 'lucide-react';
import type { AnalysisProvenance, LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface AnalysisModeBadgeProps {
  provenance: AnalysisProvenance;
  className?: string;
  /** Milestone #47 — defaults to 'en', so every pre-M47 caller renders exactly as before. */
  language?: LanguageCode;
  /**
   * H-ALPHA-1B — OPT-IN, DEFAULT `text-[10px]`, which is this badge's
   * released size. Every existing caller omits it and renders
   * byte-identically.
   *
   * The badge is 10px, below Surface B's 11px desktop / 12px phone floor,
   * and it is SHARED with the pre-R4 `AnalysisResultView`. It is also the
   * single source of live-vs-mock labelling pinned by
   * `m52aHardening.spec.ts`, so it must not be forked or wrapped in a
   * second component.
   *
   * The size is therefore a parameter rather than an appended class:
   * appending would put two `text-[..]` utilities of equal specificity in
   * one class attribute, where the winner is decided by generated CSS
   * order, not attribute order. Substitution is deterministic.
   *
   * PRESENTATION ONLY. Nothing here reads `provenance`, and no caller can
   * change which state is shown.
   */
  sizeClass?: string;
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
 *
 * Milestone #47 (Defect 1 correction) — `language` defaults to 'en';
 * English output is byte-for-byte unchanged from before this
 * milestone. Presentation-only localization — never re-derives which
 * state is shown, only which pre-written label string represents it.
 */
function resolveBadgeVisual(provenance: AnalysisProvenance, language: LanguageCode): BadgeVisual {
  const t = getDictionary(language).analysisModeBadge;

  if (provenance.status === 'success') {
    return provenance.analysisMode === 'live-ai'
      ? {
          label: t.liveAiAnalysis,
          icon: Sparkles,
          className: 'border-signal/50 bg-signal/10 text-signal-bright',
        }
      : {
          label: t.demoAiAnalysis,
          icon: FlaskConical,
          className: 'border-border-strong bg-surface text-ink-tertiary',
        };
  }

  if (provenance.status === 'validation-rejected') {
    return {
      label: t.analysisRejected,
      icon: ShieldAlert,
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
    };
  }

  if (provenance.status === 'not-attempted') {
    return {
      label: t.notAttempted,
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
        label: t.unavailable,
        icon: CircleSlash,
        className: 'border-border-strong bg-surface text-ink-tertiary',
      }
    : {
        label: t.failed,
        icon: AlertTriangle,
        className: 'border-red-500/40 bg-red-500/10 text-red-400',
      };
}

export function AnalysisModeBadge({
  provenance,
  className = '',
  language = 'en',
  sizeClass = 'text-[10px]',
}: AnalysisModeBadgeProps): JSX.Element {
  const visual = resolveBadgeVisual(provenance, language);
  const Icon = visual.icon;
  const t = getDictionary(language).analysisModeBadge;

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono ${sizeClass} font-semibold uppercase tracking-wide ${visual.className} ${className}`}
    >
      <Icon size={12} strokeWidth={2} aria-hidden="true" />

      <span>{visual.label}</span>

      {provenance.cached && (
        <span className="inline-flex items-center gap-1 opacity-80">
          <Clock3 size={11} strokeWidth={2} aria-hidden="true" />
          {t.cached}
        </span>
      )}
    </span>
  );
}
