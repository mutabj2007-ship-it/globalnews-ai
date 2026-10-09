import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { Composer } from '@/components/ask-frame/AskParts';
import { askR2Strings } from '@/lib/ask/askR2Strings';

/*
  R3 INTEGRATION (Claude Code, real-browser finding on 530808c) — R1-C says focus shows the native
  placeholder and BLUR restores the example with a full hold. In the running build the example
  never came back after one focus: the field's focus/blur handlers travelled inside `example`, which
  is undefined while the example is hidden, and focus hides it. The handlers are now wired for as
  long as rotation runs, independently of whether the example is visible.
*/
const base = {
  value: '',
  onChange: () => undefined,
  inputLabel: 'Ask',
  placeholder: 'Ask anything…',
  submitLabel: 'Send',
  maxHeight: 220 as const,
  limitCopy: askR2Strings('en') as never,
};
const field = (r: ReturnType<typeof create>) =>
  r.root.find((n) => typeof n.type !== 'string' && n.props['data-ask'] === 'composer-input');

it('with the example HIDDEN (focused), the field still reports blur to the rotation', () => {
  const onFocus = jest.fn();
  const onBlur = jest.fn();
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(createElement(Composer, { ...base, example: undefined, exampleFocus: { onFocus, onBlur } }));
  });
  act(() => field(r).props.onBlur?.({} as never));
  act(() => field(r).props.onFocus?.({} as never));
  expect(onBlur).toHaveBeenCalledTimes(1);
  expect(onFocus).toHaveBeenCalledTimes(1);
});

it('every other caller (no rotation) is unchanged: no handlers', () => {
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(createElement(Composer, base));
  });
  expect(field(r).props.onBlur).toBeUndefined();
  expect(field(r).props.onFocus).toBeUndefined();
});
