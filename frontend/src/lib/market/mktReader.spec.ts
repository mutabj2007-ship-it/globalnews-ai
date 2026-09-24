import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import {
  MARKET_CAPABILITY,
  MARKET_HAS_RUNNABLE_PROVIDER,
  MARKET_OBSERVATION_CONTRACT_FIELDS,
  MARKET_READ_ABSENCE,
  MARKET_RETENTION_IS_PROVISIONAL,
  deriveFreshness,
  observationIsDisplayable,
  readMarketObservations,
  type MarketStoredObservation,
} from './mktReadModel';
import { mktStrings } from './mktStrings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE READER SURFACE'S TRUTHFUL-DATA GUARDS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The readiness surface could be guarded by a numeral whitelist, because it rendered only
 * counts of contract members. The reader surface will render REAL VALUES, so a whitelist
 * is the wrong instrument — it would have to be widened the moment a producer lands, and a
 * guard that gets widened on schedule is a guard nobody trusts.
 *
 * These assert the PROPERTIES instead: what may reach a reader, what may never be
 * inferred, and what may never be formatted into a claim the source did not make.
 */

const DOMAIN_LIB = join(process.cwd(), 'src', 'lib', 'market');
const DOMAIN_COMPONENTS = join(process.cwd(), 'src', 'components', 'market');
const DOMAIN_APP = join(process.cwd(), 'src', 'app', 'market');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(e) && !/\.spec\.tsx?$/.test(e) ? [full] : [];
  });
}
const DOMAIN_SOURCES = [
  ...sourceFiles(DOMAIN_LIB),
  ...sourceFiles(DOMAIN_COMPONENTS),
  ...sourceFiles(DOMAIN_APP),
];
const read = (f: string): string => readFileSync(f, 'utf8');
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/** A synthetic observation. SYNTHETIC — this shape never reaches a rendered route. */
const obs = (over: Partial<MarketStoredObservation> = {}): MarketStoredObservation => ({
  observationKey: 'eco:1:6:s-synth:m14:2026-08',
  seriesId: 's-synth',
  periodId: '2026-08',
  value: 3.21,
  unit: 'PC',
  publisherVintage: null,
  publisherChangedAt: '2026-09-17T23:00:00.000Z',
  vintageProvenance: 'PUBLISHER_CHANGED_AT',
  releaseStatus: 'FINAL',
  provider: 'EUROSTAT',
  sourceClass: 'OFFICIAL_STATISTIC',
  retentionIsFinal: false,
  ...over,
});

/* ═══ 1 · THE CONTRACT CANNOT DRIFT SILENTLY ══════════════════════════════════ */

describe('the read model reproduces the accepted observation contract', () => {
  /**
   * The frontend cannot import the backend, so the field names are reproduced by hand —
   * and a reproduction nobody checks is a copy that diverges. This asserts the read
   * model's own keys against the recorded contract list. Rename a field in the ingest
   * platform without renaming it here and the build fails, rather than a card rendering
   * an empty cell where a value used to be.
   */
  it('every contract field is present on the read type, and none is missing', () => {
    const keys = Object.keys(obs());
    for (const f of MARKET_OBSERVATION_CONTRACT_FIELDS) expect(keys).toContain(f);
  });

  it('the attribution the contract does NOT carry is required here', () => {
    /* provider and sourceClass belong to the ingest run; the read port must join them */
    const keys = Object.keys(obs());
    expect(keys).toContain('provider');
    expect(keys).toContain('sourceClass');
    expect(MARKET_OBSERVATION_CONTRACT_FIELDS as readonly string[]).not.toContain('provider');
    expect(MARKET_OBSERVATION_CONTRACT_FIELDS as readonly string[]).not.toContain('sourceClass');
  });
});

/* ═══ 2 · FRESHNESS IS DERIVED, AND LIVE IS UNREACHABLE ═══════════════════════ */

