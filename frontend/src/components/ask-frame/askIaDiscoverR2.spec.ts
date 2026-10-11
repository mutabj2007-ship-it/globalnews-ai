import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { AskWelcomeEntries, continueRowCount } from './AskWelcomeEntries';
import { askDiscoverStrings, ASK_DISCOVER_QUALIFIED_LOCALES } from '@/lib/ask/askDiscoverStrings';
import { ASK_R3_FULL_LOCALES } from '@/lib/ask/askR3FullStrings';
import type { AskV2RecentThread } from '@/lib/api/askV2Api';
import type { DisplayLocale } from '@globalnews-ai/shared';

jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const react = require('react') as typeof import('react');
  return { __esModule: true, default: ({ prefetch: _p, ...props }: Record<string, unknown>) => react.createElement('a', props) };
});

/*
  ASK R3 IA + GUIDED DISCOVER R2 — Claude Design GLOBALNEWSAI-R3-IA-DISCOVER-FINAL-R2.zip
  (SHA-256 574fc35b…55e32be8, verified on this workstation), approved by the Product Owner
  through the Master CTO on 11 Oct 2026: "OPTION 1 — APPROVE ALL AS DRAWN".
*/
const textOf = (n: ReactTestInstance): string =>
  n.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const byAsk = (root: ReactTestInstance, id: string) =>
  root.findAll((n) => typeof n.type === 'string' && n.props['data-ask'] === id);
const svgs = (n: ReactTestInstance) => n.findAll((x) => x.type === 'svg');

const thread = (i: number): AskV2RecentThread =>
  ({
    id: `t${i}`,
    language: 'en',
    returnPath: null,
    createdAt: '2026-10-09T08:00:00Z',
    lastActiveAt: `2026-10-${String(10 - i).padStart(2, '0')}T09:00:00Z`,
    turnCount: 1,
    firstQuestion: `Question number ${i} about living costs and energy prices in Poland`,
    firstQuestionTruncated: false,
    latestTurnId: `u${i}`,
    latestOperationId: `op-${i}`,
  }) as unknown as AskV2RecentThread;

const render = (p: {
  signedIn: boolean;
  recent?: readonly AskV2RecentThread[];
  compact?: boolean;
  wide?: boolean;
  locale?: DisplayLocale;
  onStage?: (d: string, h: string) => void;
  onJobs?: () => void;
}) => {
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(
      createElement(AskWelcomeEntries, {
        locale: p.locale ?? 'en',
        signedIn: p.signedIn,
        latest: p.recent?.[0] ?? null,
        recent: p.recent ?? [],
        onStageDraft: p.onStage ?? (() => undefined),
        compact: p.compact ?? false,
        wide: p.wide ?? false,
        onOpenJobs: p.onJobs ?? (() => undefined),
        placement: 'welcome',
      }),
    );
  });
  return r.root;
};

describe('G1 G2 G3 guided cues, and the G4 globe that is not one', () => {
  it('all three cues render with their approved labels and their own glyph', () => {
    const root = render({ signedIn: true, recent: [thread(1)] });
    const g = askDiscoverStrings('en');
    for (const [id, label] of [
      ['cue-g1', g.cueRegion],
      ['cue-g2', g.cueStory],
      ['cue-g3', g.cueJobs],
    ] as const) {
      const cue = byAsk(root, id)[0]!;
      expect(cue.type).toBe('button');
      expect(cue.props.type).toBe('button');
      expect(textOf(cue)).toBe(label);
      expect(svgs(cue)).toHaveLength(1);
      expect(svgs(cue)[0]!.props['aria-hidden']).toBe(true);
      expect(svgs(cue)[0]!.props.focusable).toBe('false');
      expect(svgs(cue)[0]!.props.strokeWidth).toBe(1.8);
      expect(svgs(cue)[0]!.props.viewBox).toBe('0 0 24 24');
    }
  });
  it('G1 and G2 STAGE a draft and a hint — and never submit', () => {
    const staged: { draft: string; hint: string }[] = [];
    const root = render({ signedIn: true, recent: [thread(1)], onStage: (draft, hint) => staged.push({ draft, hint }) });
    const g = askDiscoverStrings('en');
    act(() => {
      (byAsk(root, 'cue-g1')[0]!.props.onClick as () => void)();
      (byAsk(root, 'cue-g2')[0]!.props.onClick as () => void)();
    });
    expect(staged).toEqual([
      { draft: g.draftRegion, hint: g.hintRegion },
      { draft: g.draftStory, hint: g.hintStory },
    ]);
    /* no form, no submit, no href anywhere in the cue cluster */
    const cluster = byAsk(root, 'discover-cues')[0]!;
    expect(cluster.findAll((n) => n.type === 'form')).toHaveLength(0);
    for (const b of cluster.findAll((n) => n.type === 'button')) {
      expect(b.props.type).toBe('button');
      expect(b.props.href).toBeUndefined();
      expect(b.props.onSubmit).toBeUndefined();
    }
  });
  it('G3 opens the EXISTING job sheet and the old text link is gone', () => {
    let opened = 0;
    const root = render({ signedIn: true, recent: [thread(1)], onJobs: () => { opened += 1; } });
    act(() => {
      (byAsk(root, 'cue-g3')[0]!.props.onClick as () => void)();
    });
    expect(opened).toBe(1);
    expect(byAsk(root, 'job-entry')).toHaveLength(0);
  });
  it('G4 is informational: a globe on the coverage line, never a control', () => {
    const root = render({ signedIn: true, recent: [thread(1)] });
    const line = byAsk(root, 'coverage-focus')[0]!;
    expect(line.type).toBe('p');
    expect(line.props.onClick).toBeUndefined();
    expect(line.props.role).toBeUndefined();
    expect(line.props.tabIndex).toBeUndefined();
    const globe = svgs(line)[0]!;
    expect(globe.props['data-ask-cue-icon']).toBe('g4');
    expect(globe.props['aria-hidden']).toBe(true);
    expect(globe.props.width).toBe(16);
  });
});

