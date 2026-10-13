import { routeAskR2 } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';

/*
  EA-GEO-R1 G-6 — "in / over / during the past week" is the 7 days before the request, applied on
  the publication basis with the reader's own words; a calendar "this week" / "last week" is unchanged.
*/
const route = (q: string): any =>
  routeAskR2(
    { originalQuestion: q, sourceLanguage: 'en', normalizationLanguage: 'en', displayLanguage: 'en', origin: 'ASK' } as never,
    { requestInstant: '2026-10-12T12:00:00Z' } as never,
    { specialistRegistry: specialistRegistryFixture } as never,
  );

describe('G-6 · the past week is applied, never silently dropped', () => {
  it.each([
    'What changed in Rwanda in the past week?',
    'What changed in Rwanda over the past week?',
    'What changed in Rwanda during the past week?',
    'What happened in Kenya the past week?',
  ])('%s → a 168 h publication window in the reader\'s words', (q) => {
    expect(route(q).reportingWindow).toMatchObject({
      hours: 168,
      basis: 'PUBLICATION_TIME',
      from: '2026-10-05T12:00:00.000Z',
      to: '2026-10-12T12:00:00.000Z',
    });
    expect(route(q).readerStatedPeriod).toMatch(/past week/i);
  });

  it('a calendar "this week" is still offered for broadening, never applied', () => {
    const r = route('What changed in Rwanda this week?');
    expect(r.reportingWindow).toBeNull();
    expect(r.plan.constraints.find((c: { axis: string }) => c.axis === 'TIME')).toMatchObject({ carried: false });
  });

  it('"last week" is not re-read as the past 7 days', () => {
    expect(route('What changed in Rwanda last week?').reportingWindow?.hours).not.toBe(168);
  });

  it('"the last 7 days" keeps its existing window', () => {
    expect(route('What changed in Rwanda over the last 7 days?').reportingWindow).toMatchObject({ hours: 168 });
  });
});
