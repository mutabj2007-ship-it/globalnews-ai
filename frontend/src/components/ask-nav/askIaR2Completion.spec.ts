import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askSettingsR2Strings } from '@/lib/ask/askSettingsR2Strings';
import { ASK_R3_FULL_LOCALES } from '@/lib/ask/askR3FullStrings';

/*
  ASK R3 IA R2 COMPLETION — the three Design R2 requirements Claude H reported as NOT in d248d2d
  (02-REMAINING-WORK-AND-DEPENDENCIES.md), built to Claude Design's engineering handoff
  GLOBALNEWSAI-R3-SETTINGS-NAV-ENGINEERING.zip (SHA-256 57f5102e…7e5da5e22d, 26/26 manifest OK)
  over the approved board GLOBALNEWSAI-R3-IA-DISCOVER-FINAL-R2.zip (574fc35b…55e32be8):
    1. the Settings gear in the drawer's top row (Close · identity · gear);
    2. Settings in the seven approved groups, as a sheet / dialog over the current view;
    3. conversation search: Clear, the polite count, no-match, Loading, Retry.
*/

jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const react = require('react') as typeof import('react');
  return { __esModule: true, default: ({ prefetch: _p, ...props }: Record<string, unknown>) => react.createElement('a', props) };
});
jest.mock('next/navigation', () => ({
  usePathname: () => '/ask',
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));

const threads = jest.fn();
jest.mock('@/lib/api/askV2Api', () => ({
  askV2Api: {
    threads: (...args: unknown[]) => threads(...args),
    deleteThread: jest.fn(),
  },
}));

const nav = { account: 'signed-in' as 'signed-in' | 'signed-out', clear: jest.fn(), clearAndGo: jest.fn(), runNewQuestion: () => false };
jest.mock('@/components/ask-nav/AskNavShell', () => ({
  useAskNavOptional: () => nav,
}));

let account: Record<string, unknown> = {};
jest.mock('@/lib/hooks/useAccount', () => ({ useAccount: () => account }));

// eslint-disable-next-line import/first
import { AskConversations } from '@/components/ask-frame/AskConversations';
// eslint-disable-next-line import/first
import { AccountSettingsBody } from '@/components/account/AccountSettingsBody';
// eslint-disable-next-line import/first
import { AskSettingsSheet } from '@/components/account/AskSettingsSheet';

const SRC = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');
const textOf = (n: ReactTestInstance): string =>
  n.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const by = (root: ReactTestInstance, attr: string, id: string) =>
  root.findAll((n) => typeof n.type === 'string' && n.props[attr] === id);

const row = (i: number, q: string) => ({
  id: `t${i}`,
  language: 'en',
  returnPath: null,
  createdAt: '2026-10-09T08:00:00Z',
  lastActiveAt: '2026-10-09T09:00:00Z',
  turnCount: 1,
  firstQuestion: q,
  firstQuestionTruncated: false,
  latestTurnId: `u${i}`,
  latestOperationId: `op-${i}`,
});

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function mount(): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(createElement(AskConversations, { locale: 'en' }));
  });
  return r;
}
const rowsOf = (r: ReactTestRenderer) =>
  r.root.findAll((n) => typeof n.type === 'string' && n.props['data-ask-conversation'] !== undefined);
const field = (r: ReactTestRenderer) => by(r.root, 'data-ask', 'conversations-search')[0];

