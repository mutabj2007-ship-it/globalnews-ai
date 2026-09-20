'use client';

import type { JSX } from 'react';
import { ReturnControl } from '@/components/navigation/ReturnControl';
import { resolveSecStrings, type SecLocale } from '@/lib/security/securityStrings';
import { SECURITY_GEOMETRY } from '@/lib/security/securityZones';
import {
  EmptyPlot, EntryPoint, Region, SEC_MICRO, SeverityLadder, StateCell, UnboundValue, Zone, ZoneA0,
} from './SecParts';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART IX · SECURITY — THE DESKTOP READER SURFACE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * FOUR PERMANENT REGIONS, AND A ZONE TABLE THAT DECIDES EVERY ONE OF THEM.
 *
 *   A  state bar      96 / 104 / 104 h   full width, prose capped at 74ch
 *   B  attention      320 / 360 / 360 w  capped, never absorbs surplus, scrolls internally
 *   C  substrate      896 / 1068 / 1236  principal absorber, min 560, grows only as itself
 *   D  context bar    64 / 72 / 72 h
 *      page           1680 cap, centres past it, surplus becomes margin
 *
 * *"E is not a fifth region. Wide screens expand the same intelligence object; they do not
 * multiply dashboard regions. B and C never nest as scrolling surfaces."*
 *
 * ── WHAT IS NOT HERE, AND WHY THAT IS THE POINT ───────────────────────────
 *
 * Nine zones are NOT RENDERED and leave no trace — no placeholder, no greyed control, no
 * "unavailable" chip, no legend, no empty canvas. Main's rule 3 explains why the temptation
 * to mark them must be resisted: *"a withheld-region marker is itself the disclosure — it
 * tells a reader the capability exists and is being withheld."*
 *
 * So there is no relationship-graph canvas (X1), no border-detail drawer (X2), no asset-class
 * or zone-class legend (C6, C8), no posture value (C9), no aggregate dependency view (X8),
 * no verbatim artifact (X5), no watch composition or count (X7) — and **no person position of
 * any kind** (X6). PO-1 is enforced by there being no field, no slot, no placeholder and no
 * dash where a person would go.
 *
 * ── THE TWO COUNTS THAT ARE NOT ON THIS PAGE ──────────────────────────────
 *
 * Main's rule 2: *"A count of zero is a claim, and a false one. No zone renders 0."* Not the
 * attention queue, not incidents, not evidence, not watch targets, not relationship edges.
 * There is no numeral anywhere in this file, and a guard asserts it against the rendered
 * text rather than against my care.
 *
 * ── A NOTE ON REGION A's STATED HEIGHT, DISCLOSED RATHER THAN RESOLVED ────
 *
 * Main gives region A a FIXED height of 96/104/104 and assigns it eight zones, two of which
 * are prose: A0's honesty sentence and A5's three-column statement block. Those do not fit in
 * 104px together with A1–A4, A6 and A7.
 *
 * Rather than clip a zone marked *"never collapsed"* or silently stretch a figure marked
 * *"fixed"*, this frame reads the figure as the height of the STATE BAR proper — A1–A4, A6,
 * A7 — and renders A0 above it and A5 below it as the resident siblings they are. The bar is
 * exactly the stated height at each breakpoint. **This is the one geometry question in the
 * package and it is raised, not decided.**
 */
