import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useEffect, useLayoutEffect } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';

/**
 * R3 — the SSR warning correction, and the guarantee that it corrected
 * only the warning.
 */
describe('useIsomorphicLayoutEffect', () => {
  it('binds to useEffect under a server renderer, where there is no layout phase', () => {
    // jest runs testEnvironment:'node', so `window` is undefined here —
    // exactly the condition a server render is in.
    expect(typeof window).toBe('undefined');
    expect(useIsomorphicLayoutEffect).toBe(useEffect);
  });

  it('is NOT useLayoutEffect on the server — that binding is the warning', () => {
    expect(useIsomorphicLayoutEffect).not.toBe(useLayoutEffect);
  });

  it('the branch is decided ONCE at module scope, never per render', () => {
    // A hook whose identity changed between renders would break the rules
    // of hooks. The export must be a const binding, not a function that
    // re-tests `window` on each call.
    const source = readFileSync(join(__dirname, 'useIsomorphicLayoutEffect.ts'), 'utf8');
    expect(source).toMatch(/export const useIsomorphicLayoutEffect =/);
    expect(source).not.toMatch(/export function useIsomorphicLayoutEffect/);
  });

  it('emits no React warning when a component using it is server-rendered', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    function Probe(): JSX.Element {
      useIsomorphicLayoutEffect(() => {
        /* a body that would touch layout on the client */
      }, []);
      return createElement('div', null, 'probe');
    }
    const html = renderToStaticMarkup(createElement(Probe));
    expect(html).toContain('probe');
    const warnings = spy.mock.calls.map((c) => String(c[0])).filter((m) => /useLayoutEffect/.test(m));
    expect(warnings).toEqual([]);
    spy.mockRestore();
  });

  it('CONTROL: the raw hook still warns, so the test above is measuring something real', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    function RawProbe(): JSX.Element {
      useLayoutEffect(() => {}, []);
      return createElement('div', null, 'raw');
    }
    renderToStaticMarkup(createElement(RawProbe));
    const warnings = spy.mock.calls.map((c) => String(c[0])).filter((m) => /useLayoutEffect/.test(m));
    expect(warnings.length).toBeGreaterThan(0);
    spy.mockRestore();
  });
});
