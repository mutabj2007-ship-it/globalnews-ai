import { Injectable } from '@nestjs/common';

import {
  makeNisrCpiDecoder,
  snapshotContentAddress,
  type NisrCpiDecoded,
  type OfficialDataRetrieval,
} from '@globalnews-ai/shared';

import { PrismaService } from '../../../database/prisma.service';
import { PostgresOfficialDataSnapshotStore } from '../official-data-snapshot.store';
import {
  NISR_CPI_EXTRACTOR_ID,
  NISR_CPI_EXTRACTOR_VERSION,
  NISR_CPI_PRODUCTION_EXTRACTOR,
} from './nisr-cpi-pdf.extractor';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE RETAINED NISR CPI ARTIFACT, OPENED AND DECODED — IN THE DOMAIN THAT OWNS IT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── WHY THIS FILE EXISTS AT ALL, RECORDED RATHER THAN QUIETLY REFACTORED ───
 *
 * The Economy read did this work inline, and `economy-implementation-boundary.spec.ts`
 * failed it — correctly. That guard's rule is that Economy *"may consume the shared
 * ECONOMY contract, and may take TYPES from the platform's provenance model, but may not
 * reach into any OTHER shared runtime domain"*, and the inline version took two VALUE
 * imports out of the official-data domain: `makeNisrCpiDecoder` and
 * `snapshotContentAddress`.
 *
 * The guard was right and the list was not widened to accommodate me. Deciding which
 * decoder may read a NISR artifact, and whether the recorded extractor is the one doing
 * the reading, are official-data questions; Economy asking them was Economy behaving as
 * part of another domain, which is exactly what that rule protects against. So the
 * RUNTIME MOVED to the domain that owns it, and Economy is left holding type imports and
 * a port.
 *
 * ── WHAT IT REFUSES, AND WHY EACH REFUSAL IS NAMED ────────────────────────
 *
 * Five distinguishable refusals, not one boolean. A surface that renders the same
 * sentence for "we never captured anything" and "we captured it and cannot parse it"
 * tells a reader nothing, and — worse — the second is evidence against the PUBLISHER
 * while the first is a fact about US.
 *
 * ── IT CONTACTS NOBODY ────────────────────────────────────────────────────
 *
 * There is no transport, no URL and no fetch in this file or in its dependency graph. It
 * opens bytes that the snapshot store already retained. Calling it a thousand times
 * reaches NISR zero times.
 */

/** Why no retained figure could be produced. Each names OUR gap or the document's. */
export type RetainedNisrCpiRefusal =
  /** Nothing admitted has ever been captured for the governed endpoint. Ours. */
  | 'NO_ADMITTED_CAPTURE'
  /** A capture exists and THIS deployment's extractor is not the one that read it. Ours. */
  | 'EXTRACTOR_IDENTITY_MISMATCH'
  /** The row survives and the payload does not — retention lapsed, not a parse claim. */
  | 'PAYLOAD_NOT_RETAINED'
  /** The bytes are held and the governed decoder refused them. The document's. */
  | 'PARSE_FAILED'
  /** The payload is held with no retrieval lineage to attribute it to. Ours. */
  | 'NO_RETRIEVAL_LINEAGE';

/**
 * THE LINEAGE AS PERSISTED, NOT AS RE-DERIVED.
 *
 * These are the columns the retrieval row carries. They are returned separately from the
 * decoded document on purpose: the point of persisting them was to be able to say what
 * read the artifact AT CAPTURE TIME, and a caller that silently substituted a fresh
 * decode's self-description would have thrown that away.
 */
export interface RetainedNisrCpiLineage {
  readonly parserId: string | null;
  readonly parserVersion: string | null;
  readonly extractorId: string | null;
  readonly extractorVersion: string | null;
  readonly referencePeriod: string | null;
  readonly sourceLanguage: string | null;
}

export type RetainedNisrCpiRead =
  | {
      readonly kind: 'RETAINED';
      readonly decoded: NisrCpiDecoded;
      readonly retrieval: OfficialDataRetrieval;
      readonly contentAddress: string;
      readonly lineage: RetainedNisrCpiLineage;
      /**
       * Every content address held for this artifact BEFORE the one returned, oldest
       * first. Ruling D's ordering input: a caller decides edition order from what was
       * already seen, and the store — not the caller — is the authority on that.
       */
      readonly priorContentAddresses: readonly string[];
    }
  | { readonly kind: 'NONE'; readonly refusal: RetainedNisrCpiRefusal };

@Injectable()
export class RetainedNisrCpiReader {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The most recent ADMITTED capture of one governed endpoint, opened and decoded.
   *
   * THE RECORDED EXTRACTOR IS THE ONE THAT MUST DO THE READING. If this deployment's
   * extractor is not the one the row says produced the figure, the honest answer is that
   * this deployment cannot reproduce it — not a figure decoded by something else and
   * presented under the recorded identity. That check cannot live in the admission path,
   * because at admission there is only one extractor; it exists here precisely because a
   * READ happens later, on a deployment that may have moved on.
   */
  async read(providerId: string, endpointId: string): Promise<RetainedNisrCpiRead> {
    const store = new PostgresOfficialDataSnapshotStore(this.prisma, [providerId]);

    const row = await this.prisma.snapshotRetrieval.findFirst({
      where: { providerId, endpointId, admissibility: 'ADMITTED' },
      orderBy: { retrievedAt: 'desc' },
    });
    if (row === null || row.contentAddress === null) {
      return { kind: 'NONE', refusal: 'NO_ADMITTED_CAPTURE' };
    }

    /*
      `null` IS NOT A MISMATCH. Rows captured before the lineage migration carry no
      extractor identity, and ruling A left them NULL rather than backfilling a guess.
      Treating absent as "different" would refuse every pre-migration artifact on
      evidence that was never recorded either way.
    */
    if (
      row.extractorId !== null &&
      (row.extractorId !== NISR_CPI_EXTRACTOR_ID ||
        row.extractorVersion !== NISR_CPI_EXTRACTOR_VERSION)
    ) {
      return { kind: 'NONE', refusal: 'EXTRACTOR_IDENTITY_MISMATCH' };
    }

    const address = snapshotContentAddress(row.contentAddress);
    const payload = await store.open(address);
    if (payload === null) return { kind: 'NONE', refusal: 'PAYLOAD_NOT_RETAINED' };

    const decodeResult = makeNisrCpiDecoder(NISR_CPI_PRODUCTION_EXTRACTOR)(payload.bytes);
    if (!decodeResult.ok) return { kind: 'NONE', refusal: 'PARSE_FAILED' };

    const all = await store.retrievalsFor(address);
    if (all.length === 0) return { kind: 'NONE', refusal: 'NO_RETRIEVAL_LINEAGE' };

    return {
      kind: 'RETAINED',
      decoded: decodeResult.value,
      retrieval: all[all.length - 1]!,
      contentAddress: row.contentAddress,
      lineage: {
        parserId: row.parserId,
        parserVersion: row.parserVersion,
        extractorId: row.extractorId,
        extractorVersion: row.extractorVersion,
        referencePeriod: row.referencePeriod,
        sourceLanguage: row.sourceLanguage,
      },
      priorContentAddresses: all.slice(0, -1).map((r) => r.contentAddress ?? ''),
    };
  }
}
