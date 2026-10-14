/**
 * POLITICS EARLY-SIGNAL — OFFLINE T3 ENGINE (R66 Workstream A).
 *
 * Pure and deterministic: no clock, network, DB, provider, model, scheduler or Nest wiring. It is not
 * imported by `politics.module.ts` or `app.module.ts`. Input is synthetic fixtures or retained
 * observations; output is the versioned read model in `@globalnews-ai/shared` (politics/early-signal).
 *
 * Pipeline:
 *   1. access gate         SEARCH_NOT_RUN / PROVIDER_FAILED / PARTIAL / RIGHTS_WITHHELD stay distinct
 *   2. admission           rights (RETENTION must be CLEAR), provenance, no screenshot/repost origin
 *   3. reporting chain     one wire origin = one chain, whatever the host; unknown ≠ independent
 *   4. revisions           UPDATE / CORRECTED / RETRACTED supersede by id; history kept, never summed
 *   5. development         grouped ONLY on same place + overlapping event time + same incident
 *   6. geography           event country from evidence; bare "Congo" and client country decide nothing
 *   7. change              NEW_EVIDENCE / NO_MATERIAL_CHANGE against a baseline, else null
 *   8. impact              closed predicate table → qualitative mechanism, competing hypotheses,
 *                          disconfirmers, next-check condition; no probability, no invented date
 *
 * Nothing here invents a source, event, date, number, coverage claim or freshness claim.
 */
import {
  EAST_AFRICA_MEMBERS,
  EU27_MEMBERS,
  MIDDLE_EAST_MEMBERS,
  POLITICS_ES_CONTRACT_VERSION,
  POLITICS_ES_FORBIDDEN_KEYS,
  type PoliticsEsAccessState,
  type PoliticsEsChainBasis,
  type PoliticsEsClaimView,
  type PoliticsEsDevelopmentView,
  type PoliticsEsEvaluationInput,
  type PoliticsEsEvidenceClass,
  type PoliticsEsHumanDispute,
  type PoliticsEsImpactDomain,
  type PoliticsEsImpactHypothesis,
  type PoliticsEsObservationInput,
  type PoliticsEsPlaceBasis,
  type PoliticsEsPrecision,
  type PoliticsEsReadModelV1,
  type PoliticsEsRegion,
  type PoliticsEsRegionalReview,
  type PoliticsEsWithholdReason,
} from '@globalnews-ai/shared';

export interface PoliticsEsEngineInput {
  readonly observations: readonly PoliticsEsObservationInput[];
  readonly evaluation: PoliticsEsEvaluationInput;
  readonly humanDisputes?: readonly PoliticsEsHumanDispute[];
}

/* ── 1. access ───────────────────────────────────────────────────────────── */

const COMPLETED: readonly PoliticsEsAccessState[] = ['COMPLETED_MATCH', 'COMPLETED_NO_MATCH'];
export const accessCompleted = (a: PoliticsEsAccessState): boolean => COMPLETED.includes(a);

export function absenceWordingCode(state: PoliticsEsAccessState): string {
  switch (state) {
    case 'COMPLETED_MATCH':
      return 'RESULTS_FOUND';
    case 'COMPLETED_NO_MATCH':
      return 'SEARCH_COMPLETED_NO_MATCHING_REPORTS';
    case 'PARTIAL':
      return 'SEARCH_INCOMPLETE_SOME_SOURCES_UNAVAILABLE';
    case 'PROVIDER_FAILED':
      return 'SEARCH_COULD_NOT_BE_COMPLETED';
    case 'RIGHTS_WITHHELD':
      return 'SOURCE_WORDING_NOT_AVAILABLE_TO_US';
    case 'SEARCH_NOT_RUN':
      return 'NO_SEARCH_HAS_RUN';
  }
}

/* ── 2. admission ────────────────────────────────────────────────────────── */

