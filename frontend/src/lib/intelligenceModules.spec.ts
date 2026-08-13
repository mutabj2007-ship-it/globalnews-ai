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

  it('every destination that IS set points to a real, existing route', () => {
    const realRoutes = ['/search', '/map'];
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

  it('World Intelligence is active but has no separate destination — it represents the homepage feed itself', () => {
    const worldIntelligence = INTELLIGENCE_MODULES.find((m) => m.id === 'world-intelligence');
    expect(worldIntelligence?.state).toBe('active');
    expect(worldIntelligence?.destination).toBeUndefined();
  });

  it('every module has a dictionaryKey — no hardcoded English title/description in the config itself', () => {
    for (const moduleConfig of INTELLIGENCE_MODULES) {
      expect(moduleConfig.dictionaryKey.length).toBeGreaterThan(0);
    }
  });
});
