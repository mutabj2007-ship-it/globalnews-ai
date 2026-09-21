import type { AskContext } from '@globalnews-ai/shared';
import {
  ASK_CONTEXT_PARAMS,
  buildContextualHref,
  buildReturnTrail,
  captureAskContext,
  primaryReturnTarget,
  readAskContext,
  writeAskContext,
} from './askNavigationContext';

const FULL_CONTEXT: AskContext = {
  originRoute: '/map',
  originLabel: 'World Map',
  countryCode: 'RW',
  countryName: 'Rwanda',
  subjectId: 'story-7',
  subjectLabel: 'Rwanda energy expansion',
  module: 'energy',
  timeWindow: '7d',
};

describe('BETA-SIMPLE-ASK-SAND-1 §4 — navigation context round-trips through the URL', () => {
  it('survives a write/read cycle unchanged', () => {
    expect(readAskContext(writeAskContext(FULL_CONTEXT))).toEqual(FULL_CONTEXT);
  });

  it('survives the cycle a shared link or a page reload performs', () => {
    const href = buildContextualHref('/ask', FULL_CONTEXT);
    const restored = readAskContext(new URLSearchParams(href.split('?')[1]));
    expect(restored).toEqual(FULL_CONTEXT);
  });

  it('produces an empty context from an empty query, not a fabricated one', () => {
    expect(readAskContext(new URLSearchParams())).toEqual({});
  });

  it('omits empty fields rather than writing blank parameters', () => {
    const params = writeAskContext({ countryCode: 'RW' });
    expect(params.get(ASK_CONTEXT_PARAMS.countryCode)).toBe('RW');
    expect(params.has(ASK_CONTEXT_PARAMS.originRoute)).toBe(false);
    expect(params.has(ASK_CONTEXT_PARAMS.module)).toBe(false);
  });

  it('preserves parameters it does not own', () => {
    const existing = new URLSearchParams({ q: 'rwanda energy', page: '2' });
    const params = writeAskContext({ countryCode: 'RW' }, existing);
    expect(params.get('q')).toBe('rwanda energy');
    expect(params.get('page')).toBe('2');
  });

  it('returns a bare path when there is no context to carry', () => {
    expect(buildContextualHref('/ask', {})).toBe('/ask');
  });

  it('canonicalizes the country code to uppercase', () => {
    const restored = readAskContext(writeAskContext({ countryCode: 'rw' }));
    expect(restored.countryCode).toBe('RW');
  });
});

