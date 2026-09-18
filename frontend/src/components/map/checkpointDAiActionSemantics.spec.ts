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
 * ─── THE ANSWER: IT AUTO-EXECUTES ────────────────────────────────────────
 *
 * `SearchPageClient`'s analysis effect calls `analyzeNews` on mount whenever
 * the URL carries a non-empty `q`. There is no intermediate user action. The
 * map pushes `/search?q={article.title}&articleId=…&countryCode=…`, so the
 * click on the map IS the decision to spend model compute.
 *
 * ─── A CORRECTION TO AN EASY ASSUMPTION ──────────────────────────────────
 *
 * The map does NOT call `POST /analysis/news` itself. No component on the map
 * surface imports the analysis client. The cost is real but it is spent one
 * route later, which is why the fix is at the affordance and not at a call the
 * map never makes.
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
     * `analysisAutoRunDecision` is the real decision the effect now asks, so
     * this counts the same branch the component takes.
     */
    const executionsForArrival = (query: string, hasResolvedLanguage = true): number =>
      willExecuteAnalysis(query, hasResolvedLanguage) ? 1 : 0;

    it('arriving from the map control executes analysis ONCE, with no user action', () => {
      /* The exact shape the map pushes: q = the article title. */
      expect(executionsForArrival('Poland revives tax proposal')).toBe(1);
    });

    it('so the map click is the effective AI execution decision point', () => {
      const decision = analysisAutoRunDecision('Poland revives tax proposal', true);

      expect(decision).toBe('run');
    });

    it('arriving with no question executes NOTHING — the workspace path', () => {
      expect(executionsForArrival('')).toBe(0);
      expect(executionsForArrival('   ')).toBe(0);
      expect(analysisAutoRunDecision('', true)).toBe('idle-no-query');
    });

    it('an unresolved language executes nothing yet, so one arrival is never two runs', () => {
      /*
        Milestone #47: firing before the language resolves would run in English
        and immediately re-run in the reader's language — TWO executions for one
        arrival.
      */
      expect(executionsForArrival('Poland revives tax proposal', false)).toBe(0);
      expect(analysisAutoRunDecision('Poland', false)).toBe('idle-language-pending');
    });

    it('a deliberate Open Analysis remains exactly ONE execution', () => {
      const arrivals = ['Poland revives tax proposal'];
      const total = arrivals.reduce((sum, q) => sum + executionsForArrival(q), 0);

      expect(total).toBe(1);
    });

    it('the effect asks the named decision rather than restating it', () => {
      expect(searchClient).toContain('const decision = analysisAutoRunDecision(query, hasResolvedLanguage);');
      expect(searchClient).toContain("if (decision === 'idle-language-pending') return undefined;");
      expect(searchClient).toContain("if (decision === 'idle-no-query') {");
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

    it('the map still calls exactly the two known news entry points', () => {
      /*
        R5 — the world corpus is read through `fetchRetainedTopHeadlines`, a
        route that cannot execute a provider. Two entry points as before; only
        one of them can now cost anything, and it is the explicit country
        retrieval.
      */
      expect(mapClient.split('fetchRetainedTopHeadlines(').length - 1).toBe(1);
      expect(mapClient.split('fetchTopHeadlines(').length - 1).toBe(0);
      expect(mapClient.split('fetchCountryNews(').length - 1).toBe(1);
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
