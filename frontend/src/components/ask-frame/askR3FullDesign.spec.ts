import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { AskJobSetupSheet } from './AskJobSetupSheet';
import { AskWelcomeEntries } from './AskWelcomeEntries';
import { askR3FullStrings, askR3FullStringsQualified, ASK_R3_FULL_LOCALES } from '@/lib/ask/askR3FullStrings';
import type { AskV2RecentThread } from '@/lib/api/askV2Api';

jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const react = require('react') as typeof import('react');
  return {
    __esModule: true,
    default: ({ prefetch: _prefetch, ...props }: Record<string, unknown>) => react.createElement('a', props),
  };
});

/*
  ASK R3 FULL DESIGN R1 — master CTO contract 2026-10-09 §2 (owner rail ruling) and §3 (welcome),
  plus J01 / J06-unsupported. Every case here is something the PO found missing on Alpha 6d7ab6a.
*/
const read = (...p: string[]) => readFileSync(join(__dirname, ...p), 'utf8');
const textOf = (node: ReactTestInstance): string =>
  node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const byAsk = (root: ReactTestInstance, id: string) =>
  root.findAll((n) => typeof n.type === 'string' && n.props['data-ask'] === id);

describe('copy (R3 WELCOME_PLACEHOLDER_SPEC / HANDOFF §6), seven locales', () => {
  it('EN is the design wording verbatim', () => {
    const en = askR3FullStrings('en');
    expect(en.welcomeSupport).toBe('See what changed in the questions that matter to you, with evidence.');
    expect(en.coverageRegions).toBe('Europe · East Africa · Middle East');
    expect(en.coverageFocusLabel).toBe('Coverage focus: ');
    expect(en.jobEntry).toBe('Job opportunities');
    expect(en.jobNotNoJobs('Kigali')).toContain('This isn’t a “no jobs” result.');
  });
  it('all seven Ask locales exist; only EN is qualified (the rest are drafts for Claude L)', () => {
    expect([...ASK_R3_FULL_LOCALES].sort()).toEqual(['ar', 'de', 'en', 'es', 'fr', 'pl', 'pt']);
    for (const locale of ASK_R3_FULL_LOCALES) {
      const s = askR3FullStrings(locale);
      expect(s.welcomeSupport.length).toBeGreaterThan(10);
      expect(askR3FullStringsQualified(locale)).toBe(locale === 'en');
      /* the place the reader typed is shown back verbatim, in every locale */
      expect(s.jobUnsupported('Reykjavík')).toContain('Reykjavík');
      expect(s.jobNotNoJobs('Reykjavík')).toContain('Reykjavík');
    }
  });
  it('no copy carries a number (no invented counts, coverage or N)', () => {
    for (const locale of ASK_R3_FULL_LOCALES) {
      const s = askR3FullStrings(locale);
      for (const value of Object.values(s)) {
        if (typeof value === 'string') expect(value).not.toMatch(/\d/);
      }
    }
  });
});

