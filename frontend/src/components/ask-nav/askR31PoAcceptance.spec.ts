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
import { accountNameSource, shownAccountName } from '@/lib/account/accountName';
// eslint-disable-next-line import/first
import { AccountIdentity } from '@/components/account/AccountIdentity';
// eslint-disable-next-line import/first
import { askDayPart, askGreetingStrings } from '@/lib/ask/askGreetingStrings';
// eslint-disable-next-line import/first
import { SELECTABLE_LOCALES } from '@/lib/i18n/languages';
// eslint-disable-next-line import/first
import { askSettingsR2Strings } from '@/lib/ask/askSettingsR2Strings';
// eslint-disable-next-line import/first
import { askFormatLocalDayCompact } from '@/lib/ask/askDirection';

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

describe('R3.1 guided-actions layout — two side by side, jobs centred below', () => {
  const css = read('components', 'ask-frame', 'askDashboard.module.css');
  const block = css.slice(css.indexOf('R3.1 · PRODUCT OWNER GUIDED-ACTIONS LAYOUT'));
  it('the pills become a centred two-column grid that shrinks equally and never below 44 px', () => {
    expect(block).toMatch(/grid-template-columns: repeat\(2, minmax\(0, max-content\)\);/);
    expect(block).toMatch(/\.iaCuesPills > \.iaCue:nth-child\(3\) \{\s*grid-column: 1 \/ -1;\s*justify-self: center;/);
    expect(block).toMatch(/min-height: 44px/);
    expect(block).not.toMatch(/animation|transition|@media/);
  });
  it('the cue order (G1, G2, then G3) and the compact list are unchanged', () => {
    const entries = read('components', 'ask-frame', 'AskWelcomeEntries.tsx');
    expect(entries.indexOf("id: 'g1'")).toBeLessThan(entries.indexOf("id: 'g2'"));
    expect(entries.indexOf("id: 'g2'")).toBeLessThan(entries.indexOf("id: 'g3'"));
    expect(entries).toContain('className={compact ? styles.iaCuesList : styles.iaCuesPills}');
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

  it('Earlier rows carry a compact date: no year when it is this year, the full date otherwise', () => {
    const ref = new Date('2026-10-11T12:00:00Z');
    expect(askFormatLocalDayCompact(new Date('2026-01-05T09:00:00Z'), 'en', ref)).toBe('5 Jan');
    expect(askFormatLocalDayCompact(new Date('2025-12-30T09:00:00Z'), 'en', ref)).toBe('30 Dec 2025');
    /* Arabic keeps its own numerals: nothing is reformatted by hand */
    expect(askFormatLocalDayCompact(new Date('2026-01-05T09:00:00Z'), 'ar', ref)).not.toMatch(/[0-9]/);
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

/*
  SUPERSEDED, NOT DELETED — "FIX 4 — the automatic account alias" (5 cases: alias shown when no
  saved name; alias pre-filled in the field; alias hint in 7 locales; Settings passes the alias).
  R3.1 GOOGLE PROFILE PERSONALIZATION (PO/CTO, 2026-10-11) revises the purpose: greet the reader
  naturally — saved name, else the Google given name, else a verified-email first name, else
  neutral — and DISPLAY the identity with an optional Change instead of a name-entry form. The
  alias is not used for display. What the old cases protected (never blank when a name is known,
  never an address, the saved name always wins, an older backend behaves as before) is asserted
  below against the revised design.
*/
describe('FIX 4 (revised) — Google profile personalization', () => {
  it('saved name > greeting name > nothing; never an address; a guest has none', () => {
    expect(shownAccountName({ displayName: 'Amina K.', greetingName: 'Amina', greetingNameSource: 'GOOGLE_PROFILE' })).toBe('Amina K.');
    expect(shownAccountName({ displayName: null, greetingName: 'Amina', greetingNameSource: 'GOOGLE_PROFILE' })).toBe('Amina');
    expect(shownAccountName({ displayName: null })).toBeNull();
    expect(shownAccountName({ displayName: null, greetingName: 'amina@example.com' })).toBeNull();
    expect(shownAccountName(null)).toBeNull();
    expect(accountNameSource({ displayName: 'Amina K.', greetingName: 'Amina', greetingNameSource: 'EMAIL' })).toBe('CHOSEN');
    expect(accountNameSource({ displayName: null, greetingName: 'Amina', greetingNameSource: 'EMAIL' })).toBe('EMAIL');
    expect(accountNameSource({ displayName: null, greetingName: 'Amina', greetingNameSource: 'GOOGLE_PROFILE' })).toBe('GOOGLE_PROFILE');
    expect(accountNameSource({ displayName: null })).toBeNull();
  });

  const renderIdentity = (user: Record<string, unknown>) => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        createElement(AccountIdentity, {
          user: user as never,
          locale: 'en' as DisplayLocale,
          onSave: () => Promise.resolve({ ok: true as const }),
        }),
      );
    });
    return r;
  };
  it('Settings DISPLAYS the identity and its source, with an optional Change — no open form', () => {
    const r = renderIdentity({ displayName: null, greetingName: 'Amina', greetingNameSource: 'GOOGLE_PROFILE' });
    expect(textOf(by(r.root, 'data-account', 'identity-name')[0]!)).toBe('Amina');
    expect(textOf(by(r.root, 'data-account', 'identity-source')[0]!)).toBe('From your Google account');
    expect(r.root.findAll((n) => n.type === 'input')).toHaveLength(0);
    act(() => by(r.root, 'data-account', 'identity-change')[0]!.props.onClick());
    const input = r.root.findByType('input');
    expect(input.props.value).toBe('Amina');
    expect(textOf(r.root.findByProps({ id: 'display-name-hint' }))).toContain('Leave it empty to use the name from your Google account');
    act(() => by(r.root, 'data-account', 'display-name-cancel')[0]!.props.onClick());
    expect(r.root.findAll((n) => n.type === 'input')).toHaveLength(0);
    act(() => r.unmount());
  });
  it('a saved name reads "Chosen by you"; an email-derived name says so; no name reads "Not set"', () => {
    for (const [user, name, source] of [
      [{ displayName: 'Amina K.', greetingName: 'Amina', greetingNameSource: 'GOOGLE_PROFILE' }, 'Amina K.', 'Chosen by you'],
      [{ displayName: null, greetingName: 'Amina', greetingNameSource: 'EMAIL' }, 'Amina', 'From your email address'],
      [{ displayName: null }, 'Not set', null],
    ] as const) {
      const r = renderIdentity(user);
      expect(textOf(by(r.root, 'data-account', 'identity-name')[0]!)).toBe(name);
      const line = by(r.root, 'data-account', 'identity-source');
      expect(line.length === 0 ? null : textOf(line[0]!)).toBe(source);
      act(() => r.unmount());
    }
  });
  it('the greeting is localised and time-appropriate, never with an honorific or an address', () => {
    expect(askDayPart(new Date(2026, 9, 11, 8))).toBe('morning');
    expect(askDayPart(new Date(2026, 9, 11, 14))).toBe('afternoon');
    expect(askDayPart(new Date(2026, 9, 11, 21))).toBe('evening');
    expect(askDayPart(new Date(2026, 9, 11, 3))).toBe('evening');
    for (const locale of SELECTABLE_LOCALES) {
      for (const part of ['morning', 'afternoon', 'evening'] as const) {
        const line = askGreetingStrings(locale).greet[part]('Amina');
        expect(line).toContain('⁨Amina⁩');
        expect(line).not.toMatch(/@|\b(Mr|Ms|Mrs|Pan|Pani|Herr|Frau|Sr|Sra|Monsieur|Madame)\b|سيد/);
      }
    }
    expect(askGreetingStrings('en').greet.morning('Amina')).toBe('Good morning, ⁨Amina⁩');
  });
  it('the home greets only a signed-in reader, by name when there is one, neutrally otherwise', () => {
    const frame = read('components', 'ask-frame', 'AskFrameScreen.tsx');
    expect(frame).toMatch(/\{signedInReader && \(\s*<p data-ask="welcome-greeting"/);
    expect(frame).toContain('askGreetingStrings(interfaceLocale).greet[askDayPart(new Date())](nav.displayName)');
    expect(frame).toMatch(/: r3\.welcomeBack\}/);
  });
  it('Settings no longer opens a name form by default, and the alias is gone from display', () => {
    const body = read('components', 'account', 'AccountSettingsBody.tsx');
    expect(body).toContain('<AccountIdentity key={user.id} user={user} locale={ui} onSave={updateDisplayName} />');
    expect(body).not.toMatch(/<DisplayNameEditor|accountAlias|aliasHint/);
    expect(read('lib', 'account', 'accountName.ts')).not.toMatch(/user\.accountAlias/);
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

describe('R3.2 MOBILE COMPACT — My updates and Saved', () => {
  const updates = read('components', 'ask', 'MyUpdatesClient.tsx');
  const saved = read('components', 'ask', 'SavedClient.tsx');
  it('a followed question collapses to title, status, chip, Check and ONE More control', () => {
    expect(updates).toContain('data-ask="followed-more"');
    expect(updates).toContain('aria-controls={moreId}');
    expect(updates).toContain('aria-label={`${more}: ${row.title}`}');
    expect(updates).toContain('className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink-primary"');
    /* Pause / Edit / Saved answers / Stop following live inside the More panel */
    const panel = updates.slice(updates.indexOf('data-ask="followed-more-panel"'), updates.indexOf('{editing && ('));
    for (const id of ['followed-pause', 'followed-edit', 'followed-history', 'followed-remove']) {
      expect(panel).toContain(`data-ask="${id}"`);
    }
  });
  it('critical states are never folded away; the cost is said once for the page', () => {
    expect(updates).toContain("presentation?.attention === true || latestCheck.outcome === 'INCOMPLETE_CHECK' || latestCheck.partial === true");
    expect(updates).toContain('data-ask="followed-structured-unassessed"');
    /* MASTER CTO R38 · U-5 — the manual re-ask note replaces the bare cost line, still said once */
    expect(updates.match(/askR38Strings\(locale\)\.updatesManualNote/g)).toHaveLength(1);
    expect(updates).toContain('data-ask="my-updates-check-cost"');
  });
  it('Saved rows: two-line question, compact date, Open and an accessible Remove; no per-row note', () => {
    expect(saved).toContain('line-clamp-2');
    expect(saved).toContain('askFormatLocalDayCompact(new Date(row.savedAt), locale, new Date())');
    expect(saved).toContain('aria-label={`${t.unsave}: ${row.question}`}');
    expect(saved).not.toContain('data-saved="reopen-note"');
    expect(saved).toContain('data-saved="intro"');
  });
  it('every action meets the 44 px target', () => {
    expect(updates.match(/data-ask="followed-check"[\s\S]{0,300}min-h-\[44px\]/)).not.toBeNull();
    expect(saved.match(/data-saved="reopen"[\s\S]{0,300}min-h-\[44px\]/)).not.toBeNull();
    expect(saved.match(/data-saved="unsave"[\s\S]{0,500}min-h-\[44px\]/)).not.toBeNull();
  });
});
