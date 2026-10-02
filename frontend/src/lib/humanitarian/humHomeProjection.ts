import {
  assertBriefIsWellFormed,
  projectHumanitarianBrief,
  projectWorkspaceFromRead,
  type HumanitarianBrief,
  type HumanitarianRetainedRead,
} from '@globalnews-ai/shared';
import { humanitarianEn } from '@/lib/i18n/dictionaries/humanitarianEn';
import { humanitarianPl } from '@/lib/i18n/dictionaries/humanitarianPl';
import { humReaderDisplayGate, type HumRowAttribution } from './humReadPresentation';
import type { HumanitarianReaderRuling } from './humReaderRuling';

export type { HumanitarianReaderRuling } from './humReaderRuling';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE HOME CONSUMER OF THE ONE HUMANITARIAN CORPUS — convergence glue (CTO ruling)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   one retained corpus → reader read (/humanitarian/observations, E1-scoped)
 *     → G's reader display gate, bound to E1's ruling as the backend publishes it
 *     → H's bounded brief → Home
 *
 * PURE, SYNCHRONOUS: no fetch, no model, no clock (the caller passes `projectedAt`). It reads no
 * store of its own and holds no Humanitarian data beyond the read it is handed.
 *
 * Home shows Humanitarian intelligence ONLY when this returns a projection. Every other case is
 * null and Home renders nothing for Humanitarian — not "nothing happened", not a zero:
 *   - the read is UNAVAILABLE (no approved reader / coverage gap) or NO_RETAINED_EVIDENCE (a store
 *     state, which Home never turns into a finding);
 *   - G's gate refuses the WHOLE read (a required E1 disclosure Home cannot carry, a source E1 has
 *     not reader-cleared, attribution that would not travel);
 *   - H's brief has nothing carried, or fails its own well-formedness.
 *
 * CARRIED DISCLOSURES are the E1 codes this hop can actually render: a code counts only when the
 * canonical catalogue labels it in BOTH languages. E1's list is never copied here.
 */

export interface HumanitarianHomeAttribution {
  readonly publisher: string;
  /** The relay acknowledgement, verbatim (GDACS), or null for a source that has none. */
  readonly relayAttribution: string | null;
  readonly originatingAgency: string | null;
}

export interface HumanitarianHomeProjection {
  readonly brief: HumanitarianBrief;
  /** Every E1 required code, in E1's order — each one has a catalogue label in EN and PL. */
  readonly disclosures: readonly string[];
  readonly attributions: readonly HumanitarianHomeAttribution[];
  /** Every admitted record in the read (the brief itself carries at most BRIEF_MAX_RECORDS). */
  readonly recordCount: number;
  readonly totalDimensions: number;
}

/** E1 codes the canonical catalogue labels in both languages — what this hop can carry. */
export function homeCarriableDisclosures(required: readonly string[]): readonly string[] {
  return required.filter(
    (code) =>
      typeof humanitarianEn.readerDisclosure[code] === 'string' &&
      typeof humanitarianPl.readerDisclosure[code] === 'string',
  );
}

export function humanitarianHomeProjection(
  read: HumanitarianRetainedRead,
  ruling: HumanitarianReaderRuling,
  projectedAt: string,
): HumanitarianHomeProjection | null {
  if (read.kind !== 'RETAINED' || read.observations.length === 0) return null;

  const rowAttribution: Record<string, HumRowAttribution> = {};
  const attributions = new Map<string, HumanitarianHomeAttribution>();
  for (const row of read.observations) {
    const o = row.observation;
    const relay = ruling.relayAttributedSourceIds.includes(o.identity.upstreamAuthority)
      ? ruling.relayAttributionVerbatim
      : undefined;
    const agency =
      o.claim.claimType === 'HUMANITARIAN_EVENT' ? o.claim.originatingAgency : undefined;
    rowAttribution[o.observationKey] = {
      ...(relay === undefined ? {} : { relayAttribution: relay }),
      ...(agency === undefined ? {} : { originatingAgency: agency }),
    };
    const publisher =
      o.provenance.institution ?? o.provenance.providerId ?? o.identity.upstreamAuthority;
    const a = { publisher, relayAttribution: relay ?? null, originatingAgency: agency ?? null };
    attributions.set(JSON.stringify(a), a);
  }

  const carried = homeCarriableDisclosures(ruling.requiredDisclosures);
  const gate = humReaderDisplayGate({
    read,
    carriedDisclosures: carried,
    requiredDisclosures: ruling.requiredDisclosures,
    readerClearedSourceIds: ruling.readerClearedSourceIds,
    relayAttributionVerbatim: ruling.relayAttributionVerbatim,
    relayAttributedSourceIds: ruling.relayAttributedSourceIds,
    rowAttribution,
  });
  if (gate.display !== true) return null;

  try {
    const workspace = projectWorkspaceFromRead(read, projectedAt);
    const brief = projectHumanitarianBrief(workspace);
    assertBriefIsWellFormed(brief);
    if (brief.state !== 'RETAINED') return null;
    return {
      brief,
      disclosures: carried,
      attributions: [...attributions.values()],
      recordCount: read.observations.length,
      totalDimensions: workspace.dimensions.length,
    };
  } catch {
    return null;
  }
}
