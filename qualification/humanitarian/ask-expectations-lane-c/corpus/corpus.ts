/**
 * HUMANITARIAN ASK TOOL — DETERMINISTIC CORPUS
 *
 * Authored BEFORE the reader implementation, per the standing lane instruction
 * ("Build the deterministic evaluation corpus first") and ruling 8
 * ("Do not change expected outputs merely to make tests green — correct the code").
 *
 * COVERAGE IS THE CONTRACT'S OWN TEST LIST, VERBATIM. Contract 4 §G names eight tests:
 *
 *   G1  specialist read with retained data
 *   G2  no-data truthful refusal
 *   G3  Sudan vs Kenya identity separation
 *   G4  standalone generic Humanitarian query
 *   G5  dashboard-context Humanitarian query
 *   G6  no legacy /analysis/news
 *   G7  reopen = zero new provider / zero new AI
 *   G8  EN / PL compatibility
 *
 * Every row carries `contractTest` so a dropped test is visible, and `provenance` so a row
 * asserting a governed store is never mistaken for a measurement of today's product.
 *
 * TWO FIXTURE CLASSES, AND THE DISTINCTION IS LOAD-BEARING:
 *
 *   MEASURED_STATE_TODAY — the store state the register actually records. E1's Humanitarian
 *     activation review: activation "remains blocked until the real database binding is
 *     implemented and re-tested", the producer is uncommitted, `gx14-authority-store.sql`
 *     unapplied. So today there is NO governed retained humanitarian store.
 *
 *   COUNTERFACTUAL — a hypothetical governed store, used only to prove the rules are
 *     CONDITIONAL rather than hardcoded to today's absence. Same device as the frozen
 *     router's `fixtures/counterfactual.fixture.ts`: without these rows, a reader that
 *     refuses everything unconditionally would pass the whole corpus and look correct.
 *     These rows describe nothing about the shipped product.
 */

import type {
  AssessmentState,
  AvailabilityState,
  HumRefusalCode,
  HumanitarianReadRequest,
} from '../src/ports.js';

/* ------------------------------------------------------------------ *
 * Store fixtures
 * ------------------------------------------------------------------ */

export type StoreFixture =
  /** Today's measured state: no governed binding. A stub that answers is still not bound. */
  | 'UNBOUND_NO_GOVERNED_BINDING'
  /** Counterfactual: governed, bound, holds retained SDN rows. */
  | 'GOVERNED_WITH_SDN_ROWS'
  /** Counterfactual: governed and bound, but holds nothing for the asked geography. */
  | 'GOVERNED_EMPTY_FOR_GEOGRAPHY'
  /** Counterfactual: governed and bound, read could not be served this time. */
  | 'GOVERNED_READ_FAILING'
  /** Counterfactual: governed, holding reader-safe rows mixed with one of each blocked class. */
  | 'GOVERNED_MIXED_DISCLOSURE'
  /** Counterfactual: governed, every row blocked — present but not disclosable. */
  | 'GOVERNED_ALL_WITHHELD';

export type Provenance = 'MEASURED_STATE_TODAY' | 'COUNTERFACTUAL';

/** Which surface asks. Both must reach the SAME tool — Contract 4 §C and §D. */
export type Surface = 'STANDALONE_ASK' | 'ALPHA_DASHBOARD_CONTEXT';

export interface CorpusRow {
  readonly id: string;
  readonly name: string;
  readonly contractTest: 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8';
  readonly provenance: Provenance;
  readonly store: StoreFixture;
  readonly surface: Surface;
  readonly request: HumanitarianReadRequest;

