import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EconomyObservationReadService } from '../economy/economy-observation.read';
import { ElectionReadService } from '../election/election-read.service';

export type AlphaReviewState = 'RECORDS' | 'EMPTY' | 'UNAVAILABLE' | 'SURFACE_ONLY';

export interface AlphaReviewDomain {
  id: string;
  route: string;
  state: AlphaReviewState;
  count: number | null;
  publicGate: 'OPEN' | 'CLOSED' | 'NOT_APPLICABLE';
  records: unknown[];
  note: string;
}

export interface AlphaReviewResponse {
  scope: 'ALPHA_ADMIN_REVIEW';
  generatedAt: string;
  domains: AlphaReviewDomain[];
  omissions: string[];
}

/**
 * Product Owner Alpha inspection only.
 *
 * No acquisition, provider activation, admission mutation or publication is
 * reachable here. The endpoint using this service is protected by the existing
 * Admin auth + evidence.export capability. Raw retained payload bytes and
 * credentials remain outside this response.
 */
@Injectable()
export class AlphaReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyObservationReadService,
    private readonly election: ElectionReadService,
  ) {}

  async read(): Promise<AlphaReviewResponse> {
    const [economy, election, conflict, market, energy, security, humanitarian] =
      await Promise.all([
        this.economy.readNisrHeadlineCpi(),
        Promise.resolve(this.election.review('en')),
        this.readConflict(),
        this.readMarket(),
        this.readEnergy(),
        this.readSecurity(),
        this.readHumanitarian(),
      ]);

    const economyRecords = economy.retainedState === 'NO_CAPTURE' ? [] : [economy];
    const electionRecords = Array.isArray(election.records) ? election.records : [];

    return {
      scope: 'ALPHA_ADMIN_REVIEW',
      generatedAt: new Date().toISOString(),
      omissions: [
        'snapshot payload raw bytes',
        'humanitarian retained_capture.raw_bytes',
        'credentials, secrets and session material',
      ],
      domains: [
        {
          id: 'ask',
          route: '/ask',
          state: 'SURFACE_ONLY',
          count: null,
          publicGate: 'NOT_APPLICABLE',
          records: [],
          note: 'Dedicated Ask dashboard. Opening it makes no AI request.',
        },
        {
          id: 'imihigo',
          route: '/imihigo',
          state: 'SURFACE_ONLY',
          count: null,
          publicGate: 'NOT_APPLICABLE',
          records: [],
          note: 'Existing NISR Imihigo surface remains the inspection surface for its retained result set.',
        },
        {
          id: 'economy',
          route: '/economy-visual-preview',
          state: economyRecords.length ? 'RECORDS' : 'EMPTY',
          count: economyRecords.length,
          publicGate: economy.publishable ? 'OPEN' : 'CLOSED',
          records: economyRecords,
          note: 'Retained NISR CPI read. Review does not change its gate state.',
        },
        {
          id: 'election',
          route: '/election-visual-preview',
          state: electionRecords.length ? 'RECORDS' : 'EMPTY',
          count: electionRecords.length,
          publicGate: 'CLOSED',
          records: electionRecords,
          note: 'Validated retained IEBC bundle is visible here while the public Election evidence gate stays OFF.',
        },
        {
          id: 'politics',
          route: '/politics-visual-preview',
          state: 'EMPTY',
          count: 0,
          publicGate: 'CLOSED',
          records: [],
          note: 'No retained Politics ledger is implemented on this Alpha lineage. This describes the platform, not political activity in the world.',
        },
        conflict,
        market,
        energy,
        security,
        humanitarian,
      ],
    };
  }

  private async readConflict(): Promise<AlphaReviewDomain> {
    try {
      const rows = await this.prisma.conflictObservation.findMany({
        take: 500,
        orderBy: [{ occurredOn: 'desc' }, { ingestedAt: 'desc' }, { observationKey: 'asc' }],
      });
      return {
        id: 'conflict',
        route: '/conflict',
        state: rows.length ? 'RECORDS' : 'EMPTY',
        count: rows.length,
        publicGate: 'CLOSED',
        records: rows,
        note: 'Raw retained Conflict rows, including revision and provenance fields, for Product Owner review.',
      };
    } catch {
      return this.unavailable('conflict', '/conflict', 'Conflict retained store could not be read.');
    }
  }

  private async readMarket(): Promise<AlphaReviewDomain> {
    try {
      const rows = await this.prisma.marketObservation.findMany({
        take: 500,
        orderBy: [{ ingestedAt: 'desc' }, { id: 'asc' }],
        include: {
          run: true,
          snapshotRetrieval: {
            select: {
              retrievalId: true,
              providerId: true,
              endpointId: true,
              requestPath: true,
              requestedAt: true,
              retrievedAt: true,
              httpStatus: true,
              completeness: true,
              admissibility: true,
              refusalKey: true,
              refusalClass: true,
              rightsGrade: true,
              rightsInstrumentRef: true,
              payloadRetentionPermitted: true,
              publisherReleasedAt: true,
              publisherChangedAt: true,
              referencePeriod: true,
              sourceLanguage: true,
              extractorId: true,
              extractorVersion: true,
            },
          },
        },
      });
      return {
        id: 'market',
        route: '/market',
        state: rows.length ? 'RECORDS' : 'EMPTY',
        count: rows.length,
        publicGate: 'CLOSED',
        records: rows,
        note: 'All retained Market observation rows visible to the application role, not only displayable public projections.',
      };
    } catch {
      return this.unavailable('market', '/market', 'Market retained store could not be read.');
    }
  }

  private async readEnergy(): Promise<AlphaReviewDomain> {
    try {
      const rows = await this.prisma.energyObservation.findMany({
        take: 500,
        orderBy: [{ observationKey: 'asc' }, { revision: 'desc' }],
        include: {
          snapshotRetrieval: {
            select: {
              retrievalId: true,
              providerId: true,
              endpointId: true,
              requestPath: true,
              requestedAt: true,
              retrievedAt: true,
              httpStatus: true,
              completeness: true,
              admissibility: true,
              refusalKey: true,
              refusalClass: true,
              rightsGrade: true,
              rightsInstrumentRef: true,
              payloadRetentionPermitted: true,
            },
          },
        },
      });
      return {
        id: 'energy',
        route: '/energy',
        state: rows.length ? 'RECORDS' : 'EMPTY',
        count: rows.length,
        publicGate: 'CLOSED',
        records: rows,
        note: 'Includes admission, review and publicDisclosureApproved state; no field is changed by this read.',
      };
    } catch {
      return this.unavailable('energy', '/energy', 'Energy retained store could not be read.');
    }
  }

  private async readSecurity(): Promise<AlphaReviewDomain> {
    try {
      const rows = await this.prisma.securityObservation.findMany({
        take: 500,
        orderBy: [{ geographyId: 'asc' }, { observationKey: 'asc' }, { revisionOrdinal: 'desc' }],
        include: { run: true },
      });
      return {
        id: 'security',
        route: '/security-visual-preview',
        state: rows.length ? 'RECORDS' : 'EMPTY',
        count: rows.length,
        publicGate: 'CLOSED',
        records: rows,
        note: 'Internal retained Security observations. Public Security reader remains fail-closed.',
      };
    } catch {
      return this.unavailable('security', '/security-visual-preview', 'Security retained store could not be read.');
    }
  }

  private async readHumanitarian(): Promise<AlphaReviewDomain> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        'SELECT observation_key, revision_ordinal, source_revision_id, geometry_revision_id, geometry_sha256, capture_key, evidence FROM hum_authority.retained_observation_revision ORDER BY observation_key ASC, revision_ordinal DESC LIMIT 500',
      );
      return {
        id: 'humanitarian',
        route: '/humanitarian',
        state: rows.length ? 'RECORDS' : 'EMPTY',
        count: rows.length,
        publicGate: 'CLOSED',
        records: rows,
        note: 'Governed Humanitarian retained revisions only; raw capture bytes remain omitted.',
      };
    } catch {
      return this.unavailable(
        'humanitarian',
        '/humanitarian',
        'Humanitarian authority store is unavailable to the application review role; this is an access gap, not zero holdings.',
      );
    }
  }

  private unavailable(id: string, route: string, note: string): AlphaReviewDomain {
    return {
      id,
      route,
      state: 'UNAVAILABLE',
      count: null,
      publicGate: 'CLOSED',
      records: [],
      note,
    };
  }
}
