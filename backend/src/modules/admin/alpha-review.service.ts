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

export interface AlphaReviewReportingRecord {
  id: string;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  category: string;
  publishedAt: string;
  firstSeenAt: string;
  countryCode: string | null;
  countryName: string | null;
  countries: Array<{
    countryCode: string;
    countryName: string;
    relevanceScore: number;
  }>;
}

export interface AlphaReviewReportingLane {
  id: 'politics' | 'security' | 'conflict' | 'market' | 'energy' | 'humanitarian';
  state: 'RECORDS' | 'EMPTY' | 'UNAVAILABLE';
  basis: 'RETAINED_REPORTING_FILTER';
  assessment: 'UNASSESSED';
  publicGate: 'CLOSED';
  count: number | null;
  newestFetchedAt: string | null;
  records: AlphaReviewReportingRecord[];
  note: string;
}

export interface AlphaReviewResponse {
  scope: 'ALPHA_ADMIN_REVIEW';
  generatedAt: string;
  domains: AlphaReviewDomain[];
  reporting: AlphaReviewReportingLane[];
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
    const [economy, election, conflict, market, energy, security, humanitarian, reporting] =
      await Promise.all([
        this.economy.readNisrHeadlineCpi(),
        Promise.resolve(this.election.review('en')),
        this.readConflict(),
        this.readMarket(),
        this.readEnergy(),
        this.readSecurity(),
        this.readHumanitarian(),
        this.readRetainedReporting(),
      ]);

    const economyRecords = economy.retainedState === 'NO_CAPTURE' ? [] : [economy];
    const electionRecords = Array.isArray(election.records) ? election.records : [];

    return {
      scope: 'ALPHA_ADMIN_REVIEW',
      generatedAt: new Date().toISOString(),
      reporting,
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
          note: 'No governed Politics observation is admitted on this Alpha lineage. Retained reporting candidates are exposed separately to Product Owner review as unassessed context.',
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

  private async readRetainedReporting(): Promise<AlphaReviewReportingLane[]> {
    const lanes = [
      {
        id: 'politics' as const,
        category: 'politics',
        terms: [] as string[],
        note: 'Retained articles in the Politics provider category. Context only: no lifecycle, actor, polling, confidence or political-state assessment is inferred.',
      },
      {
        id: 'market' as const,
        category: 'business',
        terms: [] as string[],
        note: 'Retained Business-category reporting. Context only: no price, trade, release-status or market metric is inferred from news reporting.',
      },
      {
        id: 'security' as const,
        terms: ['security', 'attack', 'military', 'armed', 'violence', 'border', 'terror', 'missile'],
        note: 'Keyword-matched retained reporting for Product Owner review. These are not Security observations and carry no severity, actor or attribution assessment.',
      },
      {
        id: 'conflict' as const,
        terms: ['conflict', 'war', 'fighting', 'ceasefire', 'rebel', 'troops', 'airstrike', 'strike'],
        note: 'Keyword-matched retained reporting for Product Owner review. Country attribution is reporting context, never an incident coordinate or Conflict admission.',
      },
      {
        id: 'energy' as const,
        terms: ['energy', 'oil', 'gas', 'power', 'electricity', 'grid', 'pipeline', 'fuel'],
        note: 'Keyword-matched retained reporting. It does not become a generation, capacity, storage, outage, flow, grid or asset measurement.',
      },
      {
        id: 'humanitarian' as const,
        terms: ['humanitarian', 'refugee', 'displaced', 'aid', 'famine', 'flood', 'drought', 'earthquake', 'disaster'],
        note: 'Keyword-matched retained reporting. It does not establish humanitarian need, access, affected population or governed protection status.',
      },
    ];

    return Promise.all(lanes.map((lane) => this.readReportingLane(lane)));
  }

  private async readReportingLane(lane: {
    id: AlphaReviewReportingLane['id'];
    category?: string;
    terms: string[];
    note: string;
  }): Promise<AlphaReviewReportingLane> {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const termClauses = lane.terms.flatMap((term) => [
      { title: { contains: term, mode: 'insensitive' as const } },
      { summary: { contains: term, mode: 'insensitive' as const } },
    ]);
    const where = {
      fetchedAt: { gte: cutoff },
      ...(lane.category ? { category: lane.category } : {}),
      ...(termClauses.length ? { OR: termClauses } : {}),
    };

    try {
      const [count, rows] = await Promise.all([
        this.prisma.article.count({ where }),
        this.prisma.article.findMany({
          where,
          take: 12,
          orderBy: [{ fetchedAt: 'desc' }, { id: 'asc' }],
          select: {
            id: true,
            title: true,
            summary: true,
            url: true,
            sourceName: true,
            category: true,
            publishedAt: true,
            fetchedAt: true,
            countryCode: true,
            countryName: true,
            countries: {
              where: { isRelevant: true },
              orderBy: [{ relevanceScore: 'desc' }, { countryCode: 'asc' }],
              select: {
                countryCode: true,
                countryName: true,
                relevanceScore: true,
              },
            },
          },
        }),
      ]);

      return {
        id: lane.id,
        state: count > 0 ? 'RECORDS' : 'EMPTY',
        basis: 'RETAINED_REPORTING_FILTER',
        assessment: 'UNASSESSED',
        publicGate: 'CLOSED',
        count,
        newestFetchedAt: rows[0]?.fetchedAt.toISOString() ?? null,
        records: rows.map((row) => ({
          id: row.id,
          title: row.title,
          summary: row.summary,
          url: row.url,
          sourceName: row.sourceName,
          category: row.category,
          publishedAt: row.publishedAt.toISOString(),
          firstSeenAt: row.fetchedAt.toISOString(),
          countryCode: row.countryCode,
          countryName: row.countryName,
          countries: row.countries,
        })),
        note: lane.note,
      };
    } catch {
      return {
        id: lane.id,
        state: 'UNAVAILABLE',
        basis: 'RETAINED_REPORTING_FILTER',
        assessment: 'UNASSESSED',
        publicGate: 'CLOSED',
        count: null,
        newestFetchedAt: null,
        records: [],
        note: 'Retained reporting could not be read. This must not be interpreted as zero reporting.',
      };
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
