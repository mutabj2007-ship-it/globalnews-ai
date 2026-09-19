import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * H-SECURITY-CONFLICT-HUMANITARIAN-ALPHA-VISUAL-R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Three domains, three different answers, and this file pins all three — including
 * the two that are a HOLD, because a HOLD nobody can measure is a HOLD that quietly
 * stops being one.
 *
 *   HUMANITARIAN  built and corrected. The reader screen carries no implementation
 *                 register; the engineering evidence is behind a disclosure.
 *   CONFLICT      the D1 spatial workspace IS the frame, unchanged. The specialist
 *                 Conflict domain stays unrecovered under a standing ruling, and
 *                 §3 below asserts it is still absent.
 *   SECURITY      no implementation exists on any lineage. §4 asserts that too, so
 *                 the day one appears, it appears deliberately.
 */

const SRC = join(__dirname, '..', '..');
const read = (f: string): string => readFileSync(f, 'utf-8');

/** Source with comments removed — a rule named in a comment is not a rule broken in code. */
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
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile() && /\.tsx?$/.test(c)) return c;
  }
  return null;
}

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

const HUM_ROUTES = [
  join(SRC, 'app', 'humanitarian', 'page.tsx'),
  join(SRC, 'app', 'humanitarian', 'compact', 'page.tsx'),
];
const HUM_GRAPH = reachable(HUM_ROUTES);
const HUM_DOMAIN = HUM_GRAPH.filter((f) => /(components|lib)[\\/]humanitarian[\\/]/.test(f));

/* ═══ 0 · the walk is load-bearing, so it is checked first ═══════════════════ */

describe('the Humanitarian module graph walk reaches what it claims to', () => {
  it('both routes exist and the domain is in the graph', () => {
    for (const r of HUM_ROUTES) expect(`${r}: ${existsSync(r)}`).toBe(`${r}: true`);
    expect(HUM_GRAPH.length).toBeGreaterThan(20);
    expect(HUM_DOMAIN.length).toBeGreaterThan(8);
    for (const must of [
      join(SRC, 'components', 'humanitarian', 'HumanitarianScreen.tsx'),
      join(SRC, 'components', 'humanitarian', 'HumParts.tsx'),
      join(SRC, 'lib', 'humanitarian', 'humStrings.ts'),
    ]) expect(`${must}: ${HUM_GRAPH.includes(must)}`).toBe(`${must}: true`);
  });
});

/* ═══ 1 · NO IMPLEMENTATION REGISTER ON THE HUMANITARIAN READER SCREEN ═══════ */

/**
 * The activation names the terms it is removing, and names them as a class:
 * *"Do not expose internal terms such as: GX-14; protection class; provider disabled;
 * schema missing; internal reader unavailable. Those belong in engineering/admin
 * evidence."*
 *
 * THE SCAN IS OF THE ENGLISH CATALOGUE THAT ACTUALLY RENDERS. `pl` is not registered —
 * `HUM_CATALOGUE` is `{ en }` — so Polish falls back to English with a disclosure, and
 * the unregistered Polish draft is L's authoring queue rather than copy a reader meets.
 */
const IMPLEMENTATION_REGISTER: readonly RegExp[] = [
  /\bGX-?14\b/i, /protection class/i, /provider disabled/i, /schema (?:is )?missing/i,
  /does not exist yet/i, /not yet wired/i, /\bunmounted\b/i, /internal reader/i,
  /recorded for Main/i, /no producer/i, /not implemented here/i,
];

/**
 * THE TWO LEAVES THAT MAY CARRY THE REGISTER, AND WHY EXEMPTING THEM IS NOT A LOOPHOLE.
 *
 * `common.dependencyRecorded` is the LABEL ON THE DISCLOSURE CONTROL — what a reader
 * clicks to reach the engineering evidence. A control that did not say what it opens
 * would be worse than one that does.
 *
 * `sensitive.dependency` is the evidence itself. It renders in exactly one place,
 * `drawers/DisplacementAccess.tsx`, through the same `<Dependency>` component — so it is
 * two levels in: a drawer, then a collapsed disclosure inside it.
 *
 * THE EXEMPTION IS PAID FOR BY AN ASSERTION, not taken on trust: the test below proves
 * both leaves reach the screen only through `<Dependency>`, and §2 proves `<Dependency>`
 * is a `<details>` control. Exempting a string from a copy rule while proving it cannot
 * be resident is a different act from not checking it.
 */