export function withholdReason(o: PoliticsEsObservationInput): PoliticsEsWithholdReason | null {
  if (o.artefactKind === 'SCREENSHOT' || o.artefactKind === 'REPOST') return 'DERIVATIVE_ARTEFACT_REFUSED';
  if (o.deliveredByProviderId === null || o.deliveredByProviderId.trim() === '') return 'UNKNOWN_PROVENANCE';
  if (o.rights.RETENTION !== 'CLEAR_FOR_EXACT_USE') return 'RIGHTS_NOT_CLEARED';
  // The read model renders the publisher id, so naming the source is itself a use (EA/E1 note on e9b77ce).
  if (o.rights.LINK_AND_SOURCE_NAME !== 'CLEAR_FOR_EXACT_USE') return 'RIGHTS_NOT_CLEARED';
  return null;
}

/**
 * EA P-5 — a "completed" access must be EVIDENCED by the per-source record, never just asserted:
 *   no source actually checked (empty, or only not-configured / not-attempted) ⇒ SEARCH_NOT_RUN
 *   any source failed or rate-limited                                         ⇒ PARTIAL
 * Non-completed access states pass through unchanged.
 */
export function effectiveAccess(ev: PoliticsEsEvaluationInput): PoliticsEsAccessState {
  if (!accessCompleted(ev.access)) return ev.access;
  const reasons = ev.perSource.map((p) => p.reason);
  if (!reasons.some((r) => r === 'checked' || r === 'rights-withheld')) return 'SEARCH_NOT_RUN';
  if (reasons.some((r) => r === 'failed' || r === 'rate-limited')) return 'PARTIAL';
  return ev.access;
}

/* ── 3. reporting chain (host is never an input to the decision) ──────────── */

export function reportingChainOf(o: PoliticsEsObservationInput): { chainId: string | null; basis: PoliticsEsChainBasis } {
  const c = o.chain;
  if (c.humanLinkedChainId) return { chainId: c.humanLinkedChainId, basis: 'HUMAN_LINKED' };
  if (c.declaredWireOrigin) return { chainId: `wire:${c.declaredWireOrigin.toLowerCase()}`, basis: 'DECLARED_WIRE_CREDIT' };
  if (c.declaredSyndicationOf) return { chainId: `wire:${c.declaredSyndicationOf.toLowerCase()}`, basis: 'DECLARED_SYNDICATION' };
  if (c.similarityClusterId) return { chainId: `cluster:${c.similarityClusterId}`, basis: 'TEXT_SIMILARITY_CLUSTER' };
  if (c.originSelf) return { chainId: `origin:${o.publisherId}`, basis: 'ORIGIN_SELF' };
  return { chainId: null, basis: 'NOT_ESTABLISHED' };
}

/* ── 3b. corroboration (independent evidence, not repetition) ─────────────── */

/**
 * CORROBORATED only when ALL hold:
 *   - every live item has an established chain (an unknown chain might be the same wire);
 *   - at least two INDEPENDENT units agree, where a unit is
 *       · one reporting chain of first-hand reporting (JOURNALIST or ANONYMOUS_SOURCES, not an interested party), or
 *       · at most ONE unit in total for non-interested official statements (the speaker is one source,
 *         however many outlets relay it);
 *     interested-party statements and relayed analyst/social/party claims count ZERO (EA P-3, EA R-06);
 *   - no two live claims carry DIFFERENT values in the same quantity unit (EA P-4): conflicting
 *     figures are two attributed statements, never a corroborated development.
 */
export function corroborationHolds(live: readonly PoliticsEsObservationInput[]): boolean {
  if (live.some((o) => reportingChainOf(o).chainId === null)) return false;
  const units = new Set<string>();
  for (const o of live) {
    if (o.claim.interestedParty) continue;
    const role = o.claim.speakerRole;
    if (role === 'JOURNALIST' || role === 'ANONYMOUS_SOURCES') units.add(`chain:${reportingChainOf(o).chainId}`);
    else if (role === 'OFFICIAL_BODY') units.add('official-statement');
  }
  if (units.size < 2) return false;
  const valuesByUnit = new Map<string, Set<number>>();
  for (const o of live) {
    const q = o.claim.quantity;
    if (!q) continue;
    const set = valuesByUnit.get(q.unit) ?? new Set<number>();
    set.add(q.value);
    valuesByUnit.set(q.unit, set);
  }
  return ![...valuesByUnit.values()].some((s) => s.size > 1);
}

/* ── 5. development grouping ─────────────────────────────────────────────── */

