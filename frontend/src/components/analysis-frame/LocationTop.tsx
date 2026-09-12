'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import type { AnalysisRetrievalContext } from '@globalnews-ai/shared';
import { LocationImage, type LocationImageTier } from './LocationImage';
import { buildGeographicEvidenceState } from './geographicEvidenceState';
import type { LocationAssetRegistry } from './locationAssets';

/**
 * P-07 — row 1, column 3. The location image and its provenance, at the
 * same top level as the brief (12 §1).
 *
 * Receives the RESOLVED geography and nothing else. There is no `query`
 * prop on this component or on anything it renders.
 *
 * PAF-R1.2 / P1 — THIS PANEL CARRIES NO GEOGRAPHY HEADING. R1 rendered a
 * heading here that named the panel a resolved location. That wording is
 * removed, and its dictionary key with it: the rail must not assert that
 * a place was resolved when the evidence establishes a country and the
 * question named a city. The panel's own provenance chip already names
 * the place it is showing, and `LocationDetail` beneath it states the
 * query target and the evidence geography as two separate, labelled
 * facts. Removing the heading also returns 20px to a 196px row that the
 * heading pushed the provenance caption out of.
 *
 * `geographicEvidence.spec.ts` asserts against this file's own source
 * text that the heading cannot return silently, so the phrasing above
 * is deliberately paraphrased.
 *
 * PAF-R1.2 — THE COMPRESSED STRIP. Compressed row 1 is 52px. The tier this
 * component used to pass came to 80px with its caption, so the panel
 * rendered its own provenance text sliced through the middle. F-7 is
 * `compress before hide`, and PAF-5 names this figure among the six
 * elements a constrained height may not remove, so dropping it was never
 * an option: the fix is the `strip` tier, which is sized to fit. The
 * figure, its provenance chip and its caption all survive at 720px.
 */
export interface LocationTopProps {
  retrievalContext: AnalysisRetrievalContext | undefined;
  compressed?: boolean;
  language?: LanguageCode;
  registry?: LocationAssetRegistry;
}

export function LocationTop({
  retrievalContext,
  compressed = false,
  language = 'en',
  registry,
}: LocationTopProps): JSX.Element {
  // PAF-R1.2 — the image follows EVIDENCE geography, not the retrieval
  // target. A question naming Kigali must not put a Kigali photograph
  // beside country-level evidence.
  const state = buildGeographicEvidenceState(retrievalContext);
  const place = state.evidenceCountryName;
  // Compressed row 1 is 52px — see the header note. `compressed` is the
  // frame's own flag, so this panel cannot disagree with the brief.
  const tier: LocationImageTier = compressed ? 'strip' : 'expanded';

  return (
    <div
      data-paf="location-top"
      data-variant={compressed ? 'strip' : 'full'}
      className={
        compressed
          ? 'flex h-full min-h-0 flex-col overflow-hidden px-4 py-[3px]'
          : 'flex h-full min-h-0 flex-col overflow-hidden px-4 py-3'
      }
    >
      <LocationImage
        precision={state.evidencePrecision}
        resolvedPlace={place}
        tier={tier}
        language={language}
        registry={registry}
      />
    </div>
  );
}
