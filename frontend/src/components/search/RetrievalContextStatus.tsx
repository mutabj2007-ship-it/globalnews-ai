import { Radio, Archive, FlaskConical, CircleOff } from 'lucide-react';
import type { AnalysisRetrievalContext, LanguageCode } from '@globalnews-ai/shared';
import { formatRelativeTime, formatUtcClock } from '@/lib/formatRelativeTime';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface RetrievalContextStatusProps {
  retrievalContext: AnalysisRetrievalContext;
  className?: string;
  /** Milestone #47 — defaults to 'en', so every pre-M47 caller renders exactly as before. */
  language?: LanguageCode;
}

const BADGE_STYLES: Record<AnalysisRetrievalContext['dataMode'], string> = {
  live: 'border-signal/50 bg-signal/10 text-signal-bright',
  unavailable: 'border-border-strong bg-surface text-ink-tertiary',
  cached: 'border-border-strong bg-surface text-ink-tertiary',
  mock: 'border-border-strong bg-surface text-ink-tertiary',
};

const BADGE_ICON: Record<AnalysisRetrievalContext['dataMode'], typeof Radio> = {
  live: Radio,
  unavailable: CircleOff,
  cached: Archive,
  mock: FlaskConical,
};

/**
 * Compact provenance/status indicator for an analysis result. Shown
 * regardless of whether `analysis` itself is present, since the
 * underlying evidence's provenance is meaningful even when AI
 * analysis failed or found nothing.
 *
 * Deliberately does not use analysis.generatedAt for freshness —
 * that reflects when the AI ran, not how current the underlying
 * articles are. newestArticlePublishedAt is the correct freshness
 * signal for cached/stored evidence.
 *
 * dataMode "unavailable" means no real provider succeeded AND no
 * stored reporting existed either — there is genuinely nothing to
 * show, which is a different message from "cached" (something is
 * being shown, just not live) and must never be styled/labeled like
 * "live" (see RetrievalContextStatus.spec / news.ts NewsDataMode).
 *
 * Milestone #47 (Defect 1 correction) — `language` defaults to 'en';
 * English output is byte-for-byte unchanged from before this
 * milestone. countryName/city/matchedFrom/canonicalLocation are all
 * backend-resolved place names — NEVER translated by this component,
 * only the surrounding English prose changes.
 */
/** "kigali" -> "Kigali", "new delhi" -> "New Delhi". Display-only formatting of the stored lowercase city key. */
function formatCityForDisplay(city: string): string {
  return city.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * Milestone #47 (retrieval-context testability correction) — pure
 * text-resolution logic extracted from the component body, mirroring
 * the established resolveTrustVisual() / resolveSourceDiversityText()
 * pattern already used by TrustBadge.tsx / SourceDiversitySummary.tsx
 * in this same directory. Byte-for-byte identical output to what the
 * component previously computed inline — this is a pure refactor for
 * testability, not a behavior change. `Icon`/BADGE_STYLES (visual, not
 * textual) remain resolved directly in the component, matching the
 * existing sibling components' own split between "text resolution"
 * (tested here) and "visual/style resolution" (left in the component).
 */
export interface RetrievalContextText {
  label: string;
  correctionLine?: string;
  explanation?: string;
  freshnessLine?: string;
}

export function resolveRetrievalContextText(
  retrievalContext: AnalysisRetrievalContext,
  language: LanguageCode = 'en',
): RetrievalContextText {
  const {
    dataMode,
    fallbackReason,
    newestArticlePublishedAt,
    countryName,
    city,
    matchedFrom,
    canonicalLocation,
  } = retrievalContext;

  const t = getDictionary(language).retrievalContextStatus;

  const BADGE_LABEL: Record<AnalysisRetrievalContext['dataMode'], string> = {
    live: t.liveReporting,
    unavailable: t.liveDataUnavailable,
    cached: t.storedReporting,
    mock: t.demoReporting,
  };

  // When a curated city drove retrieval, prefer "Kigali, Rwanda" over
  // just "Rwanda" so the badge reflects the actual retrieval intent.
  const locationLabel =
    city && countryName
      ? `${formatCityForDisplay(city)}, ${countryName}`
      : countryName;

  const label = locationLabel
    ? `${BADGE_LABEL[dataMode]} \u00b7 ${locationLabel}`
    : BADGE_LABEL[dataMode];

  const explanation =
    dataMode === 'cached'
      ? fallbackReason === 'provider-error'
        ? t.liveUnavailableStoredUsed
        : fallbackReason === 'no-live-results'
          ? t.liveNoResultsStoredUsed
          : undefined
      : dataMode === 'unavailable'
        ? fallbackReason === 'provider-error'
          ? t.liveUnreachableNoStored
          : t.liveNothingNoStored
        : undefined;

  const freshnessLine = newestArticlePublishedAt
    ? `${t.newestStoredArticle} ${formatRelativeTime(newestArticlePublishedAt, language)} \u00b7 ${formatUtcClock(newestArticlePublishedAt)}`
    : undefined;

  // Milestone #28: when this query's country/city came from fuzzy
  // geographic typo resolution rather than an exact match, say so
  // explicitly instead of silently presenting results as if the user
  // had typed the corrected spelling — the page's own question heading
  // elsewhere always shows the user's original text untouched; this is
  // additional, opt-in disclosure of what retrieval actually used.
  //
  // Milestone #47: matchedFrom/canonicalLocation are backend-resolved
  // PLACE NAMES — never translated by this function; only the
  // surrounding "Interpreted ... as ..." prose is localized.
  const correctionLine =
    matchedFrom && canonicalLocation
      ? `${t.interpretedAs} "${formatCityForDisplay(matchedFrom)}" ${t.interpretedAsMiddle} ${formatCityForDisplay(canonicalLocation)}`
      : undefined;

  return { label, correctionLine, explanation, freshnessLine };
}

export function RetrievalContextStatus({
  retrievalContext,
  className = '',
  language = 'en',
}: RetrievalContextStatusProps): JSX.Element {
  const { dataMode } = retrievalContext;
  const { label, correctionLine, explanation, freshnessLine } = resolveRetrievalContextText(
    retrievalContext,
    language,
  );
  const Icon = BADGE_ICON[dataMode];

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${BADGE_STYLES[dataMode]}`}
      >
        <Icon size={12} strokeWidth={2} className="shrink-0" />
        {label}
      </span>

      {correctionLine && (
        <p className="text-xs leading-relaxed text-ink-tertiary">{correctionLine}</p>
      )}

      {explanation && (
        <p className="text-xs leading-relaxed text-ink-tertiary">{explanation}</p>
      )}

      {freshnessLine && (
        <p className="font-mono text-[11px] text-ink-tertiary">{freshnessLine}</p>
      )}
    </div>
  );
}
