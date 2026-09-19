'use client';

import { useReducer, type JSX } from 'react';
import { resolveSecStrings, type SecLocale } from '@/lib/security/securityStrings';
import { SECURITY_DETENTS } from '@/lib/security/securityZones';
import {
  EmptyPlot, EntryPoint, Region, SEC_MICRO, SeverityLadder, StateCell, UnboundValue, Zone, ZoneA0,
} from './SecParts';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART IX · SECURITY — THE COMPACT READER SURFACE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * FOUR DETENTS, AND TWO ZONES THAT SURVIVE ALL OF THEM.
 *
 *   P1 PEEK       152px    identity, change state, essential geography behind
 *   P2 HALF       52vh     assessment, key evidence, Watch. HUD content folds in here
 *   P3 FULL       92vh     sustained detail, sources, Timeline, configuration
 *   P4 WORKSPACE           overlays and replaces without reflowing the application
 *
 * **A0 and C2 persist at every detent.** Main says it three times — A0 *"must carry A0 and
 * C2"* at PEEK, *"A0 persists"* at HALF and FULL — and Part IX's own reduction rule is the
 * reason: *"cuts at 1280 remove resident detail … never honesty markers."* On a 390px phone
 * at a 152px peek, the honesty markers are the FIRST thing that a reasonable engineer would
 * cut, which is exactly why the rule names them.
 *
 * *"Withheld regions stay withheld at every detent."* A detent is a disclosure control, not
 * an authorisation: nothing that is absent at FULL appears in WORKSPACE.
 *
 * ── NOT A SQUEEZED DESKTOP ────────────────────────────────────────────────
 *
 * The desktop frame is four permanent regions side by side with a capped rail. This one is a
 * single column under a detent control, and the content a detent reveals is Main's own list
 * for that detent rather than "more of the desktop". PEEK carries identity and change state;
 * the substrate's plots do not appear until FULL, because a 152px peek showing an empty plot
 * area would spend the whole peek on a hatch.
 */

type Detent = 'PEEK' | 'HALF' | 'FULL' | 'WORKSPACE';
const DETENT_ORDER: readonly Detent[] = ['PEEK', 'HALF', 'FULL', 'WORKSPACE'];

interface View { readonly detent: Detent }
type Action = { k: 'SET'; v: Detent };
const reducer = (_s: View, a: Action): View => ({ detent: a.v });

/** The detent's own height. WORKSPACE overlays and is not a height. */
function detentStyle(detent: Detent): { readonly height?: string } {
  if (detent === 'PEEK') return { height: `${SECURITY_DETENTS.PEEK_PX}px` };
  if (detent === 'HALF') return { height: `${SECURITY_DETENTS.HALF_VH}vh` };
  if (detent === 'FULL') return { height: `${SECURITY_DETENTS.FULL_VH}vh` };
  return {};
}

