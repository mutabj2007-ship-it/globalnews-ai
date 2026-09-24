import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  DATA_READINESS,
  MARKET_FIGURE_GAP_REASON,
  MARKET_HAS_ANY_OBSERVATION,
  MARKET_OBSERVATION_ABSENCE,
  MARKET_OBSERVATION_BASIS,
  MARKET_OBSERVATION_RECORDS,
  MARKET_SURFACE_DECLARES_NO_SCORER,
  SUBJECT_READINESS,
  hasAnyObservation,
} from './mktReadiness';
import { MKT_PL_DRAFT_AWAITING_COMPLETION, mktStrings, resolveMktStrings } from './mktStrings';

/**
 * PART VII · MARKET — THE DOMAIN CONTRACT GUARD.
 *
 * The lane shipped with no spec of any kind. The two highest-severity findings on this
 * surface are both of the shape a guard catches and a reviewer does not: a flag whose
 * comment and code disagreed, and a route that rendered the wrong composition while
 * returning 200 on every check anyone was running.
 *
 * Every group below fails if the defect it names comes back. Each was checked by putting
 * the defect back and watching it fail before being left green.
 */

const DOMAIN_LIB = __dirname;
const DOMAIN_COMPONENTS = join(__dirname, '..', '..', 'components', 'market');
const ROUTES = join(__dirname, '..', '..', 'app', 'market');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { out.push(...sourceFiles(full)); continue; }
    if (/\.tsx?$/.test(entry) && !entry.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}
const read = (f: string): string => readFileSync(f, 'utf8');
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const DOMAIN_SOURCES: readonly string[] =
  [...sourceFiles(DOMAIN_LIB), ...sourceFiles(DOMAIN_COMPONENTS), ...sourceFiles(ROUTES)];

/* ═══ 1 · OBSERVATION TRUTH ═══════════════════════════════════════════════════ */

