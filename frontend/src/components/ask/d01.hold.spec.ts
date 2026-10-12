import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { DisplayLocale } from '@globalnews-ai/shared';

/*
  ASK D0.1 — D1 story picker and D2 Choose a place under the REAL default gate (HOLD).
  Negative controls: with the publisher-content gate on HOLD, no search, feed or brief request is
  made and no publisher title can appear; browsing never follows; nothing is sent to Ask.
*/
jest.mock('next/link', () => {
  const { createElement: h } = jest.requireActual('react');
  return { __esModule: true, default: ({ href, children, ...rest }: { href: string; children: unknown }) => h('a', { href, ...rest }, children) };
});
const accountFetch = jest.fn();
jest.mock('@/lib/api/accountFetch', () => ({ accountFetch: (...args: unknown[]) => accountFetch(...args) }));
const readStoryBrief = jest.fn();
const ensureStoryForArticle = jest.fn();
jest.mock('@/lib/api/storyBriefApi', () => ({ readStoryBrief: (...a: unknown[]) => readStoryBrief(...a), ensureStoryForArticle: (...a: unknown[]) => ensureStoryForArticle(...a) }));
const follow = jest.fn(async () => undefined);
jest.mock('@/components/home/useCountryFollows', () => ({
  useCountryFollows: () => ({ follows: ['KEN'], maxFollows: 10, isLoading: false, pendingCountry: null, failedCountry: null, follow, unfollow: jest.fn() }),
}));

// eslint-disable-next-line import/first
import { PICKER_PUBLISHER_CONTENT } from '@/lib/rights/pickerPublisherContent';
// eslint-disable-next-line import/first
import { searchPickerStories, browseRegionStories } from '@/lib/api/storyPickerApi';
// eslint-disable-next-line import/first
import { StoryPicker } from './StoryPicker';
// eslint-disable-next-line import/first
import { ChoosePlace } from './ChoosePlace';
// eslint-disable-next-line import/first
import { isStandalonePath } from '@/lib/routing/standaloneRouteGate';

const textOf = (node: ReactTestInstance): string => node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const byData = (r: ReactTestRenderer, value: string) => r.root.findAll((n) => n.props['data-ask'] === value && typeof n.type === 'string');

beforeEach(() => {
  jest.useFakeTimers();
  accountFetch.mockReset();
  readStoryBrief.mockReset();
  ensureStoryForArticle.mockReset();
  follow.mockClear();
});
afterEach(() => jest.useRealTimers());

