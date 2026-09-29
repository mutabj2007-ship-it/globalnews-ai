import type { NewsArticle } from '@globalnews-ai/shared';
import { routeAskR2 } from '../ask-router/ask-r2-route';
import { landedSpecialistRegistryPort } from '../ask-router/specialist-registry.port';
import {
  CORROBORATION_MAX_AGE_DAYS,
  corroborateCurrentStatus,
  corroborationTargetOf,
  extractOfficeHolder,
  extractPolicyRate,
  freshnessWindowDays,
  type CorroborationTarget,
} from './current-status-corroboration';

/**
 * CURRENT STATUS CORROBORATION R1 — the deterministic corroboration seam, unit level.
 * A fixed clock; no network, no model, no provider. Every fixture is text a reader could
 * find in real reporting, and every near miss is one the seam must refuse.
 */
const NOW = new Date('2026-09-29T12:00:00.000Z');
const hoursAgo = (h: number): string => new Date(NOW.getTime() - h * 3_600_000).toISOString();

let seq = 0;
const report = (
  domain: string,
  title: string,
  summary: string,
  extra: Partial<NewsArticle> = {},
): NewsArticle =>
  ({
    id: `a${(seq += 1)}`,
    title,
    summary,
    url: `https://www.${domain}/news/${seq}`,
    sourceId: 'gnews',
    sourceName: domain.split('.')[0],
    category: 'world',
    sourcesCount: 1,
    publishedAt: hoursAgo(6),
    publishedAtBasis: 'publisher',
    ...extra,
  }) as NewsArticle;

const PRESIDENT_POL: CorroborationTarget = {
  family: 'OFFICE_HOLDER',
  office: 'PRESIDENT',
  countryIso3: 'POL',
};
const NBP_RATE: CorroborationTarget = { family: 'POLICY_RATE', institutionId: 'PL_NBP' };
const run = (
  target: CorroborationTarget | null,
  articles: NewsArticle[],
  period: string | null = null,
) =>
  corroborateCurrentStatus({
    target,
    articles,
    now: NOW,
    statedPeriod: period,
    minIndependentReports: 2,
  });

describe('OFFICE_HOLDER extraction — bounded EN/PL surface patterns', () => {
  it.each([
    ['Polish President Karol Nawrocki vetoes the budget bill', ''],
    ["Poland's President Karol Nawrocki meets NATO chief", ''],
    ['Talks in Warsaw', 'The President of Poland, Karol Nawrocki, said the talks would continue.'],
    ['Talks in Warsaw', 'President Karol Nawrocki of Poland arrived on Monday.'],
    ['Talks in Warsaw', "Karol Nawrocki, Poland's president, arrived on Monday."],
    ['Prezydent Polski Karol Nawrocki zawetował ustawę', ''],
    ['Rozmowy w Warszawie', 'Karol Nawrocki, prezydent RP, przyjechał w poniedziałek.'],
  ])('%s %s → karol nawrocki', (title, summary) => {
    expect(extractOfficeHolder({ title, summary }, 'PRESIDENT', 'POL')).toEqual({
      family: 'OFFICE_HOLDER',
      key: 'karol nawrocki',
      value: 'Karol Nawrocki',
    });
  });

  it('a title-case headline verb is never part of the name', () => {
    expect(
      extractOfficeHolder(
        { title: 'Polish President Karol Nawrocki Says No', summary: '' },
        'PRESIDENT',
        'POL',
      )?.key,
    ).toBe('karol nawrocki');
    expect(
      extractOfficeHolder(
        { title: 'Polish President Says No To Deal', summary: '' },
        'PRESIDENT',
        'POL',
      ),
    ).toBeNull();
  });

  it.each([
    ['former Polish President Aleksander Kwaśniewski spoke', ''],
    ['były prezydent Polski Lech Wałęsa', ''],
    ['Polish president-elect Karol Nawrocki', ''],
    ['President Nawrocki said', ''], // one token: not a full name
    ['Kenyan President William Ruto visits Warsaw', ''], // another country
    ['Polish Prime Minister Donald Tusk said', ''], // another office
  ])('not the current holder of THIS office: %s', (title, summary) => {
    expect(extractOfficeHolder({ title, summary }, 'PRESIDENT', 'POL')).toBeNull();
  });

  it('two different people named as the office holder in one report is ambiguous → nothing', () => {
    expect(
      extractOfficeHolder(
        {
          title: 'Polish President Karol Nawrocki',
          summary: 'Polish President Andrzej Duda said.',
        },
        'PRESIDENT',
        'POL',
      ),
    ).toBeNull();
  });

  it('another supported office: prime minister (EN) / premier (PL)', () => {
    expect(
      extractOfficeHolder(
        { title: 'Polish Prime Minister Donald Tusk said', summary: '' },
        'PRIME_MINISTER',
        'POL',
      )?.key,
    ).toBe('donald tusk');
    expect(
      extractOfficeHolder(
        { title: 'Premier RP Donald Tusk powiedział', summary: '' },
        'PRIME_MINISTER',
        'POL',
      )?.key,
    ).toBe('donald tusk');
  });
});

