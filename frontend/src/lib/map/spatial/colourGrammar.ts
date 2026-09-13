import { DESIGN_REFERENCE } from '@/lib/map/spatial/designRenderTokens';
import type { LegendKey } from './precisionModel';

/**
 * SPATIAL M2 — THE COLOUR GRAMMAR, FROM DESIGN PART I §E.
 *
 * "Five entries only: verified, attention, interpreted, none, reference. IF A
 * COLOUR IS NOT IN THE LEGEND IT MAY NOT APPEAR ON THE MAP."
 *
 * That rule is only enforceable if the legend and the renderer read the same
 * table — Part II §2 says exactly this of `EvidenceLegend`: "driven by the
 * same token map the renderer uses SO THE TWO CAN NEVER DRIFT". This module is
 * that map. The legend renders it; the canvas paints from it; nothing else in
 * the map may name a colour.
 *
 * ── ON REUSING THE PRODUCT'S RELEASED TOKENS ──────────────────────────────
 *
 * The hex values are the `gn-*` Analysis Workspace tokens this product already
 * ships, not new colours: cyan is `gn-geo`, amber `gn-uncertain`, grey
 * `gn-provenance`, slate `gn-hud`. Part I §E specifies the GRAMMAR — which
 * meaning each hue carries — and Part II §10 records the open assumption that
 * "Design needs one pass against real screenshots to confirm tokens". Adopting
 * the released palette satisfies the grammar while leaving that pass able to
 * change four values in one file. Inventing a parallel palette would have made
 * the same pass a rewrite.
 *
 * THE HERO IS UNAFFECTED. Part II §9 forbids shared tokens with the Hero map,
 * and nothing here is imported by it — the Hero keeps its own colours, which
 * is the accepted cost of the freeze.
 */

export interface LegendToken {
  readonly key: LegendKey;
  /** Stroke / marker colour. */
  readonly stroke: string;
  /** Fill colour, applied at `fillOpacity`. */
  readonly fill: string;
  /** Part I §E: "Fill at 12% opacity, stroke at 50%" for verified evidence. */
  readonly fillOpacity: number;
  readonly strokeOpacity: number;
  /** Part I §E: uncertainty is DRAWN, not just labelled. */
  readonly dashed: boolean;
}

/**
 * The five, and only the five.
 *
 * RED IS DELIBERATELY ABSENT. Part I §E: "RED — reserved for explicit critical
 * states declared by the situation model. NEVER APPLIED BECAUSE A TOPIC IS
 * POLITICAL OR VIOLENT." The situation model is In development (Part II §4),
 * so no record can currently declare a critical state — and a token that
 * exists is a token something will eventually be coloured with. It arrives at
 * M5 with the model that earns it.
 */
export const LEGEND_TOKENS: Readonly<Record<LegendKey, LegendToken>> = {
  /* CYAN — verified evidence geography and active intelligence. */
  verified: {
    key: 'verified',
    stroke: '#3ad6e6',
    fill: '#3ad6e6',
    fillOpacity: 0.12,
    strokeOpacity: 0.5,
    dashed: false,
  },
  /* AMBER — attention, change, unresolved question, monitored geography. */
  attention: {
    key: 'attention',
    stroke: '#f2a93c',
    fill: '#f2a93c',
    fillOpacity: 0.1,
    strokeOpacity: 0.55,
    dashed: false,
  },
  /*
    MUTED GREY — UNKNOWN precision, INTERPRETED or CONTESTED provenance.
    "Always dashed, never filled solid — uncertainty is drawn, not just
    labelled." `fillOpacity: 0` is that sentence: there is no value a caller
    can pass that fills it.
  */
  interpreted: {
    key: 'interpreted',
    stroke: '#4a5b67',
    fill: '#4a5b67',
    fillOpacity: 0,
    strokeOpacity: 0.8,
    dashed: true,
  },
  /* No retained evidence. Also grey, also dashed — an absence is not a claim. */
  none: {
    key: 'none',
    stroke: '#4a5b67',
    fill: '#4a5b67',
    fillOpacity: 0,
    strokeOpacity: 0.45,
    dashed: true,
  },
  /*
    SLATE — all reference geography: land, borders, water, labels.
    "Reference never uses an intelligence colour."
  */
  reference: {
    key: 'reference',
    /*
      THE DESIGN REFERENCE'S OWN GEOGRAPHY TOKENS, at revision 1.5:
      `--land:#1e2b36` filled and `--border-geo:#3d5563` for the outline, over
      `--ocean:#040a10`.

      My earlier values were a 5%-opacity slate over the legacy ocean, carried
      from the accepted World Map's resting state. That was the right call while
      the surface WAS the World Map; it is the wrong one now, and it is why the
      canvas read as near-empty against the reference. Land in the reference is
      a solid low-value fill — visibly land — and the intelligence layer sits on
      top of it rather than competing with an almost-invisible ground.

      v1.5 RAISED BOTH. The first build's land and border sat within a couple of
      luminance steps of the ocean, so "visibly land" was true of the intent and
      not of the render. These are the revision's own values, and they are read
      from `DESIGN_REFERENCE` rather than retyped, because this file and the
      render tokens disagreeing about the colour of land is precisely the drift
      that produced the problem the revision fixes.
    */
    stroke: DESIGN_REFERENCE.border,
    fill: DESIGN_REFERENCE.land,
    fillOpacity: 1,
    strokeOpacity: 1,
    dashed: false,
  },
};

export function legendToken(key: LegendKey): LegendToken {
  return LEGEND_TOKENS[key] ?? LEGEND_TOKENS.reference;
}

/**
 * Every colour the map may paint, for the assertion that keeps §E true.
 *
 * A spec can test the renderer's source against this set: a hex literal in a
 * map layer that is not here is a colour with no legend entry, which the rule
 * forbids.
 */
export const PERMITTED_MAP_COLOURS: readonly string[] = [
  ...new Set(Object.values(LEGEND_TOKENS).flatMap((token) => [token.stroke, token.fill])),
];
