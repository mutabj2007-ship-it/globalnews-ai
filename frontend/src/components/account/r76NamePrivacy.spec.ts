import { execFileSync } from 'child_process';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * R76 — E1_B_NAME_PRIVACY_CONDITIONAL (Claude_Output/R76-E1B), conditions C-1…C-6, as tests.
 * CTO R76 #93/#95: no Google `profile` scope, no name from an email, the saved displayName or the
 * neutral greeting; disclose that the saved name is the PUBLIC comment author label.
 */
const fetchCalls: string[] = [];
let meResponse: () => { ok: boolean; status: number; json: () => Promise<unknown> } = () => ({
  ok: false,
  status: 401,
  json: async () => ({}),
});
jest.mock('@/lib/api/accountFetch', () => ({
  accountFetch: (path: string) => {
    fetchCalls.push(path);
    return Promise.resolve(
      path === '/users/me' ? meResponse() : { ok: true, status: 204, json: async () => ({}) },
    );
  },
}));

// eslint-disable-next-line import/first
import { shownAccountName, accountNameSource } from '@/lib/account/accountName';
// eslint-disable-next-line import/first
import { useAccount } from '@/lib/hooks/useAccount';
// eslint-disable-next-line import/first
import { AccountIdentity } from '@/components/account/AccountIdentity';
// eslint-disable-next-line import/first
import { askGreetingStrings } from '@/lib/ask/askGreetingStrings';
// eslint-disable-next-line import/first
import { SELECTABLE_LOCALES } from '@/lib/i18n/languages';
// eslint-disable-next-line import/first
import { getDictionary } from '@/lib/i18n/dictionaries';
// eslint-disable-next-line import/first
import { COMMENT_AUTHOR_NOTE_LOCALES, commentAuthorNote } from '@/lib/stories/commentAuthorNote';

const SRC = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');
const textOf = (n: ReactTestInstance): string =>
  n.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const by = (root: ReactTestInstance, attr: string, id: string) =>
  root.findAll((n) => typeof n.type === 'string' && n.props[attr] === id);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(f) && !/\.(spec|test)\.tsx?$/.test(f) ? [p] : [];
  });
}

describe('C-1 — the ordered name-source rule has ONE rung: the saved displayName', () => {
  it('only the saved name is ever shown; nothing else on the account object is read', () => {
    expect(shownAccountName({ displayName: 'Amina K.' })).toBe('Amina K.');
    expect(shownAccountName({ displayName: null })).toBeNull();
    expect(shownAccountName(null)).toBeNull();
    /* source negatives: an address, a Google claim or an email on the object never become a name */
    const extra = { displayName: null, email: 'amina@example.com', greetingName: 'Amina', given_name: 'Amina', picture: 'x' };
    expect(shownAccountName(extra as never)).toBeNull();
    expect(accountNameSource(extra as never)).toBeNull();
    expect(accountNameSource({ displayName: 'Amina K.' })).toBe('CHOSEN');
    /* a legacy invalid stored value (address, bidi override) renders NEUTRAL */
    expect(shownAccountName({ displayName: 'amina@example.com' })).toBeNull();
    expect(shownAccountName({ displayName: 'Ami‮na' })).toBeNull();
  });

  it('fails if a second source is introduced without being ranked in accountName.ts', () => {
    const file = read('lib', 'account', 'accountName.ts');
    const fields = file.match(/export interface AccountNameFields \{([^}]*)\}/)?.[1] ?? '';
    expect(fields.match(/readonly \w+/g)).toEqual(['readonly displayName']);
    expect(file).toMatch(/return addressableName\(user\.displayName\);/);
  });
});

