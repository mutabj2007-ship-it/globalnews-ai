import { routeAskR2, type AskRouteContext } from './ask-r2-route';
import { planChips } from './plan-chips';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE F — D25 05 context-chip rules, on real routes.
 */
const deps = { specialistRegistry: specialistRegistryFixture };
function chipsFor(q: string, lg: 'en' | 'pl' = 'en', ctx: AskRouteContext = {}) {
  const r = routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lg,
      normalizationLanguage: lg,
      displayLanguage: lg,
      origin: 'ASK',
    },
    ctx,
    deps,
  );
  const spans: Record<string, string> = {};
  if (r.outcome.status !== 'NOT_READ') {
    for (const g of r.outcome.reading.geography)
      if (g.matchedText) spans[g.value] ??= g.matchedText;
  }
  return planChips(r.envelope, r.plan, spans);
}
const brief = (c: ReturnType<typeof chipsFor>) =>
  c.kind === 'SCOPED'
    ? c.chips.map((x) => `${x.kind}:${x.value}${x.applied ? '' : '(kept)'}`)
    : c.kind;

describe('D25 05 — chips from the effective server plan only', () => {
  it('rule 3: order = order asked — "Entertainment news in Rwanda this week"', () => {
    expect(brief(chipsFor('Entertainment news in Rwanda this week'))).toEqual([
      'TOPIC:entertainment(kept)',
      'GEOGRAPHY:RWA',
      'TIME:this week(kept)',
    ]);
  });

  it('rule 5: a scope the plan cannot carry STAYS, marked kept-as-asked (not dropped)', () => {
    const c = chipsFor('What were the results in 2026?');
    expect(brief(c)).toEqual(['TIME:2026(kept)']);
  });

  it('rule 2: a Map selection is a chip only when the plan scoped the answer by it', () => {
    expect(brief(chipsFor('What is happening?', 'en', { mapContextCountry: 'RWA' }))).toEqual([
      'GEOGRAPHY:RWA',
    ]);
    /* suppressed by QQ-10 → not the scope → no chip */
    expect(chipsFor('What is NATO?', 'en', { mapContextCountry: 'POL' })).toEqual({ kind: 'NONE' });
    /* outranked by a typed place → only the typed place is a chip */
    expect(
      brief(chipsFor('What is happening in Kenya?', 'en', { mapContextCountry: 'POL' })),
    ).toEqual(['GEOGRAPHY:KEN']);
  });

  it('rule 6: no scope → NONE; clarification → PENDING', () => {
    expect(chipsFor('What is inflation?')).toEqual({ kind: 'NONE' });
    expect(chipsFor('Compare them.')).toEqual({ kind: 'PENDING' });
  });

  it('PL twins produce the same chip kinds and codes', () => {
    expect(brief(chipsFor('Co dzieje się w Rwandzie?', 'pl'))).toEqual(['GEOGRAPHY:RWA']);
    expect(brief(chipsFor('Jakie są zagrożenia bezpieczeństwa w regionie?', 'pl'))).toEqual([
      'DOMAIN:security',
      'DOMAIN:regional',
    ]);
  });
});
