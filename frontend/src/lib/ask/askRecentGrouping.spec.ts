import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASK_RECENT_GROUPS,
  askBookmarkReopenHref,
  askRecentGroupOf,
  askReopenHref,
  filterBookmarks,
  filterRecent,
  groupRecentThreads,
} from './askRecentGrouping';
import type { AskV2Bookmark, AskV2RecentThread } from '@/lib/api/askV2Api';

/**
 * PUBLIC BETA ASK CONTINUITY R1 — Recent/Saved grouping, addresses and the
 * zero-compute source guards.
 *
 * Source is read as TEXT and comments are stripped before any assertion about
 * code: a prose explanation of why a forbidden call is forbidden must not fail an
 * assertion about the absence of that call.
 */
const root = join(__dirname, '../..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function thread(over: Partial<AskV2RecentThread> = {}): AskV2RecentThread {
  return {
    id: 't1',
    language: 'en',
    returnPath: null,
    createdAt: '2026-09-29T08:00:00.000Z',
    lastActiveAt: '2026-09-29T08:00:00.000Z',
    turnCount: 1,
    firstQuestion: 'What changed in Rwanda this week?',
    firstQuestionTruncated: false,
    latestTurnId: 'turn-1',
    latestOperationId: 'op-1',
    latestState: 'COMPLETED',
    latestComputeClass: 'FRESH_BOUNDED',
    ...over,
  };
}

function bookmark(over: Partial<AskV2Bookmark> = {}): AskV2Bookmark {
  return {
    id: 'b1',
    turnId: 'turn-1',
    savedAt: '2026-09-29T08:00:00.000Z',
    threadId: 't1',
    sequence: 1,
    language: 'en',
    question: 'What changed in Rwanda this week?',
    questionTruncated: false,
    operationId: 'op-1',
    state: 'COMPLETED',
    computeClass: 'FRESH_BOUNDED',
    ...over,
  };
}

describe('Recent grouping is by local calendar day', () => {
  /* 2026-09-29 14:00 local. */
  const now = new Date(2026, 8, 29, 14, 0, 0);
  const localIso = (y: number, m: number, d: number, h: number, min = 0): string =>
    new Date(y, m, d, h, min, 0).toISOString();

  it('exposes exactly the three bands, newest first', () => {
    expect(ASK_RECENT_GROUPS).toEqual(['today', 'yesterday', 'earlier']);
  });

  it('local midnight today is Today, and one millisecond earlier is Yesterday', () => {
    expect(askRecentGroupOf(localIso(2026, 8, 29, 0, 0), now)).toBe('today');
    expect(
      askRecentGroupOf(new Date(new Date(2026, 8, 29, 0, 0, 0).getTime() - 1).toISOString(), now),
    ).toBe('yesterday');
  });

  it('23:50 the previous night is Yesterday, not Today', () => {
    expect(askRecentGroupOf(localIso(2026, 8, 28, 23, 50), now)).toBe('yesterday');
  });

  it('the previous day’s midnight is Yesterday and one millisecond earlier is Earlier', () => {
    expect(askRecentGroupOf(localIso(2026, 8, 28, 0, 0), now)).toBe('yesterday');
    expect(
      askRecentGroupOf(new Date(new Date(2026, 8, 28, 0, 0, 0).getTime() - 1).toISOString(), now),
    ).toBe('earlier');
  });

  it('is calendar-based, not elapsed-hours: 20 hours ago can still be Yesterday', () => {
    /* 2026-09-28 18:00 is 20h before 2026-09-29 14:00, and is the previous day. */
    expect(askRecentGroupOf(localIso(2026, 8, 28, 18, 0), now)).toBe('yesterday');
  });

  it('a future timestamp is Today, never a fourth band', () => {
    expect(askRecentGroupOf(localIso(2026, 8, 30, 9, 0), now)).toBe('today');
  });

  it('an unparseable timestamp claims the least and lands in Earlier', () => {
    expect(askRecentGroupOf('not-a-date', now)).toBe('earlier');
    expect(askRecentGroupOf('', now)).toBe('earlier');
  });

  it('groups without re-sorting: the server order survives inside each band', () => {
    const rows = [
      thread({ id: 'a', lastActiveAt: localIso(2026, 8, 29, 13, 0) }),
      thread({ id: 'b', lastActiveAt: localIso(2026, 8, 29, 9, 0) }),
      thread({ id: 'c', lastActiveAt: localIso(2026, 8, 28, 10, 0) }),
      thread({ id: 'd', lastActiveAt: localIso(2026, 8, 1, 10, 0) }),
    ];
    const grouped = groupRecentThreads(rows, now);
    expect(grouped.today.map((r) => r.id)).toEqual(['a', 'b']);
    expect(grouped.yesterday.map((r) => r.id)).toEqual(['c']);
    expect(grouped.earlier.map((r) => r.id)).toEqual(['d']);
  });

  it('an empty list produces three empty bands, not a missing one', () => {
    expect(groupRecentThreads([], now)).toEqual({ today: [], yesterday: [], earlier: [] });
  });
});

