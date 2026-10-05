import { EAST_AFRICA_MEMBERS, EU27_MEMBERS, MIDDLE_EAST_MEMBERS } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMPACT VISUAL PRODUCT R1 — REGION PRESENTATION, WITH EACH REGION'S DECLARED MEANING
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO §9: "Do not assume every region means the same thing in geography, coverage, retrieval,
 * monitoring. Frontend labels must use the backend's declared meaning." The authority is the
 * East Africa controller's EA-REGION-AUTHORITY-01 matrix
 * (docs/convergence/east-africa/EA-REGION-AUTHORITY-MATRIX.md, base f0e08de). This module encodes
 * it for presentation and asserts nothing new:
 *
 *   · Counts are READ from the shared product-governed lists, never restated. Backend-published
 *     memberships (EAC, M49 Europe) carry no count here — the frontend does not hold them.
 *   · Ask retrieval: only East Africa is a declared retrieval region (backend DECLARED_REGIONS =
 *     [EAST_AFRICA]); a spec reads the backend source so this fact cannot drift silently.
 *   · Middle East is the PRODUCT-GOVERNED monitoring scope — never an agreed geography (matrix
 *     R-2). Europe is M49 Europe, NOT the EU. EAC questions are answered over the East Africa
 *     scope, which is disclosed (matrix R-1).
 *   · Watch: there is NO product-region Watch path (matrix R-5) — no region Watch is drawn.
 *
 * The map buttons only FRAME the camera. They drive no filter, no feed scope and no retrieval,
 * and paint no region (regionMayHighlight is false for every region). The rectangles are views.
 */
export type VisualRegionId = 'world' | 'eastAfrica' | 'eac' | 'europe' | 'eu' | 'middleEast';

export type MembershipBasis = 'NONE' | 'PRODUCT_GOVERNED' | 'TREATY' | 'UN_M49';

export interface VisualRegion {
  readonly id: VisualRegionId;
  readonly bounds: readonly [readonly [number, number], readonly [number, number]];
  readonly membership: MembershipBasis;
  /** Read from the shared product-governed list; null when the frontend holds no list. */
  readonly memberCount: number | null;
  /** Ask has a declared retrieval scope for this region (backend DECLARED_REGIONS). */
  readonly askRetrieval: boolean;
}

export const VISUAL_REGIONS: readonly VisualRegion[] = [
  { id: 'world', bounds: [[-168, -56], [178, 76]], membership: 'NONE', memberCount: null, askRetrieval: false },
  { id: 'eastAfrica', bounds: [[21, -13], [52, 19]], membership: 'PRODUCT_GOVERNED', memberCount: EAST_AFRICA_MEMBERS.length, askRetrieval: true },
  { id: 'eac', bounds: [[12, -13], [52, 13]], membership: 'TREATY', memberCount: null, askRetrieval: false },
  { id: 'europe', bounds: [[-25, 34], [45, 71]], membership: 'UN_M49', memberCount: null, askRetrieval: false },
  { id: 'eu', bounds: [[-25, 34], [35, 70]], membership: 'TREATY', memberCount: EU27_MEMBERS.length, askRetrieval: false },
  { id: 'middleEast', bounds: [[25, 12], [63, 42]], membership: 'PRODUCT_GOVERNED', memberCount: MIDDLE_EAST_MEMBERS.length, askRetrieval: false },
];

export function visualRegion(id: VisualRegionId): VisualRegion {
  const region = VISUAL_REGIONS.find((r) => r.id === id);
  if (region === undefined) throw new Error(`unknown region ${id}`);
  return region;
}
