'use client';

import type { JSX, ReactNode } from 'react';
import type { DeliveryTreatment } from '@/lib/delivery/deliveryPreview';

/**
 * IMIHIGO / DELIVERY · THE LOCAL PARTS.
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
 * ── NO COLOUR CARRIES A PERFORMANCE MEANING ──────────────────────────────
 *
 * A chip that turned one colour for a delivered commitment and another for an
 * undelivered one would be a score whatever its values were called, and §0.2 is
 * a direct prohibition on scores. Every chip here is the same hairline on the
 * same fill, and the words carry the meaning.
 *
 * **There is no amber on this surface.** The accepted rule reserves amber for
 * slots expressing change or lateness; for Imihigo that is `CHANGE` and nowhere
 * else, and `CHANGE` collapses because no achieved result is published. The
 * `amber` prop below therefore exists and is never passed — a guard asserts
 * that, so the day a result IS published the affordance is already correct
 * rather than invented in a hurry.
 */

/** The micro label ramp, matching the shared specialist components exactly. */
export const DEL_MICRO = 'font-gn-mono text-[9.5px] uppercase tracking-[0.14em] text-sp-ink-3';

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
    <section data-del="region" className="flex min-w-0 flex-col gap-[10px]">
      <div className="flex flex-wrap items-baseline gap-[10px]">
        <span aria-hidden="true" className="h-[5px] w-[5px] shrink-0 self-center rounded-full bg-sp-cyan/70" />
        <h2 className={`${DEL_MICRO} font-medium text-sp-ink-2`}>{title}</h2>
        {note !== undefined && <span className={DEL_MICRO}>{note}</span>}
      </div>
      {children}
    </section>
  );
}

/** A panel. The one container shape this surface uses. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <div data-del="panel" className={`border border-sp-line bg-sp-panel ${className}`}>
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
      data-del="chip"
      data-del-amber={amber ? 'true' : undefined}
      className={`${DEL_MICRO} border px-[7px] py-[3px] ${
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
  treatment: DeliveryTreatment;
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
      data-del="value-slot"
      data-del-treatment={treatment.carriesNumeral ? 'LOW_VALUE' : treatment.busy ? 'LOADING' : 'ABSENCE'}
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
export function SubjectRow({ label, state, children }: { label: string; state?: string; children?: ReactNode }): JSX.Element {
  return (
    <li
      /*
        R2 · `contestant` -> `subject`. R1 generated this file from the Election
        parts and renamed the component but not the attribute VALUE, so the
        Delivery rows announced themselves as contestants. A leftover, surfaced
        by the RC-4 probe rather than by review; the value is a test and query
        hook, carries no visual meaning, and nothing rendered changes.
      */
      data-del="subject"
      className="flex min-w-0 flex-wrap items-baseline justify-between gap-[12px] px-[12px] py-[10px]"
    >
      <span className="min-w-0 break-words text-[13px] leading-[1.45] text-sp-ink-2">{label}</span>
      {state !== undefined && <span className={`${DEL_MICRO} shrink-0`}>{state}</span>}
      {children !== undefined && <div className="min-w-0 basis-full break-words text-[12px] leading-[1.55] text-sp-ink-3">{children}</div>}
    </li>
  );
}

/**
 * THE INERT WELL — where a region has nothing to draw, and is not drawing it.
 *
 * Reused from the accepted Politics/Economy/D1 construction. **It is not a map
 * and must never become one.** No boundary geometry is held for Rwanda,
 * `geometryLicenceFor('RW')` is `NONE`, and every extent in the product is *"a
 * camera aid, never a border."* A choropleth, a district shading, any fill
 * keyed to a value and any synthetic outline are absolutely forbidden — and so
 * is a well that stands in for one.
 */
export function Well({ label, minHeightPx = 120 }: { label: string; minHeightPx?: number }): JSX.Element {
  return (
    <div
      data-del="well"
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
