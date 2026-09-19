/**
 * EUROSTAT MARKET SERIES — RIGHTS CARVE-OUTS, ENFORCED STRUCTURALLY
 *
 * G-MARKET-DATA-ACQUISITION-R2. ISOLATED. NOT INTEGRATED.
 *
 * ── THE FINDING THIS MODULE EXISTS TO ENFORCE ────────────────────────────
 *
 * G-MARKET-INTELLIGENCE-DATA-READINESS-R1 measured the Comext carve-outs and
 * NARROWED them: Liechtenstein as well as Switzerland, and Austria at CN8 only.
 * And it measured the thing that makes them a code problem rather than a prose one:
 *
 *   ALL THREE CARVE-OUTS KEY ON `reporter`,
 *   SO A FILTER ON `partner` ENFORCES NOTHING.
 *
 * `reporter` is the country whose statistical authority declared the flow.
 * `partner` is the country at the other end of it. A request for Germany's imports
 * FROM Switzerland has `reporter = DE` and `partner = CH`: excluding `partner = CH`
 * removes a row that was never carved out, and leaves every Swiss-declared row —
 * the ones that ARE carved out — untouched.
 *
 * The two mistakes this module makes impossible are therefore:
 *   1. documenting the carve-out instead of enforcing it, and
 *   2. enforcing it on the wrong dimension, which looks like enforcement and is not.
 */

import { AcquisitionRefusal } from './market-acquisition-declarations';

/** The Comext dimension tuple, in the publisher's own names. */
export interface ComextRequest {
  readonly freq: string;
  /** The declaring country. THIS is the carve-out axis. */
  readonly reporter: string;
  /** The counterparty country. NOT the carve-out axis. */
  readonly partner: string;
  /** CN product code. Its LENGTH is what distinguishes CN8 from coarser levels. */
  readonly product: string;
  readonly flow: string;
  readonly indicators: string;
}

export type CarveOutScope =
  | { readonly kind: 'ALL_PRODUCT_LEVELS' }
  /** Excluded only at this product-code length. Austria is CN8-only. */
  | { readonly kind: 'PRODUCT_CODE_LENGTH'; readonly length: number };

export interface ReporterCarveOut {
  /** The ISO code as it appears in the `reporter` dimension. */
  readonly reporter: string;
  readonly scope: CarveOutScope;
  readonly instrument: string;
}

/**
 * The carve-outs, as measured. This list is DATA consulted by the predicate below —
 * not a comment, and not a second list that a predicate ignores. That failure shape
 * ("the declared rule is data, the function a consumer calls does not consult it")
 * has been found four times in this programme and is refused here by construction:
 * the only exported entry point reads this array.
 */
export const COMEXT_REPORTER_CARVE_OUTS: readonly ReporterCarveOut[] = [
  {
    reporter: 'CH',
    scope: { kind: 'ALL_PRODUCT_LEVELS' },
    instrument:
      'Comext dissemination carve-out, verified in G-MARKET-INTELLIGENCE-DATA-READINESS-R1. Keys on `reporter`.',
  },
  {
    reporter: 'LI',
    scope: { kind: 'ALL_PRODUCT_LEVELS' },
    instrument:
      'Comext dissemination carve-out, NARROWED and added in G-MARKET-INTELLIGENCE-DATA-READINESS-R1 — Liechtenstein as well as Switzerland. Keys on `reporter`.',
  },
  {
    reporter: 'AT',
    scope: { kind: 'PRODUCT_CODE_LENGTH', length: 8 },
    instrument:
      'Comext dissemination carve-out, verified in G-MARKET-INTELLIGENCE-DATA-READINESS-R1 — Austria at CN8 ONLY, not at coarser product levels. Keys on `reporter`.',
  },
];

/**
 * The Eurostat grant excludes data on non-EU/EFTA countries. That exclusion also keys
 * on the declaring country, so it is enforced on `reporter` for the same reason.
 *
 * EU-27 plus the four EFTA states. `EU27_2020` and the euro-area aggregates are Eurostat's
 * own aggregate reporters and are admitted; an aggregate is not a non-EU/EFTA country.
 */
export const EUROSTAT_PERMITTED_REPORTERS: readonly string[] = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'EL',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'CH',
  'EU27_2020',
  'EA',
  'EA19',
  'EA20',
];

export interface CarveOutVerdict {
  readonly permitted: boolean;
  readonly reason: string;
  /** Always 'reporter' when a carve-out fires. Recorded so a test can assert the AXIS. */
  readonly axis: 'reporter' | 'none';
}

/**
 * The single entry point. Every Eurostat Comext request passes through it or it does not
 * go out — there is no second path, and no boolean that skips it.
 */
export function evaluateComextRequest(request: ComextRequest): CarveOutVerdict {
  if (!EUROSTAT_PERMITTED_REPORTERS.includes(request.reporter)) {
    return {
      permitted: false,
      axis: 'reporter',
      reason: `reporter '${request.reporter}' is outside EU/EFTA; the Eurostat grant excludes data on non-EU/EFTA countries`,
    };
  }
  for (const carveOut of COMEXT_REPORTER_CARVE_OUTS) {
    if (carveOut.reporter !== request.reporter) continue;
    if (carveOut.scope.kind === 'ALL_PRODUCT_LEVELS') {
      return {
        permitted: false,
        axis: 'reporter',
        reason: `reporter '${request.reporter}' is carved out at all product levels — ${carveOut.instrument}`,
      };
    }
    if (request.product.length === carveOut.scope.length) {
      return {
        permitted: false,
        axis: 'reporter',
        reason:
          `reporter '${request.reporter}' is carved out at product-code length ${carveOut.scope.length} ` +
          `(CN${carveOut.scope.length}); this request's product '${request.product}' is that length`,
      };
    }
  }
  return { permitted: true, axis: 'none', reason: 'no reporter-keyed carve-out applies' };
}

export function assertComextRequestIsPermitted(request: ComextRequest): void {
  const verdict = evaluateComextRequest(request);
  if (!verdict.permitted) {
    throw new AcquisitionRefusal(`RIGHTS_REFUSED: ${verdict.reason}`);
  }
}

/**
 * DELIBERATELY PRESENT, DELIBERATELY WRONG, AND NEVER EXPORTED AS ENFORCEMENT.
 *
 * This is the filter a reasonable implementer writes when they have read the carve-out
 * list and not the dimension it keys on. It is kept so that a test can DEMONSTRATE it
 * letting a carved-out row through, rather than the package merely asserting that it would.
 *
 * It is not called by `assertComextRequestIsPermitted` and must never be.
 */
export function partnerBasedFilter_DO_NOT_USE(request: ComextRequest): boolean {
  const excluded = COMEXT_REPORTER_CARVE_OUTS.map((c) => c.reporter);
  return !excluded.includes(request.partner);
}