describe('an observation flag may only be derived from observations', () => {
  it('no observation record exists, and the reason is named', () => {
    expect(MARKET_OBSERVATION_RECORDS).toHaveLength(0);
    expect(MARKET_HAS_ANY_OBSERVATION).toBe(false);
    expect(MARKET_OBSERVATION_ABSENCE).toBe('NO_ACTIVE_PROVIDER');
    expect(MARKET_OBSERVATION_BASIS).toContain('none activated');
  });

  /**
   * F T-M2 · with an empty held set the flag is false; seed one record and it flips. The
   * seeded record carries everything F T-M4 requires, because a record missing any of it is
   * not one this surface could display.
   */
  it('F T-M2 · the derivation is over records, and it is capable of returning true', () => {
    expect(hasAnyObservation([])).toBe(false);
    expect(hasAnyObservation([{
      subject: 'INSTRUMENT', observationId: 'SYNTH-OBS-001',
      value: '1', unit: 'index point', period: '2026-01', publishedVintage: '2026-02-01',
      origin: 'PROVIDER', displayPermitted: true,
    }])).toBe(true);
  });

  /**
   * F T-M4 / T-M5 · the record TYPE is the guard. A record with no published vintage, or
   * one whose origin is a fixture, cannot be constructed — `NO_VINTAGE_PUBLISHED` exists in
   * this domain precisely because "a fetch time is not a vintage", and an optional field
   * here would have re-opened it. Asserted on the shipped source because the constraint is
   * a compile-time one and has no runtime shadow to measure.
   */
  it('F T-M4 · value, unit, period and published vintage are all required', () => {
    const src = read(join(DOMAIN_LIB, 'mktReadiness.ts'));
    for (const field of ['readonly value: string;', 'readonly unit: string;',
      'readonly period: string;', 'readonly publishedVintage: string;']) {
      expect(src).toContain(field);
    }
    /* none of them optional */
    expect(src).not.toMatch(/readonly (value|unit|period|publishedVintage)\?:/);
  });

  it('F T-M5 · a fixture cannot enter the held set', () => {
    const src = read(join(DOMAIN_LIB, 'mktReadiness.ts'));
    expect(src).toContain("readonly origin: 'PROVIDER';");
    expect(src).not.toMatch(/origin:\s*'FIXTURE'/);
  });

  /**
   * THE DECISIVE ONE, AND IT IS F'S OWN SCENARIO.
   *
   * The previous derivation was `DATA_READINESS.some(f => f.ready)`. F named the cheapest
   * input to flip — `GLEIF_SUPPLIES_SECTOR_CODE`, a sector-code lookup — and observed that
   * one flip would make a Market surface announce OBSERVATIONS CONNECTED having received
   * no observation.
   *
   * So the flip is performed. The contract constant is mocked true, the module is
   * re-evaluated, and both halves are asserted: the readiness row DOES move, proving the
   * mutation landed and the mock is real; the observation flag does NOT, proving the
   * readiness facts are outside its derivation cone.
   *
   * `.every()` would have passed the second assertion and failed the point: it is still a
   * fold over eight facts none of which is an observation.
   */
  it('flipping a readiness constant moves the readiness row and NOT the observation flag', () => {
    jest.isolateModules(() => {
      const actual = jest.requireActual('@globalnews-ai/shared') as Record<string, unknown>;
      jest.doMock('@globalnews-ai/shared', () => ({ ...actual, GLEIF_SUPPLIES_SECTOR_CODE: true }));

      /* eslint-disable-next-line @typescript-eslint/no-var-requires */
      const mutated = require('./mktReadiness') as typeof import('./mktReadiness');

      const row = mutated.DATA_READINESS.find((f) => f.id === 'gleifSector');
      expect(row?.ready).toBe(true);                       // the mutation landed
      expect(mutated.MARKET_HAS_ANY_OBSERVATION).toBe(false); // and did not reach the flag
      expect(mutated.MARKET_OBSERVATION_RECORDS).toHaveLength(0);
    });
    jest.dontMock('@globalnews-ai/shared');
  });

  /**
   * F T-M6 · the gap reason is `null` only when the held set is non-empty — never because a
   * capability flag is true. F flagged that the defect had propagated into the fix for a
   * different defect: one flipped capability flag would have switched the banner on AND
   * silenced the chip explaining the absence.
   */
  it('F T-M6 · a flipped capability flag does not silence the gap reason', () => {
    jest.isolateModules(() => {
      const actual = jest.requireActual('@globalnews-ai/shared') as Record<string, unknown>;
      jest.doMock('@globalnews-ai/shared', () => ({ ...actual, GLEIF_SUPPLIES_SECTOR_CODE: true }));
      /* eslint-disable-next-line @typescript-eslint/no-var-requires */
      const mutated = require('./mktReadiness') as typeof import('./mktReadiness');
      expect(mutated.MARKET_FIGURE_GAP_REASON).toBe('NO_PRODUCER');
    });
    jest.dontMock('@globalnews-ai/shared');
  });

  it('the unmutated tree is the negative control', () => {
    expect(DATA_READINESS.find((f) => f.id === 'gleifSector')?.ready).toBe(false);
    expect(DATA_READINESS.every((f) => !f.ready)).toBe(true);
  });

  it('no readiness identifier appears in the flag expression', () => {
    const src = stripComments(read(join(DOMAIN_LIB, 'mktReadiness.ts')));
    const line = src.split('\n').find((l) => l.includes('MARKET_HAS_ANY_OBSERVATION: boolean'));
    expect(line).toBeDefined();
    expect(line).not.toContain('DATA_READINESS');
    expect(src).not.toMatch(/MARKET_HAS_ANY_OBSERVATION[^\n]*DATA_READINESS/);
    /* and not the other obvious wrong fix either */
    expect(src).not.toMatch(/MARKET_HAS_ANY_OBSERVATION[^\n]*\.every\(/);
  });

  /**
   * F M-1 / M-2 · `HELD` rather than `DATA`. "NO OBSERVATION DATA" is true and is one word
   * away from being read as *there is no market data* — a claim about the world. HELD puts
   * the subject back on us.
   */
  it('F M-1 / M-2 · the badge speaks about what we hold', () => {
    const t = mktStrings('en');
    expect(t.labels.observationBadgeZero).toBe('NO OBSERVATIONS HELD');
    expect(t.labels.observationBadgeHeld).toBe('OBSERVATIONS HELD');
    /*
      THE BADGE MOVED INTO `MktReader`, AND THE RULE MOVED WITH IT.

      The Alpha reader surface renders the badge through `MarketStatus`, whose `held` is
      `read.observations.length` — a COUNT OF RECORDS, which is what F M-1 asked for and
      is strictly stronger than the flag the screens used to read. Both compositions hand
      it the same expression, so neither can drift to a flag without this failing.
    */
    const reader = stripComments(read(join(DOMAIN_COMPONENTS, 'MktReader.tsx')));
    expect(reader).toContain('t.labels.observationBadgeHeld');
    expect(reader).toContain('t.labels.observationBadgeZero');
    expect(reader).not.toContain('NO OBSERVATION DATA');
    for (const f of ['MarketScreen.tsx', 'MarketCompactScreen.tsx']) {
      const src = stripComments(read(join(DOMAIN_COMPONENTS, f)));
      expect(src).toContain("read.kind === 'OBSERVATIONS' ? read.observations.length : 0");
      expect(src).toContain('<MarketStatus held={held} t={t} />');
      expect(src).not.toContain('NO OBSERVATION DATA');
    }
    expect(MARKET_HAS_ANY_OBSERVATION).toBe(false);
  });

  it('F M-3 · the body describes what we hold, not the market', () => {
    const t = mktStrings('en');
    expect(t.labels.observationBody).toBe(
      'This surface holds no market observations. That describes what we hold — it is not a statement about the market.');
    /*
      F's SENTENCE IS REUSED, NOT REWRITTEN. The unavailable state renders it verbatim
      through `ReadUnavailable`, and both compositions route their empty case there — so
      there is exactly one place this sentence can be got wrong, and it is guarded here.
    */
    const reader = stripComments(read(join(DOMAIN_COMPONENTS, 'MktReader.tsx')));
    expect(reader).toContain('t.labels.observationBody');
    for (const f of ['MarketScreen.tsx', 'MarketCompactScreen.tsx']) {
      expect(stripComments(read(join(DOMAIN_COMPONENTS, f))))
        .toContain('<ReadUnavailable reason={read.reason} t={t} />');
    }
  });
});

/* ═══ 2 · NO_PRODUCER IS PRESERVED ════════════════════════════════════════════ */

describe('the figure gap reason states a fact about this deployment', () => {
  it('is NO_PRODUCER, and nothing else', () => {
    expect(MARKET_FIGURE_GAP_REASON).toBe('NO_PRODUCER');
  });

  it('NOT_COLLECTED is not asserted anywhere on the surface', () => {
    for (const f of DOMAIN_SOURCES) {
      expect(stripComments(read(f))).not.toMatch(/gapReason[^\n]*NOT_COLLECTED/);
    }
  });

  it('a publisher-fact reason is never selected while no producer is wired', () => {
    for (const r of ['NOT_COLLECTED', 'WITHHELD', 'DISCONTINUED'] as const) {
      expect(MARKET_FIGURE_GAP_REASON).not.toBe(r);
    }
  });
});

/* ═══ 3 · NO FABRICATED FIGURES ═══════════════════════════════════════════════ */

describe('no price, rate, yield or index is constructible', () => {
  const MARKERS = [/\bUSD\b/, /\bEUR\b/, /\bGBP\b/, /\bJPY\b/, /[€£¥]/, /\bbps\b/,
    /\byield\b/i, /\bfxRate\b/i, /\bpriceOf\b/i, /\blastPrice\b/i];

  it.each(MARKERS.map((r) => [r.source, r] as const))('no code match for %s', (_l, rx) => {
    expect(DOMAIN_SOURCES.filter((f) => rx.test(stripComments(read(f))))).toEqual([]);
  });

  it('every rendered numeral is a count of contract members', () => {
    const t = mktStrings('en');
    const prose = JSON.stringify(t) + JSON.stringify(SUBJECT_READINESS) + JSON.stringify(DATA_READINESS);
    /* 0.04 is GLEIF_DIRECT_PARENT_WITH_LEI_SHARE; the rest are member counts. */
    const numerals = [...prose.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]);
    for (const n of numerals) expect(['0', '2', '4', '5', '7', '0.04']).toContain(n);
  });

  it('the domain declares no scorer', () => {
    expect(MARKET_SURFACE_DECLARES_NO_SCORER).toBe(true);
  });
});