export function SecurityScreen({ locale }: { locale: SecLocale }): JSX.Element {
  const res = resolveSecStrings(locale);
  const t = res.strings;
  const g = SECURITY_GEOMETRY;

  return (
    <main
      data-sec="screen"
      className="flex min-h-screen flex-col bg-sp-bg text-sp-ink"
      style={{ maxWidth: `${g.pageCapPx}px`, marginInline: 'auto', width: '100%' }}
    >
      {res.fellBack && (
        <div data-sec="locale-fallback" className={`${SEC_MICRO} border-b border-sp-line bg-sp-panel-2 px-[20px] py-[8px]`}>
          {t.labels.localeFallback}
        </div>
      )}

      {/* ══ A0 · resident, non-dismissible, first in the document ═════════ */}
      <ZoneA0 />

      {/* ══ REGION A · the state bar, at its stated fixed height ═════════ */}
      <header
        data-sec="region"
        data-sec-region="A"
        style={{ height: `${g.stateHeightPx[1]}px` }}
        className="flex shrink-0 items-center justify-between gap-[20px] border-b border-sp-line bg-sp-panel px-[20px]"
      >
        <div className="flex min-w-0 flex-col gap-[4px]">
          <div className="flex min-w-0 items-center gap-[10px]">
            {/* ALPHA MAJOR CONVERGENCE R1 — HOST B: leading item of the EXISTING top micro-line. No row is added; this line already renders at its own height. */}
            <ReturnControl language={locale} variant="microline" />
            <Zone id="A1">
              <h1 className="text-[18px] font-semibold text-sp-ink">{t.zoneLabels.A1}</h1>
            </Zone>
          </div>
          {/*
            A2 · a FIXED label that binds nothing. It must not fabricate an incident, a
            threat, a jurisdiction, a protected asset or a monitored person or group — and
            because it is fixed rather than derived, none of those can reach it.
          */}
          <Zone id="A2">
            <span className={`${SEC_MICRO} text-sp-ink-2`}>{t.zoneLabels.A2}</span>
          </Zone>
        </div>

        <div className="flex flex-wrap items-end gap-[10px_22px]">
          {/*
            A3 · the change state, as an UNBOUND VALUE — one of the only two places a dash is
            admissible. `NO_MATERIAL_CHANGE` must never render here: it answers "did it move",
            not "do we know", and substituting it for an absence is the A-24 collapse.
          */}
          <Zone id="A3" className="flex min-w-0 flex-col gap-[3px]">
            <span className={SEC_MICRO}>{t.labels.changeState}</span>
            <UnboundValue zoneId="A3" label={t.labels.changeState} />
          </Zone>

          <SeverityLadder rungs={t.severityRungs} label={t.labels.severity} />

          {/*
            A7 · the freshness marker. *"A-23 unbuilt so the honest value is NOT_ASSESSED not
            a timestamp and not a dash."* A dash here would read as a missing timestamp — as
            though an assessment had happened and its time were mislaid.
          */}
          <StateCell id="A7" label={t.zoneLabels.A7} />

          {/* A6 · Ask. Renders, does not invoke, carries no pre-filled scope. */}
          <EntryPoint id="A6" label={t.zoneLabels.A6} note={t.labels.zeroMeteredAi} />
        </div>
      </header>

      {/*
        ══ A5 · THREE COLUMNS THAT NEVER MERGE ═══════════════════════════

        *"Three columns that never merge. Each cell carries its own state independently."*
        Three `StateCell`s rather than one row with separators, so a later change that wanted
        a single sentence would have to delete two components rather than edit a template.

        *"Actor column carries institutions and organised groups only"* — and at Alpha it
        carries no value at all, which is why there is no actor slot to gate.
      */}
      <div
        data-sec="region"
        data-sec-region="A5"
        className="grid shrink-0 gap-[12px_28px] border-b border-sp-line bg-sp-panel px-[20px] py-[10px] [grid-template-columns:repeat(3,minmax(0,1fr))]"
        style={{ maxWidth: `${g.pageCapPx}px` }}
      >
        <StateCell id="A5" label={t.zoneLabels.A5_occurrence} />
        <StateCell id="A5" label={t.zoneLabels.A5_cause} />
        <StateCell id="A5" label={t.zoneLabels.A5_actor} />
      </div>

      {/* ══ REGIONS B + C ════════════════════════════════════════════════ */}
      <div
        data-sec="body"
        className="grid flex-1 gap-[0] [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:var(--sec-cols)]"
        style={{ ['--sec-cols' as string]: `${g.attentionWidthPx[1]}px minmax(${g.substrateMinPx}px, 1fr)` }}
      >
        {/* ── REGION B · attention · capped, scrolls internally ─────────── */}
        <aside
          data-sec="region"
          data-sec-region="B"
          className="flex min-w-0 flex-col gap-[12px] overflow-y-auto border-r border-sp-line bg-sp-panel p-[16px]"
        >
          <Zone id="B1">
            <span className={`${SEC_MICRO} text-sp-ink-2`}>{t.zoneLabels.B1}</span>
          </Zone>

          {/*
            B2 · NO ROWS AND NO COUNT. Main names the forbidden copy for this exact zone —
            *"No incidents / All clear / 0 incidents"* — because an empty queue is where a
            reassuring sentence is most tempting and least earned.

            B4 · the empty queue states WHY it is empty, and *"must not state that nothing is
            happening"*. The N-11 sentence is that statement: it says nothing has been
            assessed, which is a fact about us rather than about the world.
          */}
          <Zone id="B2" className="flex flex-col" />
          <StateCell id="B4" label={t.zoneLabels.B1} />
        </aside>

        {/* ── REGION C · substrate · principal absorber ──────────────────── */}
        <div
          data-sec="region"
          data-sec-region="C"
          className="flex min-w-0 flex-col gap-[18px] overflow-y-auto p-[18px]"
        >
          <Zone id="C0" className="hidden" />

          <Region id="C1" title={t.zoneLabels.C1}>
            <EmptyPlot id="C1" minHeightPx={220} />
            {/*
              C2 · YES_REQUIRED. *"Honesty marker shown even when coarse. Degradation never
              becomes inference. Survives reduction."* It sits with the map because that is
              what it qualifies, and it is one of the three zones whose absence is a defect.
            */}
            <StateCell id="C2" label={t.zoneLabels.C2} />
          </Region>

          <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            <Region id="C3" title={t.zoneLabels.C3}>
              <EmptyPlot id="C3" minHeightPx={120} />
            </Region>

            {/*
              C4 · THE EMPTY THREE-STATEMENT STRUCTURE.

              *"SUSPECTED ATTRIBUTION is never shortened to an actor name. UNKNOWN ACTOR is a
              positive statement not an empty field."* All three are labelled and all three
              carry the N-11 state — including the third, which is a FINDING and would be
              misread as a blank if it were rendered as one.
            */}
            <Region id="C4" title={t.zoneLabels.C4}>
              <div className="flex flex-col gap-[10px]">
                <StateCell id="C4" label={t.attribution.claimed} />
                <StateCell id="C4" label={t.attribution.suspected} />
                <StateCell id="C4" label={t.attribution.unknown} />
              </div>
            </Region>
          </div>

          {/*
            C5 and C7 · SUBSTRATE NAME ONLY.

            *"No asset legend no filter no column headers no chip row"* · *"No zone-class
            legend. No implied live tracking: no radar no aircraft no vessel position no track
            or trajectory."*

            The ten asset classes (C6) and six zone classes (C8) are WITHHELD — *"an
            enumeration discloses a capability"* — and neither list appears in this file, in
            the string catalogue, or anywhere a component can reach. They exist in one place
            only: a guard's input.
          */}
          <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            <Region id="C5" title={t.zoneLabels.C5}>
              <EmptyPlot id="C5" minHeightPx={110} />
            </Region>
            <Region id="C7" title={t.zoneLabels.C7}>
              <EmptyPlot id="C7" minHeightPx={110} />
            </Region>
          </div>

          {/*
            C10 · *"SAFE as a field label. NOT safe as a standalone enumerated legend of all
            twelve classes and never mapped to named providers."* So it is a field label with
            the N-11 state beneath it, and the twelve classes are nowhere.

            C11 · PO-1's gate. *"Claimant renders BY CLASS never by name. Where the class
            cannot be stated without the name, the claim does not display."* At Alpha nothing
            displays, and there is no name slot to gate — the gate is documented here so it is
            built at C11 when data arrives rather than discovered then.

            C12 · the artifact data tier. *"Achromatic. Amber mint and red are never borrowed
            to mark a tier."* A tier is a per-artifact condition, not a reader absence state,
            and `UNAVAILABLE` there is a different thing from `SEC_COVERAGE_GAP`.
          */}
          <div className="grid gap-[12px_24px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
            <StateCell id="C10" label={t.zoneLabels.C10} />
            <StateCell id="C11" label={t.zoneLabels.C11} />
            <StateCell id="C12" label={t.zoneLabels.C12} />
          </div>
        </div>
      </div>

      {/* ══ REGION D · context bar · fixed height, entry points only ═════ */}
      <nav
        data-sec="region"
        data-sec-region="D"
        aria-label={t.domain}
        style={{ height: `${g.contextHeightPx[1]}px` }}
        className="flex shrink-0 items-center gap-[16px] overflow-x-auto border-t border-sp-line bg-sp-panel px-[20px]"
      >
        <Zone id="D1" className="hidden" />
        {/*
          D2 · PO-6. *"Entry point only. No target names no composition NO COUNT. Registers
          nothing at Alpha. Never in URL export or Ask AI scope."* A count is a cardinality
          disclosure of the composition, which is owner-only — so there is no number beside
          this control and no prop that could carry one.
        */}
        <EntryPoint id="D2" label={t.zoneLabels.D2} />
        <EntryPoint id="D3" label={t.zoneLabels.D3} />
        <EntryPoint id="D4" label={t.zoneLabels.D4} />
        {/* D5 · *"Control renders with its cost shown and does not invoke."* */}
        <EntryPoint id="D5" label={t.zoneLabels.D5} note={t.labels.analysisCost} />
      </nav>
    </main>
  );
}
