import type { EvidenceLocality } from '@globalnews-ai/shared';
import { resolveRegistrableDomain } from './publisher-identity.util';

/**
 * T1 — LOCAL vs INTERNATIONAL EVIDENCE, DECIDED FROM THE URL AND THE REGISTRY.
 *
 * A record is LOCAL to a country only when its registrable domain (the same
 * `resolveRegistrableDomain` the publisher-identity measurement uses) matches a
 * registered LOCAL publisher host for that country. Nothing else can make a
 * record local:
 *
 *   - not `sourceName` (a provider string — "Kenya Times Online" proves nothing)
 *   - not the provider that transported it (GNews, GDELT and feeds are
 *     transports; a GNews record is non-local unless its own URL proves local)
 *   - not a country tag the provider attached
 *
 * Deterministic and provider-neutral: the same URL and registry always yield
 * the same answer, and no network, DNS or provider access happens here.
 *
 * SUFFIX COLLAPSE GUARD. `resolveRegistrableDomain` carries a short, closed
 * list of multi-part suffixes. For a suffix it does not know (e.g. `com.sa`),
 * `arabnews.com.sa` collapses to `com.sa`, and comparing at that level would
 * make every `.com.sa` site "the same publisher". When a registered host's
 * registrable domain looks like such a collapse (its first label is a generic
 * second-level label), matching falls back to exact host / subdomain-of-host,
 * which can only under-claim locality, never over-claim it.
 */
const GENERIC_SECOND_LEVEL_LABELS: ReadonlySet<string> = new Set([
  'ac',
  'co',
  'com',
  'edu',
  'go',
  'gob',
  'gouv',
  'gov',
  'gv',
  'info',
  'mil',
  'ne',
  'net',
  'or',
  'org',
  'sch',
]);

export interface RegisteredPublisherHost {
  readonly host: string;
  /** Registrable domain usable for matching, or null when it would be a suffix collapse. */
  readonly registrable: string | null;
}

export interface EvidenceLocalityRegistry {
  /** Registered LOCAL publisher/institution hosts per ISO3. */
  readonly localHostsByIso3: ReadonlyMap<string, readonly RegisteredPublisherHost[]>;
  /** Registered INTERNATIONAL publisher hosts (foreign/supranational by registry basis). */
  readonly internationalHosts: readonly RegisteredPublisherHost[];
}

function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.$/, '');
}

export function registeredPublisherHost(host: string): RegisteredPublisherHost {
  const normalized = normalizeHost(host);
  const registrable = resolveRegistrableDomain(`https://${normalized}/`) ?? null;
  const collapsed =
    registrable !== null &&
    registrable.split('.').length === 2 &&
    GENERIC_SECOND_LEVEL_LABELS.has(registrable.split('.')[0]);
  return { host: normalized, registrable: collapsed ? null : registrable };
}

function matches(
  urlHost: string,
  urlRegistrable: string | undefined,
  registered: RegisteredPublisherHost,
): boolean {
  if (registered.registrable !== null && urlRegistrable === registered.registrable) return true;
  return urlHost === registered.host || urlHost.endsWith(`.${registered.host}`);
}

/** Locality of one evidence URL relative to `iso3`. */
export function classifyEvidenceLocality(
  url: string | undefined | null,
  iso3: string,
  registry: EvidenceLocalityRegistry,
): EvidenceLocality {
  if (typeof url !== 'string' || url.length === 0) return 'UNVERIFIED_LOCALITY';
  let urlHost: string;
  try {
    urlHost = normalizeHost(new URL(url).hostname);
  } catch {
    return 'UNVERIFIED_LOCALITY';
  }
  if (urlHost.length === 0) return 'UNVERIFIED_LOCALITY';
  const urlRegistrable = resolveRegistrableDomain(url);

  const local = registry.localHostsByIso3.get(iso3.toUpperCase()) ?? [];
  if (local.some((h) => matches(urlHost, urlRegistrable, h))) return 'LOCAL';

  for (const [otherIso3, hosts] of registry.localHostsByIso3) {
    if (otherIso3 === iso3.toUpperCase()) continue;
    if (hosts.some((h) => matches(urlHost, urlRegistrable, h))) return 'INTERNATIONAL';
  }
  if (registry.internationalHosts.some((h) => matches(urlHost, urlRegistrable, h))) {
    return 'INTERNATIONAL';
  }
  return 'UNVERIFIED_LOCALITY';
}
