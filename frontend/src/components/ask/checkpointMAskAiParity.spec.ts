import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT M — ASK AI: ALPHA ↔ PRODUCTION PARITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-PRODUCTION-ASK-AI-PARITY-1. An INVESTIGATION. The ruling is explicit:
 * *"Do not 'restore' a button until the reason for difference is established."*
 * Nothing is restored, moved, promoted or gated here — this pins what each
 * affordance IS, so the classification rests on assertions rather than on a
 * reading.
 *
 * ─── WHAT "PRODUCTION" MEANS IN THIS PASS, STATED HONESTLY ────────────────
 *
 * The Alpha side is PROVEN: this candidate descends from `2c4b6ce`, the
 * materialised deployed Alpha tree `654be554`, recovered under DOMAIN-1 with
 * 1087/1087 files byte-identical.
 *
 * The Production side is NOT proven to the same standard. No equivalent
 * deployed-commit evidence was gathered for Production in this pass, so the
 * comparison is against the local `main` branch as a LINEAGE PROXY. Every
 * classification below is therefore "Alpha vs main"; whether the Production
 * deployment matches `main` is UNVERIFIED and is recorded as such rather than
 * assumed. Production was not touched, which is why it could not be measured.
 *
 * ─── THE FINDING ──────────────────────────────────────────────────────────
 *
 * There are FOUR Ask AI affordances, not one, and they do not all differ.
 *
 *   1. MOBILE BOTTOM NAV — `{ key: 'ask', href: '/search', Icon: Search }`
 *      Byte-identical in both. This is almost certainly the control the
 *      Production evidence shows.                                   ->  SAME
 *
 *   2. COUNTRY ARTICLE CARD — "Ask GlobalNews AI about this".
 *      Present in both; the only diff `git` reports is the file MODE
 *      (100644 -> 100755), a worktree artefact, not content.        ->  SAME
 *
 *   3. ASK AI DOCK — a floating surface mounted in the root layout on EVERY
 *      route. Absent from `main` entirely: no `components/ask/` directory,
 *      no mount, no dictionary section.          ->  ALPHA-ONLY UNPROMOTED
 *
 *   4. SOURCE CARD ASK ACTION — `askAiShort`, the affordance Checkpoint D
 *      made explicit. No `askAiShort` anywhere in `main`.
 *                                                ->  ALPHA-ONLY UNPROMOTED
 *
 * ─── WHY 3 AND 4 ARE "UNPROMOTED" AND NOT "REGRESSION" ────────────────────
 *
 * A regression is something Production HAD and Alpha LOST. This is the
 * opposite direction: Alpha has surfaces Production never had. And the hold is
 * recorded in the layout itself — the dock is deliberately NOT a NavBar item
 * because "that row is released design and Ask AI's own chrome/geometry
 * reconciliation is still held".
 *
 * NOTHING NEEDS RESTORING. The entry control Production has is present and
 * identical in Alpha. No button was lost in either direction.
 *
 * ─── THE EIGHT ATTRIBUTES, FOR THE DOCK ───────────────────────────────────
 *
 *   rendering location   `app/layout.tsx`, after {children}, sibling of
 *                        ServiceWorkerRegistrar — so every route
 *   visibility           unconditional
 *   authentication       none
 *   geography            none
 *   feature flags        none
 *   entitlement          none
 *   destination          opens in place; full detail TRANSITIONS to the
 *                        workspace and never expands in the dock
 *   click executes AI?   NO. "Opening a panel is navigation, not a question."
 *                        The request is issued from onSubmit and nowhere else.
 */

const src = (...parts: string[]): string =>
  readFileSync(join(__dirname, '..', '..', ...parts), 'utf-8');

const dock = src('components', 'ask', 'AskAiDock.tsx');
const layout = src('app', 'layout.tsx');
const bottomNav = src('components', 'navigation', 'MobileBottomNav.tsx');

const stripComments = (value: string): string =>
  value
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const dockCode = stripComments(dock);

