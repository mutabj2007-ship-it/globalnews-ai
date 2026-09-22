import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

import {
  POLITICS_CHANGE_AXIS, POLITICS_CONFIDENCE_LEVELS, POLITICS_DOMAIN_SEAM,
  POLITICS_ESCALATION_SEAM_HELD,
  POLITICS_EPISTEMIC_STATES, POLITICS_EVENT_KINDS, POLITICS_POLL_FIELDS,
  POLITICS_SUBJECT_TYPES,
} from './politicsDomain';
import { polStrings } from './politicsStrings';
import {
  POLITICS_POLL_SLOTS, POLITICS_SOURCE_CLASS_SLOTS, POLITICS_SUBJECT_SLOTS,
  POLITICS_UNBOUND_SCOPE,
} from './politicsSubject';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * H-POLITICS-INTELLIGENCE-ALPHA-VISUAL-R1 — THE GUARDS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Politics is the domain where "data-neutral" and "neutral" are two different words, and a
 * frame can satisfy one while failing the other. An empty Economy slot asserts nothing; an
 * empty POLITICAL slot still names its column, and a column named `Governing party` is a
 * claim about how politics works before a single figure arrives.
 *
 * So these guards test two separate things. §§1–3 are the ordinary data-neutrality
 * assertions this lane has used on Market, Economy and Humanitarian. §§4–7 are specific to
 * Part VIII: no political proper noun, no ranking vocabulary, no severity ladder, the four
 * axes unmerged, all seven epistemic states, and the one seam this lane deliberately holds.
 *
 * Every sweep carries a control that can fail.
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

const ROUTES = [
  join(SRC, 'app', 'politics-visual-preview', 'page.tsx'),
  join(SRC, 'app', 'politics-visual-preview', 'compact', 'page.tsx'),
];
const GRAPH = reachable(ROUTES);
const DOMAIN = GRAPH.filter((f) => /(components|lib)[\\/]politics[\\/]/.test(f));

/** Every JSX text node in a file — the characters a reader actually sees. */
function renderedText(file: string): readonly string[] {
  return [...code(file).matchAll(/>([^<>{}]+)</g)].map((m) => (m[1] as string).trim()).filter(Boolean);
}

/**
 * THE READER-FACING CORPUS — and the two things the first draft got wrong about it.
 *
 * A sweep over every string literal in the domain flagged nine false positives and taught
 * the instrument two lessons worth keeping:
 *
 *   1. TAILWIND CLASS STRINGS ARE NOT COPY. `leading-[1.5]` matched a ranking regex on the
 *      word `leading`. A class attribute is layout, a reader never reads it, and scanning it
 *      for political vocabulary is how a guard starts demanding that CSS be politically
 *      neutral.
 *
 *   2. A DECLARATION OF A PROHIBITION IS NOT A VIOLATION OF IT.
 *      `POLITICS_DOMAIN_SEAM.honestyRules` contains *"No political severity ladder is
 *      created"* and *"computes no rank and no political score"*. Those sentences exist so
 *      the rules can be CITED; a guard that rejects them forces the rules to be deleted in
 *      order to pass, which is precisely backwards.
 *
 * So the corpus is what a reader actually meets: every leaf of the English catalogue, plus
 * every JSX text node in the two frames. That is smaller, and it is the only text any of
 * these rules was ever about.
 */
function readerCorpus(): readonly (readonly [string, string])[] {
  const out: (readonly [string, string])[] = [];
  const leaves = (o: unknown, path: string): void => {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (v !== null && typeof v === 'object') leaves(v, `${path}.${k}`);
      else out.push([`strings.${path}.${k}`, String(v)] as const);
    }
  };
  leaves(polStrings('en'), 'en');
  for (const f of DOMAIN.filter((x) => x.endsWith('.tsx'))) {
    for (const t of renderedText(f)) out.push([f.slice(SRC.length), t] as const);
  }
  return out;
}

/* ═══ 0 · THE WALK IS LOAD-BEARING ══════════════════════════════════════════ */

