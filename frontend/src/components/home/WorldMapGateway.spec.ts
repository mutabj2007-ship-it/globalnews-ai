import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'WorldMapGateway.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('WorldMapGateway (Milestone #51) — MapLibre isolation', () => {
  /**
   * This is the permanent regression guard the CTO explicitly
   * requested: it cannot prove bundle SIZE (Jest has no bundler), but
   * it CAN and does prove the source code contains no import coupling
   * to the heavy map stack — which is the actual mechanism that would
   * leak MapLibre into the homepage bundle. If any future edit adds
   * one of these imports, this test fails immediately.
   */
  it('never imports maplibre-gl', () => {
    expect(stripComments(source)).not.toMatch(/from ['"]maplibre-gl['"]/);
    expect(stripComments(source)).not.toMatch(/require\(['"]maplibre-gl['"]\)/);
  });

  it('never imports WorldMap.tsx or anything from components/map/', () => {
    expect(stripComments(source)).not.toMatch(/from ['"]@\/components\/map\//);
    // Checks for an actual import specifier or JSX usage of the real
    // WorldMap component specifically — not a naive substring match,
    // since this file's OWN name (WorldMapGateway) legitimately
    // contains "WorldMap" as a substring.
    expect(stripComments(source)).not.toMatch(/\bimport\s*\{[^}]*\bWorldMap\b[^}]*\}/);
    expect(stripComments(source)).not.toMatch(/<WorldMap\b/);
  });

  it('never uses next/dynamic (the mechanism the real /map page uses to isolate MapLibre)', () => {
    expect(stripComments(source)).not.toMatch(/next\/dynamic/);
  });

  it('is a Server Component — no "use client" directive, no interactive map JS needed', () => {
    expect(source.trimStart().startsWith("'use client'")).toBe(false);
  });
});

describe('WorldMapGateway — data source and country identity', () => {
  it('reuses the shared COUNTRIES list — no second, independently-maintained country dataset', () => {
    expect(source).toMatch(/import\s*\{[^}]*COUNTRIES[^}]*\}\s*from\s*['"]@globalnews-ai\/shared['"]/);
  });

  it('reuses the established getCountryDisplayName() localization helper — no new translation table', () => {
    expect(source).toMatch(/getCountryDisplayName/);
    expect(stripComments(source)).not.toMatch(/const\s+\w*(TRANSLATIONS|COUNTRY_NAMES)\w*\s*[:=]/i);
  });

  it('country links use the canonical iso3 code, not a localized display string, as the identity in the URL', () => {
    expect(source).toMatch(/\/map\?country=\$\{country\.iso3\}/);
  });

  it('makes zero backend fetch calls — pure presentation over static shared metadata', () => {
    expect(stripComments(source)).not.toMatch(/fetch\(/);
    expect(stripComments(source)).not.toMatch(/await /);
  });
});

describe('WorldMapGateway — localization and CTA', () => {
  it('renders the dictionary-driven CTA and heading, not hardcoded English', () => {
    expect(source).toMatch(/\{t\.cta\}/);
    expect(source).toMatch(/\{t\.headline\}/);
    expect(source).toMatch(/\{t\.description\}/);
  });

  it('CTA links to /map', () => {
    expect(source).toMatch(/href="\/map"/);
  });
});

describe('WorldMapGateway — animated visual integration (Milestone #51 browser-acceptance polish)', () => {
  it('renders WorldMapAnimatedVisual — the previous plain icon-only panel now communicates global discovery visually', () => {
    expect(source).toMatch(/<WorldMapAnimatedVisual/);
    expect(source).toMatch(/import \{ WorldMapAnimatedVisual \} from '@\/components\/home\/WorldMapAnimatedVisual'/);
  });

  it('the gateway itself remains a Server Component even with the visual embedded', () => {
    expect(source.trimStart().startsWith("'use client'")).toBe(false);
  });
});
