/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE GOVERNED READ — A RETAINED ARTIFACT BECOMES A FIGURE, OR A STATED GAP
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── READING WHAT WE ALREADY HOLD IS NOT FETCHING ──────────────────────────
 *
 * This module opens bytes the snapshot store already retained and decodes them. It
 * contacts nobody. `rw-nisr` stays `enabled: false`, no scheduler exists, and nothing
 * here can cause a request: there is no transport, no driver and no URL in this file.
 *
 * ── AND IT DOES NOT TOUCH THE GLOBAL INSTALL SEAM ─────────────────────────
 *
 * `installNisrCpiTextLayerExtractor` is composition-root-only (B-7), and the boot gate
 * installs it IF AND ONLY IF the provider is enabled — which it is not. So this read
 * constructs its own decoder over the production extractor directly, and never calls the
 * install seam.
 *
 * That is not a way around the rule; it is a stricter reading of it. The registry row's
 * identity governs ADMISSION — what may read bytes as they arrive. This path reads bytes
 * that were ALREADY admitted, under a parse whose identity the retrieval row recorded, so
 * it can do something the admission path cannot: **check that the extractor it is about to
 * use is the one the row says produced the figure**, and refuse when it is not. A read
 * that silently re-decoded with a different extractor would attribute one extraction's
 * output to another's identity — which is the whole reason B-3.1 persisted the identity.
 *
 * ── WHAT IT RETURNS ───────────────────────────────────────────────────────
 *
 * An `EconomyFigureSlot`: a reading, or a GAP WITH A REASON. *"A gap is never a zero and
 * never an empty cell with no explanation."* There is no third shape and no null value.
 */

import { Injectable } from '@nestjs/common';

/*
  TYPES ONLY FROM SHARED, AND THAT IS A RULE RATHER THAN A STYLE.

  `economy-implementation-boundary.spec.ts` Gate 6 states it: Economy may consume the
  shared ECONOMY contract at runtime and may take TYPES from the platform’s provenance
  model, but *"may not reach into any OTHER shared runtime domain"*.

  An earlier draft of this file imported `makeNisrCpiDecoder` and
  `snapshotContentAddress` — official-data VALUES — and that guard failed it. It was
  right: deciding which decoder may read a NISR artifact is an official-data question,
  and Economy asking it was Economy behaving as part of another domain. The runtime
  moved to `RetainedNisrCpiReader`; the list was not widened to accommodate this file.
*/
import type { EconomyFigureSlot, SourceProvenance } from '@globalnews-ai/shared';

import { RetainedNisrCpiReader } from '../official-data/nisr/nisr-cpi-retained.reader';
import {
  nisrCpiEditionOrderFor,
  readNisrCpiNationalFigureSlot,
} from './producers/nisr-cpi-economy.normalizer';

const PROVIDER_ID = 'rw-nisr';
const ENDPOINT_ID = 'cpi-monthly-en';

/**
 * WHAT A READER IS TOLD, AND WHAT IT IS NOT.
 *
 * Provenance, value, unit, geography, reference period and vintage — the facts a reader
 * needs to judge a figure. **The rights grade, the rights instrument, the retention class
 * and the admission refusal vocabulary are NOT here**: those are governance state, they
 * are `SNAPSHOT_EXPOSURE = 'INTERNAL_ONLY'` by construction, and a reader surface has no
 * question they answer.
 */
export interface EconomyObservationView {
  readonly slot: EconomyFigureSlot;
  readonly publishable: boolean;
  /** Present only for an OBSERVATION. */
  readonly provenance?: {
    readonly institution: string;
    readonly jurisdiction: string;
    readonly sourceUrl?: string;
    readonly licence: string;
    readonly retrievedAt: string;
    readonly contentAddress: string;
    readonly parserId: string;
    readonly parserVersion: string;
    readonly extractorId: string;
    readonly extractorVersion: string;
    readonly referencePeriod: string;
    readonly sourceLanguage: string;
    readonly basePeriod: string;
    /**
     * THE PUBLICATION DATE AT THE PRECISION THE DOCUMENT STATED IT — AND A FINDING.
     *
     * The artifact states `10 September 2026`, a DAY. `EconomyObservation.vintage` is
     * derived by the landed `economyVintageOf` from the retrieval, whose
     * `publisherReleasedAt` is a `DateTime` column — so the value round-trips through
     * Postgres and comes back as `2026-09-10T00:00:00.000Z`, **a midnight the publisher
     * never stated.**
     *
     * That is the same precision-laundering defect ruling A named for
     * `referencePeriod`, appearing one field over. Ruling A is explicitly bounded to
     * two columns and forbids retyping any existing one, so THIS ROUND DOES NOT TOUCH
     * `publisherReleasedAt` — the finding is reported rather than fixed by a migration
     * nobody ruled on.
     *
     * What a reader gets in the meantime is the honest one: the day, as the document
     * printed it, carried beside the derived instant rather than replacing it. A
     * surface that shows a time of day for this figure would be inventing one.
     */
    readonly publicationDateStated: string;
  };
  readonly seriesLabel?: string;
  readonly geographyLabel?: string;
}

