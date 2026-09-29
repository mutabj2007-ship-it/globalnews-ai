import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * ALPHA VISUAL ACCEPTANCE REPAIR R1 — the standalone shell's three runtime defects, rendered
 * with the REAL AskNavProvider / AskNavShell / AskShellFrame and the boundary mocked:
 *
 *   A  New question on an Ask conversation surface clears the conversation and loads a clean
 *      Ask document — no thread, no request of its own.
 *   B  Sign out removes the signed-in answer from the screen IMMEDIATELY (before the sign-out
 *      request even resolves), then loads a clean signed-out Ask document.
 *   H  Changing language persists it AND refreshes the server-rendered page at once.
 */
const mockPathname = { value: '/ask' };
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({ refresh: mockRefresh, push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('next/link', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ children, prefetch: _p, ...rest }: Record<string, unknown>) =>
      h('a', rest, children),
  };
});
const mockSignOut = jest.fn();
const mockAccount = { user: { id: 'u', email: 'r@example.invalid', displayName: null } as unknown };
jest.mock('@/lib/hooks/useAccount', () => ({
  useAccount: () => ({
    user: mockAccount.user,
    isLoading: false,
    signOut: mockSignOut,
    deleteAccount: jest.fn(),
    refresh: jest.fn(),
  }),
}));
const mockPersist = jest.fn();
jest.mock('@/lib/i18n/languages', () => ({
  ...jest.requireActual('@/lib/i18n/languages'),
  persistLanguageSelection: (...args: unknown[]) => mockPersist(...args),
}));
jest.mock('@/components/search/LanguageSelector', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    LanguageSelector: (props: {
      onChange: (l: string) => void;
      anchor?: string;
      variant?: string;
    }) =>
      h('button', {
        'data-test': 'language',
        'data-anchor': props.anchor ?? 'header',
        'data-variant': props.variant,
        onClick: () => props.onChange('pl'),
      }),
  };
});
/* The frame itself is the private content under test: a stub that shows an answer. */
jest.mock('@/components/ask-frame/AskFrameScreen', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AskFrameScreen: () =>
      h('main', { 'data-ask': 'frame-screen' }, 'PRIVATE ANSWER: the president of Rwanda is …'),
  };
});
jest.mock('./askNav.module.css', () => ({ shell: 'shell', drawer: 'drawer' }));

import { AskNavProvider, AskNavShell } from './AskNavShell';
import { AskShellFrame } from './AskShellFrame';
import { askLocation } from '@/lib/ask/askCleanNavigation';

const assign = jest.spyOn(askLocation, 'assign').mockImplementation(() => undefined);

beforeAll(() => {
  (globalThis as unknown as { document: unknown }).document = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    querySelector: () => null,
    activeElement: null,
  };
});
beforeEach(() => {
  jest.clearAllMocks();
  mockPathname.value = '/ask';
  mockAccount.user = { id: 'u', email: 'r@example.invalid', displayName: null };
});

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      createElement(
        AskNavProvider,
        null,
        createElement(AskNavShell, { language: 'en' }),
        createElement(AskShellFrame, { locale: 'en' }),
      ),
    );
  });
  return tree;
}
const text = (tree: ReactTestRenderer): string => JSON.stringify(tree.toJSON());
const click = (event: Partial<Record<string, unknown>> = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  preventDefault: jest.fn(),
  ...event,
});

describe('A — New question actually starts a new question', () => {
  it.each(['/ask', '/'])(
    'on %s: clears the conversation at once and loads a clean Ask document',
    (path) => {
      mockPathname.value = path;
      const tree = render();
      expect(text(tree)).toContain('PRIVATE ANSWER');
      const link = tree.root.findAll(
        (n) => n.type === 'a' && n.props['data-ask-nav-id'] === 'new-question',
      )[0]!;
      const event = click();
      act(() => link.props.onClick(event));
      expect(event.preventDefault).toHaveBeenCalled();
      expect(text(tree)).not.toContain('PRIVATE ANSWER');
      expect(tree.root.findAll((n) => n.props['data-ask'] === 'cleared')).toHaveLength(1);
      expect(assign).toHaveBeenCalledWith(path === '/' ? '/' : '/ask');
      /* no sign-out, no language write, no refresh: New question asks nothing of its own */
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(mockPersist).not.toHaveBeenCalled();
    },
  );

  it('elsewhere (Recent) it is an ordinary route change — the /ask frame mounts fresh', () => {
    mockPathname.value = '/ask/recent';
    const tree = render();
    const link = tree.root.findAll(
      (n) => n.type === 'a' && n.props['data-ask-nav-id'] === 'new-question',
    )[0]!;
    const event = click();
    act(() => link.props.onClick(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('a modified click (new tab) keeps the browser behaviour', () => {
    const tree = render();
    const link = tree.root.findAll(
      (n) => n.type === 'a' && n.props['data-ask-nav-id'] === 'new-question',
    )[0]!;
    const event = click({ ctrlKey: true });
    act(() => link.props.onClick(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('B — Sign out removes the private answer immediately', () => {
  it('signed-in answer → Sign out → answer text absent BEFORE the request resolves → clean /ask', async () => {
    let finish!: () => void;
    mockSignOut.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    const tree = render();
    expect(text(tree)).toContain('PRIVATE ANSWER');
    /* open the account disclosure, then press Sign out */
    const account = tree.root.find(
      (n) => n.type === 'button' && n.props['aria-controls'] === 'ask-nav-account-panel',
    );
    act(() => account.props.onClick());
    const signOut = tree.root.find(
      (n) => n.type === 'button' && n.props['data-ask-nav-id'] === 'sign-out',
    );
    act(() => {
      signOut.props.onClick();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(text(tree)).not.toContain('PRIVATE ANSWER');
    expect(assign).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(assign).toHaveBeenCalledWith('/ask');
  });

  it('a failed sign-out request still leaves nothing private on screen, and the fresh load tells the truth', async () => {
    mockSignOut.mockRejectedValue(new Error('network'));
    const tree = render();
    act(() =>
      tree.root
        .find((n) => n.type === 'button' && n.props['aria-controls'] === 'ask-nav-account-panel')
        .props.onClick(),
    );
    await act(async () => {
      await tree.root
        .find((n) => n.type === 'button' && n.props['data-ask-nav-id'] === 'sign-out')
        .props.onClick();
    });
    expect(text(tree)).not.toContain('PRIVATE ANSWER');
    expect(assign).toHaveBeenCalledWith('/ask');
  });
});

describe('H — language changes immediately, with no AI', () => {
  it('persists the choice and refreshes the server-rendered page in the same step', () => {
    const tree = render();
    const desktop = tree.root.findAll((n) => n.props['data-test'] === 'language')[0]!;
    act(() => desktop.props.onClick());
    expect(mockPersist).toHaveBeenCalledWith('pl');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
    /* the conversation is kept — a language change is not a New question */
    expect(text(tree)).toContain('PRIVATE ANSWER');
  });

  it('the desktop control keeps the platform anchor; only the drawer anchors to itself', () => {
    const tree = render();
    const [desktop] = tree.root.findAll((n) => n.props['data-test'] === 'language');
    expect(desktop!.props['data-anchor']).toBe('header');
  });
});
