import { Injectable } from '@nestjs/common';
import {
  assertDomainObservationIsWellFormed,
  assertObservationRevisionAppends,
  politicsScopeCountryIso3,
  politicsSearchRecord,
  type PoliticsSearchRecord,
  type RetainedPoliticsObservation,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';
import type { PoliticsObservation as RetainedRow } from '../../generated/prisma/client';
import { producePoliticsObservation, type PoliticsCapture } from './politics.producer';

/**
 * POLITICS INTEL R1 — THE RETAINED POLITICS EVIDENCE STORE (CTO Decision 5).
 *
 * Patterned on `ConflictObservationRepository`: append-only rows on the shared observation
 * carrier, current revision selected BEFORE any filter, decoding from the canonical JSON fields.
 *
 * ONE WRITE PATH. `append` runs the full governed producer on a reviewed capture before anything
 * is written, so the database can only ever hold what `producePoliticsObservation` admits. There
 * is no public write route, no provider, no fetch and no schedule reachable from here.
 *
 * ONE READ AUTHORITY. The Politics surface (`/politics/observations`) and shared retrieval read
 * the same rows through this class. It exists to feed shared retrieval; it is not a search engine.
 */
export interface PoliticsLedgerInventory {
  /** Distinct retained identities, whatever their current state. */
  readonly identities: number;
  /** Identities whose current revision is admitted (not retracted). */
  readonly admitted: number;
  /** True when at least one identity's current revision is a retraction. */
  readonly withheld: boolean;
}

export interface PoliticsCaptureLink {
  /** An ADMITTED, COMPLETE shared SnapshotRetrieval whose retained bytes are the artifact. */
  readonly snapshotRetrievalId: string;
}

const MAX_KEY = 300;
const bound = (limit: number, fallback: number, max: number): number =>
  Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), max)) : fallback;
const refuse = (reason: string): never => {
  throw new Error(`Politics evidence refused: ${reason}`);
};

/** Rebuild the canonical record from its JSON fields and check every index projection agrees. */
export function decodeRetainedPoliticsRow(row: RetainedRow): RetainedPoliticsObservation {
  const publication = row.publication as { publishedAt: string; sourceUpdatedAt?: string };
  if (!publication || typeof publication.publishedAt !== 'string') refuse('publication missing');
  const o = {
    observationKey: row.observationKey,
    identity: { domainId: 'POLITICS', upstreamAuthority: row.upstreamAuthority, upstreamId: row.upstreamId },
    observationKind: row.observationKind,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    claim: row.claim,
    temporal: row.temporal,
    provenance: row.provenance,
    sourceReference: row.sourceReference,
    attributeAuthorship: row.attributeAuthorship,
    revision: row.revision,
    publishedAt: publication.publishedAt,
    ...(publication.sourceUpdatedAt !== undefined ? { sourceUpdatedAt: publication.sourceUpdatedAt } : {}),
    artifactSha256: row.artifactSha256,
  } as unknown as RetainedPoliticsObservation;
  assertDomainObservationIsWellFormed(o);
  if (Date.parse(publication.publishedAt) !== (row.publishedAt as Date).getTime()) refuse('publication projection mismatch');
  if ((publication.sourceUpdatedAt === undefined) !== (row.sourceUpdatedAt === null)) refuse('publication projection mismatch');
  if (o.revision.revisionOrdinal !== row.revisionOrdinal) refuse('revision projection mismatch');
  if (o.claim?.kind !== row.observationKind) refuse('claim projection mismatch');
  if (o.temporal.temporalBasis !== row.temporalBasis) refuse('temporal projection mismatch');
  return o;
}

