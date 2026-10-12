import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { DisplayLocale, HomeStoryCard } from '@globalnews-ai/shared';
import type { StoredBriefContent, StoryBriefView } from '@/lib/storyBrief/storyBriefView';

/*
  ASK D0.1 — FIXTURE POSITIVE CONTROLS with the publisher-content gate mocked to CLEARED.
  This is "UI ready with fixtures" evidence only: the real gate stays HOLD until E1 clears the use.
  Fixtures are typed as the real backend contracts (HomeStoryCard, StoryBriefView).
*/
jest.mock('@/lib/rights/pickerPublisherContent', () => ({ PICKER_PUBLISHER_CONTENT: 'CLEARED' }));
jest.mock('next/link', () => {
  const { createElement: h } = jest.requireActual('react');
  return { __esModule: true, default: ({ href, children, ...rest }: { href: string; children: unknown }) => h('a', { href, ...rest }, children) };
});
const accountFetch = jest.fn();
jest.mock('@/lib/api/accountFetch', () => ({ accountFetch: (...args: unknown[]) => accountFetch(...args) }));
const readStoryBrief = jest.fn();
const ensureStoryForArticle = jest.fn();
const requestStoryBrief = jest.fn();
jest.mock('@/lib/api/storyBriefApi', () => ({
  readStoryBrief: (...a: unknown[]) => readStoryBrief(...a),
  ensureStoryForArticle: (...a: unknown[]) => ensureStoryForArticle(...a),
  requestStoryBrief: (...a: unknown[]) => requestStoryBrief(...a),
}));
jest.mock('@/components/home/useCountryFollows', () => ({
  useCountryFollows: () => ({ follows: [], maxFollows: 10, isLoading: false, pendingCountry: null, failedCountry: null, follow: jest.fn(), unfollow: jest.fn() }),
}));

// eslint-disable-next-line import/first
import { searchPickerStories } from '@/lib/api/storyPickerApi';
// eslint-disable-next-line import/first
import { StoryPicker } from './StoryPicker';
// eslint-disable-next-line import/first
import { ChoosePlace } from './ChoosePlace';

const card = (over: Partial<HomeStoryCard>): HomeStoryCard =>
  ({
    articleRef: 'a'.repeat(64), storyId: 'story-1', url: 'https://publisher.example/a', title: 'Fuel prices rise in Kigali',
    summary: 'SUMMARY MUST NOT BE SHOWN', imageUrl: 'https://publisher.example/a.jpg', publisher: 'Example Wire', sourceId: 'src-1',
    publishedAt: '2026-10-10T08:00:00Z', publishedAtBasis: 'publisher', firstSeenAt: '2026-10-10T09:00:00Z', category: 'business',
    primaryDomain: 'business', domains: ['business'], ...over,
  }) as HomeStoryCard;

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const brief = (over: Partial<StoredBriefContent> = {}): StoredBriefContent => ({
  version: 1, conclusion: 'READY', evidenceRevision: 'r1' as never, asOf: '2026-10-10T10:00:00Z', generatedAt: '2026-10-10T10:00:00Z',
  summary: 'A stored, sourced explanation.', keyFacts: [{ claim: 'Prices rose.', sourceArticleIds: ['e1'] }], background: null,
  evidence: [{ id: 'e1', url: 'https://publisher.example/a', title: 'Fuel prices rise', publisher: 'Example Wire', publishedAt: '2026-10-09T00:00:00Z' }],
  coverageGaps: [], uncertainty: [], ...over,
});
const base = { storyId: 'story-1' as never, currentEvidenceRevision: 'r1' as never, versions: 1, generationAvailable: false };

const textOf = (node: ReactTestInstance): string => node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const byData = (r: ReactTestRenderer, value: string) => r.root.findAll((n) => n.props['data-ask'] === value && typeof n.type === 'string');

beforeEach(() => {
  jest.useFakeTimers();
  accountFetch.mockReset();
  readStoryBrief.mockReset();
  ensureStoryForArticle.mockReset();
  requestStoryBrief.mockReset();
});
afterEach(() => jest.useRealTimers());

