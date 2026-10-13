import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { DisplayLocale } from '@globalnews-ai/shared';

/*
  CTO R23 — PO phone defect: "Explain a story" had no way forward from its search field. Under the
  REAL gate (PICKER_PUBLISHER_CONTENT = 'HOLD', not mocked here) no story row can ever appear, so the
  picker must offer a visible exit back into Ask that only STAGES the reader's words, never sends.
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
import { r23PickerStrings, r23PickerStringsFellBack } from '@/lib/ask/r23PickerStrings';

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
    byData(r, 'picker-search')[0].props.onChange({ target: { value } });
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

describe('R23 · the picker always offers a way back into Ask (real HOLD gate)', () => {
  it('the gate under test is the real one: HOLD', () => {
    expect(PICKER_PUBLISHER_CONTENT).toBe('HOLD');
  });

  it('empty search: "Ask a question" is visible; pressing it stages NO text (nothing invented) and sends nothing', async () => {
    const { r, onStageDraft, onClose } = await open();
    const cta = byData(r, 'picker-continue');
    expect(cta).toHaveLength(1);
    expect(textOf(cta[0])).toBe('Ask a question');
    expect(cta[0].props['data-staged']).toBe('none');
    expect(byData(r, 'picker-continue-text')).toHaveLength(0);
    await act(async () => {
      cta[0].props.onClick();
    });
    expect(onStageDraft).toHaveBeenCalledTimes(1);
    expect(onStageDraft).toHaveBeenCalledWith('');
    expect(onClose).not.toHaveBeenCalled();
    expect(accountFetch).not.toHaveBeenCalled();
  });

  it('typed query under the rights HOLD: the notice stays truthful, no row appears, and the CTA carries the exact words', async () => {
    const { r, onStageDraft } = await open();
    await type(r, '  fuel prices in Kigali  ');
    expect(textOf(byData(r, 'picker-notice-rights-hold')[0])).toBe('Stories can’t be listed here while source permissions are reviewed.');
    expect(byData(r, 'picker-row')).toHaveLength(0);
    const cta = byData(r, 'picker-continue')[0];
    expect(cta.props['data-staged']).toBe('typed');
    expect(textOf(byData(r, 'picker-continue-text')[0])).toBe('“fuel prices in Kigali”');
    await act(async () => {
      cta.props.onClick();
    });
    /* the reader's words, trimmed of surrounding spaces only; staged UNSENT by the parent */
    expect(onStageDraft).toHaveBeenCalledWith('fuel prices in Kigali');
    /* no provider, model or account request from opening, typing or the action */
    expect(accountFetch).not.toHaveBeenCalled();
    expect(readStoryBrief).not.toHaveBeenCalled();
    expect(ensureStoryForArticle).not.toHaveBeenCalled();
  });

  it('a one-character query still has the action (the min-characters notice stays)', async () => {
    const { r, onStageDraft } = await open();
    await type(r, 'k');
    expect(byData(r, 'picker-notice-min-chars')).toHaveLength(1);
    await act(async () => {
      byData(r, 'picker-continue')[0].props.onClick();
    });
    expect(onStageDraft).toHaveBeenCalledWith('k');
    expect(accountFetch).not.toHaveBeenCalled();
  });

  it('an unsent question already in Ask is KEPT, the conflict is shown, and replacing it is an explicit choice', async () => {
    const onReplaceDraft = jest.fn();
    const { r, onStageDraft } = await open({ existingDraft: 'What changed in Rwanda?', onReplaceDraft });
    await type(r, 'fuel prices');
    expect(textOf(byData(r, 'picker-draft-kept')[0])).toBe('Your unsent question stays in the Ask box.');
    /* the primary action does not carry the search words when they would not be applied */
    expect(byData(r, 'picker-continue')[0].props['data-staged']).toBe('none');
    expect(byData(r, 'picker-continue-text')).toHaveLength(0);
    await act(async () => {
      byData(r, 'picker-continue')[0].props.onClick();
    });
    expect(onStageDraft).toHaveBeenCalledWith('');
    expect(onReplaceDraft).not.toHaveBeenCalled();
    const replace = byData(r, 'picker-replace-draft')[0];
    expect(textOf(replace)).toBe('Use the search words instead“fuel prices”');
    await act(async () => {
      replace.props.onClick();
    });
    expect(onReplaceDraft).toHaveBeenCalledWith('fuel prices');
    expect(accountFetch).not.toHaveBeenCalled();
  });

  it('no conflict is shown when the unsent question is empty, identical, or the parent offers no replace', async () => {
    for (const props of [
      { existingDraft: '   ', onReplaceDraft: jest.fn() },
      { existingDraft: 'fuel prices', onReplaceDraft: jest.fn() },
      { existingDraft: 'something else' },
    ]) {
      const { r } = await open(props);
      await type(r, 'fuel prices');
      expect(byData(r, 'picker-draft-kept')).toHaveLength(0);
      expect(byData(r, 'picker-replace-draft')).toHaveLength(0);
    }
  });

  it('Enter in the search field never submits or stages anything (only the explicit action does)', async () => {
    const { r, onStageDraft, onClose } = await open();
    await type(r, 'fuel prices');
    const dialog = r.root.find((n) => n.props.role === 'dialog');
    const preventDefault = jest.fn();
    await act(async () => {
      dialog.props.onKeyDown({ key: 'Enter', shiftKey: false, preventDefault, stopPropagation: jest.fn(), currentTarget: { querySelectorAll: () => [] } });
    });
    expect(onStageDraft).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(accountFetch).not.toHaveBeenCalled();
  });

  it('Escape still closes without staging', async () => {
    const { r, onStageDraft, onClose } = await open();
    await type(r, 'fuel prices');
    const dialog = r.root.find((n) => n.props.role === 'dialog');
    await act(async () => {
      dialog.props.onKeyDown({ key: 'Escape', stopPropagation: jest.fn() });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onStageDraft).not.toHaveBeenCalled();
  });

  it('focus trap: Tab from the last control (the new action) wraps to the first, Shift-Tab from the first wraps to it', async () => {
    const { r } = await open();
    const dialog = r.root.find((n) => n.props.role === 'dialog');
    const first = { focus: jest.fn() };
    const middle = { focus: jest.fn() };
    const last = { focus: jest.fn() };
    const g = globalThis as unknown as { document?: { activeElement: unknown } };
    const previous = g.document;
    try {
      g.document = { activeElement: last };
      const forward = jest.fn();
      dialog.props.onKeyDown({ key: 'Tab', shiftKey: false, preventDefault: forward, currentTarget: { querySelectorAll: () => [first, middle, last] } });
      expect(forward).toHaveBeenCalled();
      expect(first.focus).toHaveBeenCalled();
      g.document = { activeElement: first };
      const backward = jest.fn();
      dialog.props.onKeyDown({ key: 'Tab', shiftKey: true, preventDefault: backward, currentTarget: { querySelectorAll: () => [first, middle, last] } });
      expect(backward).toHaveBeenCalled();
      expect(last.focus).toHaveBeenCalled();
    } finally {
      g.document = previous;
    }
  });

  it('the action is a real <button type="button"> with a visible label (its accessible name), in a footer outside the scroll area', async () => {
    const { r } = await open();
    const cta = byData(r, 'picker-continue')[0];
    expect(cta.type).toBe('button');
    expect(cta.props.type).toBe('button');
    const foot = byData(r, 'picker-continue-foot')[0];
    expect(foot.type).toBe('footer');
    expect(foot.findAll((n) => n.props['data-ask'] === 'picker-continue')).toHaveLength(1);
  });

  it('every locale: the label is the Ask composer\'s own approved "Ask a question" copy, RTL for Arabic', async () => {
    const expected: Record<string, string> = {
      en: 'Ask a question',
      pl: 'Zadaj pytanie',
      fr: 'Poser une question',
      de: 'Eine Frage stellen',
      es: 'Hacer una pregunta',
      pt: 'Fazer uma pergunta',
      ar: 'اطرح سؤالًا',
    };
    for (const [locale, label] of Object.entries(expected)) {
      expect(r23PickerStrings(locale as DisplayLocale).askLabel).toBe(label);
      const { r } = await open({}, locale);
      expect(textOf(byData(r, 'picker-continue')[0])).toBe(label);
      if (locale === 'ar') expect(r.root.find((n) => n.props.role === 'dialog').props.dir).toBe('rtl');
    }
    /* the two conflict strings are English everywhere but EN: declared, not hidden */
    expect(r23PickerStringsFellBack('en' as DisplayLocale)).toBe(false);
    expect(r23PickerStringsFellBack('pl' as DisplayLocale)).toBe(true);
  });
});
