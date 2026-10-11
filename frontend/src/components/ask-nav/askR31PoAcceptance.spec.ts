import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { DISPLAY_LOCALE_META, type DisplayLocale } from '@globalnews-ai/shared';

/*
  R3.1 PRODUCT OWNER VISUAL ACCEPTANCE REPAIR (MASTER CTO, 2026-10-11) — the five corrections on
  the live R3 Alpha frontend e911e13:
    1. no history on the Ask home;          2. compact conversation history in the drawer;
    3. no drawer footer (its destinations live in Settings and the primary nav);
    4. the automatic account alias is shown, never a blank name field, never an address;
    5. a proper Language row and view in Settings.
*/

jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const react = require('react') as typeof import('react');
  return { __esModule: true, default: ({ prefetch: _p, ...props }: Record<string, unknown>) => react.createElement('a', props) };
});
const refresh = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/ask',
  useRouter: () => ({ refresh, push: jest.fn() }),
}));
const persisted: string[] = [];
jest.mock('@/lib/i18n/languages', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const actual = jest.requireActual('@/lib/i18n/languages') as typeof import('@/lib/i18n/languages');
  return { ...actual, persistLanguageSelection: (l: string) => persisted.push(l) };
});
const threads = jest.fn();
jest.mock('@/lib/api/askV2Api', () => ({
  askV2Api: { threads: (...args: unknown[]) => threads(...args), deleteThread: jest.fn() },
}));
const nav = { account: 'signed-in' as 'signed-in' | 'signed-out', clear: jest.fn(), clearAndGo: jest.fn(), runNewQuestion: () => false };
jest.mock('@/components/ask-nav/AskNavShell', () => ({ useAskNavOptional: () => nav }));
let account: Record<string, unknown> = {};
jest.mock('@/lib/hooks/useAccount', () => ({ useAccount: () => account }));

// eslint-disable-next-line import/first
import { AskConversations } from '@/components/ask-frame/AskConversations';
// eslint-disable-next-line import/first
import { AccountSettingsBody } from '@/components/account/AccountSettingsBody';
// eslint-disable-next-line import/first
import { AskLanguageView } from '@/components/account/AskPreferencesSection';
// eslint-disable-next-line import/first
import { DisplayNameEditor } from '@/components/account/DisplayNameEditor';
// eslint-disable-next-line import/first
import { shownAccountName } from '@/lib/account/accountName';
// eslint-disable-next-line import/first
import { SELECTABLE_LOCALES } from '@/lib/i18n/languages';
// eslint-disable-next-line import/first
import { askSettingsR2Strings } from '@/lib/ask/askSettingsR2Strings';

const SRC = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');
const textOf = (n: ReactTestInstance): string =>
  n.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const by = (root: ReactTestInstance, attr: string, id: string) =>
  root.findAll((n) => typeof n.type === 'string' && n.props[attr] === id);
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('FIX 1 — the Ask home shows no history and reads none', () => {
  const frame = read('components', 'ask-frame', 'AskFrameScreen.tsx');
  const entries = read('components', 'ask-frame', 'AskWelcomeEntries.tsx');
  it('the welcome entries render only the cues and the coverage line', () => {
    expect(entries).not.toMatch(/askV2Api|conversationTitle|askReopenHref|lastActiveAt|<Link/);
    expect(entries).toContain('data-ask="discover-cues"');
    expect(entries).toContain('data-ask="coverage-focus"');
  });
  it('the frame no longer reads threads or briefings for the home', () => {
    expect(frame).not.toMatch(/useRecentConversations|useFollowSummary|resumeConversation/);
  });
});

