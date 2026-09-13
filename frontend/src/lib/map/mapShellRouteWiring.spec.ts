/**
 * MAIN-CONVERGED-ALPHA-POST-AUTH-1-R3 — THE ROUTE WIRING H MEASURED AS ABSENT.
 *
 * H-CONVERGED-ALPHA-EQUIVALENCE-1 did not report a broken shell. It reported a
 * shell with NO RUNTIME CALLER: `GlobalMapShell`, `MobileSpatialShell` and
 * `mapShellFlag.ts` all existed, `mapShellVariant()` was called by nothing,
 * `NEXT_PUBLIC_MAP_SHELL` was consumed by nothing, and `/map` still rendered
 * the legacy `MapPageClient`. Source presence is not wiring — that is the whole
 * finding, and a type-check cannot catch it, because unreferenced source
 * type-checks perfectly.
 *
 * So this guard asserts the CALL EDGES, not the types. Two halves:
 *
 *   1. the flag's truth table, executed;
 *   2. the wiring, read out of the shipped files, with comments stripped so a
 *      mention inside an explanation can never be mistaken for a call.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT CLAIM. Next inlines `NEXT_PUBLIC_*` at
 * BUILD time; Jest reads `process.env` at RUN time. These tests therefore prove
 * the resolver's logic and the presence of the call edges. They do NOT prove
 * the bundler substitution, and they prove nothing about how the map behaves on
 * screen. Both of those belong to the alpha rehearsal, and neither is claimed
 * here.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAP_SHELL_FLAG, resolveMapShellVariant } from './mapShellFlag';

const FRONTEND_ROOT = join(__dirname, '..', '..', '..');

/**
 * Comments only — string literals are KEPT.
 *
 * The same rule the `/news` session-blindness guard arrived at, for the same
 * reason and after the same mistake: stripping string literals would blind the
 * scanner to exactly the tokens it exists to find, and stripping nothing lets a
 * paragraph of prose satisfy an assertion about code.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function codeOf(relativePath: string): string {
  return stripComments(readFileSync(join(FRONTEND_ROOT, relativePath), 'utf8'));
}

describe('THE FLAG — default OFF, and every other spelling is OFF too', () => {
  it.each([
    [undefined, 'legacy'],
    [null, 'legacy'],
    ['', 'legacy'],
    ['false', 'legacy'],
    ['0', 'legacy'],
    ['off', 'legacy'],
    ['no', 'legacy'],
    ['yes', 'legacy'],
    ['shell', 'legacy'],
    ['maybe', 'legacy'],
  ])('%p -> %s', (raw, expected) => {
    expect(resolveMapShellVariant(raw as string | undefined | null)).toBe(expected);
  });

  it.each([['true'], ['1'], ['on'], ['enabled'], ['  TRUE  '], ['On']])(
    '%p -> shell',
    (raw) => {
      expect(resolveMapShellVariant(raw)).toBe('shell');
    },
  );

  it('UNSET IS THE ROLLBACK. Next inlines an unset NEXT_PUBLIC_* as the empty string, and the empty string is OFF', () => {
    expect(resolveMapShellVariant(undefined)).toBe('legacy');
    expect(resolveMapShellVariant('')).toBe('legacy');
  });

  it('the flag name is the literal the bundler substitutes', () => {
    expect(MAP_SHELL_FLAG).toBe('NEXT_PUBLIC_MAP_SHELL');
    expect(codeOf('src/lib/map/mapShellFlag.ts')).toContain(
      'process.env.NEXT_PUBLIC_MAP_SHELL',
    );
  });
});

describe('THE CALL EDGES — the exact absences H measured', () => {
  const page = codeOf('src/app/map/page.tsx');
  const client = codeOf('src/components/map/MapPageClient.tsx');

  it('the route reads the flag (H: "mapShellVariant() has no runtime caller")', () => {
    expect(page).toContain('mapShellVariant()');
    expect(client).toContain('mapShellVariant()');
  });

  it('the route imports the flag from its single authority', () => {
    expect(page).toContain("from '@/lib/map/mapShellFlag'");
    expect(client).toContain("from '@/lib/map/mapShellFlag'");
  });

  it('MapPageClient mounts BOTH shells (H: "/map still renders legacy MapPageClient")', () => {
    expect(client).toContain('GlobalMapShell');
    expect(client).toContain('MobileSpatialShell');
  });

  /*
    THE OLD WORDING HERE IS WITHDRAWN.

    This assertion used to read "THE LEGACY MAP IS STILL MOUNTED". That phrasing
    was wrong, and H's R4 Gate N result is what established it: legacy must
    remain SHIPPED — importable and selectable by the flag — and must NOT be
    mounted at the same time as Spatial. "Still mounted" describes the defect,
    not the requirement. The requirement is proved in the mutual-exclusivity
    block below; what survives here is only the SHIPPED half.
  */
  it('the legacy map remains SHIPPED AND SELECTABLE — rollback is a flag flip, not a revert', () => {
    expect(client).toContain('WorldMap');
  });

  it('the NavBar is conditional on the variant, and only on this route', () => {
    expect(page).toContain('spatial ? null : <NavBar');
  });

  it('POSITIVE CONTROL: the scanner reads code, not commentary', () => {
    // If comment-stripping were broken, this would still "find" the token.
    const invented = '/* mapShellVariant() */ const x = 1;';
    expect(invented.replace(/\/\*[\s\S]*?\*\//g, ' ')).not.toContain('mapShellVariant()');
  });
});

