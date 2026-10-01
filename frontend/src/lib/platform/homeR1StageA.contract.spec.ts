import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_SELECTED_STORIES, normalizeArticleUrl } from '@globalnews-ai/shared';
import {
  HOME_R1_GATES_OFF,
  STAGE_A_UNAVAILABLE,
  homeR1Gates,
  parseReleaseGatesMeta,
  releaseGatesMeta,
} from './homeR1Gates';
import { articleRefFor } from '@/lib/identity/articleRefServer';
import { articleRefOf, buildDockContextRef, dockContextKind, selectionContextRef } from '@/lib/ask/askContextRef';
import { clearHeldStories, peekHeldStories, releaseHeldStory, toggleHeldStory } from '@/lib/home/heldStoriesStore';
import { SIGN_IN_RETURN_DESTINATIONS, signInReturnFor } from '@/components/bookmark/StoryBookmark';
import { homeR1En } from '@/lib/i18n/dictionaries/homeR1En';
import { homeR1Pl } from '@/lib/i18n/dictionaries/homeR1Pl';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE A — THE CONTRACT (CTO §13)
 * ════════════════════════════════════════════════════════════════════════════
 */

const SRC = join(__dirname, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(SRC, ...parts), 'utf8');
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\{\s*\}/g, '{}');

/* The node test environment has no window: a minimal EventTarget stands in, so dispatches
   can be COUNTED rather than assumed. */
const events: string[] = [];
const target = new EventTarget();
const origDispatch = target.dispatchEvent.bind(target);
target.dispatchEvent = (event: Event): boolean => {
  events.push(event.type);
  return origDispatch(event);
};
(globalThis as unknown as { window: EventTarget }).window = target;

const URL_A = 'https://Wire.Example/story-a/?utm_source=x';
const URL_B = 'https://wire.example/story-b';

describe('§3 gate mapping — release gates are default OFF, literal, dependent, and not spend switches', () => {
  it('unset ⇒ every gate OFF', () => {
    expect(homeR1Gates({})).toEqual(HOME_R1_GATES_OFF);
  });

  it("ON is the exact literal 'true' (KS-6): TRUE / 1 / ' true' are OFF", () => {
    for (const value of ['TRUE', '1', ' true', 'yes', 'on']) {
      expect(homeR1Gates({ GNA_HOME_R1: value, GNA_ASK_EMBEDDED: value })).toEqual(HOME_R1_GATES_OFF);
    }
  });

  it('dependencies hold: actions need Home R1, tray needs actions, view needs tray, refs need embedded', () => {
    expect(homeR1Gates({ GNA_HOME_CARD_ACTIONS: 'true', GNA_COMPARE_TRAY: 'true', GNA_COMPARE_VIEW: 'true' })).toEqual(
      HOME_R1_GATES_OFF,
    );
    expect(homeR1Gates({ GNA_ASK_CONTEXT_REFS: 'true' }).askContextRefs).toBe(false);
    expect(
      homeR1Gates({
        GNA_HOME_R1: 'true',
        GNA_HOME_CARD_ACTIONS: 'true',
        GNA_COMPARE_TRAY: 'true',
        GNA_COMPARE_VIEW: 'true',
        GNA_ASK_EMBEDDED: 'true',
        GNA_ASK_CONTEXT_REFS: 'true',
      }),
    ).toEqual({ homeR1: true, cardActions: true, compareTray: true, compareView: true, askEmbedded: true, askContextRefs: true });
  });

  it('the client meta is absent when every gate is OFF, round-trips, and re-applies dependencies', () => {
    expect(releaseGatesMeta(HOME_R1_GATES_OFF)).toBeNull();
    const on = homeR1Gates({ GNA_ASK_EMBEDDED: 'true', GNA_ASK_CONTEXT_REFS: 'true' });
    expect(parseReleaseGatesMeta(releaseGatesMeta(on)!['gna-release-gates'])).toEqual(on);
    expect(parseReleaseGatesMeta('askContextRefs,compareView')).toEqual(HOME_R1_GATES_OFF);
  });

  it('the existing spend switches and the public root are read nowhere new and never defaulted', () => {
    const gates = code(read('lib', 'platform', 'homeR1Gates.ts'));
    for (const name of ['ASK_V2_ENABLED', 'ASK_R2_ENABLED', 'ASK_PUBLIC_COMPUTE_ENABLED', 'ASK_GUEST_TRIAL_ENABLED', 'GNA_PUBLIC_ROOT']) {
      expect(gates).not.toContain(name);
    }
    expect(read('lib', 'ask', 'standaloneRoot.ts')).toContain("return (env.GNA_PUBLIC_ROOT ?? '').trim().toLowerCase() !== 'platform';");
  });

  it('Discussion / Alerts / delivery / checkout are declared OFF in Stage A', () => {
    expect(STAGE_A_UNAVAILABLE).toEqual({
      discussionRead: false,
      discussionWrite: false,
      alertsInApp: false,
      alertsDelivery: false,
      billingCheckout: false,
    });
  });
});

