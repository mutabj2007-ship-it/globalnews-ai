/**
 * ER1 T2 — PURE derivations exercised by the offline harness. No I/O, no clock, no network, no imports
 * from application code. Each function encodes one ruling so a fixture can prove or refute it:
 *
 *   reporting chain      CTO R17 §2C, E1 S-6, EA R-05   one wire origin = one chain; unknown ≠ independent
 *   story material change CTO R17 §2C                   a syndicated copy on a new host is not new evidence
 *   alert truth           CTO R17 §2D, H D-1/D-2        no "no change" without a completed evaluation
 *   evaluation change     E1 §6                          only NEW_EVIDENCE / NO_MATERIAL_CHANGE, else null
 *   claim arithmetic      EA R-04                        units never summed; no ranges
 *   event merge           EA §2.3                        same place + date + incident, or separate
 *   coverage association  CTO R17 §2A                    one publisher, many country roles
 *   replay                EA R-09/R-10, G §4             leakage guard; late ≠ absent ≠ rights ≠ outage
 */
import {
  type AccessState,
  type AlertTruthState,
  type CasualtyUnit,
  type ChainBasis,
  type ClaimRelationKind,
  type CoverageDeficit,
  type DerivableChangeState,
  FORBIDDEN_KEYS,
  type UseVerdict,
} from '../contract/early-signal.contract';

/* ── reporting chain ─────────────────────────────────────────────────────── */

export interface ChainEvidence {
  readonly itemId: string;
  readonly host: string;
  /** Wire/agency named as origin by the item itself, e.g. "(Reuters)". */
  readonly declaredWireOrigin: string | null;
  /** Publisher-declared syndication of another item's origin. */
  readonly declaredSyndicationOf: string | null;
  /** Cluster id from a text-similarity rule, if one matched. */
  readonly similarityClusterId: string | null;
  /** A human reviewer's explicit link. */
  readonly humanLinkedChainId: string | null;
  /** The item is its own original reporting (first-party). */
  readonly originSelf: boolean;
}

export interface ChainAssignment {
  readonly itemId: string;
  readonly chainId: string | null;
  readonly basis: ChainBasis;
}

/** Host is deliberately NOT an input to the decision; it is carried only for audit. */
export function assignReportingChain(e: ChainEvidence): ChainAssignment {
  if (e.humanLinkedChainId) return { itemId: e.itemId, chainId: e.humanLinkedChainId, basis: 'HUMAN_LINKED' };
  if (e.declaredWireOrigin) return { itemId: e.itemId, chainId: `wire:${e.declaredWireOrigin.toLowerCase()}`, basis: 'DECLARED_WIRE_CREDIT' };
  if (e.declaredSyndicationOf) return { itemId: e.itemId, chainId: `wire:${e.declaredSyndicationOf.toLowerCase()}`, basis: 'DECLARED_SYNDICATION' };
  if (e.similarityClusterId) return { itemId: e.itemId, chainId: `cluster:${e.similarityClusterId}`, basis: 'TEXT_SIMILARITY_CLUSTER' };
  if (e.originSelf) return { itemId: e.itemId, chainId: `origin:${e.itemId}`, basis: 'ORIGIN_SELF' };
  return { itemId: e.itemId, chainId: null, basis: 'NOT_ESTABLISHED' };
}

export type CorroborationOutcome =
  | { readonly state: 'CORROBORATED'; readonly independentChains: readonly string[] }
  | { readonly state: 'INSUFFICIENT_INDEPENDENT_REPORTS'; readonly independentChains: readonly string[] }
  | { readonly state: 'CHAIN_NOT_ESTABLISHED'; readonly independentChains: readonly string[]; readonly unestablished: readonly string[] };

/**
 * Corroboration over established chains only. Any item whose chain is NOT ESTABLISHED blocks a
 * CORROBORATED result rather than being counted (fail closed: it might be the same wire).
 */
export function corroborate(assignments: readonly ChainAssignment[], minIndependent = 2): CorroborationOutcome {
  const chains = [...new Set(assignments.map((a) => a.chainId).filter((c): c is string => c !== null))].sort();
  const unestablished = assignments.filter((a) => a.chainId === null).map((a) => a.itemId);
  if (chains.length >= minIndependent && unestablished.length === 0) return { state: 'CORROBORATED', independentChains: chains };
  if (unestablished.length > 0 && chains.length + unestablished.length >= minIndependent)
    return { state: 'CHAIN_NOT_ESTABLISHED', independentChains: chains, unestablished };
  return { state: 'INSUFFICIENT_INDEPENDENT_REPORTS', independentChains: chains };
}

