import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { DisplayLocale } from '@globalnews-ai/shared';

/*
  MASTER CTO R104 — the one-tap ask path must not show the stage-only "Nothing is sent until you
  press Send" notice (it is false there: the tap sends). The stage-only path keeps the notice.
  Every supported locale is checked.
*/
const accountFetch = jest.fn();
jest.mock('@/lib/api/accountFetch', () => ({ accountFetch: (...args: unknown[]) => accountFetch(...args) }));
const readStoryBrief = jest.fn();
const ensureStoryForArticle = jest.fn();
jest.mock('@/lib/api/storyBriefApi', () => ({
  readStoryBrief: (...a: unknown[]) => readStoryBrief(...a),
  ensureStoryForArticle: (...a: unknown[]) => ensureStoryForArticle(...a),
}));

// eslint-disable-next-line import/first
import { PICKER_PUBLISHER_CONTENT } from '@/lib/rights/pickerPublisherContent';
// eslint-disable-next-line import/first
import { StoryPicker } from './StoryPicker';
// eslint-disable-next-line import/first

const textOf = (node: ReactTestInstance): string => node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const byData = (r: ReactTestRenderer, value: string) => r.root.findAll((n) => n.props['data-ask'] === value && typeof n.type === 'string');

beforeEach(() => {
  jest.useFakeTimers();
  accountFetch.mockReset();
  readStoryBrief.mockReset();
  ensureStoryForArticle.mockReset();
});
afterEach(() => jest.useRealTimers());

async function open(props: Record<string, unknown> = {}, locale = 'en') {
  const onClose = jest.fn();
  const onStageDraft = jest.fn();
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(createElement(StoryPicker, { locale: locale as DisplayLocale, onClose, onStageDraft, ...props }));
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  return { r, onClose, onStageDraft };
}
async function type(r: ReactTestRenderer, value: string) {
  await act(async () => {
    /* MASTER CTO R38 · U-2 — under HOLD the field takes the story in the reader's own words */
    byData(r, 'picker-describe')[0].props.onChange({ target: { value } });
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

// eslint-disable-next-line import/first
import { askR38Strings } from '@/lib/ask/askR38Strings';

const LOCALES = ['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'] as const;
const pageText = (r: ReactTestRenderer) => textOf(r.root);

describe('MASTER CTO R104 — no false "nothing is sent" notice on the one-tap ask', () => {
  it('the gate under test is the real one: HOLD', () => {
    expect(PICKER_PUBLISHER_CONTENT).toBe('HOLD');
  });

  it.each(LOCALES)('%s: words typed + one-tap ask → the stage-only notice is NOT shown', async (locale) => {
    const onAsk = jest.fn();
    const { r } = await open({ onAsk }, locale);
    await type(r, 'fuel prices in Kigali');
    expect(byData(r, 'picker-continue')[0].props['data-staged']).toBe('ask');
    expect(pageText(r)).not.toContain(askR38Strings(locale as DisplayLocale).storyNothingSent);
  });

  it.each(LOCALES)('%s: empty form (the action only returns to Ask) → the notice IS shown', async (locale) => {
    const { r } = await open({ onAsk: jest.fn() }, locale);
    expect(byData(r, 'picker-continue')[0].props['data-staged']).toBe('none');
    expect(pageText(r)).toContain(askR38Strings(locale as DisplayLocale).storyNothingSent);
  });

  it.each(LOCALES)('%s: stage-only picker (no one-tap handler), words typed → the notice IS shown', async (locale) => {
    const { r } = await open({}, locale);
    await type(r, 'fuel prices in Kigali');
    expect(byData(r, 'picker-continue')[0].props['data-staged']).toBe('typed');
    expect(pageText(r)).toContain(askR38Strings(locale as DisplayLocale).storyNothingSent);
  });

  it('typing issues no request, and nothing is sent by the notice change', async () => {
    const onAsk = jest.fn();
    const { r, onStageDraft } = await open({ onAsk });
    await type(r, 'fuel prices in Kigali');
    expect(accountFetch).not.toHaveBeenCalled();
    expect(onAsk).not.toHaveBeenCalled();
    expect(onStageDraft).not.toHaveBeenCalled();
  });
});
