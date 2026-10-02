/**
 * E1's reader-display ruling as the backend publishes it (GET /humanitarian/reader-ruling).
 * Dictionary-free on purpose: the Humanitarian page's read graph imports this module, and that
 * graph is guarded against naming any provider (specialistVisualFrames).
 */
export interface HumanitarianReaderRuling {
  readonly requiredDisclosures: readonly string[];
  readonly readerClearedSourceIds: readonly string[];
  readonly relayAttributionVerbatim: string;
  /** The sources E1 D-3 binds to two names (relay acknowledgement + originating agency). */
  readonly relayAttributedSourceIds: readonly string[];
}

/** Parses the published ruling strictly; anything else is no ruling (and so no display). */
export function parseHumanitarianReaderRuling(value: unknown): HumanitarianReaderRuling | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const strings = (x: unknown): x is string[] =>
    Array.isArray(x) && x.every((s) => typeof s === 'string');
  if (!strings(v.requiredDisclosures) || !strings(v.readerClearedSourceIds)) return null;
  if (!strings(v.relayAttributedSourceIds)) return null;
  if (typeof v.relayAttributionVerbatim !== 'string') return null;
  return {
    requiredDisclosures: v.requiredDisclosures,
    readerClearedSourceIds: v.readerClearedSourceIds,
    relayAttributionVerbatim: v.relayAttributionVerbatim,
    relayAttributedSourceIds: v.relayAttributedSourceIds,
  };
}