describe('1 · drawer top row: Close · identity · Settings gear', () => {
  const shell = read('components', 'ask-nav', 'AskNavShell.tsx');
  const head = shell.slice(shell.indexOf('<div className={styles.drawerHead}>'), shell.indexOf('data-ask-nav="conversations"'));

  it('Close first (it takes focus on open), then the identity, then the gear', () => {
    const close = head.indexOf('data-ask-nav="drawer-close"');
    const identity = head.indexOf('data-ask-nav="drawer-identity"');
    const gear = head.indexOf('data-ask-nav="drawer-settings"');
    expect(close).toBeGreaterThan(-1);
    expect(close).toBeLessThan(identity);
    expect(identity).toBeLessThan(gear);
    expect(head).toContain('ref={closeRef}');
  });

  it('the gear is the existing Settings destination, named "Settings", drawn with the supplied 22 px glyph', () => {
    const gear = head.slice(head.indexOf('<Link'), head.indexOf('</Link>'));
    expect(gear).toContain('href="/account/settings"');
    expect(gear).toContain('aria-label={s.settings}');
    expect(gear).toContain('title={s.settings}');
    expect(gear).toContain('<AskSettingsGlyph name="gear" />');
    /* never hidden or disabled; a plain click opens the sheet over this view, else the route */
    expect(gear).not.toMatch(/disabled|hidden/);
    expect(gear).toContain('isPlainClick(event)');
    expect(gear).toContain('setSettingsOpen(true)');
  });

  it('identity: the saved name or "Signed in" — never an address; a guest gets the Sign in pill', () => {
    expect(head).toContain('user !== null');
    expect(head).toContain('addressableName(user.displayName)');
    expect(head).not.toMatch(/\.email/);
    expect(head).toContain('data-ask-nav="drawer-sign-in"');
    expect(head).toContain('accountSignInUrl(pathname ?? undefined)');
  });

  it('Escape in a search field with text is left to the field; the drawer closes only on an empty one', () => {
    expect(shell).toContain("active.dataset.ask === 'conversations-search' && active.value !== ''");
  });

  it('the gear glyph is the supplied asset, verbatim', () => {
    const glyph = read('components', 'ask-frame', 'AskSettingsGlyph.tsx');
    expect(glyph).toContain('width={22} height={22} strokeWidth={1.6}');
    expect(glyph).toContain('<circle cx="12" cy="12" r="3" />');
    expect(glyph).toContain('d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83');
  });
});

