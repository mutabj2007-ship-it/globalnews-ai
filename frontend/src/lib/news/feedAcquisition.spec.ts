import { readFileSync } from 'fs';
import { join } from 'path';
import { ASK_PROGRESS_LOCALES, askProgressStrings } from '@/lib/ask/askProgressStrings';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { emptyFeedLine, feedNotSearchedRightsUncleared } from './feedAcquisition';

/**
 * CTO #95 c6375734941 §4 — live Alpha 2e50682: GET /news/top-headlines answered 200 with
 * `acquisition: { state: 'SOURCE_RIGHTS_UNCLEARED', notSearched: ['gnews','gdelt-doc'] }` while Home
 * read "Couldn't load the latest updates." The reason is the backend's typed field, never inferred.
 */
const LIVE_SHAPE = {
  articles: [],
  totalResults: 0,
  providers: [],
  dataMode: 'unavailable',
  fallbackReason: 'no-live-results',
  acquisition: { state: 'SOURCE_RIGHTS_UNCLEARED', notSearched: ['gnews', 'gdelt-doc'] },
};

describe('Home empty-feed status: typed not-searched reason (CTO #95 §4)', () => {
  it('reads the live Alpha shape as not searched', () => {
    expect(feedNotSearchedRightsUncleared(LIVE_SHAPE)).toBe(true);
  });

  it('never infers it from an empty list, a 200 or dataMode alone', () => {
    const { acquisition: _a, ...noReason } = LIVE_SHAPE;
    expect(feedNotSearchedRightsUncleared(noReason)).toBe(false);
    expect(feedNotSearchedRightsUncleared({ ...LIVE_SHAPE, acquisition: { state: 'OTHER' } })).toBe(false);
    expect(feedNotSearchedRightsUncleared(null)).toBe(false);
    expect(feedNotSearchedRightsUncleared(undefined)).toBe(false);
  });

  it.each(ASK_PROGRESS_LOCALES)('%s: not searched uses the qualified line, distinct from "couldn\'t load"', (locale) => {
    const unavailable = getDictionary(locale as never).betaHome.feedUnavailable;
    const line = emptyFeedLine(true, locale, unavailable);
    expect(line).toBe(askProgressStrings(locale).searchNotPermitted);
    expect(line).not.toBe(unavailable);
    /* an outage / unreachable backend keeps the existing wording */
    expect(emptyFeedLine(false, locale, unavailable)).toBe(unavailable);
  });

  /* The live Alpha Home is R1 (HomeR1Page → HomeR1Stories). The Rev A composition in page.tsx is
     byte-frozen by homeR1StageA.contract.spec and not served on Alpha; its WhatsHappeningNow routes
     through the same line with the flag defaulting false, so it keeps its existing wording there. */
  it('both Home renderers route the empty state through emptyFeedLine, and the R1 Home passes the typed flag', () => {
    const src = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');
    for (const file of ['components/home/r1/HomeR1Stories.tsx', 'components/home/WhatsHappeningNow.tsx']) {
      const s = src(file);
      expect(s).toMatch(/emptyFeedLine\(notSearched, language, \w+\.feedUnavailable\)/);
      expect(s).not.toMatch(/\{\s*\w+\.feedUnavailable\s*\}/);
    }
    expect(src('components/home/r1/HomeR1Page.tsx')).toMatch(/notSearched=\{notSearched\}/);
    expect(src('app/page.tsx')).toMatch(/<HomeR1Page[\s\S]{0,400}notSearched=\{feed\.notSearchedRightsUncleared\}/);
    expect(src('lib/homeFeed.ts')).toMatch(/notSearchedRightsUncleared: feedNotSearchedRightsUncleared\(response\)/);
  });
});