describe('freshness is derived from the contract and never assumed', () => {
  /**
   * R10: *"LIVE — only with a licensed real-time contract. Not assumed anywhere in
   * Phase 1."* The union declares it so the surface can name it; the derivation has no
   * branch that returns it, and no source is qualified that could.
   */
  it('LIVE is never returned, for any input the contract admits', () => {
    const provenances = ['PUBLISHER_VINTAGE', 'PUBLISHER_CHANGED_AT', 'INGEST_SNAPSHOT'] as const;
    const releases = ['SCHEDULED', 'PRELIMINARY', 'REVISED', 'FINAL', 'WITHDRAWN'] as const;
    for (const vp of provenances) {
      for (const rs of releases) {
        for (const v of [null, 0, 3.21, -1]) {
          for (const pv of [null, '2026-08-01']) {
            for (const pc of [null, '2026-09-17T23:00:00.000Z']) {
              const f = deriveFreshness(obs({
                vintageProvenance: vp, releaseStatus: rs, value: v,
                publisherVintage: pv, publisherChangedAt: pc,
              }));
              expect(f.kind).not.toBe('LIVE');
            }
          }
        }
      }
    }
  });

  it('LIVE exists in the vocabulary — positive control, so the assertion above is not vacuous', () => {
    expect(mktStrings('en').freshness.LIVE).toBe('Live');
  });

  /**
   * THE DEFECT THIS REFUSES. `provenance.retrievedAt` is our download time. G measured
   * that three of four P0 observation sources cannot supply a publisher vintage at all,
   * so an INGEST_SNAPSHOT observation must never be labelled with a publisher timestamp —
   * that is exactly presenting our fetch as the publisher's issue date.
   */
  it('an INGEST_SNAPSHOT observation never carries a publisher-stated vintage', () => {
    const f = deriveFreshness(obs({
      vintageProvenance: 'INGEST_SNAPSHOT',
      publisherVintage: '2026-08-01',
      publisherChangedAt: '2026-09-17T23:00:00.000Z',
    }));
    expect(f.kind).toBe('STALE');
    expect(f.at).toBeNull();
    expect(f.atProvenance).toBe('INGEST_SNAPSHOT');
  });

  it('a publisher vintage is used only when the contract says it is one', () => {
    expect(deriveFreshness(obs({
      vintageProvenance: 'PUBLISHER_VINTAGE', publisherVintage: '2026-08-01',
    })).kind).toBe('LATEST_PUBLISHED');
    /* declared PUBLISHER_VINTAGE but the field is absent: it is not invented from the other */
    expect(deriveFreshness(obs({
      vintageProvenance: 'PUBLISHER_VINTAGE', publisherVintage: null,
      publisherChangedAt: '2026-09-17T23:00:00.000Z',
    })).at).toBeNull();
  });

  it('a withdrawn figure and a null value are UNAVAILABLE, never stale and never zero', () => {
    expect(deriveFreshness(obs({ releaseStatus: 'WITHDRAWN' })).kind).toBe('UNAVAILABLE');
    expect(deriveFreshness(obs({ value: null })).kind).toBe('UNAVAILABLE');
  });
});

/* ═══ 3 · NOTHING UNATTRIBUTABLE REACHES A READER ═════════════════════════════ */

describe('a figure without a source or a unit is refused, not rendered', () => {
  it.each([
    ['no provider', { provider: '' }],
    ['no source class', { sourceClass: '' }],
    ['no unit', { unit: '' }],
    ['withdrawn', { releaseStatus: 'WITHDRAWN' as const }],
  ])('%s is not displayable', (_label, over) => {
    expect(observationIsDisplayable(obs(over))).toBe(false);
  });

  it('a complete observation is displayable — positive control', () => {
    expect(observationIsDisplayable(obs())).toBe(true);
  });
});

/* ═══ 4 · THE READ PORT ═══════════════════════════════════════════════════════ */

describe('the read port reports the platform gap rather than a quiet market', () => {
  it('the retained reader is wired, while the legacy absence sentinel remains explicit', () => {
    const model = stripComments(read(join(DOMAIN_LIB, 'mktReadModel.ts')));
    expect(model).toContain("const MARKET_READ_PATH = '/market-data/observations'");
    expect(model).toContain('resolveApiBaseUrl()');
    expect(model).toContain('const MARKET_OBSERVATION_READER: MarketObservationReader = retainedObservationReader');
    expect(MARKET_READ_ABSENCE).toBe('NO_READ_ENDPOINT');
  });

  it('every unavailable reason has copy — a reason with no sentence is a blank panel', () => {
    const t = mktStrings('en');
    expect(t.reader.readNoEndpoint.length).toBeGreaterThan(0);
    expect(t.reader.readNoActivatedProvider.length).toBeGreaterThan(0);
    expect(t.reader.readNoObservation.length).toBeGreaterThan(0);
    expect(t.reader.readNoDisplayable.length).toBeGreaterThan(0);
  });
});

