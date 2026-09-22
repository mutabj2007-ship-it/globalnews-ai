/*
  ── B4-A · PENDING-SUBJECT TESTS ──────────────────────────────────────────

  The tests marked `it.skip` below are NOT failing assertions about the
  recovered Economy substrate. Each one reads a file that B4-A is forbidden by
  ruling to recover — the public route, the domain-local IndicatorStrip, or the
  deferred ScriptRun/multilingual block.

  They are skipped WITH A STATED REASON rather than deleted, so the work each one
  is waiting for stays visible and re-enabling it is a one-word edit. A recovered
  spec that silently disappears is how a contract stops being enforced.
*/
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ATTENTION_RAIL_PX, ECONOMY_BREAKPOINTS, ECONOMY_PAGE_CAP_PX, ECONOMY_SHEET_DETENTS,
  COMPACT_HIT_TARGET_PX, COMPACT_MAX_PX, COMPACT_MIN_PX, COMPACT_REFERENCE_PX,
  DEV_ECONOMY_AI_CONFIG, SPATIAL_CAPABILITY, DEV_WATCH_RUNTIME,
  ECONOMY_DATA_CAPABILITY, FIXTURE_DATA_CAPABILITY, hasObservationSource,
  INDICATOR_CELL_MAX_PX, PROSE_MAX_CH, STATEMENT_MAX_CH, HUD_MAX_PX, HUD_MIN_PX,
  meteredActionCost,
} from './economyConfig';
import { economyLocalesAwaitingContent, economyStrings, resolveEconomyStrings } from './strings';
import type { EconomyLocale } from './strings';
import {
  DISPLAY_LOCALES, WATCH_CHANGE_STATES,
  ECONOMY_RELEASE_STATUSES, ECONOMY_VALUE_KINDS, ECONOMY_FRESHNESS_STATES,
  ECONOMY_CORRIDOR_CAPABILITIES, ECONOMY_LEGACY_DATA_CHANGE_STATE,
  ECONOMY_LEGACY_UI_CORRIDOR_CAPABILITY, economyHasObservationSource,
} from '@globalnews-ai/shared';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { RWANDA_SUBJECT, RW_ATTENTION, CORRIDOR_SUBJECT } from './fixtures';
import { observationMode } from '@/components/economy/DataAvailability';
import { economyGap, figureIsGap, figureObservation, figureSemantics, gapReason } from './economyAdapters';
import { PRODUCTION_SHAPED_SUBJECT } from './productionSubject';
import { RWANDA_SUBJECT as RW_SUBJ_FOR_ASSESS } from './fixtures';
import type { Assessment as EconomyUiAssessment } from './types';
import {
  assessmentChangeState, assessmentChangeStateReason, assessmentObservedVintages,
} from './types';
import { assertAssessmentIsAccountable } from '@globalnews-ai/shared';
import { orderByAttentionRank } from '@/components/economy/AttentionQueue';
import { breakpointFor } from '@/components/economy/EconomyScreen';
import { DRAWER_WIDTH_PX } from '@/components/economy/EconomyDrawer';

/**
 * ECON-UI-1 — CONTRACT GUARDS.
 *
 * Authority: DESIGN-ECON-1 v1.0, package sha256 d2a7b7dc…75db2.
 *
 * The frontend suite is `testEnvironment: 'node'` with no DOM, so these are source-shape
 * and pure-behaviour assertions — the same discipline the existing guards in this repo
 * use. Rendered-geometry proof is measured in a real browser; see the evidence package.
 */

const ECON_DIRS = [
  join(__dirname), // lib/economy
  join(__dirname, '..', '..', 'components', 'economy'),
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(e) && !/\.spec\.tsx?$/.test(e)) out.push(full);
  }
  return out;
}
const ECONOMY_FILES = ECON_DIRS.flatMap((d) => walk(d));
const read = (f: string) => readFileSync(f, 'utf8');
/** Shape guards read what a file DOES, not what it says about itself. */
const code = (f: string) =>
  read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/*
  THE ONE ECONOMY MODULE ALLOWED TO READ, NAMED ONCE AND USED BY EVERY RULE BELOW.

  It reads a RETAINED ARTIFACT over this deployment’s own origin. It is not a
  provider, a scraper or a scorer, and the rules that forbid those are unchanged and
  still apply to it — what it is exempt from is the blanket "no Economy file may
  contain the token fetch(", which was the correct shape while there was nothing
  truthful to read.

  NAMED RATHER THAN PATTERNED, so a SECOND reader fails these rules rather than
  arriving quietly behind a wildcard.
*/
const GOVERNED_READ = 'economyObservationRead.ts';

