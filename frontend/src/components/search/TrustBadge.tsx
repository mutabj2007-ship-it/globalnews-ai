import type { LucideIcon } from 'lucide-react';
import { ShieldCheck, Shield, ShieldAlert, ShieldQuestion, FlaskConical } from 'lucide-react';
import type { LanguageCode, TrustLevel, TrustState } from '@globalnews-ai/shared';
import { selectPrimaryReason, trustReasonLabel } from '@/lib/trustReasonLabels';

interface TrustBadgeProps {
  trustState: TrustState;
  className?: string;
  /** Milestone #47 — defaults to 'en', so every pre-M47 caller renders exactly as before. */
  language?: LanguageCode;
}

interface TrustVisual {
  label: string;
  icon: LucideIcon;
  className: string;
  primaryReasonText?: string;
}

const LEVEL_COPY: Record<LanguageCode, Record<TrustLevel, { label: string; icon: LucideIcon; className: string }>> = {
  en: {
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
  },
  pl: {
    high: {
      label: 'Silne wsparcie dowodowe',
      icon: ShieldCheck,
      className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
    },
    moderate: {
      label: 'Umiarkowane wsparcie dowodowe',
      icon: Shield,
      className: 'border-signal/40 bg-signal/10 text-signal-bright',
    },
    limited: {
      label: 'Ograniczone wsparcie dowodowe',
      icon: ShieldAlert,
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
    },
    insufficient: {
      label: 'Niewystarczające dowody',
      icon: ShieldQuestion,
      className: 'border-ink-tertiary/40 bg-surface text-ink-tertiary',
    },
  },
  // Milestone #47: sw/fr/es/ar/rw are architectural placeholders only —
  // never selectable in the active UI (see i18n/languages.ts's
  // ACTIVE_LANGUAGES), so resolveTrustVisual() below always falls back
  // to the English table for these, matching this module's own
  // documented "fallback, not a claim of translation" discipline.
  sw: {} as never,
  fr: {} as never,
  es: {} as never,
  ar: {} as never,
  rw: {} as never,
};

const MOCK_LABEL: Record<LanguageCode, string> = {
  en: 'Demo analysis — real evidence trust not assessed',
  pl: 'Analiza demonstracyjna — rzeczywiste zaufanie do dowodów nie zostało ocenione',
  sw: 'Demo analysis — real evidence trust not assessed',
  fr: 'Demo analysis — real evidence trust not assessed',
  es: 'Demo analysis — real evidence trust not assessed',
  ar: 'Demo analysis — real evidence trust not assessed',
  rw: 'Demo analysis — real evidence trust not assessed',
};

const TRUST_DETAILS_LABEL: Record<LanguageCode, string> = { en: 'Trust details', pl: 'Szczegóły zaufania', sw: 'Trust details', fr: 'Trust details', es: 'Trust details', ar: 'Trust details', rw: 'Trust details' };
const DISTINCT_ARTICLES_LABEL: Record<LanguageCode, string> = { en: 'Distinct supporting articles', pl: 'Odrębne artykuły źródłowe', sw: 'Distinct supporting articles', fr: 'Distinct supporting articles', es: 'Distinct supporting articles', ar: 'Distinct supporting articles', rw: 'Distinct supporting articles' };
const UNCERTAINTIES_LABEL: Record<LanguageCode, string> = { en: 'Uncertainties', pl: 'Niejasności', sw: 'Uncertainties', fr: 'Uncertainties', es: 'Uncertainties', ar: 'Uncertainties', rw: 'Uncertainties' };
const DIFFERING_TOPICS_LABEL: Record<LanguageCode, string> = { en: 'Topics with differing positions', pl: 'Tematy o rozbieżnych stanowiskach', sw: 'Topics with differing positions', fr: 'Topics with differing positions', es: 'Topics with differing positions', ar: 'Topics with differing positions', rw: 'Topics with differing positions' };

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
 *
 * Milestone #47 — `language` defaults to 'en'; English output is
 * byte-for-byte unchanged from before this milestone. This is
 * presentation localization only — it never re-derives trust, never
 * translates a TrustReason code, and never introduces a second trust
 * interpretation algorithm; it only selects which pre-written label
 * string to show for the SAME backend-computed level/reason.
 */
export function resolveTrustVisual(trustState: TrustState, language: LanguageCode = 'en'): TrustVisual {
  const isMockOnly =
    trustState.reasons.length === 1 && trustState.reasons[0] === 'mock-execution';

  if (isMockOnly) {
    return {
      label: MOCK_LABEL[language] ?? MOCK_LABEL.en,
      icon: FlaskConical,
      className: 'border-border-strong bg-surface text-ink-tertiary',
    };
  }

  const table = LEVEL_COPY[language] && Object.keys(LEVEL_COPY[language]).length > 0 ? LEVEL_COPY[language] : LEVEL_COPY.en;
  const copy = table[trustState.level];
  const primaryReason = selectPrimaryReason(trustState.reasons);

  return {
    label: copy.label,
    icon: copy.icon,
    className: copy.className,
    primaryReasonText: primaryReason ? trustReasonLabel(primaryReason, language) : undefined,
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
export function TrustBadge({ trustState, className = '', language = 'en' }: TrustBadgeProps): JSX.Element {
  const visual = resolveTrustVisual(trustState, language);
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
            {TRUST_DETAILS_LABEL[language] ?? TRUST_DETAILS_LABEL.en}
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {trustState.reasons.map((reason) => (
              <li key={reason} className="text-xs leading-relaxed text-ink-tertiary">
                {trustReasonLabel(reason, language)}
              </li>
            ))}
          </ul>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-mono text-[10px] text-ink-tertiary">
            <dt>{DISTINCT_ARTICLES_LABEL[language] ?? DISTINCT_ARTICLES_LABEL.en}</dt>
            <dd>{trustState.distinctSourceArticleCount}</dd>
            {trustState.uncertaintyCount > 0 && (
              <>
                <dt>{UNCERTAINTIES_LABEL[language] ?? UNCERTAINTIES_LABEL.en}</dt>
                <dd>{trustState.uncertaintyCount}</dd>
              </>
            )}
            {trustState.differenceTopicCount > 0 && (
              <>
                <dt>{DIFFERING_TOPICS_LABEL[language] ?? DIFFERING_TOPICS_LABEL.en}</dt>
                <dd>{trustState.differenceTopicCount}</dd>
              </>
            )}
          </dl>
        </details>
      )}
    </div>
  );
}