describe('POLICY_RATE extraction — institution + rate, canonical basis points', () => {
  it.each([
    ["Poland's central bank holds interest rates at 5.75% as inflation eases to 4.1%", '', 575],
    ['NBP cuts rates by 25 basis points to 5.50%', '', 550],
    ['Decision day', 'The National Bank of Poland kept its reference rate at 5.75 percent.', 575],
    ['Stopa referencyjna NBP wynosi 5,75 proc.', '', 575],
    ['RPP obniżyła stopy procentowe o 0,25 pkt proc. do 5,50 proc.', '', 550],
  ])('%s %s → %d bps', (title, summary, bps) => {
    expect(extractPolicyRate({ title, summary }, 'PL_NBP')).toEqual({
      family: 'POLICY_RATE',
      key: `bps:${bps}`,
      value: bps,
    });
  });

  it.each([
    ['NBP governor speaks on inflation of 4.1%', ''], // no rate subject
    ['Polish banks raise mortgage interest rates to 8%', ''], // no institution
    ['NBP keeps interest rates unchanged', ''], // no number
    ['NBP publishes exchange rates', 'The zloty rose 1.2%.'], // not the policy rate
  ])('no extractable rate: %s', (title, summary) => {
    expect(extractPolicyRate({ title, summary }, 'PL_NBP')).toBeNull();
  });

  it('a report stating two different rates is ambiguous → nothing', () => {
    expect(
      extractPolicyRate(
        {
          title: 'NBP holds reference rate at 5.75%',
          summary: 'Earlier, the NBP reference rate was 6.75% before the cuts.',
        },
        'PL_NBP',
      ),
    ).toBeNull();
  });
});

