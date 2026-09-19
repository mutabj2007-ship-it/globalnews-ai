import {
  CanonicalOfficialDataAdmissionEvaluator,
  normaliseContentEncoding,
  type AdmissionOutcome,
  type OfficialDataTransportEvidence,
  type SnapshotAdmissionRecord,
} from '@globalnews-ai/shared';

import type {
  CanonicalAdmissionEvaluator,
  SnapshotAdmissionSubject,
} from '../market-ingest/adapters/market-snapshot.seam';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE ONE PRODUCTION IMPLEMENTATION OF G'S ADMISSION SEAM
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-OFFICIAL-DATA-CANONICAL-ADMISSION-R1 · §6.
 *
 * G declared `CanonicalAdmissionEvaluator` as a TYPED HOLE and, correctly, implemented
 * nothing: an adapter composing its own verdict out of the ingredients is the parser
 * vouching for the parser. This fills the hole with the canonical evaluator and adds no
 * judgement of its own.
 *
 * ── WHAT THIS CLASS IS ALLOWED TO DO, AND WHAT IT IS NOT ──────────────────
 *
 * It TRANSLATES a Market subject into canonical transport evidence. That is all. It
 * contains no threshold, no allowlist, no refusal key and no notion of admissibility —
 * search this file for `ADMITTED` and the only occurrence is in a comment saying it must
 * not appear. Every rule lives in the shared evaluator, so Market and Economy reach
 * identical verdicts on identical bytes because they are asking the same object.
 *
 * ── THE ONE THING WORTH ARGUING ABOUT ─────────────────────────────────────
 *
 * `decodedBytes` is set to the WIRE BYTES here, not to a decoded body. That looks wrong
 * and is deliberate: the evaluator performs its own bounded decode from `wireBytes`, and
 * `decodedBytes` is only its fallback for the refusal path, where the bytes are retained
 * as received. Supplying a decode here would put a second decompressor in the pipeline —
 * one whose caps nobody checks — which is precisely the second-classifier problem in a
 * different costume.
 */
export class MarketCanonicalAdmissionBinding implements CanonicalAdmissionEvaluator {
  constructor(
    private readonly evaluator: CanonicalOfficialDataAdmissionEvaluator,
    /**
     * Where each governed provider is allowed to have come from.
     *
     * Resolved from configuration, NEVER from the response — deriving the expected host
     * from the URL that answered would make step 1 a tautology that passes for every
     * redirect target in the world.
     */
    private readonly resolveConfiguredHost: (providerId: string) => string | undefined,
    private readonly now: () => string,
  ) {}

  /** The full outcome, for callers that need the parse or the quarantine flag. */
  evaluateFully(subject: SnapshotAdmissionSubject): AdmissionOutcome {
    return this.evaluator.evaluate(this.toEvidence(subject));
  }

  /**
   * G's interface. Returns the verdict alone, which is all an adapter is entitled to.
   *
   * Async to satisfy the declared seam even though the evaluation is synchronous: the
   * seam was typed as a promise because a real one may do I/O, and narrowing someone
   * else's contract to match an implementation detail of mine is the wrong direction.
   */
  async evaluate(subject: SnapshotAdmissionSubject): Promise<SnapshotAdmissionRecord> {
    return this.evaluateFully(subject).admission;
  }

  private toEvidence(subject: SnapshotAdmissionSubject): OfficialDataTransportEvidence {
    const encoding = normaliseContentEncoding(subject.contentEncodingHeader);
    const at = this.now();

    /*
      An unknown provider yields an empty configured host, which cannot equal any real
      final host, so step 1 refuses with PROVENANCE_HOST_MISMATCH. Failing closed on a
      provider nobody configured is the correct direction: the alternative is skipping
      the provenance check for exactly the providers least likely to be governed.
    */
    const configuredHost = this.resolveConfiguredHost(subject.providerId) ?? '';

    return {
      providerId: subject.providerId,
      endpointId: subject.endpointId,
      finalUrl: subject.finalUrl,
      configuredHost,
      redirectChain: [],
      httpStatus: subject.httpStatus,
      requestedAt: at,
      retrievedAt: at,
      contentTypeHeader: subject.contentTypeHeader,
      contentEncoding: encoding.contentEncoding,
      contentEncodingHeaderPresent: encoding.present,
      wireByteLength: subject.wireBytes.byteLength,
      wireBytes: subject.wireBytes,
      decodedBytes: subject.wireBytes,
      headers: {},
    };
  }
}