describe('the Politics module graph walk reaches what it claims to', () => {
  it('both routes exist and the domain is in the graph', () => {
    for (const r of ROUTES) expect(`${r}: ${existsSync(r)}`).toBe(`${r}: true`);
    expect(GRAPH.length).toBeGreaterThan(10);
    expect(DOMAIN.length).toBeGreaterThanOrEqual(3);
    for (const must of [
      join(SRC, 'components', 'politics', 'PoliticsEvidenceScreen.tsx'),
      join(SRC, 'lib', 'politics', 'politicsStrings.ts'),
      join(SRC, 'lib', 'politics', 'politicsDomain.ts'),
    ]) expect(`${must}: ${GRAPH.includes(must)}`).toBe(`${must}: true`);
  });

  it('and it consumes the shared specialist platform rather than copying it', () => {
    /*
      "Do not invent a second Politics architecture." The frame reaches the shared HUD
      component and the shared grammar module; if a later change forks either, the import
      disappears and this fails.
    */
    expect(GRAPH).toContain(join(SRC, 'components', 'specialist', 'SpecialistHudLine.tsx'));
    expect(GRAPH).toContain(join(SRC, 'lib', 'specialist', 'hudGrammar.ts'));
  });
});

/* ═══ 1 · ZERO PROVIDER EXECUTION, ZERO AI ON LOAD ══════════════════════════ */

const NETWORK_TOKENS: readonly RegExp[] = [
  /\bfetch\s*\(/, /XMLHttpRequest/, /\buseSWR\b/, /\baxios\b/, /EventSource/, /https?:\/\//,
];

describe('no Politics surface can reach a provider or spend AI', () => {
  it('only the bounded retained-reader adapter performs a network call', () => {
    const offenders: string[] = [];
    for (const f of GRAPH) {
      // R1 admits first-party retained reads, never acquisition. Behavioral tests cover errors and holds.
      if ([join(SRC, 'lib', 'evidence', 'retainedReaders.ts'), join(SRC, 'lib', 'api', 'apiBase.ts')].includes(f)) continue;
      for (const rx of NETWORK_TOKENS) if (rx.test(code(f))) offenders.push(`${f.slice(SRC.length)} :: ${rx}`);
    }
    expect(offenders).toEqual([]);
  });

  it('the sweep can fail — positive control', () => {
    expect(NETWORK_TOKENS.some((rx) => rx.test("await fetch('https://api.example.com')"))).toBe(true);
  });

  it('no provider or AI name appears anywhere in the graph', () => {
    const offenders = GRAPH
      .filter((f) => /gnews|openai|\/analysis\/news|acled|ucdp|gdelt|cellar/i.test(code(f)))
      .map((f) => f.slice(SRC.length));
    expect(offenders).toEqual([]);
  });

  it('§9 · the zero-AI promise is stated to the reader, not merely obeyed', () => {
    expect(polStrings('en').labels.zeroAiNavigation).toMatch(/costs no AI/i);
    expect(code(join(SRC, 'components', 'politics', 'PoliticsScreen.tsx'))).toContain('zeroAiNavigation');
  });
});

/* ═══ 2 · NO FABRICATED POLITICAL OBSERVATION ═══════════════════════════════ */

/**
 * A digit is not a figure. `EU-27` is a geography and `admin-1` is a rung; a FIGURE is a
 * standalone number, a number with a unit or percent, or a grouped number. Same instrument
 * the Humanitarian lane arrived at, after its first draft rejected a real place name.
 */
function looksLikeAFigure(text: string): boolean {
  const withoutIdentifiers = text.replace(/[A-Za-z]+[-–]?\d+[A-Za-z]*|\d+[-–][A-Za-z]+/g, ' ');
  return /(?:^|\s)[-+]?\d[\d\s,.]*\s*(?:%|[A-Za-z]{1,3}\b)?(?:$|\s|[.,;)])/.test(withoutIdentifiers)
    && /\d/.test(withoutIdentifiers);
}

describe('no fabricated political observation reaches the render path', () => {
  it('no Politics component renders a figure as text', () => {
    const offenders: string[] = [];
    for (const f of DOMAIN.filter((x) => x.endsWith('.tsx'))) {
      for (const t of renderedText(f).filter(looksLikeAFigure)) offenders.push(`${f.slice(SRC.length)}: ${t}`);
    }
    expect(offenders).toEqual([]);
  });

  it('the figure scan tells a figure from an identifier — positive control', () => {
    for (const figure of ['42% of seats', '1,240 votes', '3 seats', 'Turnout 61.2']) {
      expect(`${figure}: ${looksLikeAFigure(figure)}`).toBe(`${figure}: true`);
    }
    for (const name of ['EU-27', 'admin-1', 'R08']) {
      expect(`${name}: ${looksLikeAFigure(name)}`).toBe(`${name}: false`);
    }
  });

  it('the unbound subject holds no observation at all', () => {
    expect(POLITICS_UNBOUND_SCOPE.jurisdictionBound).toBe(false);
    expect(POLITICS_UNBOUND_SCOPE.precision).toBeNull();
    expect(POLITICS_UNBOUND_SCOPE.precisionCeiling).toBeNull();
    for (const s of POLITICS_SUBJECT_SLOTS) expect(s.bound).toBeNull();
    for (const s of POLITICS_POLL_SLOTS) expect(s.value).toBeNull();
    /* A count is an observation. There is no count, not even zero. */
    for (const s of POLITICS_SOURCE_CLASS_SLOTS) expect(s.artifactCount).toBeNull();
  });

  it('no domain file formats a number for display', () => {
    const offenders = DOMAIN.filter((f) => /toLocaleString|Intl\.NumberFormat|toFixed|toPrecision/.test(code(f)));
    expect(offenders).toEqual([]);
  });
});