describe('§9 identity — articleRef = sha256(normalizeArticleUrl(url)), server and browser agree', () => {
  it('the server helper equals the governed definition', () => {
    expect(articleRefFor(URL_A)).toBe(createHash('sha256').update(normalizeArticleUrl(URL_A), 'utf8').digest('hex'));
  });
  it('the browser computation (WebCrypto) is the same identity', async () => {
    expect(await articleRefOf(URL_A)).toBe(articleRefFor(URL_A));
  });
});

describe('§6 context references — identifiers only, stated precedence, nothing silently added', () => {
  const geography = { countryCode: 'RW', displayName: 'Rwanda' };
  const story = { title: 'Client-side title', url: URL_A, articleId: '1' };
  const selection = [{ articleRef: articleRefFor(URL_B), url: URL_B, label: 'Display label' }];

  it('precedence: held selection → story → country → none', () => {
    expect(dockContextKind({ selection, story, geography })).toBe('selection');
    expect(dockContextKind({ selection: [], story, geography })).toBe('story');
    expect(dockContextKind({ selection: [], story: { title: 'no url' }, geography })).toBe('geography');
    expect(dockContextKind({ selection: [], story: undefined, geography: undefined })).toBe('none');
  });

  it('the wire carries identities only — no title, label, summary or display name', async () => {
    const fromSelection = await buildDockContextRef({ selection, selectionEntry: 'my-intelligence', selectionAction: 'ASK_SELECTED', story, geography });
    expect(fromSelection).toEqual({ entry: 'my-intelligence', action: 'ASK_SELECTED', stories: [{ articleRef: articleRefFor(URL_B), url: URL_B }] });
    const fromStory = await buildDockContextRef({ selection: [], story, geography });
    expect(fromStory).toEqual({ entry: 'story', stories: [{ articleRef: articleRefFor(URL_A), url: URL_A }] });
    const fromMap = await buildDockContextRef({ selection: [], story: undefined, geography });
    expect(fromMap).toEqual({ entry: 'map', country: 'RW' });
    expect(JSON.stringify([fromSelection, fromStory, fromMap])).not.toMatch(/title|label|displayName|summary|Client-side/);
    expect(await buildDockContextRef({ selection: [], story: undefined, geography: undefined })).toBeUndefined();
  });

  it('selections are bounded at MAX_SELECTED_STORIES', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ articleRef: articleRefFor(`${URL_B}/${i}`), url: `${URL_B}/${i}` }));
    expect(selectionContextRef('COMPARE', many).stories).toHaveLength(MAX_SELECTED_STORIES);
  });
});

