import { Database, Info, Radio } from 'lucide-react';
import type { LanguageCode, NewsDataMode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface DataModeLabelProps {
  /** null means the backend/data state is currently unknown. */
  dataMode: NewsDataMode | null;
  className?: string;
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

/**
 * Editorial-integrity disclosure.
 *
 * Exactly one data state is displayed:
 * - live: current reporting from a real provider
 * - cached: previously retrieved real reporting from our database
 * - mock: sample/demo content
 * - null: backend/data state unknown
 *
 * Milestone #48 (UI polish consistency fix) — this component's four
 * label strings were found to be BYTE-IDENTICAL to LiveStatusStrip's
 * own already-localized `liveStatusStrip.live/cached/mock/unknown`
 * dictionary keys (both describe the exact same four data-provenance
 * states). Rather than adding a second, duplicate set of dictionary
 * keys for what is the same badge concept shown at a different size,
 * this component now reuses those SAME keys directly — one shared
 * source of truth, per the explicit "prefer one shared dictionary
 * key/component" requirement. `language` defaults to 'en', so every
 * pre-M48 caller (and every English render) is byte-for-byte
 * unchanged. "GNews" itself is a proper provider/brand name and is
 * never altered by localization, in either language.
 */
export function DataModeLabel({
  dataMode,
  className = '',
  language = 'en',
}: DataModeLabelProps): JSX.Element {
  const isLive = dataMode === 'live';
  const isCached = dataMode === 'cached';
  const t = getDictionary(language).liveStatusStrip;

  const label =
    dataMode === 'live'
      ? t.live
      : dataMode === 'cached'
        ? t.cached
        : dataMode === 'mock'
          ? t.mock
          : t.unknown;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${
        isLive
          ? 'border-signal/50 bg-signal/10 text-signal-bright'
          : 'border-border-strong bg-surface text-ink-tertiary'
      } ${className}`}
    >
      {isLive ? (
        <Radio size={12} strokeWidth={2} className="shrink-0" />
      ) : isCached ? (
        <Database size={12} strokeWidth={2} className="shrink-0" />
      ) : (
        <Info size={12} strokeWidth={2} className="shrink-0" />
      )}

      {label}
    </span>
  );
}