/**
 * Does an incoming item bring new evidence to a story? Decided on chain identity, never on host.
 * (Contrast: live `bringsNewEvidence` in stories/story-identity.rules.ts decides on host.)
 */
export function bringsNewChainEvidence(presentChains: readonly (string | null)[], incoming: ChainAssignment): boolean | 'NOT_ESTABLISHED' {
  if (incoming.chainId === null) return 'NOT_ESTABLISHED';
  return !presentChains.includes(incoming.chainId);
}

/** Live rule, reproduced verbatim from stories/story-identity.rules.ts:37-40 at 059cdb7, for arm A. */
export function liveBringsNewEvidence(presentHosts: readonly string[], incomingHosts: readonly string[]): boolean {
  const present = new Set(presentHosts.filter((h) => h.length > 0));
  return incomingHosts.some((h) => h.length > 0 && !present.has(h));
}

/* ── alert truth and evaluation ──────────────────────────────────────────── */

const COMPLETED: readonly AccessState[] = ['COMPLETED_MATCH', 'COMPLETED_NO_MATCH'];

export function isCompleted(access: AccessState): boolean {
  return COMPLETED.includes(access);
}

export interface AlertTruthInput {
  readonly retained: boolean;
  readonly briefVersion: number;
  readonly createdBriefVersion: number;
  readonly lastEvaluatedAt: string | null;
  readonly lastEvaluationAccess: AccessState | null;
}

/** The truthful projection proposed for Story Alerts. A version rise alone is not an examined absence. */
export function alertTruth(i: AlertTruthInput): AlertTruthState {
  if (!i.retained) return 'NO_RETAINED_EVIDENCE';
  if (i.briefVersion > i.createdBriefVersion) return 'CHANGED';
  if (i.lastEvaluatedAt === null || i.lastEvaluationAccess === null || !isCompleted(i.lastEvaluationAccess)) return 'NOT_ASSESSED';
  return 'NO_CHANGE_YET';
}

/** Live behaviour, reproduced verbatim from stories/alerts.service.ts:46-48 at 059cdb7, for arm A. */
export function liveChangeStateOf(i: { retained: boolean; briefVersion: number; createdBriefVersion: number }): 'NO_RETAINED_EVIDENCE' | 'CHANGED' | 'NO_CHANGE_YET' {
  if (!i.retained) return 'NO_RETAINED_EVIDENCE';
  return i.briefVersion > i.createdBriefVersion ? 'CHANGED' : 'NO_CHANGE_YET';
}

export function evaluationChange(access: AccessState, newEvidenceCount: number, hasBaseline: boolean): DerivableChangeState | null {
  if (!isCompleted(access) || !hasBaseline) return null;
  return newEvidenceCount > 0 ? 'NEW_EVIDENCE' : 'NO_MATERIAL_CHANGE';
}

/** Reader wording code per access state. No code ever means "nothing happened". */
export function absenceWordingCode(access: AccessState): string {
  switch (access) {
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
    case 'ACCESS_LIMITED':
      return 'ACCESS_TO_AREA_LIMITED';
  }
}

/* ── rights ──────────────────────────────────────────────────────────────── */

export function usePermitted(verdict: UseVerdict | undefined): boolean {
  return verdict === 'CLEAR_FOR_EXACT_USE';
}

/* ── claims and events ───────────────────────────────────────────────────── */

export interface Quantity {
  readonly value: number;
  readonly unit: CasualtyUnit;
  readonly sourceChainId: string;
  readonly eventId: string;
}

/** Quantities never combine across chains, events or units (EA R-04). Successive tolls are updates. */
export function combineQuantities(a: Quantity, b: Quantity): { readonly combined: false; readonly reason: string } {
  if (a.unit !== b.unit) return { combined: false, reason: 'UNITS_DIFFER' };
  if (a.eventId !== b.eventId) return { combined: false, reason: 'DIFFERENT_EVENTS' };
  if (a.sourceChainId !== b.sourceChainId) return { combined: false, reason: 'DIFFERENT_CHAINS_NOT_SUMMED' };
  return { combined: false, reason: 'SUCCESSIVE_TOLL_IS_UPDATE' };
}

export interface EventEvidence {
  readonly placeIso3: string | null;
  readonly locality: string | null;
  readonly dateFrom: string | null;
  readonly dateTo: string | null;
  readonly incidentKey: string | null;
}

