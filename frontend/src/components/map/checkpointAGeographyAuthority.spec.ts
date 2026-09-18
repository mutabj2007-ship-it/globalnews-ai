import { readFileSync } from 'fs';
import { join } from 'path';
import { assertGovernedJumpRegions } from '@/lib/map/navigation/breadcrumbs';

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

    it('a COUNTRY selection outranks a CONTINENT or SUBREGION view scope', () => {
      const memo = shell.slice(
        shell.indexOf('const ladderScope = useMemo'),
        shell.indexOf('}, [selection, selectedIso3, viewScope]);'),
      );

      expect(memo).toContain("selection.kind === 'COUNTRY'");
      expect(memo).toContain('const countryScope: GeographyScope | null =');
      expect(memo).toContain('return countryScope ?? viewScope;');
    });

    it('a CITY view scope REFINES a compatible country selection instead of losing to it', () => {
      /*
        `onJump` deliberately does not clear a country selection when moving to
        the city rung. If precedence let the country win, jumping to Kigali
        while Rwanda is selected would collapse the CITY identity into its
        parent — the exact failure the A2 ruling asks to be proven against.
      */
      const memo = shell.slice(
        shell.indexOf('const ladderScope = useMemo'),
        shell.indexOf('}, [selection, selectedIso3, viewScope]);'),
      );

      expect(memo).toContain("viewScope.rung === 'CITY'");
      expect(memo).toContain('const parent = cityParentIso3(viewScope.id);');
      expect(memo).toContain('if (countryScope === null || parent === countryScope.id) return viewScope;');
    });

    it('recomputes when any of its three inputs change', () => {
      expect(shell).toContain('}, [selection, selectedIso3, viewScope]);');
    });
  });

  describe('THE SCOPE IS ESTABLISHED, AND CLEARED, BY THE RIGHT EVENTS', () => {
    it('every jump records the scope of its target', () => {
      expect(shell).toContain('setViewScope(scopeForJumpTarget(target));');
    });

    it('the jump target keeps its EXACT bounds, and East Africa gains a governed identity', () => {
      /*
        ══ SUPERSEDED IN PART, AND THE PART THAT SURVIVES IS THE IMPORTANT ONE ══

        This assertion used to read "no jump definition was modified" and rested
        on an earlier ruling that held the bounds-only AFRICA and EAST AFRICA
        entries "correct and unchangeable".

        The current CTO ruling reverses that for East Africa specifically, and
        for a reason this test cannot see: with no identity on the target, the
        jump could only ever be a camera command, so the live map flew to East
        Africa while the right rail went on reading World and the URL carried
        `cam=` alone. MAP-REGION-STATE-PRESENTATION-1 requires the selection to
        establish durable governed scope.

        WHAT THE ASSERTION STILL PROTECTS, UNCHANGED: the BOUNDS. Adding an
        identity must not re-frame the jump — §10 protects the existing East
        Africa camera move as live-PASS — so the exact tuple is still pinned
        here, and AFRICA, which gained nothing, is still pinned whole.

        And the identity may only name a region the product GOVERNS:
        `assertGovernedJumpRegions` refuses any other, which is what keeps this
        from becoming the alias trap RSC-1 warns about.
      */
      const breadcrumbs = stripComments(
        readFileSync(join(__dirname, '..', '..', 'lib', 'map', 'navigation', 'breadcrumbs.ts'), 'utf-8'),
      );

      expect(breadcrumbs).toContain(
        "{ id: 'africa', rung: 'CONTINENT', bounds: [-18, -35, 52, 37] },",
      );
      /* The bounds tuple, byte for byte — the jump is not re-framed. */
      expect(breadcrumbs).toContain('bounds: [28.8, -11.8, 42, 5.5],');
      /* And the identity it now carries is the governed one, not a minted alias. */
      expect(breadcrumbs).toContain("GOVERNED_EAST_AFRICA_ID = 'region:east-africa'");
      expect(breadcrumbs).toContain('regionId: GOVERNED_EAST_AFRICA_ID,');
      expect(assertGovernedJumpRegions()).toEqual([]);

      expect(breadcrumbs).not.toContain('scope:');
    });

    it('A2 — a user gesture does NOT clear the scope: panning is not deselecting', () => {
      /*
        CTO A2 ruling: *"Do not clear explicit geography selection merely because
        the user pans or zooms the camera."* An earlier revision cleared it here,
        which made an explicit selection survive only until the reader touched
        the map. Examining the neighbourhood of a selected geography is ordinary
        map use, not a request to change subject.
      */
      const gesture = shell.slice(
        shell.indexOf('const onGesture = useCallback'),
        shell.indexOf('const [engineMinZoom'),
      );

      expect(gesture).not.toContain('setViewScope');
      expect(gesture).toContain("dispatch({ kind: 'gesture', camera })");
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

      /*
        A2 — and it is the ONLY clear in the whole component. If a second one
        appears anywhere, an explicit selection has gained a way to vanish
        without a semantically explicit transition.
      */
      expect((shell.match(/setViewScope\(null\)/g) ?? []).length).toBe(1);
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
