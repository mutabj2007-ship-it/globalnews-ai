'use client';

import type { JSX, ReactNode } from 'react';
import type { ValueTreatment } from '@/lib/election/electionPreview';

/**
 * KENYA ELECTIONS · THE LOCAL PARTS.
 *
 * **NO NEW TOKEN FAMILY, AND NO FIFTH SPECIALIST COMPONENT.** This file is the
 * pattern Part VIII established and `PolParts.tsx` states in its own header:
 * `components/specialist/*` already draws on `sp-ink`, `sp-line`, `sp-panel`
 * and `sp-cyan`, and minting a near-identical palette beside it would be drift.
 * Every class below is from that shared family.
 *
 * ── AND WHY A LOCAL PARTS FILE IS NOT A FIFTH COMPONENT ──────────────────
 *
 * The contract's §4 list is the SPECIALIST set — the four shared components in
 * `components/specialist/`, which no domain may extend or copy. A domain frame
 * composing its own local parts out of shared tokens is the accepted pattern
 * with four precedents in this tree (Market, Economy, Humanitarian, Politics).
 * Nothing here is importable by another domain and nothing here is promoted.
 *
 * ── NO COLOUR CARRIES A POLITICAL MEANING ────────────────────────────────
 *
 * The constraint that outranks every other instruction in the Kenya contract is
 * political neutrality, *"including indirectly, by a presentation that
 * emphasises one result over another."* So there is no state hue on this
 * surface at all: every chip is the same hairline on the same fill, and the
 * words carry the meaning. Amber appears in exactly one place — a correction —
 * and that is the accepted rule for change or lateness, not a verdict.
 */

/** The micro label ramp, matching the shared specialist components exactly. */
export const ELN_MICRO = 'font-gn-mono text-[9.5px] uppercase tracking-[0.14em] text-sp-ink-3';

/**
 * A region heading. One accent, used sparingly — `sp-cyan` is the platform's
 * active/verified accent and is the only licensed colour here.
 */
export function Region({ title, note, children }: {
  title: string;
  note?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section data-eln="region" className="flex min-w-0 flex-col gap-[10px]">
      <div className="flex flex-wrap items-baseline gap-[10px]">
        <span aria-hidden="true" className="h-[5px] w-[5px] shrink-0 self-center rounded-full bg-sp-cyan/70" />
        <h2 className={`${ELN_MICRO} font-medium text-sp-ink-2`}>{title}</h2>
        {note !== undefined && <span className={ELN_MICRO}>{note}</span>}
      </div>
      {children}
    </section>
  );
}

/** A panel. The one container shape this surface uses. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <div data-eln="panel" className={`border border-sp-line bg-sp-panel ${className}`}>
      {children}
    </div>
  );
}

/**
 * A neutral chip. No state colouring, ever.
 *
 * `amber` is accepted for one thing only — change or lateness — so it is a
 * separate, named prop rather than a colour a caller can choose.
 */
export function Chip({ children, amber = false }: { children: ReactNode; amber?: boolean }): JSX.Element {
  return (
    <span
      data-eln="chip"
      data-eln-amber={amber ? 'true' : undefined}
      className={`${ELN_MICRO} border px-[7px] py-[3px] ${
        amber ? 'border-sp-amber/60 text-sp-amber' : 'border-sp-line text-sp-ink-2'
      }`}
    >
      {children}
    </span>
  );
}

/**
 * §5.3 · A VALUE SLOT, RENDERED UNDER EXACTLY ONE OF THREE DISJOINT TREATMENTS.
 *
 * The treatment is passed in as data — ink, border and whether a numeral is
 * present — so the three cannot converge by a later edit to one of three
 * scattered call sites. A reader who has learned the value treatment cannot
 * read the absence treatment as a weak version of it, because they share no
 * ink, no border and no glyph.
 *
 * **There is no path through this component that renders `0` from absence.**
 * `ABSENCE` carries no numeral at all; the numeral branch requires `children`.
 */
export function ValueSlot({ treatment, label, children }: {
  treatment: ValueTreatment;
  label: string;
  children?: ReactNode;
}): JSX.Element {
  const border =
    treatment.border === 'DASHED'
      ? 'border border-dashed border-sp-line'
      : treatment.border === 'SOLID'
        ? 'border border-sp-line'
        : '';

  return (
    <span
      data-eln="value-slot"
      data-eln-treatment={treatment.carriesNumeral ? 'VALUE' : treatment.busy ? 'LOADING' : 'ABSENCE'}
      aria-busy={treatment.busy ? true : undefined}
      aria-label={label}
      className={`inline-flex items-baseline gap-[6px] px-[7px] py-[3px] text-[13px] ${treatment.inkClass} ${border}`}
    >
      {treatment.carriesNumeral ? children : treatment.glyph}
    </span>
  );
}

/**
 * A row in the contestant list.
 *
 * **No position number, no ordinal, no size, weight or colour encodes rank.**
 *
 * ── R2 · TWO SUBTRACTIONS THE `RC` CONTRACT REQUIRED, MEASURED ───────────
 *
 * R3 states that H's parts *"already satisfy all six"* rules. Measured against
 * the rendered output, **R1's row missed two of them by one class**, and the
 * repair is a subtraction rather than a redesign — nothing was added, restyled
 * or relaid out.
 *
 *   `last:border-b-0`   made the LAST row's computed `border-bottom-width` 0px
 *                       where every other row's was 1px. **`RC-4` says every
 *                       row renders identically**, and a row that looks
 *                       different because of where it sits is position carrying
 *                       meaning — the precise thing `RC-4` forbids, arriving
 *                       through a convenience class rather than through logic.
 *
 *   `border-b`          is **a rule between rows**, which `RC-5` names in its
 *                       own words: *"No connector, no rule between rows, no
 *                       numbering, no directional affordance."* A horizontal
 *                       rule down a list is read top-to-bottom as a sequence,
 *                       and `LEXICAL` order is not a sequence of anything.
 *
 * Both classes are gone. Rows are separated by their own padding, which is
 * uniform and therefore position-independent. **The guards assert every row's
 * computed treatment is identical and demonstrate themselves failing against an
 * emphasised row.**
 */
export function ContestantRow({ label, state }: { label: string; state?: string }): JSX.Element {
  return (
    <li
      data-eln="contestant"
      className="flex min-w-0 items-baseline justify-between gap-[12px] px-[12px] py-[10px]"
    >
      <span className="min-w-0 break-words text-[13px] leading-[1.45] text-sp-ink-2">{label}</span>
      {state !== undefined && <span className={`${ELN_MICRO} shrink-0`}>{state}</span>}
    </li>
  );
}

/**
 * THE INERT WELL — where a region has nothing to draw, and is not drawing it.
 *
 * Reused from the accepted Politics/Economy/D1 construction. It is **not** a
 * "map unavailable" placeholder and must never be used as one: §2 forbids
 * leaving a hole where a map would go, because that is still claiming there
 * should be a map. There is no map region on this surface at any breakpoint,
 * so no well stands in for one.
 */
export function Well({ label, minHeightPx = 120 }: { label: string; minHeightPx?: number }): JSX.Element {
  return (
    <div
      data-eln="well"
      role="img"
      aria-label={label}
      style={{
        minHeight: `${minHeightPx}px`,
        backgroundImage:
          'repeating-linear-gradient(135deg, rgba(126,166,186,.05) 0 7px, transparent 7px 14px)',
      }}
      className="flex flex-1 items-center justify-center"
    >
      <span className="font-gn-mono text-[18px] text-sp-ink-3">—</span>
    </div>
  );
}
