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
    /* no second transport, no second endpoint, no second client */
    expect(CODE).not.toMatch(/fetch\(|XMLHttpRequest|axios|new Request|\/analysis\/|\/ask\b/);
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
    expect(CODE).toMatch(/analyzeNews\(asked, language\)/);
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

  it('reuses the EXISTING analysis presentation for answer, evidence and citations', () => {
    expect(CODE).toMatch(
      /import \{ AnalysisFrameSurface \} from '@\/components\/analysis-frame\/AnalysisFrameSurface'/,
    );
    expect(CODE).toMatch(/<AnalysisFrameSurface response=\{phase\.response\} language=\{language\}/);
    /* it must not author its own evidence, source or citation rendering */
    for (const own of ['SourceArticleCard', 'SourcesDrawer', 'TrustBadge', 'SourceDiversitySummary',
                       'EvidenceSufficiencyNote', 'RetrievalContextStatus', 'AnalysisResultView']) {
      expect(`${own}: ${CODE.includes(own)}`).toBe(`${own}: false`);
    }
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

describe('ASK RULE A — no caller context crosses the boundary in Phase 1', () => {
  it('storyContext is never passed to the analysis client', () => {
    /* `analyzeNews(query, language, storyContext?)` takes a third argument.
       Phase 1 calls it with two, so the rule holds by construction. */
    expect(CODE).toMatch(/analyzeNews\(asked, language\)/);
    expect(CODE).not.toMatch(/storyContext|articleId|countryCode|StoryContext/);
  });

  it('the contextual affordance is visible, disabled and has no submit path', () => {
    const span = CODE.slice(CODE.indexOf('data-ask="context-affordance"'));
    const element = span.slice(0, span.indexOf('>'));
    expect(element).toMatch(/aria-disabled="true"/);
    expect(element).not.toMatch(/onClick|onSubmit|type="submit"/);
  });
});

describe('the evidence states are the accepted ones, resolved by the accepted frame', () => {
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
      expect(`${f}: ${group.startsWith('askAi: {') && group.slice(0, 2000).includes('contextPendingHint:')}`)
        .toBe(`${f}: true`);
    }
  });
});