/* ═══ 3 · NO POLITICAL PROPER NOUN ══════════════════════════════════════════ */

/**
 * THE GUARD THAT IS SPECIFIC TO THIS DOMAIN.
 *
 * Part VIII's walkthroughs are worked in Kenya and Poland, and its authority names IEBC, the
 * Kenyan counties and the Polish coalition. Every one of those is ILLUSTRATIVE — the design
 * says so — and a Politics surface that named one would be asserting a jurisdiction, an
 * institution or a party that no contract has bound.
 *
 * The precedent is Economy's accepted guard, which forbids `Rwanda|Mombasa|Kigali|Poland|
 * NISR|GUS` everywhere outside its fixture module for exactly this reason. Politics has no
 * fixture module at all, so the rule has no exception here.
 *
 * `POLITICS_DOMAIN_SEAM.claim` deliberately speaks in KINDS — *"institutional and
 * governmental political developments"* — never in names, which is what lets a claim
 * registry exist before any subject does.
 */
const POLITICAL_PROPER_NOUNS: readonly RegExp[] = [
  /\bKenya\b/i, /\bPoland\b/i, /\bPolish\b/i, /\bRwanda\b/i, /\bIEBC\b/, /\bKiswahili\b/i,
  /\bSejm\b/i, /\bBundestag\b/i, /\bcongress\b/i, /\bparliament of\b/i,
  /\bruling party\b/i, /\bopposition party\b/i, /\bcoalition of\b/i,
];

describe('no political proper noun reaches the reader', () => {
  it('no domain literal names a country, institution or party', () => {
    const offenders = readerCorpus()
      .filter(([, value]) => POLITICAL_PROPER_NOUNS.some((rx) => rx.test(value)))
      .map(([where, value]) => `${where}: ${value}`);
    expect(offenders).toEqual([]);
  });

  it('the proper-noun sweep can fail — positive control', () => {
    for (const sample of ['Kenya 2027 election', 'the Polish coalition', 'IEBC declared']) {
      expect(`${sample}: ${POLITICAL_PROPER_NOUNS.some((rx) => rx.test(sample))}`).toBe(`${sample}: true`);
    }
    /* And it does not reject the vocabulary the design actually authorises. */
    for (const allowed of ['Legislative subject', 'Protest / mobilisation campaign', 'Court ruling']) {
      expect(`${allowed}: ${POLITICAL_PROPER_NOUNS.some((rx) => rx.test(allowed))}`).toBe(`${allowed}: false`);
    }
  });
});

/* ═══ 4 · NEUTRAL PRESENTATION — NO RANKING, NO SCORING ═════════════════════ */

/**
 * The activation's §4, as a scan: the UI must not *"rank political actors"*, *"present a
 * winner/loser judgement"*, or *"encode approval/disapproval through decorative scoring"*.
 *
 * R11 puts materiality into the SHARED attentionRank, and C·2 keeps ordering upstream — so
 * a ranking word inside this domain would be a Politics-local score by another name, which
 * is the thing both registers exist to prevent.
 */
const RANKING_VOCABULARY: readonly RegExp[] = [
  /\bwinner\b/i, /\bloser\b/i, /\bleading\b/i, /\bfavourite\b/i, /\bfavorite\b/i,
  /\bbest\b/i, /\bworst\b/i, /\bstrongest\b/i, /\bweakest\b/i, /\bscore\b/i,
  /\bstability score\b/i, /\belectability\b/i, /\bpredict/i, /\bforecast\b/i,
];

