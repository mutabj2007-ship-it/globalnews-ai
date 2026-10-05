import { COUNTRIES } from './countries';
import type { SourceType } from './source-type';
import type { OfficialSourceRightsBinding } from './rights/source-rights';

export type CoverageState = 'VALIDATED_LOCAL_BASELINE' | 'PARTIAL' | 'COVERAGE_GAP' | 'UNVERIFIED';
export interface GovernedSourceRegion {
  readonly id: string;
  readonly members: readonly string[];
  readonly provenanceNote: string;
}
export interface SourceHealth {
  readonly status: 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'FAILED';
  readonly lastAttemptAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly consecutiveFailures: number;
  readonly failureReason: string | null;
}
/** Publisher identity is independent of the provider that transports its records. */
export interface SourcePackEntry {
  readonly sourceId: string;
  readonly publisherName: string;
  readonly iso2: string;
  readonly iso3: string;
  readonly governedRegion: string;
  readonly canonicalHost: string;
  readonly transport: 'RSS' | 'ATOM' | 'API' | 'MANUAL' | 'NONE';
  readonly endpoint: string | null;
  readonly sourceClass: SourceType;
  readonly languages: readonly string[];
  readonly basis: 'LOCAL' | 'INTERNATIONAL';
  readonly rights: {
    readonly standing: 'PERMITTED' | 'RESTRICTED' | 'UNKNOWN';
    readonly binding: OfficialSourceRightsBinding | null;
    readonly usageNote: string;
  };
  readonly verifiedAt: string | null;
  readonly captureCapability: 'FULL_TEXT' | 'METADATA_ONLY' | 'NONE' | 'UNKNOWN';
  readonly activationStatus: 'ACTIVE' | 'DISABLED' | 'BLOCKED';
  readonly failureReason: string | null;
  readonly provenanceNote: string;
  readonly health: SourceHealth;
}
export interface CountrySourcePack {
  readonly schemaVersion: 1;
  readonly iso2: string;
  readonly iso3: string;
  readonly governedRegion: string;
  readonly verifiedAt: string | null;
  readonly gapReason: string | null;
  readonly provenanceNote: string;
  readonly entries: readonly SourcePackEntry[];
}

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`Invalid source pack: ${message}`);
}
function object(value: unknown): Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), 'expected object');
  return value as Record<string, unknown>;
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function nullableText(value: unknown): boolean {
  return value === null || text(value);
}
function date(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}(T.*Z)?$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value.slice(0, 10))
  );
}
function oneOf(value: unknown, values: readonly string[]): boolean {
  return typeof value === 'string' && values.includes(value);
}
export function canonicalPublisherHost(host: string): string {
  return host
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.$/, '');
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function stableIdentity(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableIdentity).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableIdentity(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
/** Load JSON or parsed manifests atomically. No filesystem, DNS, HTTP or provider access. */
export function loadSourcePacks(
  input: unknown,
  regions: readonly GovernedSourceRegion[],
): readonly CountrySourcePack[] {
  const regionMap = new Map<string, GovernedSourceRegion>();
  for (const region of regions) {
    assert(
      text(region.id) && text(region.provenanceNote) && !regionMap.has(region.id),
      'duplicate/invalid governed region',
    );
    assert(
      region.members.length > 0 && new Set(region.members).size === region.members.length,
      'empty/duplicate membership',
    );
    assert(
      region.members.every((iso3) => COUNTRIES.some((c) => c.iso3 === iso3)),
      'noncanonical governed country',
    );
    regionMap.set(region.id, region);
  }
  const parsed: unknown = typeof input === 'string' ? JSON.parse(input) : input;
  assert(Array.isArray(parsed), 'expected manifest array');
  const packs = new Set<string>();
  const identities = new Map<string, string>();
  const publishers = new Map<string, string>();
  const names = new Map<string, string>();
  for (const raw of parsed) {
    const pack = object(raw);
    const country = COUNTRIES.find((c) => c.iso2 === pack.iso2 && c.iso3 === pack.iso3);
    assert(
      country &&
        typeof pack.governedRegion === 'string' &&
        regionMap.get(pack.governedRegion)?.members.includes(country.iso3),
      'country/region mismatch',
    );
    const key = `${pack.governedRegion}:${pack.iso3}`;
    assert(!packs.has(key), `duplicate country pack ${key}`);
    packs.add(key);
    assert(
      pack.schemaVersion === 1 &&
        date(pack.verifiedAt) &&
        nullableText(pack.gapReason) &&
        text(pack.provenanceNote),
      'pack metadata',
    );
    assert(Array.isArray(pack.entries), 'entries');
    const localIds = new Set<string>();
    for (const rawEntry of pack.entries) {
      const e = object(rawEntry);
      assert(
        e.iso2 === pack.iso2 && e.iso3 === pack.iso3 && e.governedRegion === pack.governedRegion,
        'entry country/region mismatch',
      );
      assert(
        text(e.sourceId) && /^[a-z0-9][a-z0-9:._-]+$/.test(e.sourceId) && text(e.publisherName),
        'publisher identity',
      );
      assert(!localIds.has(e.sourceId), 'duplicate source ID');
      localIds.add(e.sourceId);
      assert(
        text(e.canonicalHost) &&
          /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(e.canonicalHost) &&
          !e.canonicalHost.includes('..'),
        'canonical host',
      );
      const host = canonicalPublisherHost(e.canonicalHost);
      const name = e.publisherName
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '');
      assert(
        !publishers.has(host) || publishers.get(host) === e.sourceId,
        `duplicate publisher host ${host}`,
      );
      assert(
        !names.has(name) || names.get(name) === e.sourceId,
        `duplicate publisher name ${e.publisherName}`,
      );
      // A source can be referenced across overlapping governed regions, never redefined.
      const identity = stableIdentity({ ...e, governedRegion: undefined });
      assert(
        !identities.has(e.sourceId) || identities.get(e.sourceId) === identity,
        'conflicting source identity',
      );
      identities.set(e.sourceId, identity);
      publishers.set(host, e.sourceId);
      names.set(name, e.sourceId);
      assert(oneOf(e.transport, ['RSS', 'ATOM', 'API', 'MANUAL', 'NONE']), 'transport');
      if (['RSS', 'ATOM', 'API'].includes(e.transport as string)) {
        assert(text(e.endpoint), 'endpoint required');
        const url = new URL(e.endpoint);
        assert(
          url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            !url.hash &&
            (!url.port || url.port === '443'),
          'HTTPS endpoint required',
        );
        assert(
          canonicalPublisherHost(url.hostname) === host || url.hostname.endsWith(`.${host}`),
          'endpoint outside canonical publisher',
        );
      } else assert(e.endpoint === null, 'non-network transport endpoint');
      assert(
        oneOf(e.sourceClass, ['NEWS_PROVIDER', 'OFFICIAL_SOURCE', 'PUBLIC_DATA']),
        'source class',
      );
      assert(
        Array.isArray(e.languages) &&
          e.languages.every(
            (l) => typeof l === 'string' && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(l),
          ) &&
          new Set(e.languages).size === e.languages.length,
        'language tags',
      );
      assert(oneOf(e.basis, ['LOCAL', 'INTERNATIONAL']), 'basis');
      const rights = object(e.rights);
      assert(
        oneOf(rights.standing, ['PERMITTED', 'RESTRICTED', 'UNKNOWN']) && text(rights.usageNote),
        'rights standing',
      );
      if (rights.binding !== null) {
        const binding = object(rights.binding);
        assert(text(binding.rightsAuthorityId) && text(binding.rightsRecordKey), 'rights binding');
      }
      assert(
        rights.standing !== 'PERMITTED' || rights.binding !== null,
        'permitted rights need binding',
      );
      assert(
        date(e.verifiedAt) &&
          oneOf(e.captureCapability, ['FULL_TEXT', 'METADATA_ONLY', 'NONE', 'UNKNOWN']),
        'verification/capture',
      );
      assert(
        oneOf(e.activationStatus, ['ACTIVE', 'DISABLED', 'BLOCKED']) &&
          nullableText(e.failureReason) &&
          text(e.provenanceNote),
        'activation/provenance',
      );
      assert(
        e.activationStatus !== 'BLOCKED' || text(e.failureReason),
        'blocked source needs reason',
      );
      const health = object(e.health);
      assert(
        oneOf(health.status, ['UNKNOWN', 'HEALTHY', 'DEGRADED', 'FAILED']) &&
          date(health.lastAttemptAt) &&
          date(health.lastSuccessAt) &&
          Number.isInteger(health.consecutiveFailures) &&
          (health.consecutiveFailures as number) >= 0 &&
          nullableText(health.failureReason),
        'source health',
      );
      assert(
        !['DEGRADED', 'FAILED'].includes(health.status as string) || text(health.failureReason),
        'health failure needs reason',
      );
      assert(
        health.status !== 'HEALTHY' || health.lastSuccessAt !== null,
        'healthy source needs observed success',
      );
      assert(
        health.status !== 'HEALTHY' ||
          (health.consecutiveFailures === 0 && health.failureReason === null),
        'healthy source cannot carry failures',
      );
    }
  }
  return freeze(JSON.parse(JSON.stringify(parsed)) as CountrySourcePack[]);
}