describe('3 · conversation search: Clear, polite count, no match, Loading, Retry', () => {
  beforeEach(() => {
    threads.mockReset();
    nav.account = 'signed-in';
  });

  it('Clear appears only with a term, restores the list and sends nothing; the count waits for the server', async () => {
    threads.mockResolvedValueOnce({ ok: true, value: [row(1, 'Rent in Warsaw'), row(2, 'Electricity in Germany')] });
    const r = mount();
    await flush();
    expect(by(r.root, 'data-ask', 'conversations-search-clear')).toHaveLength(0);
    jest.useFakeTimers();
    threads.mockResolvedValueOnce({ ok: true, value: [row(1, 'Rent in Warsaw')] });
    act(() => field(r).props.onChange({ target: { value: 'rent' } }));
    /* not announced on the keystroke — only once the server search for this term settles */
    expect(by(r.root, 'data-ask', 'conversations-search-count')).toHaveLength(0);
    act(() => {
      jest.advanceTimersByTime(350);
    });
    await flush();
    jest.useRealTimers();
    expect(threads.mock.calls[1]).toEqual(['rent']);
    const count = by(r.root, 'data-ask', 'conversations-search-count');
    expect(count).toHaveLength(1);
    expect(count[0].props.role).toBe('status');
    expect(count[0].props['aria-live']).toBe('polite');
    expect(textOf(count[0])).toBe('1 conversation');
    const calls = threads.mock.calls.length;
    const clear = by(r.root, 'data-ask', 'conversations-search-clear');
    expect(clear).toHaveLength(1);
    expect(clear[0].props['aria-label']).toBe('Clear search');
    act(() => clear[0].props.onClick());
    expect(field(r).props.value).toBe('');
    expect(by(r.root, 'data-ask', 'conversations-search-count')).toHaveLength(0);
    expect(rowsOf(r)).toHaveLength(2);
    expect(threads.mock.calls.length).toBe(calls);
    act(() => r.unmount());
  });

  it('no match: the existing note and a Clear search pill that restores the list', async () => {
    threads.mockResolvedValue({ ok: true, value: [row(1, 'Rent in Warsaw')] });
    const r = mount();
    await flush();
    act(() => field(r).props.onChange({ target: { value: 'zzzz' } }));
    const pill = by(r.root, 'data-ask', 'conversations-search-clear-pill');
    expect(pill).toHaveLength(1);
    expect(textOf(pill[0])).toBe('Clear search');
    act(() => pill[0].props.onClick());
    expect(field(r).props.value).toBe('');
    expect(rowsOf(r)).toHaveLength(1);
    act(() => r.unmount());
  });

  it('Escape in a field with text clears it', async () => {
    threads.mockResolvedValue({ ok: true, value: [row(1, 'Rent in Warsaw')] });
    const r = mount();
    await flush();
    act(() => field(r).props.onChange({ target: { value: 'rent' } }));
    const preventDefault = jest.fn();
    act(() => field(r).props.onKeyDown({ key: 'Escape', preventDefault }));
    expect(preventDefault).toHaveBeenCalled();
    expect(field(r).props.value).toBe('');
    act(() => r.unmount());
  });

  it('first load shows the quiet Loading bars (aria-busy), no text', async () => {
    threads.mockReturnValueOnce(new Promise(() => undefined));
    const r = mount();
    const loading = by(r.root, 'data-ask', 'conversations-loading');
    expect(loading).toHaveLength(1);
    expect(loading[0].props['aria-busy']).toBe('true');
    expect(textOf(loading[0])).toBe('');
    act(() => r.unmount());
  });

  it('a failed read offers Try again, which repeats the SAME read once, even when pressed twice', async () => {
    threads.mockResolvedValueOnce({ ok: false, reason: 'NETWORK' });
    const r = mount();
    await flush();
    expect(threads).toHaveBeenCalledTimes(1);
    expect(threads.mock.calls[0]).toEqual([]);
    const retry = by(r.root, 'data-ask', 'conversations-retry');
    expect(retry).toHaveLength(1);
    expect(textOf(retry[0])).toBe('Try again');
    threads.mockResolvedValueOnce({ ok: true, value: [row(1, 'Rent in Warsaw')] });
    act(() => retry[0].props.onClick());
    /* Loading while it runs; the button stays (focus kept) but ignores a second press */
    expect(by(r.root, 'data-ask', 'conversations-loading')[0].props['aria-busy']).toBe('true');
    const busy = by(r.root, 'data-ask', 'conversations-retry');
    expect(busy[0].props['aria-disabled']).toBe('true');
    act(() => busy[0].props.onClick?.());
    await flush();
    expect(threads).toHaveBeenCalledTimes(2);
    expect(threads.mock.calls[1]).toEqual([]);
    expect(by(r.root, 'data-ask', 'conversations-retry')).toHaveLength(0);
    expect(rowsOf(r)).toHaveLength(1);
    act(() => r.unmount());
  });

  it('a signed-out answer is not offered a retry', async () => {
    threads.mockResolvedValueOnce({ ok: false, reason: 'SIGNED_OUT' });
    const r = mount();
    await flush();
    expect(by(r.root, 'data-ask', 'conversations-retry')).toHaveLength(0);
    act(() => r.unmount());
  });

  it('a failed server search keeps the local matches, with no error banner', async () => {
    threads.mockResolvedValueOnce({ ok: true, value: [row(1, 'Rent in Warsaw'), row(2, 'Electricity')] });
    const r = mount();
    await flush();
    jest.useFakeTimers();
    threads.mockResolvedValueOnce({ ok: false, reason: 'UNAVAILABLE' });
    act(() => field(r).props.onChange({ target: { value: 'rent' } }));
    act(() => {
      jest.advanceTimersByTime(350);
    });
    await flush();
    jest.useRealTimers();
    expect(threads.mock.calls[1]).toEqual(['rent']);
    expect(by(r.root, 'data-ask', 'conversations-search-incomplete')).toHaveLength(0);
    expect(rowsOf(r)).toHaveLength(1);
    expect(textOf(by(r.root, 'data-ask', 'conversations-search-count')[0])).toBe('1 conversation');
    act(() => r.unmount());
  });
});