describe('reopen addresses follow contract §15', () => {
  it('a thread with an operation reopens at /ask?operation=', () => {
    expect(askReopenHref(thread({ id: 't9', latestOperationId: 'op-9' }))).toBe(
      '/ask?operation=op-9',
    );
  });

  it('a thread with no operation reopens at /ask?thread=', () => {
    expect(askReopenHref(thread({ id: 't9', latestOperationId: null }))).toBe('/ask?thread=t9');
  });

  it('a saved question reopens at its own operation', () => {
    expect(askBookmarkReopenHref(bookmark({ operationId: 'op-4', threadId: 't4' }))).toBe(
      '/ask?operation=op-4',
    );
    expect(askBookmarkReopenHref(bookmark({ operationId: null, threadId: 't4' }))).toBe(
      '/ask?thread=t4',
    );
  });

  it('ids are encoded, so a crafted id cannot add a parameter', () => {
    expect(askReopenHref({ id: 'x', latestOperationId: 'a&b=c' })).toBe('/ask?operation=a%26b%3Dc');
  });

  it('no reopen address is /search?op= or /analysis/results/ — those were replaced', () => {
    const href = askReopenHref(thread());
    expect(href.startsWith('/ask?')).toBe(true);
    expect(href).not.toContain('/search');
    expect(href).not.toContain('/analysis/results');
  });
});

describe('filtering is a pure predicate over material already fetched', () => {
  it('matches the reader’s own question text, case-insensitively', () => {
    const rows = [thread({ id: 'a' }), thread({ id: 'b', firstQuestion: 'Kenya elections' })];
    expect(filterRecent(rows, 'kenya').map((r) => r.id)).toEqual(['b']);
    expect(filterRecent(rows, 'RWANDA').map((r) => r.id)).toEqual(['a']);
  });

  it('an empty or whitespace term returns the same list, not an empty one', () => {
    const rows = [thread({ id: 'a' })];
    expect(filterRecent(rows, '')).toBe(rows);
    expect(filterRecent(rows, '   ')).toBe(rows);
  });

  it('a row with no stored question is simply not matched, and does not throw', () => {
    expect(filterRecent([thread({ firstQuestion: null })], 'anything')).toEqual([]);
  });

  it('filters saved questions by the same rule', () => {
    const rows = [bookmark({ id: 'a' }), bookmark({ id: 'b', question: 'Poland CPI' })];
    expect(filterBookmarks(rows, 'poland').map((r) => r.id)).toEqual(['b']);
  });
});

describe('ZERO COMPUTE — the continuity modules cannot spend', () => {
  const FORBIDDEN = ['analyzeNews', 'grantAnalysisConsent', '/analysis/news', 'askR2Payload'];

  it('the grouping module imports nothing that can fetch', () => {
    const source = code(read('lib/ask/askRecentGrouping.ts'));
    for (const token of ['fetch(', 'accountFetch', 'analyzeNews', 'useEffect']) {
      expect(source).not.toContain(token);
    }
  });

  it('the grouping module generates no title and reads no answer', () => {
    const source = code(read('lib/ask/askRecentGrouping.ts'));
    /* A title would have to be composed from something; nothing here composes text. */
    expect(source).not.toMatch(/title/i);
    expect(source).not.toContain('payload');
    expect(source).not.toContain('analysis');
  });

  it('the Recent surface never reaches a compute path', () => {
    const source = code(read('components/ask/AskRecentClient.tsx'));
    for (const token of FORBIDDEN) expect(source).not.toContain(token);
  });

  it('the Saved surface never reaches a compute path', () => {
    const source = code(read('components/ask/SavedClient.tsx'));
    for (const token of FORBIDDEN) expect(source).not.toContain(token);
  });

  it('neither surface writes a compute-consent grant', () => {
    for (const file of ['components/ask/AskRecentClient.tsx', 'components/ask/SavedClient.tsx']) {
      expect(code(read(file))).not.toContain('grantAnalysisConsent');
    }
  });

  it('STANDALONE ASK: Saved imports no My Intelligence and no saved-story code', () => {
    const source = read('components/ask/SavedClient.tsx');
    for (const token of [
      'myIntelligence',
      'fetchSavedStories',
      'SavedStoryView',
      'my-intelligence',
    ]) {
      expect(source).not.toContain(token);
    }
  });

  it('STANDALONE ASK: neither surface imports the Home experience', () => {
    for (const file of ['components/ask/AskRecentClient.tsx', 'components/ask/SavedClient.tsx']) {
      expect(read(file)).not.toContain('components/home');
    }
  });

  it('the account menu points the Ask-facing entry at /ask/recent, and /history survives', () => {
    const menu = read('components/navigation/AccountControl.tsx');
    expect(menu).toContain('href="/ask/recent"');
    /* Legacy /history is not deleted — it is only no longer this entry's destination. */
    expect(code(menu)).not.toContain('href="/history"');
  });

  it('the Ask V2 client maps a 404 to UNAVAILABLE only on collection reads', () => {
    const source = code(read('lib/api/askV2Api.ts'));
    expect(source).toContain(
      "const UNAVAILABLE_ON_404: readonly string[] = ['/ask-v2/threads', '/ask-v2/bookmarks'];",
    );
    /* The owner-404 on a single operation must NOT be reported as "feature off". */
    expect(source).not.toContain("path.startsWith('/ask-v2/operations')");
  });
});
