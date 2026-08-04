import { Radio, Info } from 'lucide-react';
import type { NewsDataMode } from '@globalnews-ai/shared';

interface DataModeLabelProps {
  /** null means "unknown" (e.g. backend unreachable) — rendered like mock, never like live. */
  dataMode: NewsDataMode | null;
  className?: string;
}

/**
 * Editorial-integrity disclosure. Live and demo labels must never be
 * shown at the same time for the same content, so this always renders
 * exactly one state based on the actual response that produced the
 * content next to it.
 */
export function DataModeLabel({ dataMode, className = '' }: DataModeLabelProps): JSX.Element {
  const isLive = dataMode === 'live';

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
      ) : (
        <Info size={12} strokeWidth={2} className="shrink-0" />
      )}
      {isLive ? 'LIVE \u00b7 Powered by GNews' : 'DEMO MODE \u00b7 Sample content only'}
    </span>
  );
}
