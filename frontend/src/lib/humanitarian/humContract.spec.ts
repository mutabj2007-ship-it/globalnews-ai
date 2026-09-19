import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  ABSENCE_CHROME,
  ORDINARY_AGGREGATION_REASON,
  PER_RECORD_ABSENCE_REASONS,
  accessNotAssessed,
  accessNotProducibleAtPrecision,
  area,
  changeStateDerived,
  changeStateNotDerivable,
  nameCarriesCoordinate,
  perRecordAbsenceToken,
  precisionFloor,
  precisionNotProducible,
  quietClaimFor,
  renderableArea,
  statedTitle,
  titleFromChangeState,
  type AbsenceReason,
} from './humDegraded';
import {
  HUM_PL_DRAFT_AWAITING_COMPLETION,
  humAbsenceChrome,
  humFrameLabel,
  humLocalesAwaitingContent,
  humStrings,
  resolveHumStrings,
} from './humStrings';
import { HUMANITARIAN_DECLARES_NO_COMPOSITE_SCORE } from './humAxes';

/**
 * PART X · HUMANITARIAN — THE DOMAIN CONTRACT GUARD.
 *
 * WHY THIS FILE EXISTS, STATED PLAINLY: because two source files already claimed it did.
 *
 * `humAxes.ts` and `humDegraded.ts` each cited `humContract.spec.ts` as asserting the two
 * most load-bearing prohibitions in this domain — that no reveal vocabulary exists, and
 * that no exported function returns a composite score. The file did not exist. There was
 * no spec of any kind in the lane. The prohibitions were asserted BY COMMENT, and a
 * comment does not fail a build; a reviewer skimming those docblocks would reasonably
 * have stopped looking, which is the actual harm.
 *
 * A guard is not evidence until it bites. Every group below is written to FAIL if the
 * defect it names is reintroduced, and each one was checked by reintroducing the defect
 * and watching it fail before being left green.
 *
 * The instrument is deliberately the one this codebase already uses — source reading plus
 * direct module assertions, the convention of `legalPages.spec.ts` and `pwaContract.spec.ts`
 * — rather than a new testing approach imported for one domain.
 */

