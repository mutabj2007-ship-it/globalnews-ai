import { Radio, Archive, FlaskConical } from 'lucide-react';
import type { AnalysisRetrievalContext } from '@globalnews-ai/shared';
import { formatRelativeTime, formatUtcClock } from '@/lib/formatRelativeTime';

interface RetrievalContextStatusProps {
  retrievalContext: AnalysisRetrievalContext;
  className?: string;
}

const BADGE_STYLES: Record<AnalysisRetrievalContext['dataMode'], string> = {
  live: 'border-signal/50 bg-signal/10 text-signal-bright',
  cached: 'border-border-strong bg-surface text-ink-tertiary',
  mock: 'border-border-strong bg-surface text-ink-tertiary',
};

const BADGE_LABEL: Record<AnalysisRetrievalContext['dataMode'], string> = {
  live: 'Live reporting',
  cached: 'Stored reporting',
  mock: 'Demo reporting',
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
 */
export function RetrievalContextStatus({
  retrievalContext,
  className = '',
}: RetrievalContextStatusProps): JSX.Element {
  const { dataMode, fallbackReason, newestArticlePublishedAt, countryName } =
    retrievalContext;

  const Icon = dataMode === 'live' ? Radio : dataMode === 'cached' ? Archive : FlaskConical;

  const label = countryName
    ? `${BADGE_LABEL[dataMode]} \u00b7 ${countryName}`
    : BADGE_LABEL[dataMode];

  const explanation =
    dataMode === 'cached'
      ? fallbackReason === 'provider-error'
        ? 'Live reporting was unavailable, so this analysis uses stored reporting.'
        : fallbackReason === 'no-live-results'
          ? 'The live provider returned no usable results, so stored reporting was used.'
          : undefined
      : undefined;

  const freshnessLine = newestArticlePublishedAt
    ? `Newest stored article: ${formatRelativeTime(newestArticlePublishedAt)} \u00b7 ${formatUtcClock(newestArticlePublishedAt)}`
    : undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${BADGE_STYLES[dataMode]}`}
      >
        <Icon size={12} strokeWidth={2} className="shrink-0" />
        {label}
      </span>

      {explanation && (
        <p className="text-xs leading-relaxed text-ink-tertiary">{explanation}</p>
      )}

      {freshnessLine && (
        <p className="font-mono text-[11px] text-ink-tertiary">{freshnessLine}</p>
      )}
    </div>
  );
}
