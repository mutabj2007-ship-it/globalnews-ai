'use client';

import type { ReactNode } from 'react';

/**
 * F1.b — a status chip.
 *
 * COLOUR IS NEVER THE ONLY SIGNAL. The chip always carries its text
 * label; the tone only reinforces it. That is the approved contract's
 * accessibility rule and it is why this component takes a `label` and
 * has no icon-only variant.
 */
export type ChipTone = 'good' | 'warn' | 'bad' | 'info' | 'violet' | 'mute';

const TONE: Record<ChipTone, string> = {
  good: 'border-adm-chip-good-edge bg-adm-chip-good-bg text-adm-chip-good-ink',
  warn: 'border-adm-chip-warn-edge bg-adm-chip-warn-bg text-adm-chip-warn-ink',
  bad: 'border-adm-chip-bad-edge bg-adm-chip-bad-bg text-adm-chip-bad-ink',
  info: 'border-adm-chip-info-edge bg-adm-chip-info-bg text-adm-chip-info-ink',
  violet: 'border-adm-chip-violet-edge bg-adm-chip-violet-bg text-adm-chip-violet-ink',
  mute: 'border-adm-chip-mute-edge bg-adm-chip-mute-bg text-adm-chip-mute-ink',
};

export function StatusChip({
  label,
  tone = 'mute',
  title,
}: {
  label: ReactNode;
  tone?: ChipTone;
  title?: string;
}): JSX.Element {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-cd-mono text-[9px] leading-tight tracking-[0.08em] ${TONE[tone]}`}
    >
      {label}
    </span>
  );
}
