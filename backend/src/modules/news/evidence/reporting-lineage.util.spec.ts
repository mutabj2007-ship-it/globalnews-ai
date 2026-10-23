import type { NewsArticle } from '@globalnews-ai/shared';
import { reportingLineageOf, wireBylineOf } from './reporting-lineage.util';
import { assessClaims, independentFamilies } from '../../analysis/validation/claim-graph.util';
import { corroborateCurrentStatus } from '../../ask-v2/current-status-corroboration';

/** CTO R164 P-3 / P-4 — Main's own cases (Politics' fixtures 7595876 are run beside, not adopted). */
const NOW = new Date('2026-10-20T12:00:00.000Z');
let seq = 0;
const art = (host: string, title: string, summary: string, extra: Partial<NewsArticle> = {}) =>
  ({
    id: `m${(seq += 1)}`,
    title,
    summary,
    url: `https://${host}/news/${seq}`,
    sourceId: 'gnews',
    sourceName: host.split('.')[0],
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date(NOW.getTime() - 3 * 3_600_000).toISOString(),
    publishedAtBasis: 'publisher',
    sourceLanguage: 'en',
    ...extra,
  }) as NewsArticle;

const OCC = [{ id: 'c1', type: 'OCCURRENCE', text: 'the flood happened' }];
const occ = (articles: NewsArticle[]) =>
  assessClaims(OCC, articles, { coverageIncomplete: false })[0]!;

describe('reportingLineageOf', () => {
  it.each([
    ['NAIROBI (Reuters) - Floods hit', 'reuters.com'],
    ['KAMPALA, Uganda (AP) — Floods hit', 'apnews.com'],
    ['By The Associated Press. Floods hit', 'apnews.com'],
    ['KINSHASA (AFP) - Floods hit', 'afp.com'],
    ['كينشاسا (أ ف ب) - فيضانات', 'afp.com'],
    ['(Bloomberg) -- Floods hit', 'bloomberg.com'],
  ])('reads the wire byline in %p', (summary, wire) => {
    expect(wireBylineOf({ title: 'x', summary })).toBe(wire);
  });

  it('a mention of a wire is not its byline', () => {
    expect(wireBylineOf({ title: 'x', summary: 'Reuters reported that floods hit Nairobi.' })).toBe(
      null,
    );
  });

  it('one masthead across country domains; distinct mastheads stay distinct', () => {
    const uk = reportingLineageOf(art('www.bbc.co.uk', 'a', 'b'));
    const com = reportingLineageOf(art('www.bbc.com', 'a', 'b'));
    const nation = reportingLineageOf(art('nation.africa', 'a', 'b'));
    expect(uk.key).toBe(com.key);
    expect(nation.key).not.toBe(uk.key);
  });

  it('an aggregator repost without byline is unknown; with a byline it is the wire', () => {
    expect(
      reportingLineageOf(art('www.msn.com', 'a', 'b', { evidenceRole: 'AGGREGATOR' })).known,
    ).toBe(false);
    expect(
      reportingLineageOf(
        art('www.msn.com', 'a', 'NAIROBI (Reuters) - b', { evidenceRole: 'AGGREGATOR' }),
      ),
    ).toEqual({ key: 'wire:reuters.com', known: true });
  });

  it('a declared organisational family is kept', () => {
    expect(
      reportingLineageOf(art('x.com', 'a', 'b', { sourceFamily: 'org:kenya-red-cross' })).key,
    ).toBe('family:org:kenya-red-cross');
  });
});