describe('ECON-UI-1 · A9 — attentionRank is consumed, never computed', () => {
  it('orders by the supplied rank and applies no transformation', () => {
    const ordered = orderByAttentionRank(RW_ATTENTION);
    expect(ordered.map((r) => r.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    // the values themselves are untouched
    expect(ordered.map((r) => r.attentionRank)).toEqual([0.94, 0.81, 0.67, 0.55, 0.31]);
  });

  it('re-ordering a shuffled input reproduces the same order, deterministically', () => {
    const shuffled = [RW_ATTENTION[3]!, RW_ATTENTION[0]!, RW_ATTENTION[4]!, RW_ATTENTION[1]!, RW_ATTENTION[2]!];
    expect(orderByAttentionRank(shuffled).map((r) => r.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
  });

  it('NO Economy file performs arithmetic on attentionRank, or normalizes or buckets it', () => {
    for (const f of ECONOMY_FILES) {
      const src = code(f);
      // no arithmetic, no scaling, no thresholding, no re-scoring
      expect(src).not.toMatch(/attentionRank\s*[+\-*/]/);
      expect(src).not.toMatch(/[+\-*/]\s*attentionRank/);
      expect(src).not.toMatch(/attentionRank\s*[<>]=?\s*\d/);
      expect(src).not.toMatch(/(normali[sz]e|computeRank|scoreOf|rankOf|weightedRank)/i);
    }
  });

  it('never uses Conflict severity as an attention input', () => {
    for (const f of ECONOMY_FILES) expect(code(f)).not.toMatch(/severity/i);
  });

  it('does not print the rank to the reader — it is an ordering input, not a score', () => {
    for (const f of ECONOMY_FILES) {
      expect(code(f)).not.toMatch(/\{[^}]*\.attentionRank\s*\}/);
    }
  });
});

describe('ECON-UI-1 · zero-AI contract', () => {

  const NAVIGATION_SURFACES = ECONOMY_FILES.filter(
    (f) => !/DrawerContents|EconomyScreen|Compact/.test(f) && !f.endsWith(GOVERNED_READ),
  );

  it('no Economy file hard-codes a sand amount — every cost comes from configuration', () => {
    for (const f of ECONOMY_FILES) {
      if (f.endsWith('economyConfig.ts')) continue; // the configuration itself
      const src = code(f);
      expect(src).not.toMatch(/\d+\s*sand/i);
      expect(src).not.toMatch(/sandCost\s*[:=]\s*\d/);
    }
  });

  it('a metered action always reads its cost through meteredActionCost', () => {
    for (const f of ECONOMY_FILES) {
      const src = code(f);
      if (src.includes('data-econ="metered-action"')) {
        expect(src).toContain('meteredActionCost');
      }
    }
  });

  it('the HUD can contain no metered action — it has no action slot at all', () => {
    const hud = code(join(__dirname, '..', '..', 'components', 'economy', 'AnchoredHud.tsx'));
    expect(hud).not.toMatch(/metered|sand|onRun|onAnalyz/i);
    // body is a string, not a render-prop, so no caller can inject a control
    expect(hud).toMatch(/body:\s*string/);
  });

  it('the HUD is never scrollable', () => {
    const hud = code(join(__dirname, '..', '..', 'components', 'economy', 'AnchoredHud.tsx'));
    expect(hud).not.toMatch(/overflowY|maxHeight/);
    expect(hud).toContain("overflow: 'visible'");
  });

  it('no navigation surface invokes analysis on selection, hover, scroll or range change', () => {
    for (const f of NAVIGATION_SURFACES) {
      const src = code(f);
      expect(src).not.toMatch(/onMouseEnter|onMouseOver|onScroll/);
      expect(src).not.toMatch(/fetch\(|useSWR|useQuery/);
    }
  });

  it('opening Ask AI is free; asking is the metered act', () => {
    const compact = code(join(__dirname, '..', '..', 'components', 'economy', 'compact', 'EconomyCompactScreen.tsx'));
    expect(compact).toContain('askAiOpeningFree');
  });

  it('every configured metered action resolves a cost, and none is a literal in a component', () => {
    for (const a of DEV_ECONOMY_AI_CONFIG.meteredActions) {
      expect(meteredActionCost(DEV_ECONOMY_AI_CONFIG, a.id)).toBe(a.sandCost);
    }
    expect(meteredActionCost(DEV_ECONOMY_AI_CONFIG, 'NOT_A_REAL_ACTION')).toBeNull();
  });
});

describe('ECON-UI-1 · responsive rulings', () => {
  it('the attention rail is fixed at 372px and appears in no breakpoint row', () => {
    expect(ATTENTION_RAIL_PX).toBe(372);
    for (const b of ECONOMY_BREAKPOINTS) {
      expect(Object.values(b)).not.toContain(ATTENTION_RAIL_PX);
    }
  });

  it('gutters, indicator cells and series window follow the three rulings exactly', () => {
    expect(breakpointFor(1360)).toEqual({ minWidth: 1360, gutterPx: 24, indicatorCells: 6, seriesWindowMonths: 12 });
    expect(breakpointFor(1512)).toEqual({ minWidth: 1512, gutterPx: 40, indicatorCells: 7, seriesWindowMonths: 18 });
    expect(breakpointFor(1920)).toEqual({ minWidth: 1920, gutterPx: 64, indicatorCells: 7, seriesWindowMonths: 24 });
  });

  it('a width between breakpoints takes the lower ruling — these are rulings, not a curve', () => {
    expect(breakpointFor(1400).gutterPx).toBe(24);
    expect(breakpointFor(1700).gutterPx).toBe(40);
    expect(breakpointFor(2560).gutterPx).toBe(64);
  });

  it('the indicator ceiling is seven and cells cap at 200px', () => {
    for (const b of ECONOMY_BREAKPOINTS) expect(b.indicatorCells).toBeLessThanOrEqual(7);
    expect(INDICATOR_CELL_MAX_PX).toBe(200);
  });

  it('the page caps at 1920 and prose measures are bounded', () => {
    expect(ECONOMY_PAGE_CAP_PX).toBe(1920);
    expect(STATEMENT_MAX_CH).toBe(44);
    expect(PROSE_MAX_CH).toBe(78);
  });

  it('the HUD width band is 280-360px', () => {
    expect(HUD_MIN_PX).toBe(280);
    expect(HUD_MAX_PX).toBe(360);
  });

  it('a wider frame gains no region — surplus goes to window, cells, map and breathing room', () => {
    const screen = code(join(__dirname, '..', '..', 'components', 'economy', 'EconomyScreen.tsx'));
    // the resident region list is not conditional on width
    expect(screen).not.toMatch(/frameWidth\s*[>=<]+\s*\d+\s*&&\s*</);
  });
});

describe('ECON-UI-1 · disclosure routing', () => {
  it('drawer widths are per-content and fixed at every breakpoint', () => {
    expect(DRAWER_WIDTH_PX.REVISION_TRACK).toBe(520);
    expect(DRAWER_WIDTH_PX.COMPETING_READINGS).toBe(620);
    expect(DRAWER_WIDTH_PX.TRANSMISSION_CHAIN).toBe(460);
    for (const w of Object.values(DRAWER_WIDTH_PX)) {
      expect(w).toBeGreaterThanOrEqual(460);
      expect(w).toBeLessThanOrEqual(620);
    }
  });

  it('drawers replace and never stack — there is no stack to push to', () => {
    const screen = code(join(__dirname, '..', '..', 'components', 'economy', 'EconomyScreen.tsx'));
    expect(screen).toMatch(/useState<DrawerKind \| null>/);
    expect(screen).not.toMatch(/drawers|drawerStack|\.push\(/);
  });

  it('one HUD at a time', () => {
    const screen = code(join(__dirname, '..', '..', 'components', 'economy', 'EconomyScreen.tsx'));
    expect(screen).toMatch(/useState\(initialHudOpen\)/);
    expect(screen).not.toMatch(/huds|hudStack/);
  });

  it('compact sheets replace and never stack, and the detents are Economy-owned', () => {
    const compact = code(join(__dirname, '..', '..', 'components', 'economy', 'compact', 'EconomyCompactScreen.tsx'));
    expect(compact).toMatch(/useState<CompactSurface>/);
    expect(compact).not.toMatch(/sheets|sheetStack|\.push\(/);
    expect(ECONOMY_SHEET_DETENTS.peekPx).toBe(180);
    expect(ECONOMY_SHEET_DETENTS.halfPercent).toBe(55);
  });

  it('does not touch the shared Spatial sheet contract', () => {
    for (const f of ECONOMY_FILES) {
      expect(code(f)).not.toMatch(/spatialSheet|MapSheet|shared.*detent/i);
    }
  });
});

describe('ECON-UI-1 · object model integrity', () => {
  it('an Observation carries no mutator and no in-place superseded value', () => {
    const types = read(join(__dirname, 'types.ts'));
    // ECON-UI-CONTRACT-ADAPT-1: the observation is the SHARED type now, so this asserts the
    // same property where it actually lives. Economy no longer declares one to check.
    expect(read(join(__dirname, 'types.ts'))).toMatch(/export type Observation = EconomyObservation;/);
    const shared = read(join(__dirname, '..', '..', '..', '..', 'shared', 'src', 'economy', 'index.ts'));
    const block = /interface EconomyObservation \{([\s\S]*?)\n\}/.exec(shared)![1]!;
    // every field readonly; nothing that would let a revision overwrite a value
    expect(block).not.toMatch(/^\s{2}(?!readonly)\w+[?]?:/m);
    expect(block).not.toMatch(/supersededValue|previousValue|setValue/);
    // and the value is no longer nullable — absence is a GAP slot, not a null in a reading
    expect(block).toMatch(/readonly value: number;/);
    expect(block).not.toMatch(/value: number \| null/);
  });

  it('consensus is a derived benchmark with no release status', () => {
    const shared = read(join(__dirname, '..', '..', '..', '..', 'shared', 'src', 'economy', 'index.ts'));
    const block = /interface EconomyConsensusBenchmark \{([\s\S]*?)\n\}/.exec(shared)![1]!;
    expect(block).not.toMatch(/releaseStatus/);
    // the contract types the kind itself, so a consensus cannot claim to be an observation
    expect(block).toMatch(/valueKind: Extract<EconomyValueKind, 'DERIVED'>/);
    expect(shared).toMatch(/assertConsensusIsNotObservation/);
  });


  it('a country economy basket has no aggregate score field', () => {
    const types = read(join(__dirname, 'types.ts'));
    const block = /interface EconomyWatchScope \{([\s\S]*?)\n\}/.exec(types)![1]!;
    expect(block).not.toMatch(/score|aggregate|index|overall|composite[VS]/i);
    expect(block).toMatch(/members/);
  });

  it('the Watch basket is always rendered decomposed', () => {
    expect(RWANDA_SUBJECT.watch.members.length).toBeGreaterThan(1);
    const contents = code(join(__dirname, '..', '..', 'components', 'economy', 'DrawerContents.tsx'));
    expect(contents).toContain('data-econ="basket-member"');
  });

  it('relation words come from the closed set only', () => {
    const types = read(join(__dirname, 'types.ts'));
    const block = /type RelationWord =([\s\S]*?);/.exec(types)![1]!;
    const words = block.match(/'[A-Z_]+'/g) ?? [];
    expect(words.sort()).toEqual([
      "'ASSOCIATED_WITH'", "'CONTRIBUTES_TO'", "'EXPOSURE_THROUGH'",
      "'ORIGIN_OF'", "'POTENTIAL_TRANSMISSION_CHANNEL'",
    ]);
  });

  it('the change states are the shared seven and Economy adds none', () => {
    // Bound to the platform set. Economy declares no members, so it cannot add an eighth.
    expect(WATCH_CHANGE_STATES).toHaveLength(7);
    expect(read(join(__dirname, 'types.ts'))).toMatch(/export type ChangeState = WatchChangeState;/);
    expect(code(join(__dirname, 'types.ts'))).not.toMatch(/ChangeState\s*=\s*$/m);
  });


  it('the three figure axes stay independent — none is merged into another', () => {
    const shared = read(join(__dirname, '..', '..', '..', '..', 'shared', 'src', 'economy', 'index.ts'));
    const block = /interface EconomyValueSemantics \{([\s\S]*?)\n\}/.exec(shared)![1]!;
    expect(block).toMatch(/releaseStatus: EconomyReleaseStatus \| null/);
    expect(block).toMatch(/valueKind: EconomyValueKind/);
    expect(block).toMatch(/freshness: EconomyFreshness/);
    // AVAILABILITY IS NOT ON THIS AXIS ANY MORE — the category error the contract corrected.
    expect(block).not.toMatch(/UNAVAILABLE|unavailableReason/);
  });

});

describe('ECON-UI-1 · no Economy-local platform copies', () => {
  it('no Economy-local AI surface', () => {
    for (const f of ECONOMY_FILES) {
      expect(code(f)).not.toMatch(/EconomyAi\b|economyPrompt|EconomyAssistant|localAnalysis/i);
    }
  });

  it('no Economy-local Watch backend or monitor', () => {
    for (const f of ECONOMY_FILES) {
      expect(code(f)).not.toMatch(/setInterval|setTimeout\(|poll\(|monitorLoop|EconomyAlert/i);
    }
  });

  it('no Economy accent — the token placeholders carry no hue of their own', () => {
    const tokens = read(join(__dirname, '..', '..', 'components', 'economy', 'econTokens.ts'));
    const hexes = tokens.match(/#[0-9a-f]{6}/gi) ?? [];
    expect(hexes.length).toBeGreaterThan(0);

    // Raw channel spread is the wrong instrument: it scales with lightness, so a
    // light step of a perfectly neutral ramp separates more than a dark one at the
    // same saturation. DEP-2 forbids an Economy ACCENT — i.e. a domain-identifying
    // hue. The measurable forms of that are (a) a chromatic token and (b) a second
    // hue family alongside the neutral ramp. Both are asserted below.
    const hues: number[] = [];
    for (const h of hexes) {
      const r = parseInt(h.slice(1, 3), 16) / 255;
      const g = parseInt(h.slice(3, 5), 16) / 255;
      const b = parseInt(h.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      const l = (max + min) / 2;
      const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      // (a) no chromatic token: every placeholder is a desaturated neutral
      expect(s).toBeLessThanOrEqual(0.2);
      if (d > 0) {
        let hue: number;
        if (max === r) hue = ((g - b) / d) % 6;
        else if (max === g) hue = (b - r) / d + 2;
        else hue = (r - g) / d + 4;
        hue = ((hue * 60) + 360) % 360;
        hues.push(hue);
      }
    }
    // (b) one ramp, not a ramp plus an accent: every non-grey token sits in a
    // single narrow hue family. An accent would appear here as a second cluster.
    if (hues.length > 0) {
      expect(Math.max(...hues) - Math.min(...hues)).toBeLessThanOrEqual(30);
    }
    expect(tokens).not.toMatch(/ECONOMY_ACCENT(?!_TBD)/);
  });

  it('does not alter the global token registry', () => {
    // the Economy module never imports or writes tailwind config
    for (const f of ECONOMY_FILES) expect(code(f)).not.toMatch(/tailwind\.config/);
  });
});

describe('ECON-UI-1 · capability gating', () => {
  it('corridor rendering defaults to the DEGRADED branch, never to an invented route', () => {
    expect(SPATIAL_CAPABILITY.corridorRendering).toBe('ENDPOINT_ONLY');
  });

  it('the route connector exists only in the supported branch', () => {
    const substrate = code(join(__dirname, '..', '..', 'components', 'economy', 'Substrate.tsx'));
    expect(substrate).toMatch(/supported && i < corridor\.endpoints\.length - 1/);
  });

  it('Watch trigger binding is feature-gated while the shared runtime cannot receive it', () => {
    expect(DEV_WATCH_RUNTIME.acceptsLifecycleTriggers).toBe(false);
    const contents = code(join(__dirname, '..', '..', 'components', 'economy', 'DrawerContents.tsx'));
    expect(contents).toContain('data-econ="watch-binding-gated"');
  });
});

describe('ECON-UI-1 · localisation posture (A8)', () => {
  it('Economy strings are externalizable and resolve through one accessor', () => {
    expect(economyStrings('en').nav).toBe('Economy');
    const r = resolveEconomyStrings('en');
    expect(r.fellBack).toBe(false);
  });

  it('a locale OUTSIDE the catalogue falls back VISIBLY, never silently', () => {
    // R1 — this used `pl`, which now has its own authored Economy content. The
    // guarantee is unchanged and still the point: a locale the catalogue does
    // not hold resolves to English and SAYS so. Only the way of reaching that
    // branch moved, because every contracted locale is now authored.
    const r = resolveEconomyStrings('zz' as DisplayLocale);
    expect(r.fellBack).toBe(true);
    expect(r.requested).toBe('zz');
    expect(r.resolved).toBe('en');
  });

  it('reports which contracted locales still await Economy content', () => {
    // Re-authored for ECON-A8-1 over the SEVEN contracted display locales. The previous
    // expectation used ['en','pl','fr','es','ar'] — five values that happen to be members of
    // BOTH DisplayLocale and LanguageCode, which is exactly why it kept passing while the
    // binding was wrong. de and pt are the discriminating cases and are now included.
    // R1 — L-LANG-CATALOG-ECON-AR-CLOSURE-1 supplied all six, 83 fields each, so
    // the list this reports is now empty. The report is unchanged; there is
    // nothing left for it to report.
    expect(economyLocalesAwaitingContent([...DISPLAY_LOCALES])).toEqual([]);
  });

  it('no component branches on a language literal', () => {
    for (const f of ECONOMY_FILES) {
      expect(code(f)).not.toMatch(/locale\s*===\s*['"]/);
      expect(code(f)).not.toMatch(/language\s*===\s*['"]/);
    }
  });

  it('layout is RTL-safe: no physical inline direction on Economy surfaces', () => {
    for (const f of ECONOMY_FILES) {
      const src = code(f);
      expect(src).not.toMatch(/marginLeft|marginRight|paddingLeft|paddingRight|\bleft:|\bright:/);
      expect(src).not.toMatch(/textAlign:\s*'(left|right)'/);
    }
  });

  it('the map/corridor geometry is never mirrored', () => {
    const substrate = code(join(__dirname, '..', '..', 'components', 'economy', 'Substrate.tsx'));
    expect(substrate).not.toMatch(/scaleX\(-1\)|transform:\s*'scaleX/);
  });

  it('machine-readable values stay LTR-isolated on the Economy frames', () => {
    const screen = code(join(__dirname, '..', '..', 'components', 'economy', 'EconomyScreen.tsx'));
    const compact = code(join(__dirname, '..', '..', 'components', 'economy', 'compact', 'EconomyCompactScreen.tsx'));
    expect(screen).toContain('dir="ltr"');
    expect(compact).toContain('dir="ltr"');
  });
});

describe('ECON-UI-1 · compact contract', () => {
  it('the compact band and reference frame are the specified ones', () => {
    expect(COMPACT_MIN_PX).toBe(375);
    expect(COMPACT_REFERENCE_PX).toBe(390);
    expect(COMPACT_MAX_PX).toBe(430);
    expect(COMPACT_HIT_TARGET_PX).toBe(44);
  });

  it('the vertical order is assessment, then rail, then feed', () => {
    const compact = read(join(__dirname, '..', '..', 'components', 'economy', 'compact', 'EconomyCompactScreen.tsx'));
    const a = compact.indexOf('data-econ="compact-state-header"');
    const b = compact.indexOf('data-econ="compact-indicator-rail"');
    const c = compact.indexOf('data-econ="compact-attention"');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('originating geographic context is preserved when a Spatial object brought the reader here', () => {
    const compact = code(join(__dirname, '..', '..', 'components', 'economy', 'compact', 'EconomyCompactScreen.tsx'));
    expect(compact).toMatch(/enteredFrom/);
    expect(compact).toContain('data-econ="compact-geography"');
    // and it is NOT inferred from the subject kind
    expect(compact).not.toMatch(/kind === 'CORRIDOR'/);
  });

  it('the corridor subject is a substrate switch, not a different frame', () => {
    expect(CORRIDOR_SUBJECT.substrate).toBe('MAP_DOMINANT');
    expect(RWANDA_SUBJECT.substrate).toBe('DATA_DOMINANT');
  });

  it('release status survives the squeeze while kind and freshness collapse', () => {
    const compact = code(join(__dirname, '..', '..', 'components', 'economy', 'compact', 'EconomyCompactScreen.tsx'));
    expect(compact).toMatch(/collapse\s*\/?>/);
    const tags = code(join(__dirname, '..', '..', 'components', 'economy', 'FigureTags.tsx'));
    // under collapse the release status is still pushed; kind and freshness are not
    expect(tags).toMatch(/if \(axes\.releaseStatus\) \{[\s\S]*?\}\s*if \(!collapse\)/);
  });
});

describe('ECON-UI-1 · fixtures are illustrative, never production facts', () => {
  it('fixtures are confined to the fixture module', () => {
    for (const f of ECONOMY_FILES) {
      if (f.endsWith('fixtures.ts')) continue;
      // The governed retained adapter names its real source; it must never import fixtures.
      expect(code(f)).not.toMatch(/(?:from\s*|import\s*\()['"][^'"]*\/fixtures['"]/);
      if (!f.endsWith('economyRetainedSubject.ts')) {
        expect(code(f)).not.toMatch(/Rwanda|Mombasa|Kigali|Poland|NISR|GUS/);
      }
    }
  });

  it('states the illustrative rule in the fixture module itself', () => {
    expect(read(join(__dirname, 'fixtures.ts'))).toMatch(/ILLUSTRATIVE AND MUST NOT BE TREATED AS A PRODUCTION FACT/);
  });

  it('supplies attentionRank as explicit fixture input', () => {
    for (const r of RW_ATTENTION) expect(typeof r.attentionRank).toBe('number');
  });
});


/* ================================================================== *
 * ECON-DATA-1 — THE DATA BOUNDARY
 *
 * G's ECON-DATA-1 measured the producer surface and returned two verdicts that bind this
 * lane. These guards hold the frontend to them.
 * ================================================================== */

describe('ECON-UI-1 · ECON-DATA-1 · no numeric time-series producer', () => {
  it('the production-shaped capability is NO_OBSERVATION_SOURCE, not OBSERVED', () => {
    // Flipping this to OBSERVED requires a measured producer, not a fixture module.
    expect(ECONOMY_DATA_CAPABILITY.numericObservations).toBe('NO_OBSERVATION_SOURCE');
    expect(hasObservationSource(ECONOMY_DATA_CAPABILITY)).toBe(false);
  });

  it('fixtures are never the production capability, and fixtures are not observations', () => {
    expect(FIXTURE_DATA_CAPABILITY.numericObservations).toBe('FIXTURE');
    expect(hasObservationSource(FIXTURE_DATA_CAPABILITY)).toBe(false);
    expect(ECONOMY_DATA_CAPABILITY).not.toBe(FIXTURE_DATA_CAPABILITY);
  });

  it('every capability value resolves to exactly one of three render modes', () => {
    expect(observationMode({ numericObservations: 'OBSERVED' })).toBe('OBSERVED');
    expect(observationMode({ numericObservations: 'FIXTURE' })).toBe('FIXTURE');
    expect(observationMode({ numericObservations: 'NO_OBSERVATION_SOURCE' })).toBe('NO_SOURCE');
  });

  it('the honest unavailable state exists as a real surface, not a thrown error', () => {
    const f = read(join(__dirname, '..', '..', 'components', 'economy', 'DataAvailability.tsx'));
    expect(f).toMatch(/data-econ="no-observation-data"/);
    expect(f).toMatch(/data-observation-source="absent"/);
    // It must not print a zero or a unit-bearing placeholder that reads as a value.
    expect(f).not.toMatch(/>\s*0(\.0+)?\s*%?\s*</);
  });

  it('the production-shaped subject contains no numeric observation whatsoever', () => {
    const subject = PRODUCTION_SHAPED_SUBJECT;
    for (const s of subject.indicators) {
      /*
        ECON-UI-CONTRACT-ADAPT-1. Absence is no longer "an observation whose value is null with
        freshness UNAVAILABLE". It is a GAP slot, and the slot cannot exist without a reason.
        The reason here is NO_PRODUCER, which the pre-contract vocabulary could not express.
      */
      expect(s.latest.kind).toBe('GAP');
      expect(figureIsGap(s.latest)).toBe(true);
      expect(gapReason(s.latest)).toBe('NO_PRODUCER');
      expect(figureObservation(s.latest)).toBeNull();
      // A gap has no axes at all — not empty axes, none.
      expect(figureSemantics(s.latest)).toBeNull();
      expect(s.history).toHaveLength(0);
      expect(s.triad).toBeNull();
    }
    // A9: attentionRank comes from data. With no producer there is no rank and no row.
    expect(subject.attention).toHaveLength(0);
    expect(assessmentObservedVintages(subject.assessment)).toHaveLength(0);
    // DEP-3: the basket stays decomposed even when empty. Never one aggregate value.
    expect(subject.watch.members.length).toBeGreaterThan(1);
    expect(subject.watch.members.every((m) => !m.enabled)).toBe(true);
  });

  /* B4-A PENDING — reads app/economy/* — no route is registered in B4-A. */
  it.skip('the production route imports no fixture, and the fixture route names itself', () => {
    const appDir = join(__dirname, '..', '..', 'app', 'economy');
    const prod = read(join(appDir, 'page.tsx'));
    expect(prod).not.toMatch(/from '@\/lib\/economy\/fixtures'/);
    expect(prod).toMatch(/ECONOMY_DATA_CAPABILITY/);
    expect(prod).not.toMatch(/FIXTURE_DATA_CAPABILITY/);

    const demo = read(join(appDir, 'fixture-demo', 'page.tsx'));
    expect(demo).toMatch(/FIXTURE_DATA_CAPABILITY/);
    // The demo route is noindex — a fixture surface is never offered to a crawler.
    expect(demo).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it('fixture mode declares itself on screen, not only in code', () => {
    const f = read(join(__dirname, '..', '..', 'components', 'economy', 'DataAvailability.tsx'));
    expect(f).toMatch(/data-econ="fixture-banner"/);
    for (const name of ['EconomyScreen.tsx', 'compact/EconomyCompactScreen.tsx']) {
      const screen = read(join(__dirname, '..', '..', 'components', 'economy', name));
      expect(screen).toMatch(/mode === 'FIXTURE' && <FixtureBanner/);
    }
  });

  /* B4-A PENDING — reads components/economy/IndicatorStrip.tsx — the domain-local duplicate, deliberately NOT recovered. The ECON-DATA-1 behaviour it guards now lives in economyIndicatorStripAdapter.ts and is covered by b4aEconomySubstrate.spec.ts. */
  it.skip('the surfaces withhold observation-derived encodings when no source exists', () => {
    const header = read(join(__dirname, '..', '..', 'components', 'economy', 'EconomicStateHeader.tsx'));
    const strip = read(join(__dirname, '..', '..', 'components', 'economy', 'IndicatorStrip.tsx'));
    // change state, confidence and the axes line are all observation-derived
    expect(header).toMatch(/observationsAvailable && \(/);
    expect(strip).toMatch(/observationsAvailable && figureSemantics\(o\)/);
    // the direction arrow describes movement between observations
    expect(strip).toMatch(/observationsAvailable && figureIsObservation\(o\)/);
  });

  it('no frontend economic-data provider, scraper or assessment scorer exists', () => {
    for (const f of ECONOMY_FILES) {
      const src = code(f);
      /*
        THE GOVERNED READ IS EXEMPT FROM THE TOKEN, NOT FROM THE RULE.

        Every clause below still binds on it — no scraper vocabulary, no scoring, no
        normalising, no synthesising, no Math.random, no interpolation — and one more
        binds on it alone: it must hold a RELATIVE path, so the request cannot leave
        this deployment. That is the same property the accepted `accountFetch` guard
        protects, asserted here for the second module that now has it.
      */
      if (f.endsWith(GOVERNED_READ)) {
        expect(src).not.toMatch(/https?:\/\//);
        expect(src).not.toMatch(/axios|XMLHttpRequest|EventSource|WebSocket/);
      } else {
        // no fetching of economic data from anywhere
        expect(src).not.toMatch(/\bfetch\s*\(|axios|XMLHttpRequest|EventSource|WebSocket/);
      }
      // no local provider / scraper vocabulary
      expect(src).not.toMatch(/scrape|crawler|DataProvider|EconomyProvider|ingest\(/i);
      // no local scoring, normalising or synthesising of values
      expect(src).not.toMatch(/scoreAssessment|computeAssessment|normali[sz]eValue|synthesi[sz]e|Math\.random|interpolat/i);
    }
  });

  it('no series value is ever derived from another series value', () => {
    for (const f of ECONOMY_FILES) {
      if (f.endsWith('fixtures.ts')) continue;
      // the surface consumes typed input; it does not compute economics
      expect(code(f)).not.toMatch(/yoy|momAnnuali[sz]ed|realTerms|deflate|seasonallyAdjust/i);
    }
  });
});

describe('ECON-UI-1 · ECON-DATA-1 · corridor route geometry is ENDPOINT_ONLY', () => {
  it('the measured capability resolves to ENDPOINT_ONLY, never to ROUTE_GEOMETRY', () => {
    expect(SPATIAL_CAPABILITY.corridorRendering).toBe('ENDPOINT_ONLY');
  });

  it('the route-supported branch is retained but reachable only by capability', () => {
    const sub = read(join(__dirname, '..', '..', 'components', 'economy', 'Substrate.tsx'));
    // the branch still exists, for a future producer
    expect(sub).toMatch(/capability === 'ROUTE_SUPPORTED'/);
    // and the connector is emitted ONLY inside it
    expect(sub).toMatch(/\{supported && i < corridor\.endpoints\.length - 1 &&/);
  });

  it('no straight line is synthesised merely because two endpoints exist', () => {
    for (const f of ECONOMY_FILES) {
      const src = code(f);
      // no geometry construction of any kind in this lane
      expect(src).not.toMatch(/LineString|GeoJSON|greatCircle|interpolatePath|bezier|polyline/i);
    }
  });

  it('vocabulary tokens are not treated as evidence that geometry exists', () => {
    // The capability is a constant read from configuration. Nothing infers it from a
    // field name, a subject kind, or the presence of endpoints.
    const cfg = read(join(__dirname, 'economyConfig.ts'));
    expect(cfg).not.toMatch(/corridorRendering\s*[:=][^;]*\?/);
    for (const f of ECONOMY_FILES) {
      expect(code(f)).not.toMatch(/corridorRendering\s*=\s*(?!SPATIAL_CAPABILITY)['"`]/);
    }
  });

  it('the degraded branch states the reason on screen, using the measured verdict', () => {
    const sub = read(join(__dirname, '..', '..', 'components', 'economy', 'Substrate.tsx'));
    expect(sub).toMatch(/NO ROUTE GEOMETRY EXPOSED/);
    expect(sub).toMatch(/ENDPOINT_ONLY/);
  });

  it('corridor geography survives an absent producer; corridor figures do not', () => {
    const sub = read(join(__dirname, '..', '..', 'components', 'economy', 'Substrate.tsx'));
    expect(sub).toMatch(/data-econ="corridor-throughput-absent"/);
    // endpoints are still rendered — geography is not a numeric observation
    expect(sub).toMatch(/corridor\.endpoints\.map/);
  });
});


/* ================================================================== *
 * ECON-A8-1 — THE DISPLAY-LOCALE CORRECTION
 *
 * Economy's user-facing strings must be keyed by the canonical LANG-UI-7 DISPLAY type, not
 * by the source-intelligence retrieval type. These guards pin the corrected binding and,
 * just as importantly, pin the two directions in which the old binding was wrong: it OMITTED
 * de/pt and it ADMITTED sw/rw.
 * ================================================================== */

describe('ECON-A8-1 · EconomyLocale is the canonical DisplayLocale', () => {
  it('binds the shared display type by import, not by re-declaring the set', () => {
    const src = read(join(__dirname, 'strings.ts'));
    expect(src).toMatch(/import type \{ DisplayLocale \} from '@globalnews-ai\/shared'/);
    expect(src).toMatch(/export type EconomyLocale = DisplayLocale;/);
    // The analysis/retrieval set must no longer reach this display surface IN CODE. It is
    // named in the correction's own comment on purpose — explaining what was wrong is not
    // the same as depending on it — so this asserts over comment-stripped source.
    expect(code(join(__dirname, 'strings.ts'))).not.toMatch(/LanguageCode/);
    // and Economy must not re-declare a locale set of its own
    expect(src).not.toMatch(/=\s*\[\s*'en'\s*,\s*'pl'/);
  });

  it('EconomyLocale and DisplayLocale are mutually assignable (identical, not merely overlapping)', () => {
    const toEconomy = (l: DisplayLocale): EconomyLocale => l;   // DisplayLocale -> EconomyLocale
    const toDisplay = (l: EconomyLocale): DisplayLocale => l;   // EconomyLocale -> DisplayLocale
    for (const l of DISPLAY_LOCALES) expect(toDisplay(toEconomy(l))).toBe(l);
  });

  it('DE is accepted as an Economy display locale', () => {
    const de: EconomyLocale = 'de';
    const r = resolveEconomyStrings(de);
    expect(r.requested).toBe('de');
    expect(economyStrings(de)).toBeDefined();
    expect(DISPLAY_LOCALES).toContain('de');
  });

  it('PT is accepted as an Economy display locale', () => {
    const pt: EconomyLocale = 'pt';
    const r = resolveEconomyStrings(pt);
    expect(r.requested).toBe('pt');
    expect(economyStrings(pt)).toBeDefined();
    expect(DISPLAY_LOCALES).toContain('pt');
  });

  it('AR remains accepted, and remains an RTL display locale', () => {
    const ar: EconomyLocale = 'ar';
    const r = resolveEconomyStrings(ar);
    expect(r.requested).toBe('ar');
    expect(economyStrings(ar)).toBeDefined();
    expect(DISPLAY_LOCALES).toContain('ar');
  });

  it('RW is NOT a production display locale', () => {
    expect((DISPLAY_LOCALES as readonly string[])).not.toContain('rw');
    // and Economy never names it
    for (const f of ECONOMY_FILES) expect(code(f)).not.toMatch(/['"]rw['"]/);
  });

  it('SW is NOT a production display locale', () => {
    expect((DISPLAY_LOCALES as readonly string[])).not.toContain('sw');
    for (const f of ECONOMY_FILES) expect(code(f)).not.toMatch(/['"]sw['"]/);
  });

  it('sw and rw are NOT removed from the source-language set — this correction is display-only', () => {
    // ECON-A8-1 must not amputate the retrieval vocabulary while fixing the display one.
    const analysis = read(join(__dirname, '..', '..', '..', '..', 'shared', 'src', 'analysis.ts'));
    expect(analysis).toMatch(/LanguageCode/);
    expect(analysis).toMatch(/'sw'/);
    expect(analysis).toMatch(/'rw'/);
  });
});

describe('ECON-A8-1 · catalogue coverage over all seven, with no silent fallback', () => {
  it('the catalogue is keyed by the seven contracted display locales', () => {
    const awaiting = economyLocalesAwaitingContent([...DISPLAY_LOCALES]);
    const authored = DISPLAY_LOCALES.filter((l) => !awaiting.includes(l));
    expect([...authored, ...awaiting].sort()).toEqual([...DISPLAY_LOCALES].sort());
    expect([...authored].sort()).toEqual([...DISPLAY_LOCALES].sort());
    expect(awaiting).toEqual([]);
  });

  it('every unauthored locale reports its fallback VISIBLY — none resolves silently', () => {
    for (const l of DISPLAY_LOCALES) {
      const r = resolveEconomyStrings(l);
      expect(r.requested).toBe(l);
      // R1 — all seven are authored, so none falls back. The DISCLOSURE is
      // asserted separately, on a value the catalogue genuinely lacks.
      expect(r.fellBack).toBe(false);
      expect(r.resolved).toBe(l);
      expect(r.strings).toBeDefined();
    }
  });

  /* B4-A PENDING — requires the LANG-UI-7 dictionary resolution shape from the deferred multilingual block (BETA REFERENCE — RECOVER WITH ADAPTATION). */
  it.skip('uses the SAME resolution shape as the accepted LANG-UI-7 dictionaries — not a second architecture', () => {
    const econ = read(join(__dirname, 'strings.ts'));
    const shared = read(join(__dirname, '..', 'i18n', 'dictionaries', 'index.ts'));
    for (const field of ['requested', 'resolved', 'fellBack']) {
      expect(econ).toMatch(new RegExp(`readonly ${field}`));
      expect(shared).toMatch(new RegExp(`readonly ${field}`));
    }
    // Economy defines no second selector, cookie, storage key or precedence order
    for (const f of ECONOMY_FILES) {
      expect(code(f)).not.toMatch(/SELECTABLE_LOCALES\s*=/);
      expect(code(f)).not.toMatch(/localStorage|document\.cookie/);
      expect(code(f)).not.toMatch(/navigator\.language/);
    }
  });
});

describe('ECON-A8-1 · route integration uses the platform locale mechanism', () => {
  const ROUTES = [
    join(__dirname, '..', '..', 'app', 'economy', 'page.tsx'),
    join(__dirname, '..', '..', 'app', 'economy', 'compact', 'page.tsx'),
    join(__dirname, '..', '..', 'app', 'economy', 'fixture-demo', 'page.tsx'),
    join(__dirname, '..', '..', 'app', 'economy', 'fixture-demo', 'compact', 'page.tsx'),
    join(__dirname, '..', '..', 'app', 'economy', 'fixture-demo', 'corridor', 'page.tsx'),
    join(__dirname, '..', '..', 'app', 'economy', 'fixture-demo', 'compact-corridor', 'page.tsx'),
  ];

  /* B4-A PENDING — reads app/economy/* — no route is registered in B4-A. */
  it.skip('no Economy route hard-codes a locale literal any more', () => {
    for (const r of ROUTES) {
      expect(read(r)).not.toMatch(/locale="[a-z]{2}"/);
      expect(read(r)).toMatch(/locale=\{economyLocale\(\)\}/);
    }
  });

  /* B4-A PENDING — reads app/economy/* — no route is registered in B4-A. */
  it.skip('every route reads the PLATFORM cookie and the platform guard — no Economy mechanism', () => {
    for (const r of ROUTES) {
      const src = read(r);
      expect(src).toMatch(/import \{ cookies \} from 'next\/headers'/);
      expect(src).toMatch(/LANGUAGE_COOKIE_NAME/);
      expect(src).toMatch(/isActiveLanguageCode/);
      // persistence is the platform's cookie; Economy writes nothing
      expect(src).not.toMatch(/document\.cookie|localStorage|setLanguage/);
    }
  });

  /* B4-A PENDING — reads app/economy/* — no route is registered in B4-A. */
  it.skip('the route helper returns EconomyLocale and defaults to en, never throws', () => {
    for (const r of ROUTES) {
      const src = read(r);
      expect(src).toMatch(/function economyLocale\(\): EconomyLocale/);
      expect(src).toMatch(/: 'en';/);
    }
  });

  /* B4-A PENDING — reads app/economy/* — no route is registered in B4-A. The property itself IS asserted, on SELECTABLE_LOCALES, in b31EconomyPrerequisites.spec.ts. */
  it.skip('Economy does not widen what the deployment offers', () => {
    // The registry decision stays with the platform: no route may reference the registries
    // in CODE and iterate or bypass them. The route comment names SELECTABLE_LOCALES to
    // record the boundary deliberately, so this asserts over comment-stripped source.
    for (const r of ROUTES) {
      expect(code(r)).not.toMatch(/DISPLAY_LOCALES|SELECTABLE_LOCALES/);
    }
  });
});

describe('ECON-A8-1 · no regression in the Arabic / MachineReadable contracts', () => {
  it('MachineReadable usage on Economy frames is unchanged', () => {
    const screen = code(join(__dirname, '..', '..', 'components', 'economy', 'EconomyScreen.tsx'));
    expect(screen).toMatch(/MachineReadable|data-econ/);
  });

  /* ------------------------------------------------------------------ *
   * CONF-1 — RECONCILED UNDER CTO RULING (LANG-UI-7-D7-AR-ADOPTION-PLAN-B-R1)
   *
   * WHAT CHANGED AND WHY. This guard previously asserted that Economy source
   * contained no `--ar-ls-mul` at all. That was written as a fence for the
   * display-locale correction lane: it stopped THAT lane drifting into
   * typography. Read literally it also forbade Economy from *consuming* the
   * canonical shared Arabic policy — which put it in direct conflict with the
   * binding rule that human Arabic tracking is 0, because Economy sets
   * letter-spacing inline where no ancestor run can reach it.
   *
   * The CTO ruling separates the two things the old token test conflated:
   *
   *   AUTHORING a tracking policy   — still forbidden. Economy must never
   *                                   WRITE an `--ar-*` custom property, and
   *                                   must not define its own Arabic value,
   *                                   multiplier, or second pipeline.
   *   CONSUMING the shared policy   — now required. Reading
   *                                   `var(--ar-ls-mul, 1)` is the canonical
   *                                   inherited mechanism, and is allowed.
   *
   * The distinction is mechanical and is enforced below: a WRITE is a
   * declaration of `--ar-*`; a READ is `var(--ar-*, <latin fallback>)`. Reads
   * are stripped, and nothing beginning `--ar-` may remain.
   * ------------------------------------------------------------------ */

  /** Source with every canonical READ removed, so only WRITES can remain. */
  const withoutPolicyReads = (src: string) => src.replace(/var\(\s*--ar-[a-z0-9-]+[^)]*\)/g, 'CANONICAL_READ');

  it('CONF-1 · 1 — Economy authors NO Arabic tracking policy of its own', () => {
    for (const f of ECONOMY_FILES) {
      const src = withoutPolicyReads(code(f));
      // No Economy file may DECLARE a policy variable...
      expect(src).not.toMatch(/--ar-/);
      // ...nor invent a parallel name for the same idea.
      expect(src).not.toMatch(/(arabicTracking|arTracking|arabicLetterSpacing|AR_TRACKING|AR_LETTER_SPACING|arabicFontWeight|AR_WEIGHT)/i);
      // ...nor reach for the escape hatches this contract has always refused.
      expect(src).not.toMatch(/font-synthesis/);
      expect(src).not.toMatch(/scaleX\(-1\)/);
    }
  });

  /* B4-A PENDING — requires ScriptRun + arabicRunPolicy — the recorded Alpha language decoupling; this tree exports only MachineReadable. */
  it.skip('CONF-1 · 2 — the shared ScriptRun policy is the only writer of --ar-*', () => {
    // The policy module says so of itself ("the only writers of --ar-* in the
    // whole system"). This asserts it across the entire frontend, so a second
    // pipeline cannot appear anywhere — in Economy or outside it.
    const ROOT = join(__dirname, '..', '..');
    const all: string[] = [];
    const walkAll = (dir: string): void => {
      for (const e of readdirSync(dir)) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) { if (e !== 'node_modules') walkAll(full); }
        else if (/\.tsx?$/.test(e) && !/\.spec\.tsx?$/.test(e)) all.push(full);
      }
    };
    walkAll(ROOT);
    const writers = all.filter((f) => /--ar-/.test(withoutPolicyReads(code(f))));
    expect(writers.map((f) => f.replace(ROOT + '/', '')).sort()).toEqual(['lib/typography/arabicRunPolicy.ts']);
  });

  /* B4-A PENDING — requires ScriptRun + arabicRunPolicy — see above. */
  it.skip('CONF-1 · 3 — computed Arabic tracking is 0, from the canonical variable', () => {
    // The policy zeroes the multiplier on BOTH Arabic human run markers.
    // The block is read to its own closing brace — a fixed-width window would
    // bleed into the next marker and pass on a neighbour's value.
    const policy = readFileSync(join(__dirname, '..', 'typography', 'arabicRunPolicy.ts'), 'utf8');
    for (const marker of ['[data-run="ar-human"]', '[data-run="ar-human-wrap"]']) {
      const start = policy.indexOf(`'${marker}'`);
      expect(start).toBeGreaterThan(-1);
      const open = policy.indexOf('{', start);
      const close = policy.indexOf('}', open);
      const block = policy.slice(open, close);
      expect(block).toContain(marker === '[data-run="ar-human"]' ? "[V.lh]:     '1.35'" : "[V.lh]:     '1.55'");
      expect(block).toMatch(/\[V\.lsMul\]:\s*'0',/);
      expect(block).not.toMatch(/\[V\.lsMul\]:\s*'0\.[0-9]+',/);
    }
    // ...and every Economy tracking site multiplies through that variable, so
    // inside an Arabic run the product is exactly 0 for all of them.
    let sites = 0;
    for (const f of ECONOMY_FILES) {
      for (const m of code(f).matchAll(/letterSpacing: *'([^']*)'/g)) {
        sites++;
        expect(m[1]).toMatch(/^calc\(-?[\d.]+em \* var\(--ar-ls-mul, 1\)\)$/);
      }
    }
    expect(sites).toBeGreaterThan(0);
  });

  it('CONF-1 · 4 — Latin Economy tracking is unchanged: the fallback is always 1', () => {
    // Outside an Arabic run `--ar-ls-mul` is unset, so each site falls back to
    // `* 1` and computes its original Latin value. A fallback of anything but 1
    // would silently restyle Latin, which this lane forbids.
    for (const f of ECONOMY_FILES) {
      for (const m of code(f).matchAll(/var\(--ar-ls-mul,\s*([^)]*)\)/g)) {
        expect(m[1].trim()).toBe('1');
      }
    }
  });

  /* B4-A PENDING — requires ScriptRun + arabicRunPolicy — see above. */
  it.skip('CONF-1 · 5 — MachineReadable islands keep Latin behaviour', () => {
    // The island resets every policy variable to `initial`, so each var() falls
    // through to its own Latin fallback — including the tracking multiplier.
    const policy = readFileSync(join(__dirname, '..', 'typography', 'arabicRunPolicy.ts'), 'utf8');
    const iStart = policy.indexOf(`'[data-run="latin-mr"]'`);
    expect(iStart).toBeGreaterThan(-1);
    const iOpen = policy.indexOf('{', iStart);
    const island = policy.slice(iOpen, policy.indexOf('}', iOpen));
    // every policy variable back to `initial`, so each var() takes its Latin fallback
    for (const v of ['fsMin', 'lh', 'lsMul', 'tt', 'fw700', 'family']) {
      expect(island).toMatch(new RegExp(`\\[V\\.${v}\\]:\\s*'initial'`));
    }
    expect(island).toMatch(/direction: 'ltr'/);
    expect(island).toMatch(/'unicode-bidi': 'isolate'/);
    // and Economy still uses the island on its frames
    const screen = code(join(__dirname, '..', '..', 'components', 'economy', 'EconomyScreen.tsx'));
    expect(screen).toMatch(/MachineReadable|data-econ/);
  });

  it('Economy modifies no shared LANG-UI-7 contract', () => {
    for (const f of ECONOMY_FILES) {
      const src = code(f);
      expect(src).not.toMatch(/DISPLAY_LOCALES\s*=/);
      expect(src).not.toMatch(/arabicRunPolicy|runBoundary/);
    }
  });
});

/* ================================================================== *
 * ECON-UI-CONTRACT-ADAPT-1 — THE FRONTEND CONSUMES THE SHARED CONTRACT
 *
 * The lane's whole point is that Economy no longer carries a second semantic read model.
 * These guards pin that: the canonical sets are imported, not re-declared; the corrected
 * vocabulary is in use; and the old spellings cannot come back.
 * ================================================================== */

const SHARED_ECON = join(__dirname, '..', '..', '..', '..', 'shared', 'src', 'economy', 'index.ts');

describe('ECON-UI-CONTRACT-ADAPT-1 · no duplicate canonical semantic types', () => {
  it('types.ts declares no canonical union of its own — every semantic type is a binding', () => {
    const src = code(join(__dirname, 'types.ts'));
    // The nine types Main's §7.1 named must be aliases, not declarations.
    for (const [name, shared] of [
      ['ReleaseStatus', 'EconomyReleaseStatus'], ['ValueKind', 'EconomyValueKind'],
      ['Freshness', 'EconomyFreshness'], ['SourceClass', 'EconomyClaimKind'],
      ['Period', 'EconomyPeriod'], ['Observation', 'EconomyObservation'],
      ['ConsensusBenchmark', 'EconomyConsensusBenchmark'], ['Corridor', 'EconomyCorridor'],
      ['FigureAxes', 'EconomyValueSemantics'],
    ] as const) {
      expect(src).toMatch(new RegExp(`export type ${name} = ${shared};`));
    }
    // ChangeState binds to the platform seven
    expect(src).toMatch(/export type ChangeState = WatchChangeState;/);
  });

  it('no Economy file re-spells a canonical member', () => {
    for (const f of ECONOMY_FILES) {
      if (f.endsWith('economyAdapters.ts') || f.endsWith('fixtures.ts')) continue; // legacy bridges
      const src = code(f);
      expect(src).not.toMatch(/'PRELIM'/);       // superseded spelling of PRELIMINARY
      expect(src).not.toMatch(/'ESTIMATED'/);    // never a fifth value kind
      /*
        NARROWED TO WHAT IT PROTECTS: `UNAVAILABLE` must never be a FRESHNESS.

        The blanket form also matched a READ-RESULT discriminant — `{ kind:
        'UNAVAILABLE', reason }` — which is Market’s accepted shape and the one H's
        inventory told the other seven surfaces to copy. Renaming it to satisfy a grep
        would have forked the shape; the rule is stated against the collision it was
        written for instead.
      */
      expect(src).not.toMatch(/freshness\s*[:=]\s*'UNAVAILABLE'/);
      expect(src).not.toMatch(/Freshness\s*=\s*'UNAVAILABLE'/);
      expect(src).not.toMatch(/'UNAVAILABLE'\s*\|\s*'(FRESH|AGEING|STALE|UNDETERMINED)'/);
      expect(src).not.toMatch(/'ROUTE_GEOMETRY'/); // canonical name is ROUTE_SUPPORTED
      expect(src).not.toMatch(/unavailableReason/);
    }
  });

  it('the semantic types come from the shared package, not from a local file', () => {
    const types = read(join(__dirname, 'types.ts'));
    expect(types).toMatch(/from '@globalnews-ai\/shared'/);
    expect(types).not.toMatch(/export type ReleaseStatus = '/);
    expect(types).not.toMatch(/export type ValueKind = '/);
    expect(types).not.toMatch(/export type Freshness = '/);
  });
});

describe('ECON-UI-CONTRACT-ADAPT-1 · gap-slot integration', () => {
  it('absence is a GAP with a reason, never a null value', () => {
    const shared = read(SHARED_ECON);
    expect(shared).toMatch(/kind: 'GAP'/);
    // no Economy file may model absence as a nullable figure value any more
    for (const f of ECONOMY_FILES) {
      // fixtures.ts is the declared legacy-input boundary: its builder ACCEPTS a nullable
      // literal and converts it into a GAP. That conversion is the point — it is where the
      // old vocabulary stops. No model or component may carry a nullable figure value.
      if (!f.endsWith('fixtures.ts')) expect(code(f)).not.toMatch(/value: number \| null/);
      expect(code(f)).not.toMatch(/value\s*\?\?\s*0/);   // the zero-substitution defect
    }
  });

  it('a GAP cannot be constructed without a reason', () => {
    // economyGap requires the reason positionally; the shared type requires it structurally.
    const adapters = read(join(__dirname, 'economyAdapters.ts'));
    expect(adapters).toMatch(/reason: EconomyFigureGapReason,\n\): EconomyFigureSlot/);
    const slot = economyGap('s-x', 's-x:p1', 'NO_PRODUCER');
    expect(slot.kind).toBe('GAP');
    expect(figureIsGap(slot) && slot.reason).toBe('NO_PRODUCER');
    expect(figureSemantics(slot)).toBeNull();
    expect(figureObservation(slot)).toBeNull();
  });

  it('the figure primitive takes a slot, so a value can never arrive without its semantics', () => {
    const tags = read(join(__dirname, '..', '..', 'components', 'economy', 'FigureTags.tsx'));
    expect(tags).toMatch(/slot: FigureSlot;/);
    expect(tags).not.toMatch(/value: number \| null;/);
    expect(tags).toMatch(/export function figureText\(slot: FigureSlot\): string/);
  });

  it('the production-shaped subject states NO_PRODUCER — a reason the old model could not express', () => {
    for (const s of PRODUCTION_SHAPED_SUBJECT.indicators) {
      expect(gapReason(s.latest)).toBe('NO_PRODUCER');
    }
  });

  /*
    ALPHA-ECONOMY-READINESS-R1 — AND IT STATES NO CADENCE EITHER.

    The same rule as the assessment, applied to the one field that was still guessing. The
    contract carries it in the doc comment on both the type and the field — "ABSENT rather than
    guessed" — and UNDETERMINED freshness is the supported consequence, not a degraded one.

    The literal is forbidden at the SOURCE as well as in the value, because a later edit that
    reintroduces it would otherwise only be caught if someone happened to read the six objects.
    Fixtures keep theirs: `fixtures.ts` is a self-declaring demo whose cadences are authored
    deliberately and vary per series, which is exactly what a producer supplies.
  */
  it('and it states NO CADENCE, because no publisher states one', () => {
    for (const s of PRODUCTION_SHAPED_SUBJECT.indicators) {
      expect([s.model.seriesId, s.model.cadence]).toEqual([s.model.seriesId, undefined]);
    }
    expect(code(join(__dirname, 'productionSubject.ts'))).not.toMatch(/cadence:\s*'[A-Z]+'/);
  });
});

describe('ECON-UI-CONTRACT-ADAPT-1 · release / value / freshness / assessment / corridor', () => {
  it('release status is the canonical five and stays nullable', () => {
    expect(ECONOMY_RELEASE_STATUSES).toEqual(['SCHEDULED', 'PRELIMINARY', 'REVISED', 'FINAL', 'WITHDRAWN']);
    const t = economyStrings('en');
    expect(Object.keys(t.releaseStatus).sort()).toEqual([...ECONOMY_RELEASE_STATUSES].sort());
    expect(read(SHARED_ECON)).toMatch(/releaseStatus: EconomyReleaseStatus \| null/);
  });

  it('value kind is ACTUAL · FORECAST · DERIVED · TARGET, with no ESTIMATED', () => {
    expect(ECONOMY_VALUE_KINDS).toEqual(['ACTUAL', 'FORECAST', 'DERIVED', 'TARGET']);
    expect((ECONOMY_VALUE_KINDS as readonly string[])).not.toContain('ESTIMATED');
    expect(Object.keys(economyStrings('en').valueKind).sort()).toEqual([...ECONOMY_VALUE_KINDS].sort());
  });

  it('freshness carries no availability member', () => {
    expect(ECONOMY_FRESHNESS_STATES).toEqual(['FRESH', 'AGEING', 'STALE', 'UNDETERMINED']);
    expect((ECONOMY_FRESHNESS_STATES as readonly string[])).not.toContain('UNAVAILABLE');
    expect(Object.keys(economyStrings('en').freshness).sort()).toEqual([...ECONOMY_FRESHNESS_STATES].sort());
    // absence has its own vocabulary instead
    expect(Object.keys(economyStrings('en').gapReason).sort())
      .toEqual(['DISCONTINUED', 'NOT_COLLECTED', 'NO_PRODUCER', 'WITHHELD'].sort());
  });

  it('assessment change state is the platform seven, and INSUFFICIENT_EVIDENCE is null', () => {
    expect(WATCH_CHANGE_STATES).toHaveLength(7);
    expect(read(SHARED_ECON)).toMatch(/changeState: WatchChangeState \| null/);
    // the contract's own legacy map proves the ruling rather than my reading of it
    expect(ECONOMY_LEGACY_DATA_CHANGE_STATE.INSUFFICIENT_EVIDENCE).toBeNull();
  });

  it('corridor capability is canonical and still resolves to ENDPOINT_ONLY', () => {
    expect(ECONOMY_CORRIDOR_CAPABILITIES).toEqual(['ROUTE_SUPPORTED', 'ENDPOINT_ONLY']);
    expect(SPATIAL_CAPABILITY.corridorRendering).toBe('ENDPOINT_ONLY');
    expect(ECONOMY_LEGACY_UI_CORRIDOR_CAPABILITY.ROUTE_GEOMETRY).toBe('ROUTE_SUPPORTED');
    // and no route is synthesised anywhere
    for (const f of ECONOMY_FILES) {
      expect(code(f)).not.toMatch(/LineString|greatCircle|polyline|bezier/i);
    }
  });

  it('observation availability keeps NO_OBSERVATION_SOURCE and uses the shared helper', () => {
    expect(ECONOMY_DATA_CAPABILITY.numericObservations).toBe('NO_OBSERVATION_SOURCE');
    expect(economyHasObservationSource('NO_OBSERVATION_SOURCE')).toBe(false);
    expect(economyHasObservationSource('OBSERVED')).toBe(true);
    expect(economyHasObservationSource('FIXTURE')).toBe(false);
  });
});


/* ================================================================== *
 * ECON-UI-ASSESSMENT-R1 — THE FRONTEND COUNTERPART OF ECON-ASSESS-1 / -3
 *
 * Main measured that the frontend kept a parallel local Assessment whose change state was
 * non-null, and that the production subject asserted NO_MATERIAL_CHANGE over zero observations
 * while the measured capability was NO_OBSERVATION_SOURCE. The rendered chip was hidden, so the
 * SCREEN was honest and the OBJECT was not. These guards make the object honest, and make the
 * dishonest shape unrepresentable rather than merely absent.
 * ================================================================== */

/** Every Assessment reachable from this module, production and fixture alike. */
const ALL_ASSESSMENTS: readonly { readonly where: string; readonly a: EconomyUiAssessment }[] = [
  { where: 'PRODUCTION_SHAPED_SUBJECT', a: PRODUCTION_SHAPED_SUBJECT.assessment },
  { where: 'RWANDA_SUBJECT (fixture)', a: RW_SUBJ_FOR_ASSESS.assessment },
  { where: 'CORRIDOR_SUBJECT (fixture)', a: CORRIDOR_SUBJECT.assessment },
];

describe('ECON-UI-ASSESSMENT-R1 · SharedAssessment is actually consumed', () => {
  it('the local Assessment composes the shared model — no parallel semantic fields remain', () => {
    const src = code(join(__dirname, 'types.ts'));
    // Scoped to the Assessment BLOCK. `AttentionRow.changeState` is a different type — a feed
    // row's state arrives with the row and is legitimately non-null — so a file-wide assertion
    // would have condemned a correct declaration.
    const block = /export interface Assessment \{([\s\S]*?)\n\}/.exec(src)![1]!;
    expect(block).toMatch(/readonly model: SharedAssessment \| null;/);
    expect(block).not.toMatch(/readonly changeState:/);
    expect(block).not.toMatch(/readonly priorChangeState:/);
    expect(block).not.toMatch(/computedFromObservationIds/);
    // and the parallel field is gone from the module entirely
    expect(src).not.toMatch(/computedFromObservationIds/);
  });

  it('SharedAssessment is referenced beyond its own declaration', () => {
    const src = code(join(__dirname, 'types.ts'));
    const uses = (src.match(/SharedAssessment/g) ?? []).length;
    // one declaration + at least one real consumption
    expect(uses).toBeGreaterThan(1);
  });

  it('no surface reads a change state off a local field — all go through the accessor', () => {
    for (const f of ECONOMY_FILES) {
      if (f.endsWith('types.ts')) continue;               // the accessors live here
      expect(code(f)).not.toMatch(/assessment\.changeState/);
      expect(code(f)).not.toMatch(/assessment\.priorChangeState/);
    }
  });
});

describe('ECON-UI-ASSESSMENT-R1 · a change state requires observation evidence', () => {
  it('THE GUARD: zero observed vintages implies a null change state', () => {
    for (const { where, a } of ALL_ASSESSMENTS) {
      const vintages = assessmentObservedVintages(a);
      const state = assessmentChangeState(a);
      if (vintages.length === 0) {
        expect(`${where}: ${String(state)}`).toBe(`${where}: null`);
      }
    }
  });

  it('the converse: a non-null change state always names the vintages behind it', () => {
    for (const { where, a } of ALL_ASSESSMENTS) {
      if (assessmentChangeState(a) !== null) {
        expect(`${where}: ${assessmentObservedVintages(a).length}`).not.toBe(`${where}: 0`);
      }
    }
  });

  it('every constructed shared model satisfies the accepted accountability rule', () => {
    for (const { where, a } of ALL_ASSESSMENTS) {
      if (a.model) {
        // ECON-ASSESS-1/-2/-3, enforced by the CONTRACT'S OWN assertion, not by a local re-test
        expect(() => assertAssessmentIsAccountable(a.model!)).not.toThrow();
        expect(where).toBeTruthy();
      }
    }
  });

  it('a null change state always states why — ECON-ASSESS-3 on the frontend side', () => {
    for (const { where, a } of ALL_ASSESSMENTS) {
      if (assessmentChangeState(a) === null) {
        expect(`${where}: ${String(assessmentChangeStateReason(a))}`).not.toBe(`${where}: undefined`);
      }
    }
  });

  it('the production no-source assessment: no model, null state, reason NO_OBSERVATION_SOURCE', () => {
    const a = PRODUCTION_SHAPED_SUBJECT.assessment;
    expect(a.model).toBeNull();
    expect(assessmentChangeState(a)).toBeNull();
    expect(assessmentChangeStateReason(a)).toBe('NO_OBSERVATION_SOURCE');
    expect(assessmentObservedVintages(a)).toHaveLength(0);
    // and it does not name a state anywhere in its source
    // Comment-stripped: the correction's own comment quotes the old defective line to explain
    // what was wrong, and naming a defect in prose is not committing it.
    expect(code(join(__dirname, 'productionSubject.ts'))).not.toMatch(/changeState: '[A-Z_]+'/);
  });

  it('no Economy file fabricates an observation to satisfy the assessment', () => {
    for (const f of ECONOMY_FILES) {
      if (f.endsWith('fixtures.ts')) continue;
      expect(code(f)).not.toMatch(/observedVintages: \['/);
    }
  });
});
