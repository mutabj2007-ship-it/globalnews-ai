import { Radio, Archive, FlaskConical, CircleOff } from 'lucide-react';
import type { AnalysisRetrievalContext } from '@globalnews-ai/shared';
import { formatRelativeTime, formatUtcClock } from '@/lib/formatRelativeTime';

interface RetrievalContextStatusProps {
  retrievalContext: AnalysisRetrievalContext;
  className?: string;
}

const BADGE_STYLES: Record<AnalysisRetrievalContext['dataMode'], string> = {
  live: 'border-signal/50 bg-signal/10 text-signal-bright',
  unavailable: 'border-border-strong bg-surface text-ink-tertiary',
  cached: 'border-border-strong bg-surface text-ink-tertiary',
  mock: 'border-border-strong bg-surface text-ink-tertiary',
};

const BADGE_LABEL: Record<AnalysisRetrievalContext['dataMode'], string> = {
  live: 'Live reporting',
  unavailable: 'Live data unavailable',
  cached: 'Stored reporting',
  mock: 'Demo reporting',
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
 */
/** "kigali" -> "Kigali", "new delhi" -> "New Delhi". Display-only formatting of the stored lowercase city key. */
function formatCityForDisplay(city: string): string {
  return city.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function RetrievalContextStatus({
  retrievalContext,
  className = '',
}: RetrievalContextStatusProps): JSX.Element {
  const {
    dataMode,
    fallbackReason,
    newestArticlePublishedAt,
    countryName,
    city,
    matchedFrom,
    canonicalLocation,
  } = retrievalContext;

  const Icon = BADGE_ICON[dataMode];

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
        ? 'Live reporting was unavailable, so this analysis uses stored reporting.'
        : fallbackReason === 'no-live-results'
          ? 'The live provider returned no usable results, so stored reporting was used.'
          : undefined
      : dataMode === 'unavailable'
        ? fallbackReason === 'provider-error'
          ? 'The live news provider could not be reached, and no stored reporting was available for this question.'
          : 'Live retrieval found nothing usable, and no stored reporting was available for this question.'
        : undefined;

  const freshnessLine = newestArticlePublishedAt
    ? `Newest stored article: ${formatRelativeTime(newestArticlePublishedAt)} \u00b7 ${formatUtcClock(newestArticlePublishedAt)}`
    : undefined;

  // Milestone #28: when this query's country/city came from fuzzy
  // geographic typo resolution rather than an exact match, say so
  // explicitly instead of silently presenting results as if the user
  // had typed the corrected spelling — the page's own question heading
  // elsewhere always shows the user's original text untouched; this is
  // additional, opt-in disclosure of what retrieval actually used.
  const correctionLine =
    matchedFrom && canonicalLocation
      ? `Interpreted "${formatCityForDisplay(matchedFrom)}" as ${formatCityForDisplay(canonicalLocation)}`
      : undefined;

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
