import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_SELECTED_STORIES, normalizeArticleUrl } from '@globalnews-ai/shared';
import {
  HOME_R1_GATES_OFF,
  DECLARED_OFF,
  homeR1Gates,
  parseReleaseGatesMeta,
  releaseGatesMeta,
} from './homeR1Gates';
import { articleRefFor } from '@/lib/identity/articleRefServer';
import { articleRefOf, askCompareHref } from '@/lib/ask/askSelectionRef';
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
const walkTs = (dir: string, acc: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkTs(p, acc);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.spec.ts')) acc.push(p);
  }
  return acc;
};
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
      expect(homeR1Gates({ GNA_HOME_R1: value, GNA_HOME_CARD_ACTIONS: value })).toEqual(HOME_R1_GATES_OFF);
    }
  });

  it('dependencies hold: actions need Home R1, tray needs actions, view needs tray', () => {
    expect(homeR1Gates({ GNA_HOME_CARD_ACTIONS: 'true', GNA_COMPARE_TRAY: 'true', GNA_COMPARE_VIEW: 'true' })).toEqual(
      HOME_R1_GATES_OFF,
    );
    expect(
      homeR1Gates({ GNA_HOME_R1: 'true', GNA_HOME_CARD_ACTIONS: 'true', GNA_COMPARE_TRAY: 'true', GNA_COMPARE_VIEW: 'true' }),
    ).toEqual({ homeR1: true, cardActions: true, compareTray: true, compareView: true, discussionRead: false, discussionWrite: false, alertsInApp: false });
  });

  /* CONVERGENCE — Unified Intelligence Binding R2 is canonical: Ask context and the dock transport
     have NO Home-specific switch. The retired names must not be read anywhere. */
  it('no Ask transport gate and no Ask context gate exist (GNA_ASK_EMBEDDED / GNA_ASK_CONTEXT_REFS retired)', () => {
    const gates = homeR1Gates({ GNA_ASK_EMBEDDED: 'true', GNA_ASK_CONTEXT_REFS: 'true' } as Record<string, string>);
    expect(Object.keys(gates).sort()).toEqual(
      ['alertsInApp', 'cardActions', 'compareTray', 'compareView', 'discussionRead', 'discussionWrite', 'homeR1'].sort(),
    );
    const sources = ['app', 'components', 'lib'].flatMap((d) => walkTs(join(SRC, d))).map((f) => readFileSync(f, 'utf8'));
    for (const source of sources) {
      expect(source.includes('GNA_ASK_' + 'EMBEDDED')).toBe(false);
      expect(source.includes('GNA_ASK_' + 'CONTEXT_REFS')).toBe(false);
    }
  });

  it('the client meta is absent when every gate is OFF, round-trips, and re-applies dependencies', () => {
    expect(releaseGatesMeta(HOME_R1_GATES_OFF)).toBeNull();
    const on = homeR1Gates({ GNA_HOME_R1: 'true', GNA_HOME_CARD_ACTIONS: 'true', GNA_COMPARE_TRAY: 'true' });
    expect(parseReleaseGatesMeta(releaseGatesMeta(on)!['gna-release-gates'])).toEqual(on);
    expect(parseReleaseGatesMeta('compareView,discussionWrite')).toEqual(HOME_R1_GATES_OFF);
  });

  it('the existing spend switches and the public root are read nowhere new and never defaulted', () => {
    const gates = code(read('lib', 'platform', 'homeR1Gates.ts'));
    for (const name of ['ASK_V2_ENABLED', 'ASK_R2_ENABLED', 'ASK_PUBLIC_COMPUTE_ENABLED', 'ASK_GUEST_TRIAL_ENABLED', 'GNA_PUBLIC_ROOT']) {
      expect(gates).not.toContain(name);
    }
    expect(read('lib', 'ask', 'standaloneRoot.ts')).toContain("return (env.GNA_PUBLIC_ROOT ?? '').trim().toLowerCase() !== 'platform';");
  });

  /* Stage B: Discussion and in-app Alerts became real, default-OFF gates (see stageB.contract.spec.ts);
     delivery and checkout remain declared OFF. */
  it('delivery / checkout remain declared OFF after Stage B', () => {
    expect(DECLARED_OFF).toEqual({ alertsDelivery: false, billingCheckout: false });
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

describe('CONVERGENCE — Unified Intelligence Binding R2 is the ONLY Ask context implementation', () => {
  const r2 = (path: string): string =>
    execSync(`git show 58f80fd4108d3472e5433c7a50e19295788f2544:frontend/src/${path}`, { cwd: SRC, encoding: 'utf8' });

  it('the canonical R2 Ask modules are byte-identical to the R2 authority (58f80)', () => {
    for (const path of [
      'lib/ask/askContextRef.ts',
      'lib/ask/askSelectionRef.ts',
      'lib/ask/askModuleRef.ts',
      /* TRUST R1 — askV2Api.ts gains only the additive AskRecentReporting payload type. */
      /* useAskR2Conversation.ts — APPROVED NARROW DEVIATION (CTO checkpoint 5 §3): no longer
         whole-file pinned; pinned below as "58f80 minus the approved block" plus semantic
         invariants. This is not a retirement of the Unified Intelligence Binding authority. */
      /* R4 · SEVEN-LANGUAGE ASK CLIENT PIN (CTO AUTHORIZED) — MyIntelligenceClient.tsx is no
         longer whole-file pinned. It held one of the ten EN/PL clamps
         (`const r2Locale: 'en' | 'pl' = language === 'pl' ? 'pl' : 'en';`), and a surface that
         cannot express the reader's language cannot send it. The deviation is NARROW and is
         pinned below by semantic invariant rather than by byte identity: the R2 context path —
         askContextRefOf, the selection ref, the module ref, and the single canonical
         conversation — is asserted unchanged. This is not a retirement of the Unified
         Intelligence Binding authority; `lib/myIntelligence/selection.ts`, which owns the
         selection contract itself, stays byte-pinned. */
      'lib/myIntelligence/selection.ts',
      'components/home/HomeCompare.tsx',
      /* TRUST R1 — AskFrameScreen is deliberately changed (chat UX, privacy links); its R2 context
         path (askContextRefOf / compare / module refs) is unchanged and pinned by askChatUx.spec. */
    ]) {
      expect({ path, same: read(...path.split('/')) === r2(path) }).toEqual({ path, same: true });
    }
  });

  /*
    CTO CHECKPOINT 5 §3 — useAskR2Conversation.ts: an APPROVED NARROW DEVIATION from the 58f80 byte
    baseline (live Alpha defect D: a dropped first guest send was shown as "The service is busy").
    Two layers replace the whole-file pin:
      1. the file MINUS the one marked block is still byte-identical to 58f80 — any other drift fails;
      2. semantic invariants that hold whatever the block says.
  */
  /*
    R4 · SEVEN-LANGUAGE ASK CLIENT PIN (CTO AUTHORIZED) — the narrow deviation in
    MyIntelligenceClient.tsx, pinned by invariant rather than by bytes.

    Two layers replace the whole-file pin, the same shape CTO checkpoint 5 §3 used for the
    conversation hook:
      1. the R2 CONTEXT PATH is unchanged — this is the Unified Intelligence Binding
         authority's actual subject, and it is what the byte pin was protecting;
      2. the ONLY language change is the one authorized: a disposition in place of a clamp,
         with the request carrying the reader's selection.
  */
  describe('MyIntelligenceClient.tsx — approved narrow deviation (R4 seven-language client pin)', () => {
    const mi = code(read('components', 'my-intelligence', 'MyIntelligenceClient.tsx'));

    it('the R2 context path is unchanged: one canonical conversation, references only', () => {
      expect(mi).toContain('useAskR2Conversation(');
      expect(mi).toMatch(/from '@\/lib\/ask\/useAskR2Conversation'/);
      /* No second client, no legacy transport, no direct fetch. */
      expect(mi).not.toMatch(/analyzeNews|\/analysis\/news|accountFetch|axios|XMLHttpRequest/);
      expect(mi).not.toMatch(/\bfetch\s*\(/);
    });

    it('the clamp is gone and the request carries the reader selection', () => {
      expect(mi).not.toMatch(/r2Locale:\s*'en'\s*\|\s*'pl'/);
      expect(mi).not.toMatch(/language === 'pl' \? 'pl' : 'en'/);
      expect(mi).toContain('askLanguageDisposition(resolveAskLocale(language))');
      expect(mi).toContain('useAskR2Conversation(askDisposition.requested');
      /* The two-locale chrome still reads the answer locale — the two are kept apart. */
      expect(mi).toContain('askDisposition.catalogueLocale');
    });

    it('nothing else about the surface moved', () => {
      /* The selection contract it consumes is still the byte-pinned one. */
      expect(mi).toMatch(/from '@\/lib\/myIntelligence\/selection'/);
      expect(mi).not.toMatch(/SemanticTurnIR|semanticInterpreter|userJob/i);
    });
  });

  describe('useAskR2Conversation.ts — approved narrow deviation from 58f80', () => {
    const PATH = 'lib/ask/useAskR2Conversation.ts';
    const current = read(...PATH.split('/'));
    const hook = code(current);
    const BEGIN = '/* APPROVED DEVIATION FROM THE 58f80 BASELINE (CTO checkpoint 5 §3) — BEGIN.';
    const END = '/* APPROVED DEVIATION FROM THE 58f80 BASELINE — END. */';
    /*
      ASK DESIGN R3 — CTO GOVERNANCE RULING, OPTION A: exactly ONE second approved block, for the
      Product-Owner-accepted "New question" reset (startNewConversation) and nothing else. It ends
      by opening the returned object with that one member, so stripping it restores the 58f80
      line `  return {` and nothing more.
    */
    const NQ_BEGIN =
      '/* APPROVED DEVIATION FROM THE 58f80 BASELINE (CTO R3 governance ruling, option A) — NEW QUESTION — BEGIN.';
    const NQ_END = '/* APPROVED DEVIATION FROM THE 58f80 BASELINE — NEW QUESTION — END. */';
    const lineStartOf = (at: number): number => current.lastIndexOf('\n', at) + 1;
    const lineEndOf = (at: number): number => current.indexOf('\n', at) + 1;
    const nqStart = current.indexOf(NQ_BEGIN);
    const nqEnd = current.indexOf(NQ_END);
    const nqRaw = current.slice(nqStart, nqEnd);
    const nq = code(nqRaw);

    it('outside the two marked blocks, the file is byte-identical to the 58f80 authority', () => {
      const start = current.indexOf(BEGIN);
      const end = current.indexOf(END);
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      expect(current.indexOf(BEGIN, start + 1)).toBe(-1);
      /* exactly one second block, after the first, never nested in it */
      expect(nqStart).toBeGreaterThan(end);
      expect(nqEnd).toBeGreaterThan(nqStart);
      expect(current.indexOf(NQ_BEGIN, nqStart + 1)).toBe(-1);
      expect(current.indexOf(NQ_END, nqEnd + 1)).toBe(-1);
      expect(current.match(/APPROVED DEVIATION FROM THE 58f80 BASELINE[^\n]*BEGIN/g)).toHaveLength(2);
      const without =
        current.slice(0, lineStartOf(start)) +
        current.slice(lineEndOf(end), lineStartOf(nqStart)) +
        '  return {\n' +
        current.slice(lineEndOf(nqEnd));
      expect(without).toBe(r2(PATH));
    });

    describe('the second block (New question) — CTO option A', () => {
      it('is an in-place client reset: the conversation refs and turns are cleared locally', () => {
        expect(nq).toMatch(/const startNewConversation = useCallback\(\(\): boolean => \{/);
        expect(nq).toContain('thread.current = null;');
        expect(nq).toContain('guestThread.current = null;');
        expect(nq).toContain('setTurns([]);');
        /* and it ends by exposing that one member, nothing else */
        expect(nqRaw.trimEnd()).toMatch(/\n {2}return \{\n {4}startNewConversation,$/);
      });

      it('refuses while an Ask execution is in flight — its first statement', () => {
        expect(nq).toMatch(/useCallback\(\(\): boolean => \{\s*if \(pending !== null\) return false;/);
        expect(nq).toMatch(/\}, \[pending, deepQuote\]\);/);
      });

      it('makes no request of its own: the ONLY network touch is the governed quote release', () => {
        expect(nq.match(/askV2Api\.\w+/g)).toEqual(['askV2Api.release']);
        expect(nq).toMatch(/if \(quote !== null\) void askV2Api\.release\(quote\.operation\.operationId\);/);
        expect(nq).not.toMatch(/fetch\(|XMLHttpRequest|axios|accountFetch|analyzeNews|navigator\.|sendBeacon/);
      });

      it('never deletes or mutates the prior server-side thread', () => {
        expect(nq).not.toMatch(/delete|remove|archive|rename|patch|update|DELETE|PATCH/);
        expect(nq).not.toMatch(/createThread|guestCreateThread|submit|guestSubmit|continueThread|bookmark/);
      });

      it('does not touch retrieval, routing, evidence, context selection or compute policy', () => {
        expect(nq).not.toMatch(
          /AskV2ContextRef|contextRef|\bcontext\b|retriev|routing|route|evidence|computeClass|intent|runDeeper|confirmDeeper|accept|quoteFor|language|setAvailability/,
        );
        /* the only state it writes: the conversation, its notices, and the open quote */
        const setters = (nq.match(/\bset[A-Z]\w*\(/g) ?? []).sort();
        expect(setters).toEqual([
          'setContextRefused(',
          'setDeepQuote(',
          'setGuestNotice(',
          'setSignInRequired(',
          'setTurns(',
        ]);
      });

      it('leaves the original approved block exactly as it was', () => {
        const block = code(current.slice(current.indexOf(BEGIN), current.indexOf(END)));
        expect(block).toMatch(/^\s*if \(created\.reason === 'NETWORK'\) \{[\s\S]*?return 'failed';\s*\}\s*$/);
        expect(nq).not.toContain("created.reason === 'NETWORK'");
      });
    });

    it('the block only turns a first-thread NETWORK failure into the ordinary failed send', () => {
      const block = code(current.slice(current.indexOf(BEGIN), current.indexOf(END)));
      expect(block).toMatch(/^\s*if \(created\.reason === 'NETWORK'\) \{[\s\S]*?return 'failed';\s*\}\s*$/);
      expect(block).not.toMatch(/askV2Api|submitAsGuest|setTimeout|retry/i);
    });

    it('Ask V2 is the only transport: no /analysis/news, no direct fetch, no second client', () => {
      expect(hook).not.toMatch(/fetch\(|XMLHttpRequest|axios|accountFetch|analyzeNews|\/analysis\/news/);
      expect(hook).toMatch(/from '@\/lib\/api\/askV2Api'/);
    });

    it('context travels only as the R2 reference — no second context protocol', () => {
      expect(hook).toMatch(/context\?: AskV2ContextRef/);
      expect(hook).not.toMatch(/AskContextRefWire|buildDockContextRef|selectionContextRef|requestDeeperAsk/);
    });

    it('signed-in and guest paths stay distinct', () => {
      expect(hook).toContain('askV2Api.guestCreateThread(');
      expect(hook).toContain('askV2Api.guestSubmit(');
      expect(hook).toContain('askV2Api.createThread(');
      expect(hook).toContain('askV2Api.submit(');
    });

    it('explicit Send stays the execution boundary: no timer, no auto-send, no new auto-retry', () => {
      expect(hook).not.toMatch(/setTimeout|setInterval|requestAnimationFrame/);
      /* the ONE pre-existing self-call: a guest session that ended re-decides once (SIGNED_OUT) */
      expect(hook.match(/submitAsGuest\(q, context, onTurn, true\)/g)).toHaveLength(1);
      expect(hook).toMatch(/if \(sent\.reason === 'SIGNED_OUT' && !retried\)/);
    });

    it('governed refusals keep their notices; UNAVAILABLE and context refusal are unchanged', () => {
      expect(hook).toContain('guestNoticeOf(created.code)');
      expect(hook).toContain('guestNoticeOf(sent.code)');
      expect(hook).toMatch(
        /if \(created\.reason === 'UNAVAILABLE'\) \{\s*setAvailability\('legacy'\);\s*return 'legacy';/,
      );
      expect(hook).toContain("return 'context-unavailable';");
    });
  });

  it("Stage A's second context protocol is gone: no files, no symbols", () => {
    for (const path of [
      ['lib', 'ask', 'requestDeeperAsk.ts'],
      ['lib', 'myIntelligence', 'selectionAsk.ts'],
      ['components', 'ask', 'AskContextInspect.tsx'],
      ['components', 'ask', 'EmbeddedConversation.tsx'],
    ]) {
      expect(existsSync(join(SRC, ...path))).toBe(false);
    }
    const sources = ['app', 'components', 'lib'].flatMap((d) => walkTs(join(SRC, d))).map((f) => code(readFileSync(f, 'utf8')));
    for (const source of sources) {
      expect(source).not.toMatch(/AskContextRefWire|buildDockContextRef|dockContextKind|selectionContextRef|publishAskSelection|requestDeeperAsk|routeSelectionToAsk/);
    }
  });

  it('the dock has ONE transport site (the R2 submit) and no analysis transport', () => {
    const dock = code(read('components', 'ask', 'AskAiDock.tsx'));
    expect((dock.match(/\.submit\(asked, contextRef/g) ?? []).length).toBe(1);
    expect(dock).not.toMatch(/analyzeNews|analysisApi|\/analysis\/news/);
    expect(dock).toContain('askContextRefOf(storyContext, geographyContext)');
  });

  it('the Home explicit Send submits the dock\'s OWN form (R2 submit handler byte-identical; no second transport)', () => {
    const raw = read('components', 'ask', 'AskAiDock.tsx');
    const dock = code(raw);
    expect(dock).toMatch(/window\.addEventListener\(GLOBAL_ASK_SUBMIT_EVENT, onHomeSend\)/);
    expect(dock).toMatch(/formRef\.current\.requestSubmit\(\);/);
    const handler = (source: string): string =>
      source.slice(source.indexOf('  const submit = useCallback('), source.indexOf('    [question, isPending, r2, contextRef],'));
    expect(handler(raw)).toBe(handler(r2('components/ask/AskAiDock.tsx')));
    expect(handler(raw).length).toBeGreaterThan(200);
    const hero = code(read('components', 'home', 'r1', 'HomeR1Hero.tsx'));
    expect(hero).toContain('submitGlobalAsk(draft);');
    expect(hero).not.toMatch(/askV2Api|analyzeNews|context/);
    expect(code(read('lib', 'ask', 'submitGlobalAsk.ts'))).not.toMatch(/fetch\(|askV2Api|analyzeNews|accountFetch|context/);
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

  it('Ask about the compared stories is R2H\'s canonical SELECTION launcher (no second Compare workflow)', () => {
    const compare = code(read('components', 'home', 'r1', 'HomeR1Compare.tsx'));
    expect(compare).toContain("askCompareHref(opened.map((story) => story.url), '/')");
    expect(compare).not.toMatch(/HomeCompare|openGlobalAsk|deep-analysis/);
    expect(askCompareHref([URL_A, URL_B], '/')).toMatch(/^\/ask\?compare=.*&compare=.*&return=%2F$/);
    // R2H's HomeCompare survives ONLY on the legacy (Rev A / gate-off) Home.
    expect(read('components', 'home', 'WhatsHappeningNow.tsx')).toMatch(/HomeCompare/);
    for (const file of walkTs(join(SRC, 'components', 'home', 'r1'))) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/from '@\/components\/home\/HomeCompare'/);
    }
  });

  it('nothing is fabricated: claims, gaps and the event relation say Not available', () => {
    expect(homeR1En.compare.noBrief).toMatch(/^Not available/);
    expect(homeR1En.compare.relationUnavailable).toMatch(/^Not available/);
    /* Stage B: absent proof reads 'Not established', never 'separate'. */
    expect(homeR1En.compare.relationNotEstablished).toMatch(/^Not established/);
  });
});

describe('§7 My Intelligence — R2D selection behaviour, unchanged', () => {
  it('selection actions are ONE canonical Ask V2 turn carrying a SELECTION (R2D), with no Home gate', () => {
    const client = code(read('components', 'my-intelligence', 'MyIntelligenceClient.tsx'));
    expect(client).not.toMatch(/usePlatformGates|askConverged|routeSelectionToAsk/);
    expect(code(read('lib', 'myIntelligence', 'selection.ts'))).toContain('export async function runSelectionAction(');
  });
});

describe('§5 embedded Ask — staging untouched, Standalone untouched', () => {
  it('openGlobalAsk (zero-compute staging) is byte-identical to the baseline', () => {
    const baseline = execSync('git show a94c5f24fa00ca1b27c8ff0e292000c0136fb90f:frontend/src/lib/ask/openGlobalAsk.ts', {
      cwd: SRC,
      encoding: 'utf8',
    });
    expect(read('lib', 'ask', 'openGlobalAsk.ts')).toBe(baseline);
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

  /* Stage B made Discuss / Alert real; each is drawn ONLY under its own gate (stageB.contract.spec.ts). */
  it('Discuss / Alert controls are drawn only under their Stage B gates', () => {
    const actions = code(read('components', 'home', 'r1', 'StoryCardActions.tsx'));
    expect(actions).toMatch(/\{discuss && \(\s*<button[\s\S]*?data-story-action="discuss"/);
    expect(actions).toMatch(/\{alert && \(\s*<button[\s\S]*?data-story-action="alert"/);
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

  it('the dock sign-in is R2\'s governed Ask sign-in (no new return destination)', () => {
    expect(read('components', 'ask', 'AskAiDock.tsx')).toContain('ASK_SIGN_IN_HREF');
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
      /* Stage B legitimately branches on alerts.inApp (its own gate); Follow and Watch stay out. */
      expect(code(readFileSync(file, 'utf8'))).not.toMatch(/\/follows|watchRuntime|WATCH_RUNTIME/);
    }
    /* The two source constants that keep Watch dormant (Claude H D-3) are unchanged. */
    expect(read('lib', 'map', 'monetization', 'watchRuntimeGate.ts')).toContain('export const WATCH_RUNTIME_ACTIVE = false;');
    expect(readFileSync(join(SRC, '..', '..', 'backend', 'src', 'modules', 'watch', 'watch-runtime.policy.ts'), 'utf8')).toMatch(/WATCH_RUNTIME_ACTIVE = false/);
  });
});