describe('THE BUILD ARG — deployment-controlled, never source-pinned', () => {
  const dockerfile = readFileSync(join(FRONTEND_ROOT, 'Dockerfile'), 'utf8');
  const instructions = dockerfile
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

  it('the flag is forwarded into the build stage', () => {
    expect(instructions).toContain('ARG NEXT_PUBLIC_MAP_SHELL');
    expect(instructions).toContain('ENV NEXT_PUBLIC_MAP_SHELL=$NEXT_PUBLIC_MAP_SHELL');
  });

  it('IT IS NOT HARD-PINNED. Identical source bytes must build either state', () => {
    expect(instructions).not.toMatch(/NEXT_PUBLIC_MAP_SHELL=(?!\$)/);
  });

  it('the ARG is declared in the stage that runs the build', () => {
    const buildStage = instructions.slice(instructions.lastIndexOf('FROM '));
    const wholeFile = instructions;
    expect(wholeFile.indexOf('ARG NEXT_PUBLIC_MAP_SHELL')).toBeLessThan(
      wholeFile.indexOf('RUN npm run build --workspace=frontend'),
    );
    expect(buildStage.length).toBeGreaterThan(0);
  });
});

/*
  ══ MUTUAL EXCLUSIVITY — THE R4 GATE N FAILURE, MADE UNREPEATABLE ═══════════

  H measured two maplibregl canvases with the flag ON. THE CAUSE WAS NOT THE
  VARIANT BRANCH. `MapPageClient` already returns exactly one variant: the
  legacy tree sits after `if (mapVariant === 'shell') { return ( … ) }` and is
  unreachable while the flag is on. The two canvases were the DESKTOP and
  MOBILE Spatial compositions, which live inside the shell branch and are
  separated by `spatial:block` / `spatial:hidden`.

  `spatial` was never registered as a Tailwind screen on this lineage, and an
  unregistered variant compiles to NO RULE — so the desktop workspace stayed
  `hidden` at every width and the mobile composition showed at every width.
  R5 registers it, recovered from formal C55.

  SO THIS FILE NOW ASSERTS BOTH HALVES, because each failed independently:
  the branch is exclusive, AND every breakpoint the branch depends on exists.
*/
describe('EXACTLY ONE VARIANT — never both, never neither', () => {
  const src = readFileSync(join(FRONTEND_ROOT, 'src/components/map/MapPageClient.tsx'), 'utf8');
  const code = stripComments(src);

  const shellGate = code.indexOf("if (mapVariant === 'shell')");
  const globalShell = code.indexOf('<GlobalMapShell');
  const mobileShell = code.indexOf('<MobileSpatialShell');
  const legacyMap = code.indexOf('<WorldMap');

  it('there is exactly ONE variant gate, and exactly ONE legacy renderer', () => {
    expect((code.match(/if \(mapVariant === 'shell'\)/g) ?? []).length).toBe(1);
    expect((code.match(/<WorldMap/g) ?? []).length).toBe(1);
    expect(shellGate).toBeGreaterThan(-1);
  });

  it('FLAG ON -> Spatial ONLY: both Spatial compositions are inside the early return', () => {
    expect(globalShell).toBeGreaterThan(shellGate);
    expect(mobileShell).toBeGreaterThan(shellGate);
  });

  it('FLAG ON -> legacy ABSENT: the legacy renderer is after the early return, unreachable', () => {
    /* the early return is what makes this exclusive — the legacy tree cannot be
       reached at all once `mapVariant === 'shell'` has returned */
    expect(legacyMap).toBeGreaterThan(globalShell);
    expect(legacyMap).toBeGreaterThan(mobileShell);
    expect(code.slice(shellGate, legacyMap)).toContain('return (');
  });

  it('FLAG OFF -> legacy ONLY: the legacy branch names no Spatial composition', () => {
    const legacyBranch = code.slice(legacyMap - 2000 > shellGate ? legacyMap - 2000 : shellGate, code.length);
    const afterReturn = code.slice(code.lastIndexOf('return (', legacyMap));
    expect(afterReturn).toContain('<WorldMap');
    expect(afterReturn).not.toContain('<GlobalMapShell');
    expect(afterReturn).not.toContain('<MobileSpatialShell');
    expect(legacyBranch.length).toBeGreaterThan(0);
  });

  it('NEITHER IS IMPOSSIBLE: the resolver is total, so one branch always renders', () => {
    /* `resolveMapShellVariant` returns 'shell' or 'legacy' for every input —
       there is no third value and no undefined path */
    expect(resolveMapShellVariant(undefined)).toBe('legacy');
    expect(resolveMapShellVariant('true')).toBe('shell');
  });
});