describe('§2 owner rail ruling — Conversations hidden by default, opened on request', () => {
  const frame = read('AskFrameScreen.tsx');
  const css = read('askDashboard.module.css');
  it('the column exists only where no drawer is supplied', () => {
    expect(frame).toMatch(/const persistentRail = wide && shellMenu === undefined;/);
    expect(frame).toMatch(/data-ask-rail=\{persistentRail \? 'column' : 'drawer'\}/);
    expect(frame).toMatch(/\{persistentRail && \(\s*<aside data-ask="history"/);
  });
  it('≥1024 the standalone grid reserves no history track and shows the menu control', () => {
    const rule = css.slice(css.indexOf("R3 FULL DESIGN · PRODUCT OWNER RAIL RULING"));
    expect(rule).toMatch(/\.page\[data-ask-standalone\] \.frame\[data-ask-rail='drawer'\] \{\s*grid-template-columns: minmax\(0, 1fr\) auto;/);
    expect(rule).not.toMatch(/'history /);
    expect(rule).toMatch(/\[data-ask-rail='drawer'\] :global\(\[data-ask='shell-menu'\]\) \{\s*display: inline-flex;/);
  });
  it('My updates is reachable from the drawer (it was only reachable from a Follow control)', () => {
    const footer = readFileSync(join(__dirname, '..', 'ask-nav', 'AskReadingFooter.tsx'), 'utf8');
    expect(footer).toMatch(/href=\{MY_UPDATES_HREF\}[\s\S]{0,120}data-ask-nav="footer-updates"/);
  });
  it('the job sheet suspends the rotating example like the drawer does', () => {
    expect(frame).toMatch(/suspended: nav\?\.open === true \|\| jobSheetOpen/);
  });
});

describe('§3 welcome entries (§Composition 6–8)', () => {
  const thread = (over: Partial<AskV2RecentThread>): AskV2RecentThread =>
    ({
      id: 't1',
      language: 'en',
      returnPath: null,
      createdAt: '2026-10-09T08:00:00Z',
      lastActiveAt: '2026-10-09T09:00:00Z',
      turnCount: 1,
      firstQuestion: 'What changed in living costs in Poland?',
      firstQuestionTruncated: false,
      latestTurnId: 'u1',
      latestOperationId: 'op-1',
      ...over,
    }) as AskV2RecentThread;
  const render = (props: {
    signedIn: boolean;
    latest: AskV2RecentThread | null;
    follows?: { followed: number; withChanges: number; lastSuccessfulAt: string | null } | null;
  }) => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(
        createElement(AskWelcomeEntries, { locale: 'en', onOpenJobs: () => undefined, placement: 'welcome', ...props }),
      );
    });
    return r.root;
  };
  /*
    SUPERSEDED, NOT DELETED — the original assertion read:
        const job = byAsk(root, 'job-entry')[0]!;
        expect(textOf(job)).toBe('Job opportunities›');
    IA + GUIDED DISCOVER R2, decision 2, approved by the Product Owner through the Master CTO on
    11 Oct 2026 ("APPROVE ALL AS DRAWN"): the "Job opportunities ›" TEXT LINK is replaced by the
    G3 cue, which opens the SAME J01 sheet. The old text no longer exists, so the old assertion is
    obsolete rather than failing. What it protected — a guest sees the job affordance and the
    coverage line and no private group — is asserted below against the approved arrangement.
  */
  it('a guest sees the job affordance (G3) and the coverage line, and no private group', () => {
    const root = render({ signedIn: false, latest: null });
    expect(byAsk(root, 'welcome-resume-group')).toHaveLength(0);
    const g3 = byAsk(root, 'cue-g3')[0]!;
    expect(textOf(g3)).toBe('Find job opportunities');
    expect(g3.props.type).toBe('button');
    expect(byAsk(root, 'job-entry')).toHaveLength(0);
    const line = byAsk(root, 'coverage-focus')[0]!;
    expect(textOf(line)).toBe('Coverage focus: Europe · East Africa · Middle East');
  });
  /*
    ASK R3 NAVIGATION / USABILITY R1 (CTO R3 conformity rulings, 2026-10-10) — My updates appears
    only when real followed questions exist, and carries only the facts the briefings read
    returned. It still carries NO invented "to review" count (no reviewed state: B2).
  */
  it('signed in: Resume opens the reader’s own latest stored answer; My updates carries only real follow facts', () => {
    const root = render({
      signedIn: true,
      latest: thread({}),
      follows: { followed: 2, withChanges: 1, lastSuccessfulAt: null },
    });
    const resume = byAsk(root, 'welcome-resume')[0]!;
    expect(resume.props.href).toBe('/ask?operation=op-1');
    expect(textOf(resume)).toContain('What changed in living costs in Poland?');
    const updates = byAsk(root, 'welcome-updates')[0]!;
    expect(updates.props.href).toBe('/saved/updates');
    expect(textOf(updates)).toBe('My updates2 followed · 1 with changes at last check›');
    expect(textOf(updates)).not.toMatch(/review|unread|new for you/i);
  });
  it('signed in with no conversation: no Resume row is invented', () => {
    const root = render({ signedIn: true, latest: null, follows: { followed: 1, withChanges: 0, lastSuccessfulAt: null } });
    expect(byAsk(root, 'welcome-resume')).toHaveLength(0);
    expect(byAsk(root, 'welcome-updates')).toHaveLength(1);
  });
  it('signed in with nothing followed: no My updates entry is manufactured (and no empty group)', () => {
    const root = render({ signedIn: true, latest: null, follows: null });
    expect(byAsk(root, 'welcome-updates')).toHaveLength(0);
    expect(byAsk(root, 'welcome-resume-group')).toHaveLength(0);
    const withResume = render({ signedIn: true, latest: thread({}), follows: null });
    expect(byAsk(withResume, 'welcome-resume')).toHaveLength(1);
    expect(byAsk(withResume, 'welcome-updates')).toHaveLength(0);
  });
  it('a desktop entry under the centred composer is not typing (real-browser finding: it unmounted mid-click)', () => {
    const frame = read('AskFrameScreen.tsx');
    expect(frame).toContain(`closest?.('[data-ask="welcome-entries-desktop"]') != null) return;`);
    expect(frame).toMatch(/\{entryState && !typing && \(\s*<AskWelcomeEntries/);
  });
  it('the frame greets a signed-in reader neutrally when no name was saved, and a guest not at all', () => {
    const frame = read('AskFrameScreen.tsx');
    expect(frame).toMatch(/\{signedInReader && \(\s*<p data-ask="welcome-greeting"/);
    expect(frame).toMatch(/: r3\.welcomeBack\}/);
    expect(frame).toMatch(/const signedInReader = !guestMode && nav\?\.account === 'signed-in';/);
  });
});

describe('J01 setup → J06-unsupported: truthful, local, and runs nothing', () => {
  let fetchSpy: jest.SpyInstance;
  /* the node test environment has no DOM; the sheet only needs key listeners and activeElement */
  const listeners: Array<(event: { key: string }) => void> = [];
  beforeAll(() => {
    (globalThis as { document?: unknown }).document = {
      activeElement: null,
      addEventListener: (_: string, fn: (event: { key: string }) => void) => listeners.push(fn),
      removeEventListener: () => undefined,
    };
  });
  afterAll(() => {
    delete (globalThis as { document?: unknown }).document;
  });
  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch' as never).mockImplementation((() => {
      throw new Error('no network expected');
    }) as never);
  });
  afterEach(() => fetchSpy.mockRestore());

  const open = () => {
    let r!: ReturnType<typeof create>;
    const onClose = jest.fn();
    const onAskGeneral = jest.fn();
    act(() => {
      r = create(createElement(AskJobSetupSheet, { locale: 'en', onClose, onAskGeneral }), {
        createNodeMock: () => ({ focus: () => undefined, querySelectorAll: () => [] }),
      });
    });
    return { root: r.root, onClose, onAskGeneral };
  };
  const setInput = (root: ReactTestInstance, id: string, value: string) =>
    act(() => byAsk(root, id)[0]!.props.onChange({ target: { value } }));

  it('is a named modal dialog; Search is disabled until a place is typed', () => {
    const { root } = open();
    const dialog = root.find((n) => n.props.role === 'dialog');
    expect(dialog.props['aria-modal']).toBe('true');
    expect(byAsk(root, 'job-search')[0]!.props.disabled).toBe(true);
    setInput(root, 'job-role', 'accountant');
    expect(byAsk(root, 'job-search')[0]!.props.disabled).toBe(true);
    setInput(root, 'job-place', 'Kigali, Rwanda');
    expect(byAsk(root, 'job-search')[0]!.props.disabled).toBe(false);
  });
  it('Search shows the coverage truth for the typed place — never "no jobs" — with zero network', () => {
    const { root } = open();
    setInput(root, 'job-place', 'Kigali, Rwanda');
    act(() => byAsk(root, 'job-setup')[0]!.props.onSubmit({ preventDefault: () => undefined }));
    const outcome = byAsk(root, 'job-outcome')[0]!;
    expect(outcome.props['data-ask-job-outcome']).toBe('UNSUPPORTED');
    const text = textOf(outcome);
    expect(text).toContain('Ask doesn’t check job sources for Kigali, Rwanda yet.');
    expect(text).toContain('This isn’t a “no jobs” result.');
    expect(text).not.toMatch(/no matching listings|\d+ listings?/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('Escape closes the sheet', () => {
    listeners.length = 0;
    const { onClose } = open();
    act(() => listeners.forEach((fn) => fn({ key: 'Escape', stopPropagation: () => undefined } as never)));
    expect(onClose).toHaveBeenCalled();
  });
  it('"Ask a general question" hands back to the composer; Close closes', () => {
    const { root, onClose, onAskGeneral } = open();
    setInput(root, 'job-place', 'Warsaw');
    act(() => byAsk(root, 'job-setup')[0]!.props.onSubmit({ preventDefault: () => undefined }));
    act(() => byAsk(root, 'job-ask-general')[0]!.props.onClick());
    expect(onAskGeneral).toHaveBeenCalledTimes(1);
    act(() => byAsk(root, 'job-sheet-close')[0]!.props.onClick());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('carries no location prompt and no fixture listings', () => {
    const sheet = read('AskJobSetupSheet.tsx');
    expect(sheet).not.toMatch(/geolocation/);
    expect(sheet).not.toMatch(/Example Savings|samplehealth|jobs-board\.test/);
  });
});
