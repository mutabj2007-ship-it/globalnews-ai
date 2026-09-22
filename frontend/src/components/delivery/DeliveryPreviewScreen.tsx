'use client';

import type { JSX } from 'react';
import { SpecialistHudLine } from '@/components/specialist/SpecialistHudLine';
import { ObservedIndicatorStrip } from '@/components/specialist/ObservedIndicatorStrip';
import { HUD_LINE_PX, renderableSlots } from '@/lib/specialist/hudGrammar';
import {
  DELIVERY_COLLAPSED_SLOTS,
  DELIVERY_PREVIEW_SCOPE,
  DELIVERY_SUBJECT_LIST,
  DELIVERY_PREVIEW_STRIP,
  DELIVERY_TREATMENTS,
  deliveryPreviewHud,
} from '@/lib/delivery/deliveryPreview';
import { deliveryStrings, type DeliveryLocale } from '@/lib/delivery/deliveryStrings';
import { DEL_MICRO, Panel, Region, SubjectRow, ValueSlot } from './DelParts';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * IMIHIGO / DELIVERY · THE PREVIEW SCREEN — FOUR REGIONS, ONE COMPONENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── DESKTOP AND COMPACT ARE ONE COMPONENT ────────────────────────────────
 *
 * *"Compact carries the same four regions in the same order. It drops nothing
 * and reorders nothing."* Two files would let a later edit drop a region from
 * one of them and have the drop look like a layout decision. With one component
 * there is no second region list to diverge from the first.
 *
 * ── D-1 · THERE IS NO REMAINING COMPACT CHROME BUDGET. NOT ONE PIXEL. ────
 *
 * `COMPACT_CHROME_HARD_MAX` is the SUM of the top bar and the change strip,
 * derived in code, so the maximum moves with the bars and no future change to
 * either frees a pixel. **No second fixed bar, no sticky sub-header, no
 * persistent filter row, no pinned district selector.** Everything this surface
 * adds is content and it scrolls.
 *
 * ── AND NOTHING ON THIS SURFACE DRAWS ────────────────────────────────────
 *
 * No choropleth, no district or sector shading, no fill or tint keyed to a
 * value, no synthetic boundary, no extent presented as a border, no second
 * Rwanda geography model. **A selector, a list, a breadcrumb and a scope label
 * are identity and are allowed. Anything that draws is geometry and is
 * forbidden.**
 */
