/**
 * ════════════════════════════════════════════════════════════════════════════
 * REQUESTED PUBLISHER — IDENTITY IS NOT AUTHORIZATION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * P0 ASK-RETRIEVAL-REUTERS-DRC-R1, CTO investigation target B: "Separate
 * publisher identity resolution from authorization to ingest/store copyrighted
 * source material. Do not add an unlicensed Reuters RSS feed."
 *
 * ── THE DEFECT THIS CLOSES, MEASURED ────────────────────────────────────────
 *
 * `resolveRequestedSource('Reuters')` returns `undefined`, because Reuters is
 * not in FEED_SOURCES — and it must not be, because the product has no licence
 * to ingest it. That is correct. What is NOT correct is what the reader is then
 * told: the one sentence the no-evidence branch can produce is
 *
 *   "No related articles were found for this question."
 *
 * For "Report abt Eric Prince in congo. According reuters please." that
 * sentence is TRUE AND USELESS, and it is indistinguishable from three
 * materially different situations:
 *
 *   a. Reuters was searched and had nothing.          <- did not happen
 *   b. Reuters is not a publisher we carry at all.    <- what actually happened
 *   c. the phrase named no publisher we could read.   <- a different failure
 *
 * A reader cannot act on (b) if the product reports it as (a). This module
 * exists so the answer layer can name which one it was, WITHOUT changing what
 * retrieval does and WITHOUT acquiring anything.
 *
 * ── WHAT THIS MODULE DELIBERATELY DOES NOT DO ───────────────────────────────
 *
 * IT DOES NOT MAKE ANY PUBLISHER RETRIEVABLE. `resolveRequestedSource()` is
 * untouched and still returns `undefined` for everything outside FEED_SOURCES,
 * so REV C's fail-closed ruling fires exactly as before: an unresolved source
 * does NOT become an unrestricted topic search. A probe in this directory pins
 * that.
 *
 * IT ADDS NO FEED, NO TRANSPORT AND NO ENDPOINT. There is no URL in this file.
 * Recognising the NAME "Reuters" is a fact about the English language and a
 * masthead; it is not a licence, a feed, or permission to store a sentence of
 * their copy. `ingestAuthorized` is `false` on every entry below and there is
 * no code path that reads it as `true`.
 *
 * IT NEVER ATTRIBUTES. Knowing that a reader meant Reuters must never let a
 * non-Reuters record be presented as Reuters reporting — acceptance case N5.
 * This module returns a STATE, never an article and never an attribution.
 */

import { resolveRequestedSource, type RequestedSource } from './requested-source.util';
import { normalizePublisherName } from './publisher-identity.util';

/** Why a requested publisher cannot be retrieved from, when it cannot. */
export const REQUESTED_PUBLISHER_STATES = [
  /** In FEED_SOURCES: the product carries it and may retrieve its reporting. */
  'CARRIED',
  /**
   * A publisher this product can NAME but does not carry. Retrieval is not
   * attempted and no content of theirs is held. The reader is owed this
   * distinction; it is not a softer form of "nothing found".
   */
  'RECOGNISED_NOT_CARRIED',
  /** The phrase matched no publisher identity this product can establish. */
  'UNRECOGNISED',
] as const;
export type RequestedPublisherState = (typeof REQUESTED_PUBLISHER_STATES)[number];

/** Machine-readable reasons, for traces and for the answer layer. */
export const REQUESTED_PUBLISHER_REASONS = [
  'REQUESTED_SOURCE_CARRIED',
  'REQUESTED_SOURCE_NOT_CARRIED_NO_INGEST_RIGHTS',
  'REQUESTED_SOURCE_UNRECOGNISED',
] as const;
export type RequestedPublisherReason = (typeof REQUESTED_PUBLISHER_REASONS)[number];