describe('FIX 2 — compact conversation rows', () => {
  const now = new Date();
  const today = new Date(now.getTime() - 60_000).toISOString();
  const long = 'What changed in electricity prices for households in Kigali, Nairobi and Kampala since the start of this year?';
  const rows = [
    { id: 't1', firstQuestion: long, lastActiveAt: today },
    { id: 't2', firstQuestion: 'Rent in Warsaw', lastActiveAt: '2026-01-05T09:00:00Z' },
  ].map((r, i) => ({
    language: 'en',
    returnPath: null,
    createdAt: r.lastActiveAt,
    turnCount: 1,
    firstQuestionTruncated: false,
    latestTurnId: `u${i}`,
    latestOperationId: `op-${i}`,
    ...r,
  }));

  it('one line per conversation: the full question stays the text and the tooltip; times are compact', async () => {
    nav.account = 'signed-in';
    threads.mockResolvedValueOnce({ ok: true, value: rows });
    let r!: ReactTestRenderer;
    act(() => {
      r = create(createElement(AskConversations, { locale: 'en' as DisplayLocale, showTitle: false }));
    });
    await flush();
    const links = r.root.findAll((n) => n.type === 'a' && n.props['data-ask-row'] === 'compact');
    expect(links).toHaveLength(2);
    const first = links.find((l) => textOf(l).includes('Kigali'))!;
    expect(first.props.title).toBe(long);
    expect(textOf(first)).toContain(long);
    /* today's row: the time alone (the group heading says Today), never "Today, 14:20" */
    const when = textOf(first).slice(long.length);
    expect(when).toMatch(/^\d{1,2}:\d{2}$/);
    /* still searchable, still deletable, with a 44 px target */
    expect(by(r.root, 'data-ask', 'conversations-search')).toHaveLength(1);
    const del = by(r.root, 'data-ask', 'conversation-delete');
    expect(del).toHaveLength(2);
    for (const d of del) expect(String(d.props.className)).toMatch(/min-h-\[44px\] min-w-\[44px\]/);
    act(() => r.unmount());
  });

  it('the compact stylesheet keeps the 44 px row and truncates with an ellipsis', () => {
    const css = read('components', 'ask-frame', 'askConversationsCompact.module.css');
    expect(css).toMatch(/min-height: 44px/);
    expect(css).toMatch(/text-overflow: ellipsis/);
    expect(css).toMatch(/white-space: nowrap/);
  });
});

describe('FIX 3 — the drawer holds only Close · identity · gear · New question · search · history', () => {
  const shell = read('components', 'ask-nav', 'AskNavShell.tsx');
  /* code only: the comments in this region name the removed footer and its destinations */
  const drawer = shell
    .slice(shell.indexOf('data-ask-nav="drawer"'), shell.indexOf('{settingsOpen && ('))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  it('no footer, no language list, no appearance switch, no sign-out row in the drawer', () => {
    expect(drawer).not.toMatch(/<AskReadingFooter|<LanguageSelector|<ThemeControl|footer-|signOutClean|privacy|cookies/i);
    for (const id of ['drawer-close', 'drawer-identity', 'drawer-sign-in', 'drawer-settings', 'conversations']) {
      expect(drawer).toContain(`data-ask-nav="${id}"`);
    }
  });
  it('the shell no longer imports the footer', () => {
    expect(shell).not.toContain("from './AskReadingFooter'");
  });
});

describe('FIX 4 — the automatic account alias', () => {
  it('the saved name wins; else the alias; never an address; a guest has none', () => {
    expect(shownAccountName({ displayName: 'Amina', accountAlias: 'amina.k-4821' })).toBe('Amina');
    expect(shownAccountName({ displayName: null, accountAlias: 'amina.k-4821' })).toBe('amina.k-4821');
    expect(shownAccountName({ displayName: null })).toBeNull();
    expect(shownAccountName({ displayName: null, accountAlias: 'amina@example.com' })).toBeNull();
    expect(shownAccountName(null)).toBeNull();
  });

  const renderEditor = (current: string | null, alias: string | null) => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        createElement(DisplayNameEditor, {
          current,
          alias,
          aliasHint: askSettingsR2Strings('en').aliasHint,
          locale: 'en',
          onSave: () => Promise.resolve({ ok: true as const }),
        }),
      );
    });
    return r;
  };
  it('no saved name: the field shows the alias, not a blank, and the hint names it', () => {
    const r = renderEditor(null, 'amina.k-4821');
    expect(r.root.findByType('input').props.value).toBe('amina.k-4821');
    expect(textOf(r.root.findByProps({ id: 'display-name-hint' }))).toContain('amina.k-4821');
    expect(textOf(r.root)).not.toContain('never takes a name from your email');
    act(() => r.unmount());
  });
  it('a saved name is shown unchanged', () => {
    const r = renderEditor('Amina', 'amina.k-4821');
    expect(r.root.findByType('input').props.value).toBe('Amina');
    act(() => r.unmount());
  });
  it('no alias (an older backend): exactly the previous behaviour', () => {
    const r = renderEditor(null, null);
    expect(r.root.findByType('input').props.value).toBe('');
    expect(textOf(r.root.findByProps({ id: 'display-name-hint' }))).toContain('never takes a name from your email');
    act(() => r.unmount());
  });
  it('every locale names the alias in its hint, isolated for direction', () => {
    for (const locale of SELECTABLE_LOCALES) {
      const hint = askSettingsR2Strings(locale).aliasHint('amina.k-4821');
      expect(hint).toContain('⁨amina.k-4821⁩');
      expect(hint).not.toContain('@');
    }
  });
  it('Settings passes the alias through the shared rule; the address stays only in the Email row', () => {
    const body = read('components', 'account', 'AccountSettingsBody.tsx');
    expect(body).toContain('alias={addressableName(user.accountAlias ?? null)}');
    expect(body).toContain('current={addressableName(user.displayName)}');
  });
});

