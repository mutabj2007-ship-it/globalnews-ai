import { Sparkles, FlaskConical } from 'lucide-react';
import type { AnalysisMode } from '@globalnews-ai/shared';

interface AnalysisModeBadgeProps {
  mode: AnalysisMode;
  className?: string;
}

export function AnalysisModeBadge({ mode, className = '' }: AnalysisModeBadgeProps): JSX.Element {
  const isLive = mode === 'live-ai';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${
        isLive
          ? 'border-signal/50 bg-signal/10 text-signal-bright'
          : 'border-border-strong bg-surface text-ink-tertiary'
      } ${className}`}
    >
      {isLive ? (
        <Sparkles size={12} strokeWidth={2} className="shrink-0" />
      ) : (
        <FlaskConical size={12} strokeWidth={2} className="shrink-0" />
      )}
      {isLive ? 'LIVE AI ANALYSIS \u00b7 Powered by OpenAI' : 'DEMO AI ANALYSIS'}
    </span>
  );
}
