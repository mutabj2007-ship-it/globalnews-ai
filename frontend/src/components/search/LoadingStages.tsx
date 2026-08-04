'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * These four labels correspond to the real, sequential work the backend
 * does for one analysis request: search the news provider, cluster
 * duplicate/syndicated coverage, send the deduped set to the AI
 * provider for comparison, then validate and package the result. There
 * is no server-sent progress channel in this sprint, so the frontend
 * cycles through them on a timer rather than claiming precise real-time
 * progress — but each label still describes a real step, not an
 * invented one.
 */
const STAGES = [
  'Searching trusted sources\u2026',
  'Grouping related reports\u2026',
  'Comparing coverage\u2026',
  'Preparing sourced analysis\u2026',
];

const STAGE_INTERVAL_MS = 1800;

export function LoadingStages(): JSX.Element {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((current) => Math.min(current + 1, STAGES.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-10 text-center"
      role="status"
      aria-live="polite"
    >
      <Loader2 size={28} className="animate-spin text-signal-bright" strokeWidth={2} />
      <p className="font-mono text-sm text-ink-secondary">{STAGES[stageIndex]}</p>
    </div>
  );
}