@Injectable()
export class PoliticsObservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Admit ONE reviewed capture as ONE revision. Refuses (throws) rather than stores anything the
   * producer withholds, any revision that does not append to its exact unretracted predecessor,
   * and any capture whose bytes are not retained in the shared capture store as this artifact —
   * an observation that cannot be re-derived from retained bytes is not evidence (E1 G5).
   * Re-appending an identical
   * revision is idempotent; a different record at an existing ordinal is refused, never merged.
   */
  async append(capture: PoliticsCapture, link: PoliticsCaptureLink): Promise<RetainedPoliticsObservation> {
    const o = producePoliticsObservation(capture);
    const ordinal = o.revision.revisionOrdinal;

    const existing = await this.prisma.politicsObservation.findUnique({
      where: { observationKey_revisionOrdinal: { observationKey: o.observationKey, revisionOrdinal: ordinal } },
    });
    if (existing) {
      const stored = decodeRetainedPoliticsRow(existing);
      if (JSON.stringify(sortKeys(stored)) !== JSON.stringify(sortKeys(o))) refuse('conflicting record at an existing revision');
      return stored;
    }

    if (ordinal > 0) {
      const priorRow = await this.prisma.politicsObservation.findUnique({
        where: { observationKey_revisionOrdinal: { observationKey: o.observationKey, revisionOrdinal: ordinal - 1 } },
      });
      if (!priorRow) refuse('missing preceding revision');
      const prior = decodeRetainedPoliticsRow(priorRow!);
      if (prior.revision.revisionKind === 'RETRACTION') refuse('identity is retracted');
      assertObservationRevisionAppends(prior.revision, o.revision);
      if (prior.subjectId !== o.subjectId || prior.subjectType !== o.subjectType) refuse('a revision cannot retarget its subject');
      if (Date.parse(o.revision.recordedAt) < Date.parse(prior.revision.recordedAt)) refuse('recordedAt went backwards');
      if (Date.parse(o.temporal.retrievedAt) < Date.parse(prior.temporal.retrievedAt)) refuse('retrievedAt went backwards');
    }

    await this.assertCaptureLink(link, o.artifactSha256);

    const row = await this.prisma.politicsObservation.create({
      data: {
        observationKey: o.observationKey,
        upstreamAuthority: o.identity.upstreamAuthority,
        upstreamId: o.identity.upstreamId,
        subjectType: o.subjectType,
        subjectId: o.subjectId,
        observationKind: o.observationKind,
        claim: o.claim as object,
        temporal: o.temporal as object,
        provenance: o.provenance as object,
        sourceReference: o.sourceReference as object,
        attributeAuthorship: o.attributeAuthorship as unknown as object,
        revision: o.revision as object,
        publication: { publishedAt: o.publishedAt, ...(o.sourceUpdatedAt ? { sourceUpdatedAt: o.sourceUpdatedAt } : {}) },
        revisionOrdinal: ordinal,
        publishedAt: new Date(o.publishedAt),
        sourceUpdatedAt: o.sourceUpdatedAt ? new Date(o.sourceUpdatedAt) : null,
        artifactSha256: o.artifactSha256,
        review: operatorReview(capture),
        snapshotRetrievalId: link.snapshotRetrievalId,
        snapshotAdmissibility: 'ADMITTED',
        effectiveOn: new Date(o.temporal.occurredAt ?? o.publishedAt),
        retrievedAt: new Date(o.temporal.retrievedAt),
        temporalBasis: o.temporal.temporalBasis,
        language: o.provenance.language ?? '',
        countryIso3: politicsScopeCountryIso3(o),
      },
    });
    return decodeRetainedPoliticsRow(row);
  }

  /** The current, unretracted revision of one identity; null when absent, malformed or retracted. */
  async currentByKey(observationKey: string): Promise<RetainedPoliticsObservation | null> {
    if (typeof observationKey !== 'string' || !observationKey || observationKey.length > MAX_KEY) return null;
    const rows = await this.prisma.$queryRaw<RetainedRow[]>`
      SELECT * FROM "PoliticsObservation"
      WHERE "observationKey" = ${observationKey}
      ORDER BY "revisionOrdinal" DESC
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    const o = decodeRetainedPoliticsRow(rows[0]);
    return o.revision.revisionKind === 'RETRACTION' ? null : o;
  }

  /** Current unretracted revisions, newest effective first. Filters apply AFTER revision selection. */
  async current(
    filter: { countryIso3?: string; since?: Date; subjectId?: string } = {},
    limit = 50,
  ): Promise<readonly RetainedPoliticsObservation[]> {
    const { countryIso3, since, subjectId } = filter;
    if (countryIso3 !== undefined && !/^[A-Z]{3}$/.test(countryIso3)) return [];
    if (since !== undefined && Number.isNaN(since.getTime())) return [];
    if (subjectId !== undefined && (typeof subjectId !== 'string' || !subjectId || subjectId.length > 200)) return [];
    const n = bound(limit, 50, 101);
    const rows = await this.prisma.$queryRaw<RetainedRow[]>`
      SELECT * FROM (
        SELECT DISTINCT ON ("observationKey") * FROM "PoliticsObservation"
        ORDER BY "observationKey", "revisionOrdinal" DESC
      ) AS current_observations
      WHERE ("revision"->>'revisionKind') IS DISTINCT FROM 'RETRACTION'
        AND (${countryIso3 ?? null}::text IS NULL OR "countryIso3" = ${countryIso3 ?? null}::text)
        AND (${since ?? null}::timestamp IS NULL OR "effectiveOn" >= ${since ?? null}::timestamp)
        AND (${subjectId ?? null}::text IS NULL OR "subjectId" = ${subjectId ?? null}::text)
      ORDER BY "effectiveOn" DESC, "ingestedAt" DESC, "observationKey" ASC
      LIMIT ${n}
    `;
    return rows.map(decodeRetainedPoliticsRow);
  }

  /** The shared-searchable representation of the same current rows. Never review/rights data. */
  async searchRecords(
    filter: { countryIso3?: string; since?: Date; subjectId?: string } = {},
    limit = 20,
  ): Promise<readonly PoliticsSearchRecord[]> {
    return (await this.current(filter, bound(limit, 20, 50))).map(politicsSearchRecord);
  }

  async inventory(): Promise<PoliticsLedgerInventory> {
    const rows = await this.prisma.$queryRaw<{ identities: bigint; admitted: bigint; retracted: bigint }[]>`
      SELECT COUNT(*) AS identities,
             COUNT(*) FILTER (WHERE ("revision"->>'revisionKind') IS DISTINCT FROM 'RETRACTION') AS admitted,
             COUNT(*) FILTER (WHERE ("revision"->>'revisionKind') = 'RETRACTION') AS retracted
      FROM (
        SELECT DISTINCT ON ("observationKey") "revision" FROM "PoliticsObservation"
        ORDER BY "observationKey", "revisionOrdinal" DESC
      ) AS current_observations
    `;
    const r = rows[0] ?? { identities: 0n, admitted: 0n, retracted: 0n };
    return { identities: Number(r.identities), admitted: Number(r.admitted), withheld: Number(r.retracted) > 0 };
  }

  private async assertCaptureLink(link: PoliticsCaptureLink, artifactSha256: string): Promise<void> {
    const capture = await this.prisma.snapshotRetrieval.findUnique({
      where: { retrievalId: link.snapshotRetrievalId },
      select: {
        admissibility: true,
        completeness: true,
        refusalKey: true,
        contentAddress: true,
        payload: { select: { storageState: true, contentAddress: true } },
      },
    });
    if (
      !capture ||
      capture.admissibility !== 'ADMITTED' ||
      capture.completeness !== 'COMPLETE' ||
      capture.refusalKey !== null ||
      capture.contentAddress !== artifactSha256 ||
      capture.payload?.storageState !== 'RETAINED' ||
      capture.payload.contentAddress !== artifactSha256
    ) {
      refuse('capture link is not the retained, admitted artifact');
    }
  }
}

/** The accountable review record, kept for operators and audit. Never projected to a reader. */
function operatorReview(capture: PoliticsCapture): object {
  const r = capture.review;
  return {
    reviewer: r.reviewer,
    reviewedAt: r.reviewedAt,
    rationale: r.rationale,
    rightsBasis: r.rightsBasis,
    publicDisplayAuthorized: r.publicDisplayAuthorized,
    evidenceSufficient: r.evidenceSufficient,
    activity: r.activity,
    ownership: r.ownership,
    ...(r.sustainedMobilisation ? { sustainedMobilisation: r.sustainedMobilisation } : {}),
    artifact: {
      sha256: capture.artifact.sha256,
      sourceUrl: capture.artifact.sourceUrl,
      capturedAt: capture.artifact.capturedAt,
      language: capture.artifact.language,
      byteLength: Buffer.byteLength(capture.artifact.text, 'utf8'),
    },
  };
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}
