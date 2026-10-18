import { parseRnpListing, RNP_MAX_ITEMS } from './rnp-listing.parser';
import { rnpHeadlineCountry } from './rnp-headline-country';

/*
  E1 ADDENDUM-02 §3 + ADDENDUM-05. A SYNTHETIC listing in the shape of the live TYPO3 page (captured once,
  2026-10-18; no real title is copied here). Every title carries a sentinel so a leak is detectable.
*/
const SENTINEL = 'ZZ-SENTINEL-RNP-TITLE';
const item = (slug: string, date: string | null, title: string, href?: string): string => {
  const link =
    href ??
    `media/news-detail/news/${slug}/?tx_news_pi1%5Bcontroller%5D=News&amp;tx_news_pi1%5Baction%5D=detail&amp;cHash=0123456789abcdef0123456789abcdef`;
  const time =
    date === null ? '' : `<time itemprop="datePublished" datetime="${date}">${date}</time>`;
  return `<div id="latest-news-1" class="single-news "><div class="news-head overlay"><a href="${link}"><img class="img-responsive" src="x.jpg" alt="x" /></a>
    <ul class="news-meta"><li class="author"><a href="#">Admin</a></li><li class="date">${time}</li></ul></div>
    <div class="news-body"><div class="news-content"><h3 class="news-title"><a href="${link}">${title} ${SENTINEL}</a></h3>
    <div class="news-text"><p></p></div></div></div></div>`;
};
const page = (...items: string[]): string =>
  `<html><head><base href="https://police.gov.rw/"></head><body><div class="news-default">${items.join('\n')}</div></body></html>`;

describe('RNP listing parser — permitted fields only', () => {
  const html = page(
    item(
      'officers-complete-course',
      '2026-10-16',
      'Rwanda National Police officers complete a commanders course',
    ),
    item(
      'officers-complete-course',
      '2026-10-16',
      'Rwanda National Police officers complete a commanders course',
    ),
    item(
      'medical-care-abroad',
      '2026-10-15',
      'RNP provides medical care to 940 people in South Sudan',
    ),
    item(
      'environment-day',
      '2026-10-17',
      'Rwanda National Police joins community environmental work',
    ),
    item('no-date', null, 'Undated item in Kenya'),
    item(
      'foreign',
      '2026-10-14',
      'Foreign link in Uganda',
      'https://example.org/media/news-detail/news/foreign/',
    ),
  );
  const out = parseRnpListing(html);

  it('keeps url · date · slug · derived geography · title key, newest first, de-duplicated by slug', () => {
    expect(out.items.map((i) => [i.slug, i.publishedOn])).toEqual([
      ['environment-day', '2026-10-17'],
      ['officers-complete-course', '2026-10-16'],
      ['medical-care-abroad', '2026-10-15'],
    ]);
    expect(out.items[0].url).toMatch(
      /^https:\/\/police\.gov\.rw\/media\/news-detail\/news\/environment-day\/\?/,
    );
    expect(out.dropped).toBe(2);
    expect(out.listingMarkup).toBe(true);
  });

  it('the listing title never leaves the parser (sentinel absent from everything returned)', () => {
    expect(JSON.stringify(out)).not.toContain(SENTINEL);
    expect(JSON.stringify(out)).not.toMatch(/commanders course|medical care|environmental/);
    for (const i of out.items) expect(i.titleKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('NEG-1: publisher is not location — the South Sudan item is SSD, the others are NOT stated (never RWA)', () => {
    const geo = Object.fromEntries(out.items.map((i) => [i.slug, i.geography]));
    expect(geo['medical-care-abroad']).toEqual({
      outcome: 'MATCHED',
      iso3: 'SSD',
      rule: 'RNP-GEO-R1',
    });
    expect(geo['environment-day'].outcome).toBe('NOT_STATED');
    expect(geo['officers-complete-course'].iso3).toBeNull();
  });

  it(`keeps at most ${RNP_MAX_ITEMS} items`, () => {
    const many = page(
      ...Array.from({ length: 14 }, (_, n) =>
        item(`s-${n}`, `2026-10-${String(n + 1).padStart(2, '0')}`, 'x'),
      ),
    );
    expect(parseRnpListing(many).items).toHaveLength(RNP_MAX_ITEMS);
    expect(parseRnpListing(many).items[0].publishedOn).toBe('2026-10-14');
  });

  it('a page without the listing markup is reported as such (a parse failure, never "no news")', () => {
    const none = parseRnpListing('<html><body>maintenance</body></html>');
    expect(none.items).toEqual([]);
    expect(none.listingMarkup).toBe(false);
  });
});

describe('ADDENDUM-05 headline → country (C-2..C-5)', () => {
  const geo = (t: string) => rnpHeadlineCountry(t);
  it.each([
    ['Rwanda National Police provide care to people in South Sudan', 'MATCHED', 'SSD'],
    ['RNP officers trained in Sudan', 'MATCHED', 'SDN'],
    ['Rwanda National Police (RNP) holds a meeting', 'NOT_STATED', null],
    ['Rwandan officers recognised', 'NOT_STATED', null],
    ['Police meet counterparts in Kenya and in Uganda', 'AMBIGUOUS', null],
    ['Workshop held in DR Congo', 'MATCHED', 'COD'],
    ['Delegation meets in the Democratic Republic of the Congo', 'MATCHED', 'COD'],
    ['Talks on the Congo river', 'NOT_STATED', null],
    ['Team arrives in Guinea-Bissau', 'MATCHED', 'GNB'],
    ['Nigerian delegation visits', 'NOT_STATED', null],
    ['Peacekeepers rotate in the Central African Republic', 'MATCHED', 'CAF'],
    ['Community policing week in Rwanda', 'MATCHED', 'RWA'],
    /* CTO R157 decision C — a country without a locative relation never places the event */
    ['RNP hosts a Uganda Police Force delegation', 'NOT_STATED', null],
    ['Cooperation with DR Congo police', 'NOT_STATED', null],
    ['Kenya and Rwanda sign a policing agreement', 'NOT_STATED', null],
    ['Officers from South Sudan train in Rwanda', 'MATCHED', 'RWA'],
  ])('%s → %s %s', (title, outcome, iso3) => {
    expect(geo(title)).toEqual({ outcome, iso3, rule: 'RNP-GEO-R1' });
  });
});
