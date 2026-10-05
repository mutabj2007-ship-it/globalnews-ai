import { readFileSync } from 'fs';
import { join } from 'path';
import {
  COVERAGE_CHECK_OUTPUT,
  buildCoverageCheck,
  maximalActivation,
  renderCoverageCheck,
} from './coverage-check';

/**
 * T1 — the machine-readable coverage check is deterministic, computed by the one
 * canonical accounting, and the committed artefact matches the registries.
 */
describe('T1 · coverage check (whole-product matrix input)', () => {
  const committed = readFileSync(join(__dirname, '..', '..', '..', '..', COVERAGE_CHECK_OUTPUT), 'utf-8');

  it('the committed coverage-check.json is exactly what the registries produce (regenerate on drift)', () => {
    expect(committed).toBe(renderCoverageCheck());
  });

  it('is deterministic: two builds are identical and carry no clock', () => {
    expect(renderCoverageCheck()).toBe(renderCoverageCheck());
    expect(committed).not.toMatch(/"(generatedAt|timestamp|checkedAt)"/);
  });

  it('covers the three priority regions with every governed member, Poland as deep reference', () => {
    const check = buildCoverageCheck();
    expect(check.regions.map((r) => r.label)).toEqual(['East Africa', 'EU-27', 'Middle East']);
    for (const region of check.regions) expect(region.countries).toHaveLength(region.memberCount);
    expect(check.regions.find((r) => r.label === 'EU-27')?.memberCount).toBe(27);
    const pol = check.regions.flatMap((r) => r.countries).find((c) => c.iso3 === 'POL');
    expect(pol?.deepReference).toBe(true);
    expect(pol?.localSources?.length).toBeGreaterThan(0);
    expect(pol?.domains.map((d) => d.domain)).toEqual(['NEWS_REPORTING', 'OFFICIAL_PUBLIC_DATA']);
  });

  it('GNews is reported with an explicit, non-accepted rights state and never counts as local', () => {
    const check = buildCoverageCheck();
    expect(check.gnews.rightsState).toBe('RIGHTS_UNDER_E1_REVIEW');
    expect(check.gnews.countsAsLocalCoverage).toBe(false);
    for (const country of check.regions.flatMap((r) => r.countries)) {
      for (const d of country.domains) expect(d.rightsClearedLocalSources).toBe(0);
      expect(country.coverageState).toBe('COVERAGE_GAP');
    }
  });

  it('no activation profile can turn a gap into local coverage today (no source is rights-cleared)', () => {
    const maximal = buildCoverageCheck(maximalActivation());
    expect(maximal.totals.coverageStates.COVERED_LOCAL).toBe(0);
    expect(maximal.totals.coverageStates.UNVERIFIED).toBe(0);
    expect(maximal.feedRightsGate.refused.map((r) => r.sourceId).sort()).toEqual([
      'feed:standardmedia-ke',
      'feed:wp-pl',
    ]);
  });

  it('building the check performs no HTTP request', () => {
    const original = global.fetch;
    const spy = jest.fn();
    global.fetch = spy as never;
    try {
      buildCoverageCheck();
      buildCoverageCheck(maximalActivation());
      expect(spy).not.toHaveBeenCalled();
    } finally {
      global.fetch = original;
    }
  });
});
