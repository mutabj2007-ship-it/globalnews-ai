'use client';

import type { JSX, ReactNode } from 'react';
import { SECURITY_ABSENCE_FALLBACK, securityAbsenceLabel } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE ONE PRESENTATION QUESTION MAIN'S TABLE DOES NOT SETTLE, AND HOW IT IS READ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Main's TSV gives thirty-odd rendered zones the DATA-NEUTRAL STATE `SEC_NOT_ASSESSED`, and
 * the vocabulary gives that token exactly one reader label — the two-sentence N-11 statement.
 * Rendered literally at every zone, the first desktop capture printed *"Not assessed. This is
 * not a statement that conditions are safe."* **fourteen times on one screen.**
 *
 * That is not a layout complaint. A0 is marked *"N-11 load-bearing. Resident
 * non-dismissible"*, and a sentence repeated fourteen times stops being read at all — the
 * load-bearing marker is the first casualty of its own repetition.
 *
 * SO THE READING IS: A0 carries the full statement, once, resident and non-dismissible, for
 * the whole frame — which is precisely the job Main's table assigns it. Every other zone
 * carries the SAME STATE, rendered as its short marker, with the full statement reaching
 * assistive technology and hover through `title` and `aria-label`. No zone loses its state,
 * no zone gains a different one, and the sentence a reader must not miss is the one they can
 * still see.
 *
 * NOTHING IS EDITED. `SEC_NOT_ASSESSED_SHORT` is the token's own first sentence, carried
 * here rather than in the shared vocabulary because the vocabulary is Main's and this is a
 * presentation reading of it. **Raised in the package, not decided** — if Main wants the full
 * statement at every zone, this constant is the one line that changes.
 */
const SEC_NOT_ASSESSED_SHORT = 'Not assessed';

/**
 * PART IX · SECURITY — THE PRIMITIVES.
 *
 * Shared Spatial `sp-*` tokens, as Politics uses them and as `components/specialist/*`
 * already does. Part IX mints no palette: Main's authority is a zoning and honesty ruling,
 * not a visual redesign, and *"do not redesign Part IX"* cuts both ways — a new token family
 * would be a redesign arriving as CSS.
 */

export const SEC_MICRO = 'font-gn-mono text-[9.5px] uppercase tracking-[0.14em] text-sp-ink-3';

/**
 * ZONE A0 — THE FRAME'S LOAD-BEARING HONESTY STATEMENT.
 *
 * Main: *"N-11 load-bearing. Resident non-dismissible. Survives every reduction incl PEEK
 * 152 and 390px. Never dismissible never collapsed never a dash."*
 *
 * It distinguishes AN ABSENCE OF ASSESSMENT from AN ASSESSMENT OF ABSENCE, and it is the one
 * element on this surface that may not be cut — Part IX's own reduction rule says *"cuts at
 * 1280 remove resident detail … never honesty markers."*
 *
 * THERE IS NO DISMISS CONTROL AND NO COLLAPSED VARIANT, and that is structural rather than a
 * matter of restraint: this component takes no props at all beyond its locale, so there is
 * nothing a caller could pass to hide it. The second sentence — *"This is not a statement
 * that conditions are safe"* — comes from the shared vocabulary, never from a local string,
 * so it cannot be shortened on one surface.
 */
export function ZoneA0(): JSX.Element {
  return (
    <div
      data-sec="zone"
      data-sec-zone="A0"
      role="note"
      className="flex shrink-0 items-center border-b border-sp-line bg-sp-panel-2 px-[20px] py-[8px]"
    >
      <p className="max-w-[74ch] text-[12px] leading-[1.45] text-sp-ink-2">
        {securityAbsenceLabel(SECURITY_ABSENCE_FALLBACK)}
      </p>
    </div>
  );
}

/**
 * A zone wrapper. Every rendered zone carries its Main id in the DOM.
 *
 * That attribute is not decoration: `securityVisualFrame.spec.ts` asserts the rendered
 * surface against `SECURITY_ZONES` row by row, so a zone that appears without a ruling, or a
 * ruled zone that quietly stops rendering, fails a test instead of surviving a review.
 */
export function Zone({ id, children, className = '' }: {
  id: string;
  /*
    OPTIONAL, BECAUSE THREE ZONES ARE SHELLS.

    B2 is the rows container, C0 the substrate shell, D1 the context-bar shell. All three are
    `MAY EXIST EMPTY = YES` and none has content of its own at Alpha — B2 in particular is
    ruled *"no rows and NO COUNT"*, so an empty container is exactly correct. They still
    render, because the conformance spec asserts the rendered surface against Main's table
    and a shell that vanished would be a zone silently missing.
  */
  children?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div data-sec="zone" data-sec-zone={id} className={className}>
      {children}
    </div>
  );
}

/**
 * A labelled cell carrying the N-11 state.
 *
 * IT DOES NOT TAKE A VALUE. The only thing it can render is a state from the shared
 * vocabulary, so there is no parameter through which a figure, a name or a count could
 * arrive — the prohibition is in the signature rather than in a reviewer's attention.
 */
export function StateCell({ label, id }: { label: string; id: string }): JSX.Element {
  const full = securityAbsenceLabel(SECURITY_ABSENCE_FALLBACK);
  return (
    <Zone id={id} className="flex min-w-0 flex-col gap-[3px]">
      <span className={SEC_MICRO}>{label}</span>
      <span
        data-sec="state"
        data-sec-state={SECURITY_ABSENCE_FALLBACK}
        title={full}
        aria-label={`${label}. ${full}`}
        className="break-words text-[12px] leading-[1.4] text-sp-ink-2"
      >
        {SEC_NOT_ASSESSED_SHORT}
      </span>
    </Zone>
  );
}

