/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE CANONICAL ADMISSION EVALUATOR — ONE AUTHORITY, ONE PATH
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-OFFICIAL-DATA-CANONICAL-ADMISSION-R1 · §2.
 *
 * This is the ONLY thing in the system that produces a `SnapshotAdmissionRecord`.
 *
 * ── WHY "ONLY" IS THE WHOLE POINT ─────────────────────────────────────────
 *
 * The admission record is what stands between bytes and a published figure. If two
 * components can produce one, then the system's answer to "may this be published?"
 * depends on WHICH COMPONENT ASKED — and the divergence appears the first time somebody
 * fixes a rule in one of them. G found this concretely in the Market lane: a refusal
 * class re-derived from the HTTP status disagreed with the class the evaluator recorded,
 * and the two verdicts sat next to each other in the same file.
 *
 * So every rule below runs HERE and nowhere else, and the pipeline's other layers
 * consume the verdict rather than forming one.
 *
 * ── THE ORDER IS E1 · §4, AND THE ORDER IS LOAD-BEARING ───────────────────
 *
 *    1  final URL host == configured provider host   else  PROVENANCE_HOST_MISMATCH
 *    2  HTTP status == 200                           else  STATUS_NOT_OK (classified)
 *    3  media type in allowlist                      else  MEDIA_TYPE_NOT_ALLOWED
 *    4  charset absent or utf-8                      else  CHARSET_NOT_ALLOWED
 *    5  Content-Encoding in {identity, gzip}         else  ENCODING_NOT_ALLOWED
 *    6  wire bytes <= cap                            else  SIZE_EXCEEDED
 *    7  decode; decoded <= cap; ratio <= 20:1        else  DECOMPRESSION_BOUND_EXCEEDED
 *    8  leading-byte refusal sniff                   else  BODY_NOT_JSON_SHAPED / ARCHIVE
 *    8b governed parser binding resolves             else  ENVELOPE_NOT_RECOGNISED
 *    9  strict parse, once                           else  PARSE_FAILED
 *   10  provider envelope assertion                  else  ENVELOPE_NOT_RECOGNISED
 *   11  secret scan over the retained bytes          else  QUARANTINE
 *   =>  ADMITTED
 *
 * Steps 6 and 7 come before any parse because a decompression bomb must be refused on
 * its COMPRESSED size, before expansion. Step 11 comes last because it scans the bytes
 * that would actually be retained — including the bytes of a body already refused, which
 * is E1 · C-3's finding: a refused error body is exactly where our own credential comes
 * to rest, and refusing it for another reason first does not make it safe to store.
 *
 * ── DEFAULT DENY, STRUCTURALLY ────────────────────────────────────────────
 *
 * `admissibility` is only ever `'ADMITTED'` at ONE return statement, at the very bottom,
 * reachable only by falling through every gate. There is no path where the ABSENCE of a
 * refusal produces admission — E1 · S-1 — because the value is not initialised to
 * anything and every early return names its own refusal.
 */

import {
  ALPHA_ADMITTED_CHARSETS,
  ALPHA_ADMITTED_MEDIA_TYPES,
  assertAdmissionRecordIsCoherent,
  mediaTypeIsAdmitted,
  refusalClassFor,
  sniffRefusal,
  SNAPSHOT_WIRE_BYTE_CAP,
  type SnapshotAdmissionRecord,
  type SnapshotRefusalKey,
} from './snapshot-admission';
import { parseStrictJson, type LexicalNumberToken } from './json-strict';
import { resolveParserBinding, type ParserBinding } from './parser-registry';
import {
  contentEncodingIsAdmitted,
  decodePermittedEncoding,
  type GunzipFn,
  type OfficialDataTransportEvidence,
} from './transport';

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · SECRET SCANNING — E1 · C-3
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * "Provider error bodies frequently echo the request — including our own API key. So
 * the very thing §2 permits us to retain for audit is a place our own credentials can
 * come to rest, indefinitely, in a table nobody thinks of as secret-bearing."
 */

export interface SecretScanConfig {
  /**
   * The configured secret VALUES for this deployment. Compared literally.
   *
   * Passed in rather than read from the environment here: `shared` has no environment,
   * and a scanner that reaches for one would be untestable and would differ between the
   * places it runs.
   */
  readonly configuredSecrets: readonly string[];
}

