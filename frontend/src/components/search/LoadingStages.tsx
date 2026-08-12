'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Milestone #47 — these four labels correspond to the real, sequential
 * work the backend does for one analysis request: search the news
 * provider, cluster duplicate/syndicated coverage, send the deduped set
 * to the AI provider for comparison, then validate and package the
 * result. Now supplied by the caller (from the shared i18n dictionary,
 * see lib/i18n/dictionaries) rather than hard-coded here — this
 * component never owns its own translation table, per the "do not
 * create duplicate translation dictionaries inside components"
 * requirement. Defaults to the exact same four English strings this
 * file previously hard-coded, so any pre-Milestone-#47 caller that
 * renders <LoadingStages /> with no props behaves byte-for-byte as
 * before.
 */
const DEFAULT_STAGES = [
  'Searching trusted sources\u2026',
  'Grouping related reports\u2026',
  'Comparing coverage\u2026',
  'Preparing sourced analysis\u2026',
];

const STAGE_INTERVAL_MS = 1800;

interface LoadingStagesProps {
  stages?: string[];
}

export function LoadingStages({ stages = DEFAULT_STAGES }: LoadingStagesProps = {}): JSX.Element {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((current) => Math.min(current + 1, stages.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [stages.length]);

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-10 text-center"
      role="status"
      aria-live="polite"
    >
      <Loader2 size={28} className="animate-spin text-signal-bright" strokeWidth={2} />
      <p className="font-mono text-sm text-ink-secondary">{stages[stageIndex]}</p>
    </div>
  );
}
