import { Injectable, Logger } from '@nestjs/common';
import {
  procurementPortalReferenceKey,
  type ConflictObservation,
  type ConflictRetainedEvidenceDetail,
  type MarketRetainedProcurementNotice,
} from '@globalnews-ai/shared';
import type { AskR2Route } from '../ask-router/ask-r2-route';
import { ConflictObservationRepository } from '../conflict-observation/conflict-observation.repository';
import { MarketReadRepository } from '../market-ingest/market-read.repository';
import { EconomyObservationReadService } from '../economy/economy-observation.read';
import { readRetainedImihigo } from './imihigo-retained.reader';
import { nisrDistricts } from '../geo/rwanda-nisr.authority';
import { selectContributors } from './contributor-selection';
import type {
  AskContribution,
  AskContributionObservation,
  AskContributorSelection,
} from './ask-contribution.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * INTELLIGENCE BINDING R1 — THE ONE COORDINATOR BEHIND ASK
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Route once (the existing router) → select (pure, contributor-selection.ts) → read the
 * governed retained stores that apply → hand ONE contribution set to the existing answer
 * path. It is not a second router, not a provider framework and not a model caller:
 *
 *   - every read is LOCAL and RETAINED: Prisma rows or a reviewed in-repo capture; no
 *     provider, no acquisition, no scheduler, no network, no secret;
 *   - ZERO model calls — a specialist never costs AI quota;
 *   - each read is bounded (READ_TIMEOUT_MS) and isolated: a failing or slow contributor
 *     becomes a DEGRADED contribution and never takes the Ask down;
 *   - a contributor with nothing governed to say says so by STATUS (NO_MATCH / NO_DATA /
 *     NOT_ASSESSED) — never by an empty-but-"used" result, and never as a zero.
 */
export const READ_TIMEOUT_MS = 1500;
/** Retained Conflict events are read for the last year; age is disclosed, never hidden. */
export const CONFLICT_WINDOW_DAYS = 365;
export const CONFLICT_RECENT_DAYS = 7;
export const CONFLICT_MAX_OBSERVATIONS = 10;

const KIGALI_PROVINCE_ID = '1';

/** UNIFIED INTELLIGENCE BINDING R2F — the dashboard modules with a governed contributor. */
export const PINNABLE_MODULES = ['CONFLICT', 'IMIHIGO', 'ECONOMY', 'MARKET'] as const;
export type PinnableModule = (typeof PINNABLE_MODULES)[number];

/** A dashboard record the reader pinned, as RESOLVED by its module's own read seam. */
export interface PinnedModuleRecord {
  readonly module: PinnableModule;
  readonly observationKey: string;
  readonly countryIso3: string | null;
  readonly district: { readonly id: string; readonly name: string } | null;
}

const PINNED_CONTRIBUTOR: Readonly<
  Record<PinnableModule, AskContributorSelection['contributorId']>
> = {
  CONFLICT: 'CONFLICT',
  IMIHIGO: 'IMIHIGO',
  ECONOMY: 'ECONOMY_CPI',
  MARKET: 'MARKET_PROCUREMENT',
};
const PINNED_DOMAIN: Readonly<Record<PinnableModule, string>> = {
  CONFLICT: 'security',
  IMIHIGO: 'governance',
  ECONOMY: 'economic',
  MARKET: 'economic',
};
/**
 * The one retained Economy record a dashboard can pin: Rwanda headline CPI, named by the stable
 * id of its governed read (GET /economy/observations/rw-nisr-cpi) — the id the dashboard holds.
 * Pinnable only while that read is DISPLAYABLE.
 */
export const ECONOMY_PINNED_KEY = 'rw-nisr-cpi';
/** Bound on the in-scope procurement notices one country read contributes. */
const PROCUREMENT_LIMIT = 20;
/** One pinned notice by its portal key: the key filter runs before this limit, so it is 1. */
const pinnedNotice = async (market: MarketReadRepository, key: string) =>
  (
    await market.procurementMatching(
      (n) => procurementPortalReferenceKey(n.portalReference) === key,
      1,
    )
  ).notices[0];

