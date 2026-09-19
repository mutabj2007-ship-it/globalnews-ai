import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

import {
  SECURITY_ABSENCE_FALLBACK, SECURITY_ABSENCE_FORBIDDEN_CHANGE_STATE,
  SECURITY_ABSENCE_LABELS, SECURITY_ABSENCE_REACHABLE_AT_ALPHA, SECURITY_ABSENCE_STATES,
  isSecurityAbsenceState, securityAbsenceDegradesTo, securityAbsenceLabel,
} from '@globalnews-ai/shared';
import {
  SECURITY_DETENTS, SECURITY_FORBIDDEN_COPY, SECURITY_GEOMETRY, SECURITY_WITHHELD_ASSET_CLASSES,
  SECURITY_WITHHELD_ZONE_CLASSES, SECURITY_X4_NEVER_INTRODUCED, SECURITY_ZONES,
  securityZone, zoneIsRendered,
} from './securityZones';
import { secStrings } from './securityStrings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * H-SECURITY-PARTIX-ALPHA-VISUAL-R2 — ZONE-MANIFEST CONFORMANCE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Main ruled all six Product Owner questions, closed M-2 and delivered a 42-row zone table.
 * There is nothing here for this lane to decide — so these guards are not judgement calls,
 * they are a CONFORMANCE HARNESS: the rendered surface is asserted against
 * `manifest/SECURITY-ZONE-AUTHORITY.tsv`, row by row.
 *
 * The distinction matters for what happens next. A reviewer reading this frame cannot check
 * 42 rows by eye, and a later change that quietly renders a withheld zone, adds a count, or
 * defaults a severity ladder would look like an improvement in a diff. Each of those fails a
 * named test below.
 *
 * Every sweep carries a control that can fail.
 */

const SRC = join(__dirname, '..', '..');
const read = (f: string): string => readFileSync(f, 'utf-8');

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
  join(SRC, 'app', 'security-visual-preview', 'page.tsx'),
  join(SRC, 'app', 'security-visual-preview', 'compact', 'page.tsx'),
];
const GRAPH = reachable(ROUTES);
const COMPONENTS = [
  join(SRC, 'components', 'security', 'SecurityScreen.tsx'),
  join(SRC, 'components', 'security', 'SecurityCompactScreen.tsx'),
  join(SRC, 'components', 'security', 'SecParts.tsx'),
];
const DOMAIN = GRAPH.filter((f) => /(components|lib)[\\/]security[\\/]/.test(f));

/** Zone ids a component actually mounts, read from the `data-sec-zone` attributes. */
function mountedZoneIds(): ReadonlySet<string> {
  const out = new Set<string>();
  for (const f of COMPONENTS) {
    for (const m of code(f).matchAll(/data-sec-zone=["{]?["']?([A-Z]\d{1,2})["'}]?/g)) out.add(m[1] as string);
    for (const m of code(f).matchAll(/<(?:Zone|StateCell|EmptyPlot|EntryPoint|Region)[^>]*\bid="([A-Z]\d{1,2})"/g)) {
      out.add(m[1] as string);
    }
  }
  /* A0 and A4 are dedicated components; their ids are structural, not props. */
  if (COMPONENTS.some((f) => /ZoneA0/.test(code(f)))) out.add('A0');
  if (COMPONENTS.some((f) => /SeverityLadder/.test(code(f)))) out.add('A4');
  return out;
}

/** Every JSX text node across the two frames and the primitives. */
function renderedText(): readonly string[] {
  const out: string[] = [];
  for (const f of COMPONENTS) {
    for (const m of code(f).matchAll(/>([^<>{}]+)</g)) {
      const t = (m[1] as string).trim();
      if (t) out.push(t);
    }
  }
  return out;
}

