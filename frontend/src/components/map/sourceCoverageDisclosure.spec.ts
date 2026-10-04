import { readFileSync } from 'fs';
import { join } from 'path';
import type { CountryNewsResponse, SourceCoverageDisclosure } from '@globalnews-ai/shared';
import { resolveSourceCoverageNotice } from './countryPanelText';
import { countryReadPresentationFrom } from '@/lib/map/retrieval/countryReadPresentation';
import { en } from '@/lib/i18n/dictionaries/en';
import { pl } from '@/lib/i18n/dictionaries/pl';

/**
 * T1 COVERAGE TRUTHFULNESS — the reader-facing disclosure of absent local
 * coverage. The fact is computed by the backend from registries and arrives on
 * the country read the reader already asked for; these tests hold that the UI
 * renders it truthfully and that rendering it issues no request of its own.
 */

const disclosure = (over: Partial<SourceCoverageDisclosure> = {}): SourceCoverageDisclosure => ({
  iso3: 'KEN',
  governed: true,
  state: 'COVERAGE_GAP',
  domains: [
    { domain: 'NEWS_REPORTING', state: 'COVERAGE_GAP' },
    { domain: 'OFFICIAL_PUBLIC_DATA', state: 'COVERAGE_GAP' },
  ],
  evidence: { local: 0, international: 1, unverifiedLocality: 4 },
  internationalSources: [{ sourceId: 'gnews', displayName: 'GNews', rightsState: 'RIGHTS_UNDER_E1_REVIEW' }],
  notice: 'LOCAL_COVERAGE_ABSENT',
  ...over,
});

const response = (sourceCoverage?: SourceCoverageDisclosure): CountryNewsResponse =>
  ({
    countryCode: 'KEN',
    countryName: 'Kenya',
    articles: [],
    providerDisplayName: 'GNews',
    isStoredData: false,
    ...(sourceCoverage ? { sourceCoverage } : {}),
  }) as unknown as CountryNewsResponse;

describe('T1 · country shelf coverage notice', () => {
  it('an absent local coverage renders the gap title, body and the local share of evidence', () => {
    const notice = resolveSourceCoverageNotice(response(disclosure()), 'en');
    expect(notice).toEqual({
      title: en.map.sourceCoverage.absentTitle,
      body: en.map.sourceCoverage.absentBody,
      localEvidence: `${en.map.sourceCoverage.localEvidencePrefix} 0 ${en.map.sourceCoverage.ofSeparator} 5`,
    });
    expect(notice?.body).toMatch(/not local coverage/);
  });

  it('Polish renders the Polish strings', () => {
    const notice = resolveSourceCoverageNotice(response(disclosure()), 'pl');
    expect(notice?.title).toBe(pl.map.sourceCoverage.absentTitle);
    expect(notice?.body).toBe(pl.map.sourceCoverage.absentBody);
  });

  it('an unverified state renders the unverified wording; no evidence means no evidence line', () => {
    const notice = resolveSourceCoverageNotice(
      response(
        disclosure({
          state: 'UNVERIFIED',
          notice: 'LOCAL_COVERAGE_UNVERIFIED',
          evidence: { local: 0, international: 0, unverifiedLocality: 0 },
        }),
      ),
      'en',
    );
    expect(notice?.title).toBe(en.map.sourceCoverage.unverifiedTitle);
    expect(notice?.localEvidence).toBeNull();
  });

  it('COVERED_LOCAL or a response without the fact renders nothing (never invented)', () => {
    expect(
      resolveSourceCoverageNotice(response(disclosure({ state: 'COVERED_LOCAL', notice: null })), 'en'),
    ).toBeNull();
    expect(resolveSourceCoverageNotice(response(undefined), 'en')).toBeNull();
  });
});

describe('T1 · selected-country card carries the notice in both READY states', () => {
  const base = { period: 'NOW' as never, language: 'en' as const, now: Date.now(), onLoad: () => undefined };

  it('READY_NO_COVERAGE and READY both carry sourceCoverageNotice', () => {
    expect(
      countryReadPresentationFrom({ ...base, state: 'READY_NO_COVERAGE', response: response(disclosure()) })
        .sourceCoverageNotice,
    ).toBe('LOCAL_COVERAGE_ABSENT');
    expect(
      countryReadPresentationFrom({ ...base, state: 'READY', response: response(disclosure()) })
        .sourceCoverageNotice,
    ).toBe('LOCAL_COVERAGE_ABSENT');
  });

  it('no fact, or COVERED_LOCAL, carries no notice', () => {
    expect(
      countryReadPresentationFrom({ ...base, state: 'READY', response: response(undefined) }),
    ).not.toHaveProperty('sourceCoverageNotice');
    expect(
      countryReadPresentationFrom({
        ...base,
        state: 'READY',
        response: response(disclosure({ state: 'COVERED_LOCAL', notice: null })),
      }),
    ).not.toHaveProperty('sourceCoverageNotice');
  });

  it('en and pl both define one sentence per non-covered notice', () => {
    for (const dict of [en, pl]) {
      const labels = dict.map.spatial.card.countryRead as Record<string, string>;
      expect(labels.coverageAbsent?.length ?? 0).toBeGreaterThan(0);
      expect(labels.coverageUnverified?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('T1 · rendering coverage state performs no request', () => {
  const executable = (s: string): string =>
    s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const files: [string, string][] = [
    ['countryPanelText.ts', join(__dirname, 'countryPanelText.ts')],
    [
      'countryReadPresentation.ts',
      join(__dirname, '..', '..', 'lib', 'map', 'retrieval', 'countryReadPresentation.ts'),
    ],
  ];

  it.each(files)('%s issues no fetch / API call', (_name, file) => {
    const src = executable(readFileSync(file, 'utf-8'));
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/from '@\/lib\/api\//);
  });

  it('the pure resolvers never call fetch at runtime', () => {
    const original = global.fetch;
    const spy = jest.fn();
    global.fetch = spy as never;
    try {
      resolveSourceCoverageNotice(response(disclosure()), 'en');
      countryReadPresentationFrom({
        period: 'NOW' as never,
        language: 'en',
        now: Date.now(),
        onLoad: () => undefined,
        state: 'READY',
        response: response(disclosure()),
      });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      global.fetch = original;
    }
  });
});

describe('T1 · both map surfaces render the governed sentence', () => {
  const read = (...p: string[]): string => readFileSync(join(__dirname, ...p), 'utf-8');

  it('desktop card and phone sheet both render the notice from countryRead (no new prop source)', () => {
    expect(read('shell', 'GlobalMapShell.tsx')).toContain('sourceCoverageNotice={countryRead?.sourceCoverageNotice}');
    expect(read('shell', 'EvidenceSelectionCard.tsx')).toContain('data-gn="country-read-source-coverage"');
    const mobile = read('mobile', 'MobileSpatialShell.tsx');
    expect(mobile).toContain('data-gn="mobile-country-read-source-coverage"');
    expect(mobile).toContain('countryRead.sourceCoverageNotice');
  });
});