function eventPlaceOf(o: PoliticsEsObservationInput): string | null {
  const codes = [
    ...new Set(
      o.places
        .filter((p) => p.role === 'EVENT_PLACE' && p.basis !== 'NOT_ESTABLISHED' && p.iso3 && !p.bareCongo)
        .map((p) => p.iso3 as string),
    ),
  ];
  return codes.length === 1 ? codes[0] : null;
}

/** Same place AND overlapping event time AND same incident evidence; anything missing ⇒ not the same. */
export function sameDevelopment(a: PoliticsEsObservationInput, b: PoliticsEsObservationInput): boolean {
  const pa = eventPlaceOf(a);
  const pb = eventPlaceOf(b);
  if (!pa || !pb || pa !== pb) return false;
  const ta = a.claim.eventTime;
  const tb = b.claim.eventTime;
  if (ta.basis === 'NOT_ESTABLISHED' || tb.basis === 'NOT_ESTABLISHED' || !ta.from || !tb.from) return false;
  // EA P-2: compare instants, never strings (mixed UTC offsets order wrongly as text).
  const aFrom = instant(ta.from);
  const bFrom = instant(tb.from);
  const aTo = instant(ta.to ?? ta.from);
  const bTo = instant(tb.to ?? tb.from);
  if (aFrom === null || bFrom === null || aTo === null || bTo === null) return false;
  if (aFrom > bTo || bFrom > aTo) return false;
  return a.claim.incidentKey !== null && a.claim.incidentKey === b.claim.incidentKey;
}

/* ── 6. geography ────────────────────────────────────────────────────────── */

const PRECISION_RANK: Record<PoliticsEsPrecision, number> = { NOT_ESTABLISHED: 0, COUNTRY: 1, ADMIN1: 2, LOCALITY: 3, FACILITY: 4 };

export function regionOf(iso3: string | null): PoliticsEsRegion {
  if (!iso3) return 'NOT_ESTABLISHED';
  if (EAST_AFRICA_MEMBERS.includes(iso3)) return 'EAST_AFRICA';
  if (EU27_MEMBERS.includes(iso3)) return 'EU27';
  if (MIDDLE_EAST_MEMBERS.includes(iso3)) return 'MIDDLE_EAST';
  return 'OUTSIDE_DECLARED_SCOPE';
}

export function regionalReviewOf(region: PoliticsEsRegion): PoliticsEsRegionalReview {
  if (region === 'EAST_AFRICA') return 'EA_VALIDATOR_REVIEW_PENDING';
  if (region === 'EU27' || region === 'MIDDLE_EAST') return 'REVIEWER_UNBOUND';
  return 'NOT_APPLICABLE';
}

/**
 * Country from place evidence. OBSERVED_PRIMARY event places win; publisher-attributed event or
 * announcement places are kept as ATTRIBUTED (never upgraded to observed). Conflicting codes, a bare
 * "Congo", or only non-event roles (publisher, actor, office, client request) ⇒ NOT_ESTABLISHED.
 */
export function countryOf(obs: readonly PoliticsEsObservationInput[]): { iso3: string | null; precision: PoliticsEsPrecision; basis: PoliticsEsPlaceBasis } {
  const places = obs.flatMap((o) => o.places).filter((p) => p.iso3 && !p.bareCongo && p.basis !== 'NOT_ESTABLISHED');
  for (const basis of ['OBSERVED_PRIMARY', 'ATTRIBUTED_BY_PUBLISHER'] as const) {
    const roles = basis === 'OBSERVED_PRIMARY' ? ['EVENT_PLACE'] : ['EVENT_PLACE', 'ANNOUNCEMENT_PLACE'];
    const hits = places.filter((p) => p.basis === basis && roles.includes(p.role));
    const codes = [...new Set(hits.map((p) => p.iso3 as string))];
    if (codes.length > 1) return { iso3: null, precision: 'NOT_ESTABLISHED', basis: 'NOT_ESTABLISHED' };
    if (codes.length === 1) {
      const precision = hits.reduce<PoliticsEsPrecision>((best, p) => (PRECISION_RANK[p.precision] > PRECISION_RANK[best] ? p.precision : best), 'COUNTRY');
      return { iso3: codes[0], precision, basis };
    }
  }
  return { iso3: null, precision: 'NOT_ESTABLISHED', basis: 'NOT_ESTABLISHED' };
}

