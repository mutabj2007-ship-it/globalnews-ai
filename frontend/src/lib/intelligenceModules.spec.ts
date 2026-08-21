import { INTELLIGENCE_MODULES, isModuleNavigable } from './intelligenceModules';

describe('INTELLIGENCE_MODULES (Master Frontend Recomposition, Checkpoint 1)', () => {
  it('contains exactly the 9 approved modules', () => {
    expect(INTELLIGENCE_MODULES).toHaveLength(9);
  });

  it('every module id is unique — this is the single canonical list', () => {
    const ids = INTELLIGENCE_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exactly the CTO-approved 4 modules are active', () => {
    const activeIds = INTELLIGENCE_MODULES.filter((m) => m.state === 'active')
      .map((m) => m.id)
      .sort();
    expect(activeIds).toEqual(['ai-research', 'country-intelligence', 'evidence', 'world-intelligence'].sort());
  });

  it('exactly the CTO-approved 2 modules are preview', () => {
    const previewIds = INTELLIGENCE_MODULES.filter((m) => m.state === 'preview')
      .map((m) => m.id)
      .sort();
    expect(previewIds).toEqual(['conflict', 'economy'].sort());
  });

  it('exactly the CTO-approved 3 modules are comingSoon', () => {
    const comingSoonIds = INTELLIGENCE_MODULES.filter((m) => m.state === 'comingSoon')
      .map((m) => m.id)
      .sort();
    expect(comingSoonIds).toEqual(['forecast', 'market', 'timeline'].sort());
  });

  it('no preview or comingSoon module has a destination — no fake navigation', () => {
    for (const moduleConfig of INTELLIGENCE_MODULES) {
      if (moduleConfig.state !== 'active') {
        expect(moduleConfig.destination).toBeUndefined();
      }
    }
  });

  it('every destination that IS set points to a real, existing surface', () => {
    // M66 — the hash entry is an anchor that already exists in
    // GlobalDevelopments.tsx, reached by the same in-page pattern
    // MobileBottomNav already ships. Still no fabricated destination.
    const realRoutes = ['/search', '/map', '/#global-developments-heading'];
    for (const moduleConfig of INTELLIGENCE_MODULES) {
      if (moduleConfig.destination) {
        expect(realRoutes).toContain(moduleConfig.destination);
      }
    }
  });

  it('isModuleNavigable is true only for active modules with a real destination', () => {
    for (const moduleConfig of INTELLIGENCE_MODULES) {
      const navigable = isModuleNavigable(moduleConfig);
      expect(navigable).toBe(moduleConfig.state === 'active' && Boolean(moduleConfig.destination));
    }
  });

  it('Country Intelligence routes to the real /map page', () => {
    expect(INTELLIGENCE_MODULES.find((m) => m.id === 'country-intelligence')?.destination).toBe('/map');
  });

  it('AI Research Assistant and Evidence & Source Comparison both route to the real /search page', () => {
    expect(INTELLIGENCE_MODULES.find((m) => m.id === 'ai-research')?.destination).toBe('/search');
    expect(INTELLIGENCE_MODULES.find((m) => m.id === 'evidence')?.destination).toBe('/search');
  });

  /*
    M66 — CTO decision D-6 A is SUPERSEDED by 'ACTIVE means actionable'.
    World Intelligence still IS the homepage feed rather than a page; what
    changed is that the feed's own section anchor was always a real
    destination, so the card no longer has to be inert to stay honest.
  */
  it('World Intelligence is active AND actionable, pointing at the homepage feed it represents', () => {
    const worldIntelligence = INTELLIGENCE_MODULES.find((m) => m.id === 'world-intelligence');
    expect(worldIntelligence?.state).toBe('active');
    expect(worldIntelligence?.destination).toBe('/#global-developments-heading');
  });

  it('M65.1 — every module carries a unique two-letter identifier, matching the approved Claude Design reference', () => {
    const codes = INTELLIGENCE_MODULES.map((m) => m.code);
    expect(codes).toHaveLength(9);
    expect(new Set(codes).size).toBe(9);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
    expect(INTELLIGENCE_MODULES.map((m) => `${m.id}:${m.code}`)).toEqual([
      'ai-research:AI',
      'world-intelligence:WD',
      'country-intelligence:CO',
      'evidence:EV',
      'economy:EC',
      'conflict:CF',
      'market:MK',
      'timeline:TL',
      'forecast:FC',
    ]);
  });

  it('M65.1 — adding the identifier changed no capability truth: ids, states and destinations are untouched', () => {
    expect(INTELLIGENCE_MODULES.map((m) => `${m.id}:${m.state}:${m.destination ?? '-'}`)).toEqual([
      'ai-research:active:/search',
      'world-intelligence:active:/#global-developments-heading',
      'country-intelligence:active:/map',
      'evidence:active:/search',
      'economy:preview:-',
      'conflict:preview:-',
      'market:comingSoon:-',
      'timeline:comingSoon:-',
      'forecast:comingSoon:-',
    ]);
  });

  it('every module has a dictionaryKey — no hardcoded English title/description in the config itself', () => {
    for (const moduleConfig of INTELLIGENCE_MODULES) {
      expect(moduleConfig.dictionaryKey.length).toBeGreaterThan(0);
    }
  });
});