describe('§4 — a crafted link cannot turn a return control into an open redirect', () => {
  it.each([
    ['an absolute http URL', 'https://evil.test/phish'],
    ['a protocol-relative URL', '//evil.test/phish'],
    ['a backslash-prefixed path', '/\\evil.test'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a bare host', 'evil.test'],
  ])('rejects %s as an origin route', (_label, hostile) => {
    const params = new URLSearchParams({ [ASK_CONTEXT_PARAMS.originRoute]: hostile });
    expect(readAskContext(params).originRoute).toBeUndefined();
  });

  it('never emits a rejected origin route into a built href', () => {
    const href = buildContextualHref('/ask', { originRoute: 'https://evil.test' });
    expect(href).toBe('/ask');
  });

  it('never builds a return control pointing off-site', () => {
    const trail = buildReturnTrail({
      originRoute: 'https://evil.test',
      originLabel: 'Totally Safe',
    });
    expect(trail).toHaveLength(0);
  });

  it('accepts an ordinary in-app path', () => {
    const params = new URLSearchParams({ [ASK_CONTEXT_PARAMS.originRoute]: '/map' });
    expect(readAskContext(params).originRoute).toBe('/map');
  });
});

describe('§4 — a crafted link cannot mint unlimited cache identities', () => {
  it('drops a module that is not a real Beta category', () => {
    const params = new URLSearchParams({ [ASK_CONTEXT_PARAMS.module]: 'not-a-category' });
    expect(readAskContext(params).module).toBeUndefined();
  });

  it('accepts every real Beta category', () => {
    for (const category of ['world', 'economy', 'energy', 'security', 'humanitarian']) {
      const params = new URLSearchParams({ [ASK_CONTEXT_PARAMS.module]: category });
      expect(readAskContext(params).module).toBe(category);
    }
  });

  it('drops a time window outside the offered set', () => {
    const params = new URLSearchParams({ [ASK_CONTEXT_PARAMS.timeWindow]: '9999d' });
    expect(readAskContext(params).timeWindow).toBeUndefined();
  });

  it('drops an over-long value rather than forwarding it to the backend', () => {
    const params = new URLSearchParams({
      [ASK_CONTEXT_PARAMS.subjectLabel]: 'x'.repeat(5000),
    });
    expect(readAskContext(params).subjectLabel).toBeUndefined();
  });
});

describe('§4 — the return trail §4 asks for', () => {
  it('builds ← World Map, ← Rwanda, ← Energy in breadcrumb order', () => {
    expect(buildReturnTrail(FULL_CONTEXT).map((t) => t.label)).toEqual([
      'World Map',
      'Rwanda',
      'Energy',
    ]);
  });

  it('points the country control at the existing map route convention', () => {
    const country = buildReturnTrail(FULL_CONTEXT).find((t) => t.kind === 'country');
    expect(country?.href).toBe('/map?country=RW');
  });

  it('points the module control at that category’s public route', () => {
    const moduleTarget = buildReturnTrail(FULL_CONTEXT).find((t) => t.kind === 'module');
    expect(moduleTarget?.href.startsWith('/energy')).toBe(true);
  });

  it('carries the geography forward into the module link, so ← Energy stays about Rwanda', () => {
    const moduleTarget = buildReturnTrail(FULL_CONTEXT).find((t) => t.kind === 'module');
    const restored = readAskContext(new URLSearchParams(moduleTarget!.href.split('?')[1]));
    expect(restored.countryCode).toBe('RW');
  });

  it('returns an empty trail for a bare Ask rather than inventing a control', () => {
    // A fabricated "← Home" would teach the user the control is
    // unreliable, which is worse than having no control.
    expect(buildReturnTrail({})).toEqual([]);
    expect(primaryReturnTarget({})).toBeUndefined();
  });

  it('includes only what the context genuinely carries', () => {
    expect(buildReturnTrail({ countryCode: 'RW', countryName: 'Rwanda' })).toEqual([
      { label: 'Rwanda', href: '/map?country=RW', kind: 'country' },
    ]);
  });

  it('falls back to the route itself when no origin label was captured', () => {
    const trail = buildReturnTrail({ originRoute: '/workspace' });
    expect(trail[0].label).toBe('/workspace');
  });

  it('uses the country code when no display name was captured', () => {
    const trail = buildReturnTrail({ countryCode: 'RW' });
    expect(trail[0].label).toBe('RW');
  });

  describe('primaryReturnTarget', () => {
    it('returns the most specific step, not the origin', () => {
      // Going back one meaningful step is what a single back control
      // should do; jumping to the origin would skip what the user was
      // actually looking at.
      expect(primaryReturnTarget(FULL_CONTEXT)?.label).toBe('Energy');
    });

    it('returns the origin when it is the only step', () => {
      expect(primaryReturnTarget({ originRoute: '/map', originLabel: 'World Map' })?.label).toBe(
        'World Map',
      );
    });
  });
});

describe('§4 — context accumulates across a Map → Situation → Ask → Analysis journey', () => {
  it('keeps earlier geography when a later hop does not restate it', () => {
    const atMap = captureAskContext({
      pathname: '/map',
      label: 'World Map',
      countryCode: 'RW',
      countryName: 'Rwanda',
    });

    const atSituation = captureAskContext({
      pathname: '/energy',
      label: 'Energy',
      existing: atMap,
      module: 'energy',
    });

    const atAnalysis = captureAskContext({
      pathname: '/workspace',
      label: 'Analysis',
      existing: atSituation,
    });

    // Four steps deep, the country is still known — which is the
    // entire point of §4.
    expect(atAnalysis.countryCode).toBe('RW');
    expect(atAnalysis.module).toBe('energy');
    expect(atAnalysis.originRoute).toBe('/workspace');
    expect(atAnalysis.originLabel).toBe('Analysis');

    expect(buildReturnTrail(atAnalysis).map((t) => t.label)).toEqual([
      'Analysis',
      'Rwanda',
      'Energy',
    ]);
  });

  it('lets a later hop override geography when it genuinely changes', () => {
    const atRwanda = captureAskContext({
      pathname: '/map',
      label: 'World Map',
      countryCode: 'RW',
      countryName: 'Rwanda',
    });
    const atUganda = captureAskContext({
      pathname: '/map',
      label: 'World Map',
      existing: atRwanda,
      countryCode: 'UG',
      countryName: 'Uganda',
    });

    expect(atUganda.countryCode).toBe('UG');
    expect(atUganda.countryName).toBe('Uganda');
  });

  it('refuses to capture an off-site pathname as an origin', () => {
    const captured = captureAskContext({
      pathname: 'https://evil.test',
      label: 'Evil',
    });
    expect(captured.originRoute).toBeUndefined();
  });

  it('produces a context with no undefined keys, so it compares cleanly', () => {
    const captured = captureAskContext({ pathname: '/map', label: 'World Map' });
    expect(Object.values(captured).every((v) => v !== undefined)).toBe(true);
  });
});
