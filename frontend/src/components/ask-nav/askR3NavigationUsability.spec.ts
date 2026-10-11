import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { DISPLAY_LOCALES, type DisplayLocale } from '@globalnews-ai/shared';
import { AskPrimaryNav } from './AskPrimaryNav';
import { ASK_PRIMARY_SECTIONS } from '@/lib/askNavModel';
import {
  ASK_PRIMARY_NAV_DRAFT_LOCALES,
  askPrimaryNavStrings,
} from '@/lib/ask/askPrimaryNavStrings';
import { MY_UPDATES_HREF, briefingOriginOf, summarizeFollows } from '@/lib/ask/followedQuestions';
import { followStrings } from '@/lib/ask/followStrings';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { askDirectionProps } from '@/lib/ask/askDirection';
import { briefingHref } from '@/components/ask/BriefingViews';
import type { AskV2BriefingSummary } from '@/lib/api/askV2Api';

jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const react = require('react') as typeof import('react');
  return {
    __esModule: true,
    default: ({ prefetch: _prefetch, ...props }: Record<string, unknown>) => react.createElement('a', props),
  };
});

/**
 * ASK R3 NAVIGATION / USABILITY R1 — CTO R3 conformity rulings of 2026-10-10.
 *
 * 1. the R3 primary navigation Ask / My updates / Saved on phone AND desktop (HANDOFF §3 L74);
 * 2. Conversations hidden by default; the list scrolls on its own; the drawer footer is pinned;
 * 3. no header control can leave the viewport in any locale (icon-only New question on phones);
 * 4. the welcome My updates entry only with real follows, real facts only;
 * 5. My updates / change detail titled and backed correctly (never "Saved" from My updates).
 *
 * Layout itself (pixels, 50 conversations at 320/390/1440, 7 locales) is measured in a real
 * browser for the handoff; these cases pin the code paths that produce it.
 */
const src = join(__dirname, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(src, ...parts), 'utf8');
const textOf = (node: ReactTestInstance): string =>
  node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');

const frame = read('components', 'ask-frame', 'AskFrameScreen.tsx');
const frameCss = read('components', 'ask-frame', 'askDashboard.module.css');
const navCss = read('components', 'ask-nav', 'askNav.module.css');
const shell = read('components', 'ask-nav', 'AskNavShell.tsx');
const continuity = read('components', 'ask-nav', 'AskContinuityHeader.tsx');
const conversations = read('components', 'ask-frame', 'AskConversations.tsx');
const footer = read('components', 'ask-nav', 'AskReadingFooter.tsx');

function renderNav(locale: DisplayLocale, current: 'ask' | 'updates' | 'saved' | null): ReactTestInstance {
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(createElement(AskPrimaryNav, { locale, current }));
  });
  return r.root;
}
const links = (root: ReactTestInstance) =>
  root.findAll((n) => n.type === 'a' && typeof n.props['data-ask-nav-primary'] === 'string');