describe('claim graph · P-3 lineage and P-4 stance', () => {
  it('two unknown-lineage reposts alone are one family, never corroboration', () => {
    const set = [
      art('www.msn.com', 'Floods in Nairobi', 'Floods hit Nairobi.', {
        evidenceRole: 'AGGREGATOR',
      }),
      art('news.yahoo.com', 'Nairobi floods', 'Water covered roads.', {
        evidenceRole: 'AGGREGATOR',
      }),
    ];
    expect(independentFamilies(set)).toHaveLength(1);
    expect(occ(set).state).toBe('REPORTED');
  });

  it('identical non-Latin headlines cluster as one story without any byline', () => {
    const t = 'فيضانات تضرب نيروبي وتغلق الطرق الرئيسية';
    const set = [art('www.annahar.com', t, 'نص أ'), art('www.alquds.co.uk', t, 'نص ب')];
    expect(independentFamilies(set)).toHaveLength(1);
  });

  it('"rejects a bill" / "disputed region" are not refutations of the reported event', () => {
    const set = [
      art(
        'www.nation.africa',
        'Senate rejects flood bill as rains hit Nairobi',
        'Floods hit Nairobi on Monday.',
      ),
      art(
        'www.standardmedia.co.ke',
        'Floods reach the disputed border area',
        'Floods hit the region.',
      ),
    ];
    const c = occ(set);
    expect(c.contradictingArticleIds).toEqual([]);
    expect(c.state).toBe('CORROBORATED_REPORTING');
  });

  it('a refutation of the account is contradiction and never support', () => {
    const allegation = art(
      'www.nation.africa',
      'Dam burst floods village',
      'A dam burst flooded the village.',
    );
    const refuter = art(
      'www.the-star.co.ke',
      'Ministry dismisses dam burst reports',
      'Officials dismissed the reports.',
    );
    const c = occ([allegation, refuter]);
    expect(c.state).toBe('DISPUTED');
    expect(c.supportingArticleIds).not.toContain(refuter.id);
    expect(c.contradictingArticleIds).toContain(refuter.id);
  });

  it('title-only items alone → UNASSESSED; beside one readable report → REPORTED (never counted)', () => {
    const t1 = art('www.a.com', 'Nairobi floods', '');
    const t2 = art('www.b.com', 'Floods', '   ');
    expect(occ([t1, t2]).state).toBe('UNASSESSED');
    const readable = art(
      'www.nation.africa',
      'Floods hit Nairobi',
      'Floods hit Nairobi on Monday.',
    );
    const c = occ([t1, t2, readable]);
    expect(c.state).toBe('REPORTED');
    expect(c.supportingArticleIds).toEqual([readable.id]);
  });

  it('a title-only denial does not dispute', () => {
    const readable = art(
      'www.nation.africa',
      'Floods hit Nairobi',
      'Floods hit Nairobi on Monday.',
    );
    const denial = art('www.x.com', 'Government denies floods', '');
    expect(occ([readable, denial]).state).toBe('REPORTED');
  });
});

describe('current-status corroboration · P-3 lineage', () => {
  const PRES_KEN = { family: 'OFFICE_HOLDER', office: 'PRESIDENT', countryIso3: 'KEN' } as const;
  const run = (articles: NewsArticle[]) =>
    corroborateCurrentStatus({
      target: PRES_KEN,
      articles,
      now: NOW,
      statedPeriod: null,
      minIndependentReports: 2,
    });
  const BODY =
    'NAIROBI (Reuters) - Kenyan President William Ruto said on Monday the budget would pass.';

  it('one Reuters body on two outlets is one report', () => {
    const r = run([
      art('www.usnews.com', 'Kenya President William Ruto backs budget', BODY),
      art('www.marketscreener.com', 'Ruto says Kenya budget will pass', BODY),
    ]);
    expect(r.corroborated).toBe(false);
    expect(r.qualifyingReports).toBeLessThanOrEqual(1);
  });

  it('an unknown-lineage repost alone still counts as the one report it is', () => {
    const r = run([
      art(
        'www.msn.com',
        'Kenya President William Ruto backs budget',
        'Kenyan President William Ruto said the budget would pass.',
        {
          evidenceRole: 'AGGREGATOR',
        },
      ),
    ]);
    expect(r.corroborated).toBe(false);
  });
});

describe('Politics F-1 · refutation is bound, never negated, never another kind of claim', () => {
  const strike1 = art(
    'www.aljazeera.com',
    'Strike hits Gaza hospital',
    'A strike hit the hospital, medics said.',
  );
  const strike2 = art(
    'www.reuters.com',
    'Gaza hospital struck, witnesses say',
    'GAZA (Reuters) - Witnesses said a strike hit the hospital.',
  );
  it.each([
    ['RV-14', 'Rescuers said there was no evidence of survivors after the strike.'],
    ['RV-15', 'It is not disputed that the strike took place.'],
    ['RV-16', 'No one disputes the account of the strike.'],
    ['RV-17', 'Separately, the army rejected reports of looting at a border crossing.'],
    ['RV-17b', 'Insurers have rejected the claims from families of the victims.'],
  ])('%s does not dispute a corroborated strike', (_id, sentence) => {
    const third = art('www.bbc.com', 'Hospital strike aftermath', sentence);
    const c = occ([strike1, strike2, third]);
    expect(c.state).toBe('CORROBORATED_REPORTING');
    expect(c.contradictingArticleIds).toEqual([]);
  });

  it('a genuine refutation still disputes', () => {
    const third = art(
      'www.timesofisrael.com',
      'Army responds',
      'The army rejected the account of the strike.',
    );
    expect(occ([strike1, strike2, third]).state).toBe('DISPUTED');
  });

  it('a summary that only repeats the headline is not assessable (RV-21)', () => {
    const echo = art('www.x.com', 'Strike hits Gaza hospital', 'Strike hits Gaza hospital');
    const echo2 = art('www.y.com', 'Gaza hospital hit', 'Gaza hospital hit');
    expect(occ([echo, echo2]).state).toBe('UNASSESSED');
  });

  it.each([
    ['BERLIN (dpa) - text', 'dpa.com'],
    ['BEIJING (Xinhua) -- text', 'xinhuanet.com'],
    ['ANKARA (AA) - text', 'aa.com.tr'],
  ])('reads further wire bylines (RV-19): %p', (summary, wire) => {
    expect(wireBylineOf({ title: 'x', summary })).toBe(wire);
  });
});