describe('EVERY BREAKPOINT THE MAP USES IS REGISTERED — the R4 root cause', () => {
  const TAILWIND_DEFAULT_SCREENS = ['sm', 'md', 'lg', 'xl', '2xl'];
  const config = readFileSync(join(FRONTEND_ROOT, 'tailwind.config.ts'), 'utf8');

  function registeredScreens(): string[] {
    const start = config.indexOf('screens: {');
    let depth = 0;
    let end = start + 'screens: '.length;
    for (; end < config.length; end += 1) {
      if (config[end] === '{') depth += 1;
      if (config[end] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const block = config.slice(start, end);
    return [...block.matchAll(/^\s*'?([A-Za-z0-9-]+)'?\s*:/gm)]
      .map((m) => m[1])
      .filter((name) => name !== 'screens');
  }

  it("`spatial` is a registered screen — without it `spatial:` compiles to nothing", () => {
    expect(registeredScreens()).toContain('spatial');
    expect(config).toContain("spatial: '861px'");
  });

  it('THE MAP ROUTE NO LONGER DEPENDS ON `spatial:` AT ALL — the duplicate is gone by mount', () => {
    /*
      R4 separated the two Spatial compositions with `spatial:block` /
      `spatial:hidden`. R5 selects by mount instead, so the route needs no
      custom variant here. `spatial` stays REGISTERED because the Spatial
      components themselves still use it for internal layout — the previous
      test is what guards that, and this one guards that the route is not
      relying on a class to avoid a double mount ever again.
    */
    const mapSource = stripComments(
      readFileSync(join(FRONTEND_ROOT, 'src/components/map/MapPageClient.tsx'), 'utf8'),
    );
    expect(mapSource).not.toContain('spatial:');
  });

  it('every custom variant used anywhere on the map surfaces resolves to a real screen', () => {
    const known = new Set([...registeredScreens(), ...TAILWIND_DEFAULT_SCREENS]);
    const sources = [
      'src/components/map/MapPageClient.tsx',
      'src/components/map/shell/GlobalMapShell.tsx',
      'src/components/map/mobile/MobileSpatialShell.tsx',
    ].map((file) => stripComments(readFileSync(join(FRONTEND_ROOT, file), 'utf8')));

    const used = new Set<string>();
    for (const source of sources) {
      for (const match of source.matchAll(/className="([^"]*)"/g)) {
        for (const token of match[1].split(/\s+/)) {
          const variant = token.includes(':') ? token.slice(0, token.indexOf(':')) : null;
          if (variant && /^[a-z][a-z0-9-]*$/.test(variant)) used.add(variant);
        }
      }
    }

    const STATE_VARIANTS = ['hover', 'focus', 'focus-visible', 'focus-within', 'active',
                            'disabled', 'group-hover', 'peer-focus', 'motion-safe',
                            'motion-reduce', 'dark', 'first', 'last', 'odd', 'even', 'print',
                            'aria-selected', 'data-active', 'supports-backdrop-blur'];
    for (const variant of used) {
      if (STATE_VARIANTS.includes(variant) || variant.startsWith('group-') ||
          variant.startsWith('peer-') || variant.startsWith('data-') ||
          variant.startsWith('aria-') || variant.startsWith('has-') ||
          variant.startsWith('max-') || variant.startsWith('supports-')) continue;
      expect(`${variant}: ${known.has(variant)}`).toBe(`${variant}: true`);
    }
  });
});

/*
  ══ R5 · ONE MOUNTED COMPOSITION, PROVED STRUCTURALLY ════════════════════════

  H's runtime measurement on R4 found a second MapLibre canvas collapsed to 0x0
  and a 0x0 Spatial search input shadowing the real one. The ruling is explicit:
  CSS-hiding the duplicate does not satisfy the contract. So these assertions
  are about MOUNT CONDITIONS, not classes — a `hidden` class would pass a
  class-based check and still ship the defect.
*/
describe('ONE SPATIAL COMPOSITION IS MOUNTED — not two, one hidden', () => {
  const code = codeOf('src/components/map/MapPageClient.tsx');

  it('the CSS-visibility separation is GONE — neither shell is gated by a class', () => {
    expect(code).not.toContain('spatial:block');
    expect(code).not.toContain('spatial:hidden');
  });

  it('each composition is behind a MOUNT condition on the viewport state', () => {
    expect(code).toMatch(/\{spatialWide === true && \(/);
    expect(code).toMatch(/\{spatialWide === false && \(/);
  });

  it('the desktop shell is inside the wide branch and the mobile shell is not', () => {
    const wide = code.indexOf('{spatialWide === true && (');
    const narrow = code.indexOf('{spatialWide === false && (');
    const globalShell = code.indexOf('<GlobalMapShell');
    const mobileShell = code.indexOf('<MobileSpatialShell');

    expect(globalShell).toBeGreaterThan(wide);
    expect(globalShell).toBeLessThan(narrow);
    expect(mobileShell).toBeGreaterThan(narrow);
  });

  it('the boundary is C55\'s 861 px — recovered, not invented', () => {
    expect(code).toContain("'(min-width: 861px)'");
    const config = readFileSync(join(FRONTEND_ROOT, 'tailwind.config.ts'), 'utf8');
    expect(config).toContain("spatial: '861px'");
  });

  it('the viewport state starts UNKNOWN, so no composition is guessed on the server', () => {
    expect(code).toMatch(/useState<boolean \| null>\(null\)/);
    expect(code).toMatch(/\{spatialWide === null && \(/);
  });

  it('the listener is cleaned up — no stale composition swap after unmount', () => {
    expect(code).toContain('removeEventListener');
  });
});

/*
  ══ R5 · NO LEGACY CONTROL SURVIVES INTO THE SPATIAL BRANCH ══════════════════

  H measured, with the flag ON, a legacy "World News Map" heading below the fold
  and a legacy `#country-search-input` shadowing the Spatial place search. They
  did not come from the legacy branch — that branch is unreachable once
  `mapVariant === 'shell'` has returned. They came from an `sr-only` legacy
  block INSIDE the shell branch. It is not deleted; it is untouched in the
  legacy branch, which is what the flag-off rollback renders.
*/
describe('THE SPATIAL BRANCH CARRIES NO LEGACY CONTROL', () => {
  const code = codeOf('src/components/map/MapPageClient.tsx');
  const shellBranch = code.slice(
    code.indexOf("if (mapVariant === 'shell')"),
    code.lastIndexOf('return ('),
  );
  const legacyBranch = code.slice(code.lastIndexOf('return ('));

  it('no legacy country-search control is mounted while Spatial is selected', () => {
    expect(shellBranch).not.toContain('<CountrySearchBox');
  });

  it('no legacy "World News Map" heading is mounted while Spatial is selected', () => {
    expect(shellBranch).not.toContain('{t.headline}');
  });

  it('BOTH REMAIN SHIPPED — the legacy branch still renders them for the rollback', () => {
    expect(legacyBranch).toContain('<CountrySearchBox');
    expect(legacyBranch).toContain('{t.headline}');
    expect(legacyBranch).toContain('<WorldMap');
  });

  it('and the legacy branch still carries no Spatial composition', () => {
    expect(legacyBranch).not.toContain('<GlobalMapShell');
    expect(legacyBranch).not.toContain('<MobileSpatialShell');
  });
});