const DISCLOSURE_ONLY = new Set(['common.dependencyRecorded', 'sensitive.dependency']);

function leaves(o: unknown, p = ''): readonly (readonly [string, string])[] {
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? leaves(v, p ? `${p}.${k}` : k)
      : [[p ? `${p}.${k}` : k, String(v)] as const]);
}

describe('the Humanitarian reader copy carries no implementation register', () => {
  it('every rendered English leaf is clean', async () => {
    const { humStrings } = (await import('../humanitarian/humStrings')) as typeof import('../humanitarian/humStrings');
    const offenders: string[] = [];
    for (const [key, value] of leaves(humStrings('en'))) {
      if (DISCLOSURE_ONLY.has(key)) continue;
      for (const rx of IMPLEMENTATION_REGISTER) {
        if (rx.test(value)) offenders.push(`${key}: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the scan can fail, and the register still exists where it belongs', async () => {
    const { humStrings } = (await import('../humanitarian/humStrings')) as typeof import('../humanitarian/humStrings');
    const t = humStrings('en');
    /*
      THE CONTROL IS REAL COPY, NOT A FABRICATED STRING. `sensitive.dependency` is a live
      value that the scan above would reject, and it renders only inside the engineering
      disclosure. It proves the regexes bite AND that the register was relocated rather
      than deleted — the two claims that matter.
    */
    expect(IMPLEMENTATION_REGISTER.some((rx) => rx.test(t.sensitive.dependency))).toBe(true);
    expect(IMPLEMENTATION_REGISTER.some((rx) => rx.test(t.common.dependencyRecorded))).toBe(true);
  });

  it('both exempt leaves reach the screen only through the disclosure component', () => {
    /*
      The exemption above is only sound if these two cannot be rendered anywhere else.
      `dependencyRecorded` is read inside `HumParts`' own `<summary>`; `sensitive.dependency`
      is passed to `<Dependency>` at exactly one call site. Any third use fails here.
    */
    const uses: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(full) && !/\.spec\./.test(full)) {
          const src = code(full);
          if (/sensitive\.dependency|common\.dependencyRecorded|t\.common\.dependencyRecorded/.test(src)) {
            uses.push(full.slice(SRC.length).replace(/\\/g, '/'));
          }
        }
      }
    };
    walk(join(SRC, 'components', 'humanitarian'));
    expect(uses.sort()).toEqual([
      '/components/humanitarian/HumParts.tsx',
      '/components/humanitarian/drawers/DisplacementAccess.tsx',
    ]);
  });

  it('the safety disclosure E1 pinned is untouched', async () => {
    const { humStrings } = (await import('../humanitarian/humStrings')) as typeof import('../humanitarian/humStrings');
    /*
      `humContract.spec.ts` asserts this exact sentence. It is a NEGATIVE disclosure —
      it tells a reader that no role can reveal a protected location — and quieting it
      to satisfy a copy rule would have weakened a security guarantee to improve a
      screenshot. It states the POSTURE and never a class, a count, a site or a
      coordinate, which is why it is not the "protection class" the activation forbids.
    */
    expect(humStrings('en').sensitive.noReveal).toBe('No reveal control exists, at any role.');
  });
});

/* ═══ 2 · THE ENGINEERING EVIDENCE IS BEHIND A DISCLOSURE ═══════════════════ */

describe('the dependency evidence is reachable, not resident', () => {
  it('it renders inside a details/summary control', () => {
    const src = code(join(SRC, 'components', 'humanitarian', 'HumParts.tsx'));
    expect(src).toMatch(/<details[^>]*data-hum="dependency"/);
    expect(src).toMatch(/<summary[^>]*data-hum="dependency-control"/);
  });

  it('and the primary frame mounts it through that component, never inline', () => {
    const screen = code(join(SRC, 'components', 'humanitarian', 'HumanitarianScreen.tsx'));
    expect(screen).toContain('<Dependency');
    /* No second, uncollapsed copy of the same prose on the frame. */
    expect(screen).not.toMatch(/data-hum="dependency"/);
  });
});

/* ═══ 3 · CONFLICT — THE STANDING RULING STILL HOLDS ════════════════════════ */

/**
 * `MAIN-CONFLICT-RUNTIME-CONTRACT-R3-ADDENDUM-A1` carries, in its own status line:
 *
 *     **MAIN-CONFLICT-D1 and D4 REMAIN BLOCKING. No Conflict implementation.**
 *
 * and AUTHORITY DELTA A1 §3 addresses H directly: *"H must not wire production Conflict
 * runtime until Main resolves/ratifies these blockers."* The register carries
 * `MAIN-CONFLICT-D1-BIND` as OPEN, module unwired.
 *
 * Canonical C55 DOES carry a frontend Conflict domain — `components/map/conflict/
 * ConflictAssessmentRail.tsx` and `lib/map/conflict/{conflictDomain,conflictCapability,
 * conflictHud}.ts` — and it is deliberately unrecovered here, with the reason recorded in
 * `specialistPlatformNeutrality.spec.ts`: *"Conflict is the one domain that may not be
 * wired."*
 *
 * This asserts the absence rather than trusting it. The Conflict VISUAL frame is the D1
 * spatial workspace, which needs none of these files.
 */
describe('the Conflict domain is not implemented on this lineage', () => {
  it('no Conflict domain directory exists in the frontend', () => {
    for (const absent of [
      join(SRC, 'lib', 'map', 'conflict'),
      join(SRC, 'components', 'map', 'conflict'),
      join(SRC, 'lib', 'conflict'),
      join(SRC, 'components', 'conflict'),
    ]) expect(`${absent}: ${existsSync(absent)}`).toBe(`${absent}: false`);
  });

  it('and no shared file reaches into one', () => {
    /* The B2 boundary this restates is asserted in specialistPlatformNeutrality; this is
       the same fact read from the other side, so a recovery has to defeat both. */
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(full) && /from '@\/lib\/map\/conflict/.test(code(full))) {
          offenders.push(full.slice(SRC.length));
        }
      }
    };
    walk(join(SRC, 'lib', 'specialist'));
    walk(join(SRC, 'components', 'specialist'));
    expect(offenders).toEqual([]);
  });

  it('the D1 shell flag still defaults OFF, so no preview build ships it by omission', async () => {
    /*
      The Conflict visual frame is inspected with `NEXT_PUBLIC_MAP_SHELL=1`, which the
      flag module was written for: *"rolling back the shell is a configuration change and
      not a revert"*, and *"DEFAULT OFF … a flag whose failure mode is 'ship the new
      thing' is not a rollback mechanism."* Turning it on for an evidence build must not
      turn it on for a deployment, so the default is asserted here rather than assumed.
    */
    const mod = (await import('../map/mapShellFlag')) as typeof import('../map/mapShellFlag');
    expect(mod.resolveMapShellVariant(undefined)).toBe('legacy');
    expect(mod.resolveMapShellVariant('')).toBe('legacy');
    expect(mod.resolveMapShellVariant('yes')).toBe('legacy');
    expect(mod.resolveMapShellVariant('1')).toBe('shell');
  });
});

/* ═══ 4 · SECURITY — NOTHING IS IMPLEMENTED, AND THAT IS ASSERTED ═══════════ */

/**
 * Three accepted reviews agree. G-SECURITY-CAP-1 measured **0 of 33 Part IX identifiers**
 * anywhere in canonical, in code or in prose, and 9 of 11 objects ABSENT. MAIN-SECURITY-
 * V1-AUDIT classified Part IX **"C. DESIGN READY BUT PLATFORM CONTRACTS BLOCK
 * IMPLEMENTATION"** — 0 of 11 objects implementable. E1-SECURITY-DESIGN-1 returned PASS
 * WITH CONDITIONS over four blocking items and **six Product Owner decisions**.
 *
 * So there is no Security frontend to preview, and building one would be a first
 * implementation — which is a design act, not a visual convergence. This asserts the
 * absence so that the HOLD is measurable and a later arrival is deliberate.
 */
describe('Security Intelligence is a preview surface, and the live route is still shut', () => {
  /*
    ── THIS TRIPWIRE FIRED, AND IT IS RETIRED DELIBERATELY ───────────────────

    It previously asserted that NONE of four Security paths existed, and the comment above
    states its purpose: to make the HOLD measurable "so that a later arrival is
    deliberate." Part IX has now been converged from
    `MAIN-SECURITY-PARTIX-FINAL-VISUAL-AUTHORITY-R1` (42-row zone authority, six PO
    rulings) and `H-SECURITY-PARTIX-ALPHA-VISUAL-R2`, so three of the four paths exist on
    purpose and this assertion fired exactly as designed. The arrival is the deliberate one
    it was waiting for.

    It is REPLACED WITH A PRESENCE ASSERTION CARRYING THE SAME TEETH, never deleted — the
    discipline Main set for the Economy tripwire, and the reason a control does not quietly
    become nothing the moment the thing it guarded arrives.

    THE HALF THAT STILL MATTERS IS THE FOURTH PATH. `app/security` is the LIVE route; it is
    not authorised, and it is asserted absent below with the same force the whole set used
    to carry. A preview surface existing is not the route opening, and this is where that
    distinction is enforced.
  */
  it('the three implemented Security paths exist, deliberately', () => {
    for (const present of [
      join(SRC, 'lib', 'security'),
      join(SRC, 'components', 'security'),
      join(SRC, 'app', 'security-visual-preview'),
    ]) expect(`${present}: ${existsSync(present)}`).toBe(`${present}: true`);
  });

  it('and the LIVE Security route does NOT — app/security is still absent', () => {
    const live = join(SRC, 'app', 'security');
    expect(`${live}: ${existsSync(live)}`).toBe(`${live}: false`);
  });

  it('SECURITY is a vocabulary member with no configuration and no surface', async () => {
    /*
      The token EXISTS — `SPECIALIST_DOMAIN_IDS` carries it, and an accepted guard already
      asserts an unregistered domain resolves rather than throws. A vocabulary member is
      not an implementation, and this states the difference so neither is mistaken for the
      other: Security is nameable and unbuilt.
    */
    const mod = (await import('./specialistDomain')) as typeof import('./specialistDomain');
    expect(mod.SPECIALIST_DOMAIN_IDS).toContain('SECURITY');
    const strip = (await import('./indicatorStrip')) as typeof import('./indicatorStrip');
    expect(strip.indicatorMaxFor('SECURITY')).toBe(strip.INDICATOR_SOFT_MAX);
  });
});

/* ═══ 5 · ZERO PROVIDER EXECUTION FROM THE HUMANITARIAN ROUTES ══════════════ */

const NETWORK_TOKENS: readonly RegExp[] = [
  /\bfetch\s*\(/, /XMLHttpRequest/, /\buseSWR\b/, /\baxios\b/, /EventSource/, /https?:\/\//,
];

describe('no Humanitarian surface can reach a provider', () => {
  it('no domain file performs a network call or carries an absolute URL', () => {
    const offenders: string[] = [];
    for (const f of HUM_DOMAIN) {
      for (const rx of NETWORK_TOKENS) {
        if (rx.test(code(f))) offenders.push(`${f.slice(SRC.length)} :: ${rx}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the sweep can fail — positive control', () => {
    expect(NETWORK_TOKENS.some((rx) => rx.test("await fetch('https://api.example.com')"))).toBe(true);
  });

  it('no Copernicus or humanitarian provider is named as an address anywhere in the graph', () => {
    const offenders = HUM_GRAPH
      .filter((f) => /copernicus|reliefweb|unocha|acled|ucdp|hdx/i.test(code(f)))
      .map((f) => f.slice(SRC.length));
    expect(offenders).toEqual([]);
  });
});

/* ═══ 6 · NO FABRICATED HUMANITARIAN FIGURE ═════════════════════════════════ */

/**
 * A DIGIT IS NOT A FIGURE, AND THE FIRST DRAFT OF THIS SCAN COULD NOT TELL THE DIFFERENCE.
 *
 * It flagged `Composite scope — e.g. EU-27, Great Lakes` in `WatchConfig.tsx`. `EU-27` is
 * the name of a geography; nothing about it is a count of anything. A scan that rejects it
 * teaches the next author to rename a real place to satisfy a test, which is a worse
 * outcome than the one it was written to prevent.
 *
 * So the rule is what a FIGURE looks like on this surface: a standalone number, a number
 * carrying a unit or a percent, or a comma- or space-grouped number — `1,200`, `43%`,
 * `2.1M`. A digit bound into a token by a hyphen or a letter (`EU-27`, `admin-1`,
 * `COVID-19`, `H-06`) is an identifier, and identifiers are allowed to contain digits.
 */
function looksLikeAFigure(text: string): boolean {
  /* Strip identifier-shaped tokens first, then look for what is left. */
  const withoutIdentifiers = text.replace(/[A-Za-z]+[-–]?\d+[A-Za-z]*|\d+[-–][A-Za-z]+/g, ' ');
  return /(?:^|\s)[-+]?\d[\d\s,.]*\s*(?:%|[A-Za-z]{1,3}\b)?(?:$|\s|[.,;)])/.test(withoutIdentifiers)
    && /\d/.test(withoutIdentifiers);
}

describe('no fabricated humanitarian figure reaches the render path', () => {
  it('no Humanitarian component renders a numeric literal as text', () => {
    /*
      JSX TEXT ONLY. These files are full of numbers — `padding: '10px'`, `gap: '5px'` —
      and every one is geometry. What would be a fabrication is a number a reader READS as
      a population, a casualty count or a severity, so the scan looks at text nodes.
    */
    const offenders: string[] = [];
    for (const f of HUM_DOMAIN.filter((x) => x.endsWith('.tsx'))) {
      const texts = [...code(f).matchAll(/>([^<>{}]+)</g)].map((m) => (m[1] as string).trim());
      for (const t of texts.filter(looksLikeAFigure)) offenders.push(`${f.slice(SRC.length)}: ${t}`);
    }
    expect(offenders).toEqual([]);
  });

  it('that scan can fail, and it tells a figure from an identifier — positive control', () => {
    /* Rejected: real figures of the kind this surface must never invent. */
    for (const figure of ['1,200 displaced', '43% of sites', '2.1M people', 'Severity 4']) {
      expect(`${figure}: ${looksLikeAFigure(figure)}`).toBe(`${figure}: true`);
    }
    /* Accepted: identifiers that merely contain digits. */
    for (const name of ['Composite scope — e.g. EU-27, Great Lakes', 'admin-1 boundaries', 'H-06']) {
      expect(`${name}: ${looksLikeAFigure(name)}`).toBe(`${name}: false`);
    }
  });

  it('the no-composite-score rule survives, stated in the copy a reader sees', async () => {
    /* CTO-H-02. The sector strip is decomposed and says so on the frame. */
    const { humStrings } = (await import('../humanitarian/humStrings')) as typeof import('../humanitarian/humStrings');
    expect(humStrings('en').need.noComposite).toBe('No composite score');
    const screen = code(join(SRC, 'components', 'humanitarian', 'HumanitarianScreen.tsx'));
    expect(screen).toContain('noComposite');
  });
});