describe('corroboration — independence, freshness, same fact', () => {
  const same = () => [
    report('reuters.com', 'Polish President Karol Nawrocki vetoes budget bill', 'x', {
      publishedAt: hoursAgo(10),
    }),
    report('notesfrompoland.com', "Poland's President Karol Nawrocki signs defence law", 'y', {
      publishedAt: hoursAgo(3),
    }),
  ];

  it('two fresh different-domain reports stating the same office-holder → corroborated', () => {
    const articles = same();
    const r = run(PRESIDENT_POL, articles);
    expect(r).toMatchObject({
      corroborated: true,
      reason: 'CORROBORATED',
      family: 'OFFICE_HOLDER',
      qualifyingReports: 2,
      fact: { key: 'karol nawrocki', value: 'Karol Nawrocki' },
    });
    /* as-of = the FRESHEST corroborating report, not "now" and not model time */
    expect(r.asOf).toBe(hoursAgo(3));
    expect(r.articleIds).toEqual([articles[1]!.id, articles[0]!.id]);
  });

  it('EN and PL reports corroborate each other (one canonical fact)', () => {
    const r = run(PRESIDENT_POL, [
      report('reuters.com', 'Polish President Karol Nawrocki vetoes budget bill', ''),
      report('wp.pl', 'Prezydent Polski Karol Nawrocki zawetował budżet', ''),
    ]);
    expect(r.corroborated).toBe(true);
  });

  it('two fresh different-domain reports stating DIFFERENT office-holders → conflict', () => {
    const r = run(PRESIDENT_POL, [
      report('reuters.com', 'Polish President Karol Nawrocki vetoes budget bill', ''),
      report('bbc.co.uk', 'Polish President Andrzej Duda signs law', ''),
    ]);
    expect(r).toMatchObject({
      corroborated: false,
      reason: 'CONFLICTING_FACTS',
      qualifyingReports: 0,
    });
  });

  it('the same domain twice is one publisher → not corroborated', () => {
    const r = run(PRESIDENT_POL, [
      report('reuters.com', 'Polish President Karol Nawrocki vetoes budget bill', ''),
      report('reuters.com', "Poland's President Karol Nawrocki signs defence law", '', {
        url: 'https://uk.reuters.com/world/2',
        sourceName: 'Reuters UK',
      }),
    ]);
    expect(r).toMatchObject({
      corroborated: false,
      reason: 'INSUFFICIENT_INDEPENDENT_REPORTS',
      qualifyingReports: 1,
    });
  });

  it('the same source identity on two domains is one publisher → not corroborated', () => {
    const r = run(PRESIDENT_POL, [
      report('reuters.com', 'Polish President Karol Nawrocki vetoes budget bill', '', {
        sourceName: 'Reuters',
      }),
      report('reutersagency.com', "Poland's President Karol Nawrocki signs defence law", '', {
        sourceName: 'Reuters',
      }),
    ]);
    expect(r.corroborated).toBe(false);
  });

  it('duplicate-like cluster copies (syndicated text) → not corroborated', () => {
    const title = 'Polish President Karol Nawrocki vetoes the 2027 budget bill in Warsaw';
    const r = run(PRESIDENT_POL, [
      report('abcnews.com', title, '', { publishedAt: hoursAgo(5) }),
      report('usnews.com', title, '', { publishedAt: hoursAgo(4) }),
    ]);
    expect(r).toMatchObject({
      corroborated: false,
      reason: 'INSUFFICIENT_INDEPENDENT_REPORTS',
      qualifyingReports: 1,
    });
  });

  it('one fresh + one stale (older than 7 days) → not corroborated', () => {
    const r = run(PRESIDENT_POL, [
      report('reuters.com', 'Polish President Karol Nawrocki vetoes budget bill', ''),
      report('notesfrompoland.com', "Poland's President Karol Nawrocki signs law", '', {
        publishedAt: hoursAgo(24 * CORROBORATION_MAX_AGE_DAYS + 1),
      }),
    ]);
    expect(r).toMatchObject({ corroborated: false, qualifyingReports: 1 });
  });

  it('untrustworthy timestamps never qualify: observed basis, unparseable, future', () => {
    for (const extra of [
      { publishedAtBasis: 'observed' as const },
      { publishedAtBasis: undefined },
      { publishedAt: 'yesterday' },
      { publishedAt: new Date(NOW.getTime() + 3_600_000).toISOString() },
    ]) {
      const r = run(PRESIDENT_POL, [
        report('reuters.com', 'Polish President Karol Nawrocki vetoes budget bill', ''),
        report('notesfrompoland.com', "Poland's President Karol Nawrocki signs law", '', extra),
      ]);
      expect(r.corroborated).toBe(false);
    }
  });

  it('a stricter stated period is applied; an unrecognised one is never guessed', () => {
    const articles = same();
    articles[0]!.publishedAt = hoursAgo(30);
    expect(run(PRESIDENT_POL, articles, 'today').corroborated).toBe(false);
    expect(run(PRESIDENT_POL, articles, 'this week').corroborated).toBe(true);
    expect(run(PRESIDENT_POL, same(), 'in the spring').reason).toBe('PERIOD_UNESTABLISHED');
    expect(freshnessWindowDays(null)).toBe(7);
    expect(freshnessWindowDays('dzisiaj')).toBe(1);
  });

  it('two fresh matching policy-rate reports (EN + PL) → corroborated, 575 bps', () => {
    const r = run(NBP_RATE, [
      report('reuters.com', "Poland's central bank holds interest rates at 5.75%", ''),
      report('money.pl', 'Stopa referencyjna NBP wynosi 5,75 proc.', ''),
    ]);
    expect(r).toMatchObject({
      corroborated: true,
      family: 'POLICY_RATE',
      fact: { key: 'bps:575', value: 575 },
      qualifyingReports: 2,
    });
  });

  it('a policy-rate mismatch → conflict', () => {
    const r = run(NBP_RATE, [
      report('reuters.com', "Poland's central bank holds interest rates at 5.75%", ''),
      report('money.pl', 'RPP obniżyła stopy procentowe do 5,50 proc.', ''),
    ]);
    expect(r).toMatchObject({ corroborated: false, reason: 'CONFLICTING_FACTS' });
  });

  it('no extractable fact → nothing qualifies', () => {
    const r = run(NBP_RATE, [
      report('reuters.com', 'NBP keeps interest rates unchanged', ''),
      report('money.pl', 'RPP bez zmian', ''),
    ]);
    expect(r).toMatchObject({ corroborated: false, reason: 'NO_QUALIFYING_REPORT' });
  });

  it('an unsupported fact family is honestly unsupported', () => {
    expect(run(null, same())).toMatchObject({
      corroborated: false,
      reason: 'UNSUPPORTED_FACT_FAMILY',
    });
  });
});

