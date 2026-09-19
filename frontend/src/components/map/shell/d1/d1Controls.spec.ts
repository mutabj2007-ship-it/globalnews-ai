import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GlobeLocator } from './GlobeLocator';
import { LayersControl } from './LayersControl';
import { MapControlCluster } from './MapControlCluster';
import { ThreeDControl } from './ThreeDControl';
import { LAYER_REGISTRY, railLayers } from '@/lib/map/layers/layerRegistry';
import { viewportRectFor, indicatorIsMeaningful } from '@/lib/map/d1/globeLocatorGeometry';

const render = (element: JSX.Element): string => renderToStaticMarkup(element);

const RWANDA = { west: 28.8, south: -2.9, east: 30.9, north: -1.0 };
const WORLD = { west: -180, south: -85, east: 180, north: 85 };

const LABELS = {
  title: 'Layers',
  layers: Object.fromEntries(LAYER_REGISTRY.map((l) => [l.id, l.id.toUpperCase()])),
  /* R2-B section 8. No zoom is passed here, so the note is never raised. */
  outOfScale: 'NOT AT THIS SCALE',
  status: {
    LIVE: 'LIVE',
    GATED: 'GATED',
    NOT_IMPLEMENTED: 'NOT IMPLEMENTED',
    FAILED_MEASUREMENT: 'UNMEASURED',
  },
};

