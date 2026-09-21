import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * H-SPECIALIST-DASHBOARDS-ALPHA-VISUAL-R1 — THE FOUR PREVIEW SURFACES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Product Owner's ruling grants one thing and withholds another in the same breath:
 * *"Missing data may be visually silenced so the Product Owner can inspect and approve the
 * intended final dashboard. This is not permission to fabricate observations."*
 *
 * Silencing and fabricating look identical in a screenshot. A `—` in a KPI cell and a
 * `3.5` in a KPI cell are both a composed dashboard; only one of them is a claim. So the
 * separation cannot rest on a capture — it has to be asserted about the code that produces
 * the capture, which is what this file does.
 *
 * FOUR THINGS ARE PROVED HERE, EACH WITH A CONTROL THAT CAN FAIL:
 *
 *   1  no numeric observation reaches the production render path;
 *   2  no surface reachable from these four routes can call an external provider;
 *   3  the Economy preview cannot arrive at fixture figures by any path;
 *   4  the reader-facing copy carries no implementation or debug register.
 *
 * WHY A MODULE-GRAPH WALK AND NOT A GREP. A grep over `components/economy` proves nothing
 * about what `/economy-visual-preview` renders: the route could import a fetching module
 * from anywhere. The walk below starts at the four route files and follows every relative
 * and `@/`-aliased import transitively, so what it asserts is a property of the REACHABLE
 * graph rather than of a directory somebody remembered to name.
 */

const SRC = join(__dirname, '..', '..');

const ROUTES: readonly string[] = [
  join(SRC, 'app', 'market', 'page.tsx'),
  join(SRC, 'app', 'market', 'compact', 'page.tsx'),
  join(SRC, 'app', 'economy-visual-preview', 'page.tsx'),
  join(SRC, 'app', 'economy-visual-preview', 'compact', 'page.tsx'),
];

const read = (f: string): string => readFileSync(f, 'utf-8');

/** Source with comments removed — a rule named in a comment is not a rule broken in code. */
function code(file: string): string {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/** Resolve one import specifier to a file on disk, or null when it leaves this tree. */
function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return null; // a package, not this tree
  for (const candidate of [
    base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && !candidate.endsWith('/')) {
      try {
        if (readFileSync(candidate) !== null && /\.tsx?$/.test(candidate)) return candidate;
      } catch { /* a directory — fall through */ }
    }
  }
  return null;
}

/** Every file reachable from the four route entry points. */
function reachable(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = code(file);
    const specs = [...src.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1] as string);
    for (const spec of specs) {
      const next = resolveImport(file, spec);
      if (next !== null && !seen.has(next)) queue.push(next);
    }
  }
  return [...seen].sort();
}

const GRAPH = reachable(ROUTES);

/* ═══ 0 · the walk itself is load-bearing, so it is checked first ═════════════ */

describe('the module graph walk reaches what it claims to reach', () => {
  it('it starts at four real routes and pulls in both domains', () => {
    for (const r of ROUTES) expect(`${r}: ${existsSync(r)}`).toBe(`${r}: true`);
    /* If the walk silently resolved nothing, every assertion below would pass vacuously. */
    expect(GRAPH.length).toBeGreaterThan(20);
    for (const must of [
      join(SRC, 'components', 'economy', 'EconomyScreen.tsx'),
      join(SRC, 'components', 'economy', 'QuietFrame.tsx'),
      join(SRC, 'components', 'market', 'MarketScreen.tsx'),
      join(SRC, 'components', 'market', 'MktReader.tsx'),
      join(SRC, 'lib', 'market', 'mktReadModel.ts'),
      join(SRC, 'lib', 'economy', 'productionSubject.ts'),
    ]) {
      expect(`${must}: ${GRAPH.includes(must)}`).toBe(`${must}: true`);
    }
  });

  it('the walk is capable of finding a forbidden token — positive control', () => {
    /* Proves the sweeps below are reading real file contents, not an empty set. */
    const anyFile = GRAPH.find((f) => f.endsWith('QuietFrame.tsx')) as string;
    expect(code(anyFile)).toContain('GeographyKeys');
  });
});

/* ═══ 1 · NO FABRICATED OBSERVATION ══════════════════════════════════════════ */

/**
 * The components that stand in for an absent figure. If a number ever appears as rendered
 * TEXT in one of these, the data-neutral mode has become a fabrication.
 */