describe('2 · Settings in the seven approved groups', () => {
  const user = { id: 'u1', email: 'reader@example.invalid', displayName: 'Amina' };
  const base = {
    isLoading: false,
    readFailed: false,
    refresh: jest.fn(() => Promise.resolve()),
    signOut: jest.fn(() => Promise.resolve()),
    deleteAccount: jest.fn(),
    updateDisplayName: jest.fn(),
  };
  const groups = (root: ReactTestInstance) =>
    root
      .findAll((n) => typeof n.type === 'string' && n.props['data-settings-group'] !== undefined)
      .map((n) => n.props['data-settings-group'] as string);
  const renderBody = (locale: DisplayLocale = 'en', chrome: 'standalone' | 'sheet' = 'standalone') => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(createElement(AccountSettingsBody, { locale, chrome }));
    });
    return r;
  };

  it('signed in: Account · Language & appearance · Privacy & data · Followed questions · Help & legal · Sign out · Delete account', () => {
    account = { ...base, user };
    const r = renderBody();
    expect(groups(r.root)).toEqual([
      'account',
      'language-appearance',
      'privacy',
      'followed',
      'help-legal',
      'sign-out',
      'delete-account',
    ]);
    const text = textOf(r.root);
    for (const label of ['Account', 'Language & appearance', 'Privacy & data', 'Followed questions', 'Help & legal'])
      expect(text).toContain(label);
    expect(text).toContain('Signs you out on this device. Your conversations stay in your account.');
    act(() => r.unmount());
  });

  it('guest: no identity, no followed questions, no sign out, no deletion — and a way to sign in', () => {
    account = { ...base, user: null };
    const r = renderBody();
    expect(groups(r.root)).toEqual(['account', 'language-appearance', 'privacy', 'help-legal']);
    expect(textOf(r.root)).not.toContain('@');
    expect(by(r.root, 'data-settings', 'guest-note')).toHaveLength(1);
    act(() => r.unmount());
  });

  it('a failed account read is reported inside the Account group only, with Try again', () => {
    account = { ...base, user: null, readFailed: true };
    const r = renderBody();
    expect(groups(r.root)).toEqual(['account', 'language-appearance', 'privacy', 'help-legal']);
    const error = by(r.root, 'data-settings', 'account-error');
    expect(error).toHaveLength(1);
    expect(textOf(error[0])).toContain('Your account details could not be loaded. Other settings still work.');
    act(() => by(r.root, 'data-settings', 'account-retry')[0].props.onClick());
    expect(base.refresh).toHaveBeenCalledTimes(1);
    expect(by(r.root, 'data-settings', 'guest-note')).toHaveLength(0);
    act(() => r.unmount());
  });

  it('Delete account is a quiet link; the unchanged Danger Zone (typed email) opens from it', () => {
    account = { ...base, user };
    const r = renderBody();
    const link = by(r.root, 'data-settings', 'delete-account-link')[0];
    expect(link.props['aria-expanded']).toBe(false);
    expect(by(r.root, 'aria-labelledby', 'danger-zone-heading')).toHaveLength(0);
    act(() => link.props.onClick());
    expect(by(r.root, 'aria-labelledby', 'danger-zone-heading')).toHaveLength(1);
    act(() => r.unmount());
  });

  it('Sign out on the route uses the governed path: visible Ask state cleared before the session ends', async () => {
    account = { ...base, user };
    base.signOut.mockClear();
    nav.clear.mockClear();
    const assign = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const clean = require('@/lib/ask/askCleanNavigation') as { askLocation: { assign: (u: string) => void } };
    const original = clean.askLocation.assign;
    clean.askLocation.assign = assign;
    const r = renderBody();
    await act(async () => {
      by(r.root, 'data-settings', 'sign-out')[0].props.onClick();
      await Promise.resolve();
    });
    expect(nav.clear).toHaveBeenCalledTimes(1);
    expect(base.signOut).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/ask');
    clean.askLocation.assign = original;
    act(() => r.unmount());
  });

  it('the address renders left-to-right and isolated, also in Arabic', () => {
    account = { ...base, user };
    const r = renderBody('ar');
    const email = r.root.findAll((n) => typeof n.type === 'string' && n.children.includes('reader@example.invalid'));
    expect(email).toHaveLength(1);
    expect(email[0].props.dir).toBe('ltr');
    expect(email[0].props.style).toEqual({ unicodeBidi: 'isolate' });
    act(() => r.unmount());
  });

  it('the sheet: a labelled modal dialog, Close first, the same seven-group body without a page heading', () => {
    account = { ...base, user };
    base.signOut.mockClear();
    const onClose = jest.fn();
    const onSignOut = jest.fn();
    /* node test environment: the sheet's keyboard listener needs a document */
    const listeners: string[] = [];
    (globalThis as { document?: unknown }).document = {
      addEventListener: (type: string) => listeners.push(type),
      removeEventListener: jest.fn(),
      activeElement: null,
    };
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        createElement(AskSettingsSheet, { locale: 'en', title: 'Settings', closeLabel: 'Close', onClose, onSignOut }),
        { createNodeMock: () => ({ focus: () => undefined, contains: () => false, querySelector: () => null, querySelectorAll: () => [] }) },
      );
    });
    const dialog = by(r.root, 'data-settings', 'sheet')[0];
    expect(dialog.props.role).toBe('dialog');
    expect(dialog.props['aria-modal']).toBe('true');
    const title = r.root.find((n) => n.type === 'h2');
    expect(dialog.props['aria-labelledby']).toBe(title.props.id);
    expect(textOf(title)).toBe('Settings');
    expect(r.root.findAll((n) => n.type === 'h1')).toHaveLength(0);
    expect(groups(r.root)).toHaveLength(7);
    act(() => by(r.root, 'data-settings', 'sign-out')[0].props.onClick());
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(base.signOut).not.toHaveBeenCalled();
    act(() => by(r.root, 'data-settings', 'close')[0].props.onClick());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(listeners).toContain('keydown');
    act(() => r.unmount());
    delete (globalThis as { document?: unknown }).document;
  });
});