describe('M — the entry control Production has, Alpha has identically', () => {
  it('the bottom nav offers Ask AI', () => {
    expect(bottomNav).toContain("{ key: 'ask', href: '/search', Icon: Search }");
  });

  it('and it is navigation to /search, not an AI execution', () => {
    /*
      The item is an <a href>. Pressing it costs nothing and asks nothing; the
      question is typed on the destination.
    */
    expect(bottomNav).toContain('href={href}');
    expect(stripComments(bottomNav)).not.toContain('analyzeNews');
  });

  it('the nav row is exactly four items, in a fixed order', () => {
    /* So "an Ask AI control exists" cannot quietly become a different control. */
    const keys = [...bottomNav.matchAll(/key: '(\w+)'/g)].map((m) => m[1]);

    expect(keys).toEqual(['home', 'worldMap', 'ask', 'intelligence']);
  });
});

describe('M — the Alpha-only dock, and what it is gated on', () => {
  describe('RENDERING LOCATION AND VISIBILITY', () => {
    it('it is mounted in the root layout, so it is present on every route', () => {
      expect(layout).toContain('<AskAiDock language={language} />');
    });

    it('with NO condition around the mount', () => {
      /*
        Recorded because it is the answer to four of the eight questions at
        once: no flag, no auth, no geography, no entitlement.
      */
      expect(layout).not.toMatch(/\{[^}]*&&\s*<AskAiDock/);
      expect(layout).not.toMatch(/\?\s*<AskAiDock/);
    });

    it('and none inside the component either', () => {
      for (const gate of ['FEATURE_FLAG', 'entitlement', 'capability', 'signedIn', 'tier']) {
        expect(dockCode).not.toContain(gate);
      }
    });

    it('it is additive chrome, removable in one line', () => {
      /* The layout says so, and the mount shape is what makes it true. */
      expect(layout).toContain('<ServiceWorkerRegistrar />');
    });

    it('it is deliberately NOT an item in the released NavBar row', () => {
      expect(layout).toMatch(/NOT an item\s*\n\s*\*?\s*in the NavBar's accepted item row/);
    });
  });

  describe('WHETHER A CLICK EXECUTES AI — IT DOES NOT', () => {
    it('no request is issued on mount or on open', () => {
      expect(dock).toMatch(/NO REQUEST ON OPEN/);
    });

    it('the analysis client is called from the submit handler only', () => {
      /*
        The load-bearing measurement for this checkpoint: a reader who opens
        the dock and closes it again has cost nothing and asked nothing.
      */
      const calls = dockCode.match(/analyzeNews\(/g) ?? [];

      expect(calls).toHaveLength(1);
    });

    it('and that call sits inside the form handler, after every effect', () => {
      /*
        The handler is a FormEvent callback defined before the JSX that uses it,
        so position against the JSX attribute proves nothing. What does prove it:
        the call comes AFTER the handler's signature and after the last
        useEffect, so no effect body can contain it.
      */
      const handlerIndex = dockCode.indexOf('FormEvent<HTMLFormElement>');
      const callIndex = dockCode.indexOf('analyzeNews(', handlerIndex);
      const lastEffectIndex = dockCode.lastIndexOf('useEffect(');

      expect(handlerIndex).toBeGreaterThan(-1);
      expect(callIndex).toBeGreaterThan(handlerIndex);
      expect(lastEffectIndex).toBeLessThan(handlerIndex);
      expect(dockCode).toContain('onSubmit={submit}');
    });
  });

  describe('DESTINATION — A PROJECTION, NOT A SECOND PRESENTATION', () => {
    it('it renders the compact result rather than mounting the frame', () => {
      expect(dockCode).toContain('AskCompactResult');
      expect(dockCode).not.toContain('AnalysisFrameSurface');
    });

    it('it uses the SAME analysis client the search route uses', () => {
      /* No second AI engine: same client, same route, same service. */
      expect(dockCode).toContain("import { analyzeNews } from '@/lib/api/analysisApi';");
    });

    it('and it contains no provider, model, prompt or ranking of its own', () => {
      for (const forbidden of ['openai', 'gpt-', 'gnews', 'prompt:']) {
        expect(dockCode.toLowerCase()).not.toContain(forbidden);
      }
    });
  });

  describe('THE CONTEXT BOUND IS ENFORCED IN ONE PLACE', () => {
    it('the dock sends only what transportableContext permits', () => {
      /*
        Evidence, report and cluster identities are OUTPUTS of a prior
        analysis. Feeding them back would make results into inputs and require
        a second retrieval architecture.
      */
      expect(dockCode).toContain('transportableContext');
    });

    it('and it passes the question verbatim, with no rewriting', () => {
      expect(dock).toMatch(/NO QUERY REWRITING/);
    });
  });
});