describe('Continue — real conversations, no counts', () => {
  it('3 rows on a phone, 5 at >=1024, 1 when compact', () => {
    expect(continueRowCount(false, false)).toBe(3);
    expect(continueRowCount(false, true)).toBe(5);
    expect(continueRowCount(true, false)).toBe(1);
    expect(continueRowCount(true, true)).toBe(1);
  });
  for (const [compact, wide, expected] of [
    [false, false, 3],
    [false, true, 5],
    [true, false, 1],
  ] as const) {
    it(`renders ${expected} row(s) from 8 real conversations (compact=${compact}, wide=${wide})`, () => {
      const recent = [1, 2, 3, 4, 5, 6, 7, 8].map(thread);
      const root = render({ signedIn: true, recent, compact, wide });
      const rows = [...byAsk(root, 'welcome-resume'), ...byAsk(root, 'welcome-continue')];
      expect(rows).toHaveLength(expected);
      for (const row of rows) expect(typeof row.props.href).toBe('string');
    });
  }
  it('every row carries its own real time and no count of any kind', () => {
    const root = render({ signedIn: true, recent: [1, 2, 3].map(thread) });
    const whens = byAsk(root, 'continue-when');
    expect(whens).toHaveLength(3);
    for (const w of whens) expect(textOf(w).trim().length).toBeGreaterThan(0);
    const group = byAsk(root, 'welcome-resume-group')[0]!;
    expect(textOf(group)).not.toMatch(/\(\d+\)|\b\d+\s+(new|unread|changes to review)\b/i);
  });
  it('no Continue block at all when the reader has no reopenable conversation', () => {
    const root = render({ signedIn: true, recent: [] });
    expect(byAsk(root, 'continue-heading')).toHaveLength(0);
    expect(byAsk(root, 'welcome-resume')).toHaveLength(0);
    expect(byAsk(root, 'all-conversations')).toHaveLength(0);
  });
});

describe('the compact rule (02 decision 4)', () => {
  it('compact drops the My updates row — it is already in the primary nav', () => {
    const follows = { followed: 2, withChanges: 1, lastSuccessfulAt: '2026-10-10T08:00:00Z' };
    const render2 = (compact: boolean) => {
      let r!: ReturnType<typeof create>;
      act(() => {
        r = create(
          createElement(AskWelcomeEntries, {
            locale: 'en' as DisplayLocale,
            signedIn: true,
            latest: thread(1),
            recent: [thread(1)],
            follows,
            compact,
            wide: false,
            onStageDraft: () => undefined,
            onOpenJobs: () => undefined,
            placement: 'welcome',
          }),
        );
      });
      return r.root;
    };
    expect(byAsk(render2(false), 'welcome-updates')).toHaveLength(1);
    expect(byAsk(render2(true), 'welcome-updates')).toHaveLength(0);
  });
  it('the cue cluster becomes a list when compact and pills otherwise', () => {
    expect(byAsk(render({ signedIn: true, recent: [thread(1)], compact: true }), 'discover-cues')[0]!
      .props['data-ask-compact']).toBe('true');
    expect(byAsk(render({ signedIn: true, recent: [thread(1)], compact: false }), 'discover-cues')[0]!
      .props['data-ask-compact']).toBe('false');
  });
});

describe('the approved copy deck', () => {
  it('carries all seven Ask locales, and only EN is qualified', () => {
    for (const locale of ASK_R3_FULL_LOCALES as readonly DisplayLocale[]) {
      const g = askDiscoverStrings(locale);
      for (const value of Object.values(g)) expect(String(value).trim().length).toBeGreaterThan(0);
    }
    expect(ASK_DISCOVER_QUALIFIED_LOCALES).toEqual(['en']);
  });
  it('no cue label or draft carries an invented number', () => {
    for (const locale of ASK_R3_FULL_LOCALES as readonly DisplayLocale[]) {
      for (const value of Object.values(askDiscoverStrings(locale))) expect(String(value)).not.toMatch(/\d/);
    }
  });
});

describe('stylesheet: an appended ia… section only', () => {
  const css = readFileSync(join(__dirname, 'askDashboard.module.css'), 'utf8');
  /* from the section's own comment opener, so the banner is stripped with the comments */
  const section = css.slice(css.lastIndexOf('/*', css.indexOf('ASK R3 IA + GUIDED DISCOVER R2')));
  const rules = section.replace(/\/\*[\s\S]*?\*\//g, '');
  it('every selector it introduces is ia-prefixed, and nothing animates', () => {
    const selectors = rules.match(/[^{}]+(?=\{)/g) ?? [];
    expect(selectors.length).toBeGreaterThan(0);
    for (const sel of selectors) expect(sel).toMatch(/\.ia[A-Z]/);
    expect(rules).not.toMatch(/animation|transition/);
  });
  it('the cue target is at least 44 px', () => {
    expect(rules).toMatch(/min-height:\s*44px/);
  });
});