describe('C-2 — no other name source is reachable anywhere in the frontend', () => {
  it('no greetingName / email-derived / Google-profile name source in any non-test file', () => {
    /* code only: comments may record the superseded design */
    const code = (p: string) =>
      readFileSync(p, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const hits = sourceFiles(SRC).filter((p) =>
      /\b(?:greetingName|greetingNameSource|GOOGLE_PROFILE|fromEmail|fromGoogle|given_name)\b/.test(code(p)),
    );
    expect(hits).toEqual([]);
  });
  it('the greeting reads only the shell displayName, which comes only from shownAccountName', () => {
    const frame = read('components', 'ask-frame', 'AskFrameScreen.tsx');
    expect(frame).toMatch(/nav\?\.displayName != null\s*\?\s*askGreetingStrings\(interfaceLocale\)\.greet/);
    const shell = read('components', 'ask-nav', 'AskNavShell.tsx');
    expect(shell).toContain('setDisplayName(shownAccountName(user))');
    expect(shell).not.toMatch(/setDisplayName\([^)]*email/);
  });
});

describe('C-3 — the saved name is disclosed as PUBLIC before it is saved or posted', () => {
  it('every Ask locale states the comment publication and the neutral option; no Google fallback claim', () => {
    for (const locale of SELECTABLE_LOCALES) {
      const t = askGreetingStrings(locale);
      expect(t.publicNote.length).toBeGreaterThan(10);
      expect(t.editHint).not.toMatch(/Google/);
      expect(t.editHint).toContain('Ask');
    }
    expect(askGreetingStrings('en').editHint).toMatch(/shown publicly as your author name on comments/);
    expect(askGreetingStrings('en').editHint).toMatch(/neutral greeting/);
  });

  const renderIdentity = (user: { displayName: string | null }, locale: DisplayLocale = 'en') => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(createElement(AccountIdentity, { user, locale, onSave: () => Promise.resolve({ ok: true as const }) }));
    });
    return r;
  };
  it('Settings shows the public note under a saved name, and nothing for no name', () => {
    const r = renderIdentity({ displayName: 'Amina K.' });
    expect(textOf(by(r.root, 'data-account', 'identity-public')[0]!)).toBe('Also shown publicly on your comments');
    expect(textOf(by(r.root, 'data-account', 'identity-source')[0]!)).toBe('Chosen by you');
    act(() => by(r.root, 'data-account', 'identity-change')[0]!.props.onClick());
    expect(textOf(r.root.findByProps({ id: 'display-name-hint' }))).toContain('shown publicly');
    act(() => r.unmount());
    const none = renderIdentity({ displayName: null });
    expect(by(none.root, 'data-account', 'identity-public')).toHaveLength(0);
    expect(by(none.root, 'data-account', 'identity-source')).toHaveLength(0);
    expect(textOf(by(none.root, 'data-account', 'identity-name')[0]!)).toBe('Not set');
    act(() => none.unmount());
  });
  it('Arabic keeps the name direction-isolated in an RTL greeting', () => {
    const line = askGreetingStrings('ar').greet.morning('Amina');
    expect(line).toContain('⁨Amina⁩');
    expect(line).toMatch(/^[؀-ۿ]/);
  });
  it('the comment composer tells a signed-in reader who sees their name, before Post', () => {
    /* R77 — all seven locales, Arabic right-to-left */
    for (const locale of SELECTABLE_LOCALES) {
      const note = commentAuthorNote(locale);
      expect(note.lang).toBe(locale);
      expect(note.text.length).toBeGreaterThan(30);
    }
    expect(new Set(SELECTABLE_LOCALES.map((l) => commentAuthorNote(l).text)).size).toBe(SELECTABLE_LOCALES.length);
    expect(COMMENT_AUTHOR_NOTE_LOCALES).toHaveLength(7);
    expect(commentAuthorNote('en').text).toMatch(/name you saved in Settings/);
    expect(commentAuthorNote('ar').dir).toBe('rtl');
    expect(getDictionary('en').homeR1.discussion.reader).toBe('Reader');
    const panel = read('components', 'home', 'r1', 'stageb', 'DiscussionPanel.tsx');
    const note = panel.indexOf('data-discussion-author-note');
    expect(note).toBeGreaterThan(0);
    expect(note).toBeLessThan(panel.indexOf('{posting ? t.posting : t.post}'));
  });
});

describe('C-4 — dev fixtures ("Anna") can never reach a public build', () => {
  const config = pathToFileURL(join(SRC, '..', 'next.config.mjs')).href;
  const run = (env: Record<string, string>) =>
    execFileSync(
      process.execPath,
      ['--input-type=module', '-e', `import { assertNoDevFixturesInPublicBuild as a } from '${config}'; a(${JSON.stringify(env)}); console.log('ok');`],
      { env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test' }, encoding: 'utf8' },
    );
  it('a production or Railway build with the flag on is refused; dev and flag-off builds pass', () => {
    expect(() => run({ NODE_ENV: 'production', NEXT_PUBLIC_MI_DEV_FIXTURES: 'true' })).toThrow(/E1-B C-4/);
    expect(() => run({ NODE_ENV: 'development', RAILWAY_ENVIRONMENT_NAME: 'alpha', NEXT_PUBLIC_MI_DEV_FIXTURES: 'true' })).toThrow(/E1-B C-4/);
    expect(run({ NODE_ENV: 'production' })).toContain('ok');
    expect(run({ NODE_ENV: 'development', NEXT_PUBLIC_MI_DEV_FIXTURES: 'true' })).toContain('ok');
  });
});

describe('C-6 — the shown name is cleared on sign-out and never carries to the next account', () => {
  it('sign out as A, sign in as B: A never appears after sign-out', async () => {
    const seen: (string | null)[] = [];
    let api!: ReturnType<typeof useAccount>;
    function Probe() {
      api = useAccount();
      const name = shownAccountName(api.user);
      useEffect(() => {
        seen.push(name);
      }, [name]);
      return null;
    }
    meResponse = () => ({ ok: true, status: 200, json: async () => ({ id: 'a', email: 'a@example.com', displayName: 'Account A' }) });
    let r!: ReactTestRenderer;
    await act(async () => {
      r = create(createElement(Probe));
    });
    expect(seen[seen.length - 1]).toBe('Account A');
    await act(async () => {
      await api.signOut();
    });
    const signedOutAt = seen.length;
    expect(seen[signedOutAt - 1]).toBeNull();
    meResponse = () => ({ ok: true, status: 200, json: async () => ({ id: 'b', email: 'b@example.com', displayName: 'Account B' }) });
    await act(async () => {
      await api.refresh();
    });
    expect(seen[seen.length - 1]).toBe('Account B');
    expect(seen.slice(signedOutAt)).not.toContain('Account A');
    expect(fetchCalls).toContain('/auth/signout');
    /* B with no saved name: neutral, never A's */
    meResponse = () => ({ ok: true, status: 200, json: async () => ({ id: 'b', email: 'b@example.com', displayName: null }) });
    await act(async () => {
      await api.refresh();
    });
    expect(seen[seen.length - 1]).toBeNull();
    act(() => r.unmount());
  });
});