  /* expectations */
  readonly expectState: AvailabilityState;
  /**
   * The evidence axis (Contract 2 §E). Authored per row, NOT derived from `expectState` in the
   * corpus, so that a change to the mapping in `src/ports.ts` is caught by the corpus rather
   * than silently agreed with. Mutation MU-24 depends on that independence.
   */
  readonly expectAssessment: AssessmentState;
  readonly expectRefusal: HumRefusalCode | null;
  readonly expectClaimsNonEmpty: boolean;
  /** Must the tool be registered AND bound, so Ask may plan a specialist execution? */
  readonly expectExecutionPlannable: boolean;
  /** AUDIT count of claims the disclosure guard removed. Reader-facing nowhere. */
  readonly expectWithheldTotal: number;
  /**
   * The FROZEN Ask terminal. Ruled for R2: when Humanitarian is unavailable the Ask terminal
   * stays `CAPABILITY_UNAVAILABLE`. Lane C does not emit `PLAN_NOT_SATISFIABLE`.
   */
  readonly expectAskTerminal: 'CAPABILITY_UNAVAILABLE' | null;
  /** Why this row exists, in the narrowest true form. */
  readonly note: string;
}

/* ------------------------------------------------------------------ *
 * Requests
 * ------------------------------------------------------------------ */

const SDN_GENERIC: HumanitarianReadRequest = {
  countryIso3: 'SDN',
  questionKind: 'CURRENT_STATUS',
};

const KEN_GENERIC: HumanitarianReadRequest = {
  countryIso3: 'KEN',
  questionKind: 'CURRENT_STATUS',
};

const SDN_WINDOWED: HumanitarianReadRequest = {
  countryIso3: 'SDN',
  questionKind: 'CURRENT_STATUS',
  statedWindow: 'the last 30 days',
};

const SDN_TWO_KEYS: HumanitarianReadRequest = {
  countryIso3: 'SDN',
  questionKind: 'CURRENT_STATUS',
  observationKeys: ['hum:sdn:flood:2026-09', 'hum:sdn:displacement:2026-09'],
};

const SDN_WITH_OBSERVATION_KEY: HumanitarianReadRequest = {
  countryIso3: 'SDN',
  questionKind: 'CURRENT_STATUS',
  observationKeys: ['hum:sdn:flood:2026-09'],
};

/* ------------------------------------------------------------------ *
 * The corpus
 * ------------------------------------------------------------------ */