const DOMAIN_LIB = __dirname;
const DOMAIN_COMPONENTS = join(__dirname, '..', '..', 'components', 'humanitarian');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { out.push(...sourceFiles(full)); continue; }
    if (/\.tsx?$/.test(entry) && !entry.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

const DOMAIN_SOURCES: readonly string[] = [...sourceFiles(DOMAIN_LIB), ...sourceFiles(DOMAIN_COMPONENTS)];
const read = (f: string): string => readFileSync(f, 'utf8');

/** Comments explain; code decides. Prohibition scans read code only. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/**
 * Vocabulary scans read IDENTIFIERS, not prose.
 *
 * E1's own run of this detector fired 22 times and every hit was the guard sentence
 * "No reveal control exists, at any role." — a NEGATIVE disclosure. A scan that cannot
 * tell an affordance from a sentence saying no affordance exists reports the safest text
 * on the screen as the defect, so string literals come out before the scan and the guard
 * sentence is asserted separately, below.
 */
function codeIdentifiersOnly(src: string): string {
  return stripComments(src)
    .replace(/'(?:[^'\\]|\\.)*'/g, " '' ")
    .replace(/"(?:[^"\\]|\\.)*"/g, ' "" ')
    .replace(/`(?:[^`\\]|\\.)*`/g, ' `` ');
}

describe('domain corpus', () => {
  it('finds both halves of the domain', () => {
    expect(DOMAIN_SOURCES.length).toBeGreaterThanOrEqual(15);
    expect(DOMAIN_SOURCES.some((f) => f.endsWith('humDegraded.ts'))).toBe(true);
    expect(DOMAIN_SOURCES.some((f) => f.endsWith('HumanitarianCompactScreen.tsx'))).toBe(true);
  });
});

/* ═══ 1 · THE PROHIBITION humAxes.ts CITES ════════════════════════════════════ */

describe('no reveal vocabulary exists in this domain', () => {
  /**
   * The claim in `humDegraded.ts` is absolute — "no reveal control, no entitlement, no
   * role variant and no admin bypass" — and its strength comes from there being no branch
   * point at all. A bypass needs somewhere to branch.
   */
  const FORBIDDEN = [
    /\breveal\b/i, /\bunmask\b/i, /\bdeclassif/i, /\bentitlement\b/i,
    /\bisAdmin\b/, /\bhasRole\b/, /\bbypass\b/i, /\boverridePrecision\b/i,
    /\bshowExact\b/i, /\bexactLocation\b/i,
  ];

  it.each(FORBIDDEN.map((r) => [r.source, r] as const))('no identifier matches %s', (_label, rx) => {
    const hits = DOMAIN_SOURCES.filter((f) => rx.test(codeIdentifiersOnly(read(f))));
    expect(hits).toEqual([]);
  });

  it('the scan is capable of failing — positive control', () => {
    expect(/\breveal\b/i.test(codeIdentifiersOnly('const reveal = 1;'))).toBe(true);
    expect(/\bbypass\b/i.test(codeIdentifiersOnly('if (bypass) return exact;'))).toBe(true);
  });

  it('the scan reads code, not prose — negative controls', () => {
    expect(/\breveal\b/i.test(codeIdentifiersOnly('/* no reveal control exists */ const a = 1;'))).toBe(false);
    expect(/\breveal\b/i.test(codeIdentifiersOnly("const s = 'No reveal control exists';"))).toBe(false);
  });

  /**
   * The prose half, asserted rather than swept under the literal-stripping. Every
   * user-visible sentence in this domain that mentions revealing must DENY that a reveal
   * exists — which is the shape the accepted policy permits, and the opposite of a control.
   */
  it('the only reveal sentence on the surface is a denial', () => {
    const t = humStrings('en');
    const sentences = Object.values(t)
      .flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v as Record<string, string>)))
      .filter((v): v is string => typeof v === 'string' && /reveal/i.test(v));
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toBe('No reveal control exists, at any role.');
  });
});

/* ═══ 2 · THE PROHIBITION humDegraded.ts CITES ════════════════════════════════ */

describe('no composite score is constructible', () => {
  it('the domain declares it', () => {
    expect(HUMANITARIAN_DECLARES_NO_COMPOSITE_SCORE).toBe(true);
  });

  const FORBIDDEN = [/\bcompositeScore\b/i, /\bcrisisScore\b/i, /\bseverityScore\b/i,
    /\boverallScore\b/i, /\bweightedNeed\b/i, /\brankSituations?\b/i];

  it.each(FORBIDDEN.map((r) => [r.source, r] as const))('no code match for %s', (_l, rx) => {
    expect(DOMAIN_SOURCES.filter((f) => rx.test(stripComments(read(f))))).toEqual([]);
  });

  it('counting is not scoring — the one arithmetic helper returns a count of rows', () => {
    /* `sectorsWithEvidence` counts; it does not weight, average or rank. */
    const src = read(join(DOMAIN_LIB, 'humDegraded.ts'));
    expect(src).toContain('rows.filter((r) => r.level !== \'NOT_ASSESSED\').length');
  });
});

/* ═══ 3 · THE ABSENCE OF A ZERO ═══════════════════════════════════════════════ */

describe('no figure is defaulted', () => {
  it('`?? 0` occurs nowhere in the domain', () => {
    expect(DOMAIN_SOURCES.filter((f) => /\?\?\s*0\b/.test(stripComments(read(f))))).toEqual([]);
  });
});

/* ═══ 4 · THE PER-RECORD PROTECTION ORACLE — E1 C-1 ═══════════════════════════ */

describe('protection state cannot be carried per record', () => {
  const TOKEN = 'PROTECTED_LOCATION_AGGREGATED';

  it('is not a member of the per-record union', () => {
    expect(PER_RECORD_ABSENCE_REASONS).toHaveLength(7);
    expect(PER_RECORD_ABSENCE_REASONS as readonly string[]).not.toContain(TOKEN);
  });

  it('occurs nowhere in the rendering half of the domain', () => {
    const renderers = DOMAIN_SOURCES.filter((f) => f.endsWith('.tsx'));
    expect(renderers.filter((f) => read(f).includes(TOKEN))).toEqual([]);
  });

  it('has no authored string in any registered catalogue', () => {
    const t = humStrings('en');
    expect(Object.keys(t.absence)).not.toContain(TOKEN);
    expect(JSON.stringify(t)).not.toContain(TOKEN);
  });

  /**
   * F T-B3 · THE RENDERED OUTPUT IS BYTE-IDENTICAL TO ORDINARY AGGREGATION.
   *
   * Checkpoint 3 resolved a protection-bearing value to `undefined` so React dropped the
   * attribute. That closed the token channel and opened the omission channel: a record
   * with no `data-hum-absence-reason` and a different body is distinguishable from every
   * ordinary record, and the absence of a marker is a marker. F requires byte-identity
   * with ordinary aggregation; E1 calls the same thing CG-6's omission channel; the
   * Product Owner's own instruction forbids a "special null".
   *
   * So the token is TOTAL, and the assertion is on RENDERED OUTPUT rather than on source
   * text — E1 refuses a source-text assertion standing in for a rendered-output one,
   * because the question is what the boundary emits.
   */
  it('F T-B3 · a protected reason renders byte-identically to ordinary aggregation', () => {
    /* eslint-disable-next-line @typescript-eslint/no-var-requires */
    const { renderToStaticMarkup } = require('react-dom/server') as typeof import('react-dom/server');
    /* eslint-disable-next-line @typescript-eslint/no-var-requires */
    const React = require('react') as typeof import('react');
    /* eslint-disable-next-line @typescript-eslint/no-var-requires */
    const { Absence } = require('../../components/humanitarian/HumParts') as
      typeof import('../../components/humanitarian/HumParts');
    const t = humStrings('en');

    const render = (reason: string): string =>
      renderToStaticMarkup(React.createElement(Absence, { reason: reason as AbsenceReason, t }));

    const ordinary = render(ORDINARY_AGGREGATION_REASON);
    const protectedOut = render(TOKEN);
    const future = render('SOME_FUTURE_CLASSIFIER_STATE');

    expect(protectedOut).toBe(ordinary);
    expect(future).toBe(ordinary);
    expect(protectedOut).not.toContain(TOKEN);
    /* the attribute is PRESENT and carries the ordinary value — not omitted */
    expect(protectedOut).toContain(`data-hum-absence-reason="${ORDINARY_AGGREGATION_REASON}"`);

    /* DISCRIMINATING CONTROL: a renderer emitting a constant would pass the above. */
    expect(render('RIGHTS_UNAVAILABLE')).not.toBe(ordinary);
  });

  it('the token is total — no value resolves to undefined', () => {
    expect(perRecordAbsenceToken(TOKEN)).toBe(ORDINARY_AGGREGATION_REASON);
    expect(perRecordAbsenceToken('SOME_FUTURE_CLASSIFIER_STATE')).toBe(ORDINARY_AGGREGATION_REASON);
    expect(perRecordAbsenceToken('')).toBe(ORDINARY_AGGREGATION_REASON);
  });

  it('the channel still carries every legitimate reason — negative control', () => {
    for (const r of PER_RECORD_ABSENCE_REASONS) expect(perRecordAbsenceToken(r)).toBe(r);
  });

  it('both dynamic call sites read the token through the lookup, not the prop', () => {
    const parts = read(join(DOMAIN_COMPONENTS, 'HumParts.tsx'));
    expect(parts).toContain('const token = perRecordAbsenceToken(reason);');
    expect(parts).toContain('data-hum-absence-reason={token}');
    /* the pre-fix form, which printed the prop straight into the attribute */
    expect(parts).not.toContain('data-hum-absence-reason={reason}');
  });

  it('the class-level posture survives, on BOTH frames — E1 C-4', () => {
    for (const frame of ['HumanitarianScreen.tsx', 'HumanitarianCompactScreen.tsx']) {
      expect(read(join(DOMAIN_COMPONENTS, frame))).toContain('data-hum="sensitive-posture"');
    }
  });
});

/* ═══ 5 · QUIET TRUTH — F A-1…A-5, RATIFIED ══════════════════════════════════ */

describe('the QUIET frame cannot claim a check that did not happen', () => {
  const t = humStrings('en');
  const notDerivable = changeStateNotDerivable();
  /** Every string this surface renders while the slot kind is NOT_DERIVABLE. */
  const renderedInThatState = (): string[] => [
    humFrameLabel(t, 'QUIET', notDerivable),
    t.quietSubtitle[quietClaimFor(notDerivable)],
    t.absence.STATE_NOT_DERIVABLE,
    humAbsenceChrome(t, 'STATE_NOT_DERIVABLE'),
  ];

  it('there is no frame key to author the claim into', () => {
    expect(Object.keys(t.frames)).toEqual(['ENTRY', 'SELECTED', 'GAP']);
  });

  it('F A-3 · the tab reads "Change not established"', () => {
    expect(humFrameLabel(t, 'QUIET', notDerivable)).toBe('Change not established');
  });

  it('F A-4 · the subtitle carries the negation where the false claim was', () => {
    expect(t.quietSubtitle.NOT_DERIVABLE)
      .toBe('Not checked — no change state could be derived for this situation');
  });

  /**
   * F T-A1, written as F wrote it: an EXCEPTION, not a ban. The correct sentence contains
   * the forbidden word — "Not checked" — so a guard that simply forbids `checked` rejects
   * the fix and passes the defect it replaces. Both controls are asserted below.
   */
  const UNGUARDED_CHECKED = /(?<!not )\bchecked\b/i;

  it('F T-A1 · no string in this state claims a check', () => {
    for (const str of renderedInThatState()) expect(str).not.toMatch(UNGUARDED_CHECKED);
  });

  it('F T-A1 · the exception is real — controls both ways', () => {
    expect(UNGUARDED_CHECKED.test('Not checked — no change state could be derived')).toBe(false);
    expect(UNGUARDED_CHECKED.test('Checked — no material change')).toBe(true);
  });

  it('F T-A2 · no string in this state says "no material change" or "unchanged"', () => {
    for (const str of renderedInThatState()) {
      expect(str).not.toMatch(/no material change/i);
      expect(str).not.toMatch(/\bunchanged\b/i);
    }
  });

  it('F T-A3 · the retained string is licensed only by a DERIVED NO_MATERIAL_CHANGE', () => {
    const derived = changeStateDerived('NO_MATERIAL_CHANGE', 'UNCHANGED', 'MODERATE');
    expect(quietClaimFor(derived)).toBe('CHECKED_NO_MATERIAL_CHANGE');
    expect(humFrameLabel(t, 'QUIET', derived)).toBe('Checked — no material change');
    /* and never from the default, a fallback, or the frame identity */
    expect(quietClaimFor(notDerivable)).toBe('NOT_DERIVABLE');
    expect(quietClaimFor(changeStateDerived('NEW_EVIDENCE', 'MIXED', 'LOW'))).toBe('NOT_DERIVABLE');
  });

  it('F A-5 · the string is retained, not withdrawn', () => {
    expect(t.quietFrame.CHECKED_NO_MATERIAL_CHANGE).toBe('Checked — no material change');
  });

  it('F T-A4 · the body names what it is NOT', () => {
    expect(t.absence.STATE_NOT_DERIVABLE)
      .toContain('not a finding that nothing changed');
  });

  it('F · no count is written into the copy', () => {
    expect(t.absence.STATE_NOT_DERIVABLE).not.toMatch(/\b(five|seven|5|7)\b/i);
  });

  it('the shipped QUIET view carries no authored title', () => {
    /* eslint-disable-next-line @typescript-eslint/no-var-requires */
    const { HUM_VIEWS } = require('../../components/humanitarian/HumanitarianModel') as
      typeof import('../../components/humanitarian/HumanitarianModel');
    expect(HUM_VIEWS.QUIET.title).toEqual(titleFromChangeState());
    expect(HUM_VIEWS.QUIET.change.kind).toBe('NOT_DERIVABLE');
    expect(JSON.stringify(HUM_VIEWS.QUIET)).not.toContain('Checked');
  });

  it('a STATED title still carries its prose — negative control', () => {
    expect(statedTitle('Displacement and service pressure')).toEqual(
      { kind: 'STATED', text: 'Displacement and service pressure' });
  });

  it('no renderer reads a QUIET frame string by key', () => {
    for (const f of DOMAIN_SOURCES.filter((x) => x.endsWith('.tsx'))) {
      expect(stripComments(read(f))).not.toMatch(/frames\s*\.\s*QUIET/);
      expect(stripComments(read(f))).not.toMatch(/frames\s*\[\s*['"]QUIET['"]\s*\]/);
    }
  });
});

/* ═══ 6 · ABSENCE TRUTH — F §1, B-1…B-3, T-C1, RATIFIED ══════════════════════ */

describe('the chrome is a function of the reason, over F\'s three closed classes', () => {
  const t = humStrings('en');

  it('F §1 · three values, and exactly these', () => {
    expect(Object.keys(t.absenceChrome).sort())
      .toEqual(['NOT_ASSESSED', 'NOT_ESTABLISHED', 'NOT_SHOWN']);
    expect(t.absenceChrome.NOT_ASSESSED).toBe('Not assessed');
    expect(t.absenceChrome.NOT_ESTABLISHED).toBe('Not established');
    expect(t.absenceChrome.NOT_SHOWN).toBe('Not shown');
  });

  it('F §1 · the partition is F\'s, reason for reason', () => {
    expect(ABSENCE_CHROME.NO_VALIDATED_BASELINE).toBe('NOT_ASSESSED');
    expect(ABSENCE_CHROME.NO_LOCAL_EVIDENCE_IN_PERIOD).toBe('NOT_ASSESSED');
    expect(ABSENCE_CHROME.STATE_NOT_DERIVABLE).toBe('NOT_ESTABLISHED');
    expect(ABSENCE_CHROME.NOT_PRODUCIBLE_AT_THIS_PRECISION).toBe('NOT_ESTABLISHED');
    expect(ABSENCE_CHROME.AWAITING_SHARED_CONTRACT).toBe('NOT_ESTABLISHED');
    expect(ABSENCE_CHROME.RIGHTS_UNAVAILABLE).toBe('NOT_SHOWN');
    expect(ABSENCE_CHROME.RIGHTS_RESTRICTED).toBe('NOT_SHOWN');
  });

  /**
   * F T-C1 · total coverage, no default. The type makes an unclassed member a compile
   * error; this is the runtime half — every reason resolves, and nothing falls through.
   */
  it('F T-C1 · every reason maps to exactly one class, with no default', () => {
    for (const r of PER_RECORD_ABSENCE_REASONS) {
      expect(ABSENCE_CHROME[r]).toBeDefined();
      expect(['NOT_ASSESSED', 'NOT_ESTABLISHED', 'NOT_SHOWN']).toContain(ABSENCE_CHROME[r]);
      expect(humAbsenceChrome(t, r).length).toBeGreaterThan(0);
    }
  });

  it('F T-B1 · rights are never headed "Not assessed"', () => {
    for (const r of ['RIGHTS_UNAVAILABLE', 'RIGHTS_RESTRICTED'] as AbsenceReason[]) {
      expect(humAbsenceChrome(t, r)).toBe('Not shown');
      expect(humAbsenceChrome(t, r)).not.toBe(t.absenceChrome.NOT_ASSESSED);
    }
  });

  it('F B-2 / B-3 · the two rights bodies are distinct and each refuses its own inference', () => {
    expect(t.absence.RIGHTS_UNAVAILABLE).toContain('may already have been assessed');
    expect(t.absence.RIGHTS_UNAVAILABLE).toContain('not the assessment');
    expect(t.absence.RIGHTS_RESTRICTED).toContain('coarser precision');
    expect(t.absence.RIGHTS_RESTRICTED).toContain('not a statement about what has been assessed');
    expect(t.absence.RIGHTS_UNAVAILABLE).not.toBe(t.absence.RIGHTS_RESTRICTED);
  });

  /**
   * F T-B2 · the rendered rights reason equals `view.rights.reason`. Both drawers used to
   * hardcode a literal while reading `ownerNamed` from the model, so half the sentence
   * tracked the state and half did not.
   */
  it('F T-B2 · neither rights drawer hardcodes its reason', () => {
    for (const f of ['drawers/PopulationNeed.tsx', 'drawers/EvidenceReadings.tsx']) {
      const src = stripComments(read(join(DOMAIN_COMPONENTS, f)));
      expect(src).toContain('reason={view.rights.reason}');
      expect(src).not.toMatch(/reason="RIGHTS_(UNAVAILABLE|RESTRICTED)"/);
    }
  });

  it('the block no longer prints a constant', () => {
    const parts = read(join(DOMAIN_COMPONENTS, 'HumParts.tsx'));
    expect(parts).not.toContain('>{t.common.notAssessed}</span>');
    expect(parts).toContain('humAbsenceChrome(t, token)');
  });

  it('evidence-side reasons keep "Not assessed" — negative control', () => {
    expect(humAbsenceChrome(t, 'NO_VALIDATED_BASELINE')).toBe('Not assessed');
    expect(humAbsenceChrome(t, 'NO_LOCAL_EVIDENCE_IN_PERIOD')).toBe('Not assessed');
  });
});

/* ═══ 7 · GEOGRAPHY — E1 C-3 ══════════════════════════════════════════════════ */

describe('rendered geography respects the declared precision', () => {
  const admin1 = precisionFloor('ADMIN1');

  /*
    E1 C-6 · RESERVED SYNTHETIC TOKENS.

    Every area this block CONSTRUCTS is synthetic. Real administrative names in an active
    conflict zone were defensible one instance at a time and are a habit worth not having
    on a humanitarian surface, which is E1's wording and the reason rather than the rule.

    The one place a real name still appears is the assertion that reads the SHIPPED model,
    at the foot of this block. That assertion is a negative guard over Part X's own H-02
    specimen — it must keep naming what it refuses, and the specimen itself is design
    authority, not a fixture this lane may rewrite.
  */
  const CLEAN_ADMIN1 = 'SYNTH-ADMIN1-ALPHA';
  const COORD_ADMIN1 = 'SYNTH-AREA 0.0000, 0.0000';

  it('a name at the declared rung is rendered', () => {
    expect(renderableArea(area(CLEAN_ADMIN1, 'ADMIN1'), admin1))
      .toEqual({ kind: 'NAMED', name: CLEAN_ADMIN1, precision: 'ADMIN1' });
  });

  it('a coarser name is rendered — the clamp refuses in ONE direction', () => {
    expect(renderableArea(area('SYNTH-COUNTRY-DELTA', 'COUNTRY'), admin1).kind).toBe('NAMED');
  });

  /** THE MUTATION E1 ASKS FOR: finer than declared must be refused, not printed. */
  it('a finer name is refused', () => {
    const r = renderableArea(area('SYNTH-ADMIN2-BETA', 'ADMIN2'), admin1);
    expect(r.kind).toBe('CLAMPED');
    if (r.kind === 'CLAMPED') expect(r.reason).toBe('NOT_PRODUCIBLE_AT_THIS_PRECISION');
  });

  /**
   * THE ASSERTION THAT ISOLATES THE CLAMP FROM THE PRODUCIBILITY CHECK.
   *
   * ADMIN2 is refused for two independent reasons — it is finer than ADMIN1 AND it has no
   * producer — so an ADMIN2 case alone cannot tell which rule did the work, and a mutation
   * that disables the finer-than-declared comparison escapes it. SETTLEMENT is producible
   * (`CITY`, `producible: true`) and finer than both COUNTRY and ADMIN1, so only the
   * comparison can refuse it. Verified by mutation: with the comparison disabled, this
   * fails and the ADMIN2 case does not.
   */
  it('a producible rung that is still finer than declared is refused', () => {
    expect(renderableArea(area('SYNTH-SETTLEMENT-GAMMA', 'SETTLEMENT'), precisionFloor('ADMIN1')).kind).toBe('CLAMPED');
    expect(renderableArea(area('SYNTH-SETTLEMENT-GAMMA', 'SETTLEMENT'), precisionFloor('COUNTRY')).kind).toBe('CLAMPED');
    /* and the same rung AT its declared level is named — the refusal is the comparison,
       not a blanket ban on the rung */
    expect(renderableArea(area('SYNTH-COUNTRY-DELTA', 'COUNTRY'), precisionFloor('COUNTRY')).kind).toBe('NAMED');
  });

  it('a SITE name is refused at every declared rung', () => {
    for (const declared of ['COUNTRY', 'ADMIN1'] as const) {
      expect(renderableArea(area('SYNTH-SITE-EPSILON', 'SITE'), precisionFloor(declared)).kind).toBe('CLAMPED');
    }
  });

  it('an unproducible rung is refused even when it is not finer', () => {
    expect(renderableArea(area('anything', 'REGIONAL'), precisionNotProducible('REGIONAL')).kind)
      .toBe('CLAMPED');
  });

  it('a free string cannot reach the renderer — the field is a typed identifier', () => {
    const row = accessNotAssessed(area(CLEAN_ADMIN1, 'ADMIN1'), 'NO_LOCAL_EVIDENCE_IN_PERIOD');
    expect(typeof row.area).toBe('object');
    expect(row.area.precision).toBe('ADMIN1');
  });

  it('a coordinate pair smuggled into a name is refused with the rung, not printed', () => {
    /* SYNTHETIC. Finer than declared AND non-producible, so this clamps on the rung. It is
       retained as the REGRESSION it always was, and it no longer stands alone: R-3a below
       is the assertion that isolates the name. */
    const r = renderableArea(area(COORD_ADMIN1, 'SITE'), admin1);
    expect(r.kind).toBe('CLAMPED');
    expect(JSON.stringify(r)).not.toContain('0.0000');
  });

  /*
    ═══ E1 C-2 · THE PAIRED CONTROL ══════════════════════════════════════════════

    R-3a and R-3c are one assertion in two halves and neither means anything alone.
    Both run at an ALLOWED rung — ADMIN1 against an ADMIN1 declaration — where the clamp
    does not fire, so the ONLY thing that can refuse R-3a is the name. R-3c renders a
    clean name at the SAME rung and requires it through, which is what proves R-3a
    discriminates on the name rather than on a clamp that would have fired anyway.

    E1's note on why this exists: "An assertion whose title claims more than its fixture
    proves is the defect; the fix is the paired control, not a better title."
  */
  it('E1 R-3a · a coordinate-shaped name is refused AT AN ALLOWED RUNG', () => {
    const r = renderableArea(area(COORD_ADMIN1, 'ADMIN1'), admin1);
    expect(r.kind).toBe('CLAMPED');
    expect(JSON.stringify(r)).not.toContain('0.0000');
  });

  it('E1 R-3c · a clean name at the SAME rung is rendered — the control', () => {
    const r = renderableArea(area(CLEAN_ADMIN1, 'ADMIN1'), admin1);
    expect(r.kind).toBe('NAMED');
    if (r.kind === 'NAMED') expect(r.name).toBe(CLEAN_ADMIN1);
  });

  it('E1 R-3a/R-3c · the refusal is caused by the NAME — the pair differs in nothing else', () => {
    const refused = renderableArea(area(COORD_ADMIN1, 'ADMIN1'), admin1);
    const allowed = renderableArea(area(CLEAN_ADMIN1, 'ADMIN1'), admin1);
    expect(refused.kind).toBe('CLAMPED');
    expect(allowed.kind).toBe('NAMED');
  });

  it('E1 R-3a · a refused name is byte-identical to an ordinarily clamped row', () => {
    /* The refusal must not be its own marker. A name refused for carrying a position and a
       row aggregated because its rung has no producer emit the same object. */
    const byName = renderableArea(area(COORD_ADMIN1, 'ADMIN1'), admin1);
    const byRung = renderableArea(area('SYNTH-ADMIN2-BETA', 'ADMIN2'), admin1);
    expect(JSON.stringify(byName)).toBe(JSON.stringify(byRung));
  });

  it('E1 R-3b · no NAMED result anywhere in the corpus carries a coordinate shape', () => {
    /* `precisionFloor` is the declaration side and accepts the two rungs a frame may
       declare; the area side sweeps all eight. */
    const declaredRungs = ['COUNTRY', 'ADMIN1'] as const;
    const rungs = ['UNPLACED', 'REGIONAL', 'COUNTRY', 'ADMIN1', 'ADMIN2', 'ADMIN3',
                   'SETTLEMENT', 'SITE'] as const;
    const names = [
      CLEAN_ADMIN1, 'SYNTH-COUNTRY-DELTA', 'SYNTH-ADMIN2-BETA',
      COORD_ADMIN1, 'SYNTH-AREA -1.6800, 29.2300', 'SYNTH-AREA 1.68S, 29.23E',
      "SYNTH-AREA 1\u00B040'12\" N, 29\u00B013'48\" E", 'SYNTH-AREA lat: 1.68 lon: 29.23',
    ];
    let named = 0;
    for (const declared of declaredRungs) {
      for (const rung of rungs) {
        for (const n of names) {
          const r = renderableArea(area(n, rung), precisionFloor(declared));
          if (r.kind === 'NAMED') { named += 1; expect(nameCarriesCoordinate(r.name)).toBe(false); }
        }
      }
    }
    /* the sweep has to have produced NAMED results, or it proved nothing */
    expect(named).toBeGreaterThan(0);
  });

  it('E1 R-3b · the coordinate predicate is capable of firing — positive control', () => {
    expect(nameCarriesCoordinate(COORD_ADMIN1)).toBe(true);
    expect(nameCarriesCoordinate('SYNTH-AREA -1.6800, 29.2300')).toBe(true);
    expect(nameCarriesCoordinate('SYNTH-AREA 1.68S, 29.23E')).toBe(true);
    expect(nameCarriesCoordinate("SYNTH-AREA 1\u00B040'12\" N, 29\u00B013'48\" E")).toBe(true);
    expect(nameCarriesCoordinate('SYNTH-AREA lat: 1.68 lon: 29.23')).toBe(true);
    /* and it must not fire on an ordinary name, or R-3c would pass for the wrong reason */
    expect(nameCarriesCoordinate(CLEAN_ADMIN1)).toBe(false);
    expect(nameCarriesCoordinate('SYNTH-COUNTRY-DELTA')).toBe(false);
    expect(nameCarriesCoordinate('Region 5')).toBe(false);
  });

  it('the unreachable rung is stated as a row rather than omitted', () => {
    const row = accessNotProducibleAtPrecision('ADMIN2');
    expect(row.absence).toBe('NOT_PRODUCIBLE_AT_THIS_PRECISION');
    expect(row.condition).toBe('NOT_ASSESSED');
  });

  /**
   * Every geography name goes through the clamp. `area={row.area}` is the clamp being
   * HANDED the identifier; a bare `{row.area}` in a text position would be the field
   * reaching the DOM unmediated, which is the defect.
   */
  it('no renderer prints a raw area field', () => {
    for (const f of DOMAIN_SOURCES.filter((x) => x.endsWith('.tsx'))) {
      expect(stripComments(read(f))).not.toMatch(/(?<!area=)\{\s*row\.area\s*\}/);
    }
  });

  it('that distinction is real — controls', () => {
    expect(/(?<!area=)\{\s*row\.area\s*\}/.test('<span>{row.area}</span>')).toBe(true);
    expect(/(?<!area=)\{\s*row\.area\s*\}/.test('<AreaLabel area={row.area} />')).toBe(false);
  });

  it('the shipped SELECTED view does not name a rung it cannot produce', () => {
    /* eslint-disable-next-line @typescript-eslint/no-var-requires */
    const { HUM_VIEWS } = require('../../components/humanitarian/HumanitarianModel') as
      typeof import('../../components/humanitarian/HumanitarianModel');
    const declared = HUM_VIEWS.SELECTED.precision;
    for (const row of HUM_VIEWS.SELECTED.access) {
      const r = renderableArea(row.area, declared);
      if (r.kind === 'NAMED') expect(r.name).not.toMatch(/Rutshuru|Masisi|Nyiragongo/);
    }
  });
});

/* ═══ 7b · ROLE / ADMIN OUTPUT INVARIANCE — E1 CG-5(b) ════════════════════════ */

describe('precision is invariant under every role-shaped input the boundary accepts', () => {
  /* eslint-disable-next-line @typescript-eslint/no-var-requires */
  const { renderToStaticMarkup } = require('react-dom/server') as typeof import('react-dom/server');
  /* eslint-disable-next-line @typescript-eslint/no-var-requires */
  const React = require('react') as typeof import('react');
  /* eslint-disable-next-line @typescript-eslint/no-var-requires */
  const { AreaLabel } = require('../../components/humanitarian/HumParts') as
    typeof import('../../components/humanitarian/HumParts');
  const t = humStrings('en');

  /**
   * THE PROPERTY IS OUTPUT INVARIANCE, NOT VOCABULARY ABSENCE.
   *
   * Scanning for `reveal`, `canReveal` or `role` catches a bypass that announces itself and
   * misses one that does not. E1 R-B: today's zero is strong only because the mechanism
   * does not exist, and an absence assertion over a surface with no roles keeps passing
   * while a bypass is added elsewhere. So this asserts the thing that actually matters —
   * the same record renders the same precision whoever is asking — and it is written to
   * fail when a role system arrives and is wired to the clamp.
   *
   * Every channel a role could plausibly arrive through is exercised, because the boundary
   * accepts none of them today and the test must still be capable of catching one.
   */
  const ROLES = ['PUBLIC', 'ADMIN', 'SUPERUSER', 'INTERNAL', 'OPERATOR'];
  const RECORD = area('SYNTH-AREA-001', 'ADMIN2');
  const DECLARED = precisionFloor('ADMIN1');

  const renderUnderRole = (role: string): string => {
    const g = globalThis as Record<string, unknown>;
    const prevGlobals = { r1: g.__ROLE__, r2: g.role, r3: g.ENTITLEMENT };
    const prevEnv = { e1: process.env.ROLE, e2: process.env.USER_ROLE };
    g.__ROLE__ = role; g.role = role; g.ENTITLEMENT = role;
    process.env.ROLE = role; process.env.USER_ROLE = role;
    try {
      /* the role is also offered as a prop, in case the boundary ever reads one */
      const props = { area: RECORD, precision: DECLARED, t, role } as unknown as
        Parameters<typeof AreaLabel>[0];
      return renderToStaticMarkup(React.createElement(AreaLabel, props));
    } finally {
      g.__ROLE__ = prevGlobals.r1; g.role = prevGlobals.r2; g.ENTITLEMENT = prevGlobals.r3;
      process.env.ROLE = prevEnv.e1; process.env.USER_ROLE = prevEnv.e2;
    }
  };

  it('E1 CG-5(b) · every role renders byte-identical output for the same record', () => {
    const outputs = ROLES.map(renderUnderRole);
    for (const o of outputs) expect(o).toBe(outputs[0]);
  });

  it('and that output is the CLAMPED one — the invariant is the safe value, not just equality', () => {
    const out = renderUnderRole('ADMIN');
    expect(out).toContain('data-hum-area-clamped="true"');
    expect(out).not.toContain('SYNTH-AREA-001');
  });

  /**
   * DISCRIMINATING CONTROL. A renderer that emitted a constant would satisfy the equality
   * above perfectly. This proves the boundary still responds to the thing it SHOULD respond
   * to — the declared precision — while ignoring the thing it must not.
   */
  it('the renderer is not simply constant — it moves with the declaration', () => {
    const props = { area: RECORD, precision: precisionFloor('COUNTRY'), t } as unknown as
      Parameters<typeof AreaLabel>[0];
    const atCountry = renderToStaticMarkup(React.createElement(AreaLabel, props));
    const producible = { area: area('SYNTH-AREA-002', 'COUNTRY'), precision: precisionFloor('COUNTRY'), t } as
      unknown as Parameters<typeof AreaLabel>[0];
    expect(renderToStaticMarkup(React.createElement(AreaLabel, producible))).not.toBe(atCountry);
  });
});

/* ═══ 7c · E1 CG-3(b) · THE RENDER IS COUPLED TO THE DECLARATION ══════════════ */

describe('mutating the declared precision moves the rendered geography with it', () => {
  /**
   * E1: "(a) without (b) is REFUSED, not partial." A ceiling test passes on a candidate
   * where the two are unrelated and merely happen to agree — which was this candidate's
   * shape: the frame declared ADMIN1 in a chip while the rows named three admin-2
   * territories, and nothing connected them.
   */
  it('one record, three declarations, three different outcomes', () => {
    const rec = area('SYNTH-AREA-003', 'ADMIN1');
    expect(renderableArea(rec, precisionFloor('ADMIN1')).kind).toBe('NAMED');
    expect(renderableArea(rec, precisionFloor('COUNTRY')).kind).toBe('CLAMPED');
    const settlement = area('SYNTH-AREA-004', 'SETTLEMENT');
    expect(renderableArea(settlement, precisionFloor('ADMIN1')).kind).toBe('CLAMPED');
  });

  it('the coupling is to the DECLARATION, not to the record alone', () => {
    const rec = area('SYNTH-AREA-005', 'COUNTRY');
    const a = renderableArea(rec, precisionFloor('COUNTRY'));
    const b = renderableArea(rec, precisionNotProducible('COUNTRY'));
    expect(a.kind).toBe('NAMED');
    expect(b.kind).toBe('CLAMPED');
  });
});

/* ═══ 7d · ABSENCE-STATE FIXTURE COVERAGE ═════════════════════════════════════ */

describe('every absence reason renders correctly, including the branches the default runtime never reaches', () => {
  /* eslint-disable-next-line @typescript-eslint/no-var-requires */
  const { renderToStaticMarkup } = require('react-dom/server') as typeof import('react-dom/server');
  /* eslint-disable-next-line @typescript-eslint/no-var-requires */
  const React = require('react') as typeof import('react');
  /* eslint-disable-next-line @typescript-eslint/no-var-requires */
  const { Absence } = require('../../components/humanitarian/HumParts') as
    typeof import('../../components/humanitarian/HumParts');
  const t = humStrings('en');

  /**
   * Only two of these are reachable on the shipped degraded model. That is NOT a defect and
   * no state is fabricated on the surface to change it — the production default stays
   * exactly as truthful as it was. The coverage is taken in the test, through the real
   * boundary, which is where an unreachable-but-valid branch belongs.
   */
  it.each(PER_RECORD_ABSENCE_REASONS.map((r) => [r] as const))('%s renders its own class and body', (reason) => {
    const out = renderToStaticMarkup(React.createElement(Absence, { reason, t }));
    expect(out).toContain(`data-hum-absence-reason="${reason}"`);
    expect(out).toContain(t.absenceChrome[ABSENCE_CHROME[reason]]);
    /* the body is the reason's own, and it is present */
    expect(out.length).toBeGreaterThan(120);
  });

  it('the seven reasons produce three distinct chrome values and no more', () => {
    const chromes = new Set(PER_RECORD_ABSENCE_REASONS.map((r) => t.absenceChrome[ABSENCE_CHROME[r]]));
    expect([...chromes].sort()).toEqual(['Not assessed', 'Not established', 'Not shown']);
  });
});

/* ═══ 8 · THE FALLBACK IS HONEST FOR EVERY UNAUTHORED LOCALE ══════════════════ */

describe('a registered locale is total', () => {
  it('only English is registered', () => {
    expect(resolveHumStrings('en').fellBack).toBe(false);
  });

  /**
   * `pl` was `{ ...en, … }`: 27 authored leaves of 116, registered as complete, so
   * `fellBack` was false and the disclosure never rendered. Measured at runtime: the
   * notice showed 6/6 for fr, de, es, pt, ar — and 0/6 for the one locale that was
   * partly authored. The honesty was exactly inverted.
   */
  it('Polish discloses its fallback like every other unauthored locale', () => {
    for (const l of ['pl', 'fr', 'de', 'es', 'pt', 'ar'] as const) {
      expect(resolveHumStrings(l).fellBack).toBe(true);
      expect(resolveHumStrings(l).resolved).toBe('en');
    }
  });

  it('Polish is reported as awaiting content', () => {
    expect(humLocalesAwaitingContent(['en', 'pl', 'fr'])).toContain('pl');
    expect(humLocalesAwaitingContent(['en', 'pl', 'fr'])).not.toContain('en');
  });

  it("L's ratified Polish is applied, unedited", () => {
    expect(HUM_PL_DRAFT_AWAITING_COMPLETION.domain).toBe('Wywiad humanitarny');
    expect(HUM_PL_DRAFT_AWAITING_COMPLETION.absenceChrome.NOT_ASSESSED).toBe('Nieocenione');
    expect(HUM_PL_DRAFT_AWAITING_COMPLETION.absenceChrome.NOT_SHOWN).toBe('Nieprezentowane');
    expect(HUM_PL_DRAFT_AWAITING_COMPLETION.quietFrame.CHECKED_NO_MATERIAL_CHANGE)
      .toBe('Sprawdzone — bez istotnej zmiany');
  });

  /**
   * L T-3 / T-4, made executable here as well as in L's lane. The ruling is that canonical
   * already settled the term: `Bez istotnej zmiany`. The withdrawn draft form must never
   * come back, and the test keeps failing forever rather than once.
   */
  it("L T-3 · the withdrawn form 'materialn*' appears in no Polish value", () => {
    const values = JSON.stringify(HUM_PL_DRAFT_AWAITING_COMPLETION);
    expect(values).not.toMatch(/materialn/i);
  });

  it('L T-4 · the approved form is present', () => {
    expect(JSON.stringify(HUM_PL_DRAFT_AWAITING_COMPLETION)).toMatch(/istotnej zmiany/);
  });

  it('T-3 is capable of failing — positive control', () => {
    expect(/materialn/i.test(JSON.stringify({ q: 'brak zmiany materialnej' }))).toBe(true);
  });

  /**
   * L FIND-A2 · THE OBSOLETE PARTIAL CATALOGUE CANNOT COME BACK.
   *
   * The 27-leaf `{ ...en }` draft survived checkpoint 3 as a live `as const` outside the
   * catalogue, still carrying the withdrawn `zmiana materialna`. Dormant obsolete copy is
   * one accidental import from being live, and the terminology ruling would have been
   * silently un-made. It is gone: the only Polish in this domain is L's ratified authority,
   * the withdrawn term appears in NO source file, and the surviving draft is not
   * registerable because it is not total.
   */
  it('L FIND-A2 · the withdrawn term appears in no source file in the domain', () => {
    /*
      Comments come out first: the docblocks explain the ruling and must be free to name
      the term they retired. What remains is code — identifiers and string literals — and
      the withdrawn form may appear in none of it.
    */
    const hits = DOMAIN_SOURCES.filter((f) => /materialn/i.test(stripComments(read(f))));
    expect(hits).toEqual([]);
  });

  it('L FIND-A2 · there is exactly one Polish object, and it is not in the catalogue', () => {
    const src = read(join(DOMAIN_LIB, 'humStrings.ts'));
    const declarations = [...src.matchAll(/^(?:export )?const (\w*(?:PL|Pl|pl)\w*)\s*[:=]/gm)]
      .map((m) => m[1]);
    expect(declarations).toEqual(['HUM_PL_DRAFT_AWAITING_COMPLETION']);
    /* and it is not annotated HumStrings, so it cannot be dropped into the catalogue */
    expect(src).not.toMatch(/HUM_PL_DRAFT_AWAITING_COMPLETION\s*:\s*HumStrings/);
    expect(stripComments(src)).not.toMatch(/HUM_CATALOGUE[^;]*HUM_PL_DRAFT/);
  });

  /**
   * F §4 · the draft is still not registerable, and the shortfall is measured rather than
   * asserted. Four leaves have no Polish source because L authored them against English
   * the Product Owner has since replaced; three more are present but stale for the same
   * reason. Registering now would render corrected English under `fellBack: false`.
   */
  it('F §4 · the draft is not total against the ratified interface', () => {
    const leaves = (o: unknown, p = ''): string[] =>
      Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
        v && typeof v === 'object' ? leaves(v, p ? `${p}.${k}` : k) : [p ? `${p}.${k}` : k]);
    const iface = new Set(leaves(humStrings('en')));
    const draft = new Set(leaves(HUM_PL_DRAFT_AWAITING_COMPLETION));
    const missing = [...iface].filter((x) => !draft.has(x));
    expect(missing.sort()).toEqual([
      'absenceChrome.NOT_ESTABLISHED',
      'quietFrame.NOT_DERIVABLE',
      'quietSubtitle.NOT_DERIVABLE',
    ]);
    /* and nothing F retired survives in it */
    expect([...draft].filter((x) => !iface.has(x))).toEqual([]);
  });

  it('no catalogue entry is built by spreading English', () => {
    const src = stripComments(read(join(DOMAIN_LIB, 'humStrings.ts')));
    expect(src).not.toMatch(/:\s*HumStrings\s*=\s*\{\s*\.\.\.en/);
  });
});

/* ═══ 12 · CITATION AND CLAIM SWEEP — E1 C-1 ══════════════════════════════════ */

/**
 * WHY A SWEEP AND NOT TWO EDITS.
 *
 * E1 C-1 found two docblocks asserting behaviour the adjacent code had removed. Fixing the
 * two sentences is not the closure, because the next checkpoint writes the next pair. The
 * programme's standing lesson is the one E1 restated: a comment is never evidence, and a
 * stale one that describes a REMOVED SECURITY CONTROL is worse than none, because it stops
 * the next reviewer looking.
 *
 * So the truth is derived from the code on every run and the prose is checked against it.
 * Each sweep carries a positive control, because a sweep that cannot be seen to fail has
 * proved nothing — R-B, applied to the instrument rather than to the subject.
 */
describe('E1 C-1 · no docblock describes behaviour the adjacent code does not implement', () => {
  /** Comment text only — the inverse of `stripComments`. */
  function commentsOf(src: string): string {
    const out: string[] = [];
    for (const m of src.matchAll(/\/\*[\s\S]*?\*\//g)) out.push(m[0]);
    for (const m of src.matchAll(/(?:^|[^:])\/\/([^\n]*)/g)) out.push(m[1]);
    return out.join('\n');
  }

  const DOMAIN_COMMENTS = DOMAIN_SOURCES.map((f) => ({ f, c: commentsOf(read(f)) }));

  /* ── S-1 · a return value the function does not return ───────────────────── */

  /**
   * The claim shape, in the present tense. A historical sentence naming the checkpoint it
   * describes is not a claim about now, and the code comments legitimately carry several —
   * that is how the change is explained. So the predicate fires only on a present-tense
   * assertion, and the exemption is explicit rather than a silent allowance.
   */
  const PRESENT_TENSE_UNDEFINED =
    /`?perRecordAbsenceToken`?[^.]{0,160}?\b(returns?|resolves? to|yields?)\b[^.]{0,40}?`?undefined`?/i;
  const HISTORICAL = /checkpoint\s*3|previous version|used to|no longer|superseded/i;

  it('the shipped return type is total — read from the code, not assumed', () => {
    const src = read(join(DOMAIN_LIB, 'humDegraded.ts'));
    expect(stripComments(src))
      .toMatch(/export function perRecordAbsenceToken\(reason: string\): AbsenceReason\b/);
    expect(stripComments(src)).not.toMatch(/perRecordAbsenceToken\([^)]*\):\s*AbsenceReason\s*\|\s*undefined/);
  });

  it('S-1 · no comment asserts, in the present tense, that it returns undefined', () => {
    for (const { f, c } of DOMAIN_COMMENTS) {
      for (const sentence of c.split(/(?<=\.)\s+|\n\s*\*\s*\n/)) {
        if (PRESENT_TENSE_UNDEFINED.test(sentence) && !HISTORICAL.test(sentence)) {
          throw new Error(`stale return-value claim in ${f}: ${sentence.trim().slice(0, 200)}`);
        }
      }
    }
  });

  it('S-1 · positive control — the sweep fails on a deliberately stale line', () => {
    const stale = '`perRecordAbsenceToken` returns `undefined` for anything outside the closed set.';
    expect(PRESENT_TENSE_UNDEFINED.test(stale)).toBe(true);
    expect(HISTORICAL.test(stale)).toBe(false);
    /* and the exempt form is recognised as exempt, or the control would ban explanation */
    const historical = 'Checkpoint 3 resolved it to `undefined`, which dropped the attribute.';
    expect(HISTORICAL.test(historical)).toBe(true);
  });

  /* ── S-2 · a type member the type does not have ──────────────────────────── */

  /** The members, read out of the type declaration rather than written down here. */
  function chromeMembers(): readonly string[] {
    const decl = /export type AbsenceChrome =([^;]+);/.exec(read(join(DOMAIN_LIB, 'humDegraded.ts')));
    expect(decl).not.toBeNull();
    return [...(decl as RegExpExecArray)[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
  }

  /**
   * A roster line is the shape the defect took: an aligned ` *   TOKEN   gloss` list
   * directly above the type. Only roster lines are checked, because `NOT_DERIVABLE` and
   * `STATE_NOT_DERIVABLE` are legitimate identifiers elsewhere in the domain and a naive
   * token scan would report the whole file.
   */
  const ROSTER_LINE = /^\s*\*\s{2,}([A-Z][A-Z_]{4,})\s{2,}\S/;

  it('S-2 · every chrome class named in a roster line is a member of the type', () => {
    const members = chromeMembers();
    expect(members.length).toBeGreaterThan(0);
    for (const { f, c } of DOMAIN_COMMENTS) {
      for (const line of c.split('\n')) {
        const m = ROSTER_LINE.exec(line);
        if (m === null) continue;
        const token = m[1];
        if (!token.startsWith('NOT_')) continue;
        if (!members.includes(token)) {
          throw new Error(`comment names chrome class ${token}, which AbsenceChrome does not have — ${f}`);
        }
      }
    }
  });

  it('S-2 · positive control — the sweep fails on a class the type does not have', () => {
    const members = chromeMembers();
    const stale = ' *   NOT_AVAILABLE  the platform cannot produce it    — a fact about us';
    const m = ROSTER_LINE.exec(stale);
    expect(m).not.toBeNull();
    expect(members.includes((m as RegExpExecArray)[1])).toBe(false);
    /* and a real member is recognised, or the control would ban the roster entirely */
    const good = ` *   ${members[0]}  a gloss`;
    const gm = ROSTER_LINE.exec(good);
    expect(gm).not.toBeNull();
    expect(members.includes((gm as RegExpExecArray)[1])).toBe(true);
  });

  /* ── S-3 · an emission rule the code does not emit ───────────────────────── */

  it('S-3 · every data-hum attribute named in a comment is actually emitted', () => {
    const emitted = new Set<string>();
    for (const f of DOMAIN_SOURCES) {
      for (const m of stripComments(read(f)).matchAll(/\b(data-hum(?:-[a-z-]+)?)\s*=/g)) emitted.add(m[1]);
    }
    expect(emitted.size).toBeGreaterThan(0);
    for (const { f, c } of DOMAIN_COMMENTS) {
      for (const m of c.matchAll(/`(data-hum(?:-[a-z-]+)?)`/g)) {
        if (!emitted.has(m[1])) {
          throw new Error(`comment cites ${m[1]}, which nothing in the domain emits — ${f}`);
        }
      }
    }
  });

  it('S-3 · positive control — a cited attribute that nothing emits is caught', () => {
    const emitted = new Set(['data-hum', 'data-hum-absence-reason']);
    expect(emitted.has('data-hum-protected-class')).toBe(false);
    expect(emitted.has('data-hum-absence-reason')).toBe(true);
  });
});