/* ── 8. impact (closed table; qualitative only) ──────────────────────────── */

interface PredicateRule {
  readonly kind: 'EFFECT' | 'RISK' | 'NO_CHANGE';
  readonly highImpact: boolean;
  readonly reviewIntervalHours: number;
  readonly hypotheses: readonly {
    domain: PoliticsEsImpactDomain;
    mechanism: string;
    competing: readonly string[];
    disconfirmers: readonly string[];
    nextCheck: string;
  }[];
}

export const PREDICATE_RULES: Readonly<Record<string, PredicateRule>> = {
  CASUALTIES_REPORTED: {
    kind: 'RISK', highImpact: true, reviewIntervalHours: 24,
    hypotheses: [
      { domain: 'PEOPLE', mechanism: 'VIOLENCE_EXPOSURE_OF_RESIDENTS', competing: ['ISOLATED_INCIDENT', 'DIFFERENT_INCIDENT_OR_DATE'], disconfirmers: ['OFFICIAL_OR_LOCAL_DENIAL_WITH_EVIDENCE', 'INCIDENT_PLACE_DIFFERENT'], nextCheck: 'LOCAL_OR_OFFICIAL_REPORT_NAMING_THE_PLACE' },
      { domain: 'HUMANITARIAN_ACCESS', mechanism: 'SECURITY_CONSTRAINT_ON_ACCESS', competing: ['ACCESS_UNCHANGED'], disconfirmers: ['HUMANITARIAN_ACCESS_NOTICE_UNCHANGED'], nextCheck: 'HUMANITARIAN_ACCESS_NOTICE_FOR_THE_AREA' },
    ],
  },
  ARMED_CLASH_REPORTED: {
    kind: 'RISK', highImpact: true, reviewIntervalHours: 24,
    hypotheses: [
      { domain: 'PEOPLE', mechanism: 'DISPLACEMENT_PRESSURE', competing: ['SHORT_LIVED_CLASH'], disconfirmers: ['NO_DISPLACEMENT_REPORTED_BY_HUMANITARIAN_BODY'], nextCheck: 'DISPLACEMENT_FIGURE_FROM_HUMANITARIAN_BODY' },
      { domain: 'TRANSPORT', mechanism: 'ROAD_OR_CROSSING_INSECURITY', competing: ['ROUTES_UNAFFECTED'], disconfirmers: ['OPERATOR_NOTICE_NORMAL_SERVICE'], nextCheck: 'BORDER_OR_ROUTE_OPERATOR_NOTICE' },
    ],
  },
  FACILITY_CLOSED: {
    kind: 'EFFECT', highImpact: false, reviewIntervalHours: 12,
    hypotheses: [
      { domain: 'TRANSPORT', mechanism: 'FACILITY_UNAVAILABLE', competing: ['PARTIAL_OR_BRIEF_CLOSURE'], disconfirmers: ['REOPENING_NOTICE'], nextCheck: 'OPERATOR_OR_AUTHORITY_REOPENING_NOTICE' },
      { domain: 'HUMANITARIAN_ACCESS', mechanism: 'RELIEF_ROUTE_INTERRUPTED', competing: ['ALTERNATIVE_ROUTE_IN_USE'], disconfirmers: ['LOGISTICS_CLUSTER_REPORTS_NORMAL_FLOW'], nextCheck: 'LOGISTICS_OR_HUMANITARIAN_NOTICE' },
    ],
  },
  ROUTE_DISRUPTED: {
    kind: 'EFFECT', highImpact: false, reviewIntervalHours: 12,
    hypotheses: [
      { domain: 'TRADE', mechanism: 'CARGO_DIVERSION_OR_DELAY', competing: ['CARRIERS_ABSORB_DELAY'], disconfirmers: ['SERVICE_RESUMPTION_NOTICE'], nextCheck: 'CARRIER_OR_PORT_NOTICE' },
      { domain: 'TRANSPORT', mechanism: 'PASSENGER_OR_FREIGHT_ROUTE_INTERRUPTED', competing: ['LOCALISED_DELAY'], disconfirmers: ['ROUTE_REOPENED_NOTICE'], nextCheck: 'OPERATOR_NOTICE' },
    ],
  },
  COALITION_ANNOUNCED: {
    kind: 'RISK', highImpact: false, reviewIntervalHours: 48,
    hypotheses: [
      { domain: 'PEOPLE', mechanism: 'POLITICAL_PROCESS_DISRUPTION', competing: ['TALKS_CONTINUE_UNCHANGED', 'ANNOUNCEMENT_WITHOUT_OPERATIONAL_CHANGE'], disconfirmers: ['MEDIATOR_CONFIRMS_PROCESS_CONTINUES', 'RETRACTION_OR_DENIAL_BY_NAMED_PARTIES'], nextCheck: 'MEDIATOR_OR_GOVERNMENT_STATEMENT_ON_TALKS' },
    ],
  },
  OUTBREAK_DECLARED: {
    kind: 'EFFECT', highImpact: false, reviewIntervalHours: 24,
    hypotheses: [
      { domain: 'SERVICES', mechanism: 'HEALTH_SERVICE_LOAD_AND_MOVEMENT_CONTROLS', competing: ['CONTAINED_CLUSTER'], disconfirmers: ['END_OF_OUTBREAK_DECLARATION'], nextCheck: 'MINISTRY_OR_WHO_SITUATION_UPDATE' },
      { domain: 'PEOPLE', mechanism: 'INFECTION_EXPOSURE_IN_AFFECTED_ZONE', competing: ['NO_FURTHER_CASES'], disconfirmers: ['ZERO_NEW_CASES_REPORTED_BY_AUTHORITY'], nextCheck: 'CASE_COUNT_UPDATE_FROM_AUTHORITY' },
    ],
  },
  OUTBREAK_ENDED: {
    kind: 'NO_CHANGE', highImpact: false, reviewIntervalHours: 168,
    hypotheses: [
      { domain: 'SERVICES', mechanism: 'CONTROLS_LIFTED', competing: ['RESURGENCE_RISK_STATED_BY_AUTHORITY'], disconfirmers: ['NEW_CASE_DECLARED'], nextCheck: 'AUTHORITY_SURVEILLANCE_UPDATE' },
    ],
  },
  CONNECTIVITY_DISRUPTED: {
    kind: 'EFFECT', highImpact: false, reviewIntervalHours: 6,
    hypotheses: [
      { domain: 'SERVICES', mechanism: 'COMMUNICATION_AND_PAYMENT_INTERRUPTION', competing: ['REGIONAL_OUTAGE_ONLY'], disconfirmers: ['RESTORATION_MEASURED_OR_ANNOUNCED'], nextCheck: 'RESTORATION_NOTICE_OR_MEASUREMENT' },
      { domain: 'JOBS', mechanism: 'DIGITAL_WORK_AND_TRADE_INTERRUPTED', competing: ['SHORT_INTERRUPTION'], disconfirmers: ['RESTORATION_NOTICE'], nextCheck: 'RESTORATION_NOTICE_OR_MEASUREMENT' },
    ],
  },
  CURFEW_DECLARED: {
    kind: 'EFFECT', highImpact: false, reviewIntervalHours: 12,
    hypotheses: [
      { domain: 'JOBS', mechanism: 'WORKING_HOURS_RESTRICTED', competing: ['EXEMPTIONS_FOR_ESSENTIAL_WORK'], disconfirmers: ['CURFEW_LIFTED_NOTICE'], nextCheck: 'AUTHORITY_CURFEW_NOTICE' },
      { domain: 'TRANSPORT', mechanism: 'MOVEMENT_RESTRICTED', competing: ['LIMITED_ENFORCEMENT'], disconfirmers: ['CURFEW_LIFTED_NOTICE'], nextCheck: 'AUTHORITY_CURFEW_NOTICE' },
    ],
  },
  POLICY_RATE_DECISION: {
    kind: 'EFFECT', highImpact: false, reviewIntervalHours: 168,
    hypotheses: [
      { domain: 'TRADE', mechanism: 'FINANCING_COST_CHANGE', competing: ['RATE_HELD_NO_TRANSMISSION'], disconfirmers: ['COMMERCIAL_LENDING_RATES_UNCHANGED'], nextCheck: 'NEXT_CENTRAL_BANK_PUBLICATION' },
    ],
  },
  PRICE_REVIEW_UNCHANGED: { kind: 'NO_CHANGE', highImpact: false, reviewIntervalHours: 720, hypotheses: [] },
  PROTEST_HELD: {
    kind: 'RISK', highImpact: false, reviewIntervalHours: 24,
    hypotheses: [
      { domain: 'SERVICES', mechanism: 'LOCAL_SERVICE_DISRUPTION', competing: ['PEACEFUL_ONE_DAY_EVENT'], disconfirmers: ['AUTHORITY_REPORTS_NORMAL_OPERATIONS'], nextCheck: 'AUTHORITY_OR_ORGANISER_STATEMENT' },
    ],
  },
  LEGISLATIVE_STAGE: { kind: 'RISK', highImpact: false, reviewIntervalHours: 168, hypotheses: [] },
};

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3600_000).toISOString();
}

