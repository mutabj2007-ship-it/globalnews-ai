import { Database, Info, Radio } from 'lucide-react';
import type { NewsDataMode } from '@globalnews-ai/shared';

interface DataModeLabelProps {
  /** null means the backend/data state is currently unknown. */
  dataMode: NewsDataMode | null;
  className?: string;
}

/**
 * Editorial-integrity disclosure.
 *
 * Exactly one data state is displayed:
 * - live: current reporting from a real provider
 * - cached: previously retrieved real reporting from our database
 * - mock: sample/demo content
 * - null: backend/data state unknown
 */
export function DataModeLabel({
  dataMode,
  className = '',
}: DataModeLabelProps): JSX.Element {
  const isLive = dataMode === 'live';
  const isCached = dataMode === 'cached';

  const label =
    dataMode === 'live'
      ? 'LIVE · Powered by GNews'
      : dataMode === 'cached'
        ? 'CACHED · Previously retrieved reporting'
        : dataMode === 'mock'
          ? 'DEMO MODE · Sample content only'
          : 'DATA STATUS UNKNOWN';

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