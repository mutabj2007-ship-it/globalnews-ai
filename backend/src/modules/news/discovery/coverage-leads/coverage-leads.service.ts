import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'pg';
import {
  discoverLeads,
  isCompleteUseRecord,
  type LeadSource,
} from '../gdelt-lead/gdelt-lead.discovery';
import {
  GDELT_ATTRIBUTION,
  GDELT_LEAD_USE_RECORD,
  type GdeltLead,
  type GdeltLeadUseRecord,
} from '../gdelt-lead/gdelt-lead.types';
import { checkLeadUrl } from '../gdelt-lead/lead-url-guard';
import { deriveLeadKeywords } from '../gdelt-lead/lead-keywords';
import {
  LeadCallGate,
  LeadQueryCache,
  type InstanceLock,
  type LockHandle,
} from '../gdelt-lead/lead-call-gate';
import { GdeltDocLeadSource, LeadFetchError } from './gdelt-doc-lead.source';

/*
  CTO R168 · GDELT COVERAGE LEADS (Alpha only, PO Option 1). A lead is a link to another outlet's
  coverage that GDELT's index observed. It is NOT a report this product read, NOT a source searched,
  NOT a citation and NOT evidence for any answer. This service is the only path to it: it is never
  called by the answer, telemetry or search builders, and its result has no count-shaped field.

  Fail-closed order: switch OFF → no governed E1 use record (NOT_AUTHORIZED) → question suppressed
  or without a gazetteer place → cache → capacity gate (single instance, 30/h per holder, ≥5 s) →
  one GDELT call. Any doubt answers "no leads"; nothing is retried.
*/

export const MAX_LEADS_SHOWN = 5;
const CACHE_TTL_MS = 15 * 60_000;
/** a fixed, arbitrary key for pg_try_advisory_lock, owned by this feature alone */
export const GDELT_LEAD_LOCK_KEY = 4_744_454_001;

export type CoverageLeadsState =
  | 'OFF'
  | 'NOT_AUTHORIZED'
  | 'SUPPRESSED'
  | 'NO_PLACE'
  | 'CAPACITY'
  | 'UNAVAILABLE'
  | 'NONE'
  | 'LEADS';

export interface CoverageLeadView {
  readonly outlet: string;
  readonly url: string;
  /** GDELT's observation time; never a publication date */
  readonly seenByGdeltAt: string;
  readonly language: string | null;
  /** the outlet's country as GDELT asserts it; never the story's place */
  readonly outletCountry: string | null;
}

export interface CoverageLeadsResponse {
  readonly state: CoverageLeadsState;
  readonly leads: readonly CoverageLeadView[];
  readonly attribution: typeof GDELT_ATTRIBUTION;
  /** the closed-vocabulary terms that were looked up (never the question) */
  readonly lookedUp?: { readonly place: string; readonly topics: readonly string[] };
}

export interface CoverageLeadsDeps {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly useRecord: GdeltLeadUseRecord | null;
  readonly source: LeadSource;
  readonly gate: LeadCallGate;
  readonly cache: LeadQueryCache<readonly CoverageLeadView[]>;
}

const respond = (
  state: CoverageLeadsState,
  leads: readonly CoverageLeadView[] = [],
  lookedUp?: CoverageLeadsResponse['lookedUp'],
): CoverageLeadsResponse => ({
  state,
  leads,
  attribution: GDELT_ATTRIBUTION,
  ...(lookedUp ? { lookedUp } : {}),
});

/** One lead per outlet, canonical https URL re-checked, at most five. */
export function toLeadViews(leads: readonly GdeltLead[]): CoverageLeadView[] {
  const views: CoverageLeadView[] = [];
  const outlets = new Set<string>();
  for (const lead of leads) {
    const gate = checkLeadUrl(lead.url);
    if (!gate.admitted || outlets.has(lead.domain)) continue;
    outlets.add(lead.domain);
    views.push({
      outlet: lead.domain,
      url: gate.url,
      seenByGdeltAt: lead.observedAt,
      language: lead.language,
      outletCountry: lead.providerCountry,
    });
    if (views.length === MAX_LEADS_SHOWN) break;
  }
  return views;
}

export async function coverageLeadsFor(
  question: string,
  deps: CoverageLeadsDeps,
): Promise<CoverageLeadsResponse> {
  if (deps.env.GDELT_LEAD_DISCOVERY_ENABLED !== 'true') return respond('OFF');
  if (!isCompleteUseRecord(deps.useRecord)) return respond('NOT_AUTHORIZED');
  const keywords = deriveLeadKeywords(question);
  if (keywords.kind !== 'QUERY') return respond(keywords.kind);
  const lookedUp = { place: keywords.place, topics: keywords.topics };
  const cached = deps.cache.get(keywords.gdeltQuery);
  if (cached !== undefined) return respond(cached.length > 0 ? 'LEADS' : 'NONE', cached, lookedUp);
  const slot = await deps.gate.reserve();
  if (!slot.granted) return respond('CAPACITY', [], lookedUp);
  try {
    const result = await discoverLeads(keywords.gdeltQuery, deps);
    const views = result.state === 'LEADS' ? toLeadViews(result.leads) : [];
    deps.cache.set(keywords.gdeltQuery, views);
    return respond(views.length > 0 ? 'LEADS' : 'NONE', views, lookedUp);
  } catch (error) {
    const outcome = error instanceof LeadFetchError ? error.outcome : null;
    if (
      outcome === null ||
      outcome.kind === 'REFUSED_BY_GDELT' ||
      outcome.reason === 'TimeoutError'
    )
      deps.gate.refused();
    return respond('UNAVAILABLE', [], lookedUp);
  }
}

/** pg_try_advisory_lock on a dedicated session; released when this process (or its connection) ends. */
export function postgresInstanceLock(connectionString: string | undefined): InstanceLock {
  return async (): Promise<LockHandle | null> => {
    if (connectionString === undefined || connectionString === '') return null;
    const client = new Client({ connectionString });
    let alive = true;
    client.on('error', () => {
      alive = false;
    });
    client.on('end', () => {
      alive = false;
    });
    try {
      await client.connect();
      const result = await client.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [
        GDELT_LEAD_LOCK_KEY,
      ]);
      if (result.rows[0]?.ok !== true) {
        await client.end().catch(() => undefined);
        return null;
      }
      return { alive: () => alive };
    } catch {
      await client.end().catch(() => undefined);
      return null;
    }
  };
}

@Injectable()
export class CoverageLeadsService {
  private readonly logger = new Logger(CoverageLeadsService.name);
  private readonly deps: CoverageLeadsDeps;

  constructor() {
    this.deps = {
      env: process.env,
      useRecord: GDELT_LEAD_USE_RECORD,
      source: new GdeltDocLeadSource(),
      gate: new LeadCallGate(postgresInstanceLock(process.env.DATABASE_URL)),
      cache: new LeadQueryCache<readonly CoverageLeadView[]>(CACHE_TTL_MS, 200),
    };
  }

  async leadsFor(question: string): Promise<CoverageLeadsResponse> {
    const response = await coverageLeadsFor(question, this.deps);
    /* the question is never logged: state and count only */
    this.logger.log(`coverage-leads state=${response.state} leads=${response.leads.length}`);
    return response;
  }
}
