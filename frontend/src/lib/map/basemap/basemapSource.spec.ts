import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BASEMAP_LAYER_BANDS,
  basemapIsConfigured,
  isUsableStyleUrl,
  mayDrawOver,
  readBasemapConfiguration,
} from './basemapSource';

const source = readFileSync(join(__dirname, 'basemapSource.ts'), 'utf8');

describe('the fallback is the DEFAULT, not the error path', () => {
  it('an unconfigured deployment reaches no provider at all', () => {
    expect(basemapIsConfigured(readBasemapConfiguration({}))).toBe(false);
  });

  it('an UNSET NEXT_PUBLIC_ variable inlines as the empty string, and that is absence', () => {
    /*
      This is the trap that produced same-origin relative API URLs earlier in
      this programme: Next inlines an unset NEXT_PUBLIC_* as '' rather than
      undefined, so `?? fallback` never fires. Asserted, not commented.
    */
    const config = readBasemapConfiguration({
      NEXT_PUBLIC_BASEMAP_STYLE_URL: '',
      NEXT_PUBLIC_BASEMAP_ATTRIBUTION: '   ',
    });
    expect(config.styleUrl).toBeNull();
    expect(config.attribution).toBeNull();
  });

  it('a malformed or non-HTTPS style URL is refused rather than half-trusted', () => {
    expect(isUsableStyleUrl('http://tiles.example/style.json')).toBe(false);
    expect(isUsableStyleUrl('not a url')).toBe(false);
    expect(isUsableStyleUrl('//tiles.example/style.json')).toBe(false);
    expect(isUsableStyleUrl('https://tiles.example/style.json')).toBe(true);
  });

  it('a configured provider is used, and its attribution is carried verbatim', () => {
    const config = readBasemapConfiguration({
      NEXT_PUBLIC_BASEMAP_STYLE_URL: 'https://tiles.example/style.json',
      NEXT_PUBLIC_BASEMAP_ATTRIBUTION: '© Example',
    });
    expect(basemapIsConfigured(config)).toBe(true);
    expect(config.attribution).toBe('© Example');
  });

  it('attribution is never invented for a provider that supplied none', () => {
    const config = readBasemapConfiguration({
      NEXT_PUBLIC_BASEMAP_STYLE_URL: 'https://tiles.example/style.json',
    });
    expect(config.attribution).toBeNull();
  });
});

describe('no vendor may enter core code — the ruling is asserted against the source text', () => {
  /*
    "No vendor-specific product contract in core code." A test that only checked
    behaviour would pass on a file with a hard-coded vendor default, so this
    reads the file.
  */
  const VENDORS = ['mapbox', 'maptiler', 'carto', 'stadia', 'protomaps', 'openstreetmap', 'osm', 'esri', 'google'];

  it.each(VENDORS)('the boundary names no provider: %s', (vendor) => {
    expect(source.toLowerCase().includes(vendor)).toBe(false);
  });

  it('it carries no tile template and no token parameter', () => {
    expect(source).not.toMatch(/\{z\}|\{x\}|\{y\}/);
    expect(source).not.toMatch(/access_token|api_key|apiKey|\?key=/);
  });
});

describe('layer order — ruling 3', () => {
  it('is basemap, then halo, then evidence, then labels/HUD', () => {
    expect([...BASEMAP_LAYER_BANDS]).toEqual(['basemap', 'halo', 'evidence', 'labels-hud']);
  });

  it('the halo draws over the basemap — which is what ruling 3 settled', () => {
    expect(mayDrawOver('halo', 'basemap')).toBe(true);
  });

  it('the halo NEVER draws over the evidence it qualifies', () => {
    /* A precision halo occluding its own evidence would invert the thing it
       exists to say. */
    expect(mayDrawOver('halo', 'evidence')).toBe(false);
    expect(mayDrawOver('evidence', 'halo')).toBe(true);
  });

  it('labels and HUD sit above everything, and nothing sits above them', () => {
    for (const band of BASEMAP_LAYER_BANDS) {
      if (band === 'labels-hud') continue;
      expect(mayDrawOver('labels-hud', band)).toBe(true);
      expect(mayDrawOver(band, 'labels-hud')).toBe(false);
    }
  });
});