/* ═══ 3b · ABSENCE-STATE FIXTURE COVERAGE ═════════════════════════════════════ */

describe('every Market absence sentence is exercised, including the unreachable branches', () => {
  /**
   * L measured that only a fraction of the absence sentences are reachable on the default
   * runtime. That is not a defect and nothing is fabricated on the surface to change it —
   * the production default stays exactly as truthful as it is. The coverage is taken here,
   * against the real catalogue, which is where a valid-but-unreachable branch belongs.
   */
  const REASONS = ['NO_QUALIFIED_SOURCE', 'NO_ACTIVE_PROVIDER', 'NOT_RUNTIME_ENABLED',
    'NO_DETERMINISTIC_JOIN', 'NO_ROUTE_GEOMETRY', 'AWAITING_SHARED_CONTRACT',
    'STATE_NOT_DERIVABLE', 'NO_VINTAGE_PUBLISHED'] as const;

  it.each(REASONS.map((r) => [r] as const))('%s has a sentence that refuses its own inference', (r) => {
    const v = mktStrings('en').absence[r];
    expect(v.length).toBeGreaterThan(20);
    /* none of them asserts a fact about the market or a publisher's behaviour */
    expect(v).not.toMatch(/\bprice|\brate\b|\byield\b/i);
  });

  it('the eight sentences are distinct — none is a copy of another', () => {
    const vals = REASONS.map((r) => mktStrings('en').absence[r]);
    expect(new Set(vals).size).toBe(REASONS.length);
  });

  it('the two that carry the sharpest refusals still do', () => {
    expect(mktStrings('en').absence.STATE_NOT_DERIVABLE).toContain('no material change');
    expect(mktStrings('en').absence.NO_VINTAGE_PUBLISHED).toContain('a fetch time is not a vintage');
  });
});