/* ═══ 5 · CAPABILITY IS TWO FACTS, NEVER ONE VERDICT ══════════════════════════ */

describe('capability never implies that an unavailable provider is live', () => {
  it('no provider is runnable, and runnability is derived rather than authored', () => {
    expect(MARKET_HAS_RUNNABLE_PROVIDER).toBe(false);
    for (const p of MARKET_CAPABILITY) {
      expect(p.activated).toBe(false);
      expect(p.runnable).toBe(false);
    }
  });

  it('rights and activation are independent, and rights alone never reads as running', () => {
    /* TED and Eurostat have rights. That must not be shown as availability. */
    const ted = MARKET_CAPABILITY.find((p) => p.providerId === 'TED');
    expect(ted?.rightsEligible).toBe(true);
    expect(ted?.runnable).toBe(false);
  });

  it('World Bank and ECB are absent, not listed as unchecked', () => {
    const ids = MARKET_CAPABILITY.map((p) => p.providerId);
    expect(ids).not.toContain('WORLD_BANK');
    expect(ids).not.toContain('ECB');
  });

  it('retention is provisional until Main Snapshot R2 — the surface may not imply settled', () => {
    expect(MARKET_RETENTION_IS_PROVISIONAL).toBe(true);
    expect(mktStrings('en').reader.provisionalRetention).toContain('Not a settled figure');
  });
});

/* ═══ 6 · THE COST AND NETWORK BOUNDARY, ASSERTED IN THE SOURCE ═══════════════ */