async function type(r: ReactTestRenderer, dataAsk: string, value: string): Promise<void> {
  await act(async () => {
    byData(r, dataAsk)[0].props.onChange({ target: { value } });
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

describe('D0.1 gate default', () => {
  it('the publisher-content gate defaults to HOLD (flipping it needs an E1 per-use clearance)', () => {
    expect(PICKER_PUBLISHER_CONTENT).toBe('HOLD');
  });

  it('HOLD: search and region browse make NO request and answer RIGHTS_HOLD', async () => {
    await expect(searchPickerStories('fuel prices')).resolves.toEqual({ kind: 'RIGHTS_HOLD' });
    await expect(browseRegionStories('region:east-africa')).resolves.toEqual({ kind: 'RIGHTS_HOLD' });
    expect(accountFetch).not.toHaveBeenCalled();
  });

  it('under 2 characters is TOO_SHORT with no request (S01, N1)', async () => {
    await expect(searchPickerStories(' f ')).resolves.toEqual({ kind: 'TOO_SHORT' });
    expect(accountFetch).not.toHaveBeenCalled();
  });
});

describe('D1 story picker under HOLD', () => {
  async function open(): Promise<{ r: ReactTestRenderer; onClose: jest.Mock; onStageDraft: jest.Mock }> {
    const onClose = jest.fn();
    const onStageDraft = jest.fn();
    let r!: ReactTestRenderer;
    await act(async () => {
      r = create(createElement(StoryPicker, { locale: 'en' as DisplayLocale, onClose, onStageDraft }));
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    return { r, onClose, onStageDraft };
  }

  it('S01: opens as a dialog titled "Explain a story", empty, with the min-characters notice', async () => {
    const { r } = await open();
    const dialog = r.root.find((n) => n.props.role === 'dialog');
    expect(dialog.props['aria-modal']).toBe('true');
    expect(textOf(r.root)).toContain('Explain a story');
    expect(textOf(byData(r, 'picker-notice-min-chars')[0])).toBe('Type at least 2 characters to search stories GlobalNews AI holds.');
    expect(textOf(r.root)).toContain('Opening a story only reads it. Nothing is researched.');
  });

  it('RTL: in Arabic the dialog carries dir=rtl and lang=ar (and Choose a place too)', async () => {
    let r!: ReactTestRenderer;
    await act(async () => {
      r = create(createElement(StoryPicker, { locale: 'ar' as DisplayLocale, onClose: jest.fn(), onStageDraft: jest.fn() }));
    });
    const dialog = r.root.find((n) => n.props.role === 'dialog');
    expect([dialog.props.dir, dialog.props.lang]).toEqual(['rtl', 'ar']);
    let p!: ReactTestRenderer;
    await act(async () => {
      p = create(createElement(ChoosePlace, { locale: 'ar' as DisplayLocale }));
    });
    const main = p.root.find((n) => n.type === 'main');
    expect([main.props.dir, main.props.lang]).toEqual(['rtl', 'ar']);
  });

  it('S03: a real query shows the rights-hold notice, lists no rows, fetches nothing', async () => {
    const { r } = await open();
    await type(r, 'picker-search', 'fuel prices');
    expect(textOf(byData(r, 'picker-notice-rights-hold')[0])).toBe('Stories can’t be listed here while source permissions are reviewed.');
    expect(byData(r, 'picker-row')).toHaveLength(0);
    expect(accountFetch).not.toHaveBeenCalled();
    expect(readStoryBrief).not.toHaveBeenCalled();
    expect(ensureStoryForArticle).not.toHaveBeenCalled();
  });

  it('close calls onClose and stages nothing', async () => {
    const { r, onClose, onStageDraft } = await open();
    await act(async () => {
      byData(r, 'picker-close')[0].props.onClick();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onStageDraft).not.toHaveBeenCalled();
  });
});

describe('D2 Choose a place under HOLD', () => {
  async function render(): Promise<ReactTestRenderer> {
    let r!: ReactTestRenderer;
    await act(async () => {
      r = create(createElement(ChoosePlace, { locale: 'en' as DisplayLocale }));
    });
    return r;
  }

  it('S07: chooser with the three coverage regions and the "nothing is saved" note; back link to My updates', async () => {
    const r = await render();
    const all = textOf(r.root);
    expect(all).toContain('Choose a place');
    expect(all).toContain('Choose a place to read reporting GlobalNews AI already holds. Your location is not used.');
    expect(all).toContain('East Africa');
    expect(all).toContain('European Union · 27 member states');
    expect(all).toContain('Middle East');
    expect(textOf(byData(r, 'place-browse-note')[0])).toBe('Used for this view only. Nothing is saved to your account.');
    expect(byData(r, 'place-back')[0].props.href).toBe('/saved/updates');
  });

  it('country search filters the static registry with no request', async () => {
    const r = await render();
    await act(async () => {
      byData(r, 'place-search')[0].props.onChange({ target: { value: 'pola' } });
    });
    expect(textOf(byData(r, 'place-matches')[0])).toContain('Poland');
    expect(accountFetch).not.toHaveBeenCalled();
  });

  it('S08: choosing an unfollowed country saves nothing; Follow is explicit; rows are on rights hold', async () => {
    const r = await render();
    await act(async () => {
      byData(r, 'place-search')[0].props.onChange({ target: { value: 'poland' } });
    });
    const poland = byData(r, 'place-matches')[0].findAll((n) => n.type === 'button')[0];
    await act(async () => {
      poland.props.onClick();
    });
    expect(follow).not.toHaveBeenCalled();
    expect(textOf(r.root)).toContain('Not followed. Nothing is saved unless you choose Follow.');
    expect(textOf(byData(r, 'place-notice-rights-hold')[0])).toBe('Reports for this place are on hold while source permissions are reviewed.');
    expect(accountFetch).not.toHaveBeenCalled();
    await act(async () => {
      byData(r, 'place-follow')[0].props.onClick();
    });
    expect(follow).toHaveBeenCalledWith('POL');
  });

  it('a followed country shows as followed, without a Follow button', async () => {
    const r = await render();
    await act(async () => {
      byData(r, 'place-search')[0].props.onChange({ target: { value: 'kenya' } });
    });
    await act(async () => {
      byData(r, 'place-matches')[0].findAll((n) => n.type === 'button')[0].props.onClick();
    });
    expect(byData(r, 'place-follow')).toHaveLength(0);
    expect(byData(r, 'place-followed')).toHaveLength(1);
  });

  it('Research new changes opens Ask with a DRAFT only (no send); Change returns to the chooser', async () => {
    const r = await render();
    await act(async () => {
      byData(r, 'place-region:east-africa')[0].props.onClick();
    });
    expect(byData(r, 'place-research')[0].props.href).toBe(`/ask?q=${encodeURIComponent('What changed this week in East Africa')}`);
    expect(byData(r, 'place-follow')).toHaveLength(0);
    await act(async () => {
      byData(r, 'place-change')[0].props.onClick();
    });
    expect(byData(r, 'choose-place')).toHaveLength(1);
  });

  it('no "Added since your last visit" claim is made without the account boundary', async () => {
    const r = await render();
    await act(async () => {
      byData(r, 'place-region:middle-east')[0].props.onClick();
    });
    expect(textOf(r.root)).not.toContain('Added since your last visit');
  });
});

describe('D0.1 wiring', () => {
  it('the standalone route gate serves /saved/updates/place', () => {
    expect(isStandalonePath('/saved/updates/place')).toBe(true);
  });

  it('no D0.1 component renders an image, calls Ask, generates a Brief or ensures a Story', () => {
    for (const file of ['StoryPicker.tsx', 'ChoosePlace.tsx']) {
      const source = readFileSync(join(__dirname, file), 'utf8');
      expect({ file, hit: /<img|<Image|requestStoryBrief|ensureStoryForArticle\(|askV2Api|analyzeNews|imageUrl|summary:/.test(source) }).toEqual({ file, hit: false });
    }
  });
});