/**
 * THE UNBOUND-VALUE DASH — PERMITTED ON EXACTLY TWO ZONES.
 *
 * Main's vocabulary table is explicit: the em dash is *"not a member"* of the five, it means
 * *"a value whose field is known to exist and whose absence asserts nothing"*, and it is
 * *"permitted only at A3 A4 as an unbound value. A dash is an answer only where there was no
 * question."*
 *
 * So this component takes the zone id and refuses anywhere else. A dash at A7 would read as
 * a missing timestamp rather than as "never assessed"; a dash in a person position would
 * answer PO-1 in the permissive direction without anyone having ruled — which is exactly why
 * Main wrote X6.
 */
const DASH_PERMITTED = new Set(['A3', 'A4']);

export function UnboundValue({ zoneId, label }: { zoneId: 'A3' | 'A4'; label: string }): JSX.Element {
  if (!DASH_PERMITTED.has(zoneId)) throw new Error(`dash not permitted at ${zoneId}`);
  return (
    <span data-sec="unbound" aria-label={label} className="font-gn-mono text-[13px] text-sp-ink-3">
      —
    </span>
  );
}

/**
 * ZONE A4 — THE SEVERITY LADDER, STRUCTURE WITH NO VALUE SELECTED.
 *
 * *"Ladder structure renders with no value selected. Never defaults to LOW. No composite
 * score no trend glyph."*
 *
 * Defaulting to the lowest rung is the failure this zone exists to prevent, and it is an easy
 * one: a ladder component that takes `severity: Severity` has already defaulted by the time
 * anyone reviews it. This one takes no severity at all — the rungs are labels, none is
 * marked, and there is no prop through which one could be.
 *
 * ACHROMATIC. No rung carries a hue. A coloured ladder with nothing selected still teaches a
 * reader which end is bad, and the shared severity treatment is typographic (C·1: no hue
 * below CRITICAL) precisely so an unselected ladder says nothing.
 */
export function SeverityLadder({ rungs, label }: {
  rungs: readonly string[]; label: string;
}): JSX.Element {
  return (
    <Zone id="A4" className="flex min-w-0 flex-col gap-[3px]">
      <span className={SEC_MICRO}>{label}</span>
      <div className="flex flex-wrap items-center gap-[1px]" role="group" aria-label={label}>
        {rungs.map((rung) => (
          <span
            key={rung}
            data-sec="severity-rung"
            data-sec-selected="false"
            className={`${SEC_MICRO} border border-sp-line/70 px-[6px] py-[2px] text-sp-ink-3`}
          >
            {rung}
          </span>
        ))}
      </div>
    </Zone>
  );
}

/** A section heading. One accent, the platform's own, on a marker dot. */
export function Region({ id, title, children, className = '' }: {
  id: string; title: string; children: ReactNode; className?: string;
}): JSX.Element {
  return (
    <section data-sec="zone" data-sec-zone={id} className={`flex min-w-0 flex-col gap-[10px] ${className}`}>
      <div className="flex items-baseline gap-[9px]">
        <span aria-hidden="true" className="h-[5px] w-[5px] shrink-0 self-center rounded-full bg-sp-cyan/70" />
        <h2 className={`${SEC_MICRO} font-medium text-sp-ink-2`}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

/**
 * AN EMPTY PLOT AREA — C1, C3, C5, C7.
 *
 * *"Empty basemap. No incident marks no asset layer no zone layer no interpolated geometry."*
 * *"Empty plot area. No count no density no cluster."*
 *
 * The inert hatch says *this is a plot area and it is not plotting*. It carries no graticule,
 * no coastline, no grid and no marker — an empty basemap with a coastline is still a map of
 * somewhere, and C1's subject is unbound.
 *
 * The accessible name is the N-11 sentence rather than "empty map": a screen-reader user
 * should meet the same honesty statement a sighted one does.
 */
export function EmptyPlot({ id, minHeightPx = 180 }: { id: string; minHeightPx?: number }): JSX.Element {
  return (
    <Zone id={id} className="flex flex-1">
      <div
        role="img"
        aria-label={securityAbsenceLabel(SECURITY_ABSENCE_FALLBACK)}
        style={{
          minHeight: `${minHeightPx}px`,
          backgroundImage:
            'repeating-linear-gradient(135deg, rgba(126,166,186,.05) 0 7px, transparent 7px 14px)',
        }}
        className="flex w-full items-center justify-center border border-sp-line"
      >
        <span
          data-sec="state"
          data-sec-state={SECURITY_ABSENCE_FALLBACK}
          className={`${SEC_MICRO} max-w-[52ch] px-[16px] text-center leading-[1.5]`}
        >
          {SEC_NOT_ASSESSED_SHORT}
        </span>
      </div>
    </Zone>
  );
}

/**
 * AN ENTRY-POINT CONTROL — A6, D2, D3, D4, D5.
 *
 * *"Control renders does not invoke."* It is a `<button>` with no handler and
 * `aria-disabled`, not a link and not a live control: a control that navigated would be
 * invoking, and one that looked disabled without saying so would read as broken rather than
 * as deliberate.
 *
 * D2 carries the hardest rule on the surface — *"Entry point only. No target names no
 * composition NO COUNT."* — and the component has no slot for any of the three.
 */
export function EntryPoint({ id, label, note }: { id: string; label: string; note?: string }): JSX.Element {
  return (
    <Zone id={id} className="flex min-w-0 items-baseline gap-[8px]">
      <button
        type="button"
        data-sec="entry-point"
        aria-disabled="true"
        className={`${SEC_MICRO} min-h-[44px] border border-sp-line px-[12px] text-sp-ink-2`}
      >
        {label}
      </button>
      {note !== undefined && <span className={SEC_MICRO}>{note}</span>}
    </Zone>
  );
}