describe('strings: every locale carries every key; deck EN verbatim', () => {
  it.each(ASK_R3_FULL_LOCALES as readonly DisplayLocale[])('%s', (locale) => {
    const s = askSettingsR2Strings(locale);
    for (const [key, value] of Object.entries(s)) {
      if (typeof value === 'function') expect((value as (n: number) => string)(2)).toMatch(/\S/);
      else expect([key, value]).toEqual([key, expect.stringMatching(/\S/)]);
    }
  });

  it('EN values are the approved copy', () => {
    const en = askSettingsR2Strings('en');
    expect(en.signedInState).toBe('Signed in');
    expect(en.langApp).toBe('Language & appearance');
    expect(en.privacyData).toBe('Privacy & data');
    expect(en.followedH).toBe('Followed questions');
    expect(en.supportLegal).toBe('Help & legal');
    expect(en.acctFail).toBe('Your account details could not be loaded. Other settings still work.');
    expect(en.retry).toBe('Try again');
    expect(en.clearSearch).toBe('Clear search');
    expect(en.appearance).toBe('Appearance');
    expect(en.themeSaved).toBe('Saved on this device.');
    expect(en.conversationsFound(1)).toBe('1 conversation');
    expect(en.conversationsFound(2)).toBe('2 conversations');
  });
});
