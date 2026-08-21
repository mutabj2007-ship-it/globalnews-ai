'use client';

import type { NewsDataMode } from '@globalnews-ai/shared';
import { StatusChip, type ChipTone } from './StatusChip';

/**
 * F1.b — the pipeline mode chip.
 *
 * The approved design's four modes map ONE-TO-ONE onto the platform's
 * real `NewsDataMode`, which already ships on every news response:
 *
 *   LIVE        <- 'live'
 *   CACHED      <- 'cached'
 *   DEMO        <- 'mock'
 *   UNAVAILABLE <- 'unavailable'
 *
 * This is the single best design-to-repository fit in the whole package,
 * and it is why the mode chip is real data rather than a placeholder.
 * `mode` is intentionally optional: absent means the mode has not been
 * read yet, and the chip renders UNAVAILABLE rather than assuming LIVE —
 * the design's own rule that a row must never read LIVE while loading.
 */
const MODE_LABEL: Record<NewsDataMode, string> = {
  live: 'LIVE',
  cached: 'CACHED',
  mock: 'DEMO',
  unavailable: 'UNAVAILABLE',
};

const MODE_TONE: Record<NewsDataMode, ChipTone> = {
  live: 'good',
  cached: 'warn',
  mock: 'violet',
  unavailable: 'bad',
};

export function ModeChip({ mode }: { mode?: NewsDataMode }): JSX.Element {
  if (!mode) return <StatusChip label="UNAVAILABLE" tone="mute" />;
  return <StatusChip label={MODE_LABEL[mode]} tone={MODE_TONE[mode]} />;
}
