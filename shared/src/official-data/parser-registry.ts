import type { SnapshotRefusalKey } from './snapshot-admission';
import { parseStrictJson } from './json-strict';
/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE PARSER REGISTRY — SERVER-OWNED PARSER IDENTITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-OFFICIAL-DATA-CANONICAL-ADMISSION-R1 · §3.
 *
 * ── THE CIRCULARITY THIS BREAKS ───────────────────────────────────────────
 *
 * G identified it exactly: an adapter must not assert its own `parserId` /
 * `parserVersion` and then use those same assertions to justify its own admission.
 * `SnapshotAdmissionRecord.parse` is a claim about WHO parsed the bytes and WITH WHICH
 * VERSION, and an adapter making that claim about itself is the parser vouching for the
 * parser. E1 · P-4 says the version is what makes a parser upgrade detectable after the
 * fact — which it can only be if something other than the parser records it.
 *
 * So the binding is declared HERE, in a frozen server-owned table, and an adapter
 * CONSUMES it. The registry answers one question — "for this governed provider,
 * endpoint and media type, which approved parser is authorised?" — and the answer is
 * either a binding or nothing.
 *
 * ── NO FALLBACK PARSER, AND WHY THAT IS THE IMPORTANT HALF ────────────────
 *
 * There is no default, no wildcard row and no "generic JSON" binding. An unknown
 * combination resolves to `null` and the evaluator refuses the capture.
 *
 * A fallback would be the whole control undone in one line. The registry exists so that
 * bytes from an endpoint nobody has reviewed cannot be admitted; a generic parser that
 * accepts them means every unreviewed endpoint is admissible by default, and the table
 * becomes documentation rather than a gate.
 */

/** What the bytes must structurally exhibit for this provider. E1 · §4.4, step 10. */
export type EnvelopeAssertion<T = unknown> = (parsed: T) => true | string;

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * ALPHA MAJOR CONVERGENCE R1 — THE PARSER DISPATCH CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * MAIN'S RULING A, LANDED. The binding now carries the DECODE OPERATION
 * ITSELF, not merely a media-type label beside an envelope assertion.
 *
 * WHAT WAS WRONG BEFORE, AND IT WAS A TYPE-LEVEL HOLE RATHER THAN A BUG. The
 * evaluator hardwired `parseStrictJson(decoded)` at step 9 and then handed the
 * result to `binding.assertEnvelope`. The binding declared a `mediaType`, so it
 * could SAY `application/pdf` — and the evaluator would still have run the JSON
 * decoder over the bytes and then asserted a PDF envelope against a JSON value.
 * Nothing in the type system objected, because `assertEnvelope` took `unknown`.
 * A media type that the pipeline could name but could not honour is a label,
 * not a gate.
 *
 * THE TWO INVARIANTS THIS SHAPE ENFORCES AT COMPILE TIME:
 *
 *   1. A BINDING WITH NO DECODER DOES NOT COMPILE. `decode` is required, so the
 *      pre-convergence binding literal — parserId, parserVersion, mediaType,
 *      assertEnvelope — is now a type error. There is no binding that the
 *      evaluator must guess how to read.
 *
 *   2. A PDF BINDING WIRED TO `parseStrictJson` DOES NOT COMPILE. `ParserBinding`
 *      is generic in the decoded type `T`, and `decode` and `assertEnvelope` are
 *      tied to the SAME `T`. `parseStrictJson` produces
 *      `ArtifactDecodeResult<unknown>`; a PDF row is `ParserBinding<PdfTableExtract>`
 *      and needs `ArtifactDecoder<PdfTableExtract>`. `unknown` is not assignable
 *      to `PdfTableExtract`, so the crossed wiring is rejected by the compiler
 *      rather than by a runtime check nobody runs.
 *
 * Both are proved, as compilations that must fail, in
 * `parser-dispatch-mutation.spec.ts`.
 *
 * THE JSON PATH IS BYTE-IDENTICAL. `parseStrictJson` already returns
 * `{ ok: true, value: unknown, ... }` / `{ ok: false, refusalKey, detail, ... }`,
 * which satisfies `ArtifactDecoder<unknown>` WITH NO CHANGE TO THAT FUNCTION.
 * The JSON rows below simply name it. Same bytes, same refusal keys, same
 * offsets, same `lexicalNumberTokens` reaching the record.
 *
 * NO DOMAIN PARSING LIVES HERE. A decoder turns bytes into the KIND OF THING
 * the endpoint returns — a JSON value, a table extract. What the numbers MEAN
 * stays with Economy and Market, and no provider-specific extraction belongs in
 * the generic evaluator.
 */

/**
 * The result of turning retained bytes into a typed artifact.
 *
 * Deliberately shaped like `StrictJsonResult` so the landed strict-JSON decoder
 * satisfies it unchanged, and deliberately carrying a `SnapshotRefusalKey` so a
 * decoder refuses in the SAME vocabulary every other step refuses in — a new
 * media type cannot invent its own failure language.
 */
export type ArtifactDecodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly refusalKey: SnapshotRefusalKey; readonly detail: string };

/** Bytes in, typed artifact out. The step the evaluator used to hardwire. */
export type ArtifactDecoder<T> = (decoded: Uint8Array) => ArtifactDecodeResult<T>;

