import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: () => undefined }) }));
jest.mock('@/components/bookmark/StoryBookmark', () => ({ StoryBookmark: () => null }));

import { HOME_R1_GATES_OFF, homeR1Gates, parseReleaseGatesMeta, releaseGatesMeta } from '@/lib/platform/homeR1Gates';
import { StoryCardActions } from '@/components/home/r1/StoryCardActions';
import { AlertSetupSheet } from '@/components/home/r1/stageb/AlertSetupSheet';
import { homeR1En } from '@/lib/i18n/dictionaries/homeR1En';
import { homeR1Pl } from '@/lib/i18n/dictionaries/homeR1Pl';
import { relationSentences } from '@/lib/home/compareRelation';
import { resetStageBForTests, setAlertFor, setCount, setCounts } from './stageBStore';
import { STORY_TASK_KEY, TASK_TTL_MS, clearStoryTask, saveStoryTask, takeStoryTask } from './storyTask';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE B — THE FRONTEND CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 */
const SRC = join(__dirname, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(SRC, ...parts), 'utf8');
const code = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const walk = (dir: string, acc: string[] = []): string[] => {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, acc);
    else if (/\.tsx?$/.test(e) && !e.endsWith('.spec.ts')) acc.push(f);
  }
  return acc;
};
const STAGE_B_FILES = [...walk(join(SRC, 'components', 'home', 'r1', 'stageb')), ...walk(join(SRC, 'lib', 'stories'))];

const REF = 'a'.repeat(64);
const URL_A = 'https://wire.example/story-a';
const card = { title: 'Port strike halts exports', sourceName: 'Wire' };
const actions = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(StoryCardActions, { articleRef: REF, url: URL_A, card, language: 'en', compare: false, ...props } as never));

/* sessionStorage stand-in for the node environment. */
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe('Stage B gates — default OFF, literal, dependent, one authority each', () => {
  const ALL = {
    GNA_HOME_R1: 'true',
    GNA_HOME_CARD_ACTIONS: 'true',
    GNA_DISCUSSION_READ: 'true',
    GNA_DISCUSSION_WRITE: 'true',
    GNA_ALERTS_IN_APP: 'true',
  };
  it('unset ⇒ OFF', () => {
    expect(homeR1Gates({})).toEqual(HOME_R1_GATES_OFF);
    expect(HOME_R1_GATES_OFF).toMatchObject({ discussionRead: false, discussionWrite: false, alertsInApp: false });
  });
  it('dependencies: discussion and alerts need card actions; write needs read', () => {
    expect(homeR1Gates({ ...ALL, GNA_HOME_CARD_ACTIONS: undefined })).toMatchObject({ discussionRead: false, discussionWrite: false, alertsInApp: false });
    expect(homeR1Gates({ ...ALL, GNA_DISCUSSION_READ: undefined })).toMatchObject({ discussionRead: false, discussionWrite: false, alertsInApp: true });
    expect(homeR1Gates(ALL)).toMatchObject({ discussionRead: true, discussionWrite: true, alertsInApp: true });
  });
  it('only the literal "true"', () => {
    for (const v of ['1', 'TRUE', ' true', 'yes']) {
      expect(homeR1Gates({ ...ALL, GNA_DISCUSSION_READ: v, GNA_ALERTS_IN_APP: v })).toMatchObject({ discussionRead: false, alertsInApp: false });
    }
  });
  it('the client meta round-trips and re-applies the dependencies', () => {
    const on = homeR1Gates(ALL);
    expect(parseReleaseGatesMeta(releaseGatesMeta(on)!['gna-release-gates'])).toEqual(on);
    expect(parseReleaseGatesMeta('discussionWrite,alertsInApp')).toEqual(HOME_R1_GATES_OFF);
  });
  it('no Stage B gate is read by an Ask spend path, and delivery / checkout have no variable at all', () => {
    const gates = code(read('lib', 'platform', 'homeR1Gates.ts'));
    expect(gates).not.toMatch(/GNA_ALERTS_DELIVERY|GNA_BILLING|CHECKOUT/);
    for (const f of walk(join(SRC, 'lib', 'ask'))) expect(read(...f.slice(SRC.length + 1).split(/[\\/]/))).not.toMatch(/GNA_DISCUSSION|GNA_ALERTS/);
  });
});