export const CORPUS: readonly CorpusRow[] = [
  /* ---------------- G1 · specialist read with retained data ---------------- */
  {
    id: 'G1a-retained-read-governed-store',
    name: 'Governed bound store holding SDN rows serves a specialist read',
    contractTest: 'G1',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_WITH_SDN_ROWS',
    surface: 'STANDALONE_ASK',
    request: SDN_GENERIC,
    expectState: 'AVAILABLE',
    expectAssessment: 'RETAINED_REPORTING',
    expectRefusal: null,
    expectClaimsNonEmpty: true,
    expectExecutionPlannable: true,
    expectWithheldTotal: 0,
    expectAskTerminal: null,
    note:
      'The conditional case. Proves the reader is capable of serving when a governed store ' +
      'exists, so the refusals below are rules and not an unconditional dead end.',
  },
  {
    id: 'G1b-retained-read-today',
    name: 'Today: no governed binding, so the read is refused as unbound',
    contractTest: 'G1',
    provenance: 'MEASURED_STATE_TODAY',
    store: 'UNBOUND_NO_GOVERNED_BINDING',
    surface: 'STANDALONE_ASK',
    request: SDN_GENERIC,
    expectState: 'NOT_CONNECTED',
    expectAssessment: 'SOURCE_UNAVAILABLE',
    expectRefusal: 'SPECIALIST_NOT_BOUND',
    expectClaimsNonEmpty: false,
    expectExecutionPlannable: false,
    expectWithheldTotal: 0,
    expectAskTerminal: 'CAPABILITY_UNAVAILABLE',
    note:
      'NOT_CONNECTED, not NOT_BUILT: Main measured that humanitarian HAS a shared contract, ' +
      'so the contract exists and the rows do not. Collapsing the two would lose that.',
  },
  {
    id: 'G1c-claims-cite-sources',
    name: 'Every served claim carries at least one source reference',
    contractTest: 'G1',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_WITH_SDN_ROWS',
    surface: 'STANDALONE_ASK',
    request: SDN_WINDOWED,
    expectState: 'AVAILABLE',
    expectAssessment: 'RETAINED_REPORTING',
    expectRefusal: null,
    expectClaimsNonEmpty: true,
    expectExecutionPlannable: true,
    expectWithheldTotal: 0,
    expectAskTerminal: null,
    note:
      'A claim carries its sources or it is not a claim. Enforced structurally by probe A-3, ' +
      'which rejects any served claim with an empty sources array.',
  },

  /* ---------------- G2 · no-data truthful refusal ---------------- */
  {
    id: 'G2a-governed-but-empty-geography',
    name: 'Governed store with nothing for this geography refuses truthfully',
    contractTest: 'G2',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_EMPTY_FOR_GEOGRAPHY',
    surface: 'STANDALONE_ASK',
    request: KEN_GENERIC,
    expectState: 'NO_DATA_FOR_GEOGRAPHY',
    expectAssessment: 'NOT_ASSESSED',
    expectRefusal: 'NO_DATA_FOR_GEOGRAPHY',
    expectClaimsNonEmpty: false,
    expectExecutionPlannable: false,
    expectWithheldTotal: 0,
    expectAskTerminal: 'CAPABILITY_UNAVAILABLE',
    note:
      'Distinct from NOT_CONNECTED. A bound store that holds nothing for Kenya is a different ' +
      'fact from no store at all, and the accepted five states exist to keep them apart.',
  },
  {
    id: 'G2b-read-failing-is-not-no-data',
    name: 'A failing read is TEMPORARILY_UNAVAILABLE, never silently no-data',
    contractTest: 'G2',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_READ_FAILING',
    surface: 'STANDALONE_ASK',
    request: SDN_GENERIC,
    expectState: 'TEMPORARILY_UNAVAILABLE',
    expectAssessment: 'SOURCE_UNAVAILABLE',
    expectRefusal: 'TEMPORARILY_UNAVAILABLE',
    expectClaimsNonEmpty: false,
    expectExecutionPlannable: false,
    expectWithheldTotal: 0,
    expectAskTerminal: 'CAPABILITY_UNAVAILABLE',
    note:
      'The failure mode that produces a confident wrong answer: a broken read reported as ' +
      '"no humanitarian emergencies in Sudan". Absence of evidence is not evidence of absence.',
  },
  {
    id: 'G2c-no-fabrication-on-refusal',
    name: 'No refusal carries a severity, count or location',
    contractTest: 'G2',
    provenance: 'MEASURED_STATE_TODAY',
    store: 'UNBOUND_NO_GOVERNED_BINDING',
    surface: 'ALPHA_DASHBOARD_CONTEXT',
    request: SDN_GENERIC,
    expectState: 'NOT_CONNECTED',
    expectAssessment: 'SOURCE_UNAVAILABLE',
    expectRefusal: 'SPECIALIST_NOT_BOUND',
    expectClaimsNonEmpty: false,
    expectExecutionPlannable: false,
    expectWithheldTotal: 0,
    expectAskTerminal: 'CAPABILITY_UNAVAILABLE',
    note:
      "E1's accepted humanitarian rule: no fabricated severity, count or location. Probe A-1 " +
      'asserts claims is empty for every non-AVAILABLE state, so the rule is structural.',
  },
  {
    id: 'G2d-observation-key-accepted-opaquely',
    name: "Main's observationKey is accepted opaquely, never parsed",
    contractTest: 'G2',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_WITH_SDN_ROWS',
    surface: 'STANDALONE_ASK',
    request: SDN_WITH_OBSERVATION_KEY,
    expectState: 'AVAILABLE',
    expectAssessment: 'RETAINED_REPORTING',
    expectRefusal: null,
    expectClaimsNonEmpty: true,
    expectExecutionPlannable: true,
    expectWithheldTotal: 0,
    expectAskTerminal: null,
    note:
      'CHANGED IN R2 — recorded in docs/05-CHANGED-PROBES.md §4. In R1 this row expected ' +
      'OBSERVATION_KEY_CONSTRUCT_ABSENT, because Main had not landed the identity and the ruling ' +
      'forbade inventing one. Main has landed it, so the key is ACCEPTED and treated as an opaque ' +
      'byte string: never parsed, split, normalised or validated. Opacity is what lets lane C use ' +
      "an identity whose format is Main's without re-deriving it.",
  },

  /* ---------------- G3 · Sudan vs Kenya identity separation ---------------- */
  {
    id: 'G3a-sdn-identity',
    name: 'Sudan identity material carries SDN',
    contractTest: 'G3',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_WITH_SDN_ROWS',
    surface: 'STANDALONE_ASK',
    request: SDN_GENERIC,
    expectState: 'AVAILABLE',
    expectAssessment: 'RETAINED_REPORTING',
    expectRefusal: null,
    expectClaimsNonEmpty: true,
    expectExecutionPlannable: true,
    expectWithheldTotal: 0,
    expectAskTerminal: null,
    note: 'Paired with G3b. Probe I-1 asserts the two identity materials are not equal.',
  },
  {
    id: 'G3b-ken-identity',
    name: 'Kenya identity material differs from Sudan even when both refuse',
    contractTest: 'G3',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_EMPTY_FOR_GEOGRAPHY',
    surface: 'STANDALONE_ASK',
    request: KEN_GENERIC,
    expectState: 'NO_DATA_FOR_GEOGRAPHY',
    expectAssessment: 'NOT_ASSESSED',
    expectRefusal: 'NO_DATA_FOR_GEOGRAPHY',
    expectClaimsNonEmpty: false,
    expectExecutionPlannable: false,
    expectWithheldTotal: 0,
    expectAskTerminal: 'CAPABILITY_UNAVAILABLE',
    note:
      'The dangerous reuse is between two REFUSALS: if identity omitted the country while the ' +
      'tool was unbound, a cached Sudan refusal could serve a Kenya question, and later a ' +
      'cached Sudan ANSWER could too. Identity must separate before the store is bound.',
  },
  {
    id: 'G3c-window-participates',
    name: 'A different stated window is a different identity',
    contractTest: 'G3',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_WITH_SDN_ROWS',
    surface: 'STANDALONE_ASK',
    request: SDN_WINDOWED,
    expectState: 'AVAILABLE',
    expectAssessment: 'RETAINED_REPORTING',
    expectRefusal: null,
    expectClaimsNonEmpty: true,
    expectExecutionPlannable: true,
    expectWithheldTotal: 0,
    expectAskTerminal: null,
    note:
      'Same country, different window. Probe I-2 asserts G3a and G3c differ, so a bounded ' +
      'time window cannot be dropped from the durable plan identity.',
  },

  /* ---------------- G4 · standalone generic query ---------------- */
  {
    id: 'G4a-standalone-reaches-the-same-tool',
    name: 'Standalone Ask reaches Humanitarian without the dashboard being public',
    contractTest: 'G4',
    provenance: 'MEASURED_STATE_TODAY',
    store: 'UNBOUND_NO_GOVERNED_BINDING',
    surface: 'STANDALONE_ASK',
    request: SDN_GENERIC,
    expectState: 'NOT_CONNECTED',
    expectAssessment: 'SOURCE_UNAVAILABLE',
    expectRefusal: 'SPECIALIST_NOT_BOUND',
    expectClaimsNonEmpty: false,
    expectExecutionPlannable: false,
    expectWithheldTotal: 0,
    expectAskTerminal: 'CAPABILITY_UNAVAILABLE',
    note:
      'Contract 4 §C. The reader takes no surface, no role and no entitlement as input, so ' +
      'reachability is a property of canonical Ask V2 and not of dashboard visibility. ' +
      'Probe S-1 asserts no surface or role symbol appears in src/.',
  },

  /* ---------------- G5 · dashboard-context query ---------------- */
  {
    id: 'G5a-dashboard-context-same-result',
    name: 'Alpha dashboard context yields a byte-identical result to standalone',
    contractTest: 'G5',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_WITH_SDN_ROWS',
    surface: 'ALPHA_DASHBOARD_CONTEXT',
    request: SDN_GENERIC,
    expectState: 'AVAILABLE',
    expectAssessment: 'RETAINED_REPORTING',
    expectRefusal: null,
    expectClaimsNonEmpty: true,
    expectExecutionPlannable: true,
    expectWithheldTotal: 0,
    expectAskTerminal: null,
    note:
      'Contract 4 §D: one tool, no second engine. Probe S-2 asserts G4-shaped and G5-shaped ' +
      'reads with the same request are byte-identical — the same device as the accepted ' +
      'protected-aggregation byte-identity proof, applied to the surface axis.',
  },
  {
    id: 'G5b-role-precision-invariance',
    name: 'Result does not vary with role or admin precision',
    contractTest: 'G5',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_WITH_SDN_ROWS',
    surface: 'ALPHA_DASHBOARD_CONTEXT',
    request: SDN_WINDOWED,
    expectState: 'AVAILABLE',
    expectAssessment: 'RETAINED_REPORTING',
    expectRefusal: null,
    expectClaimsNonEmpty: true,
    expectExecutionPlannable: true,
    expectWithheldTotal: 0,
    expectAskTerminal: null,
    note:
      "Carries E1's accepted role/admin precision invariance onto the Ask path. The reader has " +
      'no role parameter at all, which is the strongest available form of the guarantee.',
  },

  /* ---------------- G6 · no legacy /analysis/news ---------------- */
  {
    id: 'G6a-no-legacy-endpoint',
    name: 'No legacy /analysis/news path appears anywhere in the module',
    contractTest: 'G6',
    provenance: 'MEASURED_STATE_TODAY',
    store: 'UNBOUND_NO_GOVERNED_BINDING',
    surface: 'STANDALONE_ASK',
    request: SDN_GENERIC,
    expectState: 'NOT_CONNECTED',
    expectAssessment: 'SOURCE_UNAVAILABLE',
    expectRefusal: 'SPECIALIST_NOT_BOUND',
    expectClaimsNonEmpty: false,
    expectExecutionPlannable: false,
    expectWithheldTotal: 0,
    expectAskTerminal: 'CAPABILITY_UNAVAILABLE',
    note:
      'Asserted as a source-text property by probe N-2 with a negative control, not by this ' +
      'row alone. The row exists so the test list stays complete and visibly covered.',
  },

  /* ---------------- G7 · reopen = zero new provider / zero new AI ---------------- */
  {
    id: 'G7a-reopen-is-pure',
    name: 'Repeating the identical read changes nothing and calls nothing',
    contractTest: 'G7',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_WITH_SDN_ROWS',
    surface: 'ALPHA_DASHBOARD_CONTEXT',
    request: SDN_GENERIC,
    expectState: 'AVAILABLE',
    expectAssessment: 'RETAINED_REPORTING',
    expectRefusal: null,
    expectClaimsNonEmpty: true,
    expectExecutionPlannable: true,
    expectWithheldTotal: 0,
    expectAskTerminal: null,
    note:
      'Probe P-1 calls the read twice and compares byte-for-byte; probe N-1 asserts src/ holds ' +
      'no fetch, http, provider, openai or model symbol, so "zero new provider and zero new ' +
      'AI on reopen" is a property of the code rather than of a counter.',
  },
  {
    id: 'G7b-acquisition-refused-from-ask',
    name: 'A read that would require acquisition is refused, not queued',
    contractTest: 'G7',
    provenance: 'MEASURED_STATE_TODAY',
    store: 'GOVERNED_EMPTY_FOR_GEOGRAPHY',
    surface: 'STANDALONE_ASK',
    request: { ...KEN_GENERIC, statedWindow: 'today' },
    expectState: 'NO_DATA_FOR_GEOGRAPHY',
    expectAssessment: 'NOT_ASSESSED',
    expectRefusal: 'NO_DATA_FOR_GEOGRAPHY',
    expectClaimsNonEmpty: false,
    expectExecutionPlannable: false,
    expectWithheldTotal: 0,
    expectAskTerminal: 'CAPABILITY_UNAVAILABLE',
    note:
      'Contract 4 §F: acquisition and Ask execution are separate. Asking for today where the ' +
      'store has nothing must refuse with no data, NOT trigger a fetch to go and get it. ' +
      'This is the row that would fail if someone later "helpfully" wired a provider in.',
  },

  /* ---------------- G8 · EN / PL compatibility ---------------- */
  {
    id: 'G8a-pl-same-identity-as-en',
    name: 'A Polish-language question for SDN reads identically to an English one',
    contractTest: 'G8',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_WITH_SDN_ROWS',
    surface: 'STANDALONE_ASK',
    request: SDN_GENERIC,
    expectState: 'AVAILABLE',
    expectAssessment: 'RETAINED_REPORTING',
    expectRefusal: null,
    expectClaimsNonEmpty: true,
    expectExecutionPlannable: true,
    expectWithheldTotal: 0,
    expectAskTerminal: null,
    note:
      'The reader takes ISO3 and a declared questionKind, never question text, so it is ' +
      'language-neutral BY CONSTRUCTION — probe L-1 asserts no language or locale symbol in ' +
      'src/. This is the only honest form of EN/PL parity available at this layer; see C-H4 ' +
      "for what it does NOT cover, which is L's measured English-only upstream vocabulary.",
  },
  {
    id: 'G8b-window-text-not-normalised',
    name: 'A Polish window phrase is carried verbatim, never parsed',
    contractTest: 'G8',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_WITH_SDN_ROWS',
    surface: 'STANDALONE_ASK',
    request: { countryIso3: 'SDN', questionKind: 'CURRENT_STATUS', statedWindow: 'ostatnie 30 dni' },
    expectState: 'AVAILABLE',
    expectAssessment: 'RETAINED_REPORTING',
    expectRefusal: null,
    expectClaimsNonEmpty: true,
    expectExecutionPlannable: true,
    expectWithheldTotal: 0,
    expectAskTerminal: null,
    note:
      "L measured that 'region' matches in Polish while 'région' fails on a diacritic. A " +
      'window parser here would reproduce that class of defect, so statedWindow is stored as ' +
      "the reader's own text and probe L-2 asserts it survives unmodified into identity.",
  },
  /* ================= R2 ROWS ================= */

  {
    id: 'R2-DG1-mixed-disclosure-serves-only-safe',
    name: 'A mixed store serves reader-safe claims only; blocked classes are withheld',
    contractTest: 'G1',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_MIXED_DISCLOSURE',
    surface: 'STANDALONE_ASK',
    request: SDN_GENERIC,
    expectState: 'AVAILABLE',
    expectAssessment: 'RETAINED_REPORTING',
    expectRefusal: null,
    expectClaimsNonEmpty: true,
    expectExecutionPlannable: true,
    expectWithheldTotal: 3,
    expectAskTerminal: null,
    note:
      'One INTERNAL_ONLY, one PROTECTED_LOCATION and one WITHHELD claim are removed; the two ' +
      'reader-safe claims are served. Probe DG-1 proves the canary token carried by the withheld ' +
      'three reaches none of the five sinks.',
  },
  {
    id: 'R2-DG2-everything-withheld-fails-closed',
    name: 'Present but not disclosable fails closed; the reason lives only on the audit count',
    contractTest: 'G2',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_ALL_WITHHELD',
    surface: 'ALPHA_DASHBOARD_CONTEXT',
    request: SDN_GENERIC,
    expectState: 'NO_DATA_FOR_GEOGRAPHY',
    expectAssessment: 'NOT_ASSESSED',
    expectRefusal: 'NO_DATA_FOR_GEOGRAPHY',
    expectClaimsNonEmpty: false,
    expectExecutionPlannable: false,
    expectWithheldTotal: 2,
    expectAskTerminal: 'CAPABILITY_UNAVAILABLE',
    note:
      'THE ONE DELIBERATE TRADE, and it needs E1 ratification. A protected-only situation is ' +
      "indistinguishable to a reader from an empty one, which preserves E1's byte-identity rule " +
      'but makes the reader-facing output less informative than the data. The five accepted ' +
      'absence states contain no member meaning "present but not disclosable". ' +
      'DISCLOSURE-GUARD.md §4.',
  },
  {
    id: 'R2-OK1-two-keys-separate-identity',
    name: 'Two observation keys produce a different identity from one',
    contractTest: 'G3',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_WITH_SDN_ROWS',
    surface: 'STANDALONE_ASK',
    request: SDN_TWO_KEYS,
    expectState: 'AVAILABLE',
    expectAssessment: 'RETAINED_REPORTING',
    expectRefusal: null,
    expectClaimsNonEmpty: true,
    expectExecutionPlannable: true,
    expectWithheldTotal: 0,
    expectAskTerminal: null,
    note:
      '§E "no cross-observation reuse" is testable now that Main landed the key. Probe OK-1 ' +
      'asserts this identity differs from the single-key and the no-key identities.',
  },
  {
    id: 'R2-SA1-standalone-and-alpha-identical',
    name: 'Standalone Ask and the Alpha dashboard reach the same specialist, byte-identically',
    contractTest: 'G5',
    provenance: 'COUNTERFACTUAL',
    store: 'GOVERNED_MIXED_DISCLOSURE',
    surface: 'ALPHA_DASHBOARD_CONTEXT',
    request: SDN_GENERIC,
    expectState: 'AVAILABLE',
    expectAssessment: 'RETAINED_REPORTING',
    expectRefusal: null,
    expectClaimsNonEmpty: true,
    expectExecutionPlannable: true,
    expectWithheldTotal: 3,
    expectAskTerminal: null,
    note:
      'Paired with R2-DG1, the same request from STANDALONE_ASK. Probe SA-1 asserts the two ' +
      'results are byte-identical INCLUDING their sink payloads, so the disclosure guard cannot ' +
      'be laxer on the Alpha surface than on the public one.',
  },

];

/* ------------------------------------------------------------------ *
 * Coverage assertions over the corpus itself
 * ------------------------------------------------------------------ */

export const CONTRACT_TESTS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'] as const;

/** Probe C-1: every contract test named by §G has at least one row. */
export function uncoveredContractTests(): readonly string[] {
  const seen = new Set(CORPUS.map((r) => r.contractTest));
  return CONTRACT_TESTS.filter((t) => !seen.has(t));
}

/** Probe C-2: every availability state the reader can emit is exercised. */
export function reachedStates(): readonly AvailabilityState[] {
  return [...new Set(CORPUS.map((r) => r.expectState))].sort();
}

/**
 * Probe C-3: at least one COUNTERFACTUAL row expects AVAILABLE, and at least one
 * MEASURED_STATE_TODAY row expects a refusal. Without both, the corpus is either a
 * description of a product that does not exist or an unconditional dead end.
 */
export function hasBothProvenanceClasses(): boolean {
  const cf = CORPUS.some((r) => r.provenance === 'COUNTERFACTUAL' && r.expectState === 'AVAILABLE');
  const today = CORPUS.some(
    (r) => r.provenance === 'MEASURED_STATE_TODAY' && r.expectRefusal !== null,
  );
  return cf && today;
}