export function impactOf(
  predicates: readonly string[],
  corroborated: boolean,
  lastEvaluatedAt: string | null,
): { evidenceClass: PoliticsEsEvidenceClass; hypotheses: PoliticsEsImpactHypothesis[] } {
  const rules = [...new Set(predicates)].map((p) => [p, PREDICATE_RULES[p]] as const).filter(([, r]) => r !== undefined);
  if (rules.length === 0) return { evidenceClass: 'INSUFFICIENT', hypotheses: [] };
  const anyEffect = rules.some(([, r]) => r.kind === 'EFFECT');
  const allNoChange = rules.every(([, r]) => r.kind === 'NO_CHANGE');
  const evidenceClass: PoliticsEsEvidenceClass = allNoChange
    ? 'NO_CHANGE_NOTICE'
    : anyEffect && corroborated
      ? 'OBSERVED_EFFECT'
      : 'SUGGESTS_RISK_ONLY';
  const hypotheses: PoliticsEsImpactHypothesis[] = [];
  for (const [predicate, rule] of rules)
    for (const h of rule.hypotheses)
      hypotheses.push({
        domain: h.domain,
        mechanismCode: h.mechanism,
        rationaleCode: `${predicate}:${rule.kind === 'EFFECT' && corroborated ? 'CORROBORATED_EFFECT' : rule.kind === 'NO_CHANGE' ? 'NO_CHANGE_NOTICE' : 'ATTRIBUTED_REPORT_ONLY'}`,
        horizon: rule.kind === 'EFFECT' && corroborated ? 'OBSERVED_NOW' : 'UNSPECIFIED',
        competingHypothesisCodes: [...h.competing],
        disconfirmerCodes: [...h.disconfirmers],
        nextCheck: {
          conditionCode: h.nextCheck,
          notBefore: lastEvaluatedAt ? addHours(lastEvaluatedAt, rule.reviewIntervalHours) : null,
          basis: lastEvaluatedAt ? 'RULE_INTERVAL_FROM_LAST_EVALUATION' : 'NOT_EVALUATED',
          scheduled: false,
        },
      });
  return { evidenceClass, hypotheses };
}

