/**
 * ════════════════════════════════════════════════════════════════════════════
 * CONTEXTUAL BASEMAP — THE BOUNDARY, NOT THE VENDOR
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Product-Owner ruling 2 of MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1:
 *
 *   "Do NOT hard-code a map vendor. Implement the accepted provider-neutral
 *    basemap boundary: provider URL/style/token injected by configuration; no
 *    vendor-specific product contract in core code; preserve fallback map base;
 *    architecture and HUD must not depend on one provider."
 *
 * The Ask AI specification leaves the same seam open in its own words:
 * "Provider selection, licensing and cost are implementation and procurement
 * decisions and are left open by this specification."
 *
 * ── WHAT THIS MODULE IS, EXACTLY ────────────────────────────────────────────
 *
 * One function that answers one question: which style does the renderer mount?
 * It reads configuration, validates it, and returns EITHER a remote style URL
 * OR nothing, leaving the existing local style in place. It contains no vendor
 * name, no API shape, no tile template, no token format and no per-provider
 * branch — which is the whole point. Swapping providers is a deployment
 * variable, not a code change, and no product contract above this line learns
 * the provider's name.
 *
 * ── THE FALLBACK IS THE DEFAULT, NOT THE ERROR PATH ─────────────────────────
 *
 * With nothing configured the product keeps exactly what it has today: a style
 * with `sources: {}` and one background layer, drawn entirely from bundled
 * public-domain geometry. That is not a degraded mode — it is the accepted
 * guarantee recorded in `labelPlacement.ts`: "no tile server, no style server,
 * nothing that leaks a viewport to a third party". Today the product has ZERO
 * external map endpoints, measured, and an unconfigured deployment still does.
 *
 * ── WHAT CONFIGURING A PROVIDER COSTS, STATED HERE BECAUSE IT IS NOT FREE ───
 *
 * Turning this on sends the viewer's viewport to a third party on every pan,
 * and puts that vendor's own map styling — including its choices about disputed
 * boundaries — underneath this product's CONTESTED semantics. Those are the two
 * consequences the PO's procurement decision is about. This module makes them a
 * deliberate, reversible act rather than a property of the code.
 *
 * ── WHY THE EMPTY STRING IS TREATED AS ABSENT ───────────────────────────────
 *
 * The style URL must reach the browser, so it is a `NEXT_PUBLIC_` variable and
 * is inlined at build time. Next inlines an UNSET `NEXT_PUBLIC_*` as the empty
 * string rather than `undefined`, so `??` never fires and a naive default is
 * silently skipped — the same trap that produced same-origin relative API URLs
 * earlier in this programme. Every read below therefore tests for a non-empty
 * trimmed string, never for `undefined`.
 */

export interface BasemapConfiguration {
  /** A full style document URL. Absent, empty or malformed means "no provider". */
  readonly styleUrl: string | null;
  /** Attribution the provider requires. Never invented; shown only if given. */
  readonly attribution: string | null;
}

/** The literal string an unset NEXT_PUBLIC_ variable becomes after inlining. */
const ABSENT = '';

function readPublic(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === ABSENT ? null : trimmed;
}

/**
 * A style URL is accepted only over HTTPS. A plain-HTTP basemap would downgrade
 * every viewer's transport for the sake of a backdrop, and `http://` is also the
 * shape a copy-pasted internal URL usually arrives in.
 */
export function isUsableStyleUrl(raw: string | null): boolean {
  if (raw === null) return false;
  try {
    return new URL(raw).protocol === 'https:';
  } catch {
    return false;
  }
}

export function readBasemapConfiguration(
  env: Record<string, string | undefined> = process.env as unknown as Record<string, string | undefined>,
): BasemapConfiguration {
  const styleUrl = readPublic(env.NEXT_PUBLIC_BASEMAP_STYLE_URL);
  const attribution = readPublic(env.NEXT_PUBLIC_BASEMAP_ATTRIBUTION);

  return {
    styleUrl: isUsableStyleUrl(styleUrl) ? styleUrl : null,
    attribution,
  };
}

export function basemapIsConfigured(config: BasemapConfiguration): boolean {
  return config.styleUrl !== null;
}

/**
 * ── LAYER ORDER — RULING 3, EXPRESSED AS DATA SO IT CAN BE ASSERTED ─────────
 *
 *   "Required layer order: basemap -> precision/provenance halo ->
 *    evidence/intelligence layers -> labels/HUD. Basemap political-boundary
 *    styling must remain visually subordinate."
 *
 * The renderer inserts every GlobalNews layer ABOVE the basemap's own layers
 * and in this order. It is a constant rather than a comment because a comment
 * cannot fail a test when someone inserts a layer in the wrong band.
 */
export const BASEMAP_LAYER_BANDS = ['basemap', 'halo', 'evidence', 'labels-hud'] as const;
export type BasemapLayerBand = (typeof BASEMAP_LAYER_BANDS)[number];

export function bandRank(band: BasemapLayerBand): number {
  return BASEMAP_LAYER_BANDS.indexOf(band);
}

/**
 * True when `above` may legally be drawn over `below`. The halo sits over the
 * basemap — ruling 3 settled that it may — and under the evidence layers,
 * because a precision halo that occluded the evidence it qualifies would invert
 * the thing it is there to say.
 */
export function mayDrawOver(above: BasemapLayerBand, below: BasemapLayerBand): boolean {
  return bandRank(above) > bandRank(below);
}
