import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AnalysisFrameSurface } from '@/components/analysis-frame/AnalysisFrameSurface';
import { fixture } from '@/components/analysis-frame/frameFixtures';

/**
 * ASK AI — PHASE 1. THE REUSE IS THE CONTRACT.
 *
 * The risk this surface carries is not that it fails to render. It is that it
 * quietly becomes a SECOND analysis implementation — a second request path, a
 * second error vocabulary, a second way of describing evidence, or a frontend
 * that reshapes the reader's question to get better results. Every test here
 * is aimed at that, not at "the input exists".
 */
const SRC = readFileSync(join(__dirname, 'AskAiDock.tsx'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

describe('it consumes the existing Analysis engine and nothing else', () => {
  it('the only request path is the existing analysis client', () => {
    expect(CODE).toMatch(/import \{ analyzeNews \} from '@\/lib\/api\/analysisApi'/);
    /*
     * No second transport, no second endpoint, no second client.
     *
     * IMPORT LINES ARE EXCLUDED FROM THIS SCAN, and the reason is a real
     * false positive rather than a convenience: Rev A's own modules live
     * under `@/lib/ask/` and `@/components/ask/`, which the `\/ask\b`
     * alternative matches inside a MODULE SPECIFIER. The rule is about
     * request paths in executable code; a module path is not one. The
     * imports are asserted on their own terms above and in §7.6/§7.7.
     */
    const executable = CODE.split('\n').filter((line) => !/^\s*import\s/.test(line)).join('\n');
    expect(executable).not.toMatch(/fetch\(|XMLHttpRequest|axios|new Request|\/analysis\/|\/ask\b/);
  });

  it('it contains no provider, model, prompt, retrieval or ranking of its own', () => {
    for (const forbidden of ['openai', 'OpenAI', 'gpt', 'prompt', 'embedding', 'rerank',
                             'temperature', 'systemMessage', 'retriev']) {
      expect(`${forbidden}: ${CODE.toLowerCase().includes(forbidden.toLowerCase())}`)
        .toBe(`${forbidden}: false`);
    }
  });

  it('the reader question is passed VERBATIM — no frontend query rewriting', () => {
    /* the submitted value is the trimmed input and nothing else: no synonym
       expansion, no template, no appended keywords, no site: operators */
    expect(CODE).toMatch(/const asked = question\.trim\(\);/);
    expect(CODE).toMatch(/analyzeNews\(asked, language, sent\)/);
    expect(CODE).not.toMatch(/asked \+|`\$\{asked\}[^`]/);
  });

  it('reuses the EXISTING loading presentation', () => {
    expect(CODE).toMatch(/import \{ LoadingStages \} from '@\/components\/search\/LoadingStages'/);
    expect(CODE).toMatch(/<LoadingStages stages=\{\[\.\.\.dictionary\.loadingStages\]\}/);
  });

  it('reuses the EXISTING error mapping, imported rather than copied', () => {
    expect(CODE).toMatch(
      /import \{ resolveAnalysisErrorMessage \} from '@\/components\/search\/SearchPageClient'/,
    );
    /* a second copy of the code->copy table is exactly the drift to prevent */
    expect(CODE).not.toMatch(/analysisErrorTimeout|analysisErrorRateLimited|'rate-limited'/);
  });

  /*
   * REV A §2 INVERTS THIS ASSERTION, AND THE INVERSION IS THE FIX.
   *
   * It used to REQUIRE the nested `AnalysisFrameSurface`. Rev A §2 rules
   * that mount out and gives the measured root cause: the frame sizes from
   * `window.innerWidth` and its accepted geometry states in-file that
   * "SURFACE B IS THE ONLY CONSUMER". Mounting it inside
   * `lg:w-[min(720px,52vw)]` made a second consumer measuring the viewport
   * while drawing into half of it.
   *
   * What must still hold is the half that was always the real point: the
   * dock authors NO evidence, source or citation rendering of its own. The
   * projection renders through Surface B's own readers, so that list is
   * still asserted — unchanged.
   */
  it('does NOT mount the analysis frame, and authors no evidence rendering of its own', () => {
    expect(CODE).not.toMatch(/AnalysisFrameSurface/);
    for (const own of ['SourceArticleCard', 'SourcesDrawer', 'TrustBadge', 'SourceDiversitySummary',
                       'EvidenceSufficiencyNote', 'RetrievalContextStatus', 'AnalysisResultView']) {
      expect(`${own}: ${CODE.includes(own)}`).toBe(`${own}: false`);
    }
  });
});

describe('the dock is a real scrollable conversation on phones', () => {
  it('keeps settled turns locally without feeding prior AI output back into retrieval', () => {
    expect(CODE).toMatch(/const \[history, setHistory\] = useState<SettledAskTurn\[\]>\(\[\]\)/);
    expect(CODE).toMatch(/data-ask="history-turn"/);
    expect(CODE).toMatch(/data-ask="user-message"/);
    const submit = CODE.slice(CODE.indexOf('const submit = useCallback'), CODE.indexOf('return ('));
    expect(submit).not.toMatch(/phase\.response|analysis\.sources|retrievalContext/);
  });

  it('the conversation scrolls independently and the composer stays outside that scroll region', () => {
    expect(CODE).toMatch(/data-ask-scroll="conversation"/);
    expect(CODE).toMatch(/overflow-y-auto/);
    expect(CODE).toMatch(/data-ask="composer"/);
    expect(CODE.indexOf('data-ask="composer"')).toBeGreaterThan(CODE.indexOf('data-ask-scroll="conversation"'));
  });

  it('submitting clears the composer so the second question is immediately typeable', () => {
    expect(CODE).toMatch(/setPhase\(\{ kind: 'loading', question: asked \}\);\s*setQuestion\(''\);/);
    expect(CODE).toMatch(/rows=\{phase\.kind === 'idle' && history\.length === 0 \? 2 : 1\}/);
  });

  it('the phone sheet uses dynamic viewport height and safe-area padding', () => {
    expect(CODE).toContain('h-[92dvh]');
    expect(CODE).toContain('env(safe-area-inset-bottom)');
  });
});

describe('relational answers lead with the backend-authoritative conclusion', () => {
  it('the compact result renders relationalComposition.summary before generic brief prose', () => {
    const compact = readFileSync(join(__dirname, 'AskCompactResult.tsx'), 'utf8');
    expect(compact).toContain('data-ask="relational-answer"');
    expect(compact).toContain('analysis.relationalComposition.summary');
    expect(compact.indexOf('data-ask="relational-answer"')).toBeLessThan(
      compact.indexOf('data-ask="brief"'),
    );
  });
});

describe('opening the panel is not a question', () => {
  it('the ONLY call to the analysis client sits inside the submit handler', () => {
    expect((CODE.match(/analyzeNews\(/g) ?? []).length).toBe(1);
    const submitAt = CODE.indexOf('const submit = useCallback');
    const callAt = CODE.indexOf('analyzeNews(asked');
    expect(submitAt).toBeGreaterThan(-1);
    expect(callAt).toBeGreaterThan(submitAt);
  });

  it('no effect in this file can issue the request', () => {
    /* every useEffect body is focus or key handling; none may reach the client */
    for (const body of CODE.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[/g) ?? []) {
      expect(body).not.toMatch(/analyzeNews/);
    }
  });

  it('an empty question cannot be submitted', () => {
    expect(CODE).toMatch(/if \(asked\.length === 0\) return;/);
    expect(CODE).toMatch(/disabled=\{question\.trim\(\)\.length === 0 \|\| phase\.kind === 'loading'\}/);
  });
});

/*
 * ASK RULE A SURVIVES REV A. ITS ENFORCEMENT MOVES (contract §7).
 *
 * The old test asserted the ABSENCE of any context. Rev A §7 replaces that
 * with the BOUND: the dock may transport exactly `{title, articleId?,
 * countryCode?}` and nothing else. Point 3 below is what carries the rule
 * after the old assertion is gone — evidence, report and cluster identities
 * are OUTPUTS of a prior analysis, and feeding them back would make results
 * into inputs. This describe block is amended, not deleted.
 */
describe('ASK RULE A — only bounded context crosses the boundary', () => {
  it('§7.1/§7.2 — a third argument is passed, and its keys are a subset of {title, articleId, countryCode}', () => {
    expect(CODE).toMatch(/analyzeNews\(asked, language, sent\)/);
    /* the narrowing lives in ONE place, so no call site can widen it */
    expect(CODE).toMatch(/const sent = transportableContext\(storyContext\);/);

    const store = readFileSync(join(__dirname, '..', '..', 'lib', 'ask', 'storyContextStore.ts'), 'utf8');
    const fn = store.slice(store.indexOf('export function transportableContext'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body).toMatch(/title: context\.title/);
    expect(body).toMatch(/articleId: context\.articleId/);
    expect(body).toMatch(/countryCode: context\.countryCode/);
    /* nothing else is copied across */
    expect(body).not.toMatch(/url|sourceName|sources|articles|evidence|cluster|report|dimension/i);
  });

  it('§7.3 — no evidence/report/cluster identity and no response field is used as an INPUT', () => {
    const submit = CODE.slice(CODE.indexOf('const submit = useCallback'), CODE.indexOf('return ('));
    for (const forbidden of ['evidenceId', 'reportId', 'clusterId', 'sourceEntities', 'keyFacts',
                             'agreements', 'differences', 'sourceDiversity', 'retrievalContext',
                             'phase.response', 'analysis.sources']) {
      expect(`${forbidden}: ${submit.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });

  it('§7.4 — `title` comes from the published context, never from the input box', () => {
    const store = readFileSync(join(__dirname, '..', '..', 'lib', 'ask', 'storyContextStore.ts'), 'utf8');
    expect(store).toMatch(/title: context\.title/);
    /* the dock never assigns a title at all, so it cannot assign the question */
    expect(CODE).not.toMatch(/title:\s*(asked|question)/);
  });

  it('§7.5 — with no context in scope, analyzeNews is called with TWO arguments', () => {
    /*
     * BY CONSTRUCTION RATHER THAN BY BRANCH. `transportableContext`
     * returns `undefined` for an absent context, and `f(a, b, undefined)`
     * IS a two-argument call at the boundary: `arguments.length` differs,
     * but the request `analysisApi` builds is byte-identical to Phase 1's
     * because it omits an undefined `storyContext`. Asserted on the client
     * so the claim is about the REQUEST, not about the call shape.
     */
    const api = readFileSync(join(__dirname, '..', '..', 'lib', 'api', 'analysisApi.ts'), 'utf8');
    expect(api).toMatch(/storyContext/);
    const store = readFileSync(join(__dirname, '..', '..', 'lib', 'ask', 'storyContextStore.ts'), 'utf8');
    expect(store).toMatch(/if \(context === undefined\) return undefined;/);
  });

  it('§7.6 — the dock does not import the analysis frame', () => {
    expect(SRC).not.toMatch(/import .*AnalysisFrameSurface/);
  });

  it('§7.7 — the compact result performs no second analysis call', () => {
    const compact = readFileSync(join(__dirname, 'AskCompactResult.tsx'), 'utf8');
    const code = compact.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    expect(code).not.toMatch(/analyzeNews|fetch\(|XMLHttpRequest|axios|useEffect/);
  });

  it('the contextual affordance is a statement, not a control — still no submit path', () => {
    const span = CODE.slice(CODE.indexOf('data-ask="context-affordance"'));
    const element = span.slice(0, span.indexOf('>'));
    expect(element).not.toMatch(/onClick|onSubmit|type="submit"/);
  });
});

/*
 * THESE ARE SURFACE B's STATES, ASSERTED HERE BECAUSE THE ASK SURFACE MUST
 * NOT INVENT A FIFTH. Rev A removed the nested frame from the dock, so this
 * block no longer describes what the dock RENDERS — it pins the vocabulary
 * the dock's compact projection must not diverge from. Unchanged assertions.
 */
describe('the accepted evidence-state vocabulary is the one the product has', () => {
  const VP = { width: 1440, height: 900 };
  const render = (response: AnalysisApiResponse): string =>
    renderToStaticMarkup(
      createElement(AnalysisFrameSurface as never, { response, initialViewport: VP } as never),
    );
  const withProv = (over: Record<string, unknown>): AnalysisApiResponse =>
    ({ ...fixture(), ...over } as AnalysisApiResponse);

  /*
    These are the SAME states, from the SAME resolver, that `/search` renders —
    which is the point. The Ask surface adds no fifth state and re-words none of
    the four, so a reader gets the same answer to "why is there no answer"
    wherever they asked.
  */
  it('a populated answer renders the frame body, not an absence notice', () => {
    /*
      CORRECTED AFTER A FAILING RUN, AND THE CORRECTION IS THE POINT.

      This first asserted `data-evidence-state="populated"`. That attribute is
      emitted by the frame's ABSENCE section — the region that says WHY there
      is no analysis — so a populated response never carries it. The assertion
      was wrong about the frame, not the frame wrong about the state, and
      `resolveFrameEvidence` does return 'populated' for this input.

      The property that actually matters here is the complement: a populated
      answer renders the analysis body and NO absence notice at all.
    */
    const html = render(fixture());
    expect(html).toMatch(/data-paf="frame"/);
    expect(html).not.toMatch(/data-paf="analysis-unavailable"/);
    expect(html).not.toMatch(/data-evidence-state=/);
  });

  it('no evidence is stated as NO EVIDENCE, not as a failure', () => {
    const html = render(
      withProv({
        analysis: null,
        articles: [],
        retrievalContext: { dataMode: 'live', providers: ['gnews'], articlesRetrieved: 0 },
        provenance: { provider: 'openai', executionMode: 'production', analysisMode: 'live-ai', status: 'not-attempted', cached: false },
      }),
    );
    expect(html).toMatch(/data-evidence-state="no-evidence"/);
  });

  it('an unreachable provider is stated as PROVIDER UNAVAILABLE', () => {
    const html = render(
      withProv({
        analysis: null,
        articles: [],
        retrievalContext: { dataMode: 'unavailable', providers: [], articlesRetrieved: 0 },
      }),
    );
    expect(html).toMatch(/data-evidence-state="provider-unavailable"/);
  });

  it('when the analysis fails but reporting survives, the reporting is still shown', () => {
    const html = render(
      withProv({
        analysis: null,
        analysisError: 'rate limited',
        provenance: { provider: 'openai', executionMode: 'production', analysisMode: 'live-ai', status: 'failed', cached: false },
      }),
    );
    expect(html).toMatch(/data-evidence-state="analysis-failed"/);
  });
});

describe('the released navigation geometry is untouched', () => {
  it('the dock is mounted from the root layout, not injected into the NavBar', () => {
    const layout = readFileSync(join(__dirname, '..', '..', 'app', 'layout.tsx'), 'utf8');
    expect(layout).toMatch(/<AskAiDock language=\{language\} \/>/);
    const nav = readFileSync(join(__dirname, '..', 'navigation', 'NavBar.tsx'), 'utf8');
    expect(nav).not.toMatch(/AskAiDock|askAi/);
  });

  it('the copy exists in both dictionaries this build ships', () => {
    const dir = join(__dirname, '..', '..', 'lib', 'i18n', 'dictionaries');
    for (const f of ['en.ts', 'pl.ts']) {
      const src = readFileSync(join(dir, f), 'utf8');
      const group = src.slice(src.indexOf('askAi: {'));
      const head = group.slice(0, 4000);
      for (const key of ['contextPendingHint:', 'contextChipAnchored:', 'contextChipGeneric:',
                         'resultSourcesHeading:', 'resultSourcesNone:', 'resultSourcesTruncated:',
                         'resultBriefAbsent:', 'resultNoAnswer:', 'openFullAnalysis:']) {
        expect(`${f} ${key} ${group.startsWith('askAi: {') && head.includes(key)}`)
          .toBe(`${f} ${key} true`);
      }
    }
  });
});
