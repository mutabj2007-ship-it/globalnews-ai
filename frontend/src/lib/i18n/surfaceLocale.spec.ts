import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DISPLAY_LOCALES, assertDocumentLanguageDescribesRenderedContent, directionFor } from '@globalnews-ai/shared';
import { namespaceIds, completeLocalesOf } from '@/qualification/i18n/catalogueCoverage';
import { SURFACE_NAMESPACES, blockingNamespaces, measuredSurfaceRenderable } from '@/qualification/i18n/surfaceCoverage';
import {
  SURFACES,
  effectiveWithin,
  renderableLocalesOf,
  resolveSurfaceLocale,
  surfaceIds,
} from './surfaceLocale';
import { FALLBACK_NOTICE } from './fallbackNotice';
import { surfaceForPathname } from './surfaceRoutes';

/**
 * T2 · the effective-locale rule, exhaustively over every surface × every display locale.
 */
const SRC = join(__dirname, '..', '..');

describe('T2 · effective-locale decision — every surface × every locale', () => {
  for (const surface of surfaceIds()) {
    for (const requested of DISPLAY_LOCALES) {
      it(`${surface} × ${requested}`, () => {
        const result = resolveSurfaceLocale(surface, requested);
        const renderable = renderableLocalesOf(surface);
        /* The selected locale renders iff every namespace the surface uses is complete for it. */
        const complete =
          requested === 'en' ||
          (SURFACE_NAMESPACES[surface].every((ns) => completeLocalesOf(ns).includes(requested)) &&
            (SURFACES[surface].expressible === 'DISPLAY_LOCALE' || !['de', 'pt'].includes(requested)));
        expect(renderable.includes(requested)).toBe(complete);
        expect(result.effective).toBe(complete ? requested : 'en');
        expect(result.fellBack).toBe(!complete);
        expect(result.requested).toBe(requested);
        /* <html lang>/<html dir> describe the EFFECTIVE locale — the shared contract's own assertion. */
        expect(() =>
          assertDocumentLanguageDescribesRenderedContent(result.document, {
            requestedDisplayLocale: requested,
            effectiveContentLocale: result.effective,
            fellBack: result.fellBack,
          }),
        ).not.toThrow();
        expect(result.dir).toBe(directionFor(result.effective));
        /* A fallback is DECLARED, in the selected language; a full render declares nothing. */
        if (complete) {
          expect(result.notice).toBeNull();
          expect(blockingNamespaces(surface, requested)).toEqual([]);
        } else {
          expect(result.notice).toEqual({ ...FALLBACK_NOTICE[requested], lang: requested, dir: directionFor(requested) });
        }
        /* LanguageCode-typed component trees are never handed de/pt. */
        if (SURFACES[surface].expressible === 'LANGUAGE_CODE') {
          expect(['de', 'pt']).not.toContain(result.effective);
          expect(result.language).toBe(result.effective);
        }
      });
    }
  }

  it('the GENERATED runtime table equals the live catalogue measurement (re-run the reconcile script)', () => {
    expect(Object.fromEntries(surfaceIds().map((id) => [id, renderableLocalesOf(id)]))).toEqual(measuredSurfaceRenderable());
  });

  it('English is always renderable and always first (the declared fallback)', () => {
    for (const surface of surfaceIds()) expect(renderableLocalesOf(surface)[0]).toBe('en');
  });

  it('every namespace a surface lists exists in the coverage registry', () => {
    const known = new Set(namespaceIds());
    for (const surface of surfaceIds()) {
      for (const ns of SURFACE_NAMESPACES[surface]) expect([surface, ns, known.has(ns)]).toEqual([surface, ns, true]);
    }
  });
});

