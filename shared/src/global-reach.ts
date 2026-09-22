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
/** Completeness accounts for members; it never estimates event detection. */
export function accountSourceCoverage(
  regions: readonly GovernedSourceRegion[],
  packs: readonly CountrySourcePack[],
) {
  return regions.flatMap((region) =>
    region.members.map((iso3) => {
      const country = COUNTRIES.find((c) => c.iso3 === iso3)!;
      const pack = packs.find((p) => p.governedRegion === region.id && p.iso3 === iso3);
      const entries = pack?.entries ?? [];
      const local = entries.filter((e) => e.basis === 'LOCAL');
      const measured = local.filter(measuredLocalSource);
      const state: CoverageState =
        measured.length > 0 && pack?.verifiedAt !== null
          ? 'VALIDATED_LOCAL_BASELINE'
          : local.length === 0
            ? 'COVERAGE_GAP'
            : local.every((e) => e.verifiedAt === null)
              ? 'UNVERIFIED'
              : 'PARTIAL';
      return {
        iso2: country.iso2,
        iso3,
        countryName: country.name,
        governedRegion: region.id,
        state,
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
