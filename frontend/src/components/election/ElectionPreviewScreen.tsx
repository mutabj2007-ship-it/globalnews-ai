'use client';

import type { JSX } from 'react';
import { SpecialistHudLine } from '@/components/specialist/SpecialistHudLine';
import { ObservedIndicatorStrip } from '@/components/specialist/ObservedIndicatorStrip';
import { HUD_LINE_PX, renderableSlots } from '@/lib/specialist/hudGrammar';
import {
  ELECTION_COLLAPSED_SLOTS,
  ELECTION_PREVIEW_SCOPE,
  ELECTION_SUBJECT_LIST,
  ELECTION_PREVIEW_STRIP,
  ELECTION_TREATMENTS,
  electionPreviewHud,
} from '@/lib/election/electionPreview';
import { electionStrings, type ElectionLocale } from '@/lib/election/electionStrings';
import { Chip, ContestantRow, ELN_MICRO, Panel, Region, ValueSlot } from './ElnParts';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * KENYA ELECTIONS · THE PREVIEW SCREEN — FOUR REGIONS, ONE COMPONENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── WHY DESKTOP AND COMPACT ARE ONE COMPONENT AND NOT TWO ────────────────
 *
 * Both contracts say the same thing twice: *"Compact carries the same four
 * regions in the same order. It drops nothing and reorders nothing"*, and *"a
 * status qualifier or a denominator is not an optional element a narrow
 * viewport may shed."*
 *
 * Two files would let a later edit drop a region from one of them, and the
 * drop would look like a layout decision. **With one component there is no
 * second region list to diverge from the first** — compact changes sizing and
 * nothing else, and a guard asserts the two routes render the same regions in
 * the same order.
 *
 * ── D-1 · THE COMPACT CHROME BUDGET IS EXACTLY SPENT ─────────────────────
 *
 * `COMPACT_CHROME_HARD_MAX = COMPACT_TOP_BAR_PX + COMPACT_CHANGE_STRIP_PX` is
 * the sum itself, derived in code — so the budget is spent BY CONSTRUCTION and
 * cannot stop being spent. **This surface adds no fixed bar, no sticky
 * sub-header, no pinned status legend and no persistent filter row.**
 * Everything below is content and it scrolls. The HUD line is content too
 * (`HUD_LINE_PX` — *"it is never chrome"*) and does not compete with the 82.
 *
 * ── THERE IS NO MAP REGION AT ANY BREAKPOINT ─────────────────────────────
 *
 * Not a map, not a placeholder, and not a well standing in for one. *"Leaving a
 * hole where the map would go is still claiming there should be a map."* The
 * blocker is IEBC rights rather than engineering, and a surface that visibly
 * mourned the geometry would misreport a rights position as a failure.
 */
