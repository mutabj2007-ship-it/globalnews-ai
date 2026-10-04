import { findCountryByIso2 } from '../countries';
import type { DomainObservation, ObservationTemporalBasis } from '../observation/domain-observation';
import type { EvidenceRole } from '../source-provenance';
import type { SourceType } from '../source-type';
import type { LegislativeStage, PoliticsSubjectType } from './index';

/** Deliberately excludes results, polling, scores, sentiment and inferred outcomes. */
export type RetainedPoliticsClaim =
  | { kind: 'PROTEST_HELD'; stage: 'HELD'; sourceText: string }
  | { kind: 'LEGISLATIVE_STAGE'; stage: LegislativeStage; sourceText: string }
  | { kind: 'ELECTION_PROCESS_NOTICE'; stage: 'ANNOUNCED'; sourceText: string };

export interface RetainedPoliticsObservation extends DomainObservation<RetainedPoliticsClaim> {
  readonly subjectType: PoliticsSubjectType;
  readonly observationKind: RetainedPoliticsClaim['kind'];
  /** Publication and publisher revision are distinct; neither is the ingestion clock. */
  readonly publishedAt: string;
  readonly sourceUpdatedAt?: string;
  readonly artifactSha256: string;
}

export interface PoliticsReadResponse {
  readonly observations: readonly RetainedPoliticsObservation[];
  readonly absence: 'NOT_ASSESSED' | 'EVIDENCE_WITHHELD' | null;
  readonly truncated: boolean;
  readonly acquisition: 'RETAINED_ONLY';
  /** Whole-ledger admission inventory, before subject filtering or pagination. */
  readonly coverage?: { readonly checkedCaptures: number; readonly admittedObservations: number; readonly withheld: boolean };
}

/**
 * POLITICS INTEL R1 — THE SHARED-SEARCHABLE REPRESENTATION of one retained Politics observation.
 *
 * This is the unit shared retrieval (the one Ask engine, via the specialist coordinator) reads.
 * It is a pure projection of the canonical record and carries nothing else: no review, rights,
 * admission or capture-link data (operator-only, E1 G6), no person field (E1 G4), no score.
 *
 * `quotation` is the publisher's own words, kept for lexical retrieval and for quoting to the
 * model as evidence. `readerRenderable: false` is PO-1 / Main R-4 option 1 applied: a reader
 * surface shows structured fields and the citation, never the verbatim text, until PO rules.
 */
export interface PoliticsSearchRecord {
  readonly retrievalKey: string;
  readonly domain: 'POLITICS';
  readonly subjectType: PoliticsSubjectType;
  readonly subjectId: string;
  readonly eventKind: RetainedPoliticsClaim['kind'];
  readonly stage: RetainedPoliticsClaim['stage'];
  /** Only when a PRIMARY official record scopes it (the institution's own jurisdiction). */
  readonly countryIso3: string | null;
  /** When it happened if the source says so, else publication — `temporalBasis` says which. */
  readonly effectiveAt: string;
  readonly temporalBasis: ObservationTemporalBasis;
  readonly publishedAt: string;
  readonly sourceUpdatedAt?: string;
  readonly retrievedAt: string;
  readonly language: string;
  readonly sourceType: SourceType;
  readonly evidenceRole: EvidenceRole | null;
  readonly institution?: string;
  readonly citation: { readonly sourceUrl?: string; readonly label?: string; readonly artifactSha256: string };
  readonly revisionOrdinal: number;
  readonly quotation: { readonly text: string; readonly authorship: 'PUBLISHER_STATED'; readonly readerRenderable: false };
}

/**
 * The country a retained Politics observation is ABOUT, and only where that is a fact of the
 * record: a PRIMARY_RECORD from an OFFICIAL_SOURCE (a legislature's own stage record, an
 * electoral authority's own notice) is scoped to its own jurisdiction. Reporting is never scoped
 * this way — a Rwandan outlet writing about Kenya keeps 'RW' as ITS jurisdiction, not the story's.
 * Null rather than a guess; nothing is read from text, coordinates or names.
 */
export function politicsScopeCountryIso3(o: RetainedPoliticsObservation): string | null {
  const p = o.provenance;
  if (p.sourceType !== 'OFFICIAL_SOURCE' || p.evidenceRole !== 'PRIMARY_RECORD') return null;
  if (typeof p.jurisdiction !== 'string' || !/^[A-Za-z]{2}$/.test(p.jurisdiction)) return null;
  return findCountryByIso2(p.jurisdiction)?.iso3 ?? null;
}

export function politicsSearchRecord(o: RetainedPoliticsObservation): PoliticsSearchRecord {
  return {
    retrievalKey: o.observationKey,
    domain: 'POLITICS',
    subjectType: o.subjectType,
    subjectId: o.subjectId,
    eventKind: o.claim.kind,
    stage: o.claim.stage,
    countryIso3: politicsScopeCountryIso3(o),
    effectiveAt: o.temporal.occurredAt ?? o.publishedAt,
    temporalBasis: o.temporal.temporalBasis,
    publishedAt: o.publishedAt,
    ...(o.sourceUpdatedAt ? { sourceUpdatedAt: o.sourceUpdatedAt } : {}),
    retrievedAt: o.temporal.retrievedAt,
    language: o.provenance.language ?? '',
    sourceType: o.provenance.sourceType,
    evidenceRole: o.provenance.evidenceRole ?? null,
    ...(o.provenance.institution ? { institution: o.provenance.institution } : {}),
    citation: {
      ...(o.sourceReference.sourceUrl ? { sourceUrl: o.sourceReference.sourceUrl } : {}),
      ...(o.sourceReference.citation ? { label: o.sourceReference.citation } : {}),
      artifactSha256: o.artifactSha256,
    },
    revisionOrdinal: o.revision.revisionOrdinal,
    quotation: { text: o.claim.sourceText, authorship: 'PUBLISHER_STATED', readerRenderable: false },
  };
}
