import { writeFileSync } from 'fs';
import { join } from 'path';
import { COUNTRIES, localCandidatesFromPacks, rightsBlockActivation } from '@globalnews-ai/shared';
import type { CanonicalCoverageState, LocalSourceCandidate } from '@globalnews-ai/shared';
import { FEED_SOURCES, resolveActiveFeedSources } from '../news/providers/feed-source-registry';
import {
  INTERNATIONAL_NEWS_SOURCES,
  governedSourceCoverage,
  registryLocalCandidates,
  type SourceActivation,
} from './source-coverage.authority';
import { GLOBAL_REACH_REGIONS, GLOBAL_REACH_SOURCE_PACKS } from './source-pack.registry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * T1 — THE MACHINE-READABLE COVERAGE CHECK (consumed by the whole-product matrix)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Emits, per priority region / country / domain, the CANONICAL coverage state
 * computed by the one shared accounting (`governedSourceCoverage` →
 * shared `accountSourceCoverage`), with the listed / active / rights-cleared
 * local counts, the active international sources and the GNews rights state.
 *
 * DETERMINISTIC: registry data and a declared activation profile only — no
 * clock, no environment, no network, no provider call. The committed output
 * (docs/convergence/stage2/coverage-check.json) is pinned by
 * coverage-check.spec.ts, so a registry change that moves coverage must
 * regenerate it:
 *
 *   cd backend && npx ts-node --transpile-only src/modules/global-reach/coverage-check.ts --write
 */

export const COVERAGE_CHECK_SCHEMA_VERSION = 1;
export const COVERAGE_CHECK_OUTPUT = 'docs/convergence/stage2/coverage-check.json';

const PRIORITY_REGIONS: readonly { id: string; label: string }[] = [
  { id: 'region:east-africa', label: 'East Africa' },
  { id: 'region:european-union', label: 'EU-27' },
  { id: 'region:middle-east', label: 'Middle East' },
];
const DEEP_REFERENCE_ISO3 = 'POL';

/**
 * The declared profile the committed check is computed under. It cannot read a
 * deployment's secrets, so it states its assumption: GNews configured with a
 * usable key (the product's primary news lane), every other lane at its
 * shipped default (RSS feeds off, GDELT DOC off).
 */
export const DECLARED_ACTIVATION: SourceActivation = Object.freeze({
  activeFeedIds: new Set<string>(),
  activeInternationalIds: new Set<string>(['gnews']),
});

/**
 * Every source configuration COULD turn on: all feeds the rights gate lets
 * through and every international source. Used only to prove whether the
 * canonical state depends on configuration at all.
 */
export function maximalActivation(): SourceActivation {
  const all = resolveActiveFeedSources(FEED_SOURCES, FEED_SOURCES.map((f) => f.sourceId).join(','));
  return {
    activeFeedIds: new Set(all.sources.map((f) => f.sourceId)),
    activeInternationalIds: new Set(INTERNATIONAL_NEWS_SOURCES.map((s) => s.sourceId)),
  };
}

function countBy<T extends string>(states: readonly T[], all: readonly T[]): Record<T, number> {
  return Object.fromEntries(all.map((s) => [s, states.filter((x) => x === s).length])) as Record<
    T,
    number
  >;
}

const STATES: readonly CanonicalCoverageState[] = ['COVERED_LOCAL', 'UNVERIFIED', 'COVERAGE_GAP'];

function deepReferenceSources(activation: SourceActivation) {
  const candidates: LocalSourceCandidate[] = [
    ...localCandidatesFromPacks(GLOBAL_REACH_SOURCE_PACKS.filter((p) => p.iso3 === DEEP_REFERENCE_ISO3)),
    ...registryLocalCandidates(activation).filter((c) => c.iso3 === DEEP_REFERENCE_ISO3),
  ];
  return candidates
    .map((c) => ({
      sourceId: c.sourceId,
      origin: c.origin,
      domain: c.domain,
      canonicalHost: c.canonicalHost,
      active: c.active,
      rightsState: c.rightsState,
      /* The same predicate the feed gate and the acquisition gate apply. */
      activationBlockedByRights: rightsBlockActivation(c.rightsState),
    }))
    .sort((a, b) =>
      a.domain === b.domain ? a.sourceId.localeCompare(b.sourceId) : a.domain.localeCompare(b.domain),
    );
}