describe('1 · the R3 primary navigation: Ask · My updates · Saved, existing destinations only', () => {
  it('the three destinations are the existing routes (no invented page)', () => {
    expect(ASK_PRIMARY_SECTIONS.map((s) => s.href)).toEqual(['/ask', MY_UPDATES_HREF, '/saved']);
    expect(existsSync(join(src, 'app', 'ask', 'page.tsx'))).toBe(true);
    expect(existsSync(join(src, 'app', 'saved', 'updates', 'page.tsx'))).toBe(true);
    expect(existsSync(join(src, 'app', 'saved', 'page.tsx'))).toBe(true);
  });

  it.each(DISPLAY_LOCALES.map((l) => [l]))('%s: three labelled links, the current one marked, no badge or count', (locale) => {
    const root = renderNav(locale, 'updates');
    const nav = root.find((n) => n.type === 'nav');
    expect(nav.props['aria-label']).toBe(askPrimaryNavStrings(locale).navLabel);
    const items = links(root);
    expect(items.map((a) => a.props.href)).toEqual(['/ask', '/saved/updates', '/saved']);
    expect(items.map((a) => a.props['aria-current'])).toEqual([undefined, 'page', undefined]);
    const texts = items.map(textOf);
    expect(texts[0]).toBe('Ask');
    expect(texts[1]).toContain(followStrings(locale).myUpdates);
    expect(texts[2]).toBe(askShellStrings(locale).askContinuityStrings.savedTitle);
    for (const text of texts) expect(text).not.toMatch(/\d/);
  });

  it('the short My updates label is visual only; the link keeps the full accessible label', () => {
    const root = renderNav('fr', 'ask');
    const updates = links(root)[1]!;
    const hidden = updates.findAll((n) => n.type === 'span' && n.props['aria-hidden'] === 'true');
    expect(hidden.map(textOf)).toEqual([askPrimaryNavStrings('fr').myUpdatesShort]);
    expect(navCss).toMatch(/\.primaryNav\[data-compact='true'\] \.primaryFull \{[^}]*clip-path: inset\(50%\);/);
    expect(navCss).toMatch(/\.primaryNav \{[^}]*overflow: hidden;/);
  });

  it('a plain click on the current section does not navigate away (an open conversation stays)', () => {
    const root = renderNav('en', 'ask');
    const ask = links(root)[0]!;
    const event = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: jest.fn() };
    ask.props.onClick(event);
    expect(event.preventDefault).toHaveBeenCalled();
    const saved = links(root)[2]!;
    const other = { ...event, preventDefault: jest.fn() };
    saved.props.onClick(other);
    expect(other.preventDefault).not.toHaveBeenCalled();
  });

  it('/ask: in the one Ask header (phone and desktop), between the menu and New question', () => {
    const header = frame.slice(frame.indexOf('<header data-ask="header"'), frame.indexOf('</header>', frame.indexOf('<header data-ask="header"')));
    expect(header).toContain('<AskPrimaryNav locale={interfaceLocale} current="ask" />');
    expect(header.indexOf('<AskPrimaryNav')).toBeGreaterThan(header.indexOf('data-ask="shell-menu"'));
    expect(header.indexOf('<AskPrimaryNav')).toBeLessThan(header.indexOf('data-ask="new-question"'));
  });

  it('every other Ask page: in the phone header and in the desktop bar', () => {
    expect(continuity).toContain('<AskPrimaryNav locale={locale} current={SECTION_OF[surface]} />');
    expect(shell).toContain('<AskPrimaryNav locale={selectedLocale} current={currentSection} />');
  });

  it('no bottom navigation bar anywhere in the Ask shell', () => {
    for (const file of [shell, continuity, frame, read('components', 'ask-nav', 'AskPrimaryNav.tsx')]) {
      expect(file).not.toMatch(/MobileBottomNav|BottomNav|bottom-nav/);
    }
    expect(navCss).not.toMatch(/\.primaryNav \{[^}]*position: fixed/);
  });

  it('RTL: every header that carries the navigation sets the shared direction scope', () => {
    expect(askDirectionProps('ar').dir).toBe('rtl');
    expect(continuity).toContain('dir={direction.dir}');
    expect(frame).toContain('dir={askScope.dir}');
    expect(shell).toContain('dir={shellDirection.dir}');
    const ar = renderNav('ar', 'saved');
    expect(textOf(links(ar)[1]!)).toContain('تحديثاتي');
  });

  it('new strings: EN exact; the six other locales are declared drafts for Claude L', () => {
    const en = askPrimaryNavStrings('en');
    expect(en.myUpdatesShort).toBe('Updates');
    expect(en.followedCount(2)).toBe('2 followed');
    expect(en.withChangesAtLastCheck(1)).toBe('1 with changes at last check');
    expect(en.backToMyUpdates).toBe('Back to My updates');
    expect([...ASK_PRIMARY_NAV_DRAFT_LOCALES].sort()).toEqual(['ar', 'de', 'es', 'fr', 'pl', 'pt']);
    for (const locale of DISPLAY_LOCALES) {
      const s = askPrimaryNavStrings(locale);
      expect(s.myUpdatesShort.length).toBeLessThanOrEqual(followStrings(locale).myUpdates.length);
      if (locale !== 'en') expect(s.backToMyUpdates).not.toBe(en.backToMyUpdates);
    }
    expect(read('lib', 'ask', 'askPrimaryNavStrings.ts')).toContain('DRAFT_PENDING_CLAUDE_L');
  });
});