describe('Card actions — only what exists, real counts only, publisher link untouched', () => {
  beforeEach(() => resetStageBForTests());

  it('gates OFF: no Discuss, no Alert, no teaser', () => {
    const html = actions({});
    expect(html).not.toMatch(/data-story-action="(discuss|alert)"/);
    expect(html).not.toMatch(/Discuss|Alert/);
  });

  it('Discuss shows a number ONLY when the server reported one', () => {
    expect(actions({ discuss: true })).toMatch(/data-story-action="discuss"[^>]*>.*<span>Discuss<\/span>/);
    setCounts({ [REF]: 3 });
    expect(actions({ discuss: true })).toContain('<span>Discuss · 3</span>');
    setCount(REF, 0);
    expect(actions({ discuss: true })).toContain('<span>Discuss</span>');
    expect(actions({ discuss: true })).not.toMatch(/Discuss · 0/);
  });

  it('Alert reflects the server state; never "on" by default', () => {
    expect(actions({ alert: true })).toMatch(/aria-pressed="false"[^>]*>.*<span>Alert<\/span>/);
    setAlertFor(REF, { alertId: 'x', status: 'ACTIVE' });
    expect(actions({ alert: true })).toContain('<span>Alert on</span>');
  });

  it('the action row contains no link: Discuss is a sibling of the publisher link, never inside it', () => {
    const html = actions({ discuss: true, alert: true, compare: true });
    expect(html).not.toMatch(/<a\b/);
  });
});

describe('Sign-in continuation — same-tab, single-use, validated, never in a URL', () => {
  const story = { articleRef: REF, url: URL_A, title: 'T', sourceName: 'S' };
  beforeEach(() => {
    (globalThis as unknown as { window: { sessionStorage: MemoryStorage } }).window = { sessionStorage: new MemoryStorage() };
  });
  afterAll(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });
  const raw = () => (globalThis as unknown as { window: { sessionStorage: MemoryStorage } }).window.sessionStorage;

  it('a discuss draft survives, is read once, then gone', () => {
    saveStoryTask({ kind: 'discuss', story, draft: 'My unsent draft', parentId: null }, 1000);
    expect(takeStoryTask(2000)).toEqual({ kind: 'discuss', story, draft: 'My unsent draft', parentId: null });
    expect(takeStoryTask(2000)).toBeNull();
  });
  it('an alert task carries no draft', () => {
    saveStoryTask({ kind: 'alert', story, draft: 'ignored' } as never, 1000);
    expect(JSON.parse(raw().getItem(STORY_TASK_KEY)!)).not.toHaveProperty('draft');
    expect(takeStoryTask(2000)).toEqual({ kind: 'alert', story });
  });
  it('expires, and a tampered record is discarded', () => {
    saveStoryTask({ kind: 'discuss', story, draft: 'x' }, 0);
    expect(takeStoryTask(TASK_TTL_MS + 1)).toBeNull();
    for (const bad of [
      { v: 1, kind: 'discuss', articleRef: 'not-a-ref', url: URL_A, at: 1 },
      { v: 1, kind: 'discuss', articleRef: REF, url: 'javascript:alert(1)', at: 1 },
      { v: 1, kind: 'post-now', articleRef: REF, url: URL_A, at: 1 },
      { v: 2, kind: 'alert', articleRef: REF, url: URL_A, at: 1 },
    ]) {
      raw().setItem(STORY_TASK_KEY, JSON.stringify(bad));
      expect(takeStoryTask(2)).toBeNull();
      expect(raw().getItem(STORY_TASK_KEY)).toBeNull();
    }
  });
  it('sign-out clears it', () => {
    saveStoryTask({ kind: 'discuss', story, draft: 'x' });
    clearStoryTask();
    expect(raw().getItem(STORY_TASK_KEY)).toBeNull();
    expect(code(read('lib', 'hooks', 'useAccount.ts')).match(/clearStoryTask\(\)/g)).toHaveLength(2);
  });
  it('sign-in goes to the EXISTING allow-listed "/" only; no draft or identity in a URL; no localStorage', () => {
    const sources = STAGE_B_FILES.map((f) => code(readFileSync(f, 'utf8'))).join('\n');
    const calls = sources.match(/accountSignInUrl\([^)]*\)/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const c of calls) expect(c).toBe("accountSignInUrl('/')");
    expect(sources).not.toMatch(/localStorage|indexedDB|document\.cookie/);
    expect(sources).not.toMatch(/[?&](draft|body|comment|question)=/);
  });
});