describe('FIX 5 — the Language row and view', () => {
  /* the views listen for Escape on the document; the node test environment has none */
  const g = globalThis as unknown as { document?: unknown };
  const hadDocument = 'document' in g;
  beforeAll(() => {
    if (!hadDocument) g.document = { addEventListener: () => undefined, removeEventListener: () => undefined };
  });
  afterAll(() => {
    if (!hadDocument) delete g.document;
  });
  const base = {
    isLoading: false,
    readFailed: false,
    refresh: jest.fn(() => Promise.resolve()),
    signOut: jest.fn(() => Promise.resolve()),
    deleteAccount: jest.fn(),
    updateDisplayName: jest.fn(),
  };
  it('the row shows the selected language by its own name and opens the view; no legacy dropdown', () => {
    account = { ...base, user: null };
    let r!: ReactTestRenderer;
    act(() => {
      r = create(createElement(AccountSettingsBody, { locale: 'fr' as DisplayLocale, chrome: 'sheet' }));
    });
    const row = by(r.root, 'data-settings', 'language-row')[0]!;
    expect(row.type).toBe('button');
    expect(textOf(row)).toContain('Français');
    expect(read('components', 'account', 'AskPreferencesSection.tsx')).not.toContain('<LanguageSelector');
    act(() => row.props.onClick());
    expect(by(r.root, 'data-settings', 'language-view')).toHaveLength(1);
    act(() => r.unmount());
  });

  it('lists every selectable language in its own name, language and direction; the current one is checked', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(createElement(AskLanguageView, { locale: 'ar' as DisplayLocale, backLabel: 'Settings', onBack: () => undefined }));
    });
    const radios = r.root.findAll((n) => n.type === 'input' && n.props.type === 'radio');
    expect(radios.map((x) => x.props.value)).toEqual([...SELECTABLE_LOCALES]);
    expect(radios.filter((x) => x.props.checked).map((x) => x.props.value)).toEqual(['ar']);
    for (const option of SELECTABLE_LOCALES) {
      const name = r.root.find((n) => n.type === 'span' && n.props.lang === option);
      expect(textOf(name)).toBe(DISPLAY_LOCALE_META[option].endonym);
      expect(name.props.dir).toBe(DISPLAY_LOCALE_META[option].direction);
    }
    expect(r.root.findAll((n) => n.props['data-language-selected'] === '')).toHaveLength(1);
    expect(r.root.findByProps({ role: 'radiogroup' })).toBeTruthy();
    act(() => r.unmount());
  });

  it('choosing persists the same cookie and refreshes; re-choosing the current one does nothing', () => {
    persisted.length = 0;
    refresh.mockClear();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(createElement(AskLanguageView, { locale: 'en' as DisplayLocale, backLabel: 'Settings', onBack: () => undefined }));
    });
    const radio = (v: string) => r.root.find((n) => n.type === 'input' && n.props.value === v);
    act(() => radio('en').props.onChange());
    expect(persisted).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
    act(() => radio('pl').props.onChange());
    expect(persisted).toEqual(['pl']);
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
  });

  it('the Settings sheet lets the Language view own Escape, and a re-render never steals focus', () => {
    const sheet = read('components', 'account', 'AskSettingsSheet.tsx');
    expect(sheet).toContain('[data-settings="appearance-view"], [data-settings="language-view"]');
    expect(sheet).toContain('const onClose = (): void => onCloseRef.current();');
    expect(sheet).not.toContain('}, [onClose]);');
  });

  it('leaving a sub-view returns focus to the row that opened it', () => {
    const body = read('components', 'account', 'AccountSettingsBody.tsx');
    expect(body).toContain('bodyRef.current?.querySelector<HTMLElement>(`[data-settings="${from}-row"]`)?.focus();');
  });

  it('Kiswahili and Kinyarwanda are not offered as a localized interface', () => {
    expect(SELECTABLE_LOCALES as readonly string[]).not.toContain('sw');
    expect(SELECTABLE_LOCALES as readonly string[]).not.toContain('rw');
  });
});