/**
 * Credential-SHAPED patterns, for the secrets nobody configured.
 *
 * Deliberately conservative. A false positive quarantines a capture — bytes are not
 * stored and rotation is flagged — which is disruptive, so these match shapes that are
 * credentials or nothing: an `Authorization` header echoed into a body, a bearer token,
 * an AWS key id, a PEM private key block.
 */
const CREDENTIAL_SHAPED = [
  /\bauthorization\b\s*[:=]\s*["']?(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /\bbearer\s+[A-Za-z0-9._~+/-]{20,}={0,2}/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  /\b(?:api[_-]?key|apikey|client[_-]?secret|x-clientid)\b\s*[:=]\s*["']?[A-Za-z0-9._~+/-]{16,}/i,
] as const;

export interface SecretScanResult {
  readonly hit: boolean;
  /**
   * WHICH RULE fired, never what it matched. E1 · C-4 — the matched text is the secret,
   * so reporting it would put the credential in the audit trail the scan exists to keep
   * clean. `configuredSecrets[2]` identifies the secret to rotate without printing it.
   */
  readonly rule?: string;
}

export function scanForSecrets(bytes: Uint8Array, config: SecretScanConfig): SecretScanResult {
  /*
    Decoded LENIENTLY, and that is correct here even though the parser decodes strictly.

    The scan must work on bytes that are not valid UTF-8 — an invalid body is refused,
    but it is also RETAINED, so it still has to be checked before it is stored. A fatal
    decoder would throw and skip the scan on exactly the captures least likely to be
    well-formed.
  */
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

  for (let i = 0; i < config.configuredSecrets.length; i += 1) {
    const secret = config.configuredSecrets[i];
    // An empty or trivially short configured value would match everything. Guarded so a
    // misconfiguration cannot quarantine every capture in the system.
    if (secret === undefined || secret.length < 8) continue;
    if (text.includes(secret)) return { hit: true, rule: `configuredSecrets[${i}]` };
  }

  for (let i = 0; i < CREDENTIAL_SHAPED.length; i += 1) {
    if (CREDENTIAL_SHAPED[i]!.test(text)) return { hit: true, rule: `credentialShaped[${i}]` };
  }

  return { hit: false };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · CONTENT-TYPE CLASSIFICATION
 * ═══════════════════════════════════════════════════════════════════════════ */

export type ContentTypeVerdict = 'OK' | 'MEDIA_TYPE_NOT_ALLOWED' | 'CHARSET_NOT_ALLOWED';

/**
 * E1 · T-1 requires the media type and the charset to refuse under THEIR OWN KEYS —
 * `application/json; charset=iso-8859-1` is a charset refusal, not a media-type one,
 * and an operator reading the audit row needs to know which.
 *
 * `mediaTypeIsAdmitted` answers only yes/no, so this states the split. It is NOT a
 * second classifier: a test asserts that for every input, `classifyContentType(x) ===
 * 'OK'` exactly when `mediaTypeIsAdmitted(x)` is true. The two can never disagree
 * without that test failing, which is what keeps one governed evaluation path while
 * still producing the two keys E1 asks for.
 */
export function classifyContentType(contentTypeHeader: string): ContentTypeVerdict {
  const [rawType, ...params] = contentTypeHeader.split(';');
  const type = (rawType ?? '').trim().toLowerCase();

  if (!(ALPHA_ADMITTED_MEDIA_TYPES as readonly string[]).includes(type)) {
    return 'MEDIA_TYPE_NOT_ALLOWED';
  }

  for (const p of params) {
    const [k, v] = p.split('=');
    if (k === undefined || v === undefined) return 'CHARSET_NOT_ALLOWED';
    if (k.trim().toLowerCase() !== 'charset') continue;
    const charset = v.trim().toLowerCase().replace(/^"|"$/g, '');
    if (!(ALPHA_ADMITTED_CHARSETS as readonly string[]).includes(charset)) {
      return 'CHARSET_NOT_ALLOWED';
    }
  }
  return 'OK';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · THE OUTCOME
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface AdmissionOutcome {
  /** The verdict. The single thing `retain()` requires and the pipeline's only authority. */
  readonly admission: SnapshotAdmissionRecord;

  /**
   * The decoded bytes, or `undefined` when they MUST NOT BE RETAINED.
   *
   * `undefined` is returned for exactly one reason: a secret was found. §5 — "never
   * hash/store known secret-bearing bytes just to produce evidence". Withholding them
   * here rather than asking the caller to remember means a caller that forgets cannot
   * store them, because it does not have them.
   */
  readonly retainableBytes?: Uint8Array;

  /** The parse, when one succeeded. E1 · P-1 — parse once; downstream reuses this. */
  readonly parsed?: unknown;
  readonly lexicalNumberTokens?: readonly LexicalNumberToken[];

  /** Set when the capture is quarantined, so the caller can flag rotation. E1 · C-3. */
  readonly secretRotationRequired?: boolean;
  readonly secretRule?: string;

  /** A classified, non-interpolated reason for the audit row. E1 · C-4. */
  readonly detail?: string;
}

export interface CanonicalAdmissionEvaluatorConfig {
  readonly gunzip: GunzipFn;
  readonly secrets: SecretScanConfig;
  /** Supplied by the caller so the record is deterministic under test. */
  readonly now: () => string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · THE EVALUATOR
 * ═══════════════════════════════════════════════════════════════════════════ */

export class CanonicalOfficialDataAdmissionEvaluator {
  constructor(private readonly config: CanonicalAdmissionEvaluatorConfig) {}

  evaluate(evidence: OfficialDataTransportEvidence): AdmissionOutcome {
    const { httpStatus, wireByteLength } = evidence;

    /*
      The transport evidence is the ONLY input. Note what is absent from this signature:
      no provider adapter, no caller-supplied media type, no caller-supplied parser
      identity, and no way to pass a verdict in. An adapter cannot influence the outcome
      except by having performed a different request.
    */

    // Every refusal shares this. `captureOutcome` is COMPLETE because the CAPTURE
    // succeeded — bytes arrived. Whether they may be USED is `admissibility`, and E1 · §2
    // is emphatic that the two are independent: "a failed capture is excellent evidence
    // of what was received and no evidence at all of what was meant".
    const transportEvidence = {
      contentEncoding: contentEncodingIsAdmitted(evidence.contentEncoding)
        ? evidence.contentEncoding
        : ('identity' as const),
      wireByteLength,
    };

    /**
     * The quarantine outcome. `retainableBytes` is OMITTED — the caller does not get
     * the bytes at all, so a caller that forgets the rule still cannot store them.
     */
    const quarantine = (rule: string | undefined, priorDetail: string): AdmissionOutcome => {
      const admission: SnapshotAdmissionRecord = {
        captureOutcome: 'COMPLETE',
        admissibility: 'REFUSED',
        refusalKey: 'SECRET_DETECTED',
        // PERMANENT, and the contract enforces it: SNAP-R2-SEC-B-1 throws if a security
        // key is recorded any other way. Retrying re-fetches a body already known to
        // contain our own credential.
        refusalClass: 'PERMANENT',
        transport: transportEvidence,
      };
      assertAdmissionRecordIsCoherent(admission, httpStatus);
      return {
        admission,
        retainableBytes: undefined,
        secretRotationRequired: true,
        secretRule: rule,
        detail: priorDetail,
      };
    };

    /*
      EVERY REFUSAL IS SCANNED BEFORE ITS BYTES ARE OFFERED BACK.

      E1 · C-3 is explicit that the scan covers "every retained body — ESPECIALLY a
      REFUSED one", and the reason is precise: provider ERROR bodies are the ones that
      echo the request, so the refused capture is the likeliest place our own credential
      comes to rest. An earlier draft of this function returned the bytes for every
      refusal without scanning them, which would have stored exactly the bodies the
      control exists for.

      SECRET_DETECTED WINS over whatever else was wrong with the body. A malformed body
      containing a credential is reported as a quarantine, with the original reason kept
      in `detail`: the parse failure is recoverable information, and writing the
      credential to disk is not.
    */
    const refuse = (refusalKey: SnapshotRefusalKey, detail: string): AdmissionOutcome => {
      const candidate = evidence.decodedBytes;
      const secret = scanForSecrets(candidate, this.config.secrets);
      if (secret.hit) return quarantine(secret.rule, `${detail}+SECRET_DETECTED`);

      const admission: SnapshotAdmissionRecord = {
        captureOutcome: 'COMPLETE',
        admissibility: 'REFUSED',
        refusalKey,
        refusalClass: refusalClassFor(refusalKey, httpStatus),
        transport: transportEvidence,
      };
      // Checked against the contract's own coherence rules before it leaves. A verdict
      // this evaluator cannot itself justify does not get to exist.
      assertAdmissionRecordIsCoherent(admission, httpStatus);
      return { admission, detail, retainableBytes: candidate };
    };

    /* ── STEP 1 · PROVENANCE ───────────────────────────────────────────── */
    /*
      E1 · §4.1. "A body that is perfectly well-formed JSON from the wrong host is the
      most dangerous admissible-looking capture there is." Checked FIRST, because every
      later step would pass on it.
    */
    const finalHost = hostOf(evidence.finalUrl);
    if (finalHost === null || finalHost !== evidence.configuredHost.toLowerCase()) {
      return refuse('PROVENANCE_HOST_MISMATCH', 'FINAL_HOST_NOT_CONFIGURED_HOST');
    }

    /* ── STEP 2 · STATUS ───────────────────────────────────────────────── */
    /*
      E1 · §4.2 — HTTP 200 IS NOT SUCCESS, and the class is a function of the status:
      404 PERMANENT, 503 TRANSIENT. `refusalClassFor` owns that, which is why the status
      is threaded into `refuse` rather than classified here.
    */
    if (httpStatus !== 200) {
      return refuse('STATUS_NOT_OK', `HTTP_${httpStatus}`);
    }

    /* ── STEPS 3 AND 4 · MEDIA TYPE AND CHARSET ────────────────────────── */
    const contentType = classifyContentType(evidence.contentTypeHeader);
    if (contentType !== 'OK') {
      return refuse(contentType, contentType);
    }

    /* ── STEP 5 · CONTENT-ENCODING ─────────────────────────────────────── */
    /*
      `evidence.contentEncoding` was normalised by the TRANSPORT: an absent header is
      already `identity` by the canonical rule. Nothing is defaulted here, which is the
      §1 requirement — the guess would otherwise happen at this line, in a component that
      never saw the header.
    */
    if (!contentEncodingIsAdmitted(evidence.contentEncoding)) {
      return refuse('ENCODING_NOT_ALLOWED', 'ENCODING_NOT_IN_ALLOWLIST');
    }

    /* ── STEP 6 · WIRE CAP ─────────────────────────────────────────────── */
    /*
      The declared length and the actual octets must agree. A transport reporting a
      length that does not match what it handed over is not a cap violation — it is a
      broken measurement, and admitting bytes on the strength of it would mean the
      evidence and the artefact describe different things.
    */
    if (wireByteLength !== evidence.wireBytes.byteLength) {
      return refuse('SIZE_EXCEEDED', 'WIRE_LENGTH_DISAGREES_WITH_BYTES');
    }
    if (wireByteLength > SNAPSHOT_WIRE_BYTE_CAP) {
      return refuse('SIZE_EXCEEDED', 'WIRE_CAP_EXCEEDED');
    }

    /* ── STEP 7 · DECODE UNDER BOUNDS, BY THE AUTHORITY ────────────────── */
    /*
      The evaluator decodes FROM THE WIRE BYTES rather than trusting the transport's
      `decodedBytes`, using the same `decodePermittedEncoding` the transport used. Same
      function, same caps, deterministic — so the two can never disagree, and a
      transport that skipped a bound cannot smuggle an expanded body past this point.

      This is where T-7 and T-8 land: the ratio bound is passed into the decompressor as
      its output limit, so the abort happens DURING expansion rather than after it.
    */
    const decodeOutcome = decodePermittedEncoding(
      evidence.wireBytes,
      evidence.contentEncoding,
      this.config.gunzip,
    );
    if (!decodeOutcome.ok) {
      return refuse(decodeOutcome.refusalKey, decodeOutcome.detail);
    }
    const decoded = decodeOutcome.decodedBytes;

    /* ── STEP 8 · THE LEADING-BYTE SNIFF ───────────────────────────────── */
    /*
      E1 · §4.3. Used in ONE DIRECTION ONLY — it can refuse and can never admit. This is
      where T-3, the headline case, is caught: HTTP 200 + application/json + an HTML
      error page body.
    */
    const sniffed = sniffRefusal(decoded, (evidence.contentTypeHeader.split(';')[0] ?? '').trim().toLowerCase());
    if (sniffed !== null) {
      return refuse(sniffed, `SNIFF_${sniffed}`);
    }

    /* ── STEP 8b · THE GOVERNED PARSER BINDING ─────────────────────────── */
    /*
      §3 — the adapter does not mint this. Resolved before the parse, because an
      unbound endpoint must not be parsed at all: parsing it would be this process
      deciding, by default, that an unreviewed endpoint is the kind of thing it knows
      how to read.
    */
    const binding: ParserBinding | null = resolveParserBinding(
      evidence.providerId,
      evidence.endpointId,
      evidence.contentTypeHeader,
    );
    if (binding === null) {
      return refuse('ENVELOPE_NOT_RECOGNISED', 'NO_GOVERNED_PARSER_BINDING');
    }

    /* ── STEP 9 · DECODE, ONCE, THROUGH THE BINDING ────────────────────── */
    /*
      ALPHA MAJOR CONVERGENCE R1 — this used to read `parseStrictJson(decoded)`.
      The decoder is now supplied BY THE ROW, so the media type a binding claims
      and the operation actually performed on the bytes cannot disagree. For the
      two JSON rows `binding.decode` IS `parseStrictJson`, so this line is
      byte-identical in behaviour for every capture Alpha performs today.

      Still exactly once. E1 · P-1 is unchanged: downstream reuses this result.
    */
    const parse = binding.decode(decoded);
    if (!parse.ok) {
      return refuse(parse.refusalKey, parse.detail);
    }

    /* ── STEP 10 · THE ENVELOPE ────────────────────────────────────────── */
    const envelope = binding.assertEnvelope(parse.value);
    if (envelope !== true) {
      return refuse('ENVELOPE_NOT_RECOGNISED', envelope);
    }

    /* ── STEP 11 · SECRET SCAN, AND THE QUARANTINE ─────────────────────── */
    /*
      Last, and over the bytes that would ACTUALLY BE RETAINED.

      `retainableBytes` is omitted from the result, so the caller does not merely know it
      should not store them — IT DOES NOT HAVE THEM. E1 · C-3: "redacting after storage
      is not a control; the bytes were already written."
    */
    const secret = scanForSecrets(decoded, this.config.secrets);
    if (secret.hit) return quarantine(secret.rule, 'SECRET_DETECTED');

    /* ── ADMITTED · THE ONLY PLACE ─────────────────────────────────────── */
    const admission: SnapshotAdmissionRecord = {
      captureOutcome: 'COMPLETE',
      admissibility: 'ADMITTED',
      transport: transportEvidence,
      // E1 · P-4/P-5. The identity comes from the REGISTRY, never from the adapter, and
      // `parsedAt` is stamped by the authority that actually did the parse.
      parse: {
        parserId: binding.parserId,
        parserVersion: binding.parserVersion,
        parsedAt: this.config.now(),
      },
    };
    assertAdmissionRecordIsCoherent(admission, httpStatus);

    return {
      admission,
      retainableBytes: decoded,
      parsed: parse.value,
      /*
        ALPHA MAJOR CONVERGENCE R1 — read through a NARROWING GUARD rather than
        off the generic result.

        `lexicalNumberTokens` is a fidelity artifact of the STRICT JSON decoder:
        it records the exact number tokens as they appeared in the text, so a
        downstream numeric model never has to trust a float round-trip. It is
        meaningless for a table extract or any other media class.

        Putting it on `ArtifactDecodeResult<T>` would make every future decoder
        pretend to a JSON-only concept, which is the same category error as the
        crossed envelope this dispatch contract exists to forbid. So the generic
        result stays pure and the evaluator ASKS whether this decoder happened to
        produce them. A decoder that does not is simply absent from the field,
        which the record already allows — `lexicalNumberTokens` is optional.
      */
      lexicalNumberTokens: lexicalNumberTokensOf(parse),
    };
  }
}

/**
 * Reads the strict-JSON decoder's lexical number tokens when the decoder that ran
 * produced them, and `undefined` otherwise.
 *
 * A structural check, not a cast: it asks whether the value carries the field with
 * the right shape. A decoder for another media class simply does not, and gets
 * `undefined` without the evaluator knowing which decoder ran.
 */
function lexicalNumberTokensOf(result: {
  readonly ok: true;
  readonly value: unknown;
}): readonly LexicalNumberToken[] | undefined {
  const candidate = (result as { readonly lexicalNumberTokens?: unknown }).lexicalNumberTokens;
  return Array.isArray(candidate) ? (candidate as readonly LexicalNumberToken[]) : undefined;
}

/** Lowercased host, or `null` when the URL will not parse — which is itself a mismatch. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * A guard for the one thing a consumer might still get wrong.
 *
 * `mediaTypeIsAdmitted` and `classifyContentType` must agree. Exported so the assertion
 * can be made in a test rather than trusted, and so any future caller that needs the
 * boolean form gets the same answer the evaluator acted on.
 */
export function contentTypeClassifiersAgree(contentTypeHeader: string): boolean {
  return (classifyContentType(contentTypeHeader) === 'OK') === mediaTypeIsAdmitted(contentTypeHeader);
}
