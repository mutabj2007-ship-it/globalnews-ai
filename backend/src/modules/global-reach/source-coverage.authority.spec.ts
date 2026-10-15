// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require('http') as typeof import('http');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const https = require('https') as typeof import('https');
import type { CountryNewsResponse } from '@globalnews-ai/shared';
import {
  INTERNATIONAL_NEWS_SOURCES,
  NO_ACTIVATION,
  classifyEvidenceLocalityFor,
  countrySourceCoverageDisclosure,
  governedSourceCoverage,
  sourceActivationFromConfig,
} from './source-coverage.authority';
import {
  classifyEvidenceLocality,
  registeredPublisherHost,
} from '../news/identity/evidence-locality.util';
import { CountryNewsController } from '../news/country/country-news.controller';
import { GLOBAL_REACH_SOURCE_PACKS } from './source-pack.registry';

/**
 * T1 COVERAGE TRUTHFULNESS — the canonical coverage state, the locality
 * classifier, the reader disclosure, and the proof that none of it calls a
 * provider.
 */
const config = (values: Record<string, string>) => (key: string) => values[key];

describe('T1 · canonical coverage over the 54 governed countries', () => {
  const rows = governedSourceCoverage(NO_ACTIVATION);

  it('every governed country is an explicit COVERAGE_GAP in both domains — none UNVERIFIED', () => {
    expect(rows).toHaveLength(54);
    for (const row of rows) {
      expect([row.iso3, row.coverageState]).toEqual([row.iso3, 'COVERAGE_GAP']);
      expect(row.coverageDomains.map((d) => d.domain)).toEqual(['NEWS_REPORTING', 'OFFICIAL_PUBLIC_DATA']);
      for (const d of row.coverageDomains) {
        expect(d.state).toBe('COVERAGE_GAP');
        expect(d.qualifiedLocalSourceCount).toBe(0);
        expect(d.activeLocalSourceCount).toBe(0);
        expect(d.rightsClearedLocalSourceCount).toBe(0);
      }
      expect(row.coverageGapReason).toBeTruthy();
    }
  });

  it('keeps the legacy BASELINE state untouched (UNVERIFIED research baseline)', () => {
    expect(new Set(rows.map((r) => r.state))).toEqual(new Set(['UNVERIFIED']));
  });

  it('Kenya counts The Standard (pack + feed) once, as rights-blocked', () => {
    const ken = rows.find((r) => r.iso3 === 'KEN')!;
    const news = ken.coverageDomains.find((d) => d.domain === 'NEWS_REPORTING')!;
    expect(news.rightsBlockedLocalSourceCount).toBeGreaterThanOrEqual(1);
  });

  /* E1-TAA-1 (supersedes "ACTIVE but never coverage"): a feed with unresolved rights is refused */
  it('a feed with unresolved rights is refused by the registry and never makes coverage', () => {
    const activation = sourceActivationFromConfig(
      config({ RSS_FEEDS_ENABLED: 'true', RSS_FEED_SOURCES: 'feed:ktpress-rw,feed:standardmedia-ke' }),
    );
    expect([...activation.activeFeedIds]).toEqual([]);
    const rwa = governedSourceCoverage(activation).find((r) => r.iso3 === 'RWA')!;
    const news = rwa.coverageDomains.find((d) => d.domain === 'NEWS_REPORTING')!;
    expect(news.activeLocalSourceCount).toBe(0);
    expect(news.rightsClearedLocalSourceCount).toBe(0);
    expect(news.state).toBe('COVERAGE_GAP');
    expect(news.state).not.toBe('COVERED_LOCAL');
  });

  it('GNews is active only with a usable key, and its rights are never CLEARED', () => {
    expect(sourceActivationFromConfig(config({ GNEWS_API_KEY: 'replace_with_your_gnews_key' })).activeInternationalIds.size).toBe(0);
    const active = sourceActivationFromConfig(config({ GNEWS_API_KEY: 'live-key-abc123' }));
    expect([...active.activeInternationalIds]).toEqual(['gnews']);
    const gnews = INTERNATIONAL_NEWS_SOURCES.find((s) => s.sourceId === 'gnews')!;
    expect(gnews.rightsState).toBe('RIGHTS_UNDER_E1_REVIEW');
    const row = governedSourceCoverage(active)[0];
    expect(row.activeInternationalSources.map((s) => s.sourceId)).toEqual(['gnews']);
    expect(row.coverageState).toBe('COVERAGE_GAP');
  });
});

