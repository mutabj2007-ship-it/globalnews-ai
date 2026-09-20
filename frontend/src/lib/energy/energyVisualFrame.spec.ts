import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  CHANGE_CAUSE_STATES,
  CHANGE_SERVICE_STATES,
  PART_XI_PLACEHOLDER_DECOMPOSITION,
  causeMustBeShown,
  changeStateTokens,
} from '@/lib/observation/changeState';
import {
  ENERGY_CAPABILITY_STATUS,
  ENERGY_HELD_CAPABILITIES,
  EXPOSURE_FLOOR,
  RIGHTS_FLOOR,
  decideAssetPresentation,
  readerAvailability,
  rightsGrantIsReaderVisible,
} from '@/lib/energy/energyDisclosure';
import {
  ENERGY_METADATA_CLAMP,
  ENERGY_META_COUNT_STYLE,
  ENERGY_META_RECENCY_STYLE,
  ENERGY_META_ROW_STYLE,
  ENERGY_META_STATEMENT_STYLE,
  ENERGY_ROW_COLUMNS,
  ENERGY_STATE_AXIS_GAP_PX,
  ENERGY_STATE_CAUSE_STYLE,
  ENERGY_STATE_PX_PER_CHAR,
  ENERGY_STATE_SERVICE_STYLE,
  ellipsisPermitted,
  formatMetaCount,
  formatMetaRecency,
  longestSharedPrefix,
  metaAccessibleName,
  metadataSlotStyle,
  minimumUnambiguousPrefix,
  serviceAxisStyle,
  splitMetaRecency,
  truncationCollides,
  worstCaseServicePx,
} from '@/lib/energy/energyOverflow';
import { isSecurityGate } from '@/components/energy/EnergyParts';
import {
  ENERGY_DEFAULT_SUBSTRATE,
  ENERGY_DEFAULT_WINDOW,
  ENERGY_GATES,
  ENERGY_READER_STATES,
  ENERGY_STATE_TREATMENT,
  ENERGY_SUBJECT_TYPES,
  canonicalMemberFor,
  effectiveWindow,
  energySandPrice,
  evidenceIsHidden,
  quietStateFor,
  readerStateForCanonical,
  systemScopeMayCarryGeometry,
  windowFallsBackToSevenDay,
} from '@/lib/energy/energyFrame';
import {
  ENERGY_ARABIC_METADATA_FLOOR_PX,
  ENERGY_LAYOUT as LAYOUT,
  ENERGY_SCRIPT_TOKEN_CSS,
  ENERGY_SEMANTIC,
  ENERGY_TYPE as TYPE,
} from '@/lib/energy/energyTokens';
import {
  ENERGY_DEFAULT_URL_STATE,
  energyHref,
  energyStateFromSearchParams,
  searchParamsWithEnergyState,
} from '@/lib/energy/energyUrl';
import { ENERGY_GOVERNED_FRAME } from '@/lib/energy/energyGoverned';
import { ENERGY_DESIGN_FIXTURE_FRAME } from '@/lib/energy/energyFixtures';
import { energyStrings, formatEnergyString } from '@/lib/energy/energyStrings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART XI ENERGY — THE GUARD SUITE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Each guard below pins a sentence from an accepted authority. Where a property
 * can be MEASURED rather than asserted, it is measured: the network guarantee
 * is a walk of the module graph, not a promise about it.
 */

const SRC = join(__dirname, '..', '..');
const ROUTE = join(SRC, 'app', 'energy', 'page.tsx');

const read = (f: string): string => readFileSync(f, 'utf-8');

/** Source with comments removed — a rule NAMED in a comment is not a rule BROKEN. */
function code(file: string): string {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && /\.tsx?$/.test(candidate)) return candidate;
  }
  return null;
}

/** Everything reachable from the route, transitively. Properties are asserted of THIS. */
function reachable(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const m of code(file).matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const next = resolveImport(file, m[1] as string);
      if (next !== null && !seen.has(next)) queue.push(next);
    }
  }
  return [...seen].sort();
}

const GRAPH = reachable([ROUTE]);
const ENERGY_FILES = GRAPH.filter((f) => /[\\/](lib[\\/]energy|components[\\/]energy)[\\/]/.test(f) && !f.endsWith('.spec.ts'));

/* ═══ 0 · THE INSTRUMENT ══════════════════════════════════════════════════ */

describe('0 · the walk reaches what it claims to reach', () => {
  it('starts at the one real route', () => {
    expect(existsSync(ROUTE)).toBe(true);
    expect(GRAPH).toContain(ROUTE);
  });

  it('pulls in the whole Energy frame, so later guards are about the shipped graph', () => {
    const names = ENERGY_FILES.map((f) => f.split(/[\\/]/).pop());
    for (const expected of [
      'energyFrame.ts',
      'energyUrl.ts',
      'energyStrings.ts',
      'energyModel.ts',
      'energyGoverned.ts',
      'energyTokens.ts',
      'EnergyShell.tsx',
      'EnergyParts.tsx',
      'EnergySpatialSubstrate.tsx',
      'EnergyChangeGrid.tsx',
      'EnergyFlowSankey.tsx',
      'EnergySubjectSurfaces.tsx',
      'EnergyAskOverlay.tsx',
    ]) {
      expect(names).toContain(expected);
    }
  });
});

/* ═══ 1 · H01 — ONE ROUTE FAMILY ══════════════════════════════════════════ */