export function measuredLocalSource(e: SourcePackEntry): boolean {
  return (
    e.basis === 'LOCAL' &&
    e.verifiedAt !== null &&
    e.rights.standing === 'PERMITTED' &&
    e.rights.binding !== null &&
    ['FULL_TEXT', 'METADATA_ONLY'].includes(e.captureCapability) &&
    e.languages.length > 0 &&
    e.activationStatus !== 'BLOCKED' &&
    e.failureReason === null &&
    e.health.status === 'HEALTHY'
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * T1 COVERAGE TRUTHFULNESS — THE ONE CANONICAL SOURCE-COVERAGE STATE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `CoverageState` above answers a RESEARCH question: how far has the local
 * baseline for a governed member been validated? It deliberately ignores
 * activation (a validated-but-disabled source is still a validated baseline).
 *
 * `CanonicalCoverageState` answers the READER question: is there a qualified
 * LOCAL source that is both ACTIVE and RIGHTS-CLEARED for this country and
 * domain right now? It is the single coverage authority every surface reads
 * (admin accounting, the country-news response, analysis retrievalContext,
 * the machine-readable coverage check). It is computed here, from registry
 * records only — never from a provider call, never from a source name.
 *
 *   COVERED_LOCAL  ≥1 local source in the domain is ACTIVE, rights CLEARED
 *                  (a resolved, permitting binding) and measured (verified,
 *                  healthy, capture-capable).
 *   UNVERIFIED     a local source is ACTIVE and rights CLEARED, but the
 *                  registry holds no measurement saying it delivers. This is
 *                  the only case where the registry truly cannot say.
 *   COVERAGE_GAP   everything else — including "listed but disabled",
 *                  "active but rights unresolved", and "nothing listed".
 *
 * Rights are never upgraded: when two registries describe one publisher, the
 * more restrictive rights state wins.
 */
export type SourceCoverageDomain = 'NEWS_REPORTING' | 'OFFICIAL_PUBLIC_DATA';
export const SOURCE_COVERAGE_DOMAINS: readonly SourceCoverageDomain[] = Object.freeze([
  'NEWS_REPORTING',
  'OFFICIAL_PUBLIC_DATA',
] as const);
export type CanonicalCoverageState = 'COVERED_LOCAL' | 'COVERAGE_GAP' | 'UNVERIFIED';
export const CANONICAL_COVERAGE_STATES: readonly CanonicalCoverageState[] = Object.freeze([
  'COVERED_LOCAL',
  'UNVERIFIED',
  'COVERAGE_GAP',
] as const);

/**
 * Recorded rights state of a source candidate. `CLEARED` is the only state that
 * permits counting a source toward local coverage; `RESTRICTED`/`PROHIBITED`
 * additionally forbid activation by configuration. `RIGHTS_UNDER_E1_REVIEW` is
 * the explicit state of an international aggregator whose commercial terms are
 * an open review item (it is NOT acceptance).
 */
export type SourceRightsState =
  | 'CLEARED'
  | 'RESTRICTED'
  | 'PROHIBITED'
  | 'UNRESOLVED'
  | 'LIMITED_SCOPE_REVIEW'
  | 'UNREVIEWED'
  | 'RIGHTS_UNDER_E1_REVIEW';

const RIGHTS_SEVERITY: Readonly<Record<SourceRightsState, number>> = {
  CLEARED: 0,
  UNREVIEWED: 1,
  RIGHTS_UNDER_E1_REVIEW: 2,
  UNRESOLVED: 3,
  LIMITED_SCOPE_REVIEW: 4,
  RESTRICTED: 5,
  PROHIBITED: 6,
};

/** True when recorded rights forbid activating the source by configuration. */
export function rightsBlockActivation(state: SourceRightsState): boolean {
  return state === 'RESTRICTED' || state === 'PROHIBITED';
}

/** The more restrictive of two recorded rights states. Never upgrades. */
export function stricterRightsState(a: SourceRightsState, b: SourceRightsState): SourceRightsState {
  return RIGHTS_SEVERITY[a] >= RIGHTS_SEVERITY[b] ? a : b;
}

/** Domain is derived from the pack's existing `sourceClass`; nothing new is declared. */
export function coverageDomainOf(sourceClass: SourceType): SourceCoverageDomain {
  return sourceClass === 'NEWS_PROVIDER' ? 'NEWS_REPORTING' : 'OFFICIAL_PUBLIC_DATA';
}

/**
 * The recorded rights state of a canonical pack entry. `PERMITTED` with a
 * binding is the only route to `CLEARED`. Otherwise the original research
 * status the normalizer preserved in `usageNote` is read back verbatim; an
 * unrecognised or absent status stays `UNRESOLVED` (never invented upward).
 */
export function packEntryRightsState(e: SourcePackEntry): SourceRightsState {
  if (e.rights.standing === 'PERMITTED' && e.rights.binding !== null) return 'CLEARED';
  if (e.rights.standing === 'RESTRICTED') return 'RESTRICTED';
  const original = /original rights status ([A-Z_]+)/.exec(e.rights.usageNote)?.[1];
  switch (original) {
    case 'LIMITED_SCOPE_REVIEW':
      return 'LIMITED_SCOPE_REVIEW';
    case 'UNREVIEWED':
    case 'NOT_REVIEWED':
      return 'UNREVIEWED';
    /* "Restriction OR notice observed" is ambiguous by its own wording; the canonical
       normalizer keeps its standing UNKNOWN (not RESTRICTED), so it stays unresolved here:
       never cleared, but not a recorded restriction either. */
    case 'RESTRICTION_OR_NOTICE_OBSERVED':
    case 'UNRESOLVED':
      return 'UNRESOLVED';
    case 'RESTRICTED':
    case 'RESTRICTION_OBSERVED':
      return 'RESTRICTED';
    case 'PROHIBITED':
      return 'PROHIBITED';
    default:
      return 'UNRESOLVED';
  }
}

export type LocalSourceOrigin = 'GLOBAL_REACH_PACK' | 'FEED_REGISTRY' | 'OFFICIAL_SOURCE_REGISTRY';

/** One registry record of a LOCAL publisher/institution, normalized for accounting. */
export interface LocalSourceCandidate {
  readonly sourceId: string;
  readonly origin: LocalSourceOrigin;
  readonly iso3: string;
  readonly domain: SourceCoverageDomain;
  readonly canonicalHost: string;
  /** Activated for this process (pack ACTIVE, feed selected by config, registry enabled). */
  readonly active: boolean;
  readonly rightsState: SourceRightsState;
  /** The registry holds a measurement that this source delivers (verified + healthy). */
  readonly measured: boolean;
}

/** An international source (aggregator or foreign publisher) and its recorded rights. */
export interface InternationalSourceState {
  readonly sourceId: string;
  readonly displayName: string;
  readonly basis: 'INTERNATIONAL_AGGREGATOR' | 'INTERNATIONAL_PUBLISHER';
  readonly active: boolean;
  readonly rightsState: SourceRightsState;
  readonly rightsNote: string;
}

export interface DomainSourceCoverage {
  readonly domain: SourceCoverageDomain;
  readonly state: CanonicalCoverageState;
  /** Distinct local publishers/institutions listed in any registry. */
  readonly listedLocalSourceCount: number;
  readonly activeLocalSourceCount: number;
  readonly rightsClearedLocalSourceCount: number;
  /** Active AND rights-cleared AND measured — what COVERED_LOCAL requires. */
  readonly qualifiedLocalSourceCount: number;
  /** Listed local sources whose recorded rights forbid activation. */
  readonly rightsBlockedLocalSourceCount: number;
}

export interface CountrySourceCoverage {
  readonly iso3: string;
  /** Roll-up: the weakest domain state (a gap in any domain is a gap for the country). */
  readonly coverageState: CanonicalCoverageState;
  readonly coverageDomains: readonly DomainSourceCoverage[];
  readonly activeInternationalSources: readonly InternationalSourceState[];
  readonly coverageGapReason: string | null;
}

export interface SourceCoverageOptions {
  /** Local candidates from registries other than the canonical packs (feeds, official sources). */
  readonly extraLocalSources?: readonly LocalSourceCandidate[];
  /** International sources and whether each is active for this process. */
  readonly internationalSources?: readonly InternationalSourceState[];
}

/** LOCAL pack entries as accounting candidates, one per sourceId. */
export function localCandidatesFromPacks(
  packs: readonly CountrySourcePack[],
): readonly LocalSourceCandidate[] {
  const seen = new Set<string>();
  const out: LocalSourceCandidate[] = [];
  for (const pack of packs) {
    for (const e of pack.entries) {
      if (e.basis !== 'LOCAL' || seen.has(e.sourceId)) continue;
      seen.add(e.sourceId);
      out.push({
        sourceId: e.sourceId,
        origin: 'GLOBAL_REACH_PACK',
        iso3: e.iso3,
        domain: coverageDomainOf(e.sourceClass),
        canonicalHost: canonicalPublisherHost(e.canonicalHost),
        active: e.activationStatus === 'ACTIVE',
        rightsState: packEntryRightsState(e),
        measured: measuredLocalSource(e),
      });
    }
  }
  return out;
}

function sameOrSubHost(a: string, b: string): boolean {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

interface MergedPublisher {
  hosts: string[];
  active: boolean;
  rightsState: SourceRightsState;
  measured: boolean;
}

/** One publisher described by several registries is one publisher. Rights merge strictly. */
function mergePublishers(candidates: readonly LocalSourceCandidate[]): MergedPublisher[] {
  const merged: MergedPublisher[] = [];
  const ordered = [...candidates].sort((a, b) =>
    a.canonicalHost === b.canonicalHost
      ? a.sourceId.localeCompare(b.sourceId)
      : a.canonicalHost.localeCompare(b.canonicalHost),
  );
  for (const c of ordered) {
    const host = canonicalPublisherHost(c.canonicalHost);
    const hit = merged.find((m) => m.hosts.some((h) => sameOrSubHost(h, host)));
    if (hit) {
      if (!hit.hosts.includes(host)) hit.hosts.push(host);
      hit.active = hit.active || c.active;
      hit.rightsState = stricterRightsState(hit.rightsState, c.rightsState);
      hit.measured = hit.measured || c.measured;
    } else {
      merged.push({ hosts: [host], active: c.active, rightsState: c.rightsState, measured: c.measured });
    }
  }
  return merged;
}

export function accountDomainCoverage(
  domain: SourceCoverageDomain,
  candidates: readonly LocalSourceCandidate[],
): DomainSourceCoverage {
  const publishers = mergePublishers(candidates.filter((c) => c.domain === domain));
  const activeCleared = publishers.filter((p) => p.active && p.rightsState === 'CLEARED');
  const qualified = activeCleared.filter((p) => p.measured);
  return {
    domain,
    state:
      qualified.length > 0 ? 'COVERED_LOCAL' : activeCleared.length > 0 ? 'UNVERIFIED' : 'COVERAGE_GAP',
    listedLocalSourceCount: publishers.length,
    activeLocalSourceCount: publishers.filter((p) => p.active).length,
    rightsClearedLocalSourceCount: publishers.filter((p) => p.rightsState === 'CLEARED').length,
    qualifiedLocalSourceCount: qualified.length,
    rightsBlockedLocalSourceCount: publishers.filter((p) => rightsBlockActivation(p.rightsState))
      .length,
  };
}

function weakest(states: readonly CanonicalCoverageState[]): CanonicalCoverageState {
  if (states.includes('COVERAGE_GAP')) return 'COVERAGE_GAP';
  if (states.includes('UNVERIFIED')) return 'UNVERIFIED';
  return 'COVERED_LOCAL';
}

function gapReasonFor(domains: readonly DomainSourceCoverage[]): string | null {
  const gaps = domains.filter((d) => d.state !== 'COVERED_LOCAL');
  if (gaps.length === 0) return null;
  return gaps
    .map((d) => {
      if (d.state === 'UNVERIFIED')
        return `${d.domain}: active rights-cleared local source has no delivery measurement`;
      if (d.listedLocalSourceCount === 0) return `${d.domain}: no local source listed`;
      if (d.activeLocalSourceCount === 0)
        return `${d.domain}: ${d.listedLocalSourceCount} local source(s) listed, none active`;
      return `${d.domain}: ${d.activeLocalSourceCount} local source(s) active, none rights-cleared`;
    })
    .join('; ');
}

/**
 * The canonical coverage of ONE country from its local candidates (all
 * registries) and the international sources active for this process. Pure.
 */
export function accountCountrySourceCoverage(
  iso3: string,
  candidates: readonly LocalSourceCandidate[],
  internationalSources: readonly InternationalSourceState[] = [],
): CountrySourceCoverage {
  const mine = candidates.filter((c) => c.iso3 === iso3);
  const coverageDomains = SOURCE_COVERAGE_DOMAINS.map((d) => accountDomainCoverage(d, mine));
  return {
    iso3,
    coverageState: weakest(coverageDomains.map((d) => d.state)),
    coverageDomains,
    activeInternationalSources: internationalSources.filter((s) => s.active),
    coverageGapReason: gapReasonFor(coverageDomains),
  };
}

/** Completeness accounts for members; it never estimates event detection. */
export function accountSourceCoverage(
  regions: readonly GovernedSourceRegion[],
  packs: readonly CountrySourcePack[],
  options: SourceCoverageOptions = {},
) {
  return regions.flatMap((region) =>
    region.members.map((iso3) => {
      const country = COUNTRIES.find((c) => c.iso3 === iso3)!;
      const pack = packs.find((p) => p.governedRegion === region.id && p.iso3 === iso3);
      const entries = pack?.entries ?? [];
      const local = entries.filter((e) => e.basis === 'LOCAL');
      const measured = local.filter(measuredLocalSource);
      /* BASELINE (research) state — unchanged semantics. See CanonicalCoverageState. */
      const state: CoverageState =
        measured.length > 0 && pack?.verifiedAt !== null
          ? 'VALIDATED_LOCAL_BASELINE'
          : local.length === 0
            ? 'COVERAGE_GAP'
            : local.every((e) => e.verifiedAt === null)
              ? 'UNVERIFIED'
              : 'PARTIAL';
      const sourceCoverage = accountCountrySourceCoverage(
        iso3,
        [...localCandidatesFromPacks(pack ? [pack] : []), ...(options.extraLocalSources ?? [])],
        options.internationalSources ?? [],
      );
      return {
        iso2: country.iso2,
        iso3,
        countryName: country.name,
        governedRegion: region.id,
        state,
        coverageState: sourceCoverage.coverageState,
        coverageDomains: sourceCoverage.coverageDomains,
        activeInternationalSources: sourceCoverage.activeInternationalSources,
        coverageGapReason: sourceCoverage.coverageGapReason,
        localPublisherCount: local.length,
        validatedLocalPublisherCount: measured.length,
        internationalPublisherCount: entries.length - local.length,
        languages: [...new Set(local.flatMap((e) => e.languages))].sort(),
        validatedLanguages: [...new Set(measured.flatMap((e) => e.languages))].sort(),
        lastVerification: pack?.verifiedAt ?? null,
        gapReason:
          state === 'VALIDATED_LOCAL_BASELINE'
            ? null
            : (pack?.gapReason ??
              (local.length === 0
                ? 'No local source pack baseline'
                : 'Local baseline not validated')),
        publishers: entries,
      };
    }),
  );
}

/* ── LOCAL vs INTERNATIONAL EVIDENCE ─────────────────────────────────────── */

/**
 * Locality of ONE evidence record relative to a country, decided only from the
 * record's registrable domain against registered publisher hosts (never from
 * `sourceName`, never from the provider that transported it):
 *
 *   LOCAL                matches a registered LOCAL publisher host for the country
 *   INTERNATIONAL        matches a registered publisher host of another country,
 *                        or a registered INTERNATIONAL publisher
 *   UNVERIFIED_LOCALITY  no registered host matches (or the URL is unusable) —
 *                        not proven local, so never presented as local
 */
export type EvidenceLocality = 'LOCAL' | 'INTERNATIONAL' | 'UNVERIFIED_LOCALITY';

export type SourceCoverageNotice = 'LOCAL_COVERAGE_ABSENT' | 'LOCAL_COVERAGE_UNVERIFIED';

/**
 * The reader-facing coverage fact attached to a country response. Computed
 * offline from registries and the already-retrieved evidence; rendering it
 * performs no provider or HTTP call.
 */
export interface SourceCoverageDisclosure {
  readonly iso3: string;
  /** The country is a member of a governed source-pack programme. */
  readonly governed: boolean;
  /** NEWS_REPORTING domain state — what the reader's news feed rests on. */
  readonly state: CanonicalCoverageState;
  readonly domains: readonly { readonly domain: SourceCoverageDomain; readonly state: CanonicalCoverageState }[];
  readonly evidence: {
    readonly local: number;
    readonly international: number;
    readonly unverifiedLocality: number;
  };
  /** International sources that contributed to THIS response, with recorded rights. */
  readonly internationalSources: readonly {
    readonly sourceId: string;
    readonly displayName: string;
    readonly rightsState: SourceRightsState;
  }[];
  /** Null only when local news coverage is COVERED_LOCAL. */
  readonly notice: SourceCoverageNotice | null;
}

export function sourceCoverageDisclosureFrom(input: {
  readonly coverage: CountrySourceCoverage;
  readonly governed: boolean;
  readonly localities: readonly EvidenceLocality[];
  readonly contributingInternational: readonly InternationalSourceState[];
}): SourceCoverageDisclosure {
  const news =
    input.coverage.coverageDomains.find((d) => d.domain === 'NEWS_REPORTING')?.state ??
    'COVERAGE_GAP';
  const count = (l: EvidenceLocality) => input.localities.filter((x) => x === l).length;
  return {
    iso3: input.coverage.iso3,
    governed: input.governed,
    state: news,
    domains: input.coverage.coverageDomains.map(({ domain, state }) => ({ domain, state })),
    evidence: {
      local: count('LOCAL'),
      international: count('INTERNATIONAL'),
      unverifiedLocality: count('UNVERIFIED_LOCALITY'),
    },
    internationalSources: input.contributingInternational.map(
      ({ sourceId, displayName, rightsState }) => ({ sourceId, displayName, rightsState }),
    ),
    notice:
      news === 'COVERED_LOCAL'
        ? null
        : news === 'UNVERIFIED'
          ? 'LOCAL_COVERAGE_UNVERIFIED'
          : 'LOCAL_COVERAGE_ABSENT',
  };
}