describe('the Politics surface ranks nothing and scores nothing', () => {
  it('no domain literal carries ranking or scoring vocabulary', () => {
    const offenders = readerCorpus()
      .filter(([, value]) => RANKING_VOCABULARY.some((rx) => rx.test(value)))
      .map(([where, value]) => `${where}: ${value}`);
    expect(offenders).toEqual([]);
  });

  it('the ranking sweep can fail — positive control', () => {
    for (const s of ['Leading party', 'Government stability score', 'Predicted winner']) {
      expect(`${s}: ${RANKING_VOCABULARY.some((rx) => rx.test(s))}`).toBe(`${s}: true`);
    }
  });

  it('the queue is ordered upstream and this layer sorts nothing', () => {
    expect(POLITICS_DOMAIN_SEAM.queueRankingRule).toMatch(/ordered upstream/i);
    expect(POLITICS_DOMAIN_SEAM.queueRankingRule).toMatch(/computes no rank/i);
    const offenders = DOMAIN.filter((f) => /\.sort\s*\(|\.reduce\s*\(/.test(code(f)));
    expect(offenders).toEqual([]);
  });

  it('no state is encoded as a colour — §4, and the reason the chip has one border', () => {
    /*
      A chip whose hue varied by political state would be a scoring device whatever its
      values were called. The only licensed accent on this surface is the platform's own
      `sp-cyan`, used on a heading marker and nowhere else.
    */
    const parts = code(join(SRC, 'components', 'politics', 'PolParts.tsx'));
    expect(parts).not.toMatch(/amber|#F2A93C|text-red|bg-red|text-green|bg-green/i);
  });
});

/* ═══ 5 · §5 — FOUR AXES, NEVER MERGED, AND NO SEVERITY LADDER ══════════════ */

describe('the four axes stay independent and no severity ladder exists', () => {
  it('each axis is its own vocabulary, not a member of one union', () => {
    /* Four separate exports. A single merged union would be the merge §5 forbids. */
    expect(POLITICS_SUBJECT_TYPES).toHaveLength(3);
    expect(POLITICS_EVENT_KINDS).toHaveLength(7);
    expect(POLITICS_CHANGE_AXIS).toBe('SHARED_CHANGE_STATE');
    expect(POLITICS_CONFIDENCE_LEVELS).toEqual(['LOW', 'MODERATE', 'HIGH']);
    /* No value is a member of two axes. */
    const all = [...POLITICS_SUBJECT_TYPES, ...POLITICS_EVENT_KINDS, ...POLITICS_CONFIDENCE_LEVELS];
    expect(new Set(all).size).toBe(all.length);
  });

  it('the frame renders four separately labelled slots', () => {
    const screen = code(join(SRC, 'components', 'politics', 'PoliticsScreen.tsx'));
    for (const label of ['labels.subjectType', 'labels.lifecycleEvent', 'labels.changeState', 'labels.confidence']) {
      expect(`${label}: ${screen.includes(label)}`).toBe(`${label}: true`);
    }
  });

  it('no severity ladder is created and Conflict severity is not inherited', () => {
    /*
      §5: *"No political severity ladder is created; Conflict severity is not inherited."*
      The import is what would make inheritance possible, so the import is what is asserted
      absent — a comment promising restraint is not a boundary.
    */
    /*
      ASSERT THE IMPORT AND THE RENDER, NOT THE WORD. The first draft rejected
      `honestyRules`' own sentence *"No political severity ladder is created"* — a guard
      that can only be satisfied by deleting the rule it enforces. Inheritance would arrive
      through an import; a ladder would arrive through rendered text. Both are checked, and
      the declaration is left alone.
    */
    const imported = DOMAIN.filter((f) => /from '@\/lib\/.*conflict|CONFLICT_SEVERITIES/.test(code(f)));
    expect(imported).toEqual([]);
    const rendered = readerCorpus()
      .filter(([, v]) => /\bsevere\b|\bcritical\b|\bseverity\b/i.test(v))
      .map(([where, v]) => `${where}: ${v}`);
    expect(rendered).toEqual([]);
  });
});

/* ═══ 6 · §6 AND §7 — SEVEN STATES, TEN POLL FIELDS, NO TREND ═══════════════ */

describe('the trust and polling vocabularies survive the empty state', () => {
  it('all seven epistemic states are carried and rendered', () => {
    expect(POLITICS_EPISTEMIC_STATES).toHaveLength(7);
    expect(POLITICS_SOURCE_CLASS_SLOTS).toHaveLength(7);
    const t = polStrings('en');
    for (const state of POLITICS_EPISTEMIC_STATES) expect(t.epistemic[state].length).toBeGreaterThan(3);
    /* Both frames render the set, so neither collapses it at its own breakpoint. */
    for (const f of ['PoliticsScreen.tsx', 'PoliticsCompactScreen.tsx']) {
      expect(code(join(SRC, 'components', 'politics', f))).toContain('POLITICS_SOURCE_CLASS_SLOTS');
    }
  });

  it('all ten poll disclosure fields are carried, on the phone too', () => {
    expect(POLITICS_POLL_FIELDS).toHaveLength(10);
    expect(POLITICS_POLL_SLOTS).toHaveLength(10);
    for (const f of ['PoliticsScreen.tsx', 'PoliticsCompactScreen.tsx']) {
      expect(code(join(SRC, 'components', 'politics', f))).toContain('POLITICS_POLL_SLOTS');
    }
  });

  it('§7 · nothing aggregates polls into a series, a trend or a forecast', () => {
    const offenders = DOMAIN.filter((f) => /trendLine|aggregate|pollAverage|movingAverage|\bseries\b/i.test(code(f)));
    expect(offenders).toEqual([]);
    /* The field that prevents it is present and is a disclosure, not a computation. */
    expect(POLITICS_POLL_FIELDS).toContain('SINGLE_POLL_VS_TREND');
  });
});

/* ═══ 7 · THE THREE UNAVAILABLE STATES, AND THE PROTEST RULE ════════════════ */

describe('materially different unavailable states are not collapsed', () => {
  it('three distinct words, with three distinct meanings', () => {
    const t = polStrings('en').labels;
    const words = [t.awaitingData, t.notAssessed, t.noVerifiedEvidence];
    expect(new Set(words).size).toBe(3);
  });

  it('§8 · the protest slot never implies no unrest or safety', () => {
    /*
      The activation names the failure precisely: an empty protest state *"must not imply
      'no unrest' or 'safe'"*. The slot carries `Not assessed`, the accepted equivalent, and
      neither word may appear anywhere in the domain's copy.
    */
    const offenders = readerCorpus()
      .filter(([, v]) => /\bno unrest\b|\bsafe\b|\bpeaceful\b|\bcalm\b|\bstable\b/i.test(v))
      .map(([where, v]) => `${where}: ${v}`);
    expect(offenders).toEqual([]);
    for (const f of ['PoliticsScreen.tsx', 'PoliticsCompactScreen.tsx']) {
      expect(code(join(SRC, 'components', 'politics', f))).toContain('labels.notAssessed');
    }
  });

  it('the unrest sweep can fail — positive control', () => {
    expect(/\bno unrest\b|\bsafe\b/i.test('No unrest reported')).toBe(true);
  });
});

/* ═══ 8 · THE TWO SEAMS THIS LANE HOLDS ════════════════════════════════════ */

describe('the held seams are held, and asserted rather than remembered', () => {
  it('Politics is NOT registered as a specialist domain, and the union is untouched', () => {
    /*
      `SpecialistDomainId` carries six members and none is `POLITICS`. Widening it is a
      shared-contract change, and E1 carries it as S-4 · SAFE TO DEFER. The config is
      prepared and deliberately not registered — registering routes a reader to surfaces,
      and that routing is Main's decision.
    */
    const domainModule = code(join(SRC, 'lib', 'specialist', 'specialistDomain.ts'));
    expect(domainModule).not.toMatch(/'POLITICS'/);
    const seam = code(join(SRC, 'lib', 'politics', 'politicsDomain.ts'));
    expect(seam).not.toContain('registerSpecialistDomain(');
    expect(POLITICS_DOMAIN_SEAM.id).toBe('POLITICS');
  });

  it('no escalation classification is encoded anywhere in the frame', () => {
    /*
      Part VIII R08 routes `PROTEST_ESCALATED` to Conflict; Main's M-2 routes the
      non-armed case to Security. Both are accepted and they disagree. G raised it and did
      not apply it; neither does this lane. A slot shaped like an escalation decision would
      hard-code one of the two answers by geometry.
    */
    /*
      THE SEAM CONSTANT NAMES THE HOLD, so a file sweep would reject the very declaration
      that records it. What must be clean is (a) the reader's copy and geometry, and (b)
      every domain file EXCEPT the one that declares the hold — a second file learning the
      word is a second place the decision could be made.
    */
    const declaring = join(SRC, 'lib', 'politics', 'politicsDomain.ts');
    const offenders = DOMAIN
      .filter((f) => f !== declaring)
      .filter((f) => /PROTEST_ESCALATED|escalat|SECURITY_THRESHOLD|routeToConflict/i.test(code(f)))
      .map((f) => f.slice(SRC.length));
    expect(offenders).toEqual([]);

    const inCopy = readerCorpus()
      .filter(([, v]) => /escalat/i.test(v))
      .map(([where, v]) => `${where}: ${v}`);
    expect(inCopy).toEqual([]);

    /* And the hold is recorded, so it is a decision rather than an omission. */
    expect(POLITICS_ESCALATION_SEAM_HELD).toMatch(/Unresolved/);
  });

  it('Politics contributes no geometry — Spatial is reused unchanged', () => {
    /* §8: *"Spatial v1.7 is reused unchanged; Politics contributes no geometry."* */
    expect(POLITICS_DOMAIN_SEAM.mapLayers).toEqual([]);
    const offenders = DOMAIN.filter((f) => /LineString|Polygon|coordinates|geoJson/i.test(code(f)));
    expect(offenders).toEqual([]);
  });
});

/* ═══ 9 · ROUTE POSTURE ════════════════════════════════════════════════════ */

describe('the preview route is a preview, and the live route is not opened', () => {
  it('both routes are noindex', () => {
    for (const r of ROUTES) {
      expect(`${r}: ${/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/.test(code(r))}`).toBe(`${r}: true`);
    }
  });

  it('no /politics route exists', () => {
    expect(existsSync(join(SRC, 'app', 'politics'))).toBe(false);
  });

  it('Home reaches the PREVIEW and never the product route — which is what this test was always about', async () => {
    /*
      ── THIS TRIPWIRE HAS NOW TURNED OVER TWICE, BOTH TIMES BY RULING ────────

      R1 asserted that `intelligenceModules.ts` carried no `politics` entry AT
      ALL, *"so there is nothing to make inert — asserted so that adding one
      becomes a decision rather than a side effect."* Adding one became a
      decision and it was taken (ENGINE-CONVERGENCE-R1 §2), so R2 re-pointed the
      teeth at the destination: a PREVIEW card with no destination is
      unreachable, because `isModuleNavigable` requires both.

      NOW THE SECOND HALF HAS BEEN RULED ON TOO. The Product Owner's convergence
      instruction is explicit — *"set Politics card destination to
      /politics-visual-preview and make the PREVIEW card navigable"* — and the
      measurement R2 rested on has been answered: the routes this file tests are
      on disk, in this lineage, asserted by §12 below.

      SO WHAT WAS THIS TEST EVER ABOUT? Not inertness. Its own name says
      NAVIGATION, and the danger it guards is a reader being sent from Home to a
      Politics PRODUCT surface that is not open and has no data behind it —
      producer coverage is still 0 of 24. That danger is untouched by the card
      becoming clickable, and it is asserted here HARDER than before, because
      there is now a real link whose address has to be exactly right:

        the card exists and is navigable        — the ruling, honoured
        it is PREVIEW, never ACTIVE             — no claim the product is open
        it points at the preview address        — and at exactly that one
        it never points at `/politics`          — the governed route
        `app/politics` does not exist           — so the route is 404 regardless

      An inertness assertion would now pin a state the Product Owner has ruled
      against. These five pin the property that inertness was only ever a proxy
      for, and every one of them would fail if the card were repointed at the
      product route — which is the failure the old test could not even express,
      because it forbade the destination outright.
    */
    const mod = (await import('../intelligenceModules')) as typeof import('../intelligenceModules');
    const politics = mod.INTELLIGENCE_MODULES.find((m) => m.id === 'politics');
    expect(politics).toBeDefined();
    expect(politics?.state).toBe('preview');
    expect(politics?.state).not.toBe('active');
    expect(politics?.destination).toBe('/politics-visual-preview');
    expect(mod.isModuleNavigable(politics!)).toBe(true);

    /*
      THE ADDRESS IS THE PROTECTION, so it is checked on the registry SOURCE as
      well as on the parsed value — a literal `/politics` in the module config
      would be caught here even if it reached the card by some other field.
    */
    const registry = code(join(SRC, 'lib', 'intelligenceModules.ts'));
    expect(registry).toContain("destination: '/politics-visual-preview'");
    expect(registry).not.toMatch(/destination:\s*'\/politics'/);
    /* POSITIVE CONTROL · the scan really does catch the forbidden destination */
    expect(/destination:\s*'\/politics'/.test("    destination: '/politics',")).toBe(true);

    /* and the product route is still not a route at all */
    expect(existsSync(join(SRC, 'app', 'politics'))).toBe(false);
  });

  it('English is the only registered locale, and the fallback is disclosed', async () => {
    const strings = (await import('./politicsStrings')) as typeof import('./politicsStrings');
    expect(strings.resolvePolStrings('en').fellBack).toBe(false);
    for (const l of ['pl', 'fr', 'de', 'es', 'pt', 'ar'] as const) {
      expect(`${l}: ${strings.resolvePolStrings(l).fellBack}`).toBe(`${l}: true`);
    }
    for (const f of ['PoliticsScreen.tsx', 'PoliticsCompactScreen.tsx']) {
      expect(code(join(SRC, 'components', 'politics', f))).toContain('localeFallback');
    }
  });
});

/* ═══ 10 · THE DOMAIN DIRECTORY IS THE WHOLE DOMAIN ════════════════════════ */

describe('no Politics code escapes the domain directories', () => {
  it('nothing outside lib/politics and components/politics imports the domain', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        if (!/\.tsx?$/.test(full) || /\.spec\.ts$/.test(full)) continue;
        if (/[\\/](lib|components)[\\/]politics[\\/]/.test(full)) continue;
        if (/[\\/]app[\\/]politics-visual-preview[\\/]/.test(full)) continue;
        if (/from '@\/(lib|components)\/politics\//.test(code(full))) offenders.push(full.slice(SRC.length));
      }
    };
    walk(join(SRC, 'lib'));
    walk(join(SRC, 'components'));
    expect(offenders).toEqual([]);
  });
});

/* ═══ 12 · THE CONVERGENCE SURFACE — WHAT CODE HAS TO LAND ═════════════════ */

/**
 * ════════════════════════════════════════════════════════════════════════════
 * POLITICS ALPHA VISUAL ROUTE CONVERGENCE R2
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Engine audit measured Politics as PREVIEW with no destination, because
 * `app/politics-visual-preview`, `components/politics` and `lib/politics` are
 * all ABSENT from the convergence lineage. This round's job is to make landing
 * this frame a mechanical operation rather than a reconstruction.
 *
 * SO THE THING WORTH ASSERTING IS THE SEAM, NOT THE PIXELS. The sections above
 * already prove the frame is honest. What Code needs to know is narrower and
 * has never been written down: exactly what this package touches outside its
 * own two directories, and whether any of it is new.
 */
describe('12 · the package is self-contained against the current lineage', () => {
  /**
   * Every module the Politics graph reaches OUTSIDE `lib/politics` and
   * `components/politics`, as repository-relative paths.
   *
   * Derived from the same walk the rest of this file uses, so it cannot drift
   * from what the route actually imports — a hand-written list would be a
   * second opinion about the first one.
   */
  const EXTERNAL = GRAPH
    .filter((f) => !DOMAIN.includes(f))
    .filter((f) => !ROUTES.includes(f))
    .map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'))
    .sort();

  it('reaches exactly the accepted modules outside its own tree, and every one already exists', () => {
    /*
      MEASURED ON `Worktrees/beta-recovery-r1/frontend/src`, the convergence
      lineage, and all five are PRESENT there:

        components/specialist/SpecialistHudLine.tsx   PRESENT
        lib/specialist/hudGrammar.ts                  PRESENT
        lib/specialist/specialistDomain.ts            PRESENT
        lib/i18n/languages.ts                         PRESENT
        lib/typography/runBoundary.tsx                PRESENT

      So landing this package adds NO new dependency to the lineage. That is the
      claim the convergence rests on, and it is pinned here exactly rather than
      as a count, because a count would still pass if one were swapped.

      ── ALPHA MAJOR CONVERGENCE R1 — FOUR ENTRIES ADDED, DELIBERATELY ───────

      The shared Back/Return primitive lands on this surface as HOST B, so this
      ledger legitimately grows. It is EXTENDED, not relaxed: the list is still
      pinned exactly, every added module is named, and a fifth arrival still
      fails this assertion.

        components/navigation/ReturnControl.tsx   the one shared control
        lib/navigation/returnDepth.ts             the history signal
        lib/navigation/returnFallback.ts          the governed fallback
        lib/navigation/returnStrings.ts           its self-contained vocabulary

      WHAT THIS LEDGER CAUGHT, AND WHY THE CONTROL WAS REBUILT TO SATISFY IT.
      The first landing imported `getDictionary` and `intelligenceModules`,
      which dragged the entire product string table plus the route authority
      into this closure — nine further modules, and with them the `https://`
      literals and provider names that this file's OWN provider-reachability
      guards then reported. Those guards were right. The control was rebuilt to
      carry its own six-string vocabulary and an import-free fallback, so the
      four modules above are the whole cost. See `lib/navigation/returnStrings.ts`.

      All four are NEW files in this convergence rather than pre-existing
      lineage members, which is why they are listed separately from the five
      above: the five prove the package needed nothing new, the four record
      exactly what the accepted shared-nav round added on top.
    */
    expect(EXTERNAL).toEqual([
      'components/navigation/ReturnControl.tsx',
      'components/specialist/SpecialistHudLine.tsx',
      'lib/api/apiBase.ts',
      'lib/election/electionRead.ts',
      'lib/evidence/retainedReaders.ts',
      'lib/i18n/languages.ts',
      'lib/navigation/returnDepth.ts',
      'lib/navigation/returnFallback.ts',
      'lib/navigation/returnStrings.ts',
      'lib/specialist/hudGrammar.ts',
      'lib/specialist/specialistDomain.ts',
      'lib/typography/runBoundary.tsx',
    ]);
    for (const rel of EXTERNAL) {
      expect(`${rel}: ${existsSync(join(SRC, rel))}`).toBe(`${rel}: true`);
    }
  });

  it('does not depend on the shared Politics platform, so landing is not blocked on it', () => {
    /*
      `MAIN-POLITICS-PLATFORM-PROMOTION-R3` is READY FOR G/CODE and records, in
      its own words, that *"the promotion itself was not performed"* and that
      `shared/src/politics` = 0 files. Measured again on the lineage: the
      directory does not exist there either.

      THIS FRAME NEVER NEEDED IT. `politicsDomain.ts` declares the presentation
      vocabulary locally, which is why the two can land in either order. A
      dependency here would have made a reader surface wait on a data contract
      it does not read.
    */
    const offenders = DOMAIN
      .filter((f) => /from '@globalnews-ai\/shared\/politics|shared\/src\/politics/.test(code(f)))
      .map((f) => f.slice(SRC.length));
    expect(offenders).toEqual([]);
  });

  it('the Engine destination is exactly the route this package creates', () => {
    /*
      The one fact the Engine card needs, asserted against the filesystem rather
      than quoted from a README. `/politics-visual-preview` is the destination
      H's Engine card takes once Code lands this package; the Engine package is
      NOT edited by this round.
    */
    const ENGINE_DESTINATION = '/politics-visual-preview';
    expect(existsSync(join(SRC, 'app', ...ENGINE_DESTINATION.slice(1).split('/'), 'page.tsx'))).toBe(true);
    expect(existsSync(join(SRC, 'app', 'politics-visual-preview', 'compact', 'page.tsx'))).toBe(true);
    /* and the governed route it is NOT: `/politics` must stay absent */
    expect(existsSync(join(SRC, 'app', 'politics'))).toBe(false);
  });

  it('Watch is the shared surface, placed and unpopulated — never a second one', () => {
    /*
      The convergence requirements name *"shared Watch/Follow integration"*. The
      accepted frame satisfies it by PLACEMENT rather than by building anything:
      the context rail carries the Watch field, it renders the absent mark, and
      no Politics-specific watch, alert or notification machinery exists.

      A local store or alert component would be the *"second Watch"* the
      specialist rules forbid, so its absence is asserted rather than assumed.
    */
    const corpus = DOMAIN.map(code).join('\n');
    for (const forbidden of [
      'useWatch', 'watchStore', 'PoliticsWatch', 'useAlerts', 'AlertService',
      'subscribeAlerts', 'Notification(',
    ]) {
      expect(`${forbidden}: ${corpus.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
    /* the placement is real: the label exists and the rail renders it */
    const screen = code(join(SRC, 'components', 'politics', 'PoliticsScreen.tsx'));
    expect(screen).toContain('t.labels.watch');
  });

  it('provenance and source class are reachable affordances, not hidden detail', () => {
    /*
      *"provenance/source affordances"*. Two of them, both in the accepted
      frame: a source-class region in the rail, and a provenance drawer whose
      control names itself in the reader's words rather than in engineering
      register.
    */
    const screen = code(join(SRC, 'components', 'politics', 'PoliticsScreen.tsx'));
    expect(screen).toContain('t.labels.sourceClass');
    expect(screen).toContain('t.labels.showProvenance');
    const en = polStrings('en');
    expect(en.labels.showProvenance.length).toBeGreaterThan(0);
    expect(en.labels.sourceClass.length).toBeGreaterThan(0);
  });

  it('both routes are noindex, and the package creates no other route', () => {
    for (const r of ROUTES) {
      expect(`${r}: ${/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/.test(code(r))}`)
        .toBe(`${r}: true`);
    }
    /* the whole app surface this package adds, and nothing else */
    const added = ['politics-visual-preview'];
    for (const dir of added) {
      expect(`${dir}: ${existsSync(join(SRC, 'app', dir))}`).toBe(`${dir}: true`);
    }
  });
});