/** The English copy a reader can actually meet, from the catalogue and the vocabulary. */
function readerCorpus(): readonly string[] {
  const out: string[] = [];
  const leaves = (o: unknown): void => {
    for (const v of Object.values(o as Record<string, unknown>)) {
      if (Array.isArray(v)) out.push(...v.map(String));
      else if (v !== null && typeof v === 'object') leaves(v);
      else out.push(String(v));
    }
  };
  leaves(secStrings('en'));
  out.push(...Object.values(SECURITY_ABSENCE_LABELS));
  out.push(...renderedText());
  return out;
}

/* ═══ 0 · THE HARNESS IS LOAD-BEARING ═══════════════════════════════════════ */

describe('the conformance harness reads what it claims to', () => {
  it('the manifest carries Main’s 42 rows with unique ids', () => {
    expect(SECURITY_ZONES).toHaveLength(42);
    expect(new Set(SECURITY_ZONES.map((z) => z.id)).size).toBe(42);
  });

  it('and Main’s own census reconciles against the table', () => {
    /*
      Main counted these from the TSV rather than from memory, and recorded that an earlier
      draft asserted 26/13/3 from recall and was wrong. The same check is worth making from
      this side: a transcription that dropped or duplicated a row would pass every other test
      in this file.
    */
    const by = (p: (z: typeof SECURITY_ZONES[number]) => boolean): number => SECURITY_ZONES.filter(p).length;
    expect(by((z) => z.existence === 'YES_REQUIRED')).toBe(3);
    expect(by((z) => z.existence === 'YES_GENERIC_LABEL_ONLY')).toBe(2);
    expect(by((z) => z.existence === 'NO_NOT_RENDERED')).toBe(9);
    expect(by((z) => z.existence === 'NO_REQUIRES_DATA')).toBe(3);
    expect(by((z) => z.personRule === 'NO_GATE_REQUIRED')).toBe(3);
    expect(by((z) => z.personRule === 'NA_REGION_NOT_RENDERED')).toBe(12);
    /* Named person: permitted on ZERO zones. */
    expect(by((z) => (z.personRule as string) === 'PERMITTED')).toBe(0);
  });

  it('the three YES_REQUIRED zones are the three Main names', () => {
    const required = SECURITY_ZONES.filter((z) => z.existence === 'YES_REQUIRED').map((z) => z.id);
    expect(required.sort()).toEqual(['A0', 'B4', 'C2']);
  });

  it('the zone scanner finds zones — positive control', () => {
    expect(mountedZoneIds().size).toBeGreaterThan(15);
    expect(mountedZoneIds().has('A0')).toBe(true);
  });
});

/* ═══ 1 · ROW-BY-ROW CONFORMANCE ════════════════════════════════════════════ */

describe('the rendered frame conforms to the zone authority, row by row', () => {
  it('every YES_REQUIRED zone is mounted; its absence is a defect', () => {
    const mounted = mountedZoneIds();
    for (const z of SECURITY_ZONES.filter((x) => x.existence === 'YES_REQUIRED')) {
      expect(`${z.id} mounted: ${mounted.has(z.id)}`).toBe(`${z.id} mounted: true`);
    }
  });

  it('no NO_NOT_RENDERED or NO_REQUIRES_DATA zone is mounted in any form', () => {
    /*
      Main's rule 3: *"A withheld region leaves no trace. No placeholder, no greyed control,
      no 'unavailable' chip, no legend, no empty canvas. A withheld-region marker is itself
      the disclosure."* So the assertion is on the MOUNT, not on the visibility — a hidden
      element with the zone's id would still be the trace.
    */
    const mounted = mountedZoneIds();
    const offenders = SECURITY_ZONES
      .filter((z) => !zoneIsRendered(z))
      .filter((z) => mounted.has(z.id))
      .map((z) => z.id);
    expect(offenders).toEqual([]);
  });

  it('and the nine withheld zones are the ones Main withheld', () => {
    const withheld = SECURITY_ZONES.filter((z) => z.existence === 'NO_NOT_RENDERED').map((z) => z.id);
    expect(withheld.sort()).toEqual(['C6', 'C8', 'X1', 'X2', 'X4', 'X5', 'X6', 'X7', 'X8']);
  });

  it('every mounted zone has a row in the authority', () => {
    /* A zone that appears without a ruling is as much a defect as a ruled zone that vanishes. */
    const orphans = [...mountedZoneIds()].filter((id) => securityZone(id) === null);
    expect(orphans).toEqual([]);
  });

  it('the two generic-label-only zones render their substrate name and no taxonomy', () => {
    const t = secStrings('en');
    expect(t.zoneLabels.C5).toBe('Infrastructure exposure');
    expect(t.zoneLabels.C7).toBe('Border and posture');
    expect(securityZone('C5')?.existence).toBe('YES_GENERIC_LABEL_ONLY');
    expect(securityZone('C7')?.existence).toBe('YES_GENERIC_LABEL_ONLY');
  });
});

