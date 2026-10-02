import {
  assertHumanitarianRetainedRecord,
  type HumanitarianObservation,
  type HumanitarianRetainedRead,
  type HumanitarianRetainedRecord,
} from '@globalnews-ai/shared';
import type {
  AskContribution,
  AskContributionObservation,
  AskContributorSelection,
} from './ask-contribution.contract';
import {
  HUMANITARIAN_SOURCE_RULINGS,
  verdictPermitsRuntimeAcquisition,
  type SourceActivationVerdict,
} from '../humanitarian/source-activation.ruling';
import {
  GDACS_ATTRIBUTION_VERBATIM,
  assertDisclosuresRecognised,
  assertGdacsAttributionCarried,
  readerAdmissionFromRuling,
} from '../humanitarian/reader-clearance.ruling';
import { GOVERNED_PROMPT_DISCLOSURE_CODES } from './governed-answer';

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

/**
 * THE BINDING GATE, derived from E1's ruling table (no second source registry). Lane C's rule,
 * accepted by the CTO: CLEARED_FOR_DEV_CAPTURE must NEVER make the Humanitarian specialist
 * bindable — a reviewed offline capture is engineering evidence, not a reader source. Only a
 * verdict that permits runtime acquisition (E1's RUNTIME_PERMITTING_VERDICT) can, and even then
 * binding remains a separate, reviewed change to the live coordinator.
 */
export function humanitarianSpecialistMayBind(
  rulings: Readonly<
    Record<string, { readonly verdict: SourceActivationVerdict }>
  > = HUMANITARIAN_SOURCE_RULINGS,
): boolean {
  return Object.values(rulings).some((r) => verdictPermitsRuntimeAcquisition(r.verdict));
}

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

/** E1 R2 · B4 — the relay acknowledgement GDACS requests, verbatim, or null for other sources. */
function acknowledgementOf(o: HumanitarianObservation): string | null {
  return o.identity.upstreamAuthority === 'GDACS' ? GDACS_ATTRIBUTION_VERBATIM : null;
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
  const originatingAgency =
    claim.claimType === 'HUMANITARIAN_EVENT' ? claim.originatingAgency : undefined;
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
      licence: acknowledgementOf(o),
      ...(originatingAgency === undefined ? {} : { originatingAgency }),
    },
    retainedAt: o.temporal.retrievedAt,
  };
}

/** A publisher date with no time-zone designator (measured: GDACS, 100/100). */
const NO_TIME_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/** E1 R2 · the Humanitarian disclosure set for a USED contribution, derived from the rows. */
function usedDisclosures(rows: readonly HumanitarianRetainedRecord[]): readonly string[] {
  const codes = new Set<string>([
    'IMPACT_NOT_ASSESSED',
    'RETAINED_NOT_CURRENT',
    'SEVERITY_NOT_ASSESSED',
  ]);
  for (const row of rows) {
    const o = row.observation;
    if (o.claim.countryIso3.length === 0) codes.add('COUNTRY_SCOPE_NOT_STATED_BY_SOURCE');
    const vintage = o.temporal.publisherVintage;
    if (vintage !== undefined && NO_TIME_ZONE.test(vintage))
      codes.add('PUBLISHER_TIME_ZONE_NOT_STATED');
    if (o.identity.upstreamAuthority === 'GDACS') codes.add('GEOMETRY_WITHHELD_SOURCE_CENTROID');
  }
  return [...codes];
}

/**
 * E1 R2 · B2 — every code this adapter emits must be one the governed prompt turns into a rule.
 * An unrecognised code would vanish between producer and prompt with every test still green.
 */
function withRecognisedDisclosures(c: AskContribution): AskContribution {
  assertDisclosuresRecognised(c.disclosures, GOVERNED_PROMPT_DISCLOSURE_CODES);
  return c;
}

/**
 * The ONLY Humanitarian → Ask mapping.
 *
 * E1 R2 · C1 — reader admission is NOT a parameter. It is bound here to the ruling-derived
 * predicate (`readerAdmissionFromRuling()`: E1's reader-cleared sources), so no caller can pass
 * `() => true`. Today no source is reader-cleared, so every retained row is refused.
 * E1 R2 · B4 — IMPACT_NOT_ASSESSED is carried on EVERY contribution.
 */
export function humanitarianContribution(
  read: HumanitarianRetainedRead,
  s: AskContributorSelection,
): AskContribution {
  const isReaderAdmissible = readerAdmissionFromRuling();
  switch (read.kind) {
    case 'UNAVAILABLE':
      return withRecognisedDisclosures(
        read.absence === 'NOT_ASSESSED'
          ? base(s, {
              status: 'NOT_ASSESSED',
              temporalBasis: 'NONE',
              disclosures: ['HUMANITARIAN_NOT_ASSESSED', 'IMPACT_NOT_ASSESSED'],
              degradationReason: 'NO_GOVERNED_OBSERVATION_READER',
            })
          : /* lossy: the reader-facing COVERAGE_GAP, never the source topology behind it */
            base(s, {
              status: 'DEGRADED',
              temporalBasis: 'NONE',
              disclosures: ['HUMANITARIAN_READ_UNAVAILABLE', 'IMPACT_NOT_ASSESSED'],
              degradationReason: 'READ_UNAVAILABLE',
            }),
      );
    case 'NO_RETAINED_EVIDENCE':
      return withRecognisedDisclosures(
        base(s, {
          status: 'NO_DATA',
          temporalBasis: 'NONE',
          disclosures: ['HUMANITARIAN_NO_RETAINED_EVIDENCE', 'IMPACT_NOT_ASSESSED'],
        }),
      );
    case 'RETAINED': {
      try {
        for (const row of read.observations) {
          assertHumanitarianRetainedRecord(row);
          if (isReaderAdmissible(row) !== true) {
            throw new HumanitarianSpecialistRefused('HUM-ASK-1: a row is not reader-admissible.');
          }
          if (row.observation.identity.upstreamAuthority === 'GDACS') {
            const o = observationOf(row);
            /* E1 R2: a GDACS row reaching a model carries both names, or it does not travel. */
            assertGdacsAttributionCarried({
              relayAttribution: o.source.licence,
              originatingAgency: o.source.originatingAgency,
            });
          }
        }
      } catch {
        /* Refuse the whole contribution; name no record (the refusal must not leak one). */
        return withRecognisedDisclosures(
          base(s, {
            status: 'REFUSED',
            temporalBasis: 'NONE',
            disclosures: ['HUMANITARIAN_REFUSED_NOT_READER_ADMISSIBLE', 'IMPACT_NOT_ASSESSED'],
            degradationReason: 'NOT_READER_ADMISSIBLE',
          }),
        );
      }
      return withRecognisedDisclosures(
        base(s, {
          status: 'USED',
          temporalBasis: 'RETAINED_EVENT_RECORD',
          observations: read.observations.map(observationOf),
          disclosures: usedDisclosures(read.observations),
        }),
      );
    }
  }
}