describe('GLOBE LOCATOR — live camera, never an image', () => {
  it('draws no <img> and no background image anywhere', () => {
    /* "Production must render the globe locator from the live camera and world
       geography rather than from a fixed image." */
    const html = render(createElement(GlobeLocator, { bounds: RWANDA, label: 'Locator', homeLabel: 'Global view' }));
    expect(html).not.toMatch(/<img/);
    expect(html).not.toMatch(/background-image|url\(/);
  });

  it('the viewport indicator moves with the camera', () => {
    const a = render(createElement(GlobeLocator, { bounds: RWANDA, label: 'L', homeLabel: 'G' }));
    const b = render(createElement(GlobeLocator, {
      bounds: { west: -10, south: 40, east: 5, north: 52 }, label: 'L', homeLabel: 'G',
    }));
    const rect = (html: string): string =>
      html.slice(html.indexOf('data-gn="globe-locator-viewport"'), html.indexOf('data-gn="globe-locator-viewport"') + 160);
    expect(rect(a)).not.toBe(rect(b));
  });

  it('a whole-world camera suppresses the indicator — a box around everything is noise', () => {
    const html = render(createElement(GlobeLocator, { bounds: WORLD, label: 'L', homeLabel: 'G' }));
    expect(html).toMatch(/data-gn-indicator="suppressed"/);
    expect(html).not.toMatch(/data-gn="globe-locator-viewport"/);
  });

  it('IS NOT THE 3D TOGGLE, and says so in the markup', () => {
    const html = render(createElement(GlobeLocator, { bounds: RWANDA, label: 'L', homeLabel: 'G' }));
    expect(html).toMatch(/data-gn-is-3d-toggle="false"/);
    expect(html).not.toMatch(/aria-pressed/);
  });

  it('renders without any land geometry rather than inventing a picture of one', () => {
    const html = render(createElement(GlobeLocator, { bounds: RWANDA, label: 'L', homeLabel: 'G' }));
    expect(html).not.toMatch(/globe-locator-land/);
    expect(html).toMatch(/globe-locator-canvas/);
  });
});

describe('globe locator arithmetic', () => {
  it('an antimeridian-crossing camera becomes TWO rectangles, not one world-wide one', () => {
    const rect = viewportRectFor({ west: 160, south: -10, east: -160, north: 10 });
    expect(rect.wraps).toBe(true);
    expect(rect.width).toBeLessThan(0.2);
    expect(rect.wrapWidth).toBeLessThan(0.2);
  });

  it('a degenerate camera still has a visible indicator', () => {
    const rect = viewportRectFor({ west: 10, south: 10, east: 10, north: 10 });
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
  });

  it('a whole-world camera is not meaningful to indicate', () => {
    expect(indicatorIsMeaningful(viewportRectFor(WORLD))).toBe(false);
    expect(indicatorIsMeaningful(viewportRectFor(RWANDA))).toBe(true);
  });
});

describe('3D CONTROL — separate, and honest about being unavailable', () => {
  it('is marked as NOT the globe locator, so a merge fails from both sides', () => {
    const html = render(createElement(ThreeDControl, { enabled: false, available: true, label: '3D' }));
    expect(html).toMatch(/data-gn-is-globe-locator="false"/);
  });

  it('distinguishes OFF, which the reader chose, from UNAVAILABLE, which the product decided', () => {
    const off = render(createElement(ThreeDControl, { enabled: false, available: true, label: '3D' }));
    const unavailable = render(createElement(ThreeDControl, {
      enabled: false, available: false, unavailableReason: 'No terrain source configured', label: '3D',
    }));
    expect(off).toMatch(/data-gn-state="off"/);
    expect(off).toMatch(/aria-pressed="false"/);
    expect(unavailable).toMatch(/data-gn-state="unavailable"/);
    expect(unavailable).toMatch(/aria-disabled="true"/);
    expect(unavailable).not.toMatch(/aria-pressed/);
  });

  it('an unavailable control carries its reason in the ACCESSIBLE NAME, not only a tooltip', () => {
    const html = render(createElement(ThreeDControl, {
      enabled: false, available: false, unavailableReason: 'No terrain source configured', label: '3D',
    }));
    expect(html).toMatch(/aria-label="3D — No terrain source configured"/);
  });
});

describe('LAYERS CONTROL — truthful, ruling 5', () => {
  const html = render(createElement(LayersControl, { state: {}, labels: LABELS }));

  it('NO non-LIVE layer is toggleable — not one', () => {
    for (const layer of railLayers()) {
      const slice = html.slice(html.indexOf(`data-gn-layer="${layer.id}"`));
      const tag = slice.slice(0, slice.indexOf('>'));
      expect({ id: layer.id, toggleable: /data-gn-layer-toggleable="true"/.test(tag) })
        .toEqual({ id: layer.id, toggleable: layer.runtime === 'LIVE' });
    }
  });

  it('WATCH is present and NOT toggleable — it was the decorative toggle the ruling names', () => {
    expect(html).toMatch(/data-gn-layer="watch"[^>]*data-gn-layer-runtime="GATED"/);
    expect(html).toMatch(/data-gn-layer="watch"[^>]*data-gn-layer-toggleable="false"/);
  });

  it('a gated layer is SHOWN with its reason rather than hidden — absence would teach it does not exist', () => {
    expect(html).toMatch(/aria-label="SITUATIONS — GATED: [^"]+"/);
  });

  it('an enabled state on a non-LIVE layer cannot switch it on', () => {
    const forced = render(createElement(LayersControl, {
      state: { watch: true, situations: true }, labels: LABELS,
    }));
    expect(forced).not.toMatch(/data-gn-layer="watch"[^>]*aria-pressed/);
    expect(forced).toMatch(/data-gn-layer="watch"[^>]*disabled/);
  });
});

describe('THE LOWER-LEFT CLUSTER renders the contract order, and does not restate it', () => {
  const html = render(
    createElement(MapControlCluster, {
      label: 'Map controls',
      globeLocator: createElement(GlobeLocator, { bounds: RWANDA, label: 'L', homeLabel: 'G' }),
      layers: createElement(LayersControl, { state: {}, labels: LABELS }),
      threeD: createElement(ThreeDControl, { enabled: false, available: true, label: '3D' }),
    }),
  );

  it('is globe locator, then Layers, then 3D', () => {
    const order = [...html.matchAll(/data-gn-slot="([a-z-]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(['globe-locator', 'layers', 'three-d']);
  });

  it('skips a control the caller did not supply rather than leaving an empty slot', () => {
    const partial = render(
      createElement(MapControlCluster, {
        label: 'Map controls',
        globeLocator: createElement(GlobeLocator, { bounds: RWANDA, label: 'L', homeLabel: 'G' }),
      }),
    );
    const order = [...partial.matchAll(/data-gn-slot="([a-z-]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(['globe-locator']);
  });

  it('every control in it declares the lower-left cluster', () => {
    expect([...html.matchAll(/data-gn-cluster="([a-z-]+)"/g)].map((m) => m[1]))
      .toEqual(['lower-left', 'lower-left', 'lower-left', 'lower-left']);
  });
});