describe('the Market frontend cannot reach a provider', () => {
  /**
   * The runtime proof is a browser request log, and it is in the package. This is the
   * STRUCTURAL half: a surface that makes no request today but carries a fetch call is
   * one edit from making one, so the domain is asserted to contain no request machinery
   * at all.
   */
  it('the only fetch is the retained same-deployment read model; no client hook or external URL exists', () => {
    for (const f of DOMAIN_SOURCES) {
      const code = stripComments(read(f));
      const isNumericRead = f.endsWith('mktReadModel.ts');
      const isProcurementRead = f.endsWith('mktProcurementRead.ts');
      if (isNumericRead || isProcurementRead) {
        expect((code.match(/\bfetch\s*\(/g) ?? [])).toHaveLength(1);
        if (isNumericRead) {
          expect(code).toContain("const MARKET_READ_PATH = '/market-data/observations'");
        } else {
          expect(code).toContain("const PATH = '/market-data/procurement'");
        }
      } else {
        expect(code).not.toMatch(/\bfetch\s*\(/);
      }
      expect(code).not.toMatch(/\buseEffect\b/);
      expect(code).not.toMatch(/\buseSWR\b|\buseQuery\b|\baxios\b|XMLHttpRequest/);
      expect(code).not.toMatch(/https?:\/\//);
    }
  });

  it('nothing in the domain names a provider endpoint or an AI route', () => {
    for (const f of DOMAIN_SOURCES) {
      const code = stripComments(read(f));
      expect(code).not.toMatch(/\/analysis\/news/);
      expect(code).not.toMatch(/gnews|openai/i);
    }
  });

  it('the detector fires — positive control', () => {
    expect(/\bfetch\s*\(/.test('await fetch(url)')).toBe(true);
    expect(/https?:\/\//.test('https://example.test')).toBe(true);
  });
});

/* ═══ 7 · NO VALUE IS FORMATTED INTO A CLAIM THE SOURCE DID NOT MAKE ══════════ */

describe('a published value is printed, never interpreted', () => {
  /**
   * G measured that `QUANTITY_IN_100KG` is hundreds of kilograms with nothing in the
   * payload saying so, that Eurostat yields carry no unit field at all, and that the unit
   * lives in a header row for the Pink Sheet. A formatter that decides `PC` means percent,
   * or that rounds, or that inserts a currency symbol, has made a claim the publisher did
   * not — and R10's rounding rule is that a rounded figure which moves when one record is
   * added is an oracle with extra steps.
   */
  it('no locale formatter, no rounding, no currency symbol is applied to a value', () => {
    for (const f of DOMAIN_SOURCES) {
      const code = stripComments(read(f));
      expect(code).not.toMatch(/toLocaleString|toFixed|Intl\.NumberFormat/);
      /* `$` is excluded deliberately: it is a template-literal token in this codebase,
         and the currency-CODE prohibition already lives in `mktContract.spec.ts`. */
      expect(code).not.toMatch(/[€£¥]/);
    }
  });

  it('the unit is rendered as its own labelled fact, beside the value', () => {
    const reader = read(join(DOMAIN_COMPONENTS, 'MktReader.tsx'));
    expect(reader).toContain('label={t.reader.value}');
    expect(reader).toContain('label={t.reader.unit}');
    expect(reader).toContain('label={t.reader.period}');
    expect(reader).toContain('label={t.reader.vintage}');
  });

  it('the three timestamps are never collapsed into one field', () => {
    const reader = read(join(DOMAIN_COMPONENTS, 'MktReader.tsx'));
    expect(reader).toContain('o.periodId');
    expect(reader).toContain('o.publisherVintage');
    expect(reader).toContain('o.publisherChangedAt');
    /* and the vintage always says which of the three it is */
    expect(reader).toContain('t.reader.vintagePublisher');
    expect(reader).toContain('t.reader.vintageChanged');
    expect(reader).toContain('t.reader.vintageNone');
  });
});

/* ═══ 8 · NO ENGINEERING REGISTER ON THE PRIMARY SURFACE ══════════════════════ */

describe('the primary frame does not read like a console', () => {
  /**
   * The activation's wording is that the final surface *"must no longer read like an
   * engineering readiness console"*. That is a claim about what is FIRST, so it is
   * asserted about the primary body rather than about the file: the readiness rows,
   * the contract constants and the NOT READY pills are all still reachable, and all of
   * them are now inside a drawer.
   */
  it('readiness rows and contract constants render only inside a drawer', () => {
    for (const f of ['MarketScreen.tsx', 'MarketCompactScreen.tsx']) {
      const src = read(join(DOMAIN_COMPONENTS, f));
      /*
        SCAN THE RENDERED PRIMARY BODY, NOT THE FILE PREFIX. The import block names these
        symbols because the DRAWER uses them; an import is not a render. The window is
        from the body element to the drawer branch, which is exactly what a reader sees
        before touching a control.
      */
      const bodyAt = src.indexOf(f.startsWith('MarketCompact')
        ? 'data-mkt="compact-body"' : 'data-mkt="body"');
      const drawerAt = src.indexOf("view.drawer === 'READINESS'");
      expect(bodyAt).toBeGreaterThan(0);
      expect(drawerAt).toBeGreaterThan(bodyAt);
      const primary = src.slice(bodyAt, drawerAt);
      /*
        THE WINDOW MOVED WITH THE DRAWER. It closed at `view.drawer === 'CAPABILITY'`, the
        branch that used to hold the readiness substrate; that branch is now `READINESS`,
        and `CAPABILITY` no longer exists as a drawer id. Following the rename keeps the
        window measuring the same thing — everything a reader meets before touching a
        control — rather than silently measuring to the end of the file.
      */
      expect(primary).not.toContain('DATA_READINESS.map');
      expect(primary).not.toContain('SUBJECT_READINESS.map');
      expect(primary).not.toContain('CHANGE_STATES_NOT_DERIVABLE');
      expect(primary).not.toContain('NOT READY');
    }
  });

  it('the primary frame leads with observations or with the unavailable state', () => {
    for (const f of ['MarketScreen.tsx', 'MarketCompactScreen.tsx']) {
      const src = read(join(DOMAIN_COMPONENTS, f));
      const obsAt = src.indexOf('<ObservationCard');
      const unavailableAt = src.indexOf('<ReadUnavailable');
      const capabilityAt = src.indexOf('<CapabilityList');
      expect(obsAt).toBeGreaterThan(0);
      expect(unavailableAt).toBeGreaterThan(0);
      /* primary observations before secondary metadata — the activation's ordering rule */
      expect(obsAt).toBeLessThan(capabilityAt);
      expect(unavailableAt).toBeLessThan(capabilityAt);
    }
  });
});