describe('Isolation — Discussion is never Ask, no AI, no provider, no delivery', () => {
  const sources = STAGE_B_FILES.map((f) => [f, code(readFileSync(f, 'utf8'))] as const);
  it('no Stage B file imports Ask, analysis or a provider', () => {
    for (const [, s] of sources) expect(s).not.toMatch(/askV2Api|analyzeNews|analysisApi|submitGlobalAsk|requestDeeperAsk|publishAskSelection|openGlobalAsk/);
  });
  it('the API client talks only to /discussion and /alerts through the account transport', () => {
    const api = code(read('lib', 'stories', 'stageBApi.ts'));
    const paths = [...api.matchAll(/call<[^>]*>\(\s*[`'](\/[a-z-]+)/g)].map((m) => m[1]);
    expect(new Set(paths)).toEqual(new Set(['/discussion', '/alerts']));
    expect(api).not.toMatch(/\bfetch\(/);
  });
  it('the Alert sheet collects no delivery consent: push and email are text, not controls', () => {
    const html = renderToStaticMarkup(createElement(AlertSetupSheet, { story: { articleRef: REF, url: URL_A, title: 'T', sourceName: 'S' }, language: 'en', signedIn: true }));
    expect(html).not.toMatch(/<input|<select|role="switch"|type="checkbox"/);
    expect((html.match(/data-delivery-unavailable=""/g) ?? []).length).toBe(2);
    expect(html).toContain('Not available');
    expect(html).toContain(homeR1En.alerts.followNote);
  });
});

describe('Themes — one component set, tokens only, semantic colors kept', () => {
  const sources = STAGE_B_FILES.filter((f) => f.endsWith('.tsx')).map((f) => code(readFileSync(f, 'utf8')));
  it('no hard-coded palette and no per-theme fork', () => {
    for (const s of sources) {
      expect(s).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(s).not.toMatch(/\bdark:|data-gna-theme|prefers-color-scheme|(bg|text|border)-(slate|gray|zinc|neutral|red|green|blue|amber|emerald|violet)-\d/);
    }
  });
  it('amber = alert attention, mint = follow note; violet (premium) and sand (metered) are never used here', () => {
    const all = sources.join('\n');
    expect(all).toMatch(/--gt-amber/);
    expect(all).toMatch(/--gt-mint/);
    expect(all).not.toMatch(/--gt-violet|--gt-sand/);
  });
});

describe('EN / PL', () => {
  const shape = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(shape) : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
  it('discussion and alerts copy have the same shape in both languages, none empty', () => {
    expect(shape(homeR1Pl.discussion)).toEqual(shape(homeR1En.discussion));
    expect(shape(homeR1Pl.alerts)).toEqual(shape(homeR1En.alerts));
    const flat = (o: unknown): string[] => (typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(flat) : o && typeof o === 'object' ? Object.values(o).flatMap(flat) : []);
    for (const s of [...flat(homeR1Pl.discussion), ...flat(homeR1Pl.alerts)]) expect(s.trim().length).toBeGreaterThan(0);
  });
  it('the copy never promises delivery, pricing or a plan', () => {
    const all = JSON.stringify([homeR1En.discussion, homeR1En.alerts, homeR1Pl.discussion, homeR1Pl.alerts]);
    expect(all).not.toMatch(/\$|€|zł|PLN|per month|\/mo|trial|Pro plan|subscribe/i);
  });
});

describe('Compare relation — only what identity proves', () => {
  const copy = homeR1En.compare;
  const A = 'a'.repeat(64);
  const B = 'b'.repeat(64);
  const C = 'c'.repeat(64);
  it('unavailable without identity; "Not established" without proof; never "separate" unless an editor split', () => {
    expect(relationSentences([A, B], undefined, copy)).toEqual({ kind: 'unavailable', lines: [copy.relationUnavailable] });
    const none = relationSentences([A, B], { storyIds: { [A]: null, [B]: null }, relations: [{ first: A, second: B, relation: 'NOT_ESTABLISHED' }] }, copy);
    expect(none).toEqual({ kind: 'none', lines: [copy.relationNotEstablished] });
    const proven = relationSentences(
      [A, B, C],
      {
        storyIds: { [A]: 's1', [B]: 's1', [C]: 's2' },
        relations: [
          { first: A, second: B, relation: 'SAME_STORY' },
          { first: A, second: C, relation: 'SEPARATED_BY_EDITOR' },
          { first: B, second: C, relation: 'NOT_ESTABLISHED' },
        ],
      },
      copy,
    );
    expect(proven.lines).toEqual(['Stories 1 and 2 are one story — proven by stored story identity.', 'Stories 1 and 3 were separated by an editor.']);
  });
  it('an unknown relation value from the server is ignored, not displayed', () => {
    const r = relationSentences([A, B], { storyIds: {}, relations: [{ first: A, second: B, relation: 'AGREES' as never }] }, copy);
    expect(r.kind).toBe('none');
  });
  it('Compare still fabricates no claims or gaps', () => {
    const compare = code(read('components', 'home', 'r1', 'HomeR1Compare.tsx'));
    expect(compare).toMatch(/label: t\.rows\.claims, value: \(\) => \(read\.kind === 'ready' \? t\.noBrief : ''\)/);
    expect(compare).toMatch(/label: t\.rows\.gaps, value: \(\) => \(read\.kind === 'ready' \? t\.notAvailable : ''\)/);
  });
});
