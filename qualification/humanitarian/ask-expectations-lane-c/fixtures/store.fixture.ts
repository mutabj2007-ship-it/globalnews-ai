/**
 * STORE FIXTURES — stand-ins for the governed retained humanitarian read.
 *
 * `UNBOUND_NO_GOVERNED_BINDING` is the state the register records today. The rest are
 * COUNTERFACTUAL and describe nothing about the shipped product; they exist so the refusal and
 * disclosure rules are provably CONDITIONAL rather than an unconditional dead end.
 *
 * No fixture opens a socket, reads a clock or touches a database. Every "store" is a literal.
 */

import { assessmentFor } from '../src/ports.js';
import type {
  HumanitarianRetainedReadPort,
  RetainedReadOutput,
  SourcedHumClaim,
} from '../src/ports.js';
import type { ClassifiedClaim, DisclosureClass } from '../src/disclosure.js';
import type { StoreFixture } from '../corpus/corpus.js';

/**
 * **THE CANARY.** Every non-reader-safe claim carries this exact token, in its text and in its
 * source ref. Probe `DG-1` serialises each of the five sink payloads and asserts the token
 * appears in none of them.
 *
 * A canary is used instead of a structural assertion because it survives refactoring: if someone
 * later adds a sixth projection, or widens one, or stringifies a claim into a diagnostic, the
 * token travels with the leak and the probe catches it. A `claims.length` check would not.
 */
export const LEAK_CANARY = 'ZZCANARYZZ-do-not-disclose-7f3a91';

function claim(text: string, scope: 'COUNTRY' | 'REGION' = 'COUNTRY'): SourcedHumClaim {
  return {
    claim: text,
    sources: [{ articleRef: `retained:${text.slice(0, 8)}`, countryIso3: 'SDN' }],
    scope,
    asOfStated: 'as reported in the retained window',
  };
}

function canaryClaim(disclosure: DisclosureClass): ClassifiedClaim {
  return {
    claim: {
      claim: `${LEAK_CANARY} ${disclosure} payload`,
      sources: [{ articleRef: `retained:${LEAK_CANARY}`, countryIso3: 'SDN' }],
      scope: 'COUNTRY',
      asOfStated: LEAK_CANARY,
    },
    disclosure,
  };
}

const SAFE: readonly ClassifiedClaim[] = [
  { claim: claim('Displacement reported at country scale'), disclosure: 'READER_SAFE' },
  { claim: claim('Food insecurity reported at country scale'), disclosure: 'READER_SAFE' },
];

/** Reader-safe rows mixed with one of each blocked class — the realistic and dangerous case. */
const MIXED: readonly ClassifiedClaim[] = [
  ...SAFE,
  canaryClaim('INTERNAL_ONLY'),
  canaryClaim('PROTECTED_LOCATION'),
  canaryClaim('WITHHELD'),
];

/** Every row blocked. Nothing releasable remains. */
const ALL_WITHHELD: readonly ClassifiedClaim[] = [
  canaryClaim('PROTECTED_LOCATION'),
  canaryClaim('PROTECTED_LOCATION'),
];

const RETAINED: Record<string, readonly ClassifiedClaim[]> = { SDN: SAFE };
const RETAINED_MIXED: Record<string, readonly ClassifiedClaim[]> = { SDN: MIXED };

function empty(
  state: RetainedReadOutput['state'],
  refusal: RetainedReadOutput['refusal'],
): RetainedReadOutput {
  return { state, assessment: assessmentFor(state), classified: [], refusal };
}

function serve(classified: readonly ClassifiedClaim[]): RetainedReadOutput {
  return { state: 'AVAILABLE', assessment: assessmentFor('AVAILABLE'), classified, refusal: null };
}

export function storeFor(fixture: StoreFixture): HumanitarianRetainedReadPort {
  if (fixture === 'UNBOUND_NO_GOVERNED_BINDING') {
    return {
      governed: false,
      // Deliberately answers AVAILABLE WITH CLAIMS. This is the dangerous stub, and the only
      // version of this fixture that can prove anything: defect D-2 was that an ungoverned
      // fixture which politely refused produced a byte-identical result whether or not the
      // adapter checked `governed` at all. E1's words: "an empty dark set protects nothing while
      // looking exactly like one that protects everything."
      read: () => serve([{ claim: claim('UNGOVERNED STUB OUTPUT'), disclosure: 'READER_SAFE' }]),
    };
  }
  if (fixture === 'GOVERNED_READ_FAILING') {
    return { governed: true, read: () => empty('TEMPORARILY_UNAVAILABLE', 'TEMPORARILY_UNAVAILABLE') };
  }
  if (fixture === 'GOVERNED_EMPTY_FOR_GEOGRAPHY') {
    return { governed: true, read: () => empty('NO_DATA_FOR_GEOGRAPHY', 'NO_DATA_FOR_GEOGRAPHY') };
  }
  if (fixture === 'GOVERNED_MIXED_DISCLOSURE') {
    return {
      governed: true,
      read: (r) => {
        const rows = RETAINED_MIXED[r.countryIso3];
        return rows === undefined ? empty('NO_DATA_FOR_GEOGRAPHY', 'NO_DATA_FOR_GEOGRAPHY') : serve(rows);
      },
    };
  }
  if (fixture === 'GOVERNED_ALL_WITHHELD') {
    return { governed: true, read: () => serve(ALL_WITHHELD) };
  }
  return {
    governed: true,
    read: (r) => {
      const rows = RETAINED[r.countryIso3];
      return rows === undefined ? empty('NO_DATA_FOR_GEOGRAPHY', 'NO_DATA_FOR_GEOGRAPHY') : serve(rows);
    },
  };
}

/* ---- port-violation fixtures, used only by probes ---- */

/** A partially sourced answer: one sourced claim and one unsourced. Probe V-1. */
export const UNSOURCED_CLAIM_PORT: HumanitarianRetainedReadPort = {
  governed: true,
  read: () =>
    serve([
      { claim: claim('sourced assertion'), disclosure: 'READER_SAFE' },
      {
        claim: { claim: 'unsourced assertion', sources: [], scope: 'COUNTRY', asOfStated: null },
        disclosure: 'READER_SAFE',
      },
    ]),
};

/** A scope finer than the producible ceiling. Probe V-2. */
export const OVER_PRECISE_PORT: HumanitarianRetainedReadPort = {
  governed: true,
  read: (r) =>
    serve([
      {
        claim: {
          claim: 'site-level assertion',
          sources: [{ articleRef: 'retained:x', countryIso3: r.countryIso3 }],
          // Deliberately outside the union at runtime: a seam is not bound by a type.
          scope: 'SETTLEMENT' as unknown as 'COUNTRY',
          asOfStated: null,
        },
        disclosure: 'READER_SAFE',
      },
    ]),
};

/** AVAILABLE while holding nothing. Probe V-3. */
export const AVAILABLE_BUT_EMPTY_PORT: HumanitarianRetainedReadPort = {
  governed: true,
  read: () => serve([]),
};

/** A port that mislabels a canary claim as reader-safe. Probe DG-6. */
export const MISLABELLED_PORT: HumanitarianRetainedReadPort = {
  governed: true,
  read: () => serve([{ ...canaryClaim('PROTECTED_LOCATION'), disclosure: 'READER_SAFE' }]),
};