export function SecurityCompactScreen({ locale }: { locale: SecLocale }): JSX.Element {
  const [view, dispatch] = useReducer(reducer, { detent: 'HALF' });
  const res = resolveSecStrings(locale);
  const t = res.strings;
  const atLeast = (d: Detent): boolean => DETENT_ORDER.indexOf(view.detent) >= DETENT_ORDER.indexOf(d);

  return (
    <main data-sec="compact-screen" data-sec-detent={view.detent}
      className="flex min-h-screen flex-col bg-sp-bg text-sp-ink">

      {res.fellBack && (
        <div data-sec="locale-fallback" className={`${SEC_MICRO} break-words border-b border-sp-line bg-sp-panel-2 px-[14px] py-[8px]`}>
          {t.labels.localeFallback}
        </div>
      )}

      {/*
        A0 — FIRST, RESIDENT, AND OUTSIDE THE DETENT.

        It is deliberately not inside the detent container: a sheet that can shrink is a sheet
        that can shrink this away, and *"never dismissible never collapsed"* has to be
        structural at 390px or it is not a rule.
      */}
      <ZoneA0 />

      <header data-sec="region" data-sec-region="A"
        className="flex shrink-0 flex-col gap-[6px] border-b border-sp-line bg-sp-panel px-[14px] py-[10px]">
        <Zone id="A1">
          <h1 className="text-[16px] font-semibold text-sp-ink">{t.zoneLabels.A1}</h1>
        </Zone>
        <Zone id="A2">
          <span className={`${SEC_MICRO} break-words text-sp-ink-2`}>{t.zoneLabels.A2}</span>
        </Zone>
        <div className="flex flex-wrap items-end gap-[10px_18px]">
          <Zone id="A3" className="flex min-w-0 flex-col gap-[3px]">
            <span className={SEC_MICRO}>{t.labels.changeState}</span>
            <UnboundValue zoneId="A3" label={t.labels.changeState} />
          </Zone>
          <SeverityLadder rungs={t.severityRungs} label={t.labels.severity} />
        </div>
      </header>

      {/*
        THE DETENT CONTROL. Replacement, never stacking — the reducer holds ONE value, so
        moving between detents is structurally the same act as choosing one.
      */}
      <nav data-sec="detent-control" aria-label={t.labels.detent}
        className="flex shrink-0 gap-[1px] border-b border-sp-line bg-sp-line">
        {DETENT_ORDER.map((d) => (
          <button key={d} type="button" data-sec="detent-button" data-sec-detent-target={d}
            aria-pressed={view.detent === d}
            onClick={() => dispatch({ k: 'SET', v: d })}
            className={`${SEC_MICRO} min-h-[44px] flex-1 px-[6px] ${
              view.detent === d ? 'bg-sp-panel-2 text-sp-cyan' : 'bg-sp-panel text-sp-ink-3'
            }`}>
            {t.detents[d]}
          </button>
        ))}
      </nav>

      <div data-sec="detent-body" style={detentStyle(view.detent)}
        className="flex flex-col gap-[14px] overflow-y-auto p-[14px]">

        {/*
          C2 · PERSISTS AT EVERY DETENT, INCLUDING PEEK.

          *"Must carry A0 and C2 … honesty markers are never among the cuts."* At PEEK this
          and the identity rows are the whole screen, which is the correct trade: a reader who
          sees only two things should see the two that stop a wrong inference.
        */}
        <StateCell id="C2" label={t.zoneLabels.C2} />

        {/* P2 HALF · assessment and key evidence fold in here. */}
        {atLeast('HALF') && (
          <>
            <Zone id="A5" className="flex flex-col gap-[10px]">
              <StateCell id="A5" label={t.zoneLabels.A5_occurrence} />
              <StateCell id="A5" label={t.zoneLabels.A5_cause} />
              <StateCell id="A5" label={t.zoneLabels.A5_actor} />
            </Zone>
            <Zone id="B1">
              <span className={`${SEC_MICRO} text-sp-ink-2`}>{t.zoneLabels.B1}</span>
            </Zone>
            <Zone id="B2" className="flex flex-col" />
            <StateCell id="B4" label={t.zoneLabels.B1} />
            <StateCell id="A7" label={t.zoneLabels.A7} />
          </>
        )}

        {/* P3 FULL · sustained detail, sources, and the substrate's own regions. */}
        {atLeast('FULL') && (
          <>
            <Region id="C1" title={t.zoneLabels.C1}>
              <EmptyPlot id="C1" minHeightPx={150} />
            </Region>
            <Region id="C3" title={t.zoneLabels.C3}>
              <EmptyPlot id="C3" minHeightPx={90} />
            </Region>
            <Region id="C4" title={t.zoneLabels.C4}>
              <div className="flex flex-col gap-[10px]">
                <StateCell id="C4" label={t.attribution.claimed} />
                <StateCell id="C4" label={t.attribution.suspected} />
                <StateCell id="C4" label={t.attribution.unknown} />
              </div>
            </Region>
            {/* Substrate NAMES only. The two taxonomies stay withheld at every detent. */}
            <Region id="C5" title={t.zoneLabels.C5}>
              <EmptyPlot id="C5" minHeightPx={80} />
            </Region>
            <Region id="C7" title={t.zoneLabels.C7}>
              <EmptyPlot id="C7" minHeightPx={80} />
            </Region>
            <StateCell id="C10" label={t.zoneLabels.C10} />
            <StateCell id="C11" label={t.zoneLabels.C11} />
            <StateCell id="C12" label={t.zoneLabels.C12} />
          </>
        )}

        {/*
          P4 WORKSPACE · *"overlays and replaces without reflowing the application"*, and
          *"zero metered AI on resize popup drawer map or detent"*. It adds the priced control
          and adds no data — a workspace that revealed something FULL withheld would make a
          detent an authorisation.
        */}
        {view.detent === 'WORKSPACE' && (
          <EntryPoint id="D5" label={t.zoneLabels.D5} note={t.labels.analysisCost} />
        )}
      </div>

      {/* ══ REGION D · context bar · entry points only ═══════════════════ */}
      <nav data-sec="region" data-sec-region="D" aria-label={t.domain}
        className="flex shrink-0 items-center gap-[12px] overflow-x-auto border-t border-sp-line bg-sp-panel px-[14px] py-[8px]">
        <Zone id="D1" className="hidden" />
        <EntryPoint id="D2" label={t.zoneLabels.D2} />
        <EntryPoint id="D3" label={t.zoneLabels.D3} />
        <EntryPoint id="D4" label={t.zoneLabels.D4} />
        <EntryPoint id="A6" label={t.zoneLabels.A6} />
      </nav>
    </main>
  );
}