/* ── structural guard ────────────────────────────────────────────────────── */

export function forbiddenKeyPaths(value: unknown, path = '$'): string[] {
  if (value === null || typeof value !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if ((POLITICS_ES_FORBIDDEN_KEYS as readonly string[]).includes(k)) out.push(`${path}.${k}`);
    out.push(...forbiddenKeyPaths(v, `${path}.${k}`));
  }
  return out;
}

/* ── the engine ──────────────────────────────────────────────────────────── */

/** A timestamp or date as an instant (ms). Unparseable ⇒ null (treated as not established). */
export function instant(s: string): number | null {
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/**
 * The earliest of several timestamps, compared as INSTANTS (EA P-2). Returns the original string of
 * the earliest value so the producer's stated offset is preserved; unparseable values are ignored.
 */
export const minIso = (xs: readonly (string | null)[]): string | null => {
  let best: { s: string; t: number } | null = null;
  for (const s of xs) {
    if (typeof s !== 'string') continue;
    const t = instant(s);
    if (t === null) continue;
    if (best === null || t < best.t) best = { s, t };
  }
  return best ? best.s : null;
};

export function runPoliticsEarlySignal(input: PoliticsEsEngineInput): PoliticsEsReadModelV1 {
  const ev = input.evaluation;
  const access = effectiveAccess(ev);
  const completed = accessCompleted(access);
  const lastEvaluatedAt = completed ? ev.attemptedAt : ev.previousCompletedAt;
  const base = {
    contractVersion: POLITICS_ES_CONTRACT_VERSION,
    producedBy: 'POLITICS_OFFLINE_ENGINE' as const,
    evaluation: { lastEvaluatedAt, lastAttempt: { at: ev.attemptedAt, access }, perSource: ev.perSource },
  };

  // 1. Access: an evaluation that did not (evidently) complete yields no developments and names why.
  if (!completed) {
    return { ...base, dataOrigin: 'NONE', withheld: { count: 0, reasons: {} }, absence: { state: access, wordingCode: absenceWordingCode(access) }, developments: [] };
  }

  // 2. Admission.
  const reasons: Partial<Record<PoliticsEsWithholdReason, number>> = {};
  const admitted: PoliticsEsObservationInput[] = [];
  for (const o of input.observations) {
    const r = withholdReason(o);
    if (r) reasons[r] = (reasons[r] ?? 0) + 1;
    else admitted.push(o);
  }
  const withheldCount = input.observations.length - admitted.length;
  const dataOrigin: PoliticsEsReadModelV1['dataOrigin'] =
    admitted.length === 0 ? 'NONE' : admitted.every((o) => o.dataOrigin === 'SYNTHETIC_FIXTURE') ? 'SYNTHETIC_FIXTURE' : 'RETAINED_RIGHTS_CLEARED';
  if (admitted.length === 0) {
    const state: PoliticsEsAccessState = withheldCount > 0 ? 'RIGHTS_WITHHELD' : 'COMPLETED_NO_MATCH';
    return { ...base, dataOrigin, withheld: { count: withheldCount, reasons }, absence: { state, wordingCode: absenceWordingCode(state) }, developments: [] };
  }

  // 4. Revisions: an UPDATE/CORRECTED/RETRACTED observation supersedes the one it names.
  const supersededBy = new Map<string, PoliticsEsObservationInput>();
  for (const o of admitted) if (o.mutation.supersedesObservationId) supersededBy.set(o.mutation.supersedesObservationId, o);

  // 5. Development grouping over observations that carry claims (retractions group with their target).
  const groups: PoliticsEsObservationInput[][] = [];
  const byId = new Map(admitted.map((o) => [o.observationId, o]));
  const anchorOf = (o: PoliticsEsObservationInput): PoliticsEsObservationInput => {
    let cur = o;
    const seen = new Set<string>();
    while (cur.mutation.supersedesObservationId && byId.has(cur.mutation.supersedesObservationId) && !seen.has(cur.observationId)) {
      seen.add(cur.observationId);
      cur = byId.get(cur.mutation.supersedesObservationId) as PoliticsEsObservationInput;
    }
    return cur;
  };
  for (const o of [...admitted].sort((a, b) => a.observationId.localeCompare(b.observationId))) {
    const anchor = anchorOf(o);
    const g = groups.find((grp) => grp.some((m) => m === anchor || anchorOf(m) === anchor || sameDevelopment(m, anchor)));
    if (g) g.push(o);
    else groups.push([o]);
  }

  const disputes = (input.humanDisputes ?? []).filter((d) => d.derivedBy === 'HUMAN_REVIEW');

  const developments: PoliticsEsDevelopmentView[] = groups.map((members) => {
    const statusOf = (o: PoliticsEsObservationInput): PoliticsEsClaimView['status'] => {
      if (o.mutation.kind === 'RETRACTED') return 'RETRACTED';
      const next = supersededBy.get(o.observationId);
      if (!next) return 'CURRENT';
      if (next.mutation.kind === 'CORRECTED') return 'CORRECTED';
      if (next.mutation.kind === 'RETRACTED') return 'RETRACTED';
      return 'SUPERSEDED_BY_UPDATE';
    };
    const claims: PoliticsEsClaimView[] = members
      .map((o) => ({
        claimKey: o.claim.claimKey,
        predicate: o.claim.predicate,
        quantity: o.claim.quantity,
        attribution: { publisherId: o.publisherId, speakerRole: o.claim.speakerRole, interestedParty: o.claim.interestedParty },
        chainId: reportingChainOf(o).chainId,
        status: statusOf(o),
        supersededBy: supersededBy.get(o.observationId)?.observationId ?? null,
      }))
      .sort((a, b) => a.claimKey.localeCompare(b.claimKey));
    const live = members.filter((o) => statusOf(o) === 'CURRENT' && o.mutation.kind !== 'RETRACTED');
    const chains = [...new Set(live.map((o) => reportingChainOf(o).chainId).filter((c): c is string => c !== null))].sort();
    const unestablished = live.filter((o) => reportingChainOf(o).chainId === null).length;
    const memberClaimKeys = new Set(members.map((o) => o.claim.claimKey));
    const devDisputes = disputes.filter((d) => memberClaimKeys.has(d.claimKeyA) && memberClaimKeys.has(d.claimKeyB));
    // A human-recorded dispute inside the development also blocks corroboration.
    const corroborated = devDisputes.length === 0 && corroborationHolds(live);
    const retracted = live.length === 0;
    const corrected = members.some((o) => o.mutation.kind === 'CORRECTED');
    const country = countryOf(members);
    const region = regionOf(country.iso3);
    const anchor = [...members].sort((a, b) => a.observationId.localeCompare(b.observationId))[0];
    const developmentKey = anchor.claim.incidentKey ?? `obs:${anchor.observationId}`;
    const baselineChains = input.evaluation.baseline ? input.evaluation.baseline[developmentKey] : undefined;
    const change: PoliticsEsDevelopmentView['change'] =
      input.evaluation.baseline === null || baselineChains === undefined
        ? null
        : chains.some((c) => !baselineChains.includes(c))
          ? 'NEW_EVIDENCE'
          : 'NO_MATERIAL_CHANGE';
    const eventTimes = live.length ? live : members;
    const timed = eventTimes.filter((o) => o.claim.eventTime.basis === 'AS_REPORTED' && o.claim.eventTime.from);
    return {
      developmentKey,
      region,
      regionalReview: regionalReviewOf(region),
      country,
      statementStatus: corroborated ? 'CORROBORATED' : 'ATTRIBUTED',
      sourceChainCount: chains.length,
      sourceChains: chains,
      unestablishedChainItems: unestablished,
      change,
      corrected,
      retracted,
      disputed: devDisputes.map((d) => ({ claimKeys: [d.claimKeyA, d.claimKeyB] as [string, string], derivedBy: 'HUMAN_REVIEW' as const, reviewedAt: d.reviewedAt })),
      requiresHumanReview: members.some((o) => PREDICATE_RULES[o.claim.predicate]?.highImpact === true),
      claims,
      timeline: {
        // EA P-1: only a PUBLISHER-asserted time is a publication time; observed/UNPROVEN times are not.
        earliestPublishedAt: minIso(members.filter((o) => o.clocks.publishedAtBasis === 'publisher').map((o) => o.clocks.publishedAt)),
        earliestFirstSeenAt: minIso(members.map((o) => o.clocks.firstSeenAt)),
        eventTime: timed.length
          ? { from: minIso(timed.map((o) => o.claim.eventTime.from)), to: minIso(timed.map((o) => o.claim.eventTime.to ?? o.claim.eventTime.from)), basis: 'AS_REPORTED' }
          : { from: null, to: null, basis: 'NOT_ESTABLISHED' },
      },
      impact: retracted ? { evidenceClass: 'INSUFFICIENT', hypotheses: [] } : impactOf(live.map((o) => o.claim.predicate), corroborated, lastEvaluatedAt),
    };
  });

  developments.sort((a, b) => a.developmentKey.localeCompare(b.developmentKey));
  const model: PoliticsEsReadModelV1 = { ...base, dataOrigin, withheld: { count: withheldCount, reasons }, absence: null, developments };
  const bad = forbiddenKeyPaths(model);
  if (bad.length) throw new Error(`Politics early-signal: forbidden keys in read model: ${bad.join(', ')}`);
  return model;
}
