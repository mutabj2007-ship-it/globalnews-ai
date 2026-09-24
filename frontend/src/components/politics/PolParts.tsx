'use client';

import type { JSX, ReactNode } from 'react';
import { POLITICS_ABSENT } from '@/lib/politics/politicsSubject';

/**
 * PART VIII · POLITICS — THE SHARED PRIMITIVES.
 *
 * NO NEW TOKEN FAMILY, AND THAT IS A RULE RATHER THAN A SAVING. Part VIII §12 ends with
 * *"No new tokens. No new geometry family."* Market, Economy and Humanitarian each carry a
 * domain token module because each landed before the Spatial `sp-*` family was shared;
 * Politics arrives after it, and `components/specialist/*` already draws on `sp-ink`,
 * `sp-line`, `sp-panel` and `sp-cyan`. Minting a fifth near-identical palette would be the
 * drift §15 of the activation warns about — *"family resemblance, not uniformity"* is an
 * argument for shared tokens and distinct composition, not for a private copy of the ramp.
 */

/** The micro label ramp, matching the shared specialist components exactly. */
export const POL_MICRO =
  'font-gn-mono text-[9.5px] uppercase tracking-[0.14em] text-sp-ink-3';

/**
 * AN ABSENT VALUE, RENDERED ONCE.
 *
 * Every unavailable slot on this surface goes through here, so there is exactly one place
 * where the glyph, its accessible name and its ink level are decided. Eight components
 * spelling `—` themselves is how one of them eventually spells `0`, or `N/A`, or styles it
 * at reading weight so it looks like a value.
 *
 * It carries an accessible label because a lone em-dash announces as nothing at all.
 */
export function Absent({ label }: { label: string }): JSX.Element {
  return (
    <span data-pol="absent" aria-label={label} className="font-gn-mono text-[13px] text-sp-ink-3">
      {POLITICS_ABSENT}
    </span>
  );
}

/**
 * A labelled fact — the label always, the value when there is one.
 *
 * The label is NOT hidden when the value is absent. A surface that drops its own labels
 * when it has no data cannot be judged as a dashboard, which is the whole purpose of this
 * frame; and on a political surface a missing label is worse than a missing value, because
 * the reader cannot tell what was not measured.
 */
export function Field({ label, children }: { label: string; children?: ReactNode }): JSX.Element {
  return (
    <div data-pol="field" className="flex min-w-0 flex-col gap-[3px]">
      <span className={POL_MICRO}>{label}</span>
      <span className="break-words text-[13px] leading-[1.45] text-sp-ink-2">{children}</span>
    </div>
  );
}

/**
 * A region heading.
 *
 * ONE ACCENT, USED SPARINGLY. `sp-cyan` is the platform's active/verified accent and is the
 * only licensed colour on this surface. Politics gets no accent of its own — §5 forbids a
 * political severity ladder, and a domain hue is how a ladder starts.
 */
export function Region({ title, note, children }: {
  title: string; note?: string; children: ReactNode;
}): JSX.Element {
  return (
    <section data-pol="region" className="flex min-w-0 flex-col gap-[10px]">
      <div className="flex flex-wrap items-baseline gap-[10px]">
        <span aria-hidden="true" className="h-[5px] w-[5px] shrink-0 self-center rounded-full bg-sp-cyan/70" />
        <h2 className={`${POL_MICRO} font-medium text-sp-ink-2`}>{title}</h2>
        {note !== undefined && <span className={POL_MICRO}>{note}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * A neutral chip.
 *
 * NO STATE COLOURING ANYWHERE ON THIS SURFACE, and that is §4 of the activation rendered as
 * code: the UI *"must not encode approval/disapproval through decorative scoring"*. A chip
 * that turned amber for one political state and slate for another would be a scoring device
 * whatever its values were called. Every chip here is the same hairline on the same fill;
 * the words carry the meaning.
 */
export function Chip({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span data-pol="chip" className={`${POL_MICRO} border border-sp-line px-[7px] py-[3px] text-sp-ink-2`}>
      {children}
    </span>
  );
}

/** A panel. The one container shape this surface uses, at two paddings. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <div data-pol="panel" className={`border border-sp-line bg-sp-panel ${className}`}>
      {children}
    </div>
  );
}

/**
 * THE INERT WELL — where a substrate will be drawn, and is not being drawn.
 *
 * No line, no baseline, no axis, no gridline and no shimmer. On a political surface a
 * horizontal rule across an empty plot would read as a measured series that did not move,
 * and a pulse would say something is arriving. The diagonal hatch is the same inert fill the
 * accepted Economy and D1 wells use to mean *this is a plot area and it is not plotting*.
 */
export function Well({ label, minHeightPx = 140, children }: { label: string; minHeightPx?: number; children?: ReactNode }): JSX.Element {
  return (
    <div
      data-pol="well"
      role="img"
      aria-label={label}
      style={{
        minHeight: `${minHeightPx}px`,
        backgroundImage:
          'repeating-linear-gradient(135deg, rgba(126,166,186,.05) 0 7px, transparent 7px 14px)',
      }}
      className="flex flex-1 items-center justify-center"
    >
      {children ?? <span className="font-gn-mono text-[18px] text-sp-ink-3">{POLITICS_ABSENT}</span>}
    </div>
  );
}
