import { Injectable } from '@nestjs/common';
import {
  decodeUcdpCandidateGedCsv,
  findCountryByIso3,
  type ConflictDatasetCoverage,
  type ConflictMapEvent,
  type ConflictReadResult,
} from '@globalnews-ai/shared';

import { PrismaService } from '../../database/prisma.service';
import { normalizeUcdpCandidateGed } from './ucdp-conflict.adapter';

const PROVIDER_ID = 'ucdp-ged';
const ENDPOINT_ID = 'candidate-ged-26.0.7';
const PARSER_ID = 'ucdp.candidate-ged.csv';
const PARSER_VERSION = '26.0.7-schema1';
const DATASET_VERSION = '26.0.7';
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

/** Read-only Conflict access over a retained UCDP artifact. No URL, transport or scheduler. */
@Injectable()
export class ConflictRetainedReadService {
  constructor(private readonly prisma: PrismaService) {}

  async read(input: {
    readonly countryIso3?: string;
    readonly days?: number;
    readonly limit?: number;
  }): Promise<ConflictReadResult> {
    const countryIso3 = input.countryIso3?.trim().toUpperCase();

    if (countryIso3 !== undefined && findCountryByIso3(countryIso3) === undefined) {
      return unavailable('NO_RETAINED_DATASET');
    }

    const retrieval = await this.prisma.snapshotRetrieval.findFirst({
      where: {
        providerId: PROVIDER_ID,
        endpointId: ENDPOINT_ID,
        admissibility: 'ADMITTED',
        contentAddress: { not: null },
      },
      orderBy: { retrievedAt: 'desc' },
      include: { payload: true },
    });

    if (retrieval === null) return unavailable('NO_RETAINED_DATASET');
    if (retrieval.payload === null) return unavailable('RETAINED_BYTES_UNAVAILABLE');

    if (retrieval.parserId !== PARSER_ID || retrieval.parserVersion !== PARSER_VERSION) {
      return unavailable('PARSER_IDENTITY_MISMATCH');
    }

    const parse = decodeUcdpCandidateGedCsv(retrieval.payload.bytes);
    if (!parse.ok) return unavailable('PARSE_FAILED');

    const normalized = normalizeUcdpCandidateGed(parse.value, {
      snapshotRetrievalId: retrieval.retrievalId,
      retrievedAt: retrieval.retrievedAt.toISOString(),
    });

    const all = normalized.map((entry) => entry.mapEvent);
    const coverage = coverageFor(all, retrieval.retrievedAt.toISOString(), retrieval.contentAddress!);

    let matched = all;
    if (countryIso3 !== undefined) matched = matched.filter((event) => event.countryIso3 === countryIso3);

    // Candidate GED is a retained publication, not a live sensor. Periods are measured
    // against the dataset's own latest event and the response exposes that coverage ceiling.
    const days =
      input.days !== undefined && Number.isInteger(input.days) && input.days > 0
        ? Math.min(input.days, 3660)
        : undefined;

    if (days !== undefined && coverage.lastEventDate !== null) {
      const latest = Date.parse(`${coverage.lastEventDate}T23:59:59.999Z`);
      const floor = latest - days * 86_400_000;
      matched = matched.filter((event) => {
        const at = Date.parse(`${event.eventStartedAt}T00:00:00.000Z`);
        return Number.isFinite(at) && at >= floor && at <= latest;
      });
    }

    matched = [...matched].sort((a, b) => {
      const date = b.eventStartedAt.localeCompare(a.eventStartedAt);
      return date !== 0 ? date : b.upstreamEventId.localeCompare(a.upstreamEventId);
    });

    const matchedBeforeLimit = matched.length;
    const limit =
      input.limit !== undefined && Number.isInteger(input.limit) && input.limit > 0
        ? Math.min(input.limit, MAX_LIMIT)
        : DEFAULT_LIMIT;
    const visible = matched.slice(0, limit);

    const observationByKey = new Map(
      normalized.map((entry) => [entry.observation.observationKey, entry.observation] as const),
    );

    const observations = visible
      .map((event) => observationByKey.get(event.observationKey))
      .filter((observation): observation is NonNullable<typeof observation> => observation !== undefined);

    return {
      kind: 'OBSERVATIONS',
      coverage,
      countryIso3: countryIso3 ?? null,
      requestedDays: days ?? null,
      observations,
      matchedBeforeLimit,
      truncated: matchedBeforeLimit > observations.length,
    };
  }
}

function unavailable(reason: Extract<ConflictReadResult, { kind: 'UNAVAILABLE' }>['reason']): ConflictReadResult {
  return { kind: 'UNAVAILABLE', reason };
}

function coverageFor(
  events: readonly ConflictMapEvent[],
  retrievedAt: string,
  contentAddress: string,
): ConflictDatasetCoverage {
  let first: string | null = null;
  let last: string | null = null;
  for (const event of events) {
    const date = event.eventStartedAt;
    if (first === null || date < first) first = date;
    if (last === null || date > last) last = date;
  }
  return {
    providerId: PROVIDER_ID,
    datasetVersion: DATASET_VERSION,
    retrievedAt,
    contentAddress,
    firstEventDate: first,
    lastEventDate: last,
    totalEventsInArtifact: events.length,
  };
}