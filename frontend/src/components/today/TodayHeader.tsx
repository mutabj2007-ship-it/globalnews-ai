'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { HEADER_H_EXPANDED } from '@/components/today/todayWorkspaceGeometry';

/**
 * R7 `08 §2` — THE HEADER TRACK AND ITS ATTENTION COUNTERS.
 *
 * ── FOUR COUNTERS, EACH ONE A STATEMENT ABOUT US ─────────────────────────
 *
 * RETRIEVED, COUNTRIES, NO COUNTRY and WATCHING. Not one of them is a claim
 * about the world, and the bias note that says so sits BESIDE them in the same
 * track — not in a tooltip, not behind an info dot. A reader who takes only
 * the 3-second glance still leaves with the qualification, which is the whole
 * reason `08 §1` puts the summary first in the DOM.
 *
 * NO COUNTRY is drawn even at zero. Its absence would let a reader assume
 * every record was placed; its presence at 0 says we checked.
 *
 * WATCHING renders ONLY where a real follow list exists. An anonymous visitor
 * has no follow list, so the counter is absent rather than 0 — a 0 there would
 * be a statement about their follows, and they have none to state.
 *
 * ── COLLAPSE IS GEOMETRY, NOT DECORATION ─────────────────────────────────
 *
 * `08 §4` derives every tier from KNOWN chrome heights. So the header has
 * exactly two heights — `HEADER_H_EXPANDED` and 0 — and the collapsed one is
 * fed straight into `resolveSectionColumnHeight`. There is no measured
 * element, no ResizeObserver and no transition whose midpoint would hand the
 * geometry a height that is true for 200ms and wrong afterwards.
 */
export interface TodayCounters {
  retrieved: number;
  countries: number;
  unresolved: number;
  /** Null for an anonymous visitor: there is no follow list to count. */
  watching: number | null;
  /** Null unless a real last-visit value supports the claim (`08 §3`). */
  newSinceLastVisit: number | null;
}

interface TodayHeaderProps {
  counters: TodayCounters;
  collapsed: boolean;
  language: LanguageCode;
}

function Counter({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: 'cyan' | 'amber';
}): JSX.Element {
  return (
    <div className="flex flex-col gap-[2px]">
      <span
        className="font-gn-mono text-[19px] font-bold leading-none tabular-nums"
        style={{
          color: accent === 'cyan' ? '#67e8f9' : accent === 'amber' ? '#d97706' : '#f1f6fb',
        }}
      >
        {value}
      </span>
      <span className="font-gn-mono text-[7.5px] uppercase tracking-[.14em] text-[#7d92aa]">
        {label}
      </span>
    </div>
  );
}

export function TodayHeader({ counters, collapsed, language }: TodayHeaderProps): JSX.Element | null {
  const t = getDictionary(language).todayWorkspace.header;

  if (collapsed) return null;

  return (
    <header
      className="flex shrink-0 flex-col justify-center gap-[9px] overflow-hidden border-b border-[#16202e] bg-[#060a10] px-[16px]"
      style={{ height: `${HEADER_H_EXPANDED}px`, flex: '0 0 auto' }}
    >
      <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[2px]">
        <span className="font-gn-mono text-[9px] font-bold uppercase tracking-[.18em] text-[#67e8f9]">
          {t.regionLabel}
        </span>
        <h2 className="font-gn-display text-[13.5px] font-semibold leading-[1.3] text-[#dbe6f2]">
          {t.question}
        </h2>
      </div>

      <div className="flex flex-wrap items-end gap-x-[26px] gap-y-[8px]">
        <Counter value={counters.retrieved} label={t.retrievedLabel} />
        <Counter value={counters.countries} label={t.countriesLabel} />
        {/* Zero is drawn: it says we checked, rather than leaving the reader
            to assume every record was placed. */}
        <Counter value={counters.unresolved} label={t.unresolvedLabel} />
        {counters.watching !== null && (
          <Counter value={counters.watching} label={t.watchingLabel} accent="cyan" />
        )}
        {/* `08 §3` — OPTIONAL WHEN AVAILABLE. Never invented from a page load. */}
        {counters.newSinceLastVisit !== null && (
          <Counter value={counters.newSinceLastVisit} label={t.newLabel} accent="amber" />
        )}
      </div>

      {/* The qualification travels WITH the counters. */}
      <p className="font-gn-display text-[10.5px] leading-[1.4] text-[#7d92aa]">{t.biasNote}</p>
    </header>
  );
}