export function ElectionPreviewScreen({ locale, compact }: {
  locale: ElectionLocale;
  compact: boolean;
}): JSX.Element {
  const t = electionStrings(locale);
  const hud = electionPreviewHud(t.modeLabel, t.scopeLabel);

  /*
    RC-1 / RC-2 — THE ORDER IS SUPPLIED AND ITS PROVENANCE IS ON THE RECORD.

    Nothing here orders anything: the rows render in the order they arrive, and
    there is no comparator in this lane at all. `orderReason` is a REQUIRED
    field on the model, so the list cannot exist without saying where its
    sequence came from.

    `queueWasOrderedUpstream` IS NOT CALLED. R3: it answers "did the shared
    assessment service rank this", its `false` is not this surface's condition,
    and the landed behaviour for `false` is to render the unavailable state —
    which would blank a region that has subjects to show.
  */
  const orderReason = ELECTION_SUBJECT_LIST.orderReason;

  return (
    <div
      data-eln-shell={compact ? 'compact' : 'desktop'}
      data-eln-order-reason={orderReason}
      className="flex min-h-screen flex-col gap-[18px] bg-sp-bg px-[16px] py-[18px] text-sp-ink-2 md:px-[28px]"
    >
      <header className="flex flex-col gap-[8px]">
        <h1 className="text-[17px] font-medium leading-[1.3] text-sp-ink">{t.title}</h1>
        {/* The preview marker. It is a statement of fact about the screen, not a badge. */}
        <p data-eln="preview-marker" className={ELN_MICRO}>
          {t.previewMarker}
        </p>
        <p className="max-w-[72ch] text-[12px] leading-[1.55] text-sp-ink-3">{t.previewNote}</p>
      </header>

      {/* ── REGION 1 · THE HUD LINE ─────────────────────────────────────── */}
      <Region title={t.hudRegion} note={`${renderableSlots(hud).length}/7`}>
        <Panel className="px-[10px]" >
          <div style={{ height: `${HUD_LINE_PX}px` }} className="flex items-center">
            <SpecialistHudLine line={hud} domain="ELECTION" />
          </div>
        </Panel>
        {/*
          The collapsed slots, named. An empty value collapses the slot — it is
          never padded — and `WATCH` is among them for the reason §8 gives: no
          `WatchSubjectType` member exists and none is registered. NO WATCH
          CONTROL IS RENDERED anywhere on this surface: no bell, no follow, no
          disabled affordance, no "coming soon". An offered-then-disabled
          control still tells the reader the feature exists.
        */}
        <p data-eln="collapsed-slots" className={ELN_MICRO}>
          {ELECTION_COLLAPSED_SLOTS.join(' · ')}
        </p>
        <p className="text-[12px] leading-[1.5] text-sp-ink-3">{t.ceilingNote}</p>
      </Region>

      {/* ── REGION 2 · THE INDICATOR STRIP ──────────────────────────────── */}
      <Region title={t.indicatorRegion}>
        <Panel className="p-[12px]">
          <ObservedIndicatorStrip
            strip={ELECTION_PREVIEW_STRIP}
            labels={{ ...t.indicatorLabels, indicators: {} }}
            /*
              `nowMs` is injected by the caller so the render is deterministic —
              the strip's own contract. A fixed epoch is used because nothing is
              bound and nothing can be stale; reading the clock here would make
              the server and client renders disagree.
            */
            nowMs={0}
            variant={compact ? 'FULL_WIDTH' : 'RAIL'}
          />
        </Panel>
      </Region>

      {/* ── REGION 3 · THE CONTESTANT ROWS ──────────────────────────────── */}
      <Region title={t.contestantRegion} note={t.orderReasonLabel[orderReason]}>
        <Panel>
          {/*
            RC-3 · the map callback takes NO index parameter, so a position
            cannot reach the DOM as content even by accident. RC-4 · every row
            is the same component with the same props shape, so no row can
            differ by where it sits. RC-5 · there is no connector, rule,
            numbering or directional affordance between rows.
          */}
          <ul data-eln="contestants" className="flex flex-col">
            {ELECTION_SUBJECT_LIST.rows.map((row) => (
              <ContestantRow key={row.id} label={row.label} state={row.stateLabel} />
            ))}
          </ul>
        </Panel>
        {/*
          §5.3 · the three disjoint treatments, rendered side by side so a
          reviewer can see they cannot be mistaken for one another. No figure is
          bound, so the VALUE slot carries a placeholder numeral rather than an
          election number — and the absence slot carries NO numeral at all,
          which is why a reported `0` and an absent figure can never look alike.
        */}
        <div data-eln="treatments" className="flex flex-wrap items-center gap-[10px]">
          <span className={ELN_MICRO}>LOADING</span>
          <ValueSlot treatment={ELECTION_TREATMENTS.LOADING} label={t.loadingLabel} />
          <span className={ELN_MICRO}>ABSENCE</span>
          <ValueSlot treatment={ELECTION_TREATMENTS.ABSENCE} label={t.absenceAssertion} />
          <span className={ELN_MICRO}>VALUE</span>
          <ValueSlot treatment={ELECTION_TREATMENTS.VALUE} label="placeholder">0</ValueSlot>
        </div>
        {/*
          §5.1 rendered as TWO ELEMENTS, which is the whole point of the
          decomposition: `NIEPEŁNE` can render PARTIAL and cannot reach
          PROVISIONAL, because PROVISIONAL is COMPLETE on that axis.
        */}
        <div data-eln="axes" className="flex flex-wrap items-center gap-[8px]">
          <Chip>{t.reportedness.PARTIAL}</Chip>
          <Chip>{t.reportedness.COMPLETE}</Chip>
          <Chip>{t.finality.UNCERTIFIED}</Chip>
          <Chip>{t.finality.CERTIFIED}</Chip>
          {/* Amber, in the one place the accepted rule allows: a change. */}
          <Chip amber>{t.corrected}</Chip>
        </div>
      </Region>

      {/* ── REGION 4 · COMPETING READINGS ───────────────────────────────── */}
      <Region title={t.readingsRegion}>
        {/*
          `CompetingReadingsBlock` renders ONLY where readings disagree, and a
          block needs at least two readings — one reading is not a
          disagreement. Nothing is bound here, so the region states that rather
          than rendering an empty dispute.
        */}
        <Panel className="p-[12px]">
          <p className="text-[12px] leading-[1.5] text-sp-ink-3">{t.readingsLabels.unresolvedNote}</p>
          <p className={`${ELN_MICRO} mt-[8px]`}>{t.noBoundSubject}</p>
        </Panel>
      </Region>

      <footer className={ELN_MICRO}>
        {ELECTION_PREVIEW_SCOPE.iso2} · {ELECTION_PREVIEW_SCOPE.label} ·{' '}
        {ELECTION_PREVIEW_SCOPE.presentationCeiling}
      </footer>
    </div>
  );
}
