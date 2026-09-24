import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  isEnergyObservation,
  parseStrictJson,
  type EnergyObservation,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';
import {
  EUROSTAT_ENERGY_ROW_PARSER_VERSION,
  normalizeEurostatEnergyCapture,
} from './energy-eurostat-pem';

/** A deliberately narrow parser seam: the retained JSON record must state every fact.
 * Future source formats require a reviewed parser; no provider is activated here. */
export function inspectEnergyRow(
  row: any,
  options: { alphaReviewVisible?: boolean } = {},
): EnergyObservation | null {
  const c = row.snapshotRetrieval;
  const o = row.payload;
  const alphaReviewApproved =
    options.alphaReviewVisible === true &&
    typeof row.reviewRef === 'string' &&
    row.reviewRef.startsWith('ALPHA:');
  if (
    row.admission !== 'ADMITTED' ||
    (row.publicDisclosureApproved !== true && !alphaReviewApproved) ||
    !row.reviewedBy?.trim() ||
    !row.reviewRef?.trim() ||
    !['energy-record-v1', EUROSTAT_ENERGY_ROW_PARSER_VERSION].includes(row.parserVersion) ||
    !isEnergyObservation(o) ||
    o.observationKey !== row.observationKey ||
    !c ||
    c.retrievalId !== o.retrievalId ||
    c.providerId !== o.provenance.providerId ||
    c.admissibility !== 'ADMITTED' ||
    c.completeness !== 'COMPLETE' ||
    c.httpStatus !== 200 ||
    c.rightsGrade !== 'E-5' ||
    !c.payloadRetentionPermitted ||
    !c.rightsInstrumentRef?.trim() ||
    c.payload?.storageState !== 'RETAINED' ||
    !c.payload.bytes ||
    c.payload.bytes.length !== c.payload.byteLength ||
    c.payload.bytes.length > 4 * 1024 * 1024 ||
    createHash('sha256').update(c.payload.bytes).digest('hex') !== c.contentAddress ||
    !Number.isFinite(c.retrievedAt?.getTime()) ||
    !Number.isFinite(c.requestedAt?.getTime()) ||
    c.requestedAt > c.retrievedAt ||
    c.retrievedAt.toISOString() !== o.provenance.retrievedAt ||
    (o.publisherChangedAt !== null && Date.parse(o.publisherChangedAt) > c.retrievedAt.getTime())
  )
    return null;
  if (row.parserVersion === EUROSTAT_ENERGY_ROW_PARSER_VERSION) {
    try {
      const normalized = normalizeEurostatEnergyCapture(c);
      if (
        normalized.observationKey !== row.observationKey ||
        normalized.retrievalId !== row.snapshotRetrievalId ||
        row.evidencePointer !== '/value/0'
      ) {
        return null;
      }

      const fields = [
        'subjectId',
        'subjectName',
        'subjectType',
        'geographyId',
        'spatialPrecision',
        'metric',
        'period',
        'value',
        'unit',
        'releaseStatus',
        'publisherChangedAt',
      ] as const;
      if (!fields.every((key) => normalized[key] === o[key])) return null;
      if (
        normalized.provenance.sourceType !== o.provenance.sourceType ||
        normalized.provenance.providerId !== o.provenance.providerId ||
        normalized.provenance.institution !== o.provenance.institution ||
        normalized.provenance.evidenceRole !== o.provenance.evidenceRole ||
        normalized.provenance.retrievedAt !== o.provenance.retrievedAt
      ) {
        return null;
      }
      return normalized;
    } catch {
      return null;
    }
  }

    const parsed = parseStrictJson(c.payload.bytes);
  if (
    !parsed.ok ||
    typeof row.evidencePointer !== 'string' ||
    (row.evidencePointer !== '' && !row.evidencePointer.startsWith('/'))
  )
    return null;
  let record: any = parsed.value;
  for (const part of row.evidencePointer === '' ? [] : row.evidencePointer.slice(1).split('/')) {
    if (/~(?![01])/.test(part)) return null;
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!record || typeof record !== 'object' || !Object.prototype.hasOwnProperty.call(record, key))
      return null;
    record = record[key];
  }
  if (!record || typeof record !== 'object' || record.institution !== o.provenance.institution)
    return null;
  const fields = [
    'subjectId',
    'subjectName',
    'subjectType',
    'geographyId',
    'spatialPrecision',
    'metric',
    'period',
    'value',
    'unit',
    'releaseStatus',
    'publisherChangedAt',
  ] as const;
  if (!fields.every((k) => record[k] === o[k])) return null;
  // Explicit allowlist prevents unknown payload fields leaking through the public endpoint.
  return {
    observationKey: o.observationKey,
    ...Object.fromEntries(fields.map((k) => [k, o[k]])),
    provenance: {
      sourceType: o.provenance.sourceType,
      providerId: c.providerId,
      institution: o.provenance.institution,
      evidenceRole: o.provenance.evidenceRole,
      retrievedAt: c.retrievedAt.toISOString(),
    },
    retrievalId: c.retrievalId,
    freshnessBasis: 'RETAINED_ONLY',
  } as EnergyObservation;
}
@Injectable()
export class EnergyReadRepository {
  constructor(private readonly prisma: PrismaService) {}
  async latest(): Promise<EnergyObservation[]> {
    const result: EnergyObservation[] = [];
    const seen = new Set<string>();
    let offset = 0;
    for (;;) {
      const rows = await this.prisma.energyObservation.findMany({
        take: 250,
        skip: offset,
        orderBy: [{ observationKey: 'asc' }, { revision: 'desc' }],
        include: { snapshotRetrieval: { include: { payload: true } } },
      });
      for (const row of rows) {
        if (seen.has(row.observationKey)) continue;
        seen.add(row.observationKey); // A refused/withdrawn revision suppresses older figures.
        const o = inspectEnergyRow(row, {
          alphaReviewVisible: process.env.GN_ALPHA_PRODUCT_OWNER_REVIEW === 'YES',
        });
        if (o && o.releaseStatus !== 'WITHDRAWN') result.push(o);
      }
      if (rows.length < 250) return result;
      offset += rows.length;
    }
  }
}