/* ═══ 2 · THE TWO WITHHELD TAXONOMIES, AND X4 ═══════════════════════════════ */

describe('no enumeration discloses a capability', () => {
  it('no asset class and no zone class reaches any component or catalogue', () => {
    /*
      Main's rule 4: *"An enumeration discloses a capability."* The lists exist in exactly one
      place in the tree — `securityZones.ts`, which no component imports for this purpose —
      so that this sweep has an input without the words ever reaching a rendered surface.
    */
    const corpus = readerCorpus().join(' \u0000 ').toLowerCase();
    const offenders = [...SECURITY_WITHHELD_ASSET_CLASSES, ...SECURITY_WITHHELD_ZONE_CLASSES]
      .filter((term) => corpus.includes(term.toLowerCase()));
    expect(offenders).toEqual([]);
  });

  it('X4 is never introduced in any form', () => {
    /*
      *"MUST NOT BE INTRODUCED in any form incl legend placeholder example or copy. Not
      hidden - absent. A withheld-region marker for them would itself be the disclosure."*
      So the sweep covers the components' full source, not only their rendered text: a
      commented-out example would be an introduction waiting to be uncommented.
    */
    const sources = COMPONENTS.map((f) => read(f)).join(' \u0000 ').toLowerCase();
    const offenders = SECURITY_X4_NEVER_INTRODUCED.filter((term) => sources.includes(term.toLowerCase()));
    expect(offenders).toEqual([]);
  });

  it('both sweeps can fail — positive control', () => {
    const sample = 'legend: airport perimeter, data centres, shelters'.toLowerCase();
    expect(SECURITY_WITHHELD_ZONE_CLASSES.some((t) => sample.includes(t))).toBe(true);
    expect(SECURITY_WITHHELD_ASSET_CLASSES.some((t) => sample.includes(t))).toBe(true);
    expect(SECURITY_X4_NEVER_INTRODUCED.some((t) => sample.includes(t))).toBe(true);
  });
});

/* ═══ 3 · PO-1 — NO PERSON POSITION EXISTS ══════════════════════════════════ */

