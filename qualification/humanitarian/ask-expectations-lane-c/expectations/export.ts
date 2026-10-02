/**
 * Derives the portable expectation set from `corpus/corpus.ts`. Generated, never hand-written,
 * so the JSON cannot drift from the corpus the probes and mutations run against.
 */
import { CORPUS } from '../corpus/corpus.js';
import { HUMANITARIAN_READER_REVISION } from '../src/ports.js';

const INVARIANT = 'SEMANTIC_INVARIANT';
const CONVENTION = 'PACKAGE_CONVENTION';

const rows = CORPUS.map((r) => ({
  id: r.id,
  name: r.name,
  contractTest: r.contractTest,
  provenance: r.provenance,
  store: r.store,
  surface: r.surface,
  request: {
    countryIso3: r.request.countryIso3,
    observationKeys: r.request.observationKeys ?? null,
    statedWindow: r.request.statedWindow ?? null,
    questionKind: r.request.questionKind,
  },
  expect: {
    /** Must hold for ANY correct adapter. */
    availability: { value: r.expectState, assertionClass: INVARIANT },
    assessment: { value: r.expectAssessment, assertionClass: INVARIANT },
    claimsNonEmpty: { value: r.expectClaimsNonEmpty, assertionClass: INVARIANT },
    executionPlannable: { value: r.expectExecutionPlannable, assertionClass: INVARIANT },
    /** AUDIT count the disclosure guard removed. Invariant: never reader-facing. */
    withheldTotal: { value: r.expectWithheldTotal, assertionClass: INVARIANT },
    /** The FROZEN Ask terminal when Humanitarian is unavailable. */
    askTerminal: { value: r.expectAskTerminal, assertionClass: INVARIANT },
    /** This package's refusal-code spelling. Map it through `refusalAliases` in your binding. */
    refusalCode: { value: r.expectRefusal, assertionClass: CONVENTION },
  },
  note: r.note,
}));

const out = {
  schema: 'globalnewsai.humanitarian.ask-expectations/3',
  lane: 'C',
  contract: 'CONTRACT 4 — HUMANITARIAN CANONICAL ASK TOOL / ROUTER BINDING R1',
  readerRevision: HUMANITARIAN_READER_REVISION,
  purpose:
    'Regression expectations for the canonical Humanitarian Ask specialist adapter. These ' +
    'strengthen an existing adapter’s proof; they do not define canonical Ask semantics.',
  /**
   * E1's ASK DISCLOSURE RULING (R2), D-1 and D-4. Checked against YOUR adapter, not against lane
   * C's reference oracle, which does not carry disclosure codes — see E1-COMPLIANCE.md.
   */
  requiredDisclosures: {
    codes: [
      'IMPACT_NOT_ASSESSED',
      'RETAINED_NOT_CURRENT',
      'SEVERITY_NOT_ASSESSED',
      'COUNTRY_SCOPE_NOT_STATED_BY_SOURCE',
      'PUBLISHER_TIME_ZONE_NOT_STATED',
      'GEOMETRY_WITHHELD_SOURCE_CENTROID',
    ],
    mandatoryOnEveryAnswer: ['IMPACT_NOT_ASSESSED'],
    assertionClass: 'SEMANTIC_INVARIANT',
    rule:
      'D-1: every hop that displays or persists a Humanitarian answer carries all six codes; a ' +
      'hop that cannot carry them may not display Humanitarian evidence. D-4: IMPACT_NOT_ASSESSED ' +
      'is mandatory on EVERY Humanitarian answer, including ones that successfully use retained ' +
      'rows, because silence about impact reads as "no impact reported".',
    consumerRecognitionRule:
      'D-2: a code no consumer recognises is a defect at the EMITTING lane. Cross your emitted ' +
      'set against the consumer vocabulary before shipping — E1 measured governedPrompt as a ' +
      'closed if-chain of five codes against an open producer, which is how RETAINED_NOT_CURRENT ' +
      'was being dropped on the USED path.',
  },
  disclosure: {
    classes: ['READER_SAFE', 'INTERNAL_ONLY', 'PROTECTED_LOCATION', 'WITHHELD'],
    sinks: [
      'MODEL_CONTEXT',
      'SOURCES_RAIL',
      'DURABLE_CONTRIBUTION',
      'STORED_RESULT',
      'SAVED_RECENT',
    ],
    rule: 'Only READER_SAFE may reach any sink. The rule is not per-sink.',
    note:
      'The five sinks are not independent: a StoredResult is reopened into Saved/Recent and ' +
      'quoted back into model context, so admitting a class to one sink admits it to all.',
  },
  askTerminal: {
    value: 'CAPABILITY_UNAVAILABLE',
    note:
      'FROZEN. When Humanitarian is unavailable the Ask terminal stays CAPABILITY_UNAVAILABLE. ' +
      'Lane C emits no competing terminal and does not reopen that question.',
  },
  axes: {
    availability: {
      values: [
        'AVAILABLE',
        'NOT_BUILT',
        'NOT_CONNECTED',
        'NO_DATA_FOR_GEOGRAPHY',
        'TIER_RESTRICTED',
        'TEMPORARILY_UNAVAILABLE',
      ],
      note: 'The five accepted absence states plus AVAILABLE. They must not collapse.',
    },
    assessment: {
      values: [
        'CURRENT_PROVIDER_OBSERVATION',
        'RETAINED_REPORTING',
        'NOT_ASSESSED',
        'SOURCE_UNAVAILABLE',
      ],
      note:
        'Contract 2 §E. Orthogonal to availability. NOT_ASSESSED must never stand in for an ' +
        'unreachable store, and CURRENT_PROVIDER_OBSERVATION is unreachable from any Ask read ' +
        'that performs no provider fetch.',
    },
  },
  rowCount: rows.length,
  rows,
};

console.log(JSON.stringify(out, null, 2));
