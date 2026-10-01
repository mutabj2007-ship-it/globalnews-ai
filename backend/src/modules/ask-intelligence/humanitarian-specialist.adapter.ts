import {
  assertHumanitarianRetainedRecord,
  type HumanitarianObservation,
  type HumanitarianReaderAdmission,
  type HumanitarianRetainedRead,
  type HumanitarianRetainedRecord,
} from '@globalnews-ai/shared';
import type {
  AskContribution,
  AskContributionObservation,
  AskContributorSelection,
} from './ask-contribution.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HUMANITARIAN SPECIALIST ADAPTER — built and tested, NOT BOUND (convergence C-H3)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Maps a Humanitarian retained READ (the reader contract) into ONE governed Ask contribution —
 * the same channel every specialist uses. It never reads a store, a capture or a provider: its
 * only input is the reader-safe read, so the LLM path can see no more than a reader could.
 *
 * C-H3 (CTO ruling): retained evidence → model context → generated answer → durable Ask result
 * is a disclosure surface. Protected/internal records must never become visible because the
 * destination is a model rather than the dashboard. So this adapter RE-CHECKS every row (shape,
 * Main's invariants, no governed geometry, reader admissibility) even though the read's own
 * constructor already did — a read built any other way cannot pass through it — and refuses the
 * WHOLE contribution if any row fails (never a silently thinned answer).
 *
 * LIVE STATUS: `HUMANITARIAN_SPECIALIST_BINDING = 'SPECIALIST_NOT_BOUND'`. The coordinator does not
 * import this file and keeps answering NOT_ASSESSED; the router's specialist registry does not list
 * Humanitarian, so the canonical Ask boundary stays CAPABILITY_UNAVAILABLE (frozen semantics). It
 * may be bound only when reader-safe retained evidence exists AND a source is reader-authorized.
 *
 * What a row contributes is source-verbatim only: Main's hazard code, the source's own title, the
 * ISO3 scope the source stated, the publisher's dates, the source citation. Never coordinates,
 * never a geometry key, never the source's severity string (E1: not ours to restate), never
 * the capture bytes.
 */
export const HUMANITARIAN_SPECIALIST_BINDING = 'SPECIALIST_NOT_BOUND' as const;

export class HumanitarianSpecialistRefused extends Error {
  readonly name = 'HumanitarianSpecialistRefused';
}

function base(
  s: AskContributorSelection,
  over: Partial<AskContribution> & Pick<AskContribution, 'status' | 'temporalBasis'>,
): AskContribution {
  return {
    contributorId: 'HUMANITARIAN',
    domain: s.domain,
    applicability: s.applicability,
    observations: [],
    geographyBasis: s.scope.countryIso3,
    disclosures: [],
    degradationReason: null,
    ...over,
  };
}

function claimKindOf(o: HumanitarianObservation): string {
  const claim = o.claim;
  switch (claim.claimType) {
    case 'HUMANITARIAN_EVENT':
      return `HUMANITARIAN_EVENT:${claim.hazardType}`;
    case 'HUMANITARIAN_REPORT':
      return 'HUMANITARIAN_REPORT';
    case 'HUMANITARIAN_IMPACT_ASSERTION':
      return `HUMANITARIAN_IMPACT_ASSERTION:${claim.measure}`;
  }
}

function observationOf(row: HumanitarianRetainedRecord): AskContributionObservation {
  const o = row.observation;
  const claim = o.claim;
  const label =
    claim.claimType === 'HUMANITARIAN_IMPACT_ASSERTION' ? null : (claim.sourceTitle ?? null);
  const value =
    claim.claimType === 'HUMANITARIAN_IMPACT_ASSERTION' && 'value' in claim
      ? String(claim.value)
      : null;
  const unit =
    claim.claimType === 'HUMANITARIAN_IMPACT_ASSERTION' && 'unit' in claim
      ? ((claim.unit as string | undefined) ?? null)
      : null;
  return {
    reference: o.observationKey,
    kind: claimKindOf(o),
    label,
    value,
    unit,
    period: o.temporal.publisherVintage ?? row.publisherReleasedAt,
    geography: claim.countryIso3.length > 0 ? claim.countryIso3.join(',') : 'NOT_STATED_BY_SOURCE',
    source: {
      name: o.provenance.institution ?? o.provenance.providerId ?? o.identity.upstreamAuthority,
      url: o.sourceReference.sourceUrl ?? null,
      licence: null,
    },
    retainedAt: o.temporal.retrievedAt,
  };
}

/**
 * The ONLY Humanitarian → Ask mapping. `isReaderAdmissible` is the same predicate the read was
 * built with (E1 source rights for reader use + protection authority), applied again here.
 */
export function humanitarianContribution(
  read: HumanitarianRetainedRead,
  s: AskContributorSelection,
  isReaderAdmissible: HumanitarianReaderAdmission,
): AskContribution {
  switch (read.kind) {
    case 'UNAVAILABLE':
      return read.absence === 'NOT_ASSESSED'
        ? base(s, {
            status: 'NOT_ASSESSED',
            temporalBasis: 'NONE',
            disclosures: ['HUMANITARIAN_NOT_ASSESSED'],
            degradationReason: 'NO_GOVERNED_OBSERVATION_READER',
          })
        : /* lossy: the reader-facing COVERAGE_GAP, never the source topology behind it */
          base(s, {
            status: 'DEGRADED',
            temporalBasis: 'NONE',
            disclosures: ['HUMANITARIAN_READ_UNAVAILABLE'],
            degradationReason: 'READ_UNAVAILABLE',
          });
    case 'NO_RETAINED_EVIDENCE':
      return base(s, {
        status: 'NO_DATA',
        temporalBasis: 'NONE',
        disclosures: ['HUMANITARIAN_NO_RETAINED_EVIDENCE'],
      });
    case 'RETAINED': {
      try {
        for (const row of read.observations) {
          assertHumanitarianRetainedRecord(row);
          if (isReaderAdmissible(row) !== true) {
            throw new HumanitarianSpecialistRefused('HUM-ASK-1: a row is not reader-admissible.');
          }
        }
      } catch {
        /* Refuse the whole contribution; name no record (the refusal must not leak one). */
        return base(s, {
          status: 'REFUSED',
          temporalBasis: 'NONE',
          disclosures: ['HUMANITARIAN_REFUSED_NOT_READER_ADMISSIBLE'],
          degradationReason: 'NOT_READER_ADMISSIBLE',
        });
      }
      return base(s, {
        status: 'USED',
        temporalBasis: 'RETAINED_EVENT_RECORD',
        observations: read.observations.map(observationOf),
        disclosures: ['RETAINED_NOT_CURRENT', 'SEVERITY_NOT_ASSESSED'],
      });
    }
  }
}