/* ═══ 4 · THE COMPACT ROUTE IS A COMPACT COMPOSITION ══════════════════════════ */

describe('/market/compact is not the desktop screen', () => {
  it('the route mounts the compact composition', () => {
    const route = read(join(ROUTES, 'compact', 'page.tsx'));
    expect(route).toContain('MarketCompactScreen');
    expect(route).not.toMatch(/<MarketScreen\b/);
  });

  it('the desktop route still mounts the desktop composition', () => {
    const route = read(join(ROUTES, 'page.tsx'));
    expect(route).toContain('<MarketScreen');
    expect(route).not.toContain('MarketCompactScreen');
  });

  it('the two compositions are distinguishable in the DOM', () => {
    expect(read(join(DOMAIN_COMPONENTS, 'MarketScreen.tsx'))).toContain('data-mkt="screen"');
    const compact = read(join(DOMAIN_COMPONENTS, 'MarketCompactScreen.tsx'));
    expect(compact).toContain('data-mkt="compact-screen"');
    /* code only — the docblock quotes the old attribute to explain what it replaced */
    expect(stripComments(compact)).not.toContain('data-mkt="screen"');
  });

  /**
   * L FIND-B1 · STRUCTURAL DIFFERENCE, MEASURED — NOT A DIFFERENT MARKER.
   *
   * L measured both routes at 42 nodes / 1,882 chars and was right to call that
   * insufficient: changing the route identity or the `data-mkt` value is not a compact
   * composition. The difference has to be information, so it is asserted as information:
   * the desktop substrate prints the five change-state explanations inline and the compact
   * substrate does not — they move into the readiness drawer, which is one tap away and is
   * already where measured detail lives. Nothing is dropped; the reader is no longer told
   * that five paragraphs are the most important thing on a 375px screen.
   */
  it('L FIND-B1 · the compact substrate reduces information, and the route to it survives', () => {
    const compact = stripComments(read(join(DOMAIN_COMPONENTS, 'MarketCompactScreen.tsx')));
    const desktop = stripComments(read(join(DOMAIN_COMPONENTS, 'MarketScreen.tsx')));
    /*
      The difference is still INFORMATION rather than a different marker. The desktop
      drawer prints the five change-state explanations; the compact frame prints only
      their COUNT, and the explanations are one tap away in the same drawer the count
      sits in. Nothing is dropped and nothing is truncated.
    */
    expect(desktop).toContain('CHANGE_STATE_GAPS[');
    expect(compact).not.toContain('CHANGE_STATE_GAPS[');
    expect(compact).toContain('CHANGE_STATES_NOT_DERIVABLE.length');
    expect(compact).toContain('data-mkt="ceiling-count"');
  });

  it('the compact composition is genuinely different, not a copy', () => {
    const desktop = read(join(DOMAIN_COMPONENTS, 'MarketScreen.tsx'));
    const compact = read(join(DOMAIN_COMPONENTS, 'MarketCompactScreen.tsx'));
    expect(compact).not.toBe(desktop);
    /* the phone has a bottom detent; the desktop replaces its body instead */
    expect(compact).toContain('data-mkt="compact-drawer"');
    expect(compact).toContain('data-mkt-detent=');
    expect(desktop).not.toContain('data-mkt-detent=');
    expect(desktop).toContain('data-mkt="drawer"');
    /* the desktop dock reflows; the phone dock is a fixed two-column grid */
    expect(desktop).toContain('repeat(auto-fit, minmax(min(100%, 232px), 1fr))');
    expect(compact).toContain("'repeat(2, minmax(0, 1fr))'");
    /* and the roots are distinct, which is the assertion L asked not to rely on alone */
    expect(desktop).toContain('data-mkt="screen"');
    expect(compact).toContain('data-mkt="compact-screen"');
  });

  it('the compact frame keeps what R14 says may not be cut', () => {
    const compact = read(join(DOMAIN_COMPONENTS, 'MarketCompactScreen.tsx'));
    /*
      R14's rule is that prose is cut before MEANING. So the phone keeps every fact that
      changes what a figure means — the card itself, its freshness state, its provenance
      footer, the gap reason and the ceiling count — and keeps the measured contract
      constant beside every readiness row. What it cuts is explanation.
    */
    for (const kept of ['ObservationCard', 'ReadUnavailable', 'CapabilityList',
      'figure-gap-reason', 'ceiling-count', 'MarketStatus']) {
      expect(compact).toContain(kept);
    }
    /* the observation card is ONE definition, so freshness and provenance cannot diverge */
    const readerSrc = read(join(DOMAIN_COMPONENTS, 'MktReader.tsx'));
    expect(readerSrc).toContain('data-mkt="freshness"');
    expect(readerSrc).toContain('data-mkt="provenance"');
    /* the measured constant survives on every readiness row */
    expect(compact).toContain('<Identifier>{measured}</Identifier>');
  });

  /**
   * THE TAB PATTERN IS GONE, AND THAT IS THE CHANGE RATHER THAN A REGRESSION.
   *
   * The four-tab strip existed to switch between four READINESS views. The Alpha reader
   * surface has no four readiness views on its primary frame to switch between, so the
   * strip went with them and R08's drawer model carries what is left — *"DRAWER =
   * sustained investigation. Drawers replace, they do not stack."*
   *
   * This guard asserts the replacement is COMPLETE rather than merely present: every
   * drawer a frame declares has a control that opens it, and the region it opens is
   * labelled. A dock button with no drawer, or a drawer with no label, fails here.
   */
  it('both frames wire the drawer pattern completely', () => {
    for (const f of ['MarketScreen.tsx', 'MarketCompactScreen.tsx']) {
      const src = read(join(DOMAIN_COMPONENTS, f));
      /*
        THE DOCK LIST IS NOW A SUBSET OF THE DRAWER SET, AND THE GUARD SAYS WHICH.

        It read `DRAWERS === ['CAPABILITY', 'ANALYSIS']`, which asserted two things at once:
        that the drawer pattern is wired, and that every drawer is docked. The second stopped
        being true when the readiness substrate moved behind a secondary control, so the
        assertion is split rather than relaxed: the dock carries exactly the two reader
        affordances, and READINESS is a drawer that the dock must NOT carry.

        Asserting the exclusion is the half that matters. A later change that quietly docks
        the readiness drawer again would restore the engineering console one button at a
        time, and this is where it fails.
      */
      expect(src).toContain("const DOCKED: readonly Drawer[] = ['PROVENANCE', 'ANALYSIS']");
      expect(src).toMatch(/type Drawer =\s*'PROVENANCE' \| 'ANALYSIS' \| 'READINESS'/);
      expect(src).not.toMatch(/DOCKED[^\n]*READINESS/);
      /* and it is reachable, from a control that is not a dock cell */
      expect(src).toContain('data-mkt="open-readiness"');
      expect(src).toContain("dispatch({ k: 'OPEN', v: 'READINESS' })");
      expect(src).toContain('data-mkt="dock-button"');
      expect(src).toContain('data-mkt-dock={d}');
      expect(src).toContain("dispatch({ k: 'OPEN', v: d })");
      expect(src).toContain('role="region"');
      expect(src).toContain('aria-label=');
      expect(src).toContain('data-mkt="drawer-close"');
      /* no tab vocabulary survives anywhere — a half-migrated frame fails both ways */
      expect(src).not.toContain('role="tablist"');
      expect(src).not.toContain('role="tabpanel"');
    }
  });
});