/** Two reports merge into one event ONLY with same place, overlapping date AND same incident evidence. */
export function sameEvent(a: EventEvidence, b: EventEvidence): boolean {
  if (!a.placeIso3 || !b.placeIso3 || a.placeIso3 !== b.placeIso3) return false;
  if (!a.dateFrom || !b.dateFrom) return false;
  const aTo = a.dateTo ?? a.dateFrom;
  const bTo = b.dateTo ?? b.dateFrom;
  if (a.dateFrom > bTo || b.dateFrom > aTo) return false;
  return a.incidentKey !== null && a.incidentKey === b.incidentKey;
}

/** DISPUTES is a human-review relation until an Analysis-lane detector exists (E1 P-4). */
export function relationAllowed(rel: { readonly kind: ClaimRelationKind; readonly derivedBy: 'RULE' | 'HUMAN_REVIEW' }): boolean {
  return !(rel.kind === 'DISPUTES' && rel.derivedBy === 'RULE');
}

/** A screenshot or a repost is never the origin of a claim (E1 A-4). */
export function canBeClaimOrigin(artefactKind: 'PUBLISHED_ITEM' | 'OFFICIAL_RECORD' | 'SOCIAL_POST_ORIGINAL' | 'SCREENSHOT' | 'REPOST'): boolean {
  return artefactKind !== 'SCREENSHOT' && artefactKind !== 'REPOST';
}

/* ── geography ───────────────────────────────────────────────────────────── */

export interface RegionMembers {
  readonly EAST_AFRICA: readonly string[];
  readonly MIDDLE_EAST: readonly string[];
  readonly EU27: readonly string[];
}

export function benchmarkRegionOf(iso3: string | null, regions: RegionMembers): keyof RegionMembers | null {
  if (!iso3) return null;
  for (const key of ['EAST_AFRICA', 'MIDDLE_EAST', 'EU27'] as const) if (regions[key].includes(iso3)) return key;
  return null;
}

/** Resolve an event country from place evidence. Bare "Congo" decides nothing (EA R-03, CTO D5). */
export function eventCountryFromEvidence(
  places: readonly { readonly iso3: string | null; readonly role: string; readonly basis: string; readonly bareCongo?: boolean }[],
): string | null {
  const evidential = places.filter((p) => p.role === 'EVENT_PLACE' && p.basis === 'OBSERVED_PRIMARY' && p.iso3 && !p.bareCongo);
  const codes = [...new Set(evidential.map((p) => p.iso3 as string))];
  return codes.length === 1 ? codes[0] : null;
}

/* ── coverage association (CTO R17 §2A) ──────────────────────────────────── */

export interface RegisterRow {
  readonly sourceId: string;
  readonly iso3: string;
  readonly host: string;
  readonly duplicateOf: string | null;
  readonly technicalStatus: string;
  readonly checkedAt: string | null;
  readonly isDirectoryListing: boolean;
}

export interface CoverageAssociation {
  readonly publishers: readonly { readonly publisherKey: string; readonly registryIds: readonly string[]; readonly hosts: readonly string[]; readonly countries: readonly string[] }[];
  readonly deficits: readonly { readonly sourceId: string; readonly deficit: CoverageDeficit }[];
  /** Independence units = publishers, never registry rows or countries. */
  readonly independenceUnits: number;
}

/**
 * Group rows into publishers: an explicit `duplicateOf` joins the target's publisher; a shared host
 * joins the publisher already holding that host. Restoring the eight refused rows as eight independent
 * sources is therefore impossible by construction.
 */