describe('T1 · evidence locality — registrable domain only, never sourceName', () => {
  it('a registered Kenyan publisher host is LOCAL for KEN (subdomains included)', () => {
    expect(classifyEvidenceLocalityFor('https://www.standardmedia.co.ke/article/1', 'KEN')).toBe('LOCAL');
    expect(classifyEvidenceLocalityFor('https://news.standardmedia.co.ke/x', 'KEN')).toBe('LOCAL');
  });

  it('a registered publisher of ANOTHER country is INTERNATIONAL', () => {
    expect(classifyEvidenceLocalityFor('https://www.ktpress.rw/2026/x', 'KEN')).toBe('INTERNATIONAL');
  });

  it('an unregistered domain (a typical GNews record) is UNVERIFIED_LOCALITY, never LOCAL', () => {
    expect(classifyEvidenceLocalityFor('https://www.bbc.co.uk/news/world-africa-1', 'KEN')).toBe(
      'UNVERIFIED_LOCALITY',
    );
    expect(classifyEvidenceLocalityFor('https://kenyatimes.example.com/a', 'KEN')).toBe('UNVERIFIED_LOCALITY');
  });

  it('malformed / missing URLs are UNVERIFIED_LOCALITY', () => {
    expect(classifyEvidenceLocalityFor('not a url', 'KEN')).toBe('UNVERIFIED_LOCALITY');
    expect(classifyEvidenceLocalityFor(undefined, 'KEN')).toBe('UNVERIFIED_LOCALITY');
  });

  it('suffix-collapse guard: an unknown multi-part suffix never makes a whole namespace local', () => {
    const registry = {
      localHostsByIso3: new Map([['SAU', [registeredPublisherHost('arabnews.com.sa')]]]),
      internationalHosts: [],
    };
    expect(classifyEvidenceLocality('https://www.arabnews.com.sa/x', 'SAU', registry)).toBe('LOCAL');
    expect(classifyEvidenceLocality('https://other-site.com.sa/x', 'SAU', registry)).toBe(
      'UNVERIFIED_LOCALITY',
    );
  });

  it('every LOCAL pack host classifies LOCAL for its own country (deterministic)', () => {
    for (const pack of GLOBAL_REACH_SOURCE_PACKS) {
      for (const e of pack.entries.filter((x) => x.basis === 'LOCAL')) {
        expect([e.sourceId, classifyEvidenceLocalityFor(`https://${e.canonicalHost}/`, e.iso3)]).toEqual([
          e.sourceId,
          'LOCAL',
        ]);
      }
    }
  });
});

describe('T1 · reader disclosure', () => {
  it('Kenya served through GNews discloses the absent local coverage and the GNews rights state', () => {
    const d = countrySourceCoverageDisclosure({
      iso3: 'KEN',
      evidenceUrls: ['https://www.standardmedia.co.ke/a', 'https://www.bbc.co.uk/b', 'https://www.ktpress.rw/c'],
      contributingProviderIds: ['gnews'],
      activation: sourceActivationFromConfig(config({ GNEWS_API_KEY: 'live-key-abc123' })),
    });
    expect(d).toMatchObject({
      iso3: 'KEN',
      governed: true,
      state: 'COVERAGE_GAP',
      notice: 'LOCAL_COVERAGE_ABSENT',
      evidence: { local: 1, international: 1, unverifiedLocality: 1 },
      internationalSources: [{ sourceId: 'gnews', displayName: 'GNews', rightsState: 'RIGHTS_UNDER_E1_REVIEW' }],
    });
  });

  it('a non-governed country is still an explicit gap, flagged governed:false', () => {
    const d = countrySourceCoverageDisclosure({
      iso3: 'USA',
      evidenceUrls: [],
      contributingProviderIds: [],
      activation: NO_ACTIVATION,
    });
    expect(d).toMatchObject({ governed: false, state: 'COVERAGE_GAP', notice: 'LOCAL_COVERAGE_ABSENT' });
  });
});

describe('T1 · ZERO provider calls to render coverage state', () => {
  let fetchSpy: jest.SpyInstance;
  let httpSpy: jest.SpyInstance;
  let httpsSpy: jest.SpyInstance;
  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network forbidden'));
    httpSpy = jest.spyOn(http, 'request');
    httpsSpy = jest.spyOn(https, 'request');
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    httpSpy.mockRestore();
    httpsSpy.mockRestore();
  });

  it('accounting, classification and disclosure perform no HTTP request', () => {
    governedSourceCoverage(sourceActivationFromConfig(config({ GNEWS_API_KEY: 'k-123456', RSS_FEEDS_ENABLED: 'true', RSS_FEED_SOURCES: 'feed:ktpress-rw' })));
    countrySourceCoverageDisclosure({
      iso3: 'POL',
      evidenceUrls: ['https://wiadomosci.wp.pl/x'],
      contributingProviderIds: ['gnews'],
      activation: NO_ACTIVATION,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(httpSpy).not.toHaveBeenCalled();
    expect(httpsSpy).not.toHaveBeenCalled();
  });

  it('the country-news controller stamps coverage with exactly ONE service read and no extra call', async () => {
    const cached: CountryNewsResponse = {
      countryCode: 'KEN',
      countryName: 'Kenya',
      articles: [
        { id: 'a', title: 't', url: 'https://www.standardmedia.co.ke/a' } as never,
        { id: 'b', title: 't', url: 'https://www.reuters.com/b' } as never,
      ],
      totalResults: 2,
      providers: ['gnews'],
      dataMode: 'live',
      feedTier: 'live',
      providerDisplayName: 'GNews',
      generatedAt: '2026-10-04T00:00:00.000Z',
    };
    const service = { getCountryNews: jest.fn().mockResolvedValue(cached) };
    const controller = new CountryNewsController(
      service as never,
      { get: (k: string) => (k === 'GNEWS_API_KEY' ? 'live-key-abc123' : undefined) } as never,
    );
    const response = await controller.getCountryNews(
      { countryCode: 'KEN' } as never,
      { limit: 8, lang: 'en' } as never,
    );
    expect(service.getCountryNews).toHaveBeenCalledTimes(1);
    expect(response.sourceCoverage).toMatchObject({
      state: 'COVERAGE_GAP',
      notice: 'LOCAL_COVERAGE_ABSENT',
      evidence: { local: 1, international: 0, unverifiedLocality: 1 },
      internationalSources: [{ sourceId: 'gnews', rightsState: 'RIGHTS_UNDER_E1_REVIEW' }],
    });
    /* The service's cached object is never mutated. */
    expect(cached).not.toHaveProperty('sourceCoverage');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(httpsSpy).not.toHaveBeenCalled();
  });
});
