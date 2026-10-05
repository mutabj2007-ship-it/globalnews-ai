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
  /*
    RETARGETED IN UNIFIED INTELLIGENCE BINDING R2C. Old assertion: the dock imports the legacy
    `analyzeNews` client (POST /analysis/news). The invariant — ONE request path, no second
    transport/endpoint/client — now names the canonical Ask V2 conversation, and the legacy
    client is asserted ABSENT.
  */
  it('the only request path is the canonical Ask V2 conversation', () => {
    expect(CODE).toMatch(
      /import \{\s*sanitizeReturnPath,\s*useAskR2Conversation,[\s\S]*?\} from '@\/lib\/ask\/useAskR2Conversation'/,
    );
    expect(CODE).not.toMatch(/analyzeNews|analysisApi/);
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
    /* R2C — a multi-line import's closing \`} from '…'\` line is a module specifier too. */
    const executable = CODE.split('\n')
      .filter((line) => !/^\s*import\s/.test(line) && !/^\s*\} from '/.test(line))
      .join('\n');
    expect(executable).not.toMatch(/fetch\(|XMLHttpRequest|axios|new Request|\/analysis\/|\/ask\b/);
  });

  it('it contains no provider, model, prompt, retrieval or ranking of its own', () => {
    for (const forbidden of ['openai', 'OpenAI', 'gpt', 'prompt', 'embedding', 'rerank',
                             'temperature', 'systemMessage']) {
      expect(`${forbidden}: ${CODE.toLowerCase().includes(forbidden.toLowerCase())}`)
        .toBe(`${forbidden}: false`);
    }
  });

  /* R2C — the chip and the request derive from ONE bounded reference (askContextRefOf); the dock
     reads published context, never performs retrieval. */
  it('reads routing metadata without performing retrieval', () => {
    expect(CODE).toContain('const contextRef = askContextRefOf(storyContext, geographyContext);');
    expect(CODE).toContain("const showStoryLabel = contextRef?.kind === 'STORY';");
    expect(CODE).not.toMatch(/retrieve\w*\s*\(|newsService|countryNewsService/);
  });

  it('the reader question is passed VERBATIM — no frontend query rewriting', () => {
    /* the submitted value is the trimmed input and nothing else: no synonym
       expansion, no template, no appended keywords, no site: operators */
    expect(CODE).toMatch(/const asked = question\.trim\(\);/);
    /* R2C — the canonical turn: the question verbatim, first; the context as a reference. */
    expect(CODE).toMatch(/void r2\s*\.submit\(asked, contextRef,/);
    expect(CODE).not.toMatch(/asked \+|`\$\{asked\}[^`]/);
  });

  it('reuses the EXISTING loading presentation', () => {
    expect(CODE).toMatch(/import \{ LoadingStages \} from '@\/components\/search\/LoadingStages'/);
    expect(CODE).toMatch(/<LoadingStages stages=\{\[\.\.\.dictionary\.loadingStages\]\}/);
  });

  /* R2C — failures and refusals render through the CANONICAL turn view (the same as /ask). */
  it('reuses the EXISTING error mapping, imported rather than copied', () => {
    expect(CODE).toMatch(/import \{ AskR2TurnView \} from '@\/components\/ask-frame\/AskR2TurnView'/);
    expect(CODE).toMatch(/<AskR2TurnView/);
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
    /* R2C — the turns are the canonical conversation's own (display state, server-owned). */
    expect(CODE).toMatch(/visibleTurns\.map\(\(turn, index\) =>/);
    expect(CODE).toMatch(/'history-turn'/);
    expect(CODE).toMatch(/data-ask="user-message"/);
    const submitStart = CODE.indexOf('const submit = useCallback');
    const submit = CODE.slice(submitStart, CODE.indexOf('\n  return (', submitStart));
    expect(submit).not.toMatch(/phase\.response|analysis\.sources|retrievalContext/);
  });

  it('the conversation scrolls independently and the composer stays outside that scroll region', () => {
    expect(CODE).toMatch(/data-ask-scroll="conversation"/);
    expect(CODE).toMatch(/overflow-y-auto/);
    expect(CODE).toMatch(/data-ask="composer"/);
    expect(CODE.indexOf('data-ask="composer"')).toBeGreaterThan(CODE.indexOf('data-ask-scroll="conversation"'));
  });

  it('submitting clears the composer so the second question is immediately typeable', () => {
    expect(CODE).toMatch(/if \(isPending\) return;\s*setQuestion\(''\);/);
    expect(CODE).toContain('<AdaptiveTextarea');
    expect(CODE).toContain('minHeight={isIdle ? 58 : 44}');
    expect(CODE).toContain('maxViewportFraction={0.46}');
  });

  /* ASK R2 INTEGRATION R1 · D25 11 — the phone surface is full screen, not an 86dvh sheet. */
  it('the phone surface is full screen with dynamic viewport height and safe-area padding', () => {
    expect(CODE).toContain('h-[100dvh]');
    expect(CODE).toContain('env(safe-area-inset-bottom)');
  });

  it('desktop uses a bounded floating dock with lifted surfaces rather than a full-height dark slab', () => {
    /* from 1024 (D25: 768 portrait follows the phone rule, so the float starts at lg) */
    expect(CODE).toContain('lg:inset-y-4');
    expect(CODE).toContain('lg:w-[min(680px,46vw)]');
    expect(CODE).toContain('bg-surface-raised');
    expect(CODE).toContain('data-ask-scroll="conversation"');
    expect(CODE).toContain('bg-surface');
  });
});

describe('relational answers lead with the backend-authoritative conclusion', () => {
  it('the compact result renders relationalComposition.summary before generic brief prose', () => {
    const compact = readFileSync(join(__dirname, 'AskCompactResult.tsx'), 'utf8');
    expect(compact).toContain('data-ask="relational-answer"');
    expect(compact).toContain('analysis.relationalComposition.summary');
    /* INLINE CITATIONS R1 — the brief (data-ask="brief") is now rendered by AskCitedBrief. */
    expect(compact.indexOf('<AskCitedBrief')).toBeGreaterThan(0);
    expect(compact.indexOf('data-ask="relational-answer"')).toBeLessThan(
      compact.indexOf('<AskCitedBrief'),
    );
  });

  it('no-evidence state explains the evidence boundary and suppresses a dead full-analysis transition', () => {
    const compact = readFileSync(join(__dirname, 'AskCompactResult.tsx'), 'utf8');
    expect(compact).toContain('resultNoAnswerProvider');
    expect(compact).toContain('resultNoAnswerEvidence');
    expect(compact).toContain('resultNoAnswerSafety');
    expect(compact).toContain('const canOpenFullAnalysis = hasAnalysis || response.articles.length > 0');
    expect(compact).toContain('{canOpenFullAnalysis ? (');
    expect(compact).toContain('border-s-2 border-border-strong');
    expect(compact).not.toContain('data-ask="compact-result" className="flex flex-col gap-4 rounded-2xl');
  });
});

describe('opening the panel is not a question', () => {
  /* R2C — the ONLY execution call (the canonical turn) sits inside the submit handler. */
  it('the ONLY call to the analysis client sits inside the submit handler', () => {
    expect((CODE.match(/analyzeNews\(/g) ?? []).length).toBe(0);
    expect((CODE.match(/\.submit\(asked/g) ?? []).length).toBe(1);
    const submitAt = CODE.indexOf('const submit = useCallback');
    const callAt = CODE.indexOf('.submit(asked');
    expect(submitAt).toBeGreaterThan(-1);
    expect(callAt).toBeGreaterThan(submitAt);
  });

  it('no effect in this file can issue the request', () => {
    /* every useEffect body is focus or key handling; none may reach the client */
    for (const body of CODE.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[/g) ?? []) {
      expect(body).not.toMatch(/analyzeNews|r2\.submit|askV2Api/);
    }
  });

  it('an empty question cannot be submitted', () => {
    expect(CODE).toMatch(/if \(asked\.length === 0\) return;/);
    expect(CODE).toMatch(/disabled=\{question\.trim\(\)\.length === 0 \|\| isPending\}/);
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
  /*
    TIGHTENED IN UNIFIED INTELLIGENCE BINDING R2C. Old bound: {title, articleId, countryCode}.
    The canonical engine accepts REFERENCES ONLY (R2B): a story by its persisted id, or a governed
    country code — no title at all. The bound lives in ONE builder (askContextRefOf), story first,
    never both.
  */
  it('§7.1/§7.2 — only a bounded REFERENCE crosses: {kind:STORY, articleId} or {kind:GEOGRAPHY, countryCode}', () => {
    expect(CODE).toMatch(/void r2\s*\.submit\(asked, contextRef,/);
    expect(CODE).toMatch(/const contextRef = askContextRefOf\(storyContext, geographyContext\);/);

    const builder = readFileSync(join(__dirname, '..', '..', 'lib', 'ask', 'askContextRef.ts'), 'utf8');
    const fn = builder.slice(builder.indexOf('export function askContextRefOf'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body).toMatch(/return \{ kind: 'STORY', articleId: story\.articleId \};/);
    expect(body).toMatch(/return \{ kind: 'GEOGRAPHY', countryCode: (story|geography)\.countryCode \};/);
    /* nothing else is copied across — not even the title */
    expect(body).not.toMatch(/title|url|sourceName|sources|articles|evidence|cluster|report|dimension/i);
  });

  it('§7.3 — no evidence/report/cluster identity and no response field is used as an INPUT', () => {
    const submitStart = CODE.indexOf('const submit = useCallback');
    const submit = CODE.slice(submitStart, CODE.indexOf('\n  return (', submitStart));
    for (const forbidden of ['evidenceId', 'reportId', 'clusterId', 'sourceEntities', 'keyFacts',
                             'agreements', 'differences', 'sourceDiversity', 'retrievalContext',
                             'phase.response', 'analysis.sources']) {
      expect(`${forbidden}: ${submit.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });

  /* R2C — continuity is the Ask THREAD's: the server derives the prior USER question from the
     thread's own turns. The dock sends no prior question and no AI output at all. */
  it('conversation context contains only a prior USER question, never prior AI output', () => {
    const submitStart = CODE.indexOf('const submit = useCallback');
    const submit = CODE.slice(submitStart, CODE.indexOf('\n  return (', submitStart));
    expect(submit).not.toMatch(/priorQuestion/);
    expect(submit).not.toMatch(/phase\.response|analysis\.sources|keyFacts|retrievalContext|payload/);
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
    /* STANDALONE PUBLIC BETA CONVERGENCE R1 — the mount also carries the server-decided root. */
    /* R4 · CTO dock-direction ruling — and the reader's DisplayLocale (launcher direction only) */
    expect(layout).toMatch(
      /<AskAiDock\s+language=\{language\}\s+displayLocale=\{resolveAskLocale\(languageCookie\)\}\s+standaloneRoot=\{standaloneAskRoot\(\)\}\s*\/>/,
    );
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
                         'resultBriefAbsent:', 'resultNoAnswer:', 'resultNoAnswerProvider:',
                         'resultNoAnswerEvidence:', 'resultNoAnswerSafety:',
                         /* CTO ruling 2 — Open full analysis became Run full analysis. */
                         'runFullAnalysis:', 'runFullAnalysisNote:']) {
        expect(`${f} ${key} ${group.startsWith('askAi: {') && head.includes(key)}`)
          .toBe(`${f} ${key} true`);
      }
    }
  });
});


describe('ELASTIC COMPOSER R2 — long pasted questions stay readable', () => {
  const adaptive = readFileSync(join(__dirname, '../ui/AdaptiveTextarea.tsx'), 'utf8');
  const hero = readFileSync(join(__dirname, '../home/HeroAskField.tsx'), 'utf8');
  const search = readFileSync(join(__dirname, '../search/SearchPageClient.tsx'), 'utf8');
  const askParts = readFileSync(join(__dirname, '../ask-frame/AskParts.tsx'), 'utf8');
  const globals = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');

  it('measures wrapped content and re-measures pasted text after layout', () => {
    expect(adaptive).toContain('estimatedLines');
    expect(adaptive).toContain('node.scrollHeight');
    expect(adaptive).toContain('requestAnimationFrame(resize)');
    expect(adaptive).toContain("node.style.overflowX = 'hidden'");
  });

  it('hides browser scrollbar chrome without disabling internal overflow', () => {
    expect(adaptive).toContain('gn-adaptive-textarea');
    expect(globals).toContain('.gn-adaptive-textarea::-webkit-scrollbar');
    expect(globals).toContain('scrollbar-width: none');
    /* COMPOSER GEOMETRY R1 — the same rule, now in the extracted pure helper. */
    expect(adaptive).toContain("overflowY: input.contentHeight > ceiling ? 'auto' : 'hidden'");
    expect(adaptive).toContain('node.style.overflowY = overflowY');
  });

  it('gives each free-form composer a meaningful elastic ceiling', () => {
    expect(hero).toContain('maxHeight={280}');
    /* COMPOSER GEOMETRY R1 — Search's bounded ceiling lives in searchComposerGeometry.ts. */
    expect(search).toContain('maxHeight={SEARCH_COMPOSER_GEOMETRY.maxHeight}');
    /* ASK R2 CLAUDE DESIGN RECONCILIATION R1 — /ask follows D25 04: ~6 lines, 220 desktop / 140 phone. */
    expect(askParts).toContain('maxHeight={maxHeight}');
    expect(
      readFileSync(join(__dirname, '../ask-frame/AskFrameScreen.tsx'), 'utf8'),
    ).toContain('maxHeight={compact ? 140 : 220}');
    expect(CODE).toContain('maxHeight={420}');
  });
});


describe('HERO COMPOSER OVERLAY R3 — elasticity must not reflow Home', () => {
  const hero = readFileSync(join(__dirname, '../home/HeroAskField.tsx'), 'utf8');
  const adaptive = readFileSync(join(__dirname, '../ui/AdaptiveTextarea.tsx'), 'utf8');

  it('reserves a fixed document-flow anchor and floats the expanding composer above it', () => {
    expect(hero).toContain('h-[54px]');
    expect(hero).toContain('overflow-visible');
    expect(hero).toContain('data-gn-hero-composer-overlay=""');
    expect(hero).toMatch(/absolute inset-x-0 top-0 z-50/);
  });

  it('collapses the floating editor on blur without discarding the staged question', () => {
    expect(hero).toContain('const collapseAfterBlur');
    expect(hero).toContain("node.style.overflowY = 'hidden'");
    expect(hero).toContain('onBlur={collapseAfterBlur}');
  });

  it('re-measures on refocus so a collapsed long question expands again', () => {
    const start = adaptive.indexOf('onFocus={(event)');
    const focusBlock = adaptive.slice(start, start + 700);
    expect(focusBlock).toContain('resize();');
    expect(focusBlock).toContain('requestAnimationFrame(resize)');
  });
});


describe('HOME ASK DOCK LAUNCH R1 — Home opens Ask in place with zero spend', () => {
  const dock = readFileSync(join(__dirname, 'AskAiDock.tsx'), 'utf8');
  const hero = readFileSync(join(__dirname, '../home/HeroAskField.tsx'), 'utf8');
  const rail = readFileSync(join(__dirname, '../home/HomeSideRail.tsx'), 'utf8');
  const betaHero = readFileSync(join(__dirname, '../home/BetaHero.tsx'), 'utf8');
  const launcher = readFileSync(join(__dirname, '../home/HomeAskLauncher.tsx'), 'utf8');
  const eventContract = readFileSync(join(__dirname, '../../lib/ask/openGlobalAsk.ts'), 'utf8');

  it('the launcher only dispatches a local UI event and never performs transport', () => {
    expect(eventContract).toContain("GLOBAL_ASK_OPEN_EVENT = 'globalnews:ask-open'");
    expect(eventContract).toContain('window.dispatchEvent');
    expect(eventContract).not.toMatch(/fetch\(|analyzeNews\(|router\.push|location\./);
  });

  it('the root Ask dock listens for the Home event and stages the optional draft', () => {
    expect(dock).toContain('window.addEventListener(GLOBAL_ASK_OPEN_EVENT');
    expect(dock).toContain('setQuestion(custom.detail.question)');
    expect(dock).toContain('setIsOpen(true)');
    expect(dock).toContain('requestAnimationFrame(() => inputRef.current?.focus())');
  });

  it('Home Hero submit stages the exact question in the dock instead of navigating', () => {
    expect(hero).toContain('onSubmit={stageInAskDock}');
    expect(hero).toContain('openGlobalAsk(draft)');
  });

  it('Home CTA and suggestion surfaces use the shared in-place launcher', () => {
    expect(betaHero).toContain('<HomeAskLauncher');
    expect(rail).toContain('<HomeAskLauncher');
    expect(rail).toContain('question={prompt}');
    expect(launcher).toContain('openGlobalAsk(question)');
  });

  it('analysis remains behind the dock submit path only', () => {
    const openHandlerStart = dock.indexOf('const openFromHome');
    const openHandlerEnd = dock.indexOf('}, []);', openHandlerStart);
    const openHandler = dock.slice(openHandlerStart, openHandlerEnd);
    expect(openHandler).not.toContain('analyzeNews(');
    expect(openHandler).not.toContain('.submit(');
    /* R2C — the explicit Send is the canonical Ask V2 turn */
    expect(dock).toMatch(/void r2\s*\.submit\(asked, contextRef,/);
  });
});


describe('HOME ASK NO-ROUTE FALLBACK R2 — Hero submit cannot escape to /ask', () => {
  const hero = readFileSync(join(__dirname, '../home/HeroAskField.tsx'), 'utf8');

  it('the Home Hero form owns no native /ask action', () => {
    expect(hero).toContain('onSubmit={stageInAskDock}');
    expect(hero).not.toContain('action="/ask"');
    expect(hero).not.toContain("action='/ask'");
    expect(hero).not.toContain('method="get"');
  });

  it('stages the exact draft locally and does not navigate', () => {
    const start = hero.indexOf('const stageInAskDock');
    const end = hero.indexOf('return (', start);
    const submitBlock = hero.slice(start, end);
    expect(submitBlock).toContain('event.preventDefault()');
    expect(submitBlock).toContain('openGlobalAsk(draft)');
    expect(submitBlock).not.toMatch(/router\.|location\.|window\.open|href/);
  });
});
