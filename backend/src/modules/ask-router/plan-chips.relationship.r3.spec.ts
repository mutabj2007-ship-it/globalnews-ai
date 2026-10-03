import { withRelationshipScope, type PlanChips } from './plan-chips';
import { routeAskR2 } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';

/**
 * CTO R3 LIVE DEFECT L-4 — a relationship-scoped answer shows BOTH sides in its scope chips, from
 * the route's one authority; a non-relationship answer is untouched.
 */
const geo = (value: string, source = 'TYPED_GEOGRAPHY') =>
  ({ kind: 'GEOGRAPHY', value, source, applied: true }) as const;
const scoped = (...chips: Array<Record<string, unknown>>): PlanChips =>
  ({ kind: 'SCOPED', chips }) as unknown as PlanChips;
const shown = (c: PlanChips) =>
  c.kind === 'SCOPED' ? c.chips.map((x) => `${x.kind}:${x.value}:${x.source}`) : [c.kind];

describe('R3 L-4 — withRelationshipScope', () => {
  it('RWA / TZA: both members, then the relation; the single typed place is replaced, not duplicated', () => {
    expect(
      shown(
        withRelationshipScope(scoped(geo('RWA')), {
          countries: ['RWA', 'TZA'],
          relations: ['BORDER', 'TRADE'],
        }),
      ),
    ).toEqual([
      'GEOGRAPHY:RWA:RELATIONSHIP',
      'GEOGRAPHY:TZA:RELATIONSHIP',
      'TOPIC:BORDER:RELATIONSHIP',
      'TOPIC:TRADE:RELATIONSHIP',
    ]);
  });

  it('KEN / UGA, and the reverse wording order keeps the order the reader named', () => {
    expect(
      shown(
        withRelationshipScope(scoped(geo('UGA')), {
          countries: ['UGA', 'KEN'],
          relations: ['TRADE'],
        }),
      ),
    ).toEqual([
      'GEOGRAPHY:UGA:RELATIONSHIP',
      'GEOGRAPHY:KEN:RELATIONSHIP',
      'TOPIC:TRADE:RELATIONSHIP',
    ]);
  });

  it('an inherited Map / story place never becomes a third side; time / domain chips are kept', () => {
    const chips = scoped(geo('RWA'), geo('BDI', 'MAP_GEOGRAPHY_CONTEXT'), {
      kind: 'TIME',
      value: 'this week',
      source: 'REPORTING_WINDOW',
      applied: true,
    });
    expect(
      shown(withRelationshipScope(chips, { countries: ['RWA', 'TZA'], relations: ['GENERAL'] })),
    ).toEqual([
      'GEOGRAPHY:RWA:RELATIONSHIP',
      'GEOGRAPHY:TZA:RELATIONSHIP',
      'TIME:this week:REPORTING_WINDOW',
    ]);
  });

  it('a one-country, non-relationship answer is unchanged', () => {
    const chips = scoped(geo('RWA'));
    expect(withRelationshipScope(chips, null)).toBe(chips);
  });

  it('the live wording routes with a relationship whose chips name both countries', () => {
    const route = routeAskR2(
      {
        originalQuestion:
          'What is happening at the border linking Rwanda and Tanzania regarding commercial services?',
        sourceLanguage: 'en',
        normalizationLanguage: 'en',
        displayLanguage: 'en',
        origin: 'ASK',
      },
      { requestInstant: '2026-10-03T08:00:00Z' },
      { specialistRegistry: specialistRegistryFixture },
    );
    expect(shown(withRelationshipScope(scoped(geo('RWA')), route.relationship))).toEqual([
      'GEOGRAPHY:RWA:RELATIONSHIP',
      'GEOGRAPHY:TZA:RELATIONSHIP',
      'TOPIC:BORDER:RELATIONSHIP',
      'TOPIC:TRADE:RELATIONSHIP',
    ]);
  });
});