describe('the target comes from the plan’s own reading', () => {
  const route = (q: string, lang: 'en' | 'pl' = 'en') =>
    routeAskR2(
      {
        originalQuestion: q,
        sourceLanguage: lang,
        normalizationLanguage: lang,
        displayLanguage: lang,
        origin: 'ASK',
      },
      { computeConsent: 'GRANTED', requestInstant: '2026-09-29T10:00:00Z' },
      { specialistRegistry: landedSpecialistRegistryPort(() => ['CONFLICT']) },
    );

  it.each([
    [
      'Who is the current president of Poland?',
      'en',
      { family: 'OFFICE_HOLDER', office: 'PRESIDENT', countryIso3: 'POL' },
    ],
    [
      'Kto jest obecnie prezydentem Polski?',
      'pl',
      { family: 'OFFICE_HOLDER', office: 'PRESIDENT', countryIso3: 'POL' },
    ],
    [
      'Who is the prime minister of Kenya?',
      'en',
      { family: 'OFFICE_HOLDER', office: 'PRIME_MINISTER', countryIso3: 'KEN' },
    ],
    [
      'What is the current policy interest rate of the National Bank of Poland, and when was it last changed?',
      'en',
      { family: 'POLICY_RATE', institutionId: 'PL_NBP' },
    ],
    [
      'Jaka jest obecna stopa referencyjna NBP?',
      'pl',
      { family: 'POLICY_RATE', institutionId: 'PL_NBP' },
    ],
  ] as const)('%s → %j', (q, lang, target) => {
    const r = route(q, lang);
    expect(r.plan.verification).not.toBeNull();
    expect(corroborationTargetOf(r)).toEqual(target);
  });

  it.each([
    'Who is the current minister of finance of Poland?', // office without a supported fact family
    'Who is the chairman of the board?',
  ])('unsupported current-status category → no target: %s', (q) => {
    expect(corroborationTargetOf(route(q))).toBeNull();
  });

  it('ordinary current reporting and background carry no contract', () => {
    expect(route('What is happening in Kenya?').plan.verification).toBeNull();
    expect(route('What is an induction motor?').plan.verification).toBeNull();
  });
});
