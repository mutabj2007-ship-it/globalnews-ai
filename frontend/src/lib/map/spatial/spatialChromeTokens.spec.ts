import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import tailwindConfig from '../../../../tailwind.config';

import { DESIGN_REFERENCE } from './designRenderTokens';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SPATIAL CHROME TOKENS — C907 §1
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE MEASURED DEFECT. The Spatial shell has painted itself with 42 distinct
 * `sp-*` utility names since the base commit, and `tailwind.config.ts` defined
 * none of them — byte-identical at 77 080 B across base, c900, c903, c905 and
 * c906. Tailwind emits nothing for an unknown token and reports nothing, so
 * every panel fill, rail ground, divider and accent ink produced NO CSS and the
 * surface fell through to `<body className="bg-void">` — `#080b12`, which is
 * the near-black the CTO measured on Alpha.
 *
 * NOT ONE SPEC IN THE REPOSITORY REFERENCED AN `sp-*` TOKEN. That is why this
 * file starts from the SOURCE and asks what it needs, rather than starting
 * from a list and asking whether the list still holds — a test written against
 * a list cannot catch the case where nobody wrote the list.
 *
 * The same inventory runs as a BUILD GATE (`scripts/verify-spatial-tokens.mjs`,
 * wired into `next build`), because a Jest suite that has to be remembered is
 * the mechanism that already failed here.
 */

type ThemeExtend = Record<string, Record<string, unknown>>;
const extend = (tailwindConfig.theme?.extend ?? {}) as unknown as ThemeExtend;
const colours = (extend.colors ?? {}) as Record<string, unknown>;
const sp = (colours.sp ?? {}) as Record<string, string>;

const SRC = join(__dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.spec\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const usage = new Map<string, string[]>();
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/[A-Za-z][A-Za-z0-9-]*-sp-([A-Za-z0-9-]+)/g)) {
    const token = match[1].replace(/\/\d+$/, '');
    if (!usage.has(token)) usage.set(token, []);
    usage.get(token)!.push(file);
  }
}

describe('1 · EVERY USED SPATIAL TOKEN RESOLVES', () => {
  it('the `sp` colour family exists at all', () => {
    /* It did not, for the entire life of the Spatial surface. */
    expect(Object.keys(sp).length).toBeGreaterThan(0);
  });

  it('INVENTORY — no `sp-*` utility in the source is undefined in the theme', () => {
    const unresolved = [...usage.keys()].filter((token) => sp[token] === undefined).sort();

    expect({ unresolved }).toEqual({ unresolved: [] });
  });

  it('the inventory is real — it found the tokens the shell actually uses', () => {
    /* A scan that silently found nothing would pass the assertion above. */
    expect(usage.size).toBeGreaterThan(30);
    for (const token of ['bg', 'panel', 'rail', 'line', 'ink', 'cyan', 'story']) {
      expect(usage.has(token)).toBe(true);
    }
  });

  it('no `sp-*` class is assembled at runtime, where Tailwind cannot see it', () => {
    for (const file of walk(SRC)) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/-sp-\$\{/);
    }
  });
});