describe('1 · H01 · one route family, state in the URL', () => {
  it('there is no /energy-a, -b, -c or -d, measured against the route directory', () => {
    const routes = readdirSync(join(SRC, 'app'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const energyRoutes = routes.filter((name) => name.startsWith('energy'));
    expect(energyRoutes).toEqual(['energy']);
  });

  it('defaults are ABSENT from the query — "no parameter" and "the default" are the same thing', () => {
    expect(energyHref(ENERGY_DEFAULT_URL_STATE)).toBe('/energy');
    expect(searchParamsWithEnergyState(null, ENERGY_DEFAULT_URL_STATE).toString()).toBe('');
  });

  it('round-trips every non-default combination', () => {
    const state = { substrate: 'flows', subject: 'hormuz', window: '30d', frame: 'design-fixture' } as const;
    const params = searchParamsWithEnergyState(null, state);
    expect(energyStateFromSearchParams(params)).toEqual(state);
  });

  it('a default REMOVES its key rather than writing it, so a shared link is not brittle', () => {
    const params = searchParamsWithEnergyState(new URLSearchParams('substrate=flows&window=30d'), ENERGY_DEFAULT_URL_STATE);
    expect(params.has('substrate')).toBe(false);
    expect(params.has('window')).toBe(false);
  });

  it('every decoder survives hostile input, because a URL is hand-typed', () => {
    for (const hostile of ['../../etc', '<script>', 'a'.repeat(500), '', '%%%']) {
      const params = new URLSearchParams();
      params.set('substrate', hostile);
      params.set('window', hostile);
      params.set('subject', hostile);
      params.set('frame', hostile);
      const state = energyStateFromSearchParams(params);
      expect(state.substrate).toBe(ENERGY_DEFAULT_SUBSTRATE);
      expect(state.window).toBe(ENERGY_DEFAULT_WINDOW);
      expect(state.frame).toBe('governed');
      expect(state.subject === null || /^[a-z0-9][a-z0-9_-]*$/i.test(state.subject)).toBe(true);
    }
  });

  it('EXACTLY ONE writer touches the address bar', () => {
    const shell = code(join(SRC, 'components', 'energy', 'EnergyShell.tsx'));
    expect(shell.match(/router\.(replace|push)\(/g) ?? []).toHaveLength(1);
    for (const file of ENERGY_FILES.filter((f) => !f.endsWith('EnergyShell.tsx'))) {
      expect(code(file)).not.toMatch(/router\.(replace|push)\(/);
    }
  });

  it('the lens and Ask are NOT in the URL — "D is not a route"', () => {
    const url = code(join(SRC, 'lib', 'energy', 'energyUrl.ts'));
    expect(url).not.toMatch(/['"]lens['"]\s*:/);
    expect(url).not.toMatch(/QUERY_KEY\s*=\s*['"](lens|ask|sheet)['"]/);
  });
});

/* ═══ 2 · THE NETWORK GUARANTEE, MEASURED ═════════════════════════════════ */

describe('2 · entering /energy executes 0 providers and 0 models', () => {
  /**
   * THIS IS A PROPERTY OF THE GRAPH, NOT A CLAIM ABOUT IT. The sweep runs over
   * every file the route can reach, so a future import of a provider client
   * fails here rather than in production.
   */
  it('no file in the Energy graph can make a request', () => {
    for (const file of ENERGY_FILES) {
      const source = code(file);
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/XMLHttpRequest|EventSource|WebSocket/);
      expect(source).not.toMatch(/\baxios\b/);
    }
  });

  it('no provider, model or tile host appears anywhere in the Energy graph', () => {
    const hosts = /openai|anthropic|gnews|newsapi|entsoe|entso-e|eia\.gov|iea\.org|gie\.eu|agsi|alsi|platts|argus|kpler|vortexa|marinetraffic|mapbox|maptiler|tile\.openstreetmap|api\.maptiler/i;
    for (const file of ENERGY_FILES) {
      expect(code(file)).not.toMatch(hosts);
    }
  });

  it('the MapLibre style is fully local — no style URL, no glyphs, no sprites, no tile source', () => {
    const substrate = code(join(SRC, 'components', 'energy', 'EnergySpatialSubstrate.tsx'));
    expect(substrate).toMatch(/sources:\s*\{\s*\}/);
    expect(substrate).not.toMatch(/glyphs|sprite|['"]https?:\/\//);
    /* Geometry is an IMPORT, not a request. */
    expect(substrate).toMatch(/getCountryFeatureCollection/);
  });

  it('the route awaits nothing, so a page load has nothing to wait for', () => {
    const route = code(ROUTE);
    expect(route).not.toMatch(/\bawait\b/);
    expect(route).not.toMatch(/async function/);
  });
});

/* ═══ 3 · THE FOUR ABSENCE STATES ═════════════════════════════════════════ */

describe('3 · four reader states, distinct by treatment and label', () => {
  it('there are exactly four, and each has its own treatment', () => {
    expect(ENERGY_READER_STATES).toHaveLength(4);
    const treatments = ENERGY_READER_STATES.map((state) => ENERGY_STATE_TREATMENT[state]);
    expect(new Set(treatments).size).toBe(4);
  });

  it('every state has a label AND a sentence saying why, in both languages', () => {
    for (const locale of ['en', 'pl'] as const) {
      const strings = energyStrings(locale);
      for (const state of ENERGY_READER_STATES) {
        expect(strings.state[state].length).toBeGreaterThan(0);
        /*
          The test is that the reason is a SENTENCE — it ends in a full stop and
          says more than the chip already said. A character count was the first
          instrument here and it was wrong: "Brak dostępnego zapisu." is a
          complete and correct reason at 23 characters, and a threshold would
          have pushed L toward padding it.
        */
        expect(strings.stateWhy[state].trim()).toMatch(/[.!]$/);
        expect(strings.stateWhy[state]).not.toBe(strings.state[state]);
        expect(strings.stateWhy[state].split(' ').length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('NOT_CONNECTED and TEMPORARILY_UNAVAILABLE are NEVER collapsed into COVERAGE GAP', () => {
    expect(readerStateForCanonical('NOT_CONNECTED')).not.toBe('COVERAGE_GAP');
    expect(readerStateForCanonical('TEMPORARILY_UNAVAILABLE')).not.toBe('COVERAGE_GAP');
    /* And the canonical member is never derivable from the reader state. */
    expect(canonicalMemberFor('NO_DATA')).toBe('NO_DATA');
  });

  it('NO MATERIAL CHANGE is a RESULT — it has no canonical absence member at all', () => {
    expect(canonicalMemberFor('NO_MATERIAL_CHANGE')).toBeNull();
  });

  it('the quiet state is unreachable when nothing was reviewed', () => {
    expect(quietStateFor(0)).toBe('COVERAGE_GAP');
    expect(quietStateFor(1)).toBe('NO_MATERIAL_CHANGE');
  });

  it('the state chip has no prop through which a value could reach it', () => {
    const parts = code(join(SRC, 'components', 'energy', 'EnergyParts.tsx'));
    const chip = parts.slice(parts.indexOf('interface StateChipProps'), parts.indexOf('export function StateChip'));
    expect(chip).not.toMatch(/value|count|amount|figure|reading/i);
  });
});

/* ═══ 4 · SILENCE NEVER IMPLIES SAFETY ════════════════════════════════════ */

describe('4 · the rule that outranks every other', () => {
  it('no reader string anywhere says normal, stable, healthy, OK or all clear', () => {
    const forbidden = /\b(normal operations|all normal|stable supply|no disruption|healthy|all clear|nominal)\b/i;
    for (const locale of ['en', 'pl'] as const) {
      const corpus = JSON.stringify(energyStrings(locale));
      /* The words may appear only inside a sentence that NEGATES them. */
      const offending = corpus.match(forbidden) ?? [];
      for (const hit of offending) {
        const index = corpus.indexOf(hit);
        const context = corpus.slice(Math.max(0, index - 80), index + hit.length);
        expect(context).toMatch(/not|never|nie/i);
      }
    }
  });

  it('a green "normal operations" is unrepresentable — the only green token is MINT, which is Watch', () => {
    const tokens = code(join(SRC, 'lib', 'energy', 'energyTokens.ts'));
    const greens = (tokens.match(/#[0-9A-Fa-f]{6}/g) ?? []).filter((hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return g > 150 && g > r + 40 && g > b + 20;
    });
    expect(greens).toEqual([ENERGY_SEMANTIC.mint]);
  });

  it('every zone in the governed frame carries a reason, not only a state', () => {
    for (const [zone, state] of Object.entries(ENERGY_GOVERNED_FRAME.zones)) {
      expect(state).toBeDefined();
      expect(ENERGY_READER_STATES).toContain(state?.readerState);
      expect(zone.length).toBeGreaterThan(0);
    }
  });

  it('the governed frame contains NO energy value of any kind', () => {
    const governed = code(join(SRC, 'lib', 'energy', 'energyGoverned.ts'));
    /* No numeric literal outside the zone declarations, and no unit anywhere. */
    expect(governed).not.toMatch(/ene:/);
    expect(governed).not.toMatch(/sharePct|levelPct|MW|GWh/);
    expect(ENERGY_GOVERNED_FRAME.subjects).toHaveLength(0);
    expect(ENERGY_GOVERNED_FRAME.changeRows).toHaveLength(0);
    expect(ENERGY_GOVERNED_FRAME.storage).toHaveLength(0);
    expect(ENERGY_GOVERNED_FRAME.dependence).toHaveLength(0);
    expect(ENERGY_GOVERNED_FRAME.flowLinks).toHaveLength(0);
    expect(ENERGY_GOVERNED_FRAME.spatialGeometry).toHaveLength(0);
  });
});

/* ═══ 5 · THE PRICE MAIN DID NOT SET ══════════════════════════════════════ */

describe('5 · M07 · never a number Main did not set', () => {
  it('the price resolver returns a sentinel, not a number', () => {
    expect(typeof energySandPrice()).toBe('symbol');
  });

  it('the Sand affordance has no number prop to fill in', () => {
    const parts = code(join(SRC, 'components', 'energy', 'EnergyParts.tsx'));
    const affordance = parts.slice(parts.indexOf('export function SandAffordance'), parts.indexOf('export function SectionLabel'));
    expect(affordance).not.toMatch(/price\s*[:?]\s*number|sand\s*[:?]\s*number|\bcost\b/i);
  });

  it("the design's illustrative 12 / 18 / 24 / 142 did not cross into the implementation", () => {
    for (const file of ENERGY_FILES) {
      expect(code(file)).not.toMatch(/\b(12|18|24|142)\s*SAND\b/i);
      expect(code(file)).not.toMatch(/sand:\s*\d/i);
    }
  });
});

/* ═══ 6 · M05 · THE 7D FALLBACK STATES ITSELF ═════════════════════════════ */

describe('6 · M05 · the window fallback is explicit, never silent', () => {
  it('the default window is 7D, not "since last visit"', () => {
    expect(ENERGY_DEFAULT_WINDOW).toBe('7d');
  });

  it('asking for "since last visit" without a checkpoint resolves to 7D and SAYS SO', () => {
    expect(windowFallsBackToSevenDay('visit', false)).toBe(true);
    expect(effectiveWindow('visit', false)).toBe('7d');
    for (const locale of ['en', 'pl'] as const) {
      const strings = energyStrings(locale);
      expect(strings.windowFallbackLabel).toMatch(/7/);
      expect(strings.windowFallbackWhy.length).toBeGreaterThan(40);
    }
  });

  it('the platform has no visit checkpoint, and neither data set manufactures one', () => {
    expect(ENERGY_GOVERNED_FRAME.hasVisitCheckpoint).toBe(false);
    expect(ENERGY_DESIGN_FIXTURE_FRAME.hasVisitCheckpoint).toBe(false);
  });
});

/* ═══ 7 · GEOMETRY, PRECISION AND SYSTEM SCOPE ════════════════════════════ */

describe('7 · precision is mandatory; a system scope has no geometry to fabricate', () => {
  it('every geometry shape in the model carries a precision field', () => {
    const model = code(join(SRC, 'lib', 'energy', 'energyModel.ts'));
    for (const shape of ['EnergyLineGeometry', 'EnergyRegionGeometry', 'EnergySystemScope']) {
      const start = model.indexOf(`interface ${shape}`);
      const body = model.slice(start, model.indexOf('}', start));
      expect(body).toMatch(/precision/);
    }
  });

  it('a system scope admits no coordinates at all', () => {
    const model = code(join(SRC, 'lib', 'energy', 'energyModel.ts'));
    const start = model.indexOf('interface EnergySystemScope');
    const body = model.slice(start, model.indexOf('}', start));
    expect(body).not.toMatch(/path|bbox|lat|lon|coordinates|iso3/i);
    expect(systemScopeMayCarryGeometry('systemScope')).toBe(false);
  });

  it('a withheld geometry names the gate that withheld it', () => {
    for (const subject of ENERGY_DESIGN_FIXTURE_FRAME.subjects) {
      if (subject.geometry === null) expect(subject.geometryWithheldBy).not.toBeNull();
    }
  });

  it('E01 withholds asset-level geometry and NOTHING ELSE', () => {
    expect(ENERGY_GATES.E01.stops).toMatch(/asset-level geometry/);
    expect(ENERGY_GATES.E01.doesNotStop).toMatch(/corridor/);
    /* The asset subject is withheld on the substrate yet remains a full subject. */
    const asset = ENERGY_DESIGN_FIXTURE_FRAME.subjects.find((s) => s.type === 'INFRASTRUCTURE_ASSET');
    expect(asset?.geometry).toBeNull();
    expect(asset?.geometryWithheldBy).toBe('E01');
    expect(asset?.evidence.length).toBeGreaterThan(0);
    expect(asset?.assessment).not.toBeNull();
  });

  it('a grid situation and a derived regional situation are system scopes, not places', () => {
    const grid = ENERGY_DESIGN_FIXTURE_FRAME.subjects.find((s) => s.type === 'GRID_SITUATION');
    const supply = ENERGY_DESIGN_FIXTURE_FRAME.subjects.find((s) => s.type === 'SUPPLY_SITUATION');
    expect(grid?.geometry?.kind).toBe('systemScope');
    expect(supply?.geometry?.kind).toBe('systemScope');
  });
});

/* ═══ 8 · M04 · FOUR SUBJECT TYPES, CHOKEPOINT IS A ROLE ══════════════════ */

describe('8 · M04 · the four subject types, ruled', () => {
  it('there are exactly four, and Generation System is not among them', () => {
    expect(ENERGY_SUBJECT_TYPES).toHaveLength(4);
    expect(ENERGY_SUBJECT_TYPES).not.toContain('GENERATION_SYSTEM');
    expect(ENERGY_SUBJECT_TYPES).not.toContain('TRANSITION_PROGRAMME');
  });

  it('chokepoint is a ROLE on a corridor, never a type', () => {
    expect(ENERGY_SUBJECT_TYPES).not.toContain('CHOKEPOINT');
    const chokepoints = ENERGY_DESIGN_FIXTURE_FRAME.subjects.filter((s) => s.corridorRole === 'chokepoint');
    expect(chokepoints.length).toBeGreaterThan(0);
    chokepoints.forEach((s) => expect(s.type).toBe('CORRIDOR'));
  });
});

/* ═══ 9 · EVIDENCE, UNITS AND OWNERSHIP ═══════════════════════════════════ */

describe('9 · evidence is retained; units are rendered as carried; Market is not restated', () => {
  it('a disputed artifact has no hiding branch anywhere in the frame', () => {
    expect(evidenceIsHidden('DISPUTED')).toBe(false);
    const disputed = ENERGY_DESIGN_FIXTURE_FRAME.subjects.flatMap((s) => s.evidence).filter((e) => e.role === 'DISPUTED');
    expect(disputed.length).toBeGreaterThan(0);
    for (const file of ENERGY_FILES) {
      expect(code(file)).not.toMatch(/filter\([^)]*DISPUTED/);
    }
  });

  it('there is no conversion function, factor table or scale map anywhere', () => {
    /*
      NARROWED, AND THE WITHDRAWAL IS RECORDED. The first sweep was a bare-word
      /FACTOR/i and it fired on a design fixture — "naval activity assessed as
      proximate FACTOR" — which is English prose, not a conversion table. A
      guard that fails on the word rather than on the mechanism teaches a reader
      to route around it. The shapes below are identifiers, not vocabulary.
    */
    const mechanism = /\bconvertUnit\b|\btoMWh\b|\btoGWh\b|FACTOR_TABLE|CONVERSION_|SCALE_MAP|UNIT_FACTORS/i;
    for (const file of ENERGY_FILES) {
      expect(code(file)).not.toMatch(mechanism);
    }
    /* Negative control: the guard must be capable of firing. */
    expect('const UNIT_FACTORS = { MWh: 1 };').toMatch(mechanism);
  });

  it('Energy has no field in which to restate a Market figure', () => {
    const model = code(join(SRC, 'lib', 'energy', 'energyModel.ts'));
    expect(model).not.toMatch(/\bprice\b|\bcurrency\b|\bspread\b|\btrade\b/i);
  });

  it('a cross-domain reference that finds nothing SAYS SO', () => {
    const absent = ENERGY_DESIGN_FIXTURE_FRAME.subjects
      .flatMap((s) => s.crossDomain)
      .filter((r) => r.state === 'NO_ASSESSED_CONSEQUENCE');
    expect(absent.length).toBeGreaterThan(0);
    absent.forEach((r) => expect(r.summary).toBeNull());
    for (const locale of ['en', 'pl'] as const) {
      expect(energyStrings(locale).crossDomainNoConsequence.length).toBeGreaterThan(10);
    }
  });
});

/* ═══ 10 · H04 · THE CHANGE GRID'S GEOMETRY ═══════════════════════════════ */

describe('10 · H04 · geometry now, words later', () => {
  it('28 / 14 columns, 60px rows, 22px bands — the contract numbers', () => {
    expect(LAYOUT.changeColumnsWide).toBe(28);
    expect(LAYOUT.changeColumnsNarrow).toBe(14);
    expect(LAYOUT.changeRowHeight).toBe(60);
    expect(LAYOUT.changeBandHeight).toBe(22);
  });

  it('rows are virtualized and carry a roving tabindex', () => {
    const grid = code(join(SRC, 'components', 'energy', 'EnergyChangeGrid.tsx'));
    expect(grid).toMatch(/slice\(first, last\)/);
    expect(grid).toMatch(/tabIndex=\{index === activeIndex \? 0 : -1\}/);
    expect(grid).toMatch(/ArrowDown/);
    expect(grid).toMatch(/ArrowUp/);
  });

  /*
    R1's guard asserted that every change-state word carried an M01-PENDING
    marker. **M01 IS NOW RESOLVED**, so the marker is withdrawn along with the
    premise — a pending marker on a settled vocabulary is a false statement
    about the platform. §15 below asserts the resolution instead.
  */
  it('R2 — the M01-pending marker is gone, because M01 is resolved', () => {
    for (const file of ENERGY_FILES) {
      expect(code(file)).not.toMatch(/M01-PENDING/);
    }
  });
});

/* ═══ 11 · H05 · THE COMPACT SHELL ════════════════════════════════════════ */

describe('11 · H05 · recomposed below 700px, not shrunk', () => {
  it('the threshold and the three sheet stages are the frozen ones', () => {
    expect(LAYOUT.compactMaxWidth).toBe(700);
    expect(LAYOUT.sheetPeekPx).toBe(128);
    expect(LAYOUT.sheetHalfPct).toBe('46%');
    expect(LAYOUT.tabBarHeight).toBe(58);
  });

  it('there is no HUD in the compact shell — explanation never covers evidence', () => {
    const shell = code(join(SRC, 'components', 'energy', 'EnergyShell.tsx'));
    /*
      The landmark is a CODE landmark, not a comment one: `code()` strips
      comments, so slicing to a banner comment would silently slice to -1 and
      the guard would pass by measuring nothing.
    */
    const start = shell.indexOf('if (compact)');
    const end = shell.indexOf('data-energy-shell="desktop"', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(shell.slice(start, end)).not.toMatch(/EnergySubjectHud/);
  });

  it('compact carries the same four treatments as desktop — parity, not subset', () => {
    const shell = code(join(SRC, 'components', 'energy', 'EnergyShell.tsx'));
    expect((shell.match(/<AbsenceLegend strings=\{strings\} \/>/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

/* ═══ 12 · TYPOGRAPHY AND EN/PL ═══════════════════════════════════════════ */

describe('12 · the 10px metadata floor and both languages', () => {
  it('the floor is 10px and the frame declares it', () => {
    expect(TYPE.metadataFloorPx).toBe(10);
  });

  it('EN and PL carry the same keys — no half-translated absence sentence', () => {
    const en = energyStrings('en');
    const pl = energyStrings('pl');
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());

    /*
      R3 · ONE KEY IS DECLARED NULLABLE, AND IT IS NAMED RATHER THAN EXEMPTED.

      `metaRecencyDayUnit` is `string | null` in `EnergyStrings`: EN keeps the
      design's own `checked 1d` and L's delivered Polish template is hours at
      every magnitude, so Polish has no day form at all. A blanket `typeof`
      comparison reads that as a half-translated key, which is exactly the
      defect this guard exists to catch — so the exemption is a LIST OF ONE,
      asserted positively below, rather than a loosened comparison.
    */
    const NULLABLE: readonly string[] = ['metaRecencyDayUnit'];
    expect(en.metaRecencyDayUnit).toBe('d');
    expect(pl.metaRecencyDayUnit).toBeNull();

    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      if (NULLABLE.includes(key)) continue;
      expect(`${key}: ${typeof pl[key]}`).toBe(`${key}: ${typeof en[key]}`);
    }
  });

  it('PL is actually Polish, not English wearing a label', () => {
    const en = energyStrings('en');
    const pl = energyStrings('pl');
    for (const state of ENERGY_READER_STATES) {
      expect(pl.state[state]).not.toBe(en.state[state]);
      expect(pl.stateWhy[state]).not.toBe(en.stateWhy[state]);
    }
  });

  it('an unknown locale falls to EN rather than to a blank', () => {
    expect(energyStrings('de').state.COVERAGE_GAP).toBe(energyStrings('en').state.COVERAGE_GAP);
    expect(energyStrings(null).moduleName.length).toBeGreaterThan(0);
  });

  it('the catalogue is serialisable — it crosses the server/client boundary as data', () => {
    for (const locale of ['en', 'pl'] as const) {
      const strings = energyStrings(locale);
      for (const [key, value] of Object.entries(strings)) {
        expect(typeof value).not.toBe('function');
        expect(key.length).toBeGreaterThan(0);
      }
    }
    expect(formatEnergyString('a {x} b', { x: 'Z' })).toBe('a Z b');
  });
});

/* ═══ 13 · THE GATES DO NOT SPREAD ════════════════════════════════════════ */

describe('13 · a gate stops the one feature it governs', () => {
  it('every gate names both what it stops and what it does not', () => {
    for (const gate of Object.values(ENERGY_GATES)) {
      expect(gate.stops.length).toBeGreaterThan(0);
      expect(gate.doesNotStop.length).toBeGreaterThan(0);
      expect(gate.owner.length).toBeGreaterThan(0);
    }
  });

  /*
    R1's guard asserted that the asset carried an E02 Watch gate. R2 WITHDRAWS
    that guard, because the premise was wrong rather than the assertion: E1's §C
    clears Watch on *"situations, corridors, grid situations, AND SINGLE
    ASSETS"*, and only a reader-assembled COMPOSITE set is held. The replacement
    asserts the corrected property — no per-subject Watch gate exists at all.
  */
  it('R2 — single-asset Watch is cleared, so no subject carries a Watch gate', () => {
    for (const subject of ENERGY_DESIGN_FIXTURE_FRAME.subjects) {
      expect(Object.prototype.hasOwnProperty.call(subject, 'watchGate')).toBe(false);
    }
    expect(ENERGY_GATES.E02.stops).toMatch(/infrastructure/i);
  });

  it('M02 stops nothing — the frozen placeholders implement unchanged', () => {
    expect(ENERGY_GATES.M02.doesNotStop).toMatch(/nothing/i);
  });
});

/* ═══ 14 · THE FIXTURE FRAME IS LABELLED, AND IS NOT THE DEFAULT ══════════ */

describe('14 · design fixtures are labelled and never served by the public route', () => {
  it('/energy alone serves the governed frame', () => {
    expect(energyStateFromSearchParams(new URLSearchParams('')).frame).toBe('governed');
    expect(ENERGY_DEFAULT_URL_STATE.frame).toBe('governed');
  });

  it('a hand-authored frame=design-fixture URL cannot put fixture data on the reader route', () => {
    const route = code(ROUTE);
    expect(route).toContain('const data = ENERGY_GOVERNED_FRAME;');
    expect(route).not.toContain('ENERGY_DESIGN_FIXTURE_FRAME');
    expect(GRAPH.some((file) => file.endsWith('energyFixtures.ts'))).toBe(false);
  });

  it('the banner is derived from the data set and cannot be suppressed', () => {
    const parts = code(join(SRC, 'components', 'energy', 'EnergyParts.tsx'));
    const banner = parts.slice(parts.indexOf('export function FrameBanner'));
    /*
      `hidden` is `overflow: hidden` here, not a dismissal — the first version of
      this guard matched the stylesheet. What it must actually forbid is a way
      for a CALLER to turn the banner off.
    */
    expect(banner).not.toMatch(/onDismiss|dismissible|collapsible|canHide|showBanner/i);
    const signature = parts.slice(parts.indexOf('export function FrameBanner'), parts.indexOf('}: {', parts.indexOf('export function FrameBanner')) + 200);
    expect(signature).not.toMatch(/\bhide\b|\bvisible\b|\benabled\b/i);
    expect(ENERGY_DESIGN_FIXTURE_FRAME.source).toBe('design-fixture');
    expect(ENERGY_GOVERNED_FRAME.source).toBe('governed');
  });

  it('the fixture set still carries the absences no fixture can dissolve', () => {
    expect(ENERGY_DESIGN_FIXTURE_FRAME.zones.workspaceEntry?.gate).toBe('M07');
    expect(ENERGY_DESIGN_FIXTURE_FRAME.zones.watch?.gate).toBe('E02');
  });

  it('all four reader states appear in the fixture change grid, in situ', () => {
    const states = new Set(ENERGY_DESIGN_FIXTURE_FRAME.changeRows.map((row) => row.readerState).filter((s) => s !== null));
    expect(states.has('COVERAGE_GAP')).toBe(true);
    expect(states.has('UNAVAILABLE_LICENSED')).toBe(true);
    expect(states.has('NO_DATA')).toBe(true);
    expect(states.has('NO_MATERIAL_CHANGE')).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   R2 — THE CORRECTIVE DELTAS
   ═══════════════════════════════════════════════════════════════════════════
   Authority: MAIN-ENERGY-PARTXI-E1-L-CLOSEOUT-R2, sha
   07643a3c22dcb2ce7b99d63cafc4334efc70137bceb883642cb93ad52c6ba4dc.
   Each guard below pins one delta, and several pin the WITHDRAWAL of an R1
   behaviour rather than an addition — a corrective round's guards have to be
   able to fail on the old code, not only on a hypothetical future one. */

describe('15 · R2 · M01 is a two-axis model, never one string', () => {
  it("Main's module is landed BYTE-FOR-BYTE and H authored none of it", () => {
    const landed = createHash('sha256').update(readFileSync(join(SRC, 'lib', 'observation', 'changeState.ts'))).digest('hex');
    expect(landed).toBe('97c7f8ec1646b58e70d8248a6aeff6aaefcaf8fe4ed214ba5423339791540867');
  });

  it('exports tokens and no English — so no locale is authority', () => {
    const source = code(join(SRC, 'lib', 'observation', 'changeState.ts'));
    /* The only string literals are the token names themselves. */
    const literals = (source.match(/'[^']+'/g) ?? []).map((l) => l.slice(1, -1));
    const tokens: readonly string[] = [...CHANGE_SERVICE_STATES, ...CHANGE_CAUSE_STATES];
    for (const literal of literals) {
      /* A placeholder key from the decomposition table is a Part XI phrase, not a label. */
      const isPlaceholder = Object.keys(PART_XI_PLACEHOLDER_DECOMPOSITION).includes(literal);
      expect(tokens.includes(literal) || isPlaceholder).toBe(true);
    }
  });

  it('all seven frozen placeholders decompose, and two were never service events', () => {
    expect(Object.keys(PART_XI_PLACEHOLDER_DECOMPOSITION)).toHaveLength(7);
    expect(PART_XI_PLACEHOLDER_DECOMPOSITION['RESTORED · CAUSE OPEN']).toEqual({
      service: 'RESTORED',
      cause: 'CAUSE_OPEN',
    });
    expect(PART_XI_PLACEHOLDER_DECOMPOSITION['CAUSE ASSESSED'].service).toBe('NO_MATERIAL_CHANGE');
    expect(PART_XI_PLACEHOLDER_DECOMPOSITION['ASSESSMENT UNCHANGED'].service).toBe('NO_MATERIAL_CHANGE');
  });

  it('CAUSE_NOT_ASSESSED and CAUSE_OPEN stay distinguishable — the A-24 rule', () => {
    expect(CHANGE_CAUSE_STATES).toHaveLength(3);
    expect(CHANGE_CAUSE_STATES).toContain('CAUSE_NOT_ASSESSED');
    expect(CHANGE_CAUSE_STATES).toContain('CAUSE_OPEN');
  });

  it('the renderer returns two tokens and NEVER joins them', () => {
    const state = { service: 'RESTORED', cause: 'CAUSE_OPEN' } as const;
    for (const locale of ['en', 'pl'] as const) {
      const tokens = changeStateTokens(state, energyStrings(locale).changeState);
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).not.toContain('·');
      expect(tokens[1]).not.toContain('·');
    }
    /* And the component composes, never concatenates. */
    const parts = code(join(SRC, 'components', 'energy', 'EnergyParts.tsx'));
    const block = parts.slice(parts.indexOf('export function ChangeStateTokens'), parts.indexOf('export function Row'));
    expect(block).not.toMatch(/\.join\(|service \+ |\$\{service\} · \$\{cause\}[^`]*>/);
  });

  it("the Polish `RESTORED · CAUSE OPEN` is representable, which it was not as one string", () => {
    const pl = energyStrings('pl').changeState;
    /*
      R3 · MOVED WITH REASONING, NOT RELAXED. R2 pinned `WZNOWIONO`, which was
      H's placement standing in for a value L had not yet delivered.
      `L-ENERGY-PARTXI-PL-FIT-R2` (`dbe7f4b5…`) delivers `PRZYWRÓCONO`, and PL
      copy is L's lane. The guard follows the authority; it does not soften to
      accept either.
    */
    expect(pl.service.RESTORED).toBe('PRZYWRÓCONO');
    expect(pl.cause.CAUSE_OPEN).toBe('PRZYCZYNA OTWARTA');
    /* Each token fits the 27-character budget alone; the joined string did not. */
    expect(pl.service.RESTORED.length).toBeLessThanOrEqual(27);
    expect(pl.cause.CAUSE_OPEN.length).toBeLessThanOrEqual(27);
    expect(`${pl.service.RESTORED} · ${pl.cause.CAUSE_OPEN}`.length).toBeGreaterThan(27);
  });

  it('the cause element can never be truncated away — F-3, as a structure', () => {
    expect(ENERGY_STATE_CAUSE_STYLE.flex).toBe('none');
    expect(ENERGY_STATE_CAUSE_STYLE).not.toHaveProperty('textOverflow');
    expect(ENERGY_STATE_SERVICE_STYLE.flex).toBe('1 1 auto');
    expect(ENERGY_STATE_SERVICE_STYLE.textOverflow).toBe('ellipsis');
    expect(causeMustBeShown({ service: 'RESTORED', cause: 'CAUSE_OPEN' })).toBe(true);
    expect(causeMustBeShown({ service: 'RESTORED', cause: 'CAUSE_NOT_ASSESSED' })).toBe(false);
  });

  it('a CAUSE_OPEN state always renders its cause token', () => {
    const parts = code(join(SRC, 'components', 'energy', 'EnergyParts.tsx'));
    /* The only suppression is the floor, and `CAUSE_OPEN` is not the floor. */
    expect(parts).toMatch(/showCause = state\.cause !== 'CAUSE_NOT_ASSESSED'/);
  });
});

describe('16 · R2 · rights and exposure are two axes, and exposure dominates', () => {
  it("Main's disclosure module is landed BYTE-FOR-BYTE", () => {
    const landed = createHash('sha256').update(readFileSync(join(SRC, 'lib', 'energy', 'energyDisclosure.ts'))).digest('hex');
    expect(landed).toBe('cf7c26f6224868deb3797aec48a484040bd9ed36d86a9333d4984d36e75c6e47');
  });

  it('a rights grant alone CANNOT make a refused series reader-visible', () => {
    const refused = { rights: 'RIGHTS_BLOCKED', exposure: 'EXPOSURE_REFUSED' } as const;
    expect(readerAvailability(refused)).toBe('COVERAGE_GAP');
    expect(readerAvailability({ ...refused, rights: 'RIGHTS_ALLOWED' })).toBe('COVERAGE_GAP');
    expect(rightsGrantIsReaderVisible(refused)).toBe(false);
  });

  it('NEGATIVE CONTROL — where exposure IS allowed, a rights grant is visible', () => {
    /* Without this the guard above would be measuring a constant, not a gate. */
    const entitlement = { rights: 'RIGHTS_BLOCKED', exposure: 'EXPOSURE_ALLOWED' } as const;
    expect(rightsGrantIsReaderVisible(entitlement)).toBe(true);
    expect(readerAvailability(entitlement)).toBe('UNAVAILABLE_LICENSED');
  });

  it('both floors are the most ignorant member and land on COVERAGE GAP', () => {
    expect(RIGHTS_FLOOR).toBe('RIGHTS_UNKNOWN');
    expect(EXPOSURE_FLOOR).toBe('EXPOSURE_NOT_ASSESSED');
    expect(readerAvailability({ rights: RIGHTS_FLOOR, exposure: EXPOSURE_FLOOR })).toBe('COVERAGE_GAP');
  });

  it('no single-axis availability function exists anywhere in the frame', () => {
    for (const file of ENERGY_FILES) {
      expect(code(file)).not.toMatch(/isAvailable\s*\(|availableFromRights|readerAvailability\([^)]*rights[^)]*,/);
    }
  });

  it('the frame asks the whole record, never a tier flag', () => {
    for (const file of ENERGY_FILES) {
      expect(code(file)).not.toMatch(/unavailableTier/);
    }
  });

  it('both dispositions are present in the fixtures, so the rule is exercised', () => {
    const disclosures = [
      ...ENERGY_DESIGN_FIXTURE_FRAME.flowLinks.map((l) => l.disclosure),
      ...ENERGY_DESIGN_FIXTURE_FRAME.subjects.flatMap((s) => s.evidence).map((e) => e.disclosure),
    ].filter((d): d is NonNullable<typeof d> => d !== null);
    expect(disclosures.some((d) => readerAvailability(d) === 'UNAVAILABLE_LICENSED')).toBe(true);
  });
});

describe('17 · R2 · a security withholding is indistinguishable from an absence', () => {
  it('no security gate reaches the reader as a label', () => {
    for (const locale of ['en', 'pl'] as const) {
      const corpus = JSON.stringify(energyStrings(locale));
      expect(corpus).not.toMatch(/\bE0[1-4]\b/);
      expect(corpus).not.toMatch(/security review|przegląd bezpieczeństwa/i);
    }
  });

  it('no security gate reaches the DOM as an attribute — devtools is a reader too', () => {
    const parts = code(join(SRC, 'components', 'energy', 'EnergyParts.tsx'));
    expect(parts).toMatch(/isSecurityGate/);
    /* The only gate that can reach `data-energy-gate` is a disclosable one. */
    expect(parts).toMatch(/data-energy-gate=\{gate\?\.id\}/);
    expect(isSecurityGate('E01')).toBe(true);
    expect(isSecurityGate('E04')).toBe(true);
    /* NEGATIVE CONTROL — a rights or pricing gate is NOT a security gate and stays visible. */
    expect(isSecurityGate('G01')).toBe(false);
    expect(isSecurityGate('M07')).toBe(false);
  });

  it('COVERAGE GAP is reachable for benign reasons on the same surface — D-3', () => {
    const benign = Object.values(ENERGY_GOVERNED_FRAME.zones).filter(
      (z) => z?.readerState === 'COVERAGE_GAP' && z.gate !== null && !isSecurityGate(z.gate),
    );
    expect(benign.length).toBeGreaterThan(0);
  });

  it('a security withhold never routes to the violet entitlement chip — D-2', () => {
    for (const zone of Object.values(ENERGY_GOVERNED_FRAME.zones)) {
      if (zone !== undefined && isSecurityGate(zone.gate)) {
        expect(zone.readerState).not.toBe('UNAVAILABLE_LICENSED');
      }
    }
  });
});

describe('18 · R2 · the E1 holds, preserved', () => {
  it('all four are recorded as HOLD with the ruling that holds them', () => {
    for (const capability of ENERGY_HELD_CAPABILITIES) {
      expect(ENERGY_CAPABILITY_STATUS[capability].status).toBe('HOLD');
      expect(ENERGY_CAPABILITY_STATUS[capability].ruling.length).toBeGreaterThan(20);
    }
  });

  /*
    THE SWEEP IS SCOPED, AND THE SCOPING IS THE POINT.

    The first version of these two guards swept every file in the graph and
    fired on Main's own landed module — because `ENERGY_HELD_CAPABILITIES`
    NAMES `MONITOR_NEXT` and `COMPOSITE_REGIONAL_WATCH`. A hold register naming
    a capability is the opposite of building it, and a guard that cannot tell
    those apart would push a lane to delete the register.

    So the sweep runs over what H AUTHORED — components, view model, strings —
    and the register is asserted separately, positively, in the guard above.
  */
  const H_AUTHORED = ENERGY_FILES.filter((f) =>
    /[\\/]components[\\/]energy[\\/]|energyModel\.ts$|energyFixtures\.ts$|energyStrings\.ts$|energyGoverned\.ts$/.test(f),
  );

  it('MONITOR-NEXT IS NOT BUILT — not as a surface, not as a flag, not as a placeholder', () => {
    for (const file of H_AUTHORED) {
      expect(code(file)).not.toMatch(/monitorNext|monitor.next/i);
    }
    for (const locale of ['en', 'pl'] as const) {
      expect(JSON.stringify(energyStrings(locale))).not.toMatch(/monitor|obserwować dalej/i);
    }
    /* And it is still named as HELD in the register, which is where it belongs. */
    expect(ENERGY_CAPABILITY_STATUS.MONITOR_NEXT.status).toBe('HOLD');
  });

  it('no composite regional Watch exists to be gated', () => {
    for (const file of H_AUTHORED) {
      expect(code(file)).not.toMatch(/composite|regionalWatch|watchlist/i);
    }
    expect(ENERGY_CAPABILITY_STATUS.COMPOSITE_REGIONAL_WATCH.status).toBe('HOLD');
  });

  it('NO ATTENTION AGGREGATES — no watcher count, no trending, no ranking by watch volume', () => {
    for (const file of ENERGY_FILES) {
      expect(code(file)).not.toMatch(/watcherCount|watchersCount|trendingWatched|watchVolume|readersWatching/i);
    }
  });

  it('watchability is declared, not earned — no per-subject gate can vary with an assessment', () => {
    const parts = code(join(SRC, 'components', 'energy', 'EnergyParts.tsx'));
    const control = parts.slice(parts.indexOf('export function WatchControl'), parts.indexOf('export function SandAffordance'));
    expect(control).not.toMatch(/gate|assessment|changeState/i);
  });

  it('asset-level geometry coupling is decided from BOTH facts — E01-3', () => {
    expect(decideAssetPresentation({ precision: 'ASSET', registerDerived: true }, false).kind).toBe('GEOMETRY_ONLY');
    expect(decideAssetPresentation({ precision: 'ASSET', registerDerived: true }, true).kind).toBe('REFUSED');
    expect(decideAssetPresentation({ precision: 'ASSET', registerDerived: false }, false).kind).toBe('REFUSED');
  });
});

describe('19 · R2 · §E Arabic typography, §F metadata overflow', () => {
  it('the override is a script-scoped token, not a component branch', () => {
    expect(ENERGY_SCRIPT_TOKEN_CSS).toMatch(/--ene-meta-fs:\s*10px/);
    expect(ENERGY_SCRIPT_TOKEN_CSS).toMatch(/:root:lang\(ar\), \[lang\|="ar"\]/);
    expect(ENERGY_SCRIPT_TOKEN_CSS).toMatch(/--ene-meta-fs:\s*11px/);
    expect(ENERGY_SCRIPT_TOKEN_CSS).toMatch(/--ene-meta-ls:\s*0/);
    expect(ENERGY_ARABIC_METADATA_FLOOR_PX).toBe(11);
  });

  it('NOT ONE LATIN PIXEL MOVES — no component branches on locale', () => {
    for (const file of ENERGY_FILES) {
      expect(code(file)).not.toMatch(/locale === 'ar'|lang === 'ar'|isArabic/);
    }
  });

  it('bidi isolation reuses the accepted component; no second primitive is grown', () => {
    const shell = code(join(SRC, 'components', 'energy', 'EnergyShell.tsx'));
    expect(shell).toMatch(/MachineReadable/);
    for (const file of ENERGY_FILES) {
      expect(code(file)).not.toMatch(/unicode-bidi|unicodeBidi|<bdi/);
    }
  });

  it('F-1 — the three metadata columns get the protection the subject column had', () => {
    expect(ENERGY_METADATA_CLAMP.overflow).toBe('hidden');
    expect(ENERGY_METADATA_CLAMP.textOverflow).toBe('ellipsis');
    expect(ENERGY_METADATA_CLAMP.whiteSpace).toBe('nowrap');
    const grid = code(join(SRC, 'components', 'energy', 'EnergyChangeGrid.tsx'));
    expect((grid.match(/ENERGY_METADATA_CLAMP/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('THE GEOMETRY DID NOT CHANGE — 118 / 190 / 190 and 60px are frozen', () => {
    expect(ENERGY_ROW_COLUMNS).toEqual({ subject: 236, scope: 118, state: 190, meta: 190, height: 60 });
  });

  it('F-2 — the complete value survives as the accessible name', () => {
    const grid = code(join(SRC, 'components', 'energy', 'EnergyChangeGrid.tsx'));
    expect((grid.match(/aria-label=/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('F-4 — a label whose truncated prefix is a valid label is NOT ellipsized', () => {
    const pl = energyStrings('pl');
    const vocabulary = [...Object.values(pl.state), pl.dataTier.NOT_AVAILABLE];
    expect(truncationCollides('NIEDOSTĘPNE · LICENCJA', [...vocabulary, 'NIEDOSTĘPNE'])).toBe(true);
    expect(metadataSlotStyle('NIEDOSTĘPNE · LICENCJA', [...vocabulary, 'NIEDOSTĘPNE'])).not.toHaveProperty('textOverflow');
    /* NEGATIVE CONTROL — most labels do not collide, so the rule measures something. */
    expect(truncationCollides('LUKA W POKRYCIU', vocabulary)).toBe(false);
    expect(metadataSlotStyle('LUKA W POKRYCIU', vocabulary).textOverflow).toBe('ellipsis');
  });

  it("L's own resolutions are carried, and a more literal edit would be a regression", () => {
    const pl = energyStrings('pl');
    expect(pl.scope.SUPPLY_SITUATION).toBe('SYTUACJA DOSTAW');
    expect(pl.scope.GRID_SITUATION).toBe('SYTUACJA SIECI');
    expect(pl.dataTier.NOT_AVAILABLE).toBe('NIEDOSTĘPNE · BRAK ŹRÓDŁA');
    /* And the scope column is localized at all, which it was not in R1. */
    expect(pl.scope.CORRIDOR).not.toBe(energyStrings('en').scope.CORRIDOR);
  });

  it('the 14-density row reuses the SAME columns — H answers Main\u2019s open question', () => {
    const grid = code(join(SRC, 'components', 'energy', 'EnergyChangeGrid.tsx'));
    /*
      MAIN ASKED, AND THIS IS THE ANSWER: **it reuses them.**
      Main could not locate the `14` of "28/14 column density" in any build
      input and carried the question to H rather than assuming. In this
      implementation there is ONE row component with ONE set of fixed columns —
      236 / 118 / flexible band strip / 190 — and `columns` varies only the
      length of the band array. So §F's rules apply to the narrow density
      unchanged, and that is measured here rather than asserted in prose.
    */
    expect((grid.match(/height: `\$\{ROW_HEIGHT\}px`/g) ?? []).length).toBe(1);
    expect(grid).toMatch(/Array\.from\(\{ length: columns \}/);
    /* The ruler and the row declare the same widths, which is why they line up. */
    expect((grid.match(/width: '118px'/g) ?? []).length).toBe(2);
    expect((grid.match(/width: '190px'/g) ?? []).length).toBe(2);
    expect(LAYOUT.changeColumnsNarrow).toBe(14);
  });
});

describe('20 · R2 · price ownership', () => {
  it('Energy claims no price series, in either language', () => {
    for (const locale of ['en', 'pl'] as const) {
      const corpus = JSON.stringify(energyStrings(locale));
      /* Where price appears at all it must be as a REFERENCE to Market. */
      /*
        WORD-BOUNDED, AND THE FIRST VERSION WAS NOT. A bare `cen` fired on
        `ocenionej` in *"udział w ocenionej podaży"* — assessed, not priced. A
        guard that flags the word for *assessment* in a price rule is measuring
        the wrong language.
      */
      /*
        `matchAll`, NOT `match` + `indexOf`. The first version looked the hit up
        with `indexOf` on a lowercased corpus, which finds the FIRST occurrence
        of those letters anywhere — so it read the context around `oceny`
        (assessment) while reporting a hit on `ceny` (prices) somewhere else
        entirely. It failed on a passage that contains no price word at all.
        A guard that reports the wrong location is worse than no guard: it sends
        a reader to edit innocent copy.
      */
      const priceWord = /\bprices?\b|\bcena\b|\bceny\b|\bcenom\b|\bcenowe?\b|\bcenowych\b/gi;
      for (const match of corpus.matchAll(priceWord)) {
        const at = match.index ?? 0;
        const context = corpus.slice(Math.max(0, at - 120), at + 160);
        expect(`${match[0]} :: ${context}`).toMatch(/market|rynk|not set|nieustalona|link|przywoł/i);
      }
      /* NEGATIVE CONTROL — the pattern must be able to fire at all. */
      expect('Ceny rynkowe'.match(priceWord)).not.toBeNull();
    }
  });

  it('the accepted dictionaries no longer claim price signals for Energy', () => {
    for (const dictionary of ['en.ts', 'pl.ts']) {
      const source = readFileSync(join(SRC, 'lib', 'i18n', 'dictionaries', dictionary), 'utf-8');
      const start = source.indexOf('      energy: {');
      const entry = source.slice(start, source.indexOf('},', start));
      expect(entry).not.toMatch(/price signals|sygnały cenowe/i);
    }
  });
});

/* ═══ 21 · R3 · L'S POLISH VOCABULARY, ADOPTED WHOLE AND MEASURED ═════════ */

describe("21 · R3 · L's delivered Polish, carried verbatim", () => {
  /** L's advance model for `row.state`: 10px mono with `.1em` tracking. */
  const px = (label: string) => label.length * ENERGY_STATE_PX_PER_CHAR;

  it('the two labels the activation named are L’s, exactly', () => {
    const pl = energyStrings('pl').changeState;
    expect(pl.service.SUPPLY_IMPACT_OBSERVED).toBe('WPŁYW NA DOSTAWY ODNOTOWANY');
    expect(pl.service.DISRUPTION_OBSERVED).toBe('ZAKŁÓCENIE ODNOTOWANE');
  });

  it('every delivered Polish label fits the 190px column — L’s measurement, reproduced', () => {
    const pl = energyStrings('pl').changeState;
    const measured: Record<string, number> = {};
    for (const [token, label] of Object.entries({ ...pl.service, ...pl.cause })) {
      measured[token] = px(label);
    }
    /*
      Reproduced independently rather than quoted: if L's table and this product
      ever disagree, the disagreement has to be visible here.
    */
    expect(measured).toEqual({
      NO_MATERIAL_CHANGE: 133,
      DISRUPTION_OBSERVED: 147,
      SUPPLY_IMPACT_OBSERVED: 189,
      SUPPLY_IMPACT_REVISED: 175,
      RESTORED: 77,
      CAUSE_NOT_ASSESSED: 147,
      CAUSE_OPEN: 119,
      CAUSE_ASSESSED: 126,
    });
    for (const value of Object.values(measured)) {
      expect(value).toBeLessThanOrEqual(ENERGY_ROW_COLUMNS.state);
    }
  });

  it('`CAUSE_OPEN` survives as an independent fact, unchanged by the R3 edit', () => {
    const pl = energyStrings('pl').changeState;
    expect(pl.cause.CAUSE_OPEN).toBe('PRZYCZYNA OTWARTA');
    /* Structural, not typographic: the box it lives in cannot shrink. */
    expect(ENERGY_STATE_CAUSE_STYLE.flex).toBe('none');
    expect(ENERGY_STATE_CAUSE_STYLE).not.toHaveProperty('textOverflow');
    expect(causeMustBeShown({ service: 'RESTORED', cause: 'CAUSE_OPEN' })).toBe(true);
    /* And the two axes are still two: no locale may collapse them into one. */
    const [service, cause] = changeStateTokens(
      { service: 'RESTORED', cause: 'CAUSE_OPEN' },
      energyStrings('pl').changeState,
    );
    expect(service).toBe('PRZYWRÓCONO');
    expect(cause).toBe('PRZYCZYNA OTWARTA');
  });

  it('no Polish service label keeps the rejected verb-first shape', () => {
    const pl = energyStrings('pl').changeState;
    for (const label of Object.values(pl.service)) {
      expect(`${label}`).not.toMatch(/^ZAOBSERWOWAN|^ODNOTOWAN/);
    }
  });
});

/* ═══ 22 · R3 · F-4′ — ELLIPSIS ONLY WHERE THE PREFIX IS UNIQUE ═══════════ */

describe('22 · R3 · F-4′, with the control that makes it a measurement', () => {
  const plService = () => Object.values(energyStrings('pl').changeState.service);
  const plCause = () => Object.values(energyStrings('pl').changeState.cause);

  it('the worst case is the column less the WIDEST cause label less the gap', () => {
    /* 190 - 147 (PRZYCZYNA NIEOCENIONA) - 6 = 37px = 5 characters. */
    expect(worstCaseServicePx(plCause())).toBe(37);
    expect(ENERGY_STATE_AXIS_GAP_PX).toBe(6);
  });

  it('the delivered service vocabulary is unambiguous at ONE character', () => {
    expect(longestSharedPrefix(plService())).toBe(0);
    expect(minimumUnambiguousPrefix(plService())).toBe(1);
    expect(ellipsisPermitted(plService(), worstCaseServicePx(plCause()))).toBe(true);
    /* Every delivered label starts with a different letter: B Z W K P. */
    const initials = plService().map((label) => label[0]);
    expect(new Set(initials).size).toBe(initials.length);
  });

  it('NEGATIVE CONTROL — the rejected verb-first family is REFUSED', () => {
    /*
      This is the whole point of F-4′ and the reason a passing rule is not by
      itself evidence. The verb-first family shares `ODNOTOWANO ` — 11
      characters — so it needs 12 visible characters (84.0px) and the element
      can fall to 37px. A reader would see `ODNOT…`, a prefix shared by two
      different service states.
    */
    const verbFirst = [
      'BEZ ISTOTNEJ ZMIANY',
      'ODNOTOWANO ZAKŁÓCENIE',
      'ODNOTOWANO WPŁYW NA DOSTAWY',
      'KOREKTA WPŁYWU NA DOSTAWY',
      'PRZYWRÓCONO',
    ];
    expect(longestSharedPrefix(verbFirst)).toBe(11);
    expect(minimumUnambiguousPrefix(verbFirst)).toBe(12);
    expect(minimumUnambiguousPrefix(verbFirst) * ENERGY_STATE_PX_PER_CHAR).toBe(84);
    expect(ellipsisPermitted(verbFirst, worstCaseServicePx(plCause()))).toBe(false);
  });

  it('a REFUSED vocabulary loses the ellipsis declaration, and keeps the geometry', () => {
    const refused = serviceAxisStyle(
      ['ODNOTOWANO ZAKŁÓCENIE', 'ODNOTOWANO WPŁYW NA DOSTAWY'],
      Object.values(energyStrings('pl').changeState.cause),
    );
    expect(refused).not.toHaveProperty('textOverflow');
    expect(refused.whiteSpace).toBe('nowrap');
    /* It overflows visibly instead — a legible defect beats an ambiguous one. */
    expect(refused.flex).toBe('1 1 auto');

    const permitted = serviceAxisStyle(plService(), plCause());
    expect(permitted.textOverflow).toBe('ellipsis');
    expect(permitted.flex).toBe('1 1 auto');
  });

  it('the product DECIDES the service ellipsis rather than declaring it', () => {
    const parts = code(join(SRC, 'components', 'energy', 'EnergyParts.tsx'));
    const block = parts.slice(
      parts.indexOf('export function ChangeStateTokens'),
      parts.indexOf('export function AbsenceBlock'),
    );
    expect(block).toMatch(/serviceAxisStyle\(/);
    /* The R2 constant is no longer what the service element renders with. */
    expect(block).not.toMatch(/data-energy-token="service"[\s\S]{0,200}ENERGY_STATE_SERVICE_STYLE/);
  });

  it('the cause axis shares a prefix and that is harmless — because it never clips', () => {
    /* `PRZYCZYNA O` is shared by OTWARTA and OCENIONA. Recorded, not fixed:
       the same two strings in a column without F-3 would be a defect. */
    expect(longestSharedPrefix(plCause())).toBe(11);
    expect(ENERGY_STATE_CAUSE_STYLE.flex).toBe('none');
  });
});

/* ═══ 23 · R3 · `row.meta` — TWO ELEMENTS, A PROTECTED NUMERAL ════════════ */

describe('23 · R3 · the bounded metadata presentation', () => {
  it('the recency element shrinks and may ellipsize', () => {
    expect(ENERGY_META_RECENCY_STYLE.flex).toBe('1 1 auto');
    expect(ENERGY_META_RECENCY_STYLE.minWidth).toBe(0);
    expect(ENERGY_META_RECENCY_STYLE.textOverflow).toBe('ellipsis');
    expect(ENERGY_META_RECENCY_STYLE.whiteSpace).toBe('nowrap');
  });

  it('NUM-1 — the evidence element never shrinks and carries NO ellipsis', () => {
    expect(ENERGY_META_COUNT_STYLE.flex).toBe('none');
    expect(ENERGY_META_COUNT_STYLE).not.toHaveProperty('textOverflow');
    expect(ENERGY_META_COUNT_STYLE).not.toHaveProperty('overflow');
    expect(ENERGY_META_COUNT_STYLE.whiteSpace).toBe('nowrap');
  });

  it('a statement meta neither shrinks nor ellipsizes', () => {
    /* `0 qualifying sources` carries a numeral; `no available record` loses its
       meaning at any cut. Neither may be clipped. */
    expect(ENERGY_META_STATEMENT_STYLE.flex).toBe('none');
    expect(ENERGY_META_STATEMENT_STYLE).not.toHaveProperty('textOverflow');
  });

  it('the meta row is ONE line — the 60px row is an accessibility commitment', () => {
    expect(ENERGY_META_ROW_STYLE.flexWrap).toBe('nowrap');
    expect(ENERGY_META_ROW_STYLE.maxWidth).toBe(`${ENERGY_ROW_COLUMNS.meta}px`);
    expect(ENERGY_ROW_COLUMNS.height).toBe(60);
  });

  it('THE GEOMETRY STILL DID NOT CHANGE — 236 / 118 / 190 / 190 and 60px', () => {
    expect(ENERGY_ROW_COLUMNS).toEqual({ subject: 236, scope: 118, state: 190, meta: 190, height: 60 });
  });

  it('no physical direction anywhere in the meta rules — ellipsis clips the LOGICAL end', () => {
    /*
      A left/right spelling is correct today and silently inverts under
      `dir="rtl"`, which would put the ellipsis on the numeral — the one thing
      NUM-1 forbids. So the styles carry no physical property at all.
    */
    for (const style of [
      ENERGY_META_RECENCY_STYLE,
      ENERGY_META_COUNT_STYLE,
      ENERGY_META_STATEMENT_STYLE,
      ENERGY_META_ROW_STYLE,
    ]) {
      for (const key of Object.keys(style)) {
        expect(`${key}`).not.toMatch(/left|right|Left|Right/);
      }
    }
    const source = code(join(SRC, 'lib', 'energy', 'energyOverflow.ts'));
    const r3 = source.slice(source.indexOf('R3 · `row.meta`'));
    expect(r3).not.toMatch(/textAlign|marginLeft|marginRight|paddingLeft|paddingRight/);
  });

  it('the component composes the two elements and never joins them into one string', () => {
    const parts = code(join(SRC, 'components', 'energy', 'EnergyParts.tsx'));
    const block = parts.slice(parts.indexOf('export function RowMeta'));
    expect(block).toMatch(/data-energy-meta-part="recency"/);
    expect(block).toMatch(/data-energy-meta-part="count"/);
    /* The separator is rendered by the container, aria-hidden, as its own box. */
    expect(block).toMatch(/aria-hidden="true"[\s\S]{0,120}ENERGY_META_SEPARATOR/);
    /* And the count element holds the numeral AND its noun — one element. */
    expect(block).toMatch(/ENERGY_META_COUNT_STYLE[\s\S]{0,200}metaCounted\[meta\.counted\]/);
  });

  it('F-2′ — the accessible name is the ordered join of the FULL values', () => {
    const pl = energyStrings('pl');
    const en = energyStrings('en');
    const meta = { kind: 'EVIDENCED', checkedHours: 168, count: 1000, counted: 'REVIEWED' } as const;
    expect(metaAccessibleName(meta, pl)).toBe('sprawdzono 168 h · 1000 przejrzane');
    /*
      CORRECTED: this line first expected `checked 168h`, which is wrong — EN
      HAS a day unit, so 168 hours renders as `7d`. The guard caught the
      author's arithmetic, which is the only reason to write the expectation
      out in full rather than compute it.
    */
    expect(metaAccessibleName(meta, en)).toBe('checked 7d · 1000 reviewed');
    /* Each element's visible text is a prefix of its OWN value. */
    expect(formatMetaRecency(168, pl).startsWith('sprawdzono')).toBe(true);
    expect(formatMetaCount(1000, 'REVIEWED', pl)).toBe('1000 przejrzane');
    /* A statement announces itself whole. */
    expect(metaAccessibleName({ kind: 'STATEMENT', statement: 'no available record' }, en)).toBe(
      'no available record',
    );
  });

  it('the DAY form belongs to the locale, never to the data', () => {
    const en = energyStrings('en');
    const pl = energyStrings('pl');
    /* EN keeps the design's own `checked 1d`; PL is hours at every magnitude. */
    expect(formatMetaRecency(24, en)).toBe('checked 1d');
    expect(formatMetaRecency(24, pl)).toBe('sprawdzono 24 h');
    expect(formatMetaRecency(6, en)).toBe('checked 6h');
    expect(formatMetaRecency(6, pl)).toBe('sprawdzono 6 h');
    expect(pl.metaRecencyDayUnit).toBeNull();
  });

  it('the numeral run is isolated with the ACCEPTED primitive, not a new one', () => {
    const parts = code(join(SRC, 'components', 'energy', 'EnergyParts.tsx'));
    const block = parts.slice(parts.indexOf('export function RowMeta'));
    expect(block).toMatch(/<MachineReadable>\{String\(meta\.count\)\}<\/MachineReadable>/);
    expect(block).toMatch(/<MachineReadable>\{parts\.value\}<\/MachineReadable>/);
    /* No second isolation primitive is grown — the L04-F1 instruction. */
    expect(block).not.toMatch(/dir="ltr"|unicodeBidi|unicode-bidi/);
  });

  it('the split happens at the template placeholder, not by slicing a formatted string', () => {
    const pl = energyStrings('pl');
    expect(splitMetaRecency(12, pl)).toEqual({ prefix: 'sprawdzono ', value: '12 h', suffix: '' });
    expect(splitMetaRecency(24, energyStrings('en'))).toEqual({
      prefix: 'checked ',
      value: '1d',
      suffix: '',
    });
  });

  it("the design's meta sentences are DECOMPOSED, never re-typed", () => {
    const source = code(join(SRC, 'lib', 'energy', 'energyFixtures.ts'));
    expect(source).toMatch(/FIXTURE_META_DECOMPOSITION/);
    /* Every change row reads its meta through the throwing lookup. */
    /*
      The CHANGE_ROWS literal ONLY. Widening the slice to the next section
      swept in `EnergyStorageRow.meta`, which is a different type on a
      different surface and is not what R3 restructured — a guard that fires
      on a neighbouring model is measuring the file, not the rule.
    */
    const from = source.indexOf('const CHANGE_ROWS');
    const rows = source.slice(from, source.indexOf('];', from));
    const metas = rows.match(/meta: [^,]+/g) ?? [];
    expect(metas.length).toBeGreaterThanOrEqual(9);
    for (const entry of metas) expect(entry).toMatch(/^meta: metaOf\('/);
    /* And an unmapped sentence is a mistake, never a default. */
    expect(source).toMatch(/function metaOf[\s\S]{0,400}throw new Error/);
  });

  it('the grid renders `RowMeta` and no longer prints a joined meta string', () => {
    const grid = code(join(SRC, 'components', 'energy', 'EnergyChangeGrid.tsx'));
    expect(grid).toMatch(/<RowMeta meta=\{row\.meta\} strings=\{strings\} \/>/);
    expect(grid).not.toMatch(/\{row\.meta\}\s*<\/span>/);
    /* The row's own accessible name goes through the F-2′ join. */
    expect(grid).toMatch(/metaAccessibleName\(row\.meta, strings\)/);
  });
});

/* ═══ 24 · R3 · ARABIC — THE RULES ARE KEPT AND NOTHING IS CLAIMED ═══════ */

describe('24 · R3 · Arabic rendering rules preserved, fit NOT claimed', () => {
  it("Main's existing Arabic rules are carried unchanged", () => {
    const tokens = code(join(SRC, 'lib', 'energy', 'energyTokens.ts'));
    /* 11px minimum, tracking neutralised — the §E override, untouched by R3. */
    expect(tokens).toMatch(/--ene-meta-fs:\s*11px/);
    expect(tokens).toMatch(/--ene-meta-ls:\s*0/);
    expect(tokens).toMatch(/ENERGY_ARABIC_METADATA_FLOOR_PX\s*=\s*11/);
    /*
      The Latin floor is untouched and it was never lowered to fit a
      translation. It is INTERPOLATED from the token rather than written as a
      literal, which is the stronger arrangement: a second copy of `10` is the
      thing that drifts.
    */
    expect(tokens).toMatch(/--ene-meta-fs:\s*\$\{ENERGY_TYPE\.metadataFloorPx\}px/);
    expect(TYPE.metadataFloorPx).toBe(10);
  });

  it('bidi safety is structural and reuses the accepted primitive', () => {
    const parts = code(join(SRC, 'components', 'energy', 'EnergyParts.tsx'));
    expect(parts).toMatch(/from '@\/lib\/typography\/runBoundary'/);
    expect(parts).toMatch(/MachineReadable/);
  });

  it('NO FILE CLAIMS ARABIC HAS BEEN VISUALLY VALIDATED', () => {
    /*
      The budgets in this lane come from a LATIN monospace advance model.
      Arabic is a cursive joining script and character count is not a width
      model for it — which is why the accepted policy neutralises tracking
      rather than reducing it. Arabic activation remains separate, and a
      sentence claiming otherwise would be the defect.
    */
    const files = readdirSync(join(SRC, 'lib', 'energy'))
      .filter((name) => name.endsWith('.ts'))
      .map((name) => join(SRC, 'lib', 'energy', name))
      .concat(
        readdirSync(join(SRC, 'components', 'energy'))
          .filter((name) => name.endsWith('.tsx'))
          .map((name) => join(SRC, 'components', 'energy', name)),
      );
    for (const file of files) {
      /* The guard is not the product. Sweeping its own sentence would make it
         fail by existing, which measures nothing. */
      if (file.endsWith('.spec.ts')) continue;
      const source = readFileSync(file, 'utf8');
      const claims =
        /arabic[^.\n]{0,80}(visually validated|fit (is )?(confirmed|verified|validated)|measured against a real)/i.exec(
          source,
        );
      expect(`${file}: ${claims?.[0] ?? 'none'}`).toBe(`${file}: none`);
    }
  });

  it('NEGATIVE CONTROL — that sweep can fail', () => {
    const planted = 'Arabic fit is confirmed at 11px across the change grid.';
    expect(
      /arabic[^.\n]{0,80}(visually validated|fit (is )?(confirmed|verified|validated)|measured against a real)/i.test(
        planted,
      ),
    ).toBe(true);
  });

  it('`row.meta` is untracked, so the Arabic override costs it three characters', () => {
    /*
      Recorded, not waived. `row.scope` and `row.state` are tracked and the
      removed tracking pays for the larger size; `row.meta` has no tracking to
      give back and loses 31 -> 28 characters. That is why the segmented rule
      above is what carries AR at all, and why it is mandatory rather than a
      fallback.
    */
    const tokens = code(join(SRC, 'lib', 'energy', 'energyTokens.ts'));
    expect(tokens).toMatch(/ENERGY_SCRIPT_TOKEN_CSS/);
    expect(ENERGY_META_ROW_STYLE.flexWrap).toBe('nowrap');
  });
});

/* ═══ 25 · R4 · THE HYDRATION DEFECT, AND WHY IT WAS NEVER A WARNING ══════ */

describe('25 · R4 · raw stylesheet text, proven through the server renderer', () => {
  /*
    ── WHAT WENT WRONG, IN ONE SENTENCE ────────────────────────────────────

    `<style>{CSS}</style>` makes the CSS a TEXT CHILD, and React escapes text
    children — so the server wrote `[lang|=&quot;ar&quot;]` and the client wrote
    `[lang|="ar"]`, one text node disagreed, and React answered by discarding
    the server HTML for the entire document.

    ── AND WHY THE WARNING WAS THE SMALLER HALF ────────────────────────────

    A `<style>` element's content is RAWTEXT in the HTML parser: character
    references inside it are NOT decoded. So the CSS parser received a literal
    `&quot;`, which is not a valid attribute value, and an invalid selector
    INVALIDATES THE WHOLE SELECTOR LIST — taking `:root:lang(ar)` with it. The
    Arabic override did not exist in the server-rendered stylesheet at all.

    `suppressHydrationWarning` would have hidden the warning and kept the
    broken selector, which is why it is refused below by name.
  */
  const renderToStaticMarkup = (
    require('react-dom/server') as typeof import('react-dom/server')
  ).renderToStaticMarkup;
  const createElement = (require('react') as typeof import('react')).createElement;

  const CSS_WITH_A_QUOTE = [ENERGY_SCRIPT_TOKEN_CSS];

  it('NEGATIVE CONTROL — a text child IS escaped, so the defect was real', () => {
    for (const css of CSS_WITH_A_QUOTE) {
      const asTextChild = renderToStaticMarkup(createElement('style', null, css));
      expect(asTextChild).toContain('&quot;');
      expect(asTextChild).not.toContain('[lang|="ar"]');
      /* The rendered text is NOT the source, which is the whole failure. */
      expect(asTextChild.includes(css)).toBe(false);
    }
  });

  it('raw injection renders the stylesheet EXACTLY, byte for byte', () => {
    for (const css of CSS_WITH_A_QUOTE) {
      const asRaw = renderToStaticMarkup(
        createElement('style', { dangerouslySetInnerHTML: { __html: css } }),
      );
      expect(asRaw).toContain(css);
      expect(asRaw).not.toContain('&quot;');
      expect(asRaw).toContain('[lang|="ar"]');
    }
  });

  it('the CSS ITSELF was not altered to dodge the escape', () => {
    /*
      Dropping the quotes would have fixed this one character and left the next
      `>` combinator to reintroduce the defect silently. The accepted §E text
      is unchanged; the INJECTION is what changed.
    */
    expect(ENERGY_SCRIPT_TOKEN_CSS).toMatch(/:root:lang\(ar\), \[lang\|="ar"\]/);
    expect(ENERGY_SCRIPT_TOKEN_CSS).toMatch(/--ene-meta-fs:\s*11px/);
    expect(ENERGY_SCRIPT_TOKEN_CSS).toMatch(/--ene-meta-ls:\s*0/);
    expect(ENERGY_ARABIC_METADATA_FLOOR_PX).toBe(11);
  });

  it('NO `<style>` in the Energy lane takes a text child — both sites, and any future one', () => {
    /*
      The second instance only revealed itself once the first was fixed,
      because the spatial substrate does not mount on the change substrate. A
      per-site fix would have shipped with the second still live, so the guard
      is a SWEEP rather than two assertions.
    */
    const dir = join(SRC, 'components', 'energy');
    const offenders: string[] = [];
    let styleElements = 0;
    for (const name of readdirSync(dir).filter((file) => file.endsWith('.tsx'))) {
      const source = code(join(dir, name));
      for (const match of source.matchAll(/<style(\s[^>]*)?>/g)) {
        styleElements += 1;
        const attrs = match[1] ?? '';
        if (!attrs.includes('dangerouslySetInnerHTML')) {
          offenders.push(`${name}: ${match[0]}`);
        }
      }
    }
    /* The sweep has to have something to sweep, or it is measuring nothing. */
    expect(styleElements).toBeGreaterThanOrEqual(2);
    expect(offenders).toEqual([]);
  });

  it('the substrate stylesheet is a named constant, not rebuilt inside the render', () => {
    const substrate = code(join(SRC, 'components', 'energy', 'EnergySpatialSubstrate.tsx'));
    expect(substrate).toMatch(/const SUBSTRATE_MOTION_CSS = `/);
    expect(substrate).toMatch(/\[data-energy-map="maplibre"\] canvas \{ transition: none; \}/);
    expect(substrate).toMatch(/prefers-reduced-motion: reduce/);
    expect(substrate).toMatch(/<style dangerouslySetInnerHTML=\{\{ __html: SUBSTRATE_MOTION_CSS \}\} \/>/);
  });

  it('`suppressHydrationWarning` appears NOWHERE in the Energy lane', () => {
    /*
      The activation's own condition: it is permitted only where the differing
      value is DESIGNED to differ and the reason is proven. Nothing on this
      surface is designed to differ — every value here is designed to be
      identical on both sides — so its presence would be a defect hidden
      rather than a difference declared.
    */
    for (const dir of [join(SRC, 'components', 'energy'), join(SRC, 'lib', 'energy')]) {
      for (const name of readdirSync(dir).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))) {
        if (name.endsWith('.spec.ts')) continue;
        /*
          CORRECTED: this first read the raw file and fired on EnergyShell's own
          COMMENT explaining why `suppressHydrationWarning` was refused — a
          guard that fails because the reason was written down is measuring
          prose, not code. `code()` strips comments, which is the only reading
          that means what the guard claims.
        */
        expect(`${name}: ${/suppressHydrationWarning/.test(code(join(dir, name)))}`).toBe(
          `${name}: false`,
        );
      }
    }
  });

  it('nothing on this surface reads the browser, the clock or randomness during render', () => {
    /*
      The other candidate causes the activation named, refused structurally
      rather than by inspection. `window` is read only inside effects (which
      run after hydration), and there is no `Date.now`, no `new Date`, no
      `Math.random` and no `useId` anywhere in the lane — so no value in the
      first render can differ between server and client.
    */
    for (const dir of [join(SRC, 'components', 'energy'), join(SRC, 'lib', 'energy')]) {
      for (const name of readdirSync(dir).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))) {
        if (name.endsWith('.spec.ts')) continue;
        /*
          CORRECTED for the same reason: on the raw file `\bwindow\.` matched
          the sentence "…rather than the requested window." in a docblock.
          Comments are stripped before anything here is asserted.
        */
        const source = code(join(dir, name));
        expect(`${name}: ${/Date\.now\(|new Date\(|Math\.random\(/.test(source)}`).toBe(`${name}: false`);
        /* Every `window.` read sits inside a useEffect callback. */
        for (const line of source.split('\n')) {
          if (!/\bwindow\./.test(line)) continue;
          expect(`${name} :: ${line.trim().slice(0, 90)}`).toMatch(
            /useEffect|const measure|addEventListener|removeEventListener|matchMedia|requestAnimationFrame|typeof window/,
          );
        }
      }
    }
  });
});