async function openWith(results: readonly HomeStoryCard[]) {
  accountFetch.mockResolvedValue(ok({ results }));
  const onStageDraft = jest.fn();
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(createElement(StoryPicker, { locale: 'en' as DisplayLocale, onClose: jest.fn(), onStageDraft }));
  });
  await act(async () => {
    byData(r, 'picker-search')[0].props.onChange({ target: { value: 'fuel' } });
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  return { r, onStageDraft };
}

describe('D1 · data adapter (CLEARED fixture)', () => {
  it('GET /stories/search?q=…&scope=home; keeps title/publisher/date basis; drops summary and image', async () => {
    accountFetch.mockResolvedValue(ok({ results: [card({}), card({ articleRef: 'b'.repeat(64), publishedAtBasis: 'observed' })] }));
    const result = await searchPickerStories('fuel prices');
    expect(accountFetch).toHaveBeenCalledWith('/stories/search?q=fuel+prices&scope=home');
    expect(result.kind).toBe('OK');
    if (result.kind !== 'OK') return;
    expect(result.stories[0]).toEqual({
      articleRef: 'a'.repeat(64), storyId: 'story-1', url: 'https://publisher.example/a', title: 'Fuel prices rise in Kigali',
      publisher: 'Example Wire', date: '2026-10-10T08:00:00Z', dateBasis: 'publisher',
    });
    expect(result.stories[1]).toMatchObject({ dateBasis: 'observed', date: '2026-10-10T09:00:00Z' });
    expect(JSON.stringify(result)).not.toMatch(/SUMMARY MUST NOT BE SHOWN|a\.jpg/);
  });

  it('S04: a 404 (gate off) is UNAVAILABLE; a thrown fetch is NETWORK', async () => {
    accountFetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    await expect(searchPickerStories('fuel')).resolves.toEqual({ kind: 'UNAVAILABLE' });
    accountFetch.mockRejectedValueOnce(new Error('offline'));
    await expect(searchPickerStories('fuel')).resolves.toEqual({ kind: 'NETWORK' });
  });
});

describe('D1 · picker UI (CLEARED fixture)', () => {
  it('S02: rows show title and "publisher · Published d" / "Seen d"; no summary, no image', async () => {
    const { r } = await openWith([card({}), card({ articleRef: 'b'.repeat(64), title: 'Seen story', publishedAtBasis: 'observed' })]);
    const rows = byData(r, 'picker-row');
    expect(rows).toHaveLength(2);
    expect(textOf(rows[0])).toMatch(/Fuel prices rise in Kigali.*Example Wire · Published 10 Oct/);
    expect(textOf(rows[1])).toMatch(/Seen story.*Example Wire · Seen 10 Oct/);
    expect(textOf(r.root)).not.toContain('SUMMARY MUST NOT BE SHOWN');
    expect(r.root.findAll((n) => n.type === 'img')).toHaveLength(0);
  });

  it('no match: the accepted "No stored stories match" notice', async () => {
    const { r } = await openWith([]);
    expect(textOf(byData(r, 'picker-notice-no-story')[0])).toBe('No stored stories match “fuel”.');
  });

  async function openStory(view: StoryBriefView | { ok: false; reason: string }) {
    readStoryBrief.mockResolvedValue('ok' in view ? view : { ok: true, value: view });
    const opened = await openWith([card({})]);
    await act(async () => {
      byData(opened.r, 'picker-row')[0].props.onClick();
    });
    return opened;
  }

  it('S05 READY: the stored explanation is readable with its citation; read path only', async () => {
    const { r } = await openStory({ ...base, state: 'READY', brief: brief() });
    expect(readStoryBrief).toHaveBeenCalledWith('story-1');
    expect(requestStoryBrief).not.toHaveBeenCalled();
    expect(byData(r, 'picker-brief')[0].props['data-brief-state']).toBe('READY');
    expect(textOf(r.root)).toContain('A stored, sourced explanation.');
    expect(textOf(r.root)).toContain('Stored explanation');
    expect(byData(r, 'picker-follow-up')).toHaveLength(1);
  });

  it.each([
    ['STALE', 'Sources for this story have changed since this explanation was written.'],
    ['PARTIAL', 'Parts of this explanation are not supported by available sources.'],
    ['INSUFFICIENT', 'The available sources were not enough to support a full explanation.'],
  ])('S05 %s: readable WITH its notice (Erratum E1 Q3)', async (state, notice) => {
    const view = { ...base, state, brief: brief({ conclusion: state === 'STALE' ? 'READY' : (state as never), coverageGaps: ['No local source.'] }), lastAttemptFailure: null } as StoryBriefView;
    const { r } = await openStory(view);
    expect(textOf(r.root)).toContain('A stored, sourced explanation.');
    expect(textOf(r.root)).toContain(notice);
    if (state === 'INSUFFICIENT') expect(textOf(byData(r, 'picker-gaps')[0])).toContain('No local source.');
  });

  it.each([
    ['CHECKING', { ...base, state: 'CHECKING', inspectable: null }, 'An explanation is being checked.'],
    ['NONE', { ...base, state: 'NONE' }, 'No stored explanation for this story yet.'],
    ['FAILED', { ...base, state: 'FAILED', failureKind: 'EXECUTION_FAILED' }, 'Stored explanations aren’t available right now.'],
    ['gate off', { ok: false, reason: 'OFF' }, 'Stored explanations aren’t available right now.'],
  ])('S05 %s: a notice only, no explanation content', async (_label, view, notice) => {
    const { r } = await openStory(view as never);
    expect(textOf(r.root)).toContain(notice);
    expect(byData(r, 'picker-brief')).toHaveLength(0);
    expect(byData(r, 'picker-ask-about')).toHaveLength(1);
  });

  it('S06: no storyId → article reference only; NO brief read, NO ensure POST; Read original is a safe new-tab link', async () => {
    const opened = await openWith([card({ storyId: null })]);
    await act(async () => {
      byData(opened.r, 'picker-row')[0].props.onClick();
    });
    expect(readStoryBrief).not.toHaveBeenCalled();
    expect(ensureStoryForArticle).not.toHaveBeenCalled();
    expect(textOf(byData(opened.r, 'picker-notice-no-story-id')[0])).toBe('This article isn’t linked to a stored story yet. You can still ask about it.');
    const link = byData(opened.r, 'picker-read-original')[0];
    expect(link.props).toMatchObject({ href: 'https://publisher.example/a', target: '_blank', rel: 'noopener noreferrer' });
  });

  it('"Ask about this story" STAGES a draft (G2-7) and sends nothing', async () => {
    const opened = await openWith([card({ storyId: null })]);
    await act(async () => {
      byData(opened.r, 'picker-row')[0].props.onClick();
    });
    await act(async () => {
      byData(opened.r, 'picker-ask-about')[0].props.onClick();
    });
    expect(opened.onStageDraft).toHaveBeenCalledWith('Explain this story: Fuel prices rise in Kigali');
    expect(accountFetch).toHaveBeenCalledTimes(1); /* the one search; nothing posted */
  });
});

describe('D2 · Choose a place (CLEARED fixture)', () => {
  async function choose(dataAsk: string) {
    let r!: ReactTestRenderer;
    await act(async () => {
      r = create(createElement(ChoosePlace, { locale: 'en' as DisplayLocale }));
    });
    return r;
  }

  it('a coverage region reads the existing bounded browse (q="" + region) and lists rows', async () => {
    accountFetch.mockResolvedValue(ok({ results: [card({})] }));
    const r = await choose('x');
    await act(async () => {
      byData(r, 'place-region:european-union')[0].props.onClick();
    });
    expect(accountFetch).toHaveBeenCalledWith('/stories/search?q=&region=region%3Aeuropean-union&scope=home');
    expect(textOf(byData(r, 'place-rows')[0])).toContain('Fuel prices rise in Kigali');
  });

  it('a single country states the missing read path (S07 NEEDS_BACKEND) — never simulated rows', async () => {
    const r = await choose('x');
    await act(async () => {
      byData(r, 'place-search')[0].props.onChange({ target: { value: 'poland' } });
    });
    await act(async () => {
      byData(r, 'place-matches')[0].findAll((n) => n.type === 'button')[0].props.onClick();
    });
    expect(byData(r, 'place-notice-no-single-country-read')).toHaveLength(1);
    expect(accountFetch).not.toHaveBeenCalled();
  });
});