describe('2 · THE VALUES ARE RECOVERED, NOT INVENTED', () => {
  /*
   * Each expectation below quotes an accepted source. The ruling is explicit:
   * *"DO NOT invent an sp palette. Recover the exact Spatial UI token values
   * from the accepted Spatial Design authority/prototype."*
   */
  it('the prototype `:root` block, one-to-one', () => {
    expect(sp.bg).toBe('#05090d'); //            --bg
    expect(sp.panel).toBe('#0c151c'); //         --panel
    expect(sp['panel-2']).toBe('#101b25'); //    --panel-2
    expect(sp.line).toBe('rgba(126,166,186,.22)'); //   --line
    expect(sp['line-2']).toBe('rgba(126,166,186,.34)'); // --line-2
    expect(sp.ink).toBe('#e4eef4'); //           --ink
    expect(sp['ink-2']).toBe('#9db3c0'); //      --ink-2
    expect(sp['ink-3']).toBe('#64798a'); //      --ink-3
    expect(sp.muted).toBe('#4a5b67'); //         --muted
    expect(sp.cyan).toBe('#3ad6e6'); //          --cyan
    expect(sp.amber).toBe('#f2a93c'); //         --amber
    expect(sp['ui-idle']).toBe('#b4c8d4'); //    --ui-idle
    expect(sp['ui-hover']).toBe('#e4eef4'); //   --ui-hover
    expect(sp['ui-off']).toBe('#5a6e7d'); //     --ui-off
    expect(sp.ocean).toBe('#040a10'); //         --ocean
    expect(sp.story).toBe('#10262f'); //         --story
    expect(sp['story-hover']).toBe('#163845'); //     --story-hi
    expect(sp['story-selected']).toBe('#112a34'); //  --story-sel
    expect(sp['story-line']).toBe('rgba(94,158,178,.22)'); //     --story-line
    expect(sp['story-line-hover']).toBe('rgba(94,158,178,.4)'); // --story-line-hi
  });

  it('named selectors from the prototype’s own stylesheet', () => {
    expect(sp.rail).toBe('#09121a'); //           #rail{background}
    expect(sp['line-3']).toBe('rgba(126,166,186,.4)'); // #rail{border-right}
    expect(sp['cyan-on']).toBe('#04161a'); //     .act.primary{color}
    expect(sp['cyan-hover']).toBe('#68e6f2'); //  .act.primary:hover{background}
    expect(sp['amber-on']).toBe('#1a1102'); //    .follow.on{color}
    expect(sp['story-headline']).toBe('#e6f1f6'); //     .card .h{color}
    expect(sp['story-meta']).toBe('#7d97a4'); //         .card .m{color}
    expect(sp['story-meta-strong']).toBe('#9db4c0'); //  .card .m b{color}
    expect(sp['item-hover']).toBe('#101a24'); //  .item:hover{background}
    expect(sp.field).toBe('#101e28'); //          #search{background}
    expect(sp['top-a']).toBe('#0b141b'); //       #top gradient stop 1
    expect(sp['top-b']).toBe('#080f15'); //       #top gradient stop 2
    expect(sp['track-bg']).toBe('#131e27'); //    .cat .tr{background}
    expect(sp.track).toBe('#2b6f7c'); //          .cat .tr i{background}
    expect(sp['track-hover']).toBe('#3a8b99'); // .cat:hover .tr i{background}
  });

  it('Part IV §19 NEW TOKENS, verbatim', () => {
    expect(sp.watch).toBe('#5be3a8');
    expect(sp.capability).toBe('#8c86ee');
    expect(sp.compute).toBe('#d8c08a');
  });

  it('the Part IV derivatives are the specification’s own chip treatment', () => {
    /*
      §19 declares the base hues and not the `-line`/`-dim` pair, so those come
      from the recurring chip in the Part IV visual specification — the mint
      rail icon is `1px solid rgba(91,227,168,.45)` over `rgba(91,227,168,.1)`.
      Capability carries a border and, in every occurrence, no fill, which
      independently corroborates §19's own "tier boundary only".
    */
    expect(sp['watch-line']).toBe('rgba(91,227,168,.45)');
    expect(sp['watch-dim']).toBe('rgba(91,227,168,.1)');
    expect(sp['capability-line']).toBe('rgba(140,134,238,.5)');
    expect(sp['compute-line']).toBe('rgba(216,192,138,.45)');
    /* Tier boundary only: no capability fill token exists to be misused. */
    expect(sp['capability-dim']).toBeUndefined();
  });

  it('agrees with the v1.5 luminance table, which is a second independent source', () => {
    expect(sp.panel).toBe('#0c151c'); //     "right rail background -> #0C151C"
    expect(sp['panel-2']).toBe('#101b25'); // "sections #101B25"
    expect(sp.line).toBe('rgba(126,166,186,.22)'); //  divider .16 -> .22
    expect(sp['line-2']).toBe('rgba(126,166,186,.34)'); // emphasis .28 -> .34
    expect(sp['line-3']).toBe('rgba(126,166,186,.4)'); // rail border .4
  });

  it('three names had no authority and were NOT invented into existence', () => {
    /*
      `sp-ink-4`, `sp-ink-dim` and `sp-surface-raised` appear in no accepted
      source. Their consumers were repointed at the proven token carrying the
      same role — `muted`, `ink-3` and `item-hover` — rather than three new
      colours being minted. If one of the names returns, §1's inventory above
      fails, which is the intended outcome.
    */
    expect(sp['ink-4']).toBeUndefined();
    expect(sp['ink-dim']).toBeUndefined();
    expect(sp['surface-raised']).toBeUndefined();
    expect(usage.has('ink-4')).toBe(false);
    expect(usage.has('ink-dim')).toBe(false);
    expect(usage.has('surface-raised')).toBe(false);
  });
});

describe('3 · ADD, NEVER REDEFINE', () => {
  it('the pre-existing families are untouched by the addition', () => {
    expect((colours as Record<string, string>).void).toBe('#080b12');
    expect(colours.cd).toBeDefined();
    expect(colours.ink).toBeDefined();
    expect(colours.signal).toBeDefined();
  });

  it('the map’s own reference palette is not duplicated into the chrome family', () => {
    /*
      `sp-ocean` exists because the shell asks for it by name, and it is the
      SAME value `DESIGN_REFERENCE.ocean` carries — one colour, stated twice
      in two systems, never two colours.
    */
    expect(sp.ocean).toBe(DESIGN_REFERENCE.ocean);
  });
});
