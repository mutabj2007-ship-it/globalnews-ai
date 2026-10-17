import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HomeEditorialResponse, HomeRegionId, HomeStoryCard } from '@globalnews-ai/shared';
import { homeR1Gates } from '@/lib/platform/homeR1Gates';
import { visualEn } from '@/lib/i18n/dictionaries/visualEn';
import { VisualHomePage } from '../VisualHomePage';

jest.mock('next/navigation', () => ({
  usePathname: () => '/visual',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/*
  R135 ASK EXPLORE · /visual HTTP 500 on Alpha (reference 3617075896, FE 0e95cd0 / BE bc13149).
  Alpha's backend runs the reader-rights interceptor on every reader route, home/editorial included
  (backend reader-rights.interceptor.ts → withholdThirdPartyArticles): an uncleared third-party article
  object is REMOVED from arrays and DROPPED as a property. On /home/editorial that drops `hero.story`
  while `hero` itself (no url/title) survives, empties every row's `stories`, and appends
  `sourceRightsWithheld`. /visual then read `hero.story.articleRef` of undefined → server render throws.
  Reproduced locally (platform mode, dev server, stub backend serving exactly this shape):
  TypeError: Cannot read properties of undefined (reading 'articleRef') at LeadStory → GET /visual 500.
  These rows render the page with that shape. They FAIL at 6f9235e by design.
*/
const IDS: HomeRegionId[] = ['region:east-africa', 'region:european-union', 'region:middle-east'];
const policy = { priorityWindowHours: 72, discussionWindowDays: 7, discussionMinParticipants: 3, earlierWindowDays: 30, perRegionMax: 12, sparseBelow: 3, heroRotationHours: 6 };
const card = (n: number, region: HomeRegionId): HomeStoryCard => ({
  articleRef: `ar_${n}`, storyId: null, url: `https://example.org/${n}`, title: `Story ${n}`, summary: `Summary ${n}`,
  imageUrl: null, publisher: 'Example Wire', sourceId: 'gnews:example', publishedAt: '2026-10-16T08:00:00.000Z',
  publishedAtBasis: 'publisher', firstSeenAt: '2026-10-16T08:05:00.000Z', category: 'business', primaryDomain: 'business',
  domains: ['business'], signals: [], topics: [], countries: [{ iso3: 'RWA', name: 'Rwanda' }], regions: [region],
  freshness: 'LAST_72H', otherReports: { count: 0, publishers: [], firstReportedAt: '2026-10-16T08:00:00.000Z' },
  discussion: null, sourceStatus: 'RETAINED_PUBLISHER_REPORT',
});
const FULL: HomeEditorialResponse = {
  generatedAt: '2026-10-17T02:00:00.000Z', policy,
  hero: { story: card(1, IDS[0]), basis: 'DEFAULT', matched: { countries: [], domains: [] }, more: [card(2, IDS[1])] },
  regions: IDS.map((id, i) => ({ id, scopeLabel: id, disclosure: 'd', memberCount: 5, state: 'OK' as const, stories: [card(10 + i, id), card(20 + i, id)], counts: { recent: 3, total: 7 } })),
  degraded: false,
};
/* exactly what withholdThirdPartyArticles leaves of FULL when no card's source is cleared */
const WITHHELD = {
  ...FULL,
  hero: { basis: 'DEFAULT', matched: { countries: [], domains: [] }, more: [] },
  regions: FULL.regions.map((r) => ({ ...r, stories: [] })),
  sourceRightsWithheld: { count: 11, reason: 'SOURCE_RIGHTS_WITHHELD' },
} as unknown as HomeEditorialResponse;

const ALL_GATES_ON = homeR1Gates({
  GNA_HOME_R1: 'true', GNA_HOME_CARD_ACTIONS: 'true', GNA_DISCUSSION_READ: 'true', GNA_DISCUSSION_WRITE: 'true', GNA_ALERTS_IN_APP: 'true',
});
const render = (editorial: HomeEditorialResponse | null, gates = homeR1Gates({})): string =>
  renderToStaticMarkup(createElement(VisualHomePage, { language: 'en', gates, editorial, examples: ['q'], theme: 'system' }));
const t = visualEn.home;

describe('R135 · /visual renders the editorial as the reader-rights interceptor delivers it', () => {
  it('withheld hero and rows (gates off): renders, the hero reads UNAVAILABLE, never the empty-store wording', () => {
    const html = render(WITHHELD);
    expect(html).toContain('data-visual-home');
    expect(html).toContain(t.w60Unavailable);
    expect(html).not.toContain(t.w60Empty);
    expect(html).not.toContain('data-home-w60-lead');
  });
  it('withheld (Alpha gates on, StageBHost mounted): renders', () => {
    expect(() => render(WITHHELD, ALL_GATES_ON)).not.toThrow();
  });
  it('a row whose every card was withheld reads UNAVAILABLE, never "3 in the last 72 hours" with no card', () => {
    const html = render(WITHHELD);
    expect(html.split(t.rowUnavailable).length - 1).toBe(3);
    expect(html).not.toContain('3 in the last 72 hours');
    expect(html).not.toContain(t.rowEmpty);
  });
  it('control: the un-withheld editorial still renders its lead story and rows', () => {
    const html = render(FULL, ALL_GATES_ON);
    expect(html).toContain('data-home-w60-lead');
    expect(html).toContain('Story 1');
    expect(html).toContain('Story 10');
    expect(html.split('3 in the last 72 hours').length - 1).toBe(3);
  });
  it('control: a failed read (null) renders UNAVAILABLE as before', () => {
    const html = render(null);
    expect(html).toContain(t.w60Unavailable);
    expect(html.split(t.rowUnavailable).length - 1).toBe(3);
  });
});