/** One retained procurement notice as a governed observation (shared by both reads). */
function procurementObservation(n: MarketRetainedProcurementNotice): AskContributionObservation {
  return {
    reference: `TED:${n.portalReference.noticeId}`,
    kind: n.noticeType,
    label: n.title.en ?? n.title.pl ?? null,
    value: n.totalValue === null ? null : String(n.totalValue),
    unit: n.currency,
    period: n.publicationDate,
    geography: n.buyerCountryIso3,
    source: { name: 'TED — Tenders Electronic Daily', url: n.sourceUrl, licence: null },
    retainedAt: n.retainedAt,
  };
}

export interface AskContributionSet {
  readonly considered: readonly AskContributorSelection[];
  readonly contributions: readonly AskContribution[];
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CONTRIBUTOR_TIMEOUT')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

const base = (
  s: AskContributorSelection,
  over: Partial<AskContribution> & Pick<AskContribution, 'status' | 'temporalBasis'>,
): AskContribution => ({
  contributorId: s.contributorId,
  domain: s.domain,
  applicability: s.applicability,
  observations: [],
  geographyBasis: s.scope.district?.id ?? s.scope.countryIso3,
  disclosures: [],
  degradationReason: null,
  ...over,
});

@Injectable()
export class AskSpecialistReadCoordinator {
  private readonly logger = new Logger(AskSpecialistReadCoordinator.name);

  constructor(
    private readonly conflict: ConflictObservationRepository,
    private readonly market: MarketReadRepository,
    private readonly economy: EconomyObservationReadService,
  ) {}

  /**
   * The specialist domains whose callable seam is PROVEN here — a measured fact handed to the
   * router's registry port, never a default. CONFLICT is bound because its read seam is this
   * coordinator's injected, tested ConflictObservationRepository.
   */
  boundSpecialistDomains(): readonly string[] {
    return ['CONFLICT'];
  }

  select(route: AskR2Route): AskContributorSelection[] {
    return selectContributors(route);
  }

  async read(route: AskR2Route, now: Date = new Date()): Promise<AskContributionSet> {
    const considered = this.select(route);
    const contributions = await Promise.all(
      considered.map(async (selection): Promise<AskContribution> => {
        try {
          return await withTimeout(this.readOne(selection, now), READ_TIMEOUT_MS);
        } catch (error) {
          const reason =
            (error as Error)?.message === 'CONTRIBUTOR_TIMEOUT' ? 'TIMEOUT' : 'READ_FAILED';
          this.logger.warn(`contributor ${selection.contributorId} degraded: ${reason}`);
          return base(selection, {
            status: 'DEGRADED',
            temporalBasis: 'NONE',
            degradationReason: reason,
          });
        }
      }),
    );
    return { considered, contributions };
  }

