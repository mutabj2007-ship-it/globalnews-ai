import { readFileSync } from 'fs';
import { join } from 'path';

const worldVisualSource = readFileSync(join(__dirname, 'HeroWorldVisual.tsx'), 'utf-8');
const cardSource = readFileSync(join(__dirname, 'IntelligenceModuleCard.tsx'), 'utf-8');
const interactiveSource = readFileSync(join(__dirname, 'IntelligenceEngineInteractive.tsx'), 'utf-8');

/**
 * CTO reference-locked correction — these fixes were made after
 * direct comparison against REAL browser screenshots (not source
 * inspection alone), which showed the world visual rendering far
 * fainter than intended, module cards far taller than the reference,
 * and excessive dead space around the Intelligence Engine. This test
 * file protects those specific, evidence-based corrections from
 * silently regressing back to the pre-screenshot values.
 *
 * This does NOT constitute visual acceptance — these are structural
 * regression guards for values concretely identified as wrong from
 * real rendered evidence, nothing more.
 */
describe('World visual brightness (corrected from real-screenshot evidence)', () => {
  it('country outlines are fully opaque with a heavier stroke, not the earlier barely-visible 0.85 opacity', () => {
    expect(worldVisualSource).toMatch(/strokeWidth="1\.1" fill="#0e7490" fillOpacity="0\.18" opacity="1"/);
  });

  it('the dot-matrix texture is bright enough to actually be visible (0.35, up from an invisible 0.15)', () => {
    expect(worldVisualSource).toMatch(/fill="#22d3ee" opacity="0\.35"/);
  });

  it('the central atmospheric glow is strong enough to read as intentional depth (0.38, up from 0.24)', () => {
    expect(worldVisualSource).toMatch(/rgba\(34,211,238,0\.38\)/);
  });

  it('ambient node halos are visible (0.25, up from a near-invisible 0.12)', () => {
    expect(worldVisualSource).toMatch(/opacity="0\.25" \/>/);
  });
});

describe('Module card compactness (corrected from real-screenshot evidence)', () => {
  it('card minimum height is 190px, not the earlier much-too-tall 260px', () => {
    expect(cardSource).toMatch(/min-h-\[190px\]/);
  });

  it('description clamps to 2 lines, not 3, for a more compact body', () => {
    expect(cardSource).toMatch(/line-clamp-2 text-xs leading-relaxed text-ink-tertiary/);
  });
});

describe('Intelligence Engine density (corrected from real-screenshot evidence)', () => {
  it('the hub is 176px, not the earlier oversized 208px that contributed to excess dead space', () => {
    expect(interactiveSource).toMatch(/h-44 w-44/);
    expect(interactiveSource).toMatch(/gna-hub-core/);
  });
});