interface RecognisedPublisher {
  readonly displayName: string;
  /**
   * ALWAYS FALSE IN THIS FILE, and the field exists so that staying false is a
   * visible, testable property rather than an absence nobody checks. A `true`
   * here would be a licensing claim, and licensing is not decided in a utility.
   */
  readonly ingestAuthorized: false;
  /** What a surface may show: the reader's own link and dated metadata only. */
  readonly permittedSurface: 'ORIGINAL_LINK_AND_METADATA_ONLY';
  readonly note: string;
}

/**
 * Publishers the product can NAME but does not carry.
 *
 * ADMISSION TO THIS LIST IS A NAMING DECISION, NOT A RIGHTS DECISION. An entry
 * means only: when a reader writes this, we know which masthead they meant, so
 * we can tell them plainly that we do not carry it. Nothing here is fetched,
 * stored, quoted or attributed.
 *
 * Reuters is the first entry because it is the publisher the Product Owner
 * named, and because the honest answer to that request — "we recognise Reuters
 * and do not carry it" — is currently unsayable.
 */
const RECOGNISED_NOT_CARRIED: readonly RecognisedPublisher[] = Object.freeze([
  Object.freeze({
    displayName: 'Reuters',
    ingestAuthorized: false as const,
    permittedSurface: 'ORIGINAL_LINK_AND_METADATA_ONLY' as const,
    note:
      'International news agency. No ingest, redistribution or excerpt-storage right has been ' +
      'established for this product, so no Reuters content is retrieved or held. A surface may ' +
      'show an original Reuters URL and its dated metadata where a reader or an admitted record ' +
      'already supplies them; it may never present other reporting as Reuters reporting.',
  }),
]);

export interface RequestedPublisherVerdict {
  readonly state: RequestedPublisherState;
  readonly reason: RequestedPublisherReason;
  /** The publisher's name as this product spells it, when it could name one. */
  readonly displayName: string | null;
  /** Present only for CARRIED — the curated entry retrieval may use. */
  readonly carried: RequestedSource | null;
  /** Present only for RECOGNISED_NOT_CARRIED. */
  readonly recognised: RecognisedPublisher | null;
}

/**
 * Classify a requested-publisher phrase into the three states above.
 *
 * CARRIED IS ASKED FIRST, AND ONLY `resolveRequestedSource()` CAN ANSWER IT, so
 * this function cannot widen retrieval even by accident: everything it adds
 * lives strictly on the two branches where retrieval was never going to happen.
 *
 * Comparison reuses `normalizePublisherName()` — the existing normalizer — with
 * exact normalized equality and nothing else. No substring containment, no
 * token overlap, no fuzzy distance: the reasons given in
 * requested-source.util.ts for refusing those apply here unchanged, and more
 * so, because a wrong match here would put the wrong masthead in front of a
 * reader as the thing they asked for.
 */
export function classifyRequestedPublisher(phrase: string): RequestedPublisherVerdict {
  const carried = resolveRequestedSource(phrase);

  if (carried) {
    return Object.freeze({
      state: 'CARRIED' as const,
      reason: 'REQUESTED_SOURCE_CARRIED' as const,
      displayName: carried.displayName,
      carried,
      recognised: null,
    });
  }

  const requested = normalizePublisherName(phrase);

  if (requested) {
    for (const entry of RECOGNISED_NOT_CARRIED) {
      if (normalizePublisherName(entry.displayName) !== requested) continue;

      return Object.freeze({
        state: 'RECOGNISED_NOT_CARRIED' as const,
        reason: 'REQUESTED_SOURCE_NOT_CARRIED_NO_INGEST_RIGHTS' as const,
        displayName: entry.displayName,
        carried: null,
        recognised: entry,
      });
    }
  }

  /*
   * UNRECOGNISED IS NOT A LESSER FAILURE. It says the product could not even
   * establish which publisher was meant, which is a different thing to tell a
   * reader than "we know them and do not carry them".
   */
  return Object.freeze({
    state: 'UNRECOGNISED' as const,
    reason: 'REQUESTED_SOURCE_UNRECOGNISED' as const,
    displayName: null,
    carried: null,
    recognised: null,
  });
}