  /*
   * ════════════════════════════════════════════════════════════════════════════════════════
   * UNIFIED INTELLIGENCE BINDING R2F — A DASHBOARD OBSERVATION PINNED BY THE READER
   * ════════════════════════════════════════════════════════════════════════════════════════
   *
   * A dashboard "Ask about this" names ONE governed record by its stable key. This coordinator
   * owns the module read seams, so it resolves that key (local / retained reads only — no
   * provider, no model, no network) and, at execution, contributes exactly that record through
   * the SAME governed channel the text-keyed contributors use. No second retrieval, no second
   * prompt engine. A module without a governed contributor is not pinnable (NOT_BINDABLE_YET).
   */
  async resolvePinned(module: PinnableModule, key: string): Promise<PinnedModuleRecord | null> {
    switch (module) {
      case 'CONFLICT': {
        const row = await this.conflict.currentByKey(key);
        if (row === null) return null;
        const iso3 = row.geography.countryIso3;
        return {
          module,
          observationKey: row.observationKey,
          countryIso3: typeof iso3 === 'string' && /^[A-Z]{3}$/.test(iso3) ? iso3 : null,
          district: null,
        };
      }
      case 'IMIHIGO': {
        const view = readRetainedImihigo();
        if (view.state !== 'ADMITTED') return null;
        const record = view.records.find(
          (r) =>
            r.entityClass === 'district' &&
            `${view.captureSha256.slice(0, 12)}:${r.entity}` === key,
        );
        if (record === undefined) return null;
        const district = nisrDistricts().find(
          (d) => d.name.canonicalName.toLowerCase() === record.entity.toLowerCase(),
        );
        return {
          module,
          observationKey: key,
          countryIso3: 'RWA',
          district:
            district === undefined
              ? null
              : { id: district.externalId, name: district.name.canonicalName },
        };
      }
      case 'ECONOMY': {
        const view = await this.economy.readNisrHeadlineCpi();
        if (
          key !== ECONOMY_PINNED_KEY ||
          view.slot.kind !== 'OBSERVATION' ||
          view.retainedState !== 'DISPLAYABLE'
        ) {
          return null;
        }
        return { module, observationKey: key, countryIso3: 'RWA', district: null };
      }
      case 'MARKET': {
        const notice = await pinnedNotice(this.market, key);
        if (notice === undefined) return null;
        return {
          module,
          observationKey: key,
          countryIso3: /^[A-Z]{3}$/.test(notice.buyerCountryIso3) ? notice.buyerCountryIso3 : null,
          district: null,
        };
      }
    }
  }

  /** The pinned record as ONE governed contribution (bounded; degrades, never throws). */
  async readPinned(record: PinnedModuleRecord, now: Date = new Date()): Promise<AskContribution> {
    const s: AskContributorSelection = {
      contributorId: PINNED_CONTRIBUTOR[record.module],
      domain: PINNED_DOMAIN[record.module],
      applicability: 'SUPPLEMENTARY',
      scope: { countryIso3: record.countryIso3, district: record.district, place: null },
    };
    try {
      return await withTimeout(this.readPinnedOne(record, s, now), READ_TIMEOUT_MS);
    } catch (error) {
      const reason =
        (error as Error)?.message === 'CONTRIBUTOR_TIMEOUT' ? 'TIMEOUT' : 'READ_FAILED';
      this.logger.warn(`pinned ${record.module} degraded: ${reason}`);
      return base(s, { status: 'DEGRADED', temporalBasis: 'NONE', degradationReason: reason });
    }
  }

  private async readPinnedOne(
    record: PinnedModuleRecord,
    s: AskContributorSelection,
    now: Date,
  ): Promise<AskContribution> {
    switch (record.module) {
      case 'CONFLICT': {
        const row = await this.conflict.currentByKey(record.observationKey);
        if (row === null) {
          return base(s, { status: 'NO_MATCH', temporalBasis: 'RETAINED_EVENT_RECORD' });
        }
        const details = await Promise.resolve()
          .then(() => this.conflict.evidenceDetails([row.observationKey]))
          .catch(() => new Map<string, ConflictRetainedEvidenceDetail>());
        const recent =
          now.getTime() - Date.parse(row.temporal.eventStartedAt) <=
          CONFLICT_RECENT_DAYS * 86_400_000;
        return base(s, {
          status: 'USED',
          temporalBasis: 'RETAINED_EVENT_RECORD',
          observations: [conflictObservation(row, details.get(row.observationKey))],
          disclosures: [
            'RETAINED_NOT_CURRENT',
            'SEVERITY_NOT_ASSESSED',
            'PINNED_BY_READER',
            ...(recent ? [] : ['NO_RECENT_RETAINED_RECORD']),
          ],
        });
      }
      case 'IMIHIGO':
        return this.readImihigo(s);
      case 'ECONOMY':
        return this.readCpi(s);
      case 'MARKET': {
        const notice = await pinnedNotice(this.market, record.observationKey);
        if (notice === undefined) {
          return base(s, { status: 'NO_MATCH', temporalBasis: 'RETAINED_PUBLICATION' });
        }
        return base(s, {
          status: 'USED',
          temporalBasis: 'RETAINED_PUBLICATION',
          observations: [procurementObservation(notice)],
          disclosures: ['RETAINED_NOT_CURRENT', 'SNAPSHOT_NOT_CHANGE_SERIES', 'PINNED_BY_READER'],
        });
      }
    }
  }