describe('§4/§9 selection — holding is zero-network and the ninth story is refused', () => {
  const fetchSpy = jest.fn();
  beforeAll(() => {
    (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;
  });
  beforeEach(() => clearHeldStories());

  it('hold, release, clear — and nothing is fetched', () => {
    const card = { title: 't', sourceName: 's' };
    for (let i = 0; i < MAX_SELECTED_STORIES; i += 1) {
      expect(toggleHeldStory({ articleRef: `${i}`.padStart(64, '0'), url: `${URL_B}/${i}`, card })).toBe('held');
    }
    expect(toggleHeldStory({ articleRef: '9'.padStart(64, '0'), url: `${URL_B}/9`, card })).toBe('full');
    expect(peekHeldStories()).toHaveLength(MAX_SELECTED_STORIES);
    expect(toggleHeldStory({ articleRef: '0'.padStart(64, '0'), url: `${URL_B}/0`, card })).toBe('released');
    releaseHeldStory('1'.padStart(64, '0'));
    expect(peekHeldStories()).toHaveLength(MAX_SELECTED_STORIES - 2);
    clearHeldStories();
    expect(peekHeldStories()).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('structurally: the stores, tray and actions touch no network, storage, analysis or Ask transport', () => {
    for (const file of [
      ['lib', 'home', 'heldStoriesStore.ts'],
      ['lib', 'ask', 'selectionContextStore.ts'],
      ['components', 'home', 'r1', 'StoryCardActions.tsx'],
    ]) {
      const source = code(read(...file));
      expect(source).not.toMatch(/fetch\(|localStorage|sessionStorage|indexedDB|analyzeNews|askV2Api|accountFetch/);
    }
  });
});

describe('§4 Compare — ONE zero-AI read of held reporting by identity', () => {
  it('posts identities only, without credentials, to the retained-read route', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ stories: [] }) });
    (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;
    const { resolveStoriesForCompare } = await import('@/lib/api/compareApi');
    await resolveStoriesForCompare([{ articleRef: articleRefFor(URL_B), url: URL_B, label: 'x' } as never]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toMatch(/\/news\/stories\/resolve$/);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(init.body)).toEqual({ stories: [{ articleRef: articleRefFor(URL_B), url: URL_B }] });
  });

  it('a released-off route (404) is UNAVAILABLE, not an error page', async () => {
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    const { resolveStoriesForCompare } = await import('@/lib/api/compareApi');
    expect(await resolveStoriesForCompare([])).toEqual({ ok: false, reason: 'UNAVAILABLE' });
  });

  it('structurally: Compare never imports the analysis client or the Ask V2 client', () => {
    const compare = code(read('components', 'home', 'r1', 'HomeR1Compare.tsx'));
    expect(compare).not.toMatch(/analyzeNews|askV2Api|analysisApi|\/analysis\//);
    expect((compare.match(/resolveStoriesForCompare\(/g) ?? []).length).toBe(1);
  });

  it('nothing is fabricated: claims, gaps and the event relation say Not available', () => {
    expect(homeR1En.compare.noBrief).toMatch(/^Not available/);
    expect(homeR1En.compare.relationUnavailable).toMatch(/^Not available/);
  });
});

describe('§7 My Intelligence — the same refusals first, then the ONE Ask engine', () => {
  beforeEach(() => {
    events.length = 0;
  });
  const story = (n: number) => ({ articleRef: articleRefFor(`${URL_B}/${n}`), url: `${URL_B}/${n}` });

  it('refusals happen BEFORE anything is published or dispatched', async () => {
    const { routeSelectionToAsk } = await import('@/lib/myIntelligence/selectionAsk');
    expect(() => routeSelectionToAsk('ASK_SELECTED', [story(1)], 'en', ' a ', {})).toThrow('question-required');
    expect(() => routeSelectionToAsk('COMPARE', [story(1)], 'en', undefined, {})).toThrow('too-few');
    expect(() =>
      routeSelectionToAsk('SUMMARIZE', Array.from({ length: 9 }, (_, i) => story(i)), 'en', undefined, {}),
    ).toThrow('too-many');
    expect(events).toEqual([]);
  });

  it('Ask about selected = ONE submit event (one ordinary turn); deeper = ONE quote request event', async () => {
    const { routeSelectionToAsk } = await import('@/lib/myIntelligence/selectionAsk');
    expect(routeSelectionToAsk('ASK_SELECTED', [story(1)], 'en', 'What links these?', {})).toBe('asked');
    expect(events).toEqual(['globalnews:ask-submit']);
    events.length = 0;
    let detail: unknown;
    const listener = (e: Event) => {
      detail = (e as CustomEvent).detail;
    };
    target.addEventListener('globalnews:ask-deeper', listener);
    expect(routeSelectionToAsk('COMPARE', [story(1), story(2)], 'pl', undefined, {})).toBe('quoted');
    target.removeEventListener('globalnews:ask-deeper', listener);
    expect(events).toEqual(['globalnews:ask-deeper']);
    expect(detail).toEqual({
      question: 'Porównaj wybrane artykuły',
      context: { entry: 'my-intelligence', action: 'COMPARE', stories: [story(1), story(2)] },
    });
  });

  it('the landed /analysis/news path is preserved for the gate-OFF rollback, not deleted', () => {
    const client = read('components', 'my-intelligence', 'MyIntelligenceClient.tsx');
    expect(client).toContain('runSelectionAction(multiStory, stories, language, typed)');
    expect(client).toMatch(/if \(askConverged\) \{[\s\S]*routeSelectionToAsk\(/);
    expect(read('lib', 'myIntelligence', 'selection.ts')).toContain('return analyzeNews(query, language, undefined, undefined, {');
  });
});

describe('§5 embedded Ask — one transport site per path, rollback intact, staging untouched', () => {
  const dock = read('components', 'ask', 'AskAiDock.tsx');
  const body = code(dock);

  it('the legacy transport is still exactly one analyzeNews call, inside the form handler', () => {
    expect((body.match(/analyzeNews\(/g) ?? []).length).toBe(1);
    expect(body.indexOf('analyzeNews(asked')).toBeGreaterThan(body.indexOf('const submit = useCallback'));
  });

  it('the embedded transport is the Ask R2 conversation hook, and only under ask.embedded', () => {
    expect(body).toContain('useAskR2Conversation(r2Locale');
    expect(body).toMatch(/if \(embeddedAsk && !legacyHandBack\) \{\s*void sendEmbedded\(asked\);/);
    expect(body).toMatch(/guestTrial: embeddedAsk && everOpened/);
    expect(body).toMatch(/if \(!embeddedAsk\) return undefined;[\s\S]*GLOBAL_ASK_SUBMIT_EVENT/);
  });

  it('the legacy path is used under ask.embedded ONLY when the server says Ask V2 is off', () => {
    expect(body).toMatch(/if \(outcome === 'legacy'\) legacyTransport\.current\?\.\(null, asked, true\);/);
    expect(body).not.toMatch(/outcome === 'signed-out'[^\n]*legacy/);
  });

  it('openGlobalAsk (zero-compute staging) is byte-identical to the baseline', () => {
    const baseline = execSync('git show a94c5f24fa00ca1b27c8ff0e292000c0136fb90f:frontend/src/lib/ask/openGlobalAsk.ts', {
      cwd: SRC,
      encoding: 'utf8',
    });
    expect(read('lib', 'ask', 'openGlobalAsk.ts')).toBe(baseline);
  });

  it('the Home Send event and the deeper event modules cannot reach a network', () => {
    for (const file of ['submitGlobalAsk.ts', 'requestDeeperAsk.ts']) {
      expect(code(read('lib', 'ask', file))).not.toMatch(/fetch\(|askV2Api|analyzeNews|accountFetch/);
    }
  });

  it('the Standalone /ask screen is not rewritten: it passes no context', () => {
    const screen = code(read('components', 'ask-frame', 'AskFrameScreen.tsx'));
    expect(screen).toContain('const outcome = await r2.submit(draft);');
    expect(screen).toContain('r2.runDeeper(q)');
  });
});

describe('§2/§10 Home R1 — publisher links unchanged, actions are siblings, no auto-advance with actions', () => {
  const stories = read('components', 'home', 'r1', 'HomeR1Stories.tsx');

  it('image, headline and Read source are each the governed publisher link, opening a new tab', () => {
    expect(stories).toContain('const href = safeExternalHref(article.url);');
    for (const role of ['image', 'headline', 'read-source']) {
      expect(stories).toMatch(new RegExp(`href=\\{href\\}[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*data-publisher-link="${role}"|data-publisher-link="${role}"`));
    }
  });

  it('the action row is a SIBLING of the links, never inside an <a>', () => {
    const card = stories.slice(stories.indexOf('function RailCard'));
    const actionsAt = card.indexOf('<StoryCardActions');
    const before = card.slice(0, actionsAt);
    expect((before.match(/<a\b/g) ?? []).length).toBe((before.match(/<\/a>/g) ?? []).length);
  });

  it('auto-advance (StoryRailMotion) only without actions; a static rail with them (R1-P5)', () => {
    expect(stories).toMatch(/\{cardActions \? \([\s\S]*data-home-r1-rail="static"[\s\S]*\) : \([\s\S]*<StoryRailMotion/);
  });

  it('no Discuss / Alert control is rendered in Stage A', () => {
    const actions = code(read('components', 'home', 'r1', 'StoryCardActions.tsx'));
    expect(actions).not.toMatch(/data-story-action="(discuss|alert)"/);
    expect(actions).not.toMatch(/t\.stories\.(discuss|alert)\b/);
  });

  it('the visible Analysis Workspace label is retired from the R1 rail; /search itself stays', () => {
    const chrome = code(read('components', 'home', 'r1', 'HomeR1Chrome.tsx'));
    expect(chrome).not.toMatch(/analysisWorkspace|ANALYSIS_WORKSPACE_HREF/);
    expect(read('app', 'search', 'page.tsx').length).toBeGreaterThan(0);
  });

  it('the R1 Home is served only when its gate is on; the Rev A composition is unchanged below it', () => {
    const page = read('app', 'page.tsx');
    expect(page).toMatch(/const r1 = homeR1Gates\(\);\s*if \(r1\.homeR1\) \{\s*return \(\s*<HomeR1Page/);
    const baseline = execSync('git show a94c5f24fa00ca1b27c8ff0e292000c0136fb90f:frontend/src/app/page.tsx', {
      cwd: SRC,
      encoding: 'utf8',
    });
    const revA = (source: string) => source.slice(source.indexOf('  return (\n    <>\n      <SiteStructuredData />\n      <HomeSessionProvider>\n        <HomeUtilityHeader'));
    expect(revA(page)).toBe(revA(baseline));
    expect(page.indexOf('if (standaloneAskRoot()) {\n    return <AskStandaloneRoot')).toBeLessThan(page.indexOf('const r1 = homeR1Gates();'));
  });

  it('the phone tray sits above the bottom navigation and a spacer keeps content reachable', () => {
    const compare = read('components', 'home', 'r1', 'HomeR1Compare.tsx');
    const chrome = read('components', 'home', 'r1', 'HomeR1Chrome.tsx');
    const navHeight = Number(/min-h-\[(\d+)px\] flex-col items-center justify-center gap-1 px-1 py-2/.exec(chrome)![1]);
    const trayOffset = Number(/bottom-\[calc\((\d+)px\+env\(safe-area-inset-bottom\)\)\]/.exec(compare)![1]);
    expect(trayOffset).toBeGreaterThanOrEqual(navHeight);
    expect(compare).toContain('data-home-r1-tray-spacer');
  });
});

describe('§11/§12 OAuth stays same-origin and allow-listed; nothing commercial is invented', () => {
  it('no return destination was added; unknown paths return Home', () => {
    expect([...SIGN_IN_RETURN_DESTINATIONS].sort()).toEqual(
      ['/', '/history', '/map', '/my-intelligence', '/search', '/support', '/workspace'].sort(),
    );
    expect(signInReturnFor('/compare')).toBeUndefined();
    expect(signInReturnFor('/story/x/discussion')).toBeUndefined();
  });

  it('the embedded sign-in uses the governed builder with the allow-listed return', () => {
    expect(read('components', 'ask', 'AskAiDock.tsx')).toContain('signInHref={accountSignInUrl(signInReturnFor(returnPath))}');
  });

  it('no price, currency, plan name, allowance number or trial length in the Stage A copy', () => {
    const copy = JSON.stringify([homeR1En, homeR1Pl]);
    expect(copy).not.toMatch(/[$€£]|zł|\bPLN\b|\bUSD\b|per month|\/mo\b|miesięcznie|\b3 questions\b|trial of \d/i);
    expect(copy).not.toMatch(/\d+ (questions|pytań|pytania)/);
  });
});

describe('§8 EN/PL parity', () => {
  const keys = (o: unknown, prefix = ''): string[] =>
    typeof o === 'object' && o !== null && !Array.isArray(o)
      ? Object.entries(o).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
      : [prefix];
  it('the same keys exist in both languages, and PL is actually Polish', () => {
    expect(keys(homeR1Pl).sort()).toEqual(keys(homeR1En).sort());
    expect(homeR1Pl.nav.phone).toEqual({ home: 'Start', worldMap: 'Mapa świata', ask: 'Zapytaj', intelligence: 'Analiza' });
    expect(homeR1Pl.dock.reading).toBe('Sprawdzam dostępne doniesienia…');
    expect(homeR1En.dock.reading).toBe('Checking available reporting…');
  });
});

describe('Follow ≠ Alert, and dormant Watch stays dormant', () => {
  it('Stage A adds no alert code, reads no follows for alerts, and Watch is still a source constant false', () => {
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.spec.ts')) files.push(p);
      }
    };
    walk(join(SRC, 'components', 'home', 'r1'));
    for (const file of files) {
      expect(code(readFileSync(file, 'utf8'))).not.toMatch(/\/follows|watchRuntime|WATCH_RUNTIME|alertsInApp\s*\?/);
    }
    /* The two source constants that keep Watch dormant (Claude H D-3) are unchanged. */
    expect(read('lib', 'map', 'monetization', 'watchRuntimeGate.ts')).toContain('export const WATCH_RUNTIME_ACTIVE = false;');
    expect(readFileSync(join(SRC, '..', '..', 'backend', 'src', 'modules', 'watch', 'watch-runtime.policy.ts'), 'utf8')).toMatch(/WATCH_RUNTIME_ACTIVE = false/);
  });
});
