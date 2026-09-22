import { SecurityReadService } from './security-read.service';
import { admitSecurityPublicContent } from './security-public-content';
import { SECURITY_ABSENCE_REACHABLE_AT_ALPHA } from '@globalnews-ai/shared';
describe('R2 public read boundary', () => {
  const service = new SecurityReadService();
  test('keeps accepted Alpha reachability unchanged', () =>
    expect(SECURITY_ABSENCE_REACHABLE_AT_ALPHA.COVERAGE_GAP).toBe(false));
  test('does not acquire any injected producer, repository or corpus reader', () =>
    expect(Reflect.getMetadata('design:paramtypes', SecurityReadService) ?? []).toHaveLength(0));
  test.each(['RW', 'KE', 'PL'])('stays NOT_ASSESSED for %s', async (countryCode) => {
    const response = await service.readForGeography({ countryCode });
    expect(response.absence).toBe('NOT_ASSESSED');
    expect(response.observations).toEqual([]);
    expect(response.coverage).toHaveLength(5);
    expect(response.coverage.every((c) => c.finding === null)).toBe(true);
  });
  test('never presents no material change', async () =>
    expect((await service.readForGeography({ countryCode: 'RW' })).changeState).toBeNull());
  test.each([
    { headline: 'John Example was arrested for murder' },
    { summary: 'Jane Example is suspected of an attack' },
    { sourceUrl: 'https://example.test/allegation/john-example' },
    { sourceName: 'Jane Example' },
    { headline: 'Ordinary-looking reporting' },
    {},
    null,
  ])('withholds unreviewed free text and source identifiers %#', (candidate) =>
    expect(admitSecurityPublicContent(candidate).permitted).toBe(false),
  );
  test('ignores untrusted display names', async () =>
    expect(
      JSON.stringify(
        await service.readForGeography({ countryCode: 'RW', countryName: 'John Example' }),
      ),
    ).not.toContain('John Example'));
});