  private async readOne(s: AskContributorSelection, now: Date): Promise<AskContribution> {
    switch (s.contributorId) {
      case 'CONFLICT':
        return this.readConflict(s, now);
      case 'MARKET_PROCUREMENT':
        return this.readProcurement(s);
      case 'ECONOMY_CPI':
        return this.readCpi(s);
      case 'IMIHIGO':
        return this.readImihigo(s);
      case 'GEOGRAPHY':
        return this.readGeography(s);
      case 'HUMANITARIAN':
        /* R1 truth: no governed humanitarian observation reader is callable/populated. */
        return base(s, {
          status: 'NOT_ASSESSED',
          temporalBasis: 'NONE',
          disclosures: ['HUMANITARIAN_NOT_ASSESSED'],
          degradationReason: 'NO_GOVERNED_OBSERVATION_READER',
        });
    }
  }

  private async readConflict(s: AskContributorSelection, now: Date): Promise<AskContribution> {
    const iso3 = s.scope.countryIso3 as string;
    const since = new Date(now.getTime() - CONFLICT_WINDOW_DAYS * 86_400_000);
    const rows = await this.conflict.currentForCountry(iso3, since, CONFLICT_MAX_OBSERVATIONS);
    if (rows.length === 0) {
      return base(s, { status: 'NO_MATCH', temporalBasis: 'RETAINED_EVENT_RECORD' });
    }
    const newest = Math.max(...rows.map((r) => Date.parse(r.temporal.eventStartedAt)));
    const recent = now.getTime() - newest <= CONFLICT_RECENT_DAYS * 86_400_000;
    /* LIVE ACCEPTANCE REPAIR R1 (C) — the source-verbatim place/parties/headline of each record,
       read from its retained capture in ONE batched read. Supplementary: absent detail leaves
       the record as it was, never fails the contribution. */
    const details = await Promise.resolve()
      .then(() => this.conflict.evidenceDetails(rows.map((r) => r.observationKey)))
      .catch(() => new Map<string, ConflictRetainedEvidenceDetail>());
    return base(s, {
      status: 'USED',
      temporalBasis: 'RETAINED_EVENT_RECORD',
      observations: rows.map((row) => conflictObservation(row, details.get(row.observationKey))),
      disclosures: [
        'RETAINED_NOT_CURRENT',
        /* No accepted severity rule exists; records are never ranked into "how serious". */
        'SEVERITY_NOT_ASSESSED',
        ...(recent ? [] : ['NO_RECENT_RETAINED_RECORD']),
        /* "eastern DRC": the read is country-scoped; each record keeps its own stated place. */
        ...(s.scope.qualifier ? ['SUBNATIONAL_SCOPE_NOT_APPLIED'] : []),
      ],
    });
  }

