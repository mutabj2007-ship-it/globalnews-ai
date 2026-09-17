import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT A — THE WIRING GUARANTEE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `geographyScope.spec.ts` proves the RESOLUTION is correct. This file proves
 * the shell actually USES it, which is the half that cannot be exercised
 * without a browser and is therefore asserted against the real source — the
 * convention `c911MapSelectionSync.spec.ts` and `dockerComposeWiring.spec.ts`
 * already establish in this repository.
 *
 * It exists because the resolution could be flawless and the defect remain: if
 * `BreadcrumbZoomNavigator` kept calling `resolveCameraPlace` directly, or the
 * shell never passed a scope, AFRICA would still be renamed by the viewport and
 * every assertion in the sibling suite would still pass.
 */

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const shellSource = readFileSync(join(__dirname, 'shell', 'GlobalMapShell.tsx'), 'utf-8');
const navigatorSource = readFileSync(
  join(__dirname, 'shell', 'BreadcrumbZoomNavigator.tsx'),
  'utf-8',
);

const shell = stripComments(shellSource);
const navigator = stripComments(navigatorSource);

describe('CHECKPOINT A — the explicit scope actually reaches the ladder', () => {
  describe('THE NAVIGATOR NO LONGER RESOLVES FROM THE CAMERA ALONE', () => {
    it('resolves through resolveLadderPlace, passing the scope', () => {
      expect(navigator).toContain('const place = resolveLadderPlace(camera, scope);');
    });

    it('no longer calls resolveCameraPlace itself — the camera path is now a FALLBACK inside the resolver', () => {
      expect(navigator).not.toContain('resolveCameraPlace(');
    });

    it('accepts a scope prop, defaulting to null so free navigation is unchanged', () => {
      expect(navigator).toContain('readonly scope?: GeographyScope | null;');
      expect(navigator).toContain('scope = null,');
    });
  });

  describe('THE SHELL SUPPLIES THE SCOPE', () => {
    it('hands the resolved scope to the breadcrumb navigator', () => {
      expect(shell).toContain('scope={ladderScope}');
    });

    it('a COUNTRY selection outranks any view scope', () => {
      const memo = shell.slice(
        shell.indexOf('const ladderScope = useMemo'),
        shell.indexOf('}, [selection, selectedIso3, viewScope]);'),
      );

      expect(memo).toContain("selection.kind === 'COUNTRY'");
      expect(memo).toContain("return { rung: 'COUNTRY', id: selection.id };");
      expect(memo).toContain('return viewScope;');
    });

    it('recomputes when any of its three inputs change', () => {
      expect(shell).toContain('}, [selection, selectedIso3, viewScope]);');
    });
  });

  describe('THE SCOPE IS ESTABLISHED, AND CLEARED, BY THE RIGHT EVENTS', () => {
    it('every jump records the scope of its target', () => {
      expect(shell).toContain('setViewScope(scopeForJumpTarget(target));');
    });

    it('the jump reads the EXISTING target — no jump definition was modified', () => {
      /*
        The CTO ruling holds the bounds-only AFRICA and EAST AFRICA entries
        correct and unchangeable. `scopeForJumpTarget` is a reader; if the scope
        were ever stored ON the target instead, this assertion is where that
        would surface.
      */
      const breadcrumbs = stripComments(
        readFileSync(join(__dirname, '..', '..', 'lib', 'map', 'navigation', 'breadcrumbs.ts'), 'utf-8'),
      );

      expect(breadcrumbs).toContain(
        "{ id: 'africa', rung: 'CONTINENT', bounds: [-18, -35, 52, 37] },",
      );
      expect(breadcrumbs).toContain(
        "{ id: 'eastAfrica', rung: 'SUBREGION', bounds: [28.8, -11.8, 42, 5.5] },",
      );
      expect(breadcrumbs).not.toContain('scope:');
    });

    it('a user gesture clears the scope, returning to honest camera context', () => {
      const gesture = shell.slice(
        shell.indexOf('const onGesture = useCallback'),
        shell.indexOf('const [engineMinZoom'),
      );

      expect(gesture).toContain('setViewScope(null);');
      expect(gesture).toContain("dispatch({ kind: 'gesture', camera });");
    });

    it('Reset World clears the scope as well as the selection — one button, both promises', () => {
      const intent = shell.slice(
        shell.indexOf('const onIntent = useCallback'),
        shell.indexOf('const onGesture = useCallback'),
      );

      expect(intent).toContain("intent.kind === 'reset-world'");
      expect(intent).toContain('onSelectionChange?.(null);');
      expect(intent).toContain('setViewScope(null);');
    });

    it('Previous View does NOT clear the scope — walking back restores the view it belongs to', () => {
      /*
        `previous-view` is dispatched through `onIntent`, which clears the scope
        only in the reset-world branch. If a future change moved the clear out
        of that branch, back-navigation would drop to camera context and the
        defect would return on the back path specifically.
      */
      const intent = shell.slice(
        shell.indexOf('const onIntent = useCallback'),
        shell.indexOf('const onGesture = useCallback'),
      );

      const resetBranch = intent.slice(intent.indexOf("intent.kind === 'reset-world'"));
      const clearCount = (intent.match(/setViewScope\(null\)/g) ?? []).length;

      expect(clearCount).toBe(1);
      expect(resetBranch).toContain('setViewScope(null);');
    });
  });

  describe('THE C911 JUMP CONTRACT IS UNBROKEN', () => {
    it('a COUNTRY target still selects rather than only focusing', () => {
      expect(shell).toContain("onSelectionChange?.({ kind: 'COUNTRY', id: target.countryIso3 })");
    });

    it('a target above country scale still clears an incompatible selection', () => {
      expect(shell).toContain('onSelectionChange?.(null)');
    });

    it('the jump callback dependency list is unchanged — setViewScope is a stable setter', () => {
      expect(shell).toContain('[onSelectionChange, selection]');
    });
  });
});