export interface ParserBinding<T = unknown> {
  readonly parserId: string;
  readonly parserVersion: string;
  /**
   * The media type this binding is authorised for. Adding a second type is a NEW
   * ROW with its own decoder — E1 · §1, "adding a media type is an amendment
   * with its own per-type row, not a config change". The row now has to SUPPLY
   * that decoder, which is what makes the rule structural.
   */
  readonly mediaType: string;
  /**
   * The decode operation for THIS media type. Required: a row that cannot say
   * how its bytes become a value is not a governed row.
   */
  readonly decode: ArtifactDecoder<T>;
  /** Asserted against the decoder's OWN output type, never against `unknown`. */
  readonly assertEnvelope: EnvelopeAssertion<T>;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ENVELOPE ASSERTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * E1 · §4.4: "a body may be valid JSON and still be nothing to do with the request."
 * Each assertion states the MINIMAL structural facts, and each returns a CLASSIFIED
 * reason string rather than a message built from provider text (E1 · C-4).
 *
 * They are deliberately minimal. This is the admission gate, not the domain parser: it
 * establishes that the body is the KIND OF THING the endpoint returns. What the numbers
 * mean is Economy's and Market's business, and E1 explicitly leaves it to them.
 */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Eurostat JSON-stat. The three facts E1 names — `value`, `dimension`, `id` — plus the
 * `class` discriminator JSON-stat itself defines.
 *
 * `value` must be PRESENT but may be empty: an empty `value` is a real Eurostat state
 * (a retired dataset code answers 200 with `value: {}`) and it is a DOMAIN failure, not
 * an admission one. Refusing it here would classify a correctly-delivered, correctly-
 * shaped response as a content-security refusal, which is the wrong vocabulary and the
 * wrong retry semantics. The adapter already refuses it on its own terms.
 */
export const assertEurostatJsonStatEnvelope: EnvelopeAssertion = (parsed) => {
  if (!isRecord(parsed)) return 'ENVELOPE_NOT_AN_OBJECT';
  if (parsed['class'] !== 'dataset') return 'ENVELOPE_CLASS_NOT_DATASET';
  if (!isRecord(parsed['value'])) return 'ENVELOPE_MISSING_VALUE';
  if (!isRecord(parsed['dimension'])) return 'ENVELOPE_MISSING_DIMENSION';
  if (!Array.isArray(parsed['id'])) return 'ENVELOPE_MISSING_ID';
  return true;
};

/** TED notices search: a result envelope with a collection and a total. */
export const assertTedNoticesEnvelope: EnvelopeAssertion = (parsed) => {
  if (!isRecord(parsed)) return 'ENVELOPE_NOT_AN_OBJECT';
  const notices = parsed['notices'];
  if (!Array.isArray(notices)) return 'ENVELOPE_MISSING_NOTICES';
  if (typeof parsed['totalNoticeCount'] !== 'number') return 'ENVELOPE_MISSING_TOTAL';
  return true;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * THE TABLE
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * How an endpoint identifier is matched.
 *
 * Eurostat's endpoint id is a DATASET CODE, so the set is open by nature and cannot be
 * enumerated. The shape is therefore declared as a pattern — but the pattern lives HERE,
 * in the server-owned table, not in the adapter. An adapter still cannot widen what it
 * is allowed to fetch; it can only present a code that the governed pattern either
 * recognises or does not.
 *
 * The pattern is anchored and narrow on purpose: Eurostat dataset codes are lowercase
 * alphanumerics and underscores, and anything else is not a dataset code.
 */
interface ParserRegistryRow {
  readonly providerId: string;
  readonly endpointMatches: (endpointId: string) => boolean;
  readonly binding: ParserBinding;
}

const EUROSTAT_DATASET_CODE = /^[a-z0-9_]{3,40}$/;

const REGISTRY: readonly ParserRegistryRow[] = Object.freeze([
  {
    providerId: 'EUROSTAT',
    endpointMatches: (endpointId: string) => EUROSTAT_DATASET_CODE.test(endpointId),
    binding: Object.freeze({
      parserId: 'eurostat.jsonstat',
      parserVersion: '1.0.0',
      mediaType: 'application/json',
      /* The LANDED strict decoder, named rather than reimplemented. Same bytes,
         same refusal keys, same offsets — see the dispatch note above. */
      decode: parseStrictJson,
      assertEnvelope: assertEurostatJsonStatEnvelope,
    }),
  },
  {
    providerId: 'TED',
    endpointMatches: (endpointId: string) => endpointId === 'notices/search',
    binding: Object.freeze({
      parserId: 'ted.notices',
      parserVersion: '1.0.0',
      mediaType: 'application/json',
      decode: parseStrictJson,
      assertEnvelope: assertTedNoticesEnvelope,
    }),
  },
]);

/**
 * Resolve the authorised parser for a governed request, or `null`.
 *
 * `null` is not an error condition to be handled leniently — it is the answer "no
 * approved parser is authorised for this", and the evaluator turns it into a refusal.
 * Returning `null` rather than throwing keeps the decision with the one component
 * allowed to make it.
 *
 * The media type is compared on its TYPE ONLY, with parameters ignored, because
 * `mediaTypeIsAdmitted` has already adjudicated the parameters (charset) by the time
 * this is called. Re-adjudicating them here would be a second classifier.
 */
export function resolveParserBinding(
  providerId: string,
  endpointId: string,
  contentTypeHeader: string,
): ParserBinding | null {
  const mediaType = (contentTypeHeader.split(';')[0] ?? '').trim().toLowerCase();

  for (const row of REGISTRY) {
    if (row.providerId !== providerId) continue;
    if (!row.endpointMatches(endpointId)) continue;
    if (row.binding.mediaType !== mediaType) continue;
    return row.binding;
  }
  return null;
}

/** Every provider with at least one authorised binding. For tests and admin surfaces. */
export function registeredParserProviders(): readonly string[] {
  return Object.freeze([...new Set(REGISTRY.map((r) => r.providerId))]);
}
