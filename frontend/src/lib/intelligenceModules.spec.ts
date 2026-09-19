import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INTELLIGENCE_MODULES, isModuleNavigable } from './intelligenceModules';

describe('INTELLIGENCE_MODULES (Master Frontend Recomposition, Checkpoint 1)', () => {
  it('contains exactly the 9 approved modules', () => {
    expect(INTELLIGENCE_MODULES).toHaveLength(9);
  });

  it('every module id is unique — this is the single canonical list', () => {
    const ids = INTELLIGENCE_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /*
    ══ FINAL-9-MODULE-ENGINE-CONVERGENCE-R1 ═══════════════════════════════════

    The nine are now the specialist dashboard family. The four stale headings
    left their slots and four specialist modules took them, per the Product
    Owner's §4 mapping:

      AI Research Assistant        -> Security Intelligence
      Evidence & Source Comparison -> Politics Intelligence
      Timeline Intelligence        -> Humanitarian Intelligence
      Forecast & Watchlist         -> Energy Intelligence

    The state census moved with them, and every movement is toward the truth:
    a badge is now derived from whether a surface is OPEN, not from whether a
    card exists. Two modules are ACTIVE because two surfaces are open — `/map`
    and the homepage feed anchor. Six have an approved surface whose route is
    prepared and deliberately not opened. One has no surface at all.
  */
  /*
    ── R2 · ROUTE AND STATE CORRECTION ─────────────────────────────────────

    World left ACTIVE by ruling: `MAIN-WORLD-INTELLIGENCE-CANONICAL-FOUNDATION-R1`
    makes it a SURFACE distinct from Home, Map and Country, and R1's destination
    was Home's own anchor. One working product surface remains.

    And PREVIEW is no longer inert — R2 §11: *"PREVIEW MAY BE CLICKABLE."* Five
    cards now open, each onto a route that exists in the converged worktree.
  */
  it('exactly one module is active — the one working product surface', () => {
    const activeIds = INTELLIGENCE_MODULES.filter((m) => m.state === 'active')
      .map((m) => m.id)
      .sort();
    expect(activeIds).toEqual(['country-intelligence']);
  });

  it('six modules are preview', () => {
    const previewIds = INTELLIGENCE_MODULES.filter((m) => m.state === 'preview')
      .map((m) => m.id)
      .sort();
    expect(previewIds).toEqual(
      ['conflict', 'economy', 'humanitarian', 'market', 'politics', 'security'],
    );
  });

  it('two modules are comingSoon — the two with no surface of any kind', () => {
    const comingSoonIds = INTELLIGENCE_MODULES.filter((m) => m.state === 'comingSoon')
      .map((m) => m.id)
      .sort();
    expect(comingSoonIds).toEqual(['energy', 'world-intelligence']);
  });

  /*
    THE THREE INERT CARDS, AND THE REASON EACH IS INERT — stated so that making
    one clickable requires changing a sentence, not just a field.

      world-intelligence   its surface is not designed yet
      energy               its surface is not designed yet
      conflict             no deterministic entry distinct from the generic /map

    POLITICS LEFT THIS LIST, AND THE SENTENCE IS WHY. Its reason read *"its
    routes are ABSENT from the converged worktree"* — a MEASUREMENT, and the
    only one of the four that a package could answer.
    `H-POLITICS-ALPHA-VISUAL-CONVERGENCE-R2` answered it: both routes are
    present and `no fake navigation` below re-measures them on disk.

    The other three reasons are unchanged and unanswered, so the three cards
    stay inert. That is the discipline this list exists for — a card becomes
    clickable when its stated reason stops being true, and not before.
  */
  it('three cards are inert, and none of them names a destination', () => {
    const inert = INTELLIGENCE_MODULES.filter((m) => !isModuleNavigable(m)).map((m) => m.id).sort();
    expect(inert).toEqual(['conflict', 'energy', 'world-intelligence']);
    for (const moduleConfig of INTELLIGENCE_MODULES) {
      if (!isModuleNavigable(moduleConfig)) expect(moduleConfig.destination).toBeUndefined();
    }
    /*
      AND THE RETIREMENT IS ASSERTED, NOT ASSUMED: Politics is navigable now,
      which is the fact that removed it from the list above. If it ever silently
      lost its destination, this fails rather than the list quietly shrinking.
    */
    const politics = INTELLIGENCE_MODULES.find((m) => m.id === 'politics');
    expect(`politics navigable: ${isModuleNavigable(politics!)}`).toBe('politics navigable: true');
    expect(politics?.destination).toBe('/politics-visual-preview');
  });

  it('the nine ARE the specialist family, and no stale heading survives', () => {
    expect(INTELLIGENCE_MODULES.map((m) => m.id).sort()).toEqual([
      'conflict', 'country-intelligence', 'economy', 'energy', 'humanitarian',
      'market', 'politics', 'security', 'world-intelligence',
    ]);
  });

  /*
    R2 §11 — a PREVIEW module MAY carry a destination. What must never happen is
    a destination that goes nowhere, so the rule moves from the BADGE to the
    ROUTE: every destination names a directory that exists on disk.
  */
  it('no fake navigation — every destination is a route that exists', () => {
    const APP = join(__dirname, '..', 'app');
    for (const moduleConfig of INTELLIGENCE_MODULES) {
      if (moduleConfig.state === 'comingSoon') {
        expect(moduleConfig.destination).toBeUndefined();
        continue;
      }
      if (moduleConfig.destination === undefined) continue;
      const dir = moduleConfig.destination.replace(/^\//, '');
      expect(`${moduleConfig.id} -> ${dir}: ${existsSync(join(APP, dir, 'page.tsx'))}`)
        .toBe(`${moduleConfig.id} -> ${dir}: true`);
    }
  });

  it('every destination that IS set points to a real, existing surface', () => {
    // M66 — the hash entry is an anchor that already exists in
    // GlobalDevelopments.tsx, reached by the same in-page pattern
    // MobileBottomNav already ships. Still no fabricated destination.
    /*
      `/search` is no longer among them. §8 names the pattern it left behind —
      *"cards pointing to obsolete generic /search destinations merely because
      that was the old architecture"* — and removing it from this list is what
      makes a return fail here rather than pass quietly.
    */
    const realRoutes = [
      '/map', '/market', '/humanitarian',
      '/security-visual-preview', '/economy-visual-preview',
      /*
        `/politics-visual-preview` — the PREVIEW address, and deliberately not
        `/politics`, which stays 404 and unactivated. Listing the preview here
        rather than the product route is the whole point of the allow-list: if
        the card were ever repointed at the governed route, it would not be in
        this list and this test would fail.
      */
      '/politics-visual-preview',
    ];
    for (const moduleConfig of INTELLIGENCE_MODULES) {
      if (moduleConfig.destination) {
        expect(realRoutes).toContain(moduleConfig.destination);
      }
    }
  });

  it('isModuleNavigable is true only when the product has a surface AND names it', () => {
    for (const moduleConfig of INTELLIGENCE_MODULES) {
      const navigable = isModuleNavigable(moduleConfig);
      expect(navigable).toBe(moduleConfig.state !== 'comingSoon' && Boolean(moduleConfig.destination));
    }
  });

  it('Country Intelligence reuses the existing map architecture — §13, no second dashboard', () => {
    expect(INTELLIGENCE_MODULES.find((m) => m.id === 'country-intelligence')?.destination).toBe('/map');
  });

  /*
    THIS TEST PINNED THE TWO CARDS THAT POINTED AT `/search`. Both left the
    Engine, so it is REPLACED by its own inverse rather than deleted: the thing
    worth asserting now is that the specialist family does not reach for a
    generic analysis entry when a module has no route of its own.
  */
  it('no specialist card borrows the generic /search entry', () => {
    for (const moduleConfig of INTELLIGENCE_MODULES) {
      expect(`${moduleConfig.id}: ${moduleConfig.destination ?? '-'}`)
        .not.toBe(`${moduleConfig.id}: /search`);
    }
  });

  it('and Ask AI is still reachable — the capability did not leave with the card', () => {
    /*
      §9. The route still exists and still serves the question-specific Analysis
      experience; what ended is its occupancy of a specialist-dashboard slot.
    */
    expect(existsSync(join(__dirname, '..', 'app', 'search', 'page.tsx'))).toBe(true);
    expect(readFileSync(join(__dirname, '..', 'app', 'layout.tsx'), 'utf-8')).toContain('AskAiDock');
  });

  /*
    M66 — CTO decision D-6 A is SUPERSEDED by 'ACTIVE means actionable'.
    World Intelligence still IS the homepage feed rather than a page; what
    changed is that the feed's own section anchor was always a real
    destination, so the card no longer has to be inert to stay honest.
  */
  /*
    ── R2 §1 · WORLD IS A SURFACE, AND IT DOES NOT EXIST YET ────────────────

    D-6 A left World ACTIVE but inert. M66 superseded it — "ACTIVE means
    actionable" — and pointed the card at the homepage section it described.
    `MAIN-WORLD-INTELLIGENCE-CANONICAL-FOUNDATION-R1` now rules World a SURFACE
    distinct from Home/Public Today, Map and Country, which makes that anchor a
    destination it may no longer hold.

    The invariant under all three revisions, and the one asserted here: badge
    and destination must agree, and neither is chosen to flatter the other.
    §1's two halves are both checked — the card is NOT removed, and it is NOT
    routed to Home to make it clickable.
  */
  it('World Intelligence is COMING SOON, keeps its card, and is not routed to Home', () => {
    const worldIntelligence = INTELLIGENCE_MODULES.find((m) => m.id === 'world-intelligence');
    expect(worldIntelligence).toBeDefined();
    expect(worldIntelligence?.state).toBe('comingSoon');
    expect(worldIntelligence?.destination).toBeUndefined();
    expect(isModuleNavigable(worldIntelligence!)).toBe(false);
    for (const moduleConfig of INTELLIGENCE_MODULES) {
      expect(moduleConfig.destination ?? '-').not.toContain('#');
    }
  });

  it('M65.1 — every module carries a unique two-letter identifier, matching the approved Claude Design reference', () => {
    const codes = INTELLIGENCE_MODULES.map((m) => m.code);
    expect(codes).toHaveLength(9);
    expect(new Set(codes).size).toBe(9);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
    expect(INTELLIGENCE_MODULES.map((m) => `${m.id}:${m.code}`)).toEqual([
      'security:SE',
      'world-intelligence:WD',
      'country-intelligence:CO',
      'politics:PO',
      'economy:EC',
      'conflict:CF',
      'market:MK',
      'humanitarian:HU',
      'energy:EN',
    ]);
  });

  /*
    THE WHOLE CONFIGURATION IN ONE ASSERTION — the Product Owner's §19 matrix,
    executable. Array ORDER is the slot order, so this also pins that no card
    moved position during the convergence.
  */
  it('the full nine-row truth: slot order, identity, state and destination', () => {
    expect(INTELLIGENCE_MODULES.map((m) => `${m.id}:${m.state}:${m.destination ?? '-'}`)).toEqual([
      'security:preview:/security-visual-preview',
      'world-intelligence:comingSoon:-',
      'country-intelligence:active:/map',
      'politics:preview:/politics-visual-preview',
      'economy:preview:/economy-visual-preview',
      'conflict:preview:-',
      'market:preview:/market',
      'humanitarian:preview:/humanitarian',
      'energy:comingSoon:-',
    ]);
  });

  /*
    THE TOTALS ARE DERIVED FROM THE MATRIX ABOVE, never asserted independently —
    R2 §12: *"Do not preserve R1's 2 ACTIVE / 2 CLICKABLE count merely because it
    was previously measured. The count must follow the corrected reality."*
  */
  it('the totals follow the matrix: 1 active, 6 preview, 2 coming soon, 6 clickable', () => {
    /*
      CLICKABLE MOVED 5 -> 6, AND NOTHING ELSE DID. Landing the Politics package
      gave an existing PREVIEW card a destination; it did not add a module,
      change a badge, or open a product route. So the state census is untouched
      and only the derived clickable count follows — which is exactly the shape
      R2 §12 asks for: the count follows the corrected reality rather than being
      preserved because it was previously measured.
    */
    const by = (state: string): number => INTELLIGENCE_MODULES.filter((m) => m.state === state).length;
    expect({
      active: by('active'),
      preview: by('preview'),
      comingSoon: by('comingSoon'),
      clickable: INTELLIGENCE_MODULES.filter(isModuleNavigable).length,
      total: INTELLIGENCE_MODULES.length,
    }).toEqual({ active: 1, preview: 6, comingSoon: 2, clickable: 6, total: 9 });
  });

  it('every module has a dictionaryKey — no hardcoded English title/description in the config itself', () => {
    for (const moduleConfig of INTELLIGENCE_MODULES) {
      expect(moduleConfig.dictionaryKey.length).toBeGreaterThan(0);
    }
  });
});