export function DeliveryPreviewScreen({ locale, compact }: {
  locale: DeliveryLocale;
  compact: boolean;
}): JSX.Element {
  const t = deliveryStrings(locale);
  const hud = deliveryPreviewHud(t.modeLabel, t.scopeLabel);

  /*
    RC-1 / RC-2 — THE ORDER IS SUPPLIED AND ITS PROVENANCE IS ON THE RECORD.

    §6.2's substance is unchanged and now rests on `RC-3` rather than on
    `queueWasOrderedUpstream`, **which was never going to be true here**: NISR
    publishes no attention ordering and no upstream service ranks these
    subjects. Nothing in this lane sorts; there is no comparator at all.
  */
  const orderReason = DELIVERY_SUBJECT_LIST.orderReason;

  return (
    <div
      data-del-shell={compact ? 'compact' : 'desktop'}
      data-del-order-reason={orderReason}
      className="flex min-h-screen flex-col gap-[18px] bg-sp-bg px-[16px] py-[18px] text-sp-ink-2 md:px-[28px]"
    >
      <header className="flex flex-col gap-[8px]">
        <h1 className="text-[17px] font-medium leading-[1.3] text-sp-ink">{t.title}</h1>
        <p data-del="preview-marker" className={DEL_MICRO}>
          {t.previewMarker}
        </p>
        <p className="max-w-[72ch] text-[12px] leading-[1.55] text-sp-ink-3">{t.previewNote}</p>
      </header>

      {/* ── REGION 1 · THE HUD LINE ─────────────────────────────────────── */}
      <Region title={t.hudRegion} note={`${renderableSlots(hud).length}/7`}>
        <Panel className="px-[10px]">
          <div style={{ height: `${HUD_LINE_PX}px` }} className="flex items-center">
            <SpecialistHudLine line={hud} domain="DELIVERY" />
          </div>
        </Panel>
        {/*
          The collapsed slots, named. `CHANGE` collapses because no achieved
          result is published — a missing figure is never `0`, `—`, `N/A` or an
          empty box of the same width. `WATCH` collapses per §8: no member
          exists, none is registered, and NO WATCH CONTROL IS RENDERED anywhere
          on this surface.
        */}
        <p data-del="collapsed-slots" className={DEL_MICRO}>
          {DELIVERY_COLLAPSED_SLOTS.join(' · ')}
        </p>
      </Region>

      {/* ── REGION 2 · THE COMMITMENT STRIP ─────────────────────────────── */}
      <Region title={t.commitmentRegion}>
        <Panel className="p-[12px]">
          <ObservedIndicatorStrip
            strip={DELIVERY_PREVIEW_STRIP}
            labels={{ ...t.indicatorLabels, indicators: {} }}
            nowMs={0}
            variant={compact ? 'FULL_WIDTH' : 'RAIL'}
          />
        </Panel>
      </Region>

      {/* ── REGION 3 · THE SUBJECT LIST ─────────────────────────────────── */}
      <Region title={t.subjectRegion} note={t.orderReasonLabel[orderReason]}>
        <Panel>
          {/*
            RC-3 · no index parameter on the map callback, so a position cannot
            reach the DOM as content. RC-4 · one component, one props shape, so
            no row differs by where it sits. RC-5 · no connector, rule,
            numbering or directional affordance between rows.
          */}
          <ul data-del="subjects" className="flex flex-col">
            {DELIVERY_SUBJECT_LIST.rows.map((row) => (
              <SubjectRow key={row.id} label={row.label} state={row.stateLabel} />
            ))}
          </ul>
        </Panel>
        <p className="text-[12px] leading-[1.5] text-sp-ink-3">{t.identityNotGeometry}</p>

        {/*
          §7 · the three disjoint treatments, side by side. The middle one is
          the one that matters: a subject with no evidence HAS NOT
          UNDERPERFORMED, so its treatment shares no ink, no border and no glyph
          with a low reported value.
        */}
        <div data-del="treatments" className="flex flex-wrap items-center gap-[10px]">
          <span className={DEL_MICRO}>LOADING</span>
          <ValueSlot treatment={DELIVERY_TREATMENTS.LOADING} label={t.loadingLabel} />
          <span className={DEL_MICRO}>ABSENCE</span>
          <ValueSlot treatment={DELIVERY_TREATMENTS.ABSENCE} label={t.absenceAssertion} />
          <span className={DEL_MICRO}>LOW VALUE</span>
          <ValueSlot treatment={DELIVERY_TREATMENTS.LOW_VALUE} label="placeholder">1</ValueSlot>
        </div>
        <p className="max-w-[72ch] text-[12px] leading-[1.55] text-sp-ink-3">
          {t.absenceIsNotUnderperformance}
        </p>
      </Region>

      {/* ── REGION 4 · COMPETING READINGS ───────────────────────────────── */}
      <Region title={t.readingsRegion}>
        <Panel className="p-[12px]">
          <p className="text-[12px] leading-[1.5] text-sp-ink-3">{t.unresolvedNote}</p>
          <p className={`${DEL_MICRO} mt-[8px]`}>{t.noBoundSubject}</p>
        </Panel>
        <p className="max-w-[72ch] text-[12px] leading-[1.55] text-sp-ink-3">{t.sourceLanguageNote}</p>
      </Region>

      <footer className={DEL_MICRO}>
        {DELIVERY_PREVIEW_SCOPE.iso2} · {DELIVERY_PREVIEW_SCOPE.label}
      </footer>
    </div>
  );
}