export function buildCoverageCheck(activation: SourceActivation = DECLARED_ACTIVATION) {
  const rows = governedSourceCoverage(activation);
  const maximal = new Map(governedSourceCoverage(maximalActivation()).map((r) => [r.iso3, r]));
  const allFeeds = resolveActiveFeedSources(FEED_SOURCES, FEED_SOURCES.map((f) => f.sourceId).join(','));
  const gnews = INTERNATIONAL_NEWS_SOURCES.find((s) => s.sourceId === 'gnews');
  const names = new Map(COUNTRIES.map((c) => [c.iso3, c.name]));

  const regions = PRIORITY_REGIONS.map(({ id, label }) => {
    const region = GLOBAL_REACH_REGIONS.find((r) => r.id === id);
    if (!region) throw new Error(`Priority region missing from the governed registry: ${id}`);
    const countries = rows
      .filter((r) => r.governedRegion === id)
      .sort((a, b) => a.iso3.localeCompare(b.iso3))
      .map((r) => ({
        iso2: r.iso2,
        iso3: r.iso3,
        countryName: names.get(r.iso3) ?? r.countryName,
        deepReference: r.iso3 === DEEP_REFERENCE_ISO3,
        coverageState: r.coverageState,
        /** The research baseline state (unchanged legacy semantics), for traceability. */
        baselineState: r.state,
        domains: r.coverageDomains.map((d) => ({
          domain: d.domain,
          state: d.state,
          listedLocalSources: d.listedLocalSourceCount,
          activeLocalSources: d.activeLocalSourceCount,
          rightsClearedLocalSources: d.rightsClearedLocalSourceCount,
          qualifiedLocalSources: d.qualifiedLocalSourceCount,
          rightsBlockedLocalSources: d.rightsBlockedLocalSourceCount,
        })),
        activeInternationalSources: r.activeInternationalSources.map((s) => ({
          sourceId: s.sourceId,
          basis: s.basis,
          rightsState: s.rightsState,
        })),
        coverageGapReason: r.coverageGapReason,
        /** Same state with every activatable source switched on — false would mean config could change it. */
        stateIndependentOfActivation: maximal.get(r.iso3)?.coverageState === r.coverageState,
        ...(r.iso3 === DEEP_REFERENCE_ISO3 ? { localSources: deepReferenceSources(activation) } : {}),
      }));
    return {
      id,
      label,
      memberCount: region.members.length,
      coverageStates: countBy(
        countries.map((c) => c.coverageState),
        STATES,
      ),
      countries,
    };
  });

  return {
    schemaVersion: COVERAGE_CHECK_SCHEMA_VERSION,
    contract: 'CTO R2 T1 COVERAGE TRUTHFULNESS',
    generator: 'backend/src/modules/global-reach/coverage-check.ts',
    accounting: 'shared/src/global-reach.ts accountSourceCoverage (one canonical system)',
    rule:
      'COVERED_LOCAL requires a LOCAL source that is ACTIVE, rights CLEARED and measured; ' +
      'UNVERIFIED = active and rights-cleared but unmeasured; COVERAGE_GAP otherwise. ' +
      'International/aggregated evidence never counts as local coverage.',
    activationProfile: {
      id: 'DECLARED_GNEWS_PRIMARY_SHIPPED_DEFAULTS',
      assumption:
        'GNEWS_API_KEY holds a usable (non-placeholder) key; RSS_FEEDS_ENABLED and GDELT_DOC_ENABLED at shipped defaults (off). ' +
        'No deployment secret is read.',
      activeFeedIds: [...activation.activeFeedIds].sort(),
      activeInternationalIds: [...activation.activeInternationalIds].sort(),
    },
    gnews: {
      sourceId: 'gnews',
      basis: gnews?.basis ?? 'INTERNATIONAL_AGGREGATOR',
      rightsState: gnews?.rightsState ?? 'UNRESOLVED',
      rightsNote: gnews?.rightsNote ?? '',
      activeInProfile: activation.activeInternationalIds.has('gnews'),
      countsAsLocalCoverage: false,
    },
    internationalSources: INTERNATIONAL_NEWS_SOURCES.map((s) => ({
      sourceId: s.sourceId,
      displayName: s.displayName,
      basis: s.basis,
      rightsState: s.rightsState,
      activeInProfile: activation.activeInternationalIds.has(s.sourceId),
    })),
    feedRightsGate: {
      refused: allFeeds.refused.map(({ sourceId, reason, rightsState, evidence }) => ({
        sourceId,
        reason,
        rightsState,
        evidence,
      })),
      activatableWithUnresolvedRights: allFeeds.rightsUnresolved.map(({ sourceId, rightsState }) => ({
        sourceId,
        rightsState,
      })),
    },
    totals: {
      governedCountries: rows.length,
      coverageStates: countBy(
        rows.map((r) => r.coverageState),
        STATES,
      ),
    },
    regions,
  };
}

export function renderCoverageCheck(): string {
  return `${JSON.stringify(buildCoverageCheck(), null, 2)}\n`;
}

/* CLI: print the check, or `--write` it to the committed path (repo-root relative). */
if (require.main === module) {
  const out = renderCoverageCheck();
  if (process.argv.includes('--write')) {
    const target = join(__dirname, '..', '..', '..', '..', COVERAGE_CHECK_OUTPUT);
    writeFileSync(target, out);
    process.stdout.write(`wrote ${COVERAGE_CHECK_OUTPUT}\n`);
  } else {
    process.stdout.write(out);
  }
}
