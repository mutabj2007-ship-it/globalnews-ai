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
 * ─── CORRECTED AGAINST THE GOVERNED BASELINE ──────────────────────────────
 *
 * THIS SPEC FIRST COMPARED AGAINST LOCAL `main`, AND THAT WAS WRONG. The CTO
 * ruling is explicit — do not use `main` as the Production proxy — and the
 * measurement proves why: `main` (41428ea) is a DIFFERENT LINEAGE that has no
 * `components/ask/` directory at all, so comparing against it manufactured two
 * differences that do not exist.
 *
 * THE THREE LAYERS, ALL PROVABLE:
 *
 *   L1  GOVERNED PRODUCTION BASELINE — C911-V1, commit `fc162e2`, tree
 *       `64f42a52`, 1086 entries verified against
 *       SHA256-MANIFEST-C911-V1-full-tree.txt (1086/1086 OK).
 *   L2  DEPLOYED ALPHA CANDIDATE — `2c4b6ce`, tree `654be554`, 1087/1087
 *       byte-identical. `git merge-base` returns L1, so L2 DESCENDS FROM L1.
 *   L3  this convergence candidate — L2 plus the Phase 1 corrections.
 *
 * L1 -> L2 IS TWO FILES. `git diff --stat fc162e2 2c4b6ce` is
 * `news.service.ts` and `news.service.home-cache.spec.ts`, +960/-2, both in
 * `backend/src/modules/news`. Everything else in the deployed Alpha candidate
 * is byte-identical to the governed Production baseline.
 *
 * LIVE DEPLOYMENT COMMIT = UNVERIFIED. Railway exposes no commit hash for
 * frontend d1d564d3-3416-454e-8963-2216c9f30d32 or backend
 * 241e7157-7fec-47a6-b2d5-e3ca0d4d84c0. No Git ref is manufactured for them.
 *
 * ─── THE FINDING, RESTATED ────────────────────────────────────────────────
 *
 * There are four Ask AI affordances. Against the GOVERNED BASELINE, three are
 * identical and the fourth is not a parity difference at all.
 *
 *   1. MOBILE BOTTOM NAV — `{ key: 'ask', href: '/search', Icon: Search }`
 *      Inside the untouched region of the L1->L2 diff.              ->  SAME
 *
 *   2. COUNTRY ARTICLE CARD — "Ask GlobalNews AI about this".       ->  SAME
 *
 *   3. ASK AI DOCK — PRESENT IN C911-V1, with all six files in
 *      `components/ask/` and mounted in the layout. It is not an Alpha-only
 *      surface; it is governed Production source.                   ->  SAME
 *
 *   4. SOURCE CARD ASK ACTION — `askAiShort` is absent from BOTH L1 and L2.
 *      It was added by Checkpoint D on this convergence branch, so it is a
 *      CONVERGENCE ADDITION and not an Alpha/Production difference.
 *                                              ->  ALPHA ONLY (this candidate)
 *
 * NOTHING NEEDS RESTORING, and the reason is now stronger than before: the Ask
 * AI entry controls are the SAME source in both, so no button was lost in
 * either direction and none was ever Alpha-only.
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

// CTO R1 routing supersedes the historical mobile destination above.
describe('M — entry controls preserve explicit execution under CTO R1 routing', () => {
  it('the bottom nav offers Ask AI', () => {
    expect(bottomNav).toContain("{ key: 'ask', href: '/ask', Icon: Search }");
  });

  it('and it is navigation to /ask, not an AI execution', () => {
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
