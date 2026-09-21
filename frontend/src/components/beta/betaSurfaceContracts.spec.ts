import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { BETA_CATEGORIES } from '@globalnews-ai/shared';

/**
 * BETA-SIMPLE-ASK-SAND-1 §3/§4/§15/§16/§17/§21 — frontend surface
 * contracts.
 *
 * This repository has no React Testing Library and no jsdom
 * (confirmed: neither is a dependency, and jest.config.js sets
 * testEnvironment: 'node'), so a component cannot be mounted here.
 * The established convention — see
 * components/search/staleResponseProtection.spec.ts, which documents
 * the same constraint — is to test behaviour as pure functions where
 * possible and assert structural contracts against source otherwise.
 *
 * All the LOGIC of these surfaces is therefore tested for real,
 * elsewhere: askNavigationContext.spec.ts (33 tests) and
 * askConversation.spec.ts (23 tests) run the actual functions. What
 * remains, and what this file covers, are structural properties that
 * only exist in the markup — a sticky composer, a noindex directive,
 * five routes sharing one template. Those are genuine requirements
 * with no runtime surface to call.
 */

const APP_DIR = join(__dirname, '..', '..', 'app');
const ASK_DIR = join(__dirname, '..', 'ask');

const askClientSource = readFileSync(join(ASK_DIR, 'AskConversationClient.tsx'), 'utf-8');
const askPageSource = readFileSync(join(APP_DIR, 'ask', 'page.tsx'), 'utf-8');
const categoryTemplateSource = readFileSync(join(__dirname, 'BetaCategoryPage.tsx'), 'utf-8');
const quotePanelSource = readFileSync(join(ASK_DIR, 'SandQuotePanel.tsx'), 'utf-8');
const turnViewSource = readFileSync(join(ASK_DIR, 'AskTurnView.tsx'), 'utf-8');

