import {
  resolveRetainedArticleCountry,
  resolveRetainedQueryCountry,
  retainedCountryVerdict,
} from './retained-country-gate.util';
import { resolvePrimaryCountry } from '../country/country-relevance.util';

const article = (
  title: string,
  summary: string,
  extra: Partial<{ countryCode: string; sourceName: string }> = {},
) => ({ title, summary, ...extra }) as Parameters<typeof retainedCountryVerdict>[0];

const verdict = (a: Parameters<typeof retainedCountryVerdict>[0], q: string) =>
  retainedCountryVerdict(a, resolveRetainedQueryCountry(q));

describe('REV A · 1 — a contradicting country is rejected', () => {
  it('admits an article whose own country matches the query', () => {
    const v = verdict(
      article('Kenya raises fuel levy in Nairobi', 'Kenya said the Nairobi measure takes effect. Kenya expects higher revenue.'),
      'latest developments in Kenya',
    );
    expect(v.decision).toBe('admit');
    expect(v.queryCountry).toBe('KE');
    expect(v.articleCountry).toBe('KE');
  });

  it('REJECTS an article that establishes a different country', () => {
    const v = verdict(
      article('Uganda opens new rail line in Kampala', 'Uganda said the Kampala corridor will carry freight across Uganda.'),
      'latest developments in Kenya',
    );
    expect(v.decision).toBe('reject');
    expect(v.queryCountry).toBe('KE');
    expect(v.articleCountry).toBe('UG');
    expect(v.reason).toContain('contradicts');
  });

  it('FAILS CLOSED when the article establishes no country of its own', () => {
    const v = verdict(article('Markets rally on rate hopes', 'Investors welcomed the move.'), 'latest developments in Kenya');
    expect(v.decision).toBe('reject');
    expect(v.reason).toContain('failing closed');
  });

  it('applies no country constraint when the query names no country', () => {
    const v = verdict(
      article('Uganda opens new rail line in Kampala', 'Uganda said the corridor will carry freight.'),
      'semiconductor export controls',
    );
    expect(v.decision).toBe('admit');
    expect(v.queryCountry).toBeUndefined();
  });
});

describe('REV A · 1 — the persisted country is preferred over re-derivation', () => {
  it('uses article.countryCode when present', () => {
    expect(
      resolveRetainedArticleCountry(article('Untitled', 'No geography in this text at all.', { countryCode: 'rw' })),
    ).toBe('RW');
  });

  it('a persisted country that contradicts the query is rejected', () => {
    const v = verdict(
      article('Kenya raises fuel levy in Nairobi', 'Kenya said the measure takes effect. Kenya expects revenue.', { countryCode: 'UG' }),
      'latest developments in Kenya',
    );
    expect(v.decision).toBe('reject');
    expect(v.articleCountry).toBe('UG');
  });

  it('falls back to the article text when nothing is persisted', () => {
    expect(
      resolveRetainedArticleCountry(article('Uganda opens new rail line in Kampala', 'Uganda said the Kampala corridor will carry freight across Uganda.')),
    ).toBe('UG');
  });
});

describe('REV A · 1 — publisher country must NOT decide event country', () => {
  it('the verdict is identical whatever the outlet is called', () => {
    const base = ['Kenya raises fuel levy in Nairobi', 'Kenya said the Nairobi measure takes effect. Kenya expects higher revenue.'] as const;
    const a = verdict(article(base[0], base[1], { sourceName: 'The Guardian (London)' }), 'latest developments in Kenya');
    const b = verdict(article(base[0], base[1], { sourceName: 'Nation Media (Nairobi)' }), 'latest developments in Kenya');
    const c = verdict(article(base[0], base[1]), 'latest developments in Kenya');
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(a.decision).toBe('admit');
  });

  it('a Ugandan outlet reporting on Kenya is still a Kenyan story', () => {
    const v = verdict(
      article('Kenya raises fuel levy in Nairobi', 'Kenya said the Nairobi measure takes effect. Kenya expects higher revenue.', { sourceName: 'Daily Monitor Kampala' }),
      'latest developments in Kenya',
    );
    expect(v.decision).toBe('admit');
    expect(v.articleCountry).toBe('KE');
  });
});

