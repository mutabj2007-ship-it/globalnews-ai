import { HUD_PANEL_CLIP, HUD_CARD_CLIP, hudCornerBracketClassName } from './hudPanelGeometry';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('HUD panel geometry (CTO final visual directive — HUD line language)', () => {
  it('provides a genuine angled-corner clip-path, not a rounded-rectangle string', () => {
    expect(HUD_PANEL_CLIP).toMatch(/clip-path:polygon/);
    expect(HUD_CARD_CLIP).toMatch(/clip-path:polygon/);
  });

  it('corner bracket helper returns a distinct class for each of the four positions', () => {
    const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
    const results = positions.map(hudCornerBracketClassName);
    expect(new Set(results).size).toBe(4);
  });
});

describe('HUD panel geometry applied to real components (CTO final visual directive)', () => {
  it('the Hero world visual uses the angled-corner clip, not a plain rounded rectangle', () => {
    const source = readFileSync(join(__dirname, 'HeroWorldVisual.tsx'), 'utf-8');
    expect(source).toMatch(/HUD_PANEL_CLIP/);
  });

  it('module cards use the clipped-corner treatment', () => {
    const source = readFileSync(join(__dirname, 'IntelligenceModuleCard.tsx'), 'utf-8');
    expect(source).toMatch(/HUD_CARD_CLIP/);
  });

  it('the Trust panel uses the clipped-corner treatment', () => {
    const source = readFileSync(join(__dirname, 'TrustSection.tsx'), 'utf-8');
    expect(source).toMatch(/HUD_CARD_CLIP/);
  });

  it('the Situation Map deliberately does NOT clip its container — clipping would visually cut off real map content; corner brackets are the documented safe alternative there', () => {
    const source = readFileSync(join(__dirname, 'HomepageSituationMap.tsx'), 'utf-8');
    expect(source).not.toMatch(/HUD_PANEL_CLIP|HUD_CARD_CLIP/);
    expect(source).toMatch(/border-l border-t/);
  });
});