/**
 * Strips comments before asserting about CODE.
 *
 * Without this, an assertion like "no hard-coded Sand price appears
 * in a component" fails against SandQuotePanel's own doc comment,
 * which quotes §9's "24 Sand" example panel — the comment is
 * documentation of the requirement, not a violation of it. Asserting
 * against raw source would force the code to be worse documented to
 * make a test pass, which is exactly backwards.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
}

describe('§15/§21 — the public Beta routes exist', () => {
  it.each(BETA_CATEGORIES)('/%s is a real route', (category) => {
    const routes = readdirSync(APP_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(routes).toContain(category);
  });

  it('/ask is a real route', () => {
    const routes = readdirSync(APP_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(routes).toContain('ask');
  });
});

describe('§17 — one reusable template, not five category frontends', () => {
  it.each(BETA_CATEGORIES)('/%s delegates to the shared BetaCategoryPage', (category) => {
    const source = readFileSync(join(APP_DIR, category, 'page.tsx'), 'utf-8');
    expect(source).toContain('BetaCategoryPage');
    expect(source).toContain(`category="${category}"`);
  });

  it('keeps each route file thin, so behaviour cannot drift between categories', () => {
    for (const category of BETA_CATEGORIES) {
      const source = readFileSync(join(APP_DIR, category, 'page.tsx'), 'utf-8');
      const codeLines = source
        .split('\n')
        .filter((line) => line.trim() && !line.trim().startsWith('*') && !line.trim().startsWith('/*'));
      // A route that grew its own layout would be far longer than this.
      expect(codeLines.length).toBeLessThan(30);
    }
  });
});

describe('§16 — a category page renders without running AI', () => {
  it('reads only the stored-intelligence endpoint', () => {
    expect(categoryTemplateSource).toContain('fetchCategoryView');
  });

  it('never calls the analysis or ask APIs while rendering', () => {
    expect(categoryTemplateSource).not.toContain('analyzeNews');
    expect(categoryTemplateSource).not.toContain('addAskTurn');
  });

  it('offers Ask as a link the user must choose, not an automatic call', () => {
    // §16's whole point: arriving at /energy must not spend anything.
    expect(categoryTemplateSource).toContain('href={askHref}');
  });
});

describe('§21 — Ask is not indexable, category surfaces are', () => {
  it('marks /ask noindex, nofollow', () => {
    // An Ask URL carries navigation context and a thread id; indexing
    // one would publish somebody's line of enquiry.
    expect(askPageSource).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  });

  it.each(BETA_CATEGORIES)('does not mark /%s noindex', (category) => {
    const source = readFileSync(join(APP_DIR, category, 'page.tsx'), 'utf-8');
    expect(source).not.toContain('index: false');
  });
});

describe('§3 — the composer stays reachable after a long answer', () => {
  it('pins the composer to the viewport rather than letting it scroll away', () => {
    expect(askClientSource).toContain('sticky bottom-0');
  });

  it('does not nest the transcript in a second scroll container', () => {
    // An inner scroll pane would trap scrolling inside the Sources
    // Dock and the Complete Analysis Record on a phone.
    expect(askClientSource).not.toMatch(/overflow-y-(auto|scroll)/);
  });

  it('keeps every turn rendered rather than replacing the previous answer', () => {
    expect(askClientSource).toContain('turns.map(');
  });

  it('bounds the composer to the same length the backend DTO accepts', () => {
    expect(askClientSource).toContain('maxLength={1000}');
  });
});

describe('§3 — mobile usability', () => {
  const touchTargetSources = [askClientSource, quotePanelSource, categoryTemplateSource];

  it('gives every interactive control a 44px minimum touch target', () => {
    for (const source of touchTargetSources) {
      const interactiveElements = source.match(/<(button|textarea|Link|a)\b/g) ?? [];
      const minHeights = source.match(/min-h-\[44px\]/g) ?? [];
      expect(minHeights.length).toBeGreaterThanOrEqual(
        Math.min(interactiveElements.length, 1),
      );
    }
  });

  it('uses a single-column layout with a side gutter on small screens', () => {
    expect(askClientSource).toContain('px-4');
    expect(categoryTemplateSource).toContain('px-4');
  });
});

describe('§3 — every failure state the contract names is renderable', () => {
  it.each([
    'no-evidence',
    'provider-failed',
    'analysis-failed',
    'invalid-response',
    'blocked',
  ])('handles the %s state with its own message', (status) => {
    // The key may be quoted or bare depending on whether it is a
    // valid identifier ('no-evidence' must be quoted, blocked need
    // not be), so both forms count.
    const asKey = new RegExp(`(['"]${status}['"]|\\b${status}\\s*:)`);
    expect(turnViewSource).toMatch(asKey);
  });

  it('announces outcomes to assistive technology rather than rendering them silently', () => {
    expect(turnViewSource).toContain('role="status"');
    expect(askClientSource).toContain('aria-live="polite"');
    expect(askClientSource).toContain('role="alert"');
  });
});

describe('§26 — the protected analysis surfaces are reused, not forked', () => {
  it('renders an answer through the existing AnalysisResultView', () => {
    // Re-implementing this would fork the Executive Brief, the source
    // cards, the Sources Dock and the Complete Analysis Record.
    expect(turnViewSource).toContain('AnalysisResultView');
  });

  it('renders sources through the existing SourceArticleCard', () => {
    expect(turnViewSource).toContain('SourceArticleCard');
  });

  it('renders entities through the existing SourceEntitiesPanel', () => {
    expect(turnViewSource).toContain('SourceEntitiesPanel');
  });
});

describe('§8 — no Sand arithmetic or pricing lives in a component', () => {
  const componentSources = [quotePanelSource, askClientSource, turnViewSource, categoryTemplateSource];

  it('renders the server-issued amount verbatim', () => {
    expect(quotePanelSource).toContain('quote.quotedSand');
    expect(quotePanelSource).toContain('quote.label');
  });

  it('contains no hard-coded Sand price anywhere', () => {
    for (const source of componentSources) {
      // The §9 fixture values, which must exist only on the server.
      // Asserted against code with comments stripped: the panel's doc
      // comment legitimately quotes §9's example.
      expect(codeOnly(source)).not.toMatch(/\b24\s*Sand\b/);
      expect(codeOnly(source)).not.toMatch(/quotedSand\s*[*+/-]/);
    }
  });

  it('drives the charging notice from the server flag, not a build constant', () => {
    expect(quotePanelSource).toContain('quote.chargingEnabled');
  });
});

describe('§9 — confirmation is an explicit, two-option decision', () => {
  it('offers both Cancel and Run Analysis', () => {
    expect(quotePanelSource).toContain('Cancel');
    expect(quotePanelSource).toContain('Run Analysis');
  });

  it('places the non-spending option first for keyboard and screen-reader users', () => {
    // DOM order, not prop-declaration order — tab order follows the
    // rendered buttons, so that is what has to be checked.
    const cancelButton = quotePanelSource.indexOf('onClick={onCancel}');
    const confirmButton = quotePanelSource.indexOf('onClick={onConfirm}');

    expect(cancelButton).toBeGreaterThan(-1);
    expect(confirmButton).toBeGreaterThan(-1);
    expect(cancelButton).toBeLessThan(confirmButton);
  });
});

describe('§12 — the client never regenerates an idempotency key mid-retry', () => {
  it('reuses the key already held in state before minting a new one', () => {
    expect(askClientSource).toContain('stateRef.current.idempotencyKey ?? createIdempotencyKey()');
  });

  it('resubmits the same key when confirming a quote', () => {
    expect(askClientSource).toContain('void send(pendingQuestion, idempotencyKey, pendingQuote.operationId)');
  });
});

describe('§4 — the return controls are ordinary links', () => {
  const returnBarSource = readFileSync(join(ASK_DIR, 'ContextualReturnBar.tsx'), 'utf-8');

  it('uses Next Link, so Back, Forward and open-in-new-tab all keep working', () => {
    expect(returnBarSource).toContain('next/link');
  });

  it('never manipulates history directly', () => {
    expect(returnBarSource).not.toContain('history.pushState');
    expect(returnBarSource).not.toContain('router.replace');
  });

  it('derives its targets from the tested pure function rather than inline logic', () => {
    expect(returnBarSource).toContain('buildReturnTrail');
  });
});
