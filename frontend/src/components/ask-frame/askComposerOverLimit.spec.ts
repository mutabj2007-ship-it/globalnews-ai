import { createElement, useState, type JSX } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import {
  ASK_QUESTION_MAX_CHARS,
  askQuestionLength,
  askQuestionOverLimit,
} from '@/lib/ask/askQuestionLength';
import { ASK_KEPT_QUESTION_KEY, keepQuestion, readKeptQuestion } from '@/lib/ask/askKeptQuestion';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * H PROD-1 — THE MAIN ASK COMPOSER OVER THE 1,000-CHARACTER BOUND
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Production backend accepts at most 1,000 characters (ask-v2.dto.ts `@Length(2, 1000)`) and
 * that stays authoritative. The composer used `maxLength={1000}`, so a longer draft lost its
 * overflow SILENTLY while Send stayed live (STATE-MATRIX §1 "toolong"). Now the whole draft stays,
 * the count and the limit are disclosed, and Send waits until the reader shortens it.
 * The dock composer's half of this contract is in components/ask/askDockRequestCount.spec.ts.
 */

jest.mock('@/components/ui/AdaptiveTextarea', () => {
  const react = jest.requireActual('react');
  return {
    AdaptiveTextarea: react.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      react.createElement('textarea', { ...props, ref }),
    ),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Composer } = require('./AskParts') as typeof import('./AskParts');

const onSubmit = jest.fn();
let renderer: ReactTestRenderer | undefined;

function Harness({ initial, locale }: { readonly initial: string; readonly locale: 'en' | 'fr' }): JSX.Element {
  const [value, setValue] = useState(initial);
  return createElement(Composer, {
    value,
    onChange: setValue,
    inputLabel: 'Question',
    placeholder: 'Ask',
    submitLabel: 'Ask',
    costNote: 'cost',
    onSubmit,
    maxHeight: 220,
    locale,
    overLimitMessage: askShellStrings(locale).askR2Strings.questionOverLimit,
  });
}

const mount = (initial = '', locale: 'en' | 'fr' = 'en'): void => {
  act(() => {
    renderer = create(createElement(Harness, { initial, locale }));
  });
};
const byAsk = (value: string): ReactTestInstance[] =>
  (renderer as ReactTestRenderer).root.findAll((node) => node.props['data-ask'] === value && typeof node.type === 'string');
const field = (): ReactTestInstance => byAsk('composer-input')[0];
const sendButton = (): ReactTestInstance => byAsk('send')[0];
const notice = (): ReactTestInstance[] => byAsk('question-over-limit');
const type = (value: string): void => {
  act(() => {
    field().props.onChange({ target: { value } });
  });
};
const submitForm = (): void => {
  act(() => {
    byAsk('composer')[0].props.onSubmit({ preventDefault() {} });
  });
};
const textOf = (node: ReactTestInstance | string): string =>
  typeof node === 'string' ? node : node.children.map(textOf).join('');
const chars = (n: number): string => 'a'.repeat(n);

beforeEach(() => onSubmit.mockReset());
afterEach(() => {
  const mounted = renderer;
  renderer = undefined;
  if (mounted !== undefined) act(() => mounted.unmount());
});

describe('H PROD-1 — the length rule', () => {
  it('the bound is the Production backend’s 1,000', () => {
    expect(ASK_QUESTION_MAX_CHARS).toBe(1000);
  });

  it('measures what is sent: the trimmed draft', () => {
    expect(askQuestionLength(`  ${chars(1000)}\n\n`)).toBe(1000);
    expect(askQuestionOverLimit(`  ${chars(1000)}\n\n`)).toBe(false);
  });

  it('counts code points, never fewer than the server counts', () => {
    /* One emoji is a surrogate pair: two UTF-16 units, one character to the server. */
    const emoji = '\u{1F30D}';
    expect(askQuestionLength(emoji.repeat(1000))).toBe(1000);
    expect(askQuestionOverLimit(emoji.repeat(1000))).toBe(false);
    expect(askQuestionOverLimit(emoji.repeat(1001))).toBe(true);
  });

  it('999 and 1,000 are within the bound; 1,001 is over it', () => {
    expect(askQuestionOverLimit(chars(999))).toBe(false);
    expect(askQuestionOverLimit(chars(1000))).toBe(false);
    expect(askQuestionOverLimit(chars(1001))).toBe(true);
  });
});

describe('H PROD-1 — main Ask composer', () => {
  it('has no maxLength: the browser can no longer cut the draft', () => {
    mount();
    expect(field().props.maxLength).toBeUndefined();
  });

  it('999 characters → Send enabled, no notice', () => {
    mount();
    type(chars(999));
    expect(sendButton().props.disabled).toBe(false);
    expect(notice()).toHaveLength(0);
  });

  it('exactly 1,000 characters → Send enabled and submit is handed on', () => {
    mount();
    type(chars(1000));
    expect(sendButton().props.disabled).toBe(false);
    expect(notice()).toHaveLength(0);
    submitForm();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('1,001 characters → full draft preserved, Send disabled, count and governed copy shown', () => {
    mount();
    const draft = chars(1001);
    type(draft);
    expect(field().props.value).toBe(draft);
    expect(field().props.value).toHaveLength(1001);
    expect(sendButton().props.disabled).toBe(true);
    expect(notice()).toHaveLength(1);
    expect(notice()[0].props.role).toBe('alert');
    expect(textOf(notice()[0])).toContain('1,001 / 1,000');
    expect(textOf(notice()[0])).toContain('Your question must be 1,000 characters or fewer.');
    expect(field().props['aria-invalid']).toBe(true);
    expect(field().props['aria-describedby']).toBe(notice()[0].props.id);
    /* Enter / requestSubmit bypass a disabled button: the form handler refuses too. */
    submitForm();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field().props.value).toBe(draft);
  });

  it('editing 1,001 → 1,000 re-enables Send and removes the notice', () => {
    mount();
    type(chars(1001));
    expect(sendButton().props.disabled).toBe(true);
    type(chars(1000));
    expect(sendButton().props.disabled).toBe(false);
    expect(notice()).toHaveLength(0);
    expect(field().props['aria-invalid']).toBeUndefined();
    submitForm();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('a pasted long text arrives whole — no substring, no truncation', () => {
    mount();
    const pasted = `${'Long pasted briefing paragraph. '.repeat(150)}Finish with three practical steps.`;
    type(pasted);
    expect(field().props.value).toBe(pasted);
    expect(String(field().props.value).endsWith('Finish with three practical steps.')).toBe(true);
    expect(sendButton().props.disabled).toBe(true);
  });

  it('multiline text keeps its line breaks; the limit applies to the whole text', () => {
    mount();
    const under = `${chars(400)}\n${chars(400)}\n${chars(198)}`;
    type(under);
    expect(field().props.value).toBe(under);
    expect(sendButton().props.disabled).toBe(false);
    const over = `${under}\nb`;
    type(over);
    expect(field().props.value).toBe(over);
    expect(String(field().props.value).split('\n')).toHaveLength(4);
    expect(sendButton().props.disabled).toBe(true);
  });

  it('a restored over-limit draft opens in the over-limit state', () => {
    mount(chars(1500));
    expect(field().props.value).toHaveLength(1500);
    expect(sendButton().props.disabled).toBe(true);
    expect(notice()).toHaveLength(1);
  });

  it('the count and the limit are written in the reader’s own number format', () => {
    mount(chars(1001), 'fr');
    const text = textOf(notice()[0]);
    const fr = new Intl.NumberFormat('fr');
    expect(text).toContain(`${fr.format(1001)} / ${fr.format(1000)}`);
    expect(text).toContain(fr.format(1000));
    expect(text).not.toContain('Your question');
  });
});

describe('H PROD-1 — a kept question survives sign-in whole', () => {
  const store = new Map<string, string>();
  beforeAll(() => {
    Object.assign(globalThis, {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });
  beforeEach(() => store.clear());

  it('keeps and restores an over-limit draft without cutting it', () => {
    const draft = chars(1400);
    keepQuestion(draft);
    expect(store.get(ASK_KEPT_QUESTION_KEY)).toHaveLength(1400);
    expect(readKeptQuestion()).toBe(draft);
  });
});