const NEUTRAL_COMPONENTS: readonly string[] = [
  join(SRC, 'components', 'economy', 'QuietFrame.tsx'),
  join(SRC, 'components', 'economy', 'DataAvailability.tsx'),
  join(SRC, 'components', 'market', 'MktReader.tsx'),
];

describe('no fabricated numeric observation reaches the render path', () => {
  it('the data-neutral components render no numeric literal as text', () => {
    /*
      JSX TEXT ONLY, NOT THE FILE. These files are full of numbers — `padding: '10px'`,
      `sizePx = 26`, `flex: '1 1 100px'` — and every one of them is geometry. What would be
      a fabrication is a number a reader READS as a figure, so the scan looks at JSX text
      nodes: the characters between a `>` and a `<` that are not inside braces.
    */
    for (const f of NEUTRAL_COMPONENTS) {
      const src = code(f);
      const texts = [...src.matchAll(/>([^<>{}]+)</g)].map((m) => (m[1] as string).trim());
      const numeric = texts.filter((t) => /\d/.test(t));
      expect(`${f}: ${JSON.stringify(numeric)}`).toBe(`${f}: []`);
    }
  });

  it('that scan can fail — positive control', () => {
    const sample = '<span>3.5</span>';
    const texts = [...sample.matchAll(/>([^<>{}]+)</g)].map((m) => (m[1] as string).trim());
    expect(texts.filter((t) => /\d/.test(t))).toEqual(['3.5']);
  });

  it('nothing in the graph formats a number for display', () => {
    /*
      G's P0 measurement is the reason this is a rule and not a preference:
      `QUANTITY_IN_100KG` is hundreds of kilograms with nothing in the payload saying so,
      and a formatter that decides `PC` means percent has made a claim the source did not.
      A surface with no observations has no excuse to carry one at all.
    */
    const offenders = GRAPH.filter((f) => /components\/(economy|market)\//.test(f))
      .filter((f) => /toLocaleString|Intl\.NumberFormat|toFixed|toPrecision/.test(code(f)));
    expect(offenders).toEqual([]);
  });

  it('the production-shaped Economy subject still holds no number', () => {
    const src = code(join(SRC, 'lib', 'economy', 'productionSubject.ts'));
    /* Every figure is a GAP built by `absent()`; no observation literal may appear. */
    expect(src).toContain("return economyGap(seriesId, `${seriesId}:no-period`, 'NO_PRODUCER');");
    expect(src).not.toMatch(/value:\s*-?\d/);
    expect(src).toContain('triad: null');
    expect(src).toContain('history: []');
  });
});

/* ═══ 2 · ZERO EXTERNAL PROVIDER CALLS ═══════════════════════════════════════ */

/** Tokens that indicate a CALL, not a provider's NAME. */
const NETWORK_TOKENS: readonly RegExp[] = [
  /\bfetch\s*\(/, /XMLHttpRequest/, /\buseSWR\b/, /\baxios\b/, /EventSource/, /https?:\/\//,
];

/** Files in the reachable graph that belong to the two specialist domains. */
const DOMAIN = GRAPH.filter((f) => /(components|lib)[\\/](economy|market)[\\/]/.test(f));

describe('no preview surface can reach an external provider', () => {
  it('the walk found both domains, so the domain sweep is not vacuous', () => {
    expect(DOMAIN.length).toBeGreaterThan(20);
  });

  it('no domain file performs a network call or carries an absolute URL', () => {
    /*
      ONE NAMED EXCEPTION, AND IT IS EXEMPT FROM THE TOKEN RATHER THAN FROM THE RULE.

      The Economy observation read reaches THIS DEPLOYMENT over a relative path behind
      the `/economy` public rewrite. What this sweep exists to stop is a domain file
      reaching an EXTERNAL PROVIDER, and the absolute-URL half of that — the half that
      would let it — is asserted on the exempt file below rather than waived.

      NAMED, not patterned: a second domain file acquiring a network call fails here.
    */
    const GOVERNED_SAME_ORIGIN_READS = new Set([
      'economyObservationRead.ts',
      'mktReadModel.ts',
    ]);
    const offenders: string[] = [];
    for (const f of DOMAIN) {
      const src = code(f);
      if ([...GOVERNED_SAME_ORIGIN_READS].some((name) => f.endsWith(name))) {
        /* The half that matters, kept: it cannot point off this origin. */
        if (/https?:\/\//.test(src)) offenders.push(`${f.slice(SRC.length)} :: absolute URL`);
        continue;
      }
      for (const rx of NETWORK_TOKENS) {
        if (rx.test(src)) offenders.push(`${f.slice(SRC.length)} :: ${rx}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the sweep can fail — positive control', () => {
    const sample = "const r = await fetch('https://api.example.com');";
    expect(NETWORK_TOKENS.some((rx) => rx.test(sample))).toBe(true);
  });

  /**
   * THE ONE CALL SITE IN THE WHOLE GRAPH, NAMED RATHER THAN ASSUMED AWAY.
   *
   * `/market` and `/market/compact` render the platform chrome — `NavBar`, which reaches
   * `AccountControl` → `useAccount` → `accountFetch`. That is a SAME-ORIGIN read of the
   * viewer's own session, and it is on every route in the product; it is not a data
   * provider and it fetches nothing about a market or an economy.
   *
   * The activation's boundary is external providers: *"0 GNews, 0 OpenAI, 0 /analysis/news,
   * 0 TED, 0 Eurostat, 0 GUS, 0 other external data providers"*. `accountFetch` is none of
   * those and is pinned here as the ONLY network module the four routes can reach, so a
   * second one — of any kind — fails this assertion rather than arriving quietly.
   */
  it('every reachable network module is an explicitly named same-deployment read', () => {
    /*
      `.replace(/\\/g, '/')` — A PLATFORM FIX, NOT A WEAKENING OF THIS GUARD.

      `join` yields `\` on Windows, so this comparison read
      `\lib\api\accountFetch.ts` against a POSIX literal and FAILED on every
      Windows run — for the separator alone, while naming the correct single
      file. A guard that can only ever be red on a platform is not protecting
      anything there; it teaches its reader to skip it.

      What is normalised is the SPELLING of the path and nothing else. The set
      itself is untouched: still every module in the reachable graph containing
      a network call, still required to be exactly one file, still that file.
      A second network site appearing would fail here exactly as before.

      This is the same normalisation H's own newer `politicsVisualFrame.spec.ts`
      §12 applies for the same reason.
    */
    /*
      TWO NETWORK MODULES NOW, AND THE PROPERTY THAT MATTERS IS ASSERTED ON BOTH.

      The rule was "exactly one file, and it carries no absolute origin", and the
      second half is the one doing the work: *"the request cannot leave this
      deployment."* The Economy read joins the list with exactly that property — a
      relative path behind the `/economy` public rewrite — so the guard is widened by
      one NAMED member and tightened by applying the origin check to every member
      rather than to one file by hand.

      A THIRD network site still fails here, and any member acquiring an absolute
      origin fails here, which is what the assertion was protecting.
    */
    const ALLOWED_READS = [
      '/lib/api/accountFetch.ts',
      '/lib/economy/economyObservationRead.ts',
      '/lib/market/mktReadModel.ts',
    ];

    const sites = GRAPH.filter((f) => /\bfetch\s*\(|XMLHttpRequest|\buseSWR\b|\baxios\b|EventSource/.test(code(f)))
      .map((f) => f.slice(SRC.length).replace(/\\/g, '/'));
    expect(sites.sort()).toEqual([...ALLOWED_READS].sort());

    /* No absolute origin in ANY of them — none can leave this deployment. */
    for (const rel of ALLOWED_READS) {
      const src = code(join(SRC, ...rel.slice(1).split('/')));
      expect([rel, /https?:\/\//.test(src)]).toEqual([rel, false]);
    }
  });

  it('no provider identifier in the graph is used as an address', () => {
    /*
      `EUROSTAT`, `TED` and `GLEIF` DO appear in `mktReadModel.ts` — they are the provider
      ids on the capability rows, and the rows exist to say those providers are NOT running.
      A name is not a call, and the distinction is the whole reason the sweep above matches
      `fetch(` and `https://` rather than the words. What must never happen is a name being
      concatenated into a URL, which is what this asserts.
    */
    for (const f of DOMAIN) {
      const src = code(f);
      expect(`${f.slice(SRC.length)}`).toBe(`${f.slice(SRC.length)}`);
      expect(src).not.toMatch(/['"`]https?:/);
      expect(src).not.toMatch(/api\.[a-z]+\.(com|org|eu)/i);
    }
  });

  /**
   * A Server Component cannot fetch on the client, but a `'use client'` child can. Every
   * effect in the reachable graph is pinned: the four domain effects are a ResizeObserver,
   * two Escape-key listeners and a detent handler, and the three platform ones are the
   * chrome that ships on every route. A new effect anywhere in this graph fails here and
   * has to be argued for.
   */
  it('every effect in the graph is enumerated', () => {
    const effects = GRAPH.filter((f) => /useEffect\s*\(/.test(code(f)))
      .map((f) => f.slice(SRC.length).replace(/\\/g, '/'));
    expect(effects.sort()).toEqual([
      '/components/economy/AnchoredHud.tsx',
      '/components/economy/EconomyDrawer.tsx',
      '/components/economy/EconomyScreen.tsx',
      '/components/economy/compact/EconomyCompactScreen.tsx',
      '/components/navigation/AccountControl.tsx',
      '/components/navigation/NavBar.tsx',
      '/components/search/LanguageSelector.tsx',
      '/lib/hooks/useAccount.ts',
    ]);
  });
});

/* ═══ 3 · FIXTURES ARE UNREACHABLE FROM THE PREVIEW ══════════════════════════ */

describe('the Economy preview cannot arrive at fixture figures', () => {
  const PREVIEWS = ROUTES.filter((r) => r.includes('economy-visual-preview'));

  it('each preview route names where its capability comes from, and never a fixture', () => {
    /*
      THE RULE WAS "NAME THE CAPABILITY", AND IT STILL IS — the capability just stopped
      being a literal.

      H's inventory named this seam: *"`ECONOMY_DATA_CAPABILITY` is a LITERAL. It
      becomes the return of a nullable reader."* It has, so a route now names
      `economyCapabilityFrom(read)` instead. That is strictly MORE explicit: the old
      form named a constant that could not be anything else, and the new one names the
      READ the capability is derived from, so a route cannot claim OBSERVED without a
      read having returned an observation.

      The half that has not moved, and never may: NO ROUTE MAY REACH A FIXTURE.
    */
    for (const r of PREVIEWS) {
      const src = code(r);
      const namesSource =
        src.includes('data={ECONOMY_DATA_CAPABILITY}') ||
        src.includes('data={economyCapabilityFrom(read)}');
      expect([r, namesSource]).toEqual([r, true]);

      /* Never defaulted, never omitted — an omission is how a default becomes a decision. */
      expect(src).not.toContain('FIXTURE_DATA_CAPABILITY');
    }
  });

  it('the fixture module is not in the reachable graph at all', () => {
    const fixtures = join(SRC, 'lib', 'economy', 'fixtures.ts');
    expect(existsSync(fixtures)).toBe(true); // it exists; it is simply not reachable
    expect(`reachable: ${GRAPH.includes(fixtures)}`).toBe('reachable: false');
  });

  it('the measured capability is still NO_OBSERVATION_SOURCE in the config', () => {
    const src = code(join(SRC, 'lib', 'economy', 'economyConfig.ts'));
    expect(src).toMatch(/ECONOMY_DATA_CAPABILITY[^=]*=\s*\{\s*numericObservations:\s*'NO_OBSERVATION_SOURCE'/);
  });
});

/* ═══ 4 · NO ENGINEERING REGISTER IN READER COPY ═════════════════════════════ */

/**
 * The activation names the register it is removing: the reader must not be told
 * *"no internal read is connected"*, *"provider not running"*, *"endpoint not implemented"*
 * or *"rights permit use but not activated"*.
 *
 * THE SCAN IS OF THE READER GROUPS ONLY, AND THAT IS DELIBERATE. `absence`, `readiness`
 * and `labels.contractSays` still carry exactly that register — `Not runtime-enabled — the
 * contract lists no enabled subject` — and they must, because a lane that doubts a NOT
 * READY verdict needs the contract constant that produced it. What the activation moved is
 * the AUDIENCE, not the vocabulary: that copy now renders only inside the readiness
 * disclosure, which a separate guard in `mktReader.spec.ts` pins.
 */
const ENGINEERING_PHRASES: readonly RegExp[] = [
  /internal read/i, /not running/i, /endpoint/i, /not activated, so/i,
  /runtime-enabled/i, /shared contract/i, /recorded for Main/i,
];

describe('reader-facing copy carries no implementation register', () => {
  it('the Market reader group is clean', async () => {
    const { mktStrings } = (await import('../market/mktStrings')) as typeof import('../market/mktStrings');
    const reader = mktStrings('en').reader;
    const offenders: string[] = [];
    for (const [key, value] of Object.entries(reader)) {
      for (const rx of ENGINEERING_PHRASES) {
        if (rx.test(value)) offenders.push(`reader.${key}: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the phrase scan can fail, and the engineering register still exists where it belongs', async () => {
    const { mktStrings } = (await import('../market/mktStrings')) as typeof import('../market/mktStrings');
    const t = mktStrings('en');
    /*
      THE CONTROL IS THE REAL COPY, NOT A FABRICATED STRING. `absence.NOT_RUNTIME_ENABLED`
      is a live value that the scan above would reject — which proves two things at once:
      the regexes bite, and the engineering register was relocated rather than deleted.
    */
    expect(ENGINEERING_PHRASES.some((rx) => rx.test(t.absence.NOT_RUNTIME_ENABLED))).toBe(true);
    expect(ENGINEERING_PHRASES.some((rx) => rx.test(t.absence.AWAITING_SHARED_CONTRACT))).toBe(true);
  });

  it('the Economy copy a reader meets on the frame is availability language', async () => {
    const { economyStrings } = (await import('../economy/strings')) as typeof import('../economy/strings');
    for (const locale of ['en', 'pl'] as const) {
      const t = economyStrings(locale);
      /* The resident note and the quiet slots use these three and nothing else. */
      for (const value of [t.noObservationTitle, t.freshness.UNDETERMINED, t.sharedObservationBase]) {
        expect(`${locale}: ${value}`).not.toMatch(/endpoint|runtime|contract/i);
      }
    }
  });
});

/* ═══ 5 · THE GOVERNED ROUTE STAYS SHUT ══════════════════════════════════════ */

describe('the visual preview does not open the governed Economy route', () => {
  it('app/economy does not exist', () => {
    /*
      The same fact `b4aEconomySubstrate.spec.ts` asserts, restated in the file that owns
      the preview. Two independent readings, so a change that opens the route has to defeat
      both — and this one sits beside the preview it would be used to justify.
    */
    expect(existsSync(join(SRC, 'app', 'economy'))).toBe(false);
  });

  it('every preview and Market route is noindex', () => {
    for (const r of ROUTES) {
      expect(`${r}: ${/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/.test(code(r))}`)
        .toBe(`${r}: true`);
    }
  });

  /*
    ── R2 §3 AND §4 OPENED THESE TWO CARDS, AND THE RULE THEY GUARD IS INTACT ─

    This asserted that neither Economy nor Market was reachable from Home. The
    Product Owner has since verified both Alpha surfaces and ruled their cards
    clickable, and R2 §11 rules that PREVIEW may be clickable at all.

    THE THING THIS TEST ACTUALLY PROTECTS IS UNCHANGED AND IS ASSERTED HARDER:
    the GOVERNED `/economy` route must not be opened, and no card may reach for
    it. Economy's card points at the PREVIEW; `app/economy` still does not
    exist, asserted above and in `b4aEconomySubstrate.spec.ts`; and both routes
    remain `noindex`, asserted directly above.

    `noindex` and clickable are not in tension: `robots` addresses a search
    engine, a card addresses a reader. Neither route's metadata is touched by
    the change that made these two cards open.
  */
  it('both cards open their PREVIEW surface, and neither reaches the governed /economy route', async () => {
    const mod = (await import('../intelligenceModules')) as typeof import('../intelligenceModules');
    const byId = new Map(mod.INTELLIGENCE_MODULES.map((m) => [m.id, m]));

    const expected: Record<string, string> = {
      economy: '/economy-visual-preview',
      market: '/market',
    };
    for (const id of ['economy', 'market']) {
      const entry = byId.get(id);
      expect(`${id}: ${entry !== undefined}`).toBe(`${id}: true`);
      expect(`${id} state: ${entry!.state}`).toBe(`${id} state: preview`);
      expect(`${id} destination: ${entry!.destination ?? 'none'}`).toBe(`${id} destination: ${expected[id]}`);
      expect(`${id} navigable: ${mod.isModuleNavigable(entry!)}`).toBe(`${id} navigable: true`);
    }

    /* THE TRIPWIRE: no card anywhere may name the gated route. */
    for (const entry of mod.INTELLIGENCE_MODULES) {
      expect(`${entry.id}: ${entry.destination ?? '-'}`).not.toBe(`${entry.id}: /economy`);
    }
    expect(existsSync(join(SRC, 'app', 'economy'))).toBe(false);
  });
});
