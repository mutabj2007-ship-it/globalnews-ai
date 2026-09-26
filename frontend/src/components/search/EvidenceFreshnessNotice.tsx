import { Archive, CircleOff, FlaskConical } from 'lucide-react';
import type { AnalysisRetrievalContext, LanguageCode } from '@globalnews-ai/shared';
import { resolveRetrievalContextText } from '@/components/search/RetrievalContextStatus';

/**
 * ASK/SEARCH ENGINEERING R1 — RETAINED EVIDENCE IS NEVER PRESENTED AS LIVE.
 *
 * `AnalysisModeBadge` describes the AI step ("LIVE AI ANALYSIS"), not the
 * evidence. When the evidence behind that analysis is stored reporting, demo
 * reporting or unavailable, the only disclosure used to sit inside the Complete
 * Record view, so a retained answer read as fully live in the Ask dock and in
 * the frame header. This notice stands next to the badge in both places.
 *
 * It renders NOTHING for live evidence, and it invents no copy: label and
 * explanation come from `resolveRetrievalContextText`, the same resolver the
 * Complete Record's `RetrievalContextStatus` uses, in EN and PL.
 */
export function evidenceIsLive(retrievalContext: AnalysisRetrievalContext): boolean {
  return retrievalContext.dataMode === 'live' && retrievalContext.outcome !== 'RETAINED_ONLY';
}

const ICON = { cached: Archive, unavailable: CircleOff, mock: FlaskConical } as const;

export function EvidenceFreshnessNotice({
  retrievalContext,
  language,
}: {
  retrievalContext: AnalysisRetrievalContext;
  language: LanguageCode;
}): JSX.Element | null {
  if (evidenceIsLive(retrievalContext)) return null;

  /* RETAINED_ONLY stamped on a 'live' mode is still stored reporting. */
  const disclosed: AnalysisRetrievalContext =
    retrievalContext.dataMode === 'live' ? { ...retrievalContext, dataMode: 'cached' } : retrievalContext;
  const mode = disclosed.dataMode as keyof typeof ICON;
  const text = resolveRetrievalContextText(disclosed, language);
  const Icon = ICON[mode];

  return (
    <span
      data-evidence-freshness={mode}
      role="note"
      title={text.explanation}
      className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border-strong bg-surface px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary"
    >
      <Icon size={12} strokeWidth={2.2} aria-hidden="true" />
      {text.label}
      {text.explanation ? <span className="sr-only">. {text.explanation}</span> : null}
    </span>
  );
}