@Injectable()
export class EconomyObservationReadService {
  constructor(private readonly retained: RetainedNisrCpiReader) {}

  /**
   * The retained NISR CPI observation, or a GAP saying why there is none.
   *
   * Every refusal below is a `GAP` with a reason, and the reason distinguishes OUR gap
   * from the publisher’s: `NO_PRODUCER` is a fact about this deployment, `WITHHELD` is a
   * fact about the document. A surface must never report one as the other.
   *
   * THE MAPPING IS EXPLICIT AND DELIBERATELY LOSSY IN ONE DIRECTION ONLY. The reader
   * distinguishes five refusals; four of them are facts about US — nothing captured,
   * the payload no longer retained, no lineage, or an extractor this deployment cannot
   * reproduce — and all four become `NO_PRODUCER`, which is the slot vocabulary’s name
   * for exactly that. `PARSE_FAILED` is the one that is a claim about the DOCUMENT, so
   * it is not folded in with them: it is reported to the caller as its own gap and
   * never as a publisher silence.
   */
  async readNisrHeadlineCpi(): Promise<EconomyObservationView> {
    const gap = (reason: 'NO_PRODUCER' | 'WITHHELD'): EconomyObservationView => ({
      slot: { kind: 'GAP', seriesId: 'rw-nisr:cpi:all-rwanda', periodId: 'UNKNOWN', reason },
      publishable: false,
    });

    const held = await this.retained.read(PROVIDER_ID, ENDPOINT_ID);
    if (held.kind === 'NONE') {
      /*
        A PARSE REFUSAL IS EVIDENCE ABOUT THE ARTIFACT AND IS NOT LAUNDERED INTO ONE
        ABOUT US — nor the reverse. `WITHHELD` says the document supplied no figure;
        the other four say this deployment could not produce one.
      */
      return gap(held.refusal === 'PARSE_FAILED' ? 'WITHHELD' : 'NO_PRODUCER');
    }

    const { decoded, retrieval, contentAddress, lineage, priorContentAddresses } = held;

    const provenance: SourceProvenance = {
      sourceType: 'PUBLIC_DATA',
      providerId: PROVIDER_ID,
      institution: 'National Institute of Statistics of Rwanda',
      jurisdiction: 'RW',
      language: decoded.sourceLanguage,
      retrievedAt: retrieval.retrievedAt,
      authorityClass: 'OFFICIAL_STATISTICS',
    };

    /* Ruling D: an artifact that cannot be ordered against what we already hold supplies
       no values. The store is the authority on what was already seen. */
    const editionOrder = nisrCpiEditionOrderFor(priorContentAddresses, contentAddress);

    const read = readNisrCpiNationalFigureSlot({ decoded, retrieval, provenance, editionOrder });
    if (read.slot.kind !== 'OBSERVATION') {
      return { slot: read.slot, publishable: false };
    }

    return {
      slot: read.slot,
      publishable: read.publishable,
      seriesLabel: 'Rwanda headline CPI, year on year',
      geographyLabel: 'All Rwanda',
      provenance: {
        institution: 'National Institute of Statistics of Rwanda',
        jurisdiction: 'RW',
        licence: decoded.licenceToken,
        retrievedAt: retrieval.retrievedAt,
        contentAddress,
        parserId: lineage.parserId ?? '',
        parserVersion: lineage.parserVersion ?? '',
        /*
          THE PERSISTED IDENTITY LEADS, AND THE DECODE IS ONLY THE FALLBACK.

          What B-3.1 persisted these columns FOR is the ability to say what read the
          artifact at capture time. A fresh decode’s self-description is a different
          fact wearing the same name, so it is used only where the column is NULL —
          which, by ruling A, is exactly the pre-migration rows.
        */
        extractorId: lineage.extractorId ?? decoded.extractorId,
        extractorVersion: lineage.extractorVersion ?? decoded.extractorVersion,
        referencePeriod: lineage.referencePeriod ?? decoded.referencePeriod,
        sourceLanguage: lineage.sourceLanguage ?? decoded.sourceLanguage,
        basePeriod: decoded.basePeriod,
        /* From the ARTIFACT, at the artifact’s own precision. See the field note. */
        publicationDateStated: decoded.publicationDate,
      },
    };
  }
}
