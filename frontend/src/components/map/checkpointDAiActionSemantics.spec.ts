import { readFileSync } from 'fs';
import { join } from 'path';

import { analysisAutoRunDecision, willExecuteAnalysis } from '@/lib/analysis/analysisAutoRun';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT D — EXPLICIT AI-ACTION SEMANTICS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: first prove whether `/search` auto-executes; then, if it does,
 * treat the Map click as the effective AI execution decision point and replace
 * the ambiguous magnifier with an explicit AI action — while preserving the
 * genuine source action separately and distinctly.
 *
 * ─── THE ORIGINAL ANSWER WAS: IT AUTO-EXECUTES ───────────────────────────
 *
 * `SearchPageClient`'s analysis effect used to call `analyzeNews` on mount
 * whenever the URL carried a non-empty `q`, so the map click WAS the decision
 * to spend model compute.
 *
 * ─── ASK/SEARCH ENGINEERING R1 — THE ANSWER IS NOW: IT DOES NOT ─────────
 *
 * A URL is not consent. Arrival stages the question and executes nothing
 * until an explicit compute action has been accepted — a one-shot grant left
 * by explicit Send / the dock's deeper-analysis transition, or the staged Run
 * control. The map's controls therefore navigate at zero AI cost; the counts
 * below are the proof, and `searchComputeRequestCount.spec.ts` counts the same
 * thing on the mounted component.
 *
 * ─── A CORRECTION TO AN EASY ASSUMPTION ──────────────────────────────────
 *
 * The map does NOT call `POST /analysis/news` itself. No component on the map
 * surface imports the analysis client.
 */

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const read = (...segments: string[]) =>
  readFileSync(join(__dirname, ...segments), 'utf-8');

const sourceCard = read('shell', 'SourceCard.tsx');
const sourceCardCode = stripComments(sourceCard);
const mapClient = stripComments(read('MapPageClient.tsx'));
const searchClient = stripComments(read('..', 'search', 'SearchPageClient.tsx'));
const en = read('..', '..', 'lib', 'i18n', 'dictionaries', 'en.ts');
const pl = read('..', '..', 'lib', 'i18n', 'dictionaries', 'pl.ts');