describe('T2 · <html lang> / <html dir>, Arabic included', () => {
  it('Arabic on a surface complete in Arabic (Ask) → lang="ar" dir="rtl" on the WHOLE document', () => {
    const ask = resolveSurfaceLocale('askStandalone', 'ar');
    expect(ask.effective).toBe('ar');
    expect(ask.document).toEqual({ lang: 'ar', dir: 'rtl' });
    expect(ask.notice).toBeNull();
  });

  it('Arabic on a surface NOT complete in Arabic (Map) → lang="en" dir="ltr" + an Arabic, RTL notice', () => {
    const map = resolveSurfaceLocale('map', 'ar');
    expect(map.document).toEqual({ lang: 'en', dir: 'ltr' });
    expect(map.notice?.lang).toBe('ar');
    expect(map.notice?.dir).toBe('rtl');
    expect(map.notice?.notice).toBe(FALLBACK_NOTICE.ar.notice);
  });

  it('Polish keeps rendering Polish wherever every catalogue is Polish (no regression for PL)', () => {
    for (const surface of ['home', 'map', 'search', 'support', 'myIntelligence', 'privacy', 'terms', 'energy'] as const) {
      expect([surface, resolveSurfaceLocale(surface, 'pl').document]).toEqual([surface, { lang: 'pl', dir: 'ltr' }]);
    }
  });

  it('a surface whose catalogue is English-only declares the fallback even for Polish (Market, History)', () => {
    for (const surface of ['market', 'history', 'security'] as const) {
      const result = resolveSurfaceLocale(surface, 'pl');
      expect(result.effective).toBe('en');
      expect(result.notice?.lang).toBe('pl');
    }
  });

  it('the root layout sets lang AND dir from the effective surface decision', () => {
    const layout = readFileSync(join(SRC, 'app', 'layout.tsx'), 'utf8');
    expect(layout).toContain('const surface = documentSurfaceLocale();');
    expect(layout).toContain('<html lang={surface.document.lang} dir={surface.document.dir}');
    expect(layout).toContain('<DisplayLocaleNotice locale={surface} />');
    expect(layout).not.toMatch(/isActiveLanguageCode/);
  });
});

describe('T2 · the request path decides the surface (layout and page agree)', () => {
  it.each([
    ['/', true, 'askStandalone'],
    ['/', false, 'home'],
    /* COMPACT VISUAL PRODUCT R1 — the future Home preview is the Home surface. */
    ['/visual', false, 'home'],
    ['/ask', true, 'askStandalone'],
    ['/ask/recent', true, 'askRecent'],
    ['/saved/briefing', true, 'saved'],
    ['/map', false, 'map'],
    ['/map/', false, 'map'],
    ['/market/compact', false, 'market'],
    ['/humanitarian/compact', false, 'humanitarian'],
    ['/economy-visual-preview/compact', false, 'economy'],
    ['/account/settings', true, 'accountSettings'],
    ['/history', false, 'history'],
    ['/third-party-notices', false, 'thirdPartyNotices'],
    ['/nowhere', false, 'default'],
    [null, false, 'default'],
    [null, true, 'default'],
  ] as const)('%p (standalone=%p) → %s', (path, standalone, surface) => {
    expect(surfaceForPathname(path, standalone)).toBe(surface);
  });

  it('the middleware forwards the path under the header the server helper reads', () => {
    const middleware = readFileSync(join(SRC, 'middleware.ts'), 'utf8');
    const server = readFileSync(join(SRC, 'lib', 'i18n', 'documentLocale.server.ts'), 'utf8');
    expect(server).toContain("export const SURFACE_PATH_HEADER = 'x-gna-pathname';");
    expect(middleware).toContain("forwarded.set('x-gna-pathname', request.nextUrl.pathname);");
  });
});

describe('T2 · effectiveWithin narrows without ever substituting', () => {
  it('for every en/pl-only surface × locale, the narrowed value IS the effective locale', () => {
    for (const surface of ['delivery', 'election', 'imihigo', 'support', 'cookies'] as const) {
      for (const requested of DISPLAY_LOCALES) {
        const result = resolveSurfaceLocale(surface, requested);
        expect(effectiveWithin(result, ['en', 'pl'])).toBe(result.effective);
      }
    }
  });
});
