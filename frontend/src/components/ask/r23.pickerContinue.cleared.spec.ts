import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { DisplayLocale, HomeStoryCard } from '@globalnews-ai/shared';

/*
  CTO R23 — FIXTURE POSITIVE CONTROLS with the publisher-content gate MOCKED to CLEARED (the real gate
  stays HOLD; see r23.pickerContinue.spec.ts). The five search states stay distinct and truthful, the
  way back into Ask is present in every one of them, and the "Ask about this story" path is unchanged.
*/
jest.mock('@/lib/rights/pickerPublisherContent', () => ({ PICKER_PUBLISHER_CONTENT: 'CLEARED' }));
const accountFetch = jest.fn();
jest.mock('@/lib/api/accountFetch', () => ({ accountFetch: (...args: unknown[]) => accountFetch(...args) }));
const readStoryBrief = jest.fn();
const ensureStoryForArticle = jest.fn();
jest.mock('@/lib/api/storyBriefApi', () => ({
  readStoryBrief: (...a: unknown[]) => readStoryBrief(...a),
  ensureStoryForArticle: (...a: unknown[]) => ensureStoryForArticle(...a),
}));

// eslint-disable-next-line import/first
import { StoryPicker } from './StoryPicker';

const card = (over: Partial<HomeStoryCard>): HomeStoryCard =>
  ({
    articleRef: 'a'.repeat(64), storyId: null, url: 'https://publisher.example/a', title: 'Fuel prices rise in Kigali',
    summary: 'SUMMARY MUST NOT BE SHOWN', imageUrl: 'https://publisher.example/a.jpg', publisher: 'Example Wire', sourceId: 'src-1',
    publishedAt: '2026-10-10T08:00:00Z', publishedAtBasis: 'publisher', firstSeenAt: '2026-10-10T09:00:00Z', category: 'business',
    primaryDomain: 'business', domains: ['business'], ...over,
  }) as HomeStoryCard;

const textOf = (node: ReactTestInstance): string => node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const byData = (r: ReactTestRenderer, value: string) => r.root.findAll((n) => n.props['data-ask'] === value && typeof n.type === 'string');

beforeEach(() => {
  jest.useFakeTimers();
  accountFetch.mockReset();
  readStoryBrief.mockReset();
  ensureStoryForArticle.mockReset();
});
afterEach(() => jest.useRealTimers());

async function search(query: string) {
  const onStageDraft = jest.fn();
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(createElement(StoryPicker, { locale: 'en' as DisplayLocale, onClose: jest.fn(), onStageDraft }));
  });
  await act(async () => {
    byData(r, 'picker-search')[0].props.onChange({ target: { value: query } });
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { r, onStageDraft };
}

describe('R23 · five distinct truthful states, each with the way back into Ask (gate mocked CLEARED)', () => {
  it.each([
    ['too short', 'k', () => undefined, 'picker-notice-min-chars'],
    ['no matching checked coverage', 'fuel prices', () => accountFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [] }) }), 'picker-notice-no-story'],
    ['gate off / unavailable (404)', 'fuel prices', () => accountFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }), 'picker-notice-unavailable'],
    ['network failure', 'fuel prices', () => accountFetch.mockRejectedValue(new Error('offline')), 'picker-notice-network'],
  ])('%s → its own notice, and the action stages the typed words', async (_label, query, arrange, notice) => {
    arrange();
    const { r, onStageDraft } = await search(query);
    expect(byData(r, notice)).toHaveLength(1);
    for (const other of ['picker-notice-min-chars', 'picker-notice-no-story', 'picker-notice-unavailable', 'picker-notice-network', 'picker-notice-rights-hold']) {
      if (other !== notice) expect(byData(r, other)).toHaveLength(0);
    }
    await act(async () => {
      byData(r, 'picker-continue')[0].props.onClick();
    });
    expect(onStageDraft).toHaveBeenCalledWith(query);
    /* the action itself issues no request: at most the ONE read-only search GET the typing made */
    for (const call of accountFetch.mock.calls) expect(String(call[0])).toMatch(/^\/stories\/search\?/);
    expect(accountFetch.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('"Ask about this story" after a cleared row is unchanged: it stages the story context and sends nothing', async () => {
    accountFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [card({})] }) });
    const { r, onStageDraft } = await search('fuel prices');
    await act(async () => {
      byData(r, 'picker-row')[0].props.onClick();
    });
    /* the story view has its own footer; the search view's way back is not duplicated there */
    expect(byData(r, 'picker-continue')).toHaveLength(0);
    await act(async () => {
      byData(r, 'picker-ask-about')[0].props.onClick();
    });
    expect(onStageDraft).toHaveBeenCalledTimes(1);
    expect(onStageDraft.mock.calls[0][0]).toMatch(/Fuel prices rise in Kigali$/);
    expect(ensureStoryForArticle).not.toHaveBeenCalled();
    expect(textOf(r.root)).not.toContain('SUMMARY MUST NOT BE SHOWN');
  });
});