export function associateCoverage(rows: readonly RegisterRow[]): CoverageAssociation {
  const byId = new Map(rows.map((r) => [r.sourceId, r]));
  const rootOf = (id: string): string => {
    let cur = id;
    const seen = new Set<string>();
    while (byId.get(cur)?.duplicateOf && !seen.has(cur)) {
      seen.add(cur);
      cur = byId.get(cur)!.duplicateOf as string;
    }
    return cur;
  };
  const publisherOfHost = new Map<string, string>();
  const groups = new Map<string, { registryIds: Set<string>; hosts: Set<string>; countries: Set<string> }>();
  const deficits: { sourceId: string; deficit: CoverageDeficit }[] = [];
  for (const r of [...rows].sort((a, b) => a.sourceId.localeCompare(b.sourceId))) {
    let key = rootOf(r.sourceId);
    const hostOwner = publisherOfHost.get(r.host);
    if (key === r.sourceId && hostOwner && hostOwner !== key) key = hostOwner;
    if (r.duplicateOf) {
      deficits.push({ sourceId: r.sourceId, deficit: 'EXPLICIT_ALIAS_COLLAPSED' });
      const target = byId.get(rootOf(r.sourceId));
      if (r.technicalStatus === 'VERIFIED_FEED_ENDPOINT' && target && target.technicalStatus !== 'VERIFIED_FEED_ENDPOINT')
        deficits.push({ sourceId: r.sourceId, deficit: 'ALIAS_EVIDENCE_LOST' });
    }
    if (r.isDirectoryListing) deficits.push({ sourceId: r.sourceId, deficit: 'DIRECTORY_LISTING_NOT_OWN_CHANNEL' });
    if (!publisherOfHost.has(r.host)) publisherOfHost.set(r.host, key);
    const g = groups.get(key) ?? { registryIds: new Set<string>(), hosts: new Set<string>(), countries: new Set<string>() };
    g.registryIds.add(r.sourceId);
    g.hosts.add(r.host);
    g.countries.add(r.iso3);
    groups.set(key, g);
  }
  /* A publisher whose non-alias rows span several countries on one host is a shared-host deficit,
     flagged on every such row (neither row "wins"). */
  for (const g of groups.values()) {
    const primaries = [...g.registryIds].filter((id) => !byId.get(id)?.duplicateOf);
    const countries = new Set(primaries.map((id) => byId.get(id)?.iso3));
    if (primaries.length > 1 && countries.size > 1)
      for (const id of primaries.sort()) deficits.push({ sourceId: id, deficit: 'SHARED_HOST_MULTI_COUNTRY' });
  }
  deficits.sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.deficit.localeCompare(b.deficit));
  const publishers = [...groups.entries()]
    .map(([publisherKey, g]) => ({
      publisherKey,
      registryIds: [...g.registryIds].sort(),
      hosts: [...g.hosts].sort(),
      countries: [...g.countries].sort(),
    }))
    .sort((a, b) => a.publisherKey.localeCompare(b.publisherKey));
  return { publishers, deficits, independenceUnits: publishers.length };
}

/* ── replay ──────────────────────────────────────────────────────────────── */

export function leakageViolations(termsUsedBeforeCutoff: readonly string[], leakGuard: readonly string[]): string[] {
  const used = termsUsedBeforeCutoff.map((t) => t.toLowerCase());
  return leakGuard.filter((g) => used.some((u) => u.includes(g.toLowerCase())));
}

export type ReplayOutcome =
  | 'SEEN_EARLY'
  | 'SEEN_LATE'
  | 'NEVER_SEEN'
  | 'ABSENT_EVERYWHERE'
  | 'RIGHTS_DENIED'
  | 'PROVIDER_OUTAGE'
  | 'LANGUAGE_UNREACHABLE'
  | 'UNKNOWN_NO_LOGS';

export interface ReplayClocks {
  readonly sourcePublishedAt: string | null;
  readonly firstEligibleFetchAt: string | null;
  readonly admittedAt: string | null;
  readonly qualifiedAt: string | null;
  readonly mainstreamFirstAt: string | null;
  readonly rightsAtTime: 'CLEAR' | 'HOLD' | null;
  readonly providerAvailableAtTime: boolean | null;
  readonly languageReachable: boolean | null;
  readonly systemLogsExist: boolean;
}

/** Order matters: rights, outage and language are causes, not lateness. No logs ⇒ UNKNOWN (EA R-10). */
export function classifyReplay(c: ReplayClocks): ReplayOutcome {
  if (!c.systemLogsExist) return 'UNKNOWN_NO_LOGS';
  if (c.rightsAtTime === 'HOLD') return 'RIGHTS_DENIED';
  if (c.providerAvailableAtTime === false) return 'PROVIDER_OUTAGE';
  if (c.languageReachable === false) return 'LANGUAGE_UNREACHABLE';
  if (!c.firstEligibleFetchAt) return c.mainstreamFirstAt ? 'NEVER_SEEN' : 'ABSENT_EVERYWHERE';
  if (!c.mainstreamFirstAt) return 'SEEN_EARLY';
  return c.firstEligibleFetchAt < c.mainstreamFirstAt ? 'SEEN_EARLY' : 'SEEN_LATE';
}

/** A "first discovered" claim must be backed by a logged first-product-observed time. */
export function firstDiscoveryClaimSupported(claimedAt: string, loggedFirstObservedAt: string | null): boolean {
  return loggedFirstObservedAt !== null && loggedFirstObservedAt <= claimedAt;
}

/* ── structural guards ───────────────────────────────────────────────────── */

export function forbiddenKeyPaths(value: unknown, path = '$'): string[] {
  if (value === null || typeof value !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if ((FORBIDDEN_KEYS as readonly string[]).includes(k)) out.push(`${path}.${k}`);
    out.push(...forbiddenKeyPaths(v, `${path}.${k}`));
  }
  return out;
}
