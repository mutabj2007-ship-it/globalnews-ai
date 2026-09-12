'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import type { EvidencePrecision } from './geographicEvidenceState';
import {
  GeographicEvidenceMap,
  MAP_HEIGHT_COMPRESSED,
  MAP_HEIGHT_NORMAL,
} from './GeographicEvidenceMap';

/**
 * P-10 — the two-state map surface.
 *
 * PAF-R1.2 replaced this component's schematic body with real country
 * geometry (see `GeographicEvidenceMap`). It survives as the frame's stable
 * seam: the height constants and the two-state contract live here, so the
 * rail's callers and the geometry tests did not have to move.
 *
 * No zoom, pan or re-centre control at any height — unchanged, and still
 * asserted by PAF test 18. No interactive map library is introduced.
 */
export { MAP_HEIGHT_NORMAL, MAP_HEIGHT_COMPRESSED };

export interface CompactMapProps {
  evidenceCountryCode: string | null;
  evidenceCountryName: string | null;
  evidencePrecision: EvidencePrecision;
  compressed?: boolean;
  language?: LanguageCode;
}

export function CompactMap(props: CompactMapProps): JSX.Element {
  return <GeographicEvidenceMap {...props} />;
}
