import { admitResource, checkLeadUrl } from './lead-url-guard';
import {
  GDELT_ATTRIBUTION,
  GDELT_LEAD_USE_RECORD,
  type CandidateUrl,
  type DroppedLead,
  type GdeltLead,
  type GdeltLeadUseRecord,
  type LeadDiscoveryResult,
  type ResourceAdmitter,
} from './gdelt-lead.types';

/** The injected fetch. This increment ships NO live implementation. */
export interface LeadSource {
  fetchLeads(query: string): Promise<readonly GdeltLead[]>;
}

export class NoLiveLeadSource implements LeadSource {
  fetchLeads(): Promise<readonly GdeltLead[]> {
    return Promise.reject(new Error('LIVE_WIRING_NOT_AUTHORIZED'));
  }
}

export interface LeadDiscoveryDeps {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly useRecord: GdeltLeadUseRecord | null;
  readonly source: LeadSource;
}

const result = (
  state: LeadDiscoveryResult['state'],
  leads: readonly GdeltLead[] = [],
): LeadDiscoveryResult => Object.freeze({ state, leads });

/*
  Spec §3 — fail closed, in this order. Each step that refuses makes ZERO source calls:
    OFF                 GDELT_LEAD_DISCOVERY_ENABLED is not exactly 'true' (the default)
    NOT_AUTHORIZED      no governed use record (actual terms hash + E1 wording), CTO R165 §GDELT 3
    LIVE_WIRING_ABSENT  the source is the shipped NoLiveLeadSource
    LEADS               only after a separate E1 review and a PO action wire a real source
*/
export async function discoverLeads(
  query: string,
  deps: LeadDiscoveryDeps,
): Promise<LeadDiscoveryResult> {
  if (deps.env.GDELT_LEAD_DISCOVERY_ENABLED !== 'true') return result('OFF');
  if (!isCompleteUseRecord(deps.useRecord)) return result('NOT_AUTHORIZED');
  if (deps.source instanceof NoLiveLeadSource) return result('LIVE_WIRING_ABSENT');
  return result('LEADS', await deps.source.fetchLeads(query));
}

export function defaultLeadDiscoveryDeps(): LeadDiscoveryDeps {
  return { env: process.env, useRecord: GDELT_LEAD_USE_RECORD, source: new NoLiveLeadSource() };
}

function isCompleteUseRecord(record: GdeltLeadUseRecord | null): record is GdeltLeadUseRecord {
  return (
    record !== null &&
    /^https:\/\//.test(record.termsUrl) &&
    /^[0-9a-f]{64}$/.test(record.termsSha256) &&
    !Number.isNaN(Date.parse(record.termsReadAt)) &&
    record.e1VerdictRef.trim() !== '' &&
    record.e1Wording.trim() !== ''
  );
}

/*
  Spec §4 / E1 C-G2 — a lead becomes a candidate ONLY on a positive per-resource admission (exact
  host + covering path + GET + robots ALLOWED + E1 per-use ref). Otherwise it is DROPPED, not queued.
  Discovery never upgrades permission: the candidate is read later through an already-cleared lane,
  which dates the item from the publisher's own date. Duplicate URLs collapse to one candidate, so a
  syndicated story never becomes a count.
*/
export function candidatesFromLeads(
  leads: readonly GdeltLead[],
  admit: ResourceAdmitter,
): { readonly fetchable: readonly CandidateUrl[]; readonly dropped: readonly DroppedLead[] } {
  const fetchable: CandidateUrl[] = [];
  const dropped: DroppedLead[] = [];
  const seen = new Set<string>();
  for (const lead of leads) {
    const gate = checkLeadUrl(lead.url);
    if (!gate.admitted) {
      dropped.push(
        Object.freeze({ url: lead.url, reason: 'URL_REFUSED' as const, detail: gate.reason }),
      );
      continue;
    }
    if (seen.has(gate.url)) continue;
    seen.add(gate.url);
    const admission = admitResource(admit, gate.host, gate.path);
    if (!admission.admitted) {
      dropped.push(Object.freeze({ url: gate.url, reason: admission.reason }));
      continue;
    }
    fetchable.push(
      Object.freeze({
        url: gate.url,
        e1PerUseRef: admission.e1PerUseRef,
        attribution: GDELT_ATTRIBUTION,
      }),
    );
  }
  return Object.freeze({ fetchable, dropped });
}
