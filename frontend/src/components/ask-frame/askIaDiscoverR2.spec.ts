import { askR38Strings } from '@/lib/ask/askR38Strings';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { AskWelcomeEntries } from './AskWelcomeEntries';
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
      /* R3.1 FIX 1 — the entries take no reader history any more (signedIn / recent / wide are
         kept in this helper's signature only so the cases below read as before) */
      createElement(AskWelcomeEntries, {
        locale: p.locale ?? 'en',
        onStageDraft: p.onStage ?? (() => undefined),
        compact: p.compact ?? false,
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
      /* MASTER CTO R38 · U-3 — G3 is a career QUESTION entry while listings are not connected */
      ['cue-g3', askR38Strings('en').jobsCue],
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

/*
  SUPERSEDED, NOT DELETED — "Continue — real conversations, no counts" (IA R2 decision 5: 3 rows on
  a phone, 5 at >=1024, 1 when compact, each with its real time; no block without a reopenable
  conversation). R3.1 PRODUCT OWNER ACCEPTANCE · FIX 1 (MASTER CTO, 2026-10-11) removes Continue
  from the Ask home entirely: no question titles, no timestamps, no "All conversations", at any
  width. What those cases protected — nothing invented, no count — is now trivially and more
  strictly true, and is asserted here: the home renders no conversation at all, even when the
  reader has eight.
*/
describe('R3.1 FIX 1 — the Ask home shows no history', () => {
  for (const [compact, wide] of [
    [false, false],
    [false, true],
    [true, false],
  ] as const) {
    it(`no Continue, Resume, time or "All conversations" (compact=${compact}, wide=${wide})`, () => {
      const root = render({ signedIn: true, recent: [1, 2, 3, 4, 5, 6, 7, 8].map(thread), compact, wide });
      for (const id of ['welcome-resume-group', 'welcome-resume', 'welcome-continue', 'continue-heading', 'continue-when', 'all-conversations', 'welcome-updates']) {
        expect(byAsk(root, id)).toHaveLength(0);
      }
      expect(root.findAll((n) => n.type === 'a')).toHaveLength(0);
      expect(textOf(root)).not.toMatch(/Question number|living costs/);
    });
  }
});

describe('the compact rule (02 decision 4)', () => {
  /*
    SUPERSEDED, NOT DELETED — "compact drops the My updates row — it is already in the primary
    nav" (IA R2 decision 4). R3.1 FIX 1 drops the row at EVERY size: My updates lives in the
    primary navigation only. Asserted for both sizes.
  */
  it('R3.1 — no My updates activity row at any size (it is in the primary nav)', () => {
    const follows = { followed: 2, withChanges: 1, lastSuccessfulAt: '2026-10-10T08:00:00Z' };
    const render2 = (compact: boolean) => {
      let r!: ReturnType<typeof create>;
      act(() => {
        r = create(
          createElement(AskWelcomeEntries, {
            locale: 'en' as DisplayLocale,
            compact,
            onStageDraft: () => undefined,
            onOpenJobs: () => undefined,
            placement: 'welcome',
          }),
        );
      });
      return r.root;
    };
    void follows;
    expect(byAsk(render2(false), 'welcome-updates')).toHaveLength(0);
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
