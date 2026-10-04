import {
  COUNTRIES,
  accountCountrySourceCoverage,
  accountSourceCoverage,
  canonicalPublisherHost,
  coverageDomainOf,
  localCandidatesFromPacks,
  sourceCoverageDisclosureFrom,
} from '@globalnews-ai/shared';
import type {
  CountrySourcePack,
  EvidenceLocality,
  GovernedSourceRegion,
  InternationalSourceState,
  LocalSourceCandidate,
  SourceCoverageDisclosure,
  SourceRightsState,
} from '@globalnews-ai/shared';
import { FEED_SOURCES, resolveActiveFeedSources } from '../news/providers/feed-source-registry';
import type { FeedSourceEntry } from '../news/providers/feed-source-registry';
import { isGdeltDocEnabled, isUsableGNewsApiKey } from '../news/providers/provider.tokens';
import { isRssFeedsEnabled } from '../news/providers/rss-feed.provider';
import { OFFICIAL_SOURCES } from '../official-sources/official-source-registry';
import {
  classifyEvidenceLocality,
  registeredPublisherHost,
  type EvidenceLocalityRegistry,
  type RegisteredPublisherHost,
} from '../news/identity/evidence-locality.util';
import { GLOBAL_REACH_REGIONS, GLOBAL_REACH_SOURCE_PACKS } from './source-pack.registry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * T1 — THE SOURCE-COVERAGE AUTHORITY (backend side of the ONE coverage system)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The accounting itself lives in shared `global-reach.ts`
 * (`accountSourceCoverage` / `accountCountrySourceCoverage`). This module only
 * GATHERS the inputs that live in backend registries — the canonical packs,
 * the curated feed registry, the official-source registry, the international
 * aggregators — and the process's activation facts (which feeds/providers the
 * configuration turned on). It adds no state of its own.
 *
 * NO PROVIDER CALL, EVER. Every function here reads static registry data and
 * configuration values. Rendering coverage state therefore costs no quota and
 * makes no HTTP request (asserted in source-coverage.authority.spec.ts).
 */

/**
 * The international news aggregators the product can serve from, with their
 * RECORDED rights state. Neither is rights-cleared, and neither is disabled for
 * that reason: the state is stated, not resolved.
 */
export const INTERNATIONAL_NEWS_SOURCES: readonly Omit<InternationalSourceState, 'active'>[] =
  Object.freeze([
    {
      sourceId: 'gnews',
      displayName: 'GNews',
      basis: 'INTERNATIONAL_AGGREGATOR',
      rightsState: 'RIGHTS_UNDER_E1_REVIEW',
      rightsNote:
        'No rights record in the repository. Whether the active GNews subscription permits ' +
        'production/commercial use is an open review item (PUBLIC-BETA GATE, ' +
        'docs/beta/HOME-R2-DEDUP-PROVIDER-DISCLOSURE-R1.md §4). Not accepted; not disabled.',
    },
    {
      sourceId: 'gdelt-doc',
      displayName: 'GDELT DOC 2.0',
      basis: 'INTERNATIONAL_AGGREGATOR',
      rightsState: 'UNRESOLVED',
      rightsNote: 'No rights record. Fallback tier; disabled unless GDELT_DOC_ENABLED=true.',
    },
  ] as const);

export type ConfigReader = (key: string) => string | undefined;

/** Which sources this process's configuration activates. Pure; no I/O. */
export interface SourceActivation {
  readonly activeFeedIds: ReadonlySet<string>;
  readonly activeInternationalIds: ReadonlySet<string>;
}

export const NO_ACTIVATION: SourceActivation = Object.freeze({
  activeFeedIds: new Set<string>(),
  activeInternationalIds: new Set<string>(),
});

export function sourceActivationFromConfig(read: ConfigReader): SourceActivation {
  const feeds = isRssFeedsEnabled(read('RSS_FEEDS_ENABLED'))
    ? resolveActiveFeedSources(FEED_SOURCES, read('RSS_FEED_SOURCES')).sources
    : [];
  const international = new Set<string>();
  if (isUsableGNewsApiKey(read('GNEWS_API_KEY'))) international.add('gnews');
  if (isGdeltDocEnabled(read('GDELT_DOC_ENABLED'))) international.add('gdelt-doc');
  return {
    activeFeedIds: new Set(feeds.map((f) => f.sourceId)),
    activeInternationalIds: international,
  };
}

const ISO3_BY_ISO2 = new Map(COUNTRIES.map((c) => [c.iso2.toUpperCase(), c.iso3]));