describe('PO-1 is enforced structurally', () => {
  it('no component carries a person field, slot or placeholder', () => {
    /*
      *"No field no slot no placeholder no example and NO DASH IN A PERSON POSITION. A dash in
      a person slot answers PO-1 in the permissive direction without anyone having ruled."*
    */
    const offenders: string[] = [];
    for (const f of COMPONENTS) {
      const src = code(f);
      for (const rx of [/personName/i, /individualName/i, /\bsuspectName/i, /namedPerson/i, /\bperson\b/i]) {
        if (rx.test(src)) offenders.push(`${f.slice(SRC.length)} :: ${rx}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the claimant zone renders by class and has no name slot', () => {
    /* C11 carries the gate for later; at Alpha it carries the state and nothing else. */
    expect(securityZone('C11')?.personRule).toBe('NO_GATE_REQUIRED');
    expect(secStrings('en').zoneLabels.C11).toBe('Claimant');
  });

  it('the three gated zones are the three Main lists', () => {
    const gated = SECURITY_ZONES.filter((z) => z.personRule === 'NO_GATE_REQUIRED').map((z) => z.id);
    expect(gated.sort()).toEqual(['C11', 'D3', 'D4']);
  });

  it('the person sweep can fail — positive control', () => {
    /*
      THE FIRST CONTROL WAS WRONG, AND IT FAILED — which is what a control is for.

      It asserted `/\bperson\b/i` against `const personName = ...`, and `\b` does not match
      between `person` and `Name`: both are word characters. The control failed while the
      sweep it was checking would have caught that line through its OTHER regex, so the
      control was testing the wrong member of the set.

      The fix is to assert the SET rather than a member, which is what the sweep actually
      uses — and to include a bare-word sample so the `\bperson\b` arm is exercised too.
    */
    const PERSON_TOKENS = [/personName/i, /individualName/i, /\bsuspectName/i, /namedPerson/i, /\bperson\b/i];
    for (const sample of [
      'const personName = claim.personName;',
      'const namedPerson = actor;',
      'label: "person"',
    ]) {
      expect(`${sample}: ${PERSON_TOKENS.some((rx) => rx.test(sample))}`).toBe(`${sample}: true`);
    }
  });
});

/* ═══ 4 · N-11 — FIVE MEMBERS, NO DEFAULT, FALLBACK IS THE MOST IGNORANT ════ */

describe('the absence vocabulary is closed and its floor is the most ignorant state', () => {
  it('five members, one home, no sixth', () => {
    expect(SECURITY_ABSENCE_STATES).toHaveLength(5);
    expect(new Set(SECURITY_ABSENCE_STATES).size).toBe(5);
    for (const s of SECURITY_ABSENCE_STATES) expect(isSecurityAbsenceState(s)).toBe(true);
    expect(isSecurityAbsenceState('NO_MATERIAL_CHANGE')).toBe(false);
    expect(isSecurityAbsenceState('SEC_ALL_CLEAR')).toBe(false);
  });

  it('the fallback is the member that claims least', () => {
    expect(SECURITY_ABSENCE_FALLBACK).toBe('NOT_ASSESSED');
    /* And it carries its own disclaimer — the sentence that makes it N-11. */
    expect(securityAbsenceLabel('NOT_ASSESSED')).toMatch(/not a statement that conditions are safe/i);
  });

  it('degradation travels only toward ignorance', () => {
    /*
      *"Without all three it degrades to SEC_NOT_ASSESSED never to SEC_NO_VERIFIED_EVIDENCE."*
      "We checked and found nothing admissible" is a stronger claim than "we did not check",
      and the difference is the one a reader would act on.
    */
    expect(securityAbsenceDegradesTo('SEC_ASSESSED_NO_QUALIFYING_INCIDENT', false)).toBe('NOT_ASSESSED');
    expect(securityAbsenceDegradesTo('NO_QUALIFYING_EVIDENCE', false)).toBe('NOT_ASSESSED');
    expect(securityAbsenceDegradesTo('COVERAGE_GAP', true)).toBe('COVERAGE_GAP');
  });

  it('only one member is reachable at Alpha, and the frame renders that one', () => {
    const reachableNow = SECURITY_ABSENCE_STATES.filter((s) => SECURITY_ABSENCE_REACHABLE_AT_ALPHA[s]);
    expect(reachableNow).toEqual(['NOT_ASSESSED']);
    for (const f of COMPONENTS) {
      const src = code(f);
      for (const unreachable of SECURITY_ABSENCE_STATES.filter((s) => !SECURITY_ABSENCE_REACHABLE_AT_ALPHA[s])) {
        expect(`${f.slice(SRC.length)} ${unreachable}: ${src.includes(unreachable)}`)
          .toBe(`${f.slice(SRC.length)} ${unreachable}: false`);
      }
    }
  });

  it('NO_MATERIAL_CHANGE never renders — the A-24 collapse', () => {
    expect(SECURITY_ABSENCE_FORBIDDEN_CHANGE_STATE).toBe('NO_MATERIAL_CHANGE');
    const corpus = readerCorpus().join(' ');
    expect(corpus).not.toMatch(/no material change/i);
    for (const f of COMPONENTS) expect(code(f)).not.toContain('NO_MATERIAL_CHANGE');
  });

  it('the absence union is declared in one home and not locally', () => {
    /* *"Must not declare the absence union locally — it has one home."* */
    for (const f of DOMAIN) {
      expect(`${f.slice(SRC.length)}`).toBe(`${f.slice(SRC.length)}`);
      expect(code(f)).not.toMatch(/SECURITY_ABSENCE_STATES\s*=/);
      expect(code(f)).not.toMatch(/type\s+SecurityAbsenceState\s*=/);
    }
  });
});

/* ═══ 5 · THE DASH, AND WHERE IT MAY APPEAR ════════════════════════════════ */

describe('the em dash is an unbound value on exactly two zones', () => {
  it('the primitive refuses any zone but A3 and A4', () => {
    const parts = code(join(SRC, 'components', 'security', 'SecParts.tsx'));
    expect(parts).toMatch(/DASH_PERMITTED\s*=\s*new Set\(\['A3', 'A4'\]\)/);
    expect(parts).toMatch(/throw new Error/);
  });

  it('and no component passes it another zone', () => {
    for (const f of COMPONENTS) {
      const bad = [...code(f).matchAll(/<UnboundValue[^>]*zoneId="([A-Z]\d{1,2})"/g)]
        .map((m) => m[1] as string)
        .filter((id) => id !== 'A3' && id !== 'A4');
      expect(bad).toEqual([]);
    }
  });
});

/* ═══ 6 · NO COUNT, AND NO FORBIDDEN COPY ══════════════════════════════════ */

describe('no zone renders a count and no zone reassures', () => {
  it('no numeral reaches the rendered text of either frame', () => {
    /*
      Main's rule 2: *"A count of zero is a claim, and a false one. No zone renders 0."* Not
      the attention queue, not incidents, not evidence, not watch targets, not relationship
      edges. The scan is of JSX text nodes, because geometry numbers in class strings are not
      read by anyone.
    */
    const offenders = renderedText().filter((t) => /\d/.test(t));
    expect(offenders).toEqual([]);
  });

  it('no forbidden sentence appears anywhere a reader can reach', () => {
    const corpus = readerCorpus().map((s) => s.toLowerCase());
    const offenders = SECURITY_FORBIDDEN_COPY.filter((phrase) =>
      corpus.some((line) => line === phrase.toLowerCase() || line.includes(phrase.toLowerCase())));
    expect(offenders).toEqual([]);
  });

  it('the forbidden-copy sweep can fail — positive control', () => {
    const sample = ['all clear'];
    expect(SECURITY_FORBIDDEN_COPY.some((p) => sample.includes(p.toLowerCase()))).toBe(true);
  });
});

/* ═══ 7 · THE SEVERITY LADDER NEVER DEFAULTS ═══════════════════════════════ */

describe('A4 renders structure with no value selected', () => {
  it('the ladder component takes no severity and marks no rung', () => {
    const parts = code(join(SRC, 'components', 'security', 'SecParts.tsx'));
    expect(parts).toMatch(/data-sec-selected="false"/);
    /* No prop through which a value could arrive, and therefore no default. */
    expect(parts).not.toMatch(/severity[?]?:\s*(Severity|ConflictSeverity|string)\b/);
  });

  it('and the rungs are the shared ladder, not a second one', () => {
    expect(secStrings('en').severityRungs).toEqual(['Low', 'Moderate', 'High', 'Critical']);
  });
});

/* ═══ 8 · ZERO PROVIDERS, ZERO METERED AI ══════════════════════════════════ */

const NETWORK_TOKENS: readonly RegExp[] = [
  /\bfetch\s*\(/, /XMLHttpRequest/, /\buseSWR\b/, /\baxios\b/, /EventSource/, /https?:\/\//,
];

describe('nothing in the frame reaches a provider or spends AI', () => {
  it('no reachable file performs a network call', () => {
    const offenders: string[] = [];
    for (const f of GRAPH) {
      for (const rx of NETWORK_TOKENS) if (rx.test(code(f))) offenders.push(`${f.slice(SRC.length)} :: ${rx}`);
    }
    expect(offenders).toEqual([]);
  });

  it('the sweep can fail — positive control', () => {
    expect(NETWORK_TOKENS.some((rx) => rx.test("await fetch('https://x')"))).toBe(true);
  });

  it('no provider or AI name appears in the graph', () => {
    const offenders = GRAPH
      .filter((f) => /gnews|openai|\/analysis\/news|acled|ucdp|cisa|entsoe|mitre/i.test(code(f)))
      .map((f) => f.slice(SRC.length));
    expect(offenders).toEqual([]);
  });

  it('every control renders and none invokes', () => {
    /*
      Rule 5 is stricter than "no calls on load": *"zero metered AI anywhere in the frame — on
      load, hover, pan, sort, filter, tab, selection, resize, popup, drawer or detent.
      Controls render; they do not invoke."* The entry points are `aria-disabled` buttons with
      no handler; the ONLY handler in the tree is the compact detent control, which is local
      state.
    */
    const parts = code(join(SRC, 'components', 'security', 'SecParts.tsx'));
    expect(parts).toMatch(/aria-disabled="true"/);
    expect(parts).not.toMatch(/onClick/);
    const desktop = code(join(SRC, 'components', 'security', 'SecurityScreen.tsx'));
    expect(desktop).not.toMatch(/onClick/);
    const compact = code(join(SRC, 'components', 'security', 'SecurityCompactScreen.tsx'));
    /*
      COUNT THE HANDLERS, THEN CHECK WHAT THE ONE DOES.

      The first version extracted the handler body with `[^}]*`, which stops at the first
      closing brace — inside `{ k: 'SET', v: d }` — so it compared a truncated string and
      failed on a frame that was correct. Brace-matching a JSX attribute with a regex is the
      wrong instrument; counting occurrences and asserting the one call is the right one.
    */
    const handlerCount = [...compact.matchAll(/onClick=\{/g)].length;
    expect(`onClick count: ${handlerCount}`).toBe('onClick count: 1');
    /* And it is local state — a detent change, never a call. */
    expect(compact).toMatch(/onClick=\{\(\) => dispatch\(\{ k: 'SET', v: d \}\)\}/);
  });
});

/* ═══ 9 · GEOMETRY, DETENTS, AND THE ROUTE POSTURE ═════════════════════════ */

describe('geometry and route posture follow the authority', () => {
  it('Part IX’s own figures are carried unmodified', () => {
    expect(SECURITY_GEOMETRY.stateHeightPx).toEqual([96, 104, 104]);
    expect(SECURITY_GEOMETRY.attentionWidthPx).toEqual([320, 360, 360]);
    expect(SECURITY_GEOMETRY.substrateWidthPx).toEqual([896, 1068, 1236]);
    expect(SECURITY_GEOMETRY.substrateMinPx).toBe(560);
    expect(SECURITY_GEOMETRY.contextHeightPx).toEqual([64, 72, 72]);
    expect(SECURITY_GEOMETRY.pageCapPx).toBe(1680);
    expect(SECURITY_GEOMETRY.proseCapCh).toBe(74);
    expect(SECURITY_DETENTS).toEqual({ PEEK_PX: 152, HALF_VH: 52, FULL_VH: 92 });
  });

  it('A0 and C2 survive every detent, PEEK included', () => {
    /*
      *"Must carry A0 and C2 … honesty markers are never among the cuts."* A0 is rendered
      OUTSIDE the detent container so a sheet that shrinks cannot shrink it away, and C2 is
      before the first `atLeast` gate.
    */
    const compact = code(join(SRC, 'components', 'security', 'SecurityCompactScreen.tsx'));
    const a0 = compact.indexOf('<ZoneA0');
    const detentBody = compact.indexOf('data-sec="detent-body"');
    expect(a0).toBeGreaterThan(0);
    expect(a0).toBeLessThan(detentBody);
    const c2 = compact.indexOf('id="C2"');
    const firstGate = compact.indexOf("atLeast('HALF')");
    expect(c2).toBeGreaterThan(detentBody);
    expect(c2).toBeLessThan(firstGate);
  });

  it('both preview routes are noindex and no /security route exists', () => {
    for (const r of ROUTES) {
      expect(`${r}: ${/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/.test(code(r))}`).toBe(`${r}: true`);
    }
    /* Main's tripwire, carried here: measured 0 on both candidate branches, and it stays 0. */
    expect(existsSync(join(SRC, 'app', 'security'))).toBe(false);
  });

  it('the Security card opens the preview, and never claims the product route is open', async () => {
    /*
      ══ AN AUTHORITY CONFLICT, RESOLVED AS FAR AS I MAY AND REPORTED FOR THE REST ══

      MAIN-SECURITY-PARTIX-FINAL-VISUAL-AUTHORITY-R1 rules that the Security
      preview carries **no `intelligenceModules.ts` home card**, and gives the
      reason: *"a card on the home surface asserts the product exists."* This
      test asserted exactly that, by name.

      FINAL-9-MODULE-ENGINE-CONVERGENCE-R1 §2 and §4, from the Product Owner,
      then named Security Intelligence as one of the nine visible specialist
      cards and gave it the slot `AI Research Assistant` vacated.

      I DO NOT GET TO PICK BETWEEN THEM. What I can do is keep Main's rule in
      the strongest form that survives the newer instruction, and escalate the
      remainder — which is what this test now is:

        the card exists, because the Product Owner named it;
        it is never ACTIVE, so it never claims to be a working surface;
        it carries NO destination, so nothing on Home navigates to it;
        no file in the registry mentions the preview address at all.

      The mechanism Main's rule protects — that Home must not send a reader to a
      Security surface, or imply one is open — is therefore intact. The residual
      disagreement is whether the CARD ITSELF, badged PREVIEW and unreachable,
      is the assertion Main forbids. That is a Product Owner question and is
      raised in the round's README, not answered here. If the ruling is Main's
      text as written, the card is one line to remove and this test returns to
      its previous form.
    */
    /*
      ══ AND R2 §2 RULED IT ═════════════════════════════════════════════════

      *"The Product Owner's final-nine instruction supersedes the older
      pre-implementation 'no home card' condition. Security now has an actual
      Alpha preview deployed by Code … make the card clickable to the verified
      Security preview route."*

      Two things had to be true for that to be safe, and both are asserted
      rather than taken on trust:

        the card is PREVIEW, never ACTIVE — it claims a surface to inspect,
        not a working product;
        `/security` itself stays 404 and unactivated — checked in the test
        above, which is Main's own tripwire and is untouched.

      So the rule that survives from Main's authority is the narrow one that
      always mattered: Home must not tell a reader that Security is OPEN. It
      now tells them there is something to look at, which is true and which the
      Product Owner has ruled they may look at.
    */
    const mod = (await import('../intelligenceModules')) as typeof import('../intelligenceModules');
    const security = mod.INTELLIGENCE_MODULES.find((m) => m.id === 'security');
    expect(security).toBeDefined();
    expect(security?.state).toBe('preview');
    expect(security?.destination).toBe('/security-visual-preview');
    expect(mod.isModuleNavigable(security!)).toBe(true);
    /* the card opens the PREVIEW and never the unactivated product route */
    expect(security?.destination).not.toBe('/security');
    expect(existsSync(join(SRC, 'app', 'security'))).toBe(false);
  });

  it('English is the only registered locale and the fallback is disclosed', async () => {
    const strings = (await import('./securityStrings')) as typeof import('./securityStrings');
    expect(strings.resolveSecStrings('en').fellBack).toBe(false);
    for (const l of ['pl', 'fr', 'de', 'es', 'pt', 'ar'] as const) {
      expect(`${l}: ${strings.resolveSecStrings(l).fellBack}`).toBe(`${l}: true`);
    }
    for (const f of COMPONENTS.slice(0, 2)) expect(code(f)).toContain('localeFallback');
  });
});