describe('REV A · 1 — no retrieval-context geography is promoted into the article', () => {
  it('the article object is neither mutated nor returned', () => {
    const a = article('Markets rally', 'No geography here.');
    const before = JSON.stringify(a);
    const v = verdict(a, 'latest developments in Kenya');
    expect(JSON.stringify(a)).toBe(before);
    expect(Object.values(v)).not.toContain(a);
  });

  it('a rejected article carries no queryCountry back onto itself', () => {
    const a = article('Markets rally', 'No geography here.');
    verdict(a, 'latest developments in Kenya');
    expect((a as { countryCode?: string }).countryCode).toBeUndefined();
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 * THE TWO CONGOS — THE AUTHORITY GAP IS CLOSED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * G REV A recorded these as BLOCKED, and was right to. The gate was sound; the
 * shared authority underneath it could not separate the two Congos:
 *
 *   resolvePrimaryCountry('eastern Democratic Republic of Congo')  ->  CG
 *
 * G's diagnosis named both causes exactly. `scoreCountryRelevance` matched
 * country NAMES and never consulted the alias table, so the phrase scored for
 * CG on the bare embedded token "Congo"; and `resolveCountryByAnyIdentifier`
 * did consult aliases but only as an exact whole-string identifier, and had no
 * key for the spelling without "the" — which is the spelling the live Alpha
 * query actually carried.
 *
 * ALPHA RESILIENCE 1 closed both, in the shared authority rather than here:
 *
 *   1. `'democratic republic of congo' -> COD` added beside the existing
 *      `'democratic republic of the congo'` entry, in the one alias table.
 *   2. `country-relevance.util.ts` now reads that table. Multi-word aliases
 *      count as evidence for their country, and — by the SAME derived
 *      longest-phrase rule that already stops Sudan winning South Sudan
 *      articles — a longer phrase belonging to a different country suppresses
 *      a shorter embedded country name.
 *
 * A country never suppresses itself, which is why 'congo brazzaville' and
 * 'republic of the congo' (both COG) leave CG standing while 'democratic
 * republic of congo' and 'congo kinshasa' (both COD) do not.
 *
 * These tests are therefore rewritten from "record the gap" to the CTO's
 * required behaviour. The gate itself is UNCHANGED — it was never the defect.
 */
describe('ALPHA RESILIENCE 1 · the two Congos are separated', () => {
  const DRC_QUERY = 'eastern Democratic Republic of Congo';

  it('the DRC query resolves to CD, not CG', () => {
    expect(resolveRetainedQueryCountry(DRC_QUERY)).toBe('CD');
  });

  it('every accepted DRC spelling resolves to CD', () => {
    for (const spelling of [
      'eastern Democratic Republic of Congo',
      'Democratic Republic of the Congo',
      'DR Congo',
      'Congo Kinshasa',
    ]) {
      expect(resolveRetainedQueryCountry(spelling)).toBe('CD');
    }
  });

  it('the two Republic of the Congo spellings still resolve to CG', () => {
    /*
      THE OTHER HALF OF THE RULE, AND THE ONE A CARELESS FIX BREAKS. Making the
      DRC win everywhere would be easy and wrong: Brazzaville is a real country
      and 'republic of the congo' is its real name.
    */
    for (const spelling of ['Republic of the Congo', 'Congo Brazzaville']) {
      expect(resolveRetainedQueryCountry(spelling)).toBe('CG');
    }
  });

  it('a DRC query REJECTS a Republic of the Congo article', () => {
    const brazzaville = article(
      'Republic of the Congo opens eastern rail link',
      'Brazzaville said the eastern corridor will carry freight. Congo expects higher volumes.',
    );

    expect(resolveRetainedArticleCountry(brazzaville)).toBe('CG');
    expect(verdict(brazzaville, DRC_QUERY).decision).toBe('reject');
  });

  it('a DRC query ADMITS a persisted CD article', () => {
    const drc = article(
      'Fighting intensifies in eastern Congo as M23 advances on Goma',
      'Clashes displaced thousands across eastern Congo this week.',
      { countryCode: 'CD' },
    );

    const outcome = verdict(drc, DRC_QUERY);

    expect(outcome.articleCountry).toBe('CD');
    expect(outcome.decision).toBe('admit');
  });
});