  private async readProcurement(s: AskContributorSelection): Promise<AskContribution> {
    /* EAST AFRICA P0 · B — scope (buyer country) is filtered BEFORE the limit, in the read. */
    const { held, notices: inScope } = await this.market.procurementMatching(
      (n) => n.buyerCountryIso3 === s.scope.countryIso3,
      PROCUREMENT_LIMIT,
    );
    if (held === 0) {
      return base(s, {
        status: 'NO_DATA',
        temporalBasis: 'RETAINED_PUBLICATION',
        disclosures: ['NO_RETAINED_CAPTURE'],
      });
    }
    if (inScope.length === 0) {
      return base(s, { status: 'NO_MATCH', temporalBasis: 'RETAINED_PUBLICATION' });
    }
    return base(s, {
      status: 'USED',
      temporalBasis: 'RETAINED_PUBLICATION',
      observations: inScope.map(procurementObservation),
      /* One retained publication-day snapshot: notices, never a series of "changes". */
      disclosures: ['RETAINED_NOT_CURRENT', 'SNAPSHOT_NOT_CHANGE_SERIES'],
    });
  }

  private async readCpi(s: AskContributorSelection): Promise<AskContribution> {
    /* The only governed series is Rwanda headline CPI; any other country is not covered. */
    if (s.scope.countryIso3 !== 'RWA') {
      return base(s, { status: 'NO_MATCH', temporalBasis: 'RETAINED_STATISTICAL_RELEASE' });
    }
    const view = await this.economy.readNisrHeadlineCpi();
    /* GOVERNED RETAINED GAP REPAIR R1 — only a figure the governed reader itself marks
       DISPLAYABLE is ever used. Everything else is NO_DATA with a disclosure that says WHICH gap:
         NO_RETAINED_CAPTURE               nothing admitted is held;
         RETAINED_ARTIFACT_NOT_DISPLAYABLE an admitted release is held but cannot be read under
                                           its governed extraction rules (e.g. extractor identity).
       The internal reason stays in degradationReason; it is never reader copy. */
    if (
      view.slot.kind !== 'OBSERVATION' ||
      view.provenance === undefined ||
      view.retainedState !== 'DISPLAYABLE'
    ) {
      return base(s, {
        status: 'NO_DATA',
        temporalBasis: 'RETAINED_STATISTICAL_RELEASE',
        disclosures: [
          view.retainedState === 'NO_CAPTURE'
            ? 'NO_RETAINED_CAPTURE'
            : 'RETAINED_ARTIFACT_NOT_DISPLAYABLE',
        ],
        degradationReason: view.slot.kind === 'GAP' ? view.slot.reason : 'NOT_DISPLAYABLE',
      });
    }
    const o = view.slot.observation;
    return base(s, {
      status: 'USED',
      temporalBasis: 'RETAINED_STATISTICAL_RELEASE',
      observations: [
        {
          reference: o.seriesId,
          kind: 'HEADLINE_CPI_YOY',
          label: view.seriesLabel ?? null,
          value: String(o.value),
          unit: o.unit,
          period: view.provenance.referencePeriod,
          geography: view.geographyLabel ?? 'RWA',
          source: {
            name: view.provenance.institution,
            url: view.provenance.sourceUrl ?? null,
            licence: view.provenance.licence,
          },
          retainedAt: view.provenance.retrievedAt,
        },
      ],
      /* The series' own FRESH/STALE is capture-relative; Ask never presents it as current. */
      disclosures: ['RETAINED_NOT_CURRENT'],
    });
  }

