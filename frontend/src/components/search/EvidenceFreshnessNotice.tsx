import { Archive, CircleOff, FlaskConical } from 'lucide-react';
import type { AnalysisRetrievalContext, LanguageCode } from '@globalnews-ai/shared';
import { resolveRetrievalContextText } from '@/components/search/RetrievalContextStatus';
import { displayEvidenceState, displayRetrievalContext } from '@/components/search/evidenceDisplay';

/**
 * ASK/SEARCH ENGINEERING R1 — RETAINED EVIDENCE IS NEVER PRESENTED AS LIVE.
 *
 * `AnalysisModeBadge` describes the AI step ("LIVE AI ANALYSIS"), not the
 * evidence. When the evidence behind that analysis is stored reporting, demo
 * reporting or unavailable, the only disclosure used to sit inside the Complete
 * Record view, so a retained answer read as fully live in the Ask dock and in
 * the frame header. This notice stands next to the badge in both places.
 *
 * PR #40 R2 F3 — state, label and explanation now come from the ONE display
 * authority (`evidenceDisplay.ts`) that the Complete Record's
 * `RetrievalContextStatus` also uses, so the top-level notice and the record
 * cannot disagree. It renders NOTHING for live or genuine no-relevant-evidence
 * states, and it invents no copy (EN and PL come from the same resolver).
 */
export function evidenceIsLive(retrievalContext: AnalysisRetrievalContext, articleCount?: number): boolean {
  const state = displayEvidenceState(retrievalContext, articleCount);
  if (state !== undefined) return state === 'live' || state === 'no-relevant-evidence';
  /* Neither a stamp nor any count: nothing to derive from; the prior rule stands. */
  return retrievalContext.dataMode === 'live' && retrievalContext.outcome !== 'RETAINED_ONLY';
}

const ICON = { live: Archive, cached: Archive, unavailable: CircleOff, mock: FlaskConical } as const;

export function EvidenceFreshnessNotice({
  retrievalContext,
  language,
  articleCount,
}: {
  retrievalContext: AnalysisRetrievalContext;
  language: LanguageCode;
  /** The rendered response's article count, for legacy payloads without a stamped state. */
  articleCount?: number;
}): JSX.Element | null {
  if (evidenceIsLive(retrievalContext, articleCount)) return null;

  const shown = displayRetrievalContext(retrievalContext, articleCount);
  /* A context that still reads 'live' here carried nothing to derive from; disclose it as stored. */
  const mode = shown.dataMode === 'live' ? 'cached' : shown.dataMode;
  const text = resolveRetrievalContextText(
    mode === shown.dataMode ? shown : { ...shown, dataMode: mode },
    language,
    articleCount,
  );
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