/* ═══ 5 · A REGISTERED LOCALE IS TOTAL ════════════════════════════════════════ */

describe('the Polish catalogue does not register as complete', () => {
  it('only English is registered', () => {
    expect(resolveMktStrings('en').fellBack).toBe(false);
  });

  it('Polish discloses its fallback like every other unauthored locale', () => {
    for (const l of ['pl', 'fr', 'de', 'es', 'pt', 'ar'] as const) {
      expect(resolveMktStrings(l).fellBack).toBe(true);
    }
  });

  it('the absence copy — the product on this surface — is never silently English', () => {
    /* Every locale that shows English absence sentences now says so on screen. */
    for (const l of ['pl', 'fr', 'ar'] as const) {
      const r = resolveMktStrings(l);
      expect(r.strings.absence.NO_QUALIFIED_SOURCE).toBe(mktStrings('en').absence.NO_QUALIFIED_SOURCE);
      expect(r.fellBack).toBe(true);
    }
  });

  it("L's ratified Polish is applied, unedited", () => {
    expect(MKT_PL_DRAFT_AWAITING_COMPLETION.domain).toBe('Rynek');
    expect(MKT_PL_DRAFT_AWAITING_COMPLETION.absence.NO_QUALIFIED_SOURCE.length).toBeGreaterThan(20);
  });

  /**
   * L T-6 · no Polish value asserts an active provider, connected observations or a price.
   * On a surface that shows no figures the absence copy IS the product, so this is the
   * assertion that matters most about it.
   */
  it('L T-6 · no Polish value implies a provider, an observation or a price', () => {
    const values = JSON.stringify(MKT_PL_DRAFT_AWAITING_COMPLETION);
    for (const rx of [/aktywny dostawca(?! danych rynkowych)/i, /podłączono dane/i,
      /\bcena\b/i, /\bkurs\b/i, /\bnotowani/i]) {
      expect(values).not.toMatch(rx);
    }
  });

  it('L T-6 is capable of failing — positive control', () => {
    expect(/\bcena\b/i.test(JSON.stringify({ q: 'cena akcji' }))).toBe(true);
  });

  /** F §4 · the draft is not total against the ratified interface, so it does not register. */
  it('F §4 · every leaf with no Polish source is counted, and the count is L\u2019s queue', () => {
    const leaves = (o: unknown, p = ''): string[] =>
      Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
        v && typeof v === 'object' ? leaves(v, p ? `${p}.${k}` : k) : [p ? `${p}.${k}` : k]);
    const iface = new Set(leaves(mktStrings('en')));
    const draft = new Set(leaves(MKT_PL_DRAFT_AWAITING_COMPLETION));
    /*
      ══ L'S AUTHORING QUEUE, PINNED ══════════════════════════════════════════
      
      The Alpha reader surface added 46 leaves, and the final visual frames added five
      more — `reader.awaitingData`, `coverage`, `change` and `readinessControl`.
      This lane authored NONE of their Polish, deliberately: F's ownership line is unchanged — *"H wires, L authors the six
      other locales"* — and a lane that invents Polish to make its own guard pass has
      written the defect L exists to prevent.
      
      So the gap is not hidden, it is COUNTED. This list is exactly what L must author
      before `pl` can register, and pinning it means a leaf added later without telling L
      fails here rather than quietly widening the gap. The three `labels.observation*`
      entries are F's original three and are still outstanding.
      
      Until this list is empty the catalogue stays EN-only and the banner discloses the
      fallback — which is the governed behaviour, not a workaround for it.
    */
    expect([...iface].filter((x) => !draft.has(x)).sort()).toEqual([
      'freshness.DELAYED', 'freshness.LAST_CLOSE', 'freshness.LATEST_PUBLISHED',
      'freshness.LIVE', 'freshness.STALE', 'freshness.UNAVAILABLE',
      'labels.observationBadgeHeld', 'labels.observationBadgeZero', 'labels.observationBody',
      'procurement.buyer', 'procurement.country', 'procurement.cpv', 'procurement.deadline',
      'procurement.notStated', 'procurement.notice', 'procurement.noticeType',
      'procurement.openNotice', 'procurement.published', 'procurement.retainedAt',
      'procurement.statedValue',
      'reader.awaitingData', 'reader.capability', 'reader.capabilityActivation',
      'reader.capabilityNone', 'reader.capabilityRights', 'reader.change',
      'reader.coverage', 'reader.freshness', 'reader.headline',
      'reader.headlineNone', 'reader.observations', 'reader.period',
      'reader.providerNotActivated', 'reader.provisionalRetention',
      'reader.readNoActivatedProvider', 'reader.readNoDisplayable', 'reader.readNoEndpoint',
      'reader.readNoObservation', 'reader.readinessControl', 'reader.seriesIdentifier',
      'reader.seriesNameNotCarried',
      'reader.showCapability', 'reader.showProvenance', 'reader.source',
      'reader.sourceClass', 'reader.unit', 'reader.value', 'reader.vintage',
      'reader.vintageChanged', 'reader.vintageNone', 'reader.vintagePublisher',
      'readiness.changeStates', 'readiness.equityOrIndex', 'readiness.gleifParent',
      'readiness.gleifSector', 'readiness.procurementCompanyJoin',
      'readiness.procurementRefKinds', 'readiness.routeGeometry', 'readiness.runtimeSubjects',
      'release.FINAL', 'release.PRELIMINARY', 'release.REVISED', 'release.SCHEDULED',
      'release.WITHDRAWN',
    ]);
    expect([...draft].filter((x) => !iface.has(x))).toEqual([]);
  });

  it('no catalogue entry is built by spreading English', () => {
    const src = stripComments(read(join(DOMAIN_LIB, 'mktStrings.ts')));
    expect(src).not.toMatch(/:\s*MktStrings\s*=\s*\{\s*\.\.\.en/);
  });
});