  private readImihigo(s: AskContributorSelection): AskContribution {
    const view = readRetainedImihigo();
    if (view.state !== 'ADMITTED') {
      return base(s, {
        status: 'REFUSED',
        temporalBasis: 'RETAINED_EVALUATION_CYCLE',
        disclosures: ['RETAINED_ARTIFACT_NOT_DISPLAYABLE'],
        degradationReason: 'ADMISSION_IDENTITY',
      });
    }
    const district = s.scope.district;
    if (district === null) {
      /* No ranking, no national summary: a district result needs a named district. */
      return base(s, {
        status: 'NO_MATCH',
        temporalBasis: 'RETAINED_EVALUATION_CYCLE',
        degradationReason: 'DISTRICT_NOT_NAMED',
      });
    }
    const record = view.records.find(
      (r) => r.entityClass === 'district' && r.entity.toLowerCase() === district.name.toLowerCase(),
    );
    if (record === undefined) {
      /* Gasabo, Kicukiro and Nyarugenge exist only inside the City of Kigali aggregate —
         which is NEVER assigned to an individual district. */
      const kigali = nisrDistricts().some(
        (d) => d.externalId === district.id && d.provinceId === KIGALI_PROVINCE_ID,
      );
      return base(s, {
        status: 'NO_MATCH',
        temporalBasis: 'RETAINED_EVALUATION_CYCLE',
        disclosures: kigali ? ['AGGREGATE_NOT_ASSIGNED_TO_DISTRICT'] : [],
        degradationReason: 'DISTRICT_NOT_INDIVIDUALLY_COVERED',
      });
    }
    return base(s, {
      status: 'USED',
      temporalBasis: 'RETAINED_EVALUATION_CYCLE',
      observations: [
        {
          reference: `${view.captureSha256.slice(0, 12)}:${record.entity}`,
          kind: 'IMIHIGO_DISTRICT_FINAL_SCORE',
          label: record.entity,
          value: record.result.value,
          unit: record.result.unit,
          period: view.cycle,
          geography: district.id,
          source: {
            name: `${view.publisher} — ${view.sourceDocument}`,
            url: view.sourceUrl,
            licence: view.licence,
          },
          retainedAt: view.capturedAt,
        },
      ],
      disclosures: ['RETAINED_NOT_CURRENT', 'CLOSED_EVALUATION_CYCLE'],
    });
  }

  private readGeography(s: AskContributorSelection): AskContribution {
    const district = s.scope.district;
    const observation: AskContributionObservation =
      district !== null
        ? {
            reference: district.id,
            kind: 'NISR_DISTRICT',
            label: district.name,
            value: null,
            unit: null,
            period: '',
            geography: 'RWA',
            source: {
              name: 'National Institute of Statistics of Rwanda (NISR)',
              url: null,
              licence: 'CC BY 4.0',
            },
            retainedAt: null,
          }
        : {
            reference: s.scope.place ?? '',
            kind: 'PLACE',
            label: s.scope.place,
            value: null,
            unit: null,
            period: '',
            geography: s.scope.countryIso3 ?? '',
            source: { name: 'GeoNames gazetteer', url: null, licence: 'CC BY 4.0' },
            retainedAt: null,
          };
    /* Context, not evidence: a resolved place says WHERE, never that anything happened. */
    return base(s, {
      status: 'USED',
      temporalBasis: 'REFERENCE_GEOGRAPHY',
      observations: [observation],
      disclosures: ['CONTEXT_NOT_EVIDENCE'],
    });
  }
}

/** The publisher's own citation, split on its record separator only — each piece verbatim. */
export function citedOutletsOf(citation: string | undefined): string[] {
  return (citation ?? '')
    .split(';')
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0)
    .slice(0, 3);
}

export function conflictObservation(
  row: ConflictObservation,
  detail?: ConflictRetainedEvidenceDetail,
): AskContributionObservation {
  return {
    reference: row.observationKey,
    kind: row.eventType,
    /* LIVE ACCEPTANCE REPAIR R1 (C) — the label is the source headline when one exists; the raw
       concatenated citation now travels split, as cited outlets, never as the row's text. */
    label: detail?.sourceHeadline ?? null,
    value: null,
    unit: null,
    period: row.temporal.eventStartedAt.slice(0, 10),
    geography: row.geography.countryIso3 ?? row.geography.sourceCountryName ?? '',
    source: {
      name: 'UCDP — Uppsala Conflict Data Program',
      url: row.sourceReference.sourceUrl ?? null,
      licence: null,
    },
    retainedAt: row.temporal.ingestedAt,
    detail: {
      place: detail?.whereDescription ?? null,
      parties: detail?.sourceParties ?? [],
      headline: detail?.sourceHeadline ?? null,
      citedOutlets: citedOutletsOf(row.sourceReference.citation),
    },
  };
}
