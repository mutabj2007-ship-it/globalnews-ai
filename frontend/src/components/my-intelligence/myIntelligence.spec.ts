import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { countSince } from '@/components/today/useReturnState';
import { countNewSince, hasObservationTime, isNewSince, selectNewSince } from './newSince';
import { isSameSavedStory, savedStoryRef, toSavedStoryReference } from './savedStoryIdentity';
import { FORBIDDEN_TIER_VIOLET, FORBIDDEN_WATCH_MINT } from './miPresentation';
import { MI_ACTIONS } from './MiSelection';

const HERE = __dirname;
const sourceFiles = readdirSync(HERE).filter((name) => /\.tsx?$/.test(name) && !name.endsWith('.spec.ts'));
const read = (name: string): string => readFileSync(join(HERE, name), 'utf-8');

/*
  These assertions are about what the surface RENDERS, not about what it
  explains. Several of these modules document the reserved colours and the
  storage APIs precisely in order to state that they are not used, so a scan
  that counted prose would go red for the comment that promises the opposite.
  Comments are therefore stripped before any source is examined.
*/
const code = (name: string): string =>
  read(name)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/* ─── The New-since rule ──────────────────────────────────────────────── */

describe('new since = firstSeenAt > boundary, and never publishedAt', () => {
  const boundary = '2026-09-26T00:00:00.000Z';

  it('a story published BEFORE the boundary but first observed after it IS new', () => {
    /* The case the Product Owner refused to let disappear. */
    expect(isNewSince({ firstSeenAt: '2026-09-26T22:00:00.000Z' }, boundary)).toBe(true);
  });

  it('a story first observed BEFORE the boundary is NOT new, however recently it was published', () => {
    expect(isNewSince({ firstSeenAt: '2026-09-25T22:00:00.000Z' }, boundary)).toBe(false);
  });

  it('a record with NO firstSeenAt is never new, and never counted', () => {
    expect(isNewSince({}, boundary)).toBe(false);
    expect(countNewSince([{}, {}, {}], boundary)).toBe(0);
    expect(selectNewSince([{}], boundary)).toHaveLength(0);
    expect(hasObservationTime({})).toBe(false);
  });

  it('a first visit marks nothing new', () => {
    expect(isNewSince({ firstSeenAt: '2026-09-27T00:00:00.000Z' }, null)).toBe(false);
    expect(countNewSince([{ firstSeenAt: '2026-09-27T00:00:00.000Z' }], null)).toBe(0);
  });

  it('an unparseable timestamp on either side is not new, and does not throw', () => {
    expect(isNewSince({ firstSeenAt: 'not-a-date' }, boundary)).toBe(false);
    expect(isNewSince({ firstSeenAt: '2026-09-27T00:00:00.000Z' }, 'not-a-date')).toBe(false);
  });

  /*
    ONE RULE, NOT TWO.

    `countSince` in `useReturnState` is the accepted counting rule. This module
    exists so a component can ask about a SINGLE row without importing a
    retired surface's hook, and this assertion is what stops the two drifting:
    for the same inputs they must return the same number, including for the
    awkward inputs.
  */
  it('counts identically to the accepted countSince, for every shape', () => {
    const records = [
      { firstSeenAt: '2026-09-26T22:00:00.000Z' },
      { firstSeenAt: '2026-09-25T22:00:00.000Z' },
      {},
      { firstSeenAt: 'not-a-date' },
      { firstSeenAt: '2026-09-26T00:00:00.001Z' },
    ];
    for (const b of [boundary, null, 'not-a-date']) {
      expect(countNewSince(records, b)).toBe(countSince(records, b));
    }
  });
});

/* ─── Saved story identity ────────────────────────────────────────────── */

describe('a saved story is keyed by its canonical URL, never by the article id', () => {
  it('two ids for the same URL are the same saved story', () => {
    const a = toSavedStoryReference({ url: 'https://example.com/a?utm_source=x', id: 'gnews-1' });
    const b = toSavedStoryReference({ url: 'https://example.com/a', id: 'gnews-2' });
    expect(isSameSavedStory(a, b)).toBe(true);
  });

  it('the identity is derived from the URL, and the article id is only a hint', () => {
    const ref = toSavedStoryReference({ url: 'https://example.com/a', id: 'gnews-1' });
    expect(ref.articleRef).toBe(savedStoryRef('https://example.com/a'));
    expect(ref.providerArticleIdHint).toBe('gnews-1');
    expect(ref.articleRef).not.toContain('gnews-1');
  });
});

/* ─── Part IV invariants ──────────────────────────────────────────────── */

describe('Part IV colour reservations hold across the whole surface', () => {
  it('filled mint never appears — it means an active Watch, and Watch is inactive', () => {
    for (const name of sourceFiles) {
      const body = code(name).replace(/FORBIDDEN_WATCH_MINT = '#5BE3A8'/, '');
      expect(`${name}:${body.toLowerCase().includes(FORBIDDEN_WATCH_MINT.toLowerCase())}`).toBe(`${name}:false`);
    }
  });

  it('tier violet never appears — R1.2 draws no paid boundary', () => {
    for (const name of sourceFiles) {
      const body = code(name).replace(/FORBIDDEN_TIER_VIOLET = '#8C86EE'/, '');
      expect(`${name}:${body.toLowerCase().includes(FORBIDDEN_TIER_VIOLET.toLowerCase())}`).toBe(`${name}:false`);
    }
  });
});

/* ─── The compute boundary ────────────────────────────────────────────── */

describe('nothing on this surface can start AI except an explicit confirmation', () => {
  it('the six actions and their minimums are exactly what the authority lists', () => {
    expect(MI_ACTIONS.map((a) => `${a.id}:${a.min}`)).toEqual([
      'compare:2',
      'summarize:1',
      'askAbout:1',
      'explain:2',
      'whatChanged:1',
      'briefing:2',
    ]);
  });

  it('no component posts to an analysis or ask endpoint', () => {
    for (const name of sourceFiles) {
      const body = code(name);
      expect(`${name}:${/accountFetch\(\s*'\/(analysis|ask)/.test(body)}`).toBe(`${name}:false`);
      expect(`${name}:${body.includes("method: 'POST'") && name !== 'useMyIntelligenceData.ts'}`).toBe(
        `${name}:false`,
      );
    }
  });

  it('the bookmark cannot also open the publisher link it sits beside', () => {
    const body = read('MiPrimitives.tsx');
    expect(body).toContain('event.preventDefault()');
    expect(body).toContain('event.stopPropagation()');
  });

  it('no browser storage is used for any of this state', () => {
    for (const name of sourceFiles) {
      const body = code(name);
      expect(`${name}:${/localStorage|sessionStorage|indexedDB/i.test(body)}`).toBe(`${name}:false`);
    }
  });
});

/* ─── Fixtures cannot pass for live data ──────────────────────────────── */

describe('development fixtures are inert unless explicitly enabled', () => {
  it('the fixture flag is the only thing that turns them on', () => {
    expect(read('devFixtures.ts')).toContain("process.env.NEXT_PUBLIC_MI_DEV_FIXTURES === 'true'");
  });

  it('no fixture points at a real publisher', () => {
    const urls = read('devFixtures.ts').match(/https?:\/\/[^'"]+/g) ?? [];
    for (const url of urls) {
      expect(`${url}`).toMatch(/^https:\/\/example\.com\//);
    }
  });
});