function hostOfUrl(url: string): string | null {
  try {
    return canonicalPublisherHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

function feedCandidate(feed: FeedSourceEntry, active: boolean): LocalSourceCandidate | null {
  const iso3 = ISO3_BY_ISO2.get(feed.countryCode.toUpperCase());
  if (!iso3) return null;
  return {
    sourceId: feed.sourceId,
    origin: 'FEED_REGISTRY',
    iso3,
    domain: coverageDomainOf(feed.sourceType),
    canonicalHost: canonicalPublisherHost(feed.canonicalHost),
    active,
    rightsState: feed.rights.state,
    /* A feed fetch on `verifiedAt` is a technical check, not a delivery measurement. */
    measured: false,
  };
}

/** Local candidates from the feed and official-source registries (not the packs). */
export function registryLocalCandidates(activation: SourceActivation): readonly LocalSourceCandidate[] {
  const out: LocalSourceCandidate[] = [];
  for (const feed of FEED_SOURCES) {
    const candidate = feedCandidate(feed, activation.activeFeedIds.has(feed.sourceId));
    if (candidate) out.push(candidate);
  }
  for (const official of OFFICIAL_SOURCES) {
    if (!official.countryCode) continue;
    const iso3 = ISO3_BY_ISO2.get(official.countryCode.toUpperCase());
    const host = hostOfUrl(official.baseUrl);
    if (!iso3 || !host) continue;
    out.push({
      sourceId: `official:${official.id}`,
      origin: 'OFFICIAL_SOURCE_REGISTRY',
      iso3,
      domain: 'OFFICIAL_PUBLIC_DATA',
      canonicalHost: host,
      /* Official sources are not activated by this lane; `enabled` alone is not rights. */
      active: official.enabled,
      /* A binding is a KEY to a record, never a grade; resolution is the economy lane's. */
      rightsState: 'UNRESOLVED' satisfies SourceRightsState,
      measured: false,
    });
  }
  return out;
}

export function internationalSourceStates(
  activation: SourceActivation,
): readonly InternationalSourceState[] {
  return INTERNATIONAL_NEWS_SOURCES.map((s) => ({
    ...s,
    active: activation.activeInternationalIds.has(s.sourceId),
  }));
}

/** The governed accounting (admin / coverage check), with every registry folded in. */
export function governedSourceCoverage(
  activation: SourceActivation,
  regions: readonly GovernedSourceRegion[] = GLOBAL_REACH_REGIONS,
  packs: readonly CountrySourcePack[] = GLOBAL_REACH_SOURCE_PACKS,
) {
  return accountSourceCoverage(regions, packs, {
    extraLocalSources: registryLocalCandidates(activation),
    internationalSources: internationalSourceStates(activation),
  });
}

/* ── evidence locality registry (built once; static data only) ──────────── */

let localityRegistry: EvidenceLocalityRegistry | undefined;

export function evidenceLocalityRegistry(): EvidenceLocalityRegistry {
  if (localityRegistry) return localityRegistry;
  const local = new Map<string, RegisteredPublisherHost[]>();
  const international: RegisteredPublisherHost[] = [];
  const addLocal = (iso3: string, host: string) => {
    const list = local.get(iso3) ?? [];
    if (!list.some((h) => h.host === canonicalPublisherHost(host))) {
      list.push(registeredPublisherHost(host));
    }
    local.set(iso3, list);
  };
  for (const pack of GLOBAL_REACH_SOURCE_PACKS) {
    for (const e of pack.entries) {
      if (e.basis === 'LOCAL') addLocal(e.iso3, e.canonicalHost);
      else international.push(registeredPublisherHost(e.canonicalHost));
    }
  }
  for (const candidate of registryLocalCandidates(NO_ACTIVATION)) {
    addLocal(candidate.iso3, candidate.canonicalHost);
  }
  for (const official of OFFICIAL_SOURCES) {
    if (official.countryCode) continue;
    const host = hostOfUrl(official.baseUrl);
    if (host) international.push(registeredPublisherHost(host));
  }
  localityRegistry = { localHostsByIso3: local, internationalHosts: international };
  return localityRegistry;
}

export function classifyEvidenceLocalityFor(
  url: string | undefined | null,
  iso3: string,
): EvidenceLocality {
  return classifyEvidenceLocality(url, iso3, evidenceLocalityRegistry());
}

const GOVERNED_ISO3 = new Set(GLOBAL_REACH_REGIONS.flatMap((r) => r.members));

/**
 * The reader-facing coverage fact for one country and the evidence actually
 * shown. `contributingProviderIds` are the provider ids that produced this
 * response (already known to the caller) — used only to name which
 * international sources the evidence came through. No provider is called.
 */
export function countrySourceCoverageDisclosure(input: {
  readonly iso3: string;
  readonly evidenceUrls: readonly (string | undefined | null)[];
  readonly contributingProviderIds: readonly string[];
  readonly activation: SourceActivation;
}): SourceCoverageDisclosure {
  const iso3 = input.iso3.toUpperCase();
  const candidates = [
    ...localCandidatesFromPacks(GLOBAL_REACH_SOURCE_PACKS.filter((p) => p.iso3 === iso3)),
    ...registryLocalCandidates(input.activation),
  ];
  const international = internationalSourceStates(input.activation);
  const coverage = accountCountrySourceCoverage(iso3, candidates, international);
  const contributing = new Set(input.contributingProviderIds);
  return sourceCoverageDisclosureFrom({
    coverage,
    governed: GOVERNED_ISO3.has(iso3),
    localities: input.evidenceUrls.map((url) => classifyEvidenceLocalityFor(url, iso3)),
    contributingInternational: international.filter((s) => contributing.has(s.sourceId)),
  });
}