describe('2 · Conversations drawer: hidden by default, list scrolls, footer pinned', () => {
  it('the drawer renders only when the reader opens it', () => {
    expect(shell).toContain('const [open, setOpen] = useState(false);');
    expect(shell).toMatch(/\{open && \(\s*<div\s+ref=\{drawerRef\}/);
  });

  it('the drawer does not scroll as a whole; the conversation list scrolls in its own region', () => {
    const pin = navCss.slice(navCss.indexOf('THE DRAWER FOOTER IS PINNED'));
    expect(pin).toMatch(/\.drawer \{[^}]*overflow: hidden;/);
    expect(pin).toMatch(/\.drawer \.drawerGroup\[data-ask-nav='conversations'\] \{[^}]*min-height: 0;[^}]*flex: 1 1 auto;/);
    expect(pin).toMatch(/\.drawer \.readingFooter \{[^}]*flex-shrink: 0;/);
    expect(frameCss).toMatch(/\.conversationsList \{[^}]*min-height: 0;[^}]*overflow-y: auto;/);
    expect(conversations).toContain('<div data-ask="conversations-list" className={styles.conversationsList}>');
    /* New question and search stay above the scrolling list */
    expect(conversations.indexOf('data-ask="conversations-new"')).toBeLessThan(conversations.indexOf('data-ask="conversations-list"'));
    expect(conversations.indexOf('data-ask="conversations-search"')).toBeLessThan(conversations.indexOf('data-ask="conversations-list"'));
  });

  it('every Ask page ends its drawer in the one footer holding My updates, Saved, Help and Settings', () => {
    const drawer = shell.slice(shell.indexOf('data-ask-nav="drawer"'));
    expect(drawer).toContain('<AskReadingFooter');
    expect(drawer).not.toMatch(/renderRoutes\(/);
    for (const id of ['footer-updates', 'footer-saved', 'footer-help', 'footer-settings', 'footer-sign-out', 'footer-sign-in']) {
      expect(footer).toContain(`data-ask-nav="${id}"`);
    }
    /* the drawer's own sign-out still closes the drawer first */
    expect(drawer).toMatch(/onSignOut=\{\(\) => \{\s*setOpen\(false\);\s*void signOutClean\(\);/);
  });

  it('the desktop bar of the other Ask pages opens the same drawer, and focus returns to the visible trigger', () => {
    expect(shell).toMatch(/data-ask-nav="bar-menu"[\s\S]{0,200}aria-expanded=\{open\}\s*onClick=\{\(\) => setOpen\(!open\)\}/);
    expect(shell).toMatch(/document\.activeElement === document\.body[\s\S]{0,160}\[data-ask-nav="bar-menu"\]/);
    /* the bar keeps New question; Saved is in the switch; Recent / Help / Settings are in the drawer */
    expect(shell).toContain("renderRoutes(`${itemClass} whitespace-nowrap`, undefined, ['saved', 'recent', 'help', 'settings'])");
    expect(footer).toContain('data-ask-nav="footer-help"');
    expect(footer).toContain('data-ask-nav="footer-settings"');
  });

  it('the footer keeps clear of the home indicator', () => {
    expect(navCss).toMatch(/padding-bottom: max\(16px, env\(safe-area-inset-bottom\)\);/);
  });
});

describe('3 · no header control leaves the viewport: icon-only New question on phones', () => {
  it('New question always has its localized accessible name', () => {
    const button = frame.slice(frame.indexOf('data-ask="new-question"'), frame.indexOf('</button>', frame.indexOf('data-ask="new-question"')));
    expect(button).toContain('aria-label={shell.askNavStrings.newQuestion}');
    expect(button).toContain('<span data-ask="new-question-label">{shell.askNavStrings.newQuestion}</span>');
    expect(continuity).toContain('aria-label={nav.newQuestion}');
  });

  it('below 700 px the wordmark yields to the navigation and New question is the icon-only "+"', () => {
    const rule = frameCss.slice(frameCss.indexOf('ASK R3 NAVIGATION / USABILITY R1'));
    expect(rule).toMatch(/@media \(max-width: 699px\) \{\s*\.page\[data-ask-standalone\] \.frame \.brand \{\s*display: none;/);
    expect(rule).toMatch(/\[data-ask='new-question-label'\]\) \{\s*display: none;/);
  });

  it('the navigation can shrink and clips instead of widening the page', () => {
    expect(navCss).toMatch(/\.primaryNav \{[^}]*min-width: 0;[^}]*flex: 0 1 auto;/);
    expect(navCss).toMatch(/\.primaryItem \{[^}]*min-width: 0;[^}]*text-overflow: ellipsis;/);
  });
});

describe('4 · the welcome My updates entry: only real follows, only real facts', () => {
  const row = (over: Partial<AskV2BriefingSummary>): AskV2BriefingSummary =>
    ({
      id: 'b',
      title: 'Q',
      scope: { kind: 'ASK_QUESTION', question: 'Q', language: 'en' },
      status: 'ACTIVE',
      createdAt: '2026-10-08T10:00:00Z',
      updatedAt: '2026-10-10T10:00:00Z',
      latestVersion: 1,
      latestAsOf: '2026-10-10T10:00:00Z',
      ...over,
    }) as AskV2BriefingSummary;
  const check = (outcome: string, checkedAt: string) =>
    ({ outcome, checkedAt, resultingVersion: 2, newEvidenceCount: 1, possibleCorrectionCount: 0, supportedChangeCount: 1 }) as never;

  it('nothing followed → null (the entry is omitted, never shown empty)', () => {
    expect(summarizeFollows([])).toBeNull();
    /* a non-question briefing is not a followed question */
    expect(summarizeFollows([row({ scope: { kind: 'TOPIC', question: null } as never })])).toBeNull();
  });

  it('counts follows and last-check changes from the server outcome only', () => {
    const summary = summarizeFollows([
      row({ id: 'a', latestCheck: check('NEW_EVIDENCE', '2026-10-10T08:00:00Z') }),
      row({ id: 'b', latestCheck: check('CORRECTION', '2026-10-09T08:00:00Z') }),
      row({ id: 'c', latestCheck: check('NO_RELEVANT_UPDATE', '2026-10-10T09:00:00Z') }),
      row({ id: 'd', latestCheck: check('INCOMPLETE_CHECK', '2026-10-10T11:00:00Z') }),
      row({ id: 'e' }),
    ]);
    expect(summary).toEqual({ followed: 5, withChanges: 2, lastSuccessfulAt: '2026-10-10T09:00:00Z' });
  });

  it('an incomplete check is never the last successful one; the server field wins when present', () => {
    expect(summarizeFollows([row({ latestCheck: check('INCOMPLETE_CHECK', '2026-10-10T11:00:00Z') })])).toEqual({
      followed: 1,
      withChanges: 0,
      lastSuccessfulAt: null,
    });
    expect(
      summarizeFollows([
        row({ latestCheck: check('INCOMPLETE_CHECK', '2026-10-10T11:00:00Z'), lastSuccessfulCheckAt: '2026-10-08T07:00:00Z' }),
      ])?.lastSuccessfulAt,
    ).toBe('2026-10-08T07:00:00Z');
  });

  it('the frame reads the briefings once, only for a signed-in reader on the empty welcome', () => {
    expect(frame).toContain('const followSummary = useFollowSummary(signedInReader && entryState);');
    expect(frame.match(/follows=\{followSummary\}/g)).toHaveLength(2);
    const entries = read('components', 'ask-frame', 'AskWelcomeEntries.tsx');
    expect(entries).toMatch(/if \(!signedIn\) \{\s*setSummary\(null\);\s*return;/);
    expect(entries).toContain('setSummary(outcome.ok ? summarizeFollows(outcome.value) : null);');
    /*
      SUPERSEDED, NOT DELETED — the original assertion read:
          expect(entries).toContain('{follows !== null && followLine !== null && (');
      IA + GUIDED DISCOVER R2, 02 decision 4 (PO-approved 11 Oct 2026) adds ONE more condition in
      front of it: the compact welcome drops this row because My updates is already in the primary
      nav. The two real-data conditions this test exists to protect — a real follow summary and
      real facts — are unchanged and are both asserted below, so the row still cannot appear on
      absent or empty data.
    */
    expect(entries).toContain('follows !== null && followLine !== null && (');
    expect(entries).toContain('{!compact && follows !== null && followLine !== null && (');
  });

  it('My updates (the page) shows "{N} followed" from the same read', () => {
    const page = read('components', 'ask', 'MyUpdatesClient.tsx');
    expect(page).toContain('const summary = list.ok ? summarizeFollows(list.value) : null;');
    expect(page).toContain('data-ask="my-updates-summary"');
  });
});

describe('5 · My updates and its change detail: titles and back links', () => {
  it('My updates is titled My updates, never Saved', () => {
    expect(read('app', 'saved', 'updates', 'page.tsx')).toContain('<AskContinuityHeader locale={chrome} surface="updates" />');
    expect(continuity).toMatch(/surface === 'updates'\s*\? followStrings\(locale\)\.myUpdates/);
    expect(continuity).toMatch(/updates: 'updates',/);
  });

  it('a change detail opened from My updates says so, and keeps it across versions', () => {
    expect(briefingHref('id-1', 3, 'updates')).toBe('/saved/briefing?id=id-1&v=3&from=updates');
    expect(briefingHref('id-1', 3)).toBe('/saved/briefing?id=id-1&v=3');
    expect(read('components', 'ask', 'MyUpdatesClient.tsx')).toContain("briefingHref(row.id, row.latestVersion, 'updates')");
    expect(read('components', 'ask', 'BriefingViews.tsx')).toContain('briefingHref(detail.id, v.version, origin)');
    expect(briefingOriginOf('updates')).toBe('updates');
    expect(briefingOriginOf(undefined)).toBe('saved');
    expect(briefingOriginOf('elsewhere')).toBe('saved');
  });

  it('the change detail header, section and back link follow the opener', () => {
    const page = read('app', 'saved', 'briefing', 'page.tsx');
    expect(page).toContain('const origin = briefingOriginOf(searchParams.from);');
    expect(page).toContain('<AskNavShell language={chrome} selected={locale} section={origin} />');
    expect(page).toContain('<AskContinuityHeader locale={chrome} surface={origin} />');
    const detail = read('components', 'ask', 'BriefingDetailClient.tsx');
    expect(detail).toContain("const backHref = origin === 'updates' ? MY_UPDATES_HREF : '/saved';");
    expect(detail).toContain("const backLabel = origin === 'updates' ? askPrimaryNavStrings(locale).backToMyUpdates : t.back;");
    expect(detail).toContain('<Link href={backHref} data-briefing="back"');
    expect(detail).toContain('router.push(backHref)');
    expect(detail).not.toMatch(/<Link href="\/saved"/);
  });

  it('the floating platform dock stays off My updates and the change detail', () => {
    const dock = read('components', 'ask', 'AskAiDock.tsx');
    expect(dock).toContain("'/saved/updates',");
    expect(dock).toContain("'/saved/briefing',");
  });
});

describe('R1.1 · CTO rulings on 79a8f00 (dark drawer, compact footer, icon-only New question)', () => {
  const r11 = navCss.slice(navCss.indexOf('ASK R3 NAVIGATION / USABILITY R1.1'));

  it('the dark drawer uses the R3 near-black tokens, scoped to the drawer only', () => {
    const dark = r11.slice(r11.indexOf(":global([data-gna-theme='dark']) .drawer"));
    expect(dark).toMatch(/^:global\(\[data-gna-theme='dark'\]\) \.drawer,\s*:global\(html\[data-gna-schedule='dark'\] \[data-gna-theme='scheduled'\]\) \.drawer \{/);
    const block = dark.slice(0, dark.indexOf('}'));
    expect(block).toContain('--ad-surface: #0f1420;');
    expect(block).toContain('--ad-surface-2: #161d2c;');
    expect(block).toContain('--ad-line: #1e2636;');
    expect(block).toContain('--ad-ink: #edeff5;');
    expect(block).toContain('--ad-accent-soft: #16223f;');
    /* system / scheduled dark follow the same set; light keeps R3's light set */
    expect(r11).toMatch(/@media \(prefers-color-scheme: dark\) \{\s*:global\(\[data-gna-theme='system'\]\) \.drawer,/);
    expect(r11).toMatch(/:global\(\[data-gna-theme='light'\]\) \.drawer,[\s\S]*?--ad-surface: #ffffff;/);
    /* every rule in this block targets the drawer or its footer, nothing page-wide */
    const rules = r11.replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = rules.match(/^[^\s@}-][^{;]*\{/gm) ?? [];
    expect(selectors.length).toBeGreaterThan(5);
    for (const selector of selectors) {
      expect(selector).toMatch(/\.drawer|\.readingFooter|\.footer|\.legalRow/);
    }
  });

  it('the footer is the compact R3 footer: Account · name, then small rows, every destination kept', () => {
    expect(footer).toContain("const accountLine = displayName !== null ? `${s.account} · ${displayName}` : s.account;");
    expect(footer).toContain('const displayName = useAskNavOptional()?.displayName ?? null;');
    /* label in name: the visible words first, then the destination (Settings) they open */
    expect(footer).toContain('aria-label={`${accountLine}, ${s.settings}`}');
    const order = ['footer-account-row', 'footer-settings', 'footer-sign-out', 'footer-sign-in', 'footer-destinations', 'footer-updates', 'footer-saved', 'footer-help', 'footer-preferences', '<LanguageSelector', '<ThemeControl', 'href="/privacy"', 'href="/cookies"'];
    const at = order.map((needle) => footer.indexOf(needle));
    for (const index of at) expect(index).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    /* 44 px targets kept on the small rows and the legal links */
    expect(navCss).toMatch(/\.readingFooterLink \{[^}]*min-height: 44px;/);
    expect(r11).toMatch(/\.footerSmallRow \.legalRow a \{[^}]*min-height: 44px;/);
  });

  it('icon-only New question keeps its name, keyboard use and a 44 × 44 target', () => {
    expect(frameCss).toMatch(/\.newButton \{[^}]*min-height: var\(--ad-target, 44px\);[^}]*min-width: var\(--ad-target, 44px\);/);
    expect(navCss).toMatch(/\.continuityNew \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
    expect(frame).toMatch(/<button\s+type="button"\s+data-ask="new-question"/);
  });
});

describe('6 · preserved', () => {
  it('"Working on your question…" wording and the radar emblem are untouched by this lane', () => {
    expect(frame).toContain('<AskEmblem placement="page" state={emblemState} />');
    expect(frame).toContain('<AskEmblemMark />');
  });
  it('no notification bell and no Resume glyph', () => {
    const entries = read('components', 'ask-frame', 'AskWelcomeEntries.tsx');
    for (const file of [frame, shell, continuity, entries]) {
      expect(file).not.toMatch(/\bbell\b|🔔/i);
    }
    /*
      SUPERSEDED, NOT DELETED — the original assertion read:
          expect(entries).toContain('<span dir="auto" className={styles.r3OneLine}>');
      IA + GUIDED DISCOVER R2, decision 5 (PO-approved 11 Oct 2026): Continue titles are now TWO
      lines, so the one-line clamp is obsolete. The point it protected — the reader's own words
      keep their own direction — still holds and is asserted here.
    */
    expect(entries).toContain('<span dir="auto" className={styles.iaTwoLine}>');
  });
});