describe('D — the AI action is visible, and the source action is not an AI action', () => {
  /* ── THE MEASUREMENT THE RULING ASKED FOR ───────────────────────────────── */
  describe('DOES /search AUTO-EXECUTE? — counted, not inferred', () => {
    /**
     * One arrival at /search. Returns how many analysis executions it causes.
     * `analysisAutoRunDecision` is the real decision the effect asks, so this
     * counts the same branch the component takes.
     */
    const executionsForArrival = (
      query: string,
      hasResolvedLanguage = true,
      hasComputeConsent = false,
    ): number => (willExecuteAnalysis(query, hasResolvedLanguage, hasComputeConsent) ? 1 : 0);

    it('arriving from the map control executes NOTHING — the URL is not consent', () => {
      /* The exact shape the map pushes: q = the article title. */
      expect(executionsForArrival('Poland revives tax proposal')).toBe(0);
    });

    it('so the map click is navigation, and the question is staged', () => {
      const decision = analysisAutoRunDecision('Poland revives tax proposal', true, false);

      expect(decision).toBe('idle-awaiting-consent');
    });

    it('arriving with no question executes NOTHING — the workspace path', () => {
      expect(executionsForArrival('')).toBe(0);
      expect(executionsForArrival('   ', true, true)).toBe(0);
      expect(analysisAutoRunDecision('', true, false)).toBe('idle-no-query');
    });

    it('an unresolved language executes nothing yet, so one arrival is never two runs', () => {
      /*
        Milestone #47: firing before the language resolves would run in English
        and immediately re-run in the reader's language — TWO executions for one
        arrival. That holds even when consent has been granted.
      */
      expect(executionsForArrival('Poland revives tax proposal', false, true)).toBe(0);
      expect(analysisAutoRunDecision('Poland', false, true)).toBe('idle-language-pending');
    });

    it('a deliberate, accepted Run remains exactly ONE execution', () => {
      const arrivals = ['Poland revives tax proposal'];
      const total = arrivals.reduce((sum, q) => sum + executionsForArrival(q, true, true), 0);

      expect(total).toBe(1);
    });

    it('the effect asks the named decision rather than restating it', () => {
      expect(searchClient).toContain('const decision = analysisAutoRunDecision(');
      expect(searchClient).toContain("if (decision === 'idle-language-pending') return undefined;");
      expect(searchClient).toContain(
        "if (decision === 'idle-no-query' || decision === 'idle-awaiting-consent') {",
      );
    });
  });

  /* ── THE AFFORDANCE ─────────────────────────────────────────────────────── */
  describe('THE AI ACTION IS VISIBLE TO SIGHTED USERS, NOT ONLY VIA aria-label', () => {
    it('the control renders a visible word, not a bare glyph', () => {
      expect(sourceCardCode).toContain('<span>{labels.askAiShort}</span>');
    });

    it('the bare magnifier is gone', () => {
      /* &#8981; — the glyph that read as "inspect" while spending model compute. */
      expect(sourceCardCode).not.toContain('&#8981;');
    });

    it('the visible label names AI in both languages', () => {
      expect(en).toContain("askAiShort: 'Ask AI'");
      expect(pl).toContain("askAiShort: 'Zapytaj AI'");
    });

    it('it carries an AI-action marker for tests and assistive tooling to key on', () => {
      expect(sourceCardCode).toContain('data-gn-ai-action="true"');
    });

    it('it is NOT labelled paid — the monetization contract is still under review', () => {
      expect(en).not.toMatch(/askAiShort:\s*'[^']*(paid|premium|upgrade|pro)\b/i);
      expect(sourceCardCode).not.toMatch(/\bpaid\b/i);
    });
  });

  describe('KEYBOARD AND SCREEN-READER LABELLING REMAINS CORRECT', () => {
    it('the accessible name is unchanged and still the full sentence', () => {
      expect(sourceCardCode).toContain('aria-label={`${labels.askAbout}: ${item.headline}`}');
      expect(en).toContain("askAbout: 'Ask GlobalNews AI about this'");
    });

    it('it is a real button, so it is keyboard-reachable and activatable', () => {
      const ask = sourceCardCode.slice(
        sourceCardCode.indexOf('data-gn="source-ask"') - 200,
        sourceCardCode.indexOf('data-gn="source-ask"') + 900,
      );

      expect(ask).toContain('<button');
      expect(ask).toContain('type="button"');
      expect(ask).toContain('focus-visible:outline');
    });

    it('the decorative marker is hidden from assistive technology', () => {
      /* The button already has a full accessible name; announcing a mark too is noise. */
      expect(sourceCardCode).toContain('<span aria-hidden="true" className="text-sp-cyan">&#9673;</span>');
    });
  });

  describe('THE SOURCE ACTION IS SEPARATE, AND NEVER EXECUTES AI', () => {
    it('↗ is still a real anchor to the publisher', () => {
      expect(sourceCardCode).toContain('href={item.url}');
      expect(sourceCardCode).toContain('target="_blank"');
      expect(sourceCardCode).toContain('rel="noopener noreferrer"');
    });

    it('↗ keeps its own distinct accessible name', () => {
      expect(sourceCardCode).toContain(
        'aria-label={`${labels.openSource}: ${item.publisher} — ${item.headline}`}',
      );
    });

    it('opening the source runs NO analysis and NO retrieval', () => {
      /*
        `onOpenSource` is a notification callback beside the navigation, not a
        request. The two actions are now distinct in markup as well as in
        behaviour: an anchor with an arrow, and a button with a word.
      */
      /* Bounded to the ANCHOR ITSELF — slicing to the next control would sweep
         in the `onAskAbout &&` guard that introduces the sibling button. */
      const openStart = sourceCardCode.indexOf('data-gn="source-open"');
      const open = sourceCardCode.slice(
        openStart,
        sourceCardCode.indexOf('</a>', openStart),
      );

      expect(open).not.toContain('analyzeNews');
      expect(open).not.toContain('onAskAbout');
      expect(open).not.toContain('fetch');
    });

    it('the two actions are semantically distinct elements', () => {
      expect(sourceCardCode).toMatch(/<a\s[^>]*data-gn="source-open"/s);
      expect(sourceCardCode).toMatch(/<button[\s\S]*?data-gn="source-ask"/);
    });
  });

  describe('NO PROVIDER OR ANALYSIS CALL WAS INTRODUCED ON THE MAP', () => {
    it('the map surface still imports no analysis client', () => {
      expect(mapClient).not.toContain('analyzeNews');
      expect(mapClient).not.toContain('analysisApi');
    });

    it('the ask action still only navigates, carrying the trusted evidence anchor', () => {
      const handler = mapClient.slice(
        mapClient.indexOf('onAskAbout: (id: string) => {'),
        mapClient.indexOf('...(topics.length > 0'),
      );

      expect(handler).toContain("router.push(`/search?${params.toString()}`)");
      expect(handler).toContain("articleId: article.id");
      expect(handler).toContain("params.set('countryCode', selectedCountry.iso2)");
      expect(handler).not.toContain('fetch');
      expect(handler).not.toContain('analyzeNews');
    });

    it('the map calls exactly ONE news entry point, and it cannot cost anything', () => {
      /*
        SUPERSEDED BY THE PROVIDER-BOUNDARY RULING, AND STRICTLY STRENGTHENED.

        This used to allow TWO entry points, noting that "only one of them can
        now cost anything, and it is the explicit country retrieval". Live
        acceptance showed that one executing GNews from a plain country click,
        which the CTO ruling now forbids: passive map navigation is
        provider-free.

        So the count moves 1 -> 0. What remains is the RETAINED world corpus,
        which is served from a route that cannot execute a provider at all.
      */
      expect(mapClient.split('fetchRetainedTopHeadlines(').length - 1).toBe(1);
      expect(mapClient.split('fetchTopHeadlines(').length - 1).toBe(0);
      expect(mapClient.split('fetchCountryNews(').length - 1).toBe(0);
    });
  });

  describe('THE CARD WAS NOT REDESIGNED', () => {
    it('both actions remain in the same trailing row at the same height', () => {
      expect(sourceCardCode).toContain('h-[26px] w-[26px]');
      expect(sourceCardCode).toContain('h-[26px] items-center justify-center gap-[4px]');
    });

    it('the shared hover and focus language is unchanged on both', () => {
      const occurrences = sourceCardCode.split('hover:!border-sp-cyan/45').length - 1;

      expect(occurrences).toBe(2);
    });

    it('no other card element changed shape', () => {
      for (const marker of [
        'data-gn="source-card"',
        'data-gn="source-thumb"',
        'data-gn="source-body"',
        'data-gn="source-headline"',
        'data-gn="source-publisher"',
        'data-gn="source-precision"',
      ]) {
        expect(sourceCardCode).toContain(marker);
      }
    });
  });
});
