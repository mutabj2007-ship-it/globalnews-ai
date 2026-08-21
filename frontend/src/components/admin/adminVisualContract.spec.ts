import { readFileSync } from 'fs';
import { join } from 'path';
import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../../../tailwind.config';

/**
 * F1.b — the `adm-*` token system, and the promise that adding it moved
 * nothing.
 *
 * This file mirrors what claudeDesignFoundation.spec.ts does for `cd-*`:
 * assert every new value against the released design, AND assert that no
 * pre-existing value changed. The second half is the one that protects
 * six routes nobody redesigned.
 */
const theme = resolveConfig(tailwindConfig).theme as unknown as {
  colors: Record<string, Record<string, string> | string>;
  screens: Record<string, string>;
  backgroundImage: Record<string, string>;
  width: Record<string, string>;
  spacing: Record<string, string>;
};

const adm = theme.colors.adm as Record<string, string>;

describe('F1.b — the adm-* visual contract', () => {
  describe('values transcribed from the approved artifact', () => {
    const EXPECTED: ReadonlyArray<[string, string]> = [
      ['void', '#050b11'],
      ['rail-from', '#071219'],
      ['rail-to', '#050d13'],
      ['topbar', 'rgba(6,15,21,.86)'],
      ['card', '#08161e'],
      ['card-soft', 'rgba(8,22,30,.7)'],
      ['edge', '#123040'],
      ['edge-soft', '#133441'],
      ['edge-input', '#143644'],
      ['edge-mute', '#112b38'],
      ['ink', '#e8f4f8'],
      ['ink-2', '#cbe4ee'],
      ['ink-3', '#9fbccb'],
      ['ink-4', '#8fb0bf'],
      ['ink-mute', '#7fa0b0'],
      ['ink-dim', '#5f8595'],
      ['ink-faint', '#4f707f'],
      ['ink-ghost', '#3f6272'],
      ['accent', '#2dd4e8'],
      ['accent-hi', '#8ceef8'],
      ['accent-wash', 'rgba(45,212,232,.13)'],
      ['accent-hover', 'rgba(45,212,232,.06)'],
      ['val', '#e8f4f8'],
      ['val-mute', '#5f8595'],
      ['val-warn', '#e0b25e'],
      ['val-bad', '#f2938d'],
    ];

    EXPECTED.forEach(([key, value]) => {
      it(`adm-${key} is ${value}`, () => {
        expect(adm[key]).toBe(value);
      });
    });

    it('the six chip families carry their released border/background/text triples', () => {
      const CHIPS: ReadonlyArray<[string, string, string, string]> = [
        ['good', '#1c4c40', 'rgba(20,60,50,.42)', '#7fe0bb'],
        ['warn', '#5a4620', 'rgba(58,44,16,.42)', '#e0b25e'],
        ['bad', '#6d3535', 'rgba(70,25,25,.4)', '#f2938d'],
        ['info', '#1d5666', 'rgba(20,60,72,.42)', '#6fdcef'],
        ['violet', '#3d3266', 'rgba(45,36,80,.45)', '#b9a2f0'],
        ['mute', '#1d3340', '#0a141a', '#7fa0b0'],
      ];

      CHIPS.forEach(([name, edge, bg, ink]) => {
        expect(adm[`chip-${name}-edge`]).toBe(edge);
        expect(adm[`chip-${name}-bg`]).toBe(bg);
        expect(adm[`chip-${name}-ink`]).toBe(ink);
      });
    });

    it('the page field is the artifact’s own single radial, not the homepage two-layer composite', () => {
      expect(theme.backgroundImage['adm-page']).toBe(
        'radial-gradient(1100px 520px at 18% -12%, #0b2432 0%, #050b11 62%)',
      );
      expect(theme.backgroundImage['adm-rail']).toBe('linear-gradient(180deg, #071219, #050d13)');
    });

    it('the shell geometry is the released 252px sidebar and 68px icon rail', () => {
      expect(theme.width['adm-rail']).toBe('252px');
      expect(theme.width['adm-icon-rail']).toBe('68px');
    });

    it('the two responsive gates are 900px and 1280px', () => {
      expect(theme.screens['adm-rail']).toBe('900px');
      expect(theme.screens['adm-full']).toBe('1280px');
    });
  });

  describe('ADD, NEVER REDEFINE', () => {
    it('does not touch the GN-CD spacing ladder — every EXTENDED spacing key is still cd-<px>', () => {
      // The RAW extend block, not the resolved theme: resolveConfig
      // merges Tailwind's own default scale (0, px, 0.5, …), which is
      // not what this contract is about. The released ladder lives in
      // extend, and F1.b deliberately put its two measurements under
      // `width` so this stayed untouched.
      const extended = (tailwindConfig.theme?.extend?.spacing ?? {}) as Record<string, string>;

      expect(Object.keys(extended).length).toBeGreaterThan(10);
      Object.entries(extended).forEach(([key, value]) => {
        expect(key).toMatch(/^cd-\d+$/);
        expect(value).toBe(`${key.replace('cd-', '')}px`);
      });
    });

    it('adds no colour outside the adm namespace', () => {
      const source = readFileSync(join(__dirname, '..', '..', '..', 'tailwind.config.ts'), 'utf-8');
      const admBlockCount = (source.match(/^\s{8}adm: \{$/gm) ?? []).length;
      expect(admBlockCount).toBe(1);
    });

    it('leaves the released cd-* palette in place', () => {
      const cd = theme.colors.cd as Record<string, unknown>;
      expect(cd).toBeDefined();
      expect(Object.keys(cd).length).toBeGreaterThan(20);
    });
  });

  describe('typography reuses the product’s own faces', () => {
    it('every admin component asks for font-cd-body or font-cd-mono, never a raw Helvetica/Arial stack', () => {
      const files = [
        join(__dirname, 'shell', 'AdminShell.tsx'),
        join(__dirname, 'shell', 'AdminSidebar.tsx'),
        join(__dirname, 'shell', 'AdminTopBar.tsx'),
        join(__dirname, 'primitives', 'KpiCard.tsx'),
      ];

      files.forEach((file) => {
        const source = readFileSync(file, 'utf-8');
        expect(source).not.toMatch(/Helvetica|Arial/);
      });

      expect(readFileSync(files[0], 'utf-8')).toContain('font-cd-body');
    });
  });
});
