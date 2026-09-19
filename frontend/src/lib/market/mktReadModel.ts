/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART VII · THE MARKET READER READ-MODEL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THIS FILE IS THE SEAM BETWEEN THE ACCEPTED MARKET OBSERVATION CONTRACT AND THE
 * READER SURFACE, AND IT IS THE ONLY ONE.
 *
 * ── WHAT IT IS TYPED AGAINST ──────────────────────────────────────────────
 *
 * `MarketObservationDraft`, declared in the ingest platform at
 * `backend/src/modules/market-ingest/market-ingest.scheduler.ts` and persisted through
 * `MarketObservationRow`. The frontend cannot import the backend, so the field names are
 * reproduced here EXACTLY and `mktContract.spec.ts` asserts the reproduction against a
 * recorded list — a rename on either side fails the build rather than silently producing
 * a card with an empty value.
 *
 *     observationKey      string
 *     seriesId            string
 *     periodId            string
 *     value               number | null
 *     unit                string
 *     publisherVintage    string | null
 *     publisherChangedAt  string | null
 *     vintageProvenance   PUBLISHER_VINTAGE | PUBLISHER_CHANGED_AT | INGEST_SNAPSHOT
 *     releaseStatus       SCHEDULED | PRELIMINARY | REVISED | FINAL | WITHDRAWN
 *
 * ── THE THREE TIMESTAMPS ARE NEVER COLLAPSED — SI-9.1 / SI-9.2 ────────────
 *
 * `periodId` is what the observation is OF. `publisherVintage` is when the publisher says
 * it issued the reading. `publisherChangedAt` is when the publisher says a record moved.
 * `vintageProvenance` says which of the three the value is actually carrying, and it is
 * bound at write and never inferred. The reader surface prints the period and the vintage
 * SEPARATELY and labels the vintage with its provenance, because a fetch time presented as
 * a vintage is the defect `NO_VINTAGE_PUBLISHED` exists to refuse.
 *
 * ── WHAT THE CONTRACT DOES NOT CARRY, AND WHAT THE SURFACE DOES ABOUT IT ──
 *
 * Three fields Part VII's card anatomy requires have no member in the accepted contract:
 * a published DISPLAY NAME for the series, the SOURCE CLASS and publisher of the figure,
 * and a FRESHNESS TIER. They are not invented here.
 *
 *   - the series identifier renders as a machine-readable identifier, bidi-isolated,
 *     and the card states that the published name is not carried;
 *   - provenance is REQUIRED: an observation the read port cannot attribute is not
 *     rendered at all, because R10 rule 1 forbids a value without a freshness state and
 *     §9.11 requires a source line. Refusing is the only truthful option;
 *   - freshness is DERIVED, below, from what the contract does carry.
 *
 * Each is recorded in the package's read-model expectations for Code.
 *
 * ── NO PROVIDER IS CALLED FROM HERE ───────────────────────────────────────
 *
 * This module reads INTERNAL STORED OBSERVATIONS ONLY. It contains no URL, no fetch of an
 * external host, and no provider adapter. It is consumed by a SERVER component, so a page
 * load costs the reader's browser zero requests — the property the readiness substrate
 * proved and this surface keeps.
 */

/* ───────────────────────────────────────────────────────────────────────────
 * 1 · THE CONTRACT FIELD NAMES, AS A VALUE
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * The accepted draft's field names. Exported as a value so the guard can compare this
 * list against the keys the read model actually consumes; a field renamed in the ingest
 * platform and not here is a build failure, not a blank cell.
 */
export const MARKET_OBSERVATION_CONTRACT_FIELDS = [
  'observationKey',
  'seriesId',
  'periodId',
  'value',
  'unit',
  'publisherVintage',
  'publisherChangedAt',
  'vintageProvenance',
  'releaseStatus',
] as const;

export type MarketVintageProvenance =
  | 'PUBLISHER_VINTAGE'
  | 'PUBLISHER_CHANGED_AT'
  | 'INGEST_SNAPSHOT';

export type MarketReleaseStatus =
  | 'SCHEDULED'
  | 'PRELIMINARY'
  | 'REVISED'
  | 'FINAL'
  | 'WITHDRAWN';

/**
 * One stored observation, as the accepted contract carries it, plus the attribution the
 * read port must supply alongside it.
 *
 * `provider` and `sourceClass` are NOT on the draft — they belong to the ingest run that
 * wrote it. The read port joins them, and this type makes that join mandatory rather than
 * optional, so an unattributable observation cannot be constructed.
 */
export interface MarketStoredObservation {
  readonly observationKey: string;
  readonly seriesId: string;
  readonly periodId: string;
  readonly value: number | null;
  readonly unit: string;
  readonly publisherVintage: string | null;
  readonly publisherChangedAt: string | null;
  readonly vintageProvenance: MarketVintageProvenance;
  readonly releaseStatus: MarketReleaseStatus;
  /** From the ingest run. Required: §9.11 has no optional form. */
  readonly provider: string;
  /** The publisher's own artifact class — R09. Required for the same reason. */
  readonly sourceClass: string;
  /**
   * Whether the retention behind this figure may be declared final.
   * `SNAPSHOT_SEAM_STATUS` is `PROVISIONAL_PENDING_MAIN_SNAPSHOT_R2` and
   * `assertSnapshotBackedWriteIsNotFinal` enforces it, so today this is always false and
   * the surface says so rather than presenting a provisional figure as settled.
   */
  readonly retentionIsFinal: boolean;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 2 · FRESHNESS — PART VII R10, DERIVED AND NEVER ASSUMED
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * R10's six states, verbatim. `LIVE` is declared so the union is complete and is
 * DELIBERATELY UNREACHABLE: R10 says *"only with a licensed real-time contract. Not
 * assumed anywhere in Phase 1"*, and `deriveFreshness` below has no branch that returns
 * it. The guard asserts that.
 */
export type MarketFreshness =
  | 'LIVE'
  | 'DELAYED'
  | 'LAST_CLOSE'
  | 'LATEST_PUBLISHED'
  | 'STALE'
  | 'UNAVAILABLE';

export interface MarketFreshnessState {
  readonly kind: MarketFreshness;
  /** The timestamp the state is qualified by, where one exists. Never a fetch time. */
  readonly at: string | null;
  /** Which of the three timestamps `at` is, so the label cannot overclaim. */
  readonly atProvenance: MarketVintageProvenance | null;
}

/**
 * THE DERIVATION, AND WHY EACH BRANCH IS THE ONLY HONEST ONE.
 *
 *   WITHDRAWN            the publisher has withdrawn it. There is nothing to show and a
 *                        withdrawn figure is not a stale one — it is UNAVAILABLE.
 *   value === null       the contract permits a null value; a null with a unit is an
 *                        absence, and an absence has no freshness.
 *   PUBLISHER_VINTAGE    the publisher stated when it issued this reading, which is
 *                        exactly what LATEST PUBLISHED means in R10.
 *   PUBLISHER_CHANGED_AT the publisher stated THAT a record changed. That is a
 *                        publication event, so LATEST PUBLISHED with the changed-at date.
 *   INGEST_SNAPSHOT      no publisher vintage exists. R10 has no state for "we looked at
 *                        it on Tuesday", and inventing one would present our download as
 *                        the publisher's. STALE is the truthful floor, and the reason is
 *                        carried so the surface can say WHY rather than implying decay.
 *
 * LAST CLOSE is not derivable: it needs a trading session, and no session-bearing source
 * is qualified. DELAYED is not derivable: it needs a publisher-stated interval, and no
 * P0 source supplies one. Neither is guessed.
 */
export function deriveFreshness(o: MarketStoredObservation): MarketFreshnessState {
  if (o.releaseStatus === 'WITHDRAWN') {
    return { kind: 'UNAVAILABLE', at: null, atProvenance: null };
  }
  if (o.value === null) {
    return { kind: 'UNAVAILABLE', at: null, atProvenance: null };
  }
  if (o.vintageProvenance === 'PUBLISHER_VINTAGE' && o.publisherVintage !== null) {
    return {
      kind: 'LATEST_PUBLISHED',
      at: o.publisherVintage,
      atProvenance: 'PUBLISHER_VINTAGE',
    };
  }
  if (o.vintageProvenance === 'PUBLISHER_CHANGED_AT' && o.publisherChangedAt !== null) {
    return {
      kind: 'LATEST_PUBLISHED',
      at: o.publisherChangedAt,
      atProvenance: 'PUBLISHER_CHANGED_AT',
    };
  }
  return { kind: 'STALE', at: null, atProvenance: 'INGEST_SNAPSHOT' };
}

/** True where a figure may be shown at all. R10 rule 1: no value without a freshness state. */
export function observationIsDisplayable(o: MarketStoredObservation): boolean {
  if (o.value === null) return false;
  if (o.releaseStatus === 'WITHDRAWN') return false;
  if (o.provider.trim() === '') return false;
  if (o.sourceClass.trim() === '') return false;
  if (o.unit.trim() === '') return false;
  return true;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 3 · THE READ PORT
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Why the surface is holding nothing. Each is a fact about the platform, never a
 * statement about the market — the distinction the readiness substrate established and
 * this surface keeps.
 */
export type MarketReadUnavailableReason =
  /** No HTTP read seam exists yet: the ingest platform has no controller. */
  | 'NO_READ_ENDPOINT'
  /** The read seam exists but no provider is in the activation allowlist. */
  | 'NO_ACTIVATED_PROVIDER'
  /** Providers ran and stored nothing for the requested scope. */
  | 'NO_OBSERVATION_STORED'
  /** The store answered, but nothing it returned may lawfully be displayed. */
  | 'NO_DISPLAYABLE_OBSERVATION';

export type MarketReadResult =
  | { readonly kind: 'OBSERVATIONS'; readonly observations: readonly MarketStoredObservation[] }
  | { readonly kind: 'UNAVAILABLE'; readonly reason: MarketReadUnavailableReason };

/**
 * THE ONE ACTIVATION POINT.
 *
 * It returns `null` while no internal read seam exists. Give it a reader and the surface
 * transitions; nothing else in the Market frontend changes, which is the property that
 * makes this a seam rather than a stub.
 *
 * It is deliberately NOT a fetch of an external host and it never will be: the reader
 * surface consumes internal stored observations only. When Code lands the read endpoint,
 * the reader implemented here calls THAT, server-side.
 */
type MarketObservationReader = () => Promise<readonly MarketStoredObservation[]>;

function activatedObservationReader(): MarketObservationReader | null {
  return null;
}

const MARKET_OBSERVATION_READER: MarketObservationReader | null = activatedObservationReader();

/**
 * The reason the surface reports while no reader is wired. It names the PLATFORM gap —
 * the ingest module ships a scheduler, a repository and two adapters but no controller —
 * rather than implying the market itself is quiet.
 */
export const MARKET_READ_ABSENCE: MarketReadUnavailableReason = 'NO_READ_ENDPOINT';

/**
 * Read the stored Market observations for the Alpha surface.
 *
 * Called from a SERVER component. A reader's browser makes no request for this data; the
 * page arrives rendered. That is the zero-network-on-page-load property the readiness
 * substrate proved, preserved rather than re-earned.
 */
export async function readMarketObservations(): Promise<MarketReadResult> {
  if (MARKET_OBSERVATION_READER === null) {
    return { kind: 'UNAVAILABLE', reason: MARKET_READ_ABSENCE };
  }
  const stored = await MARKET_OBSERVATION_READER();
  if (stored.length === 0) {
    return { kind: 'UNAVAILABLE', reason: 'NO_OBSERVATION_STORED' };
  }
  const displayable = stored.filter(observationIsDisplayable);
  if (displayable.length === 0) {
    return { kind: 'UNAVAILABLE', reason: 'NO_DISPLAYABLE_OBSERVATION' };
  }
  return { kind: 'OBSERVATIONS', observations: displayable };
}

/* ───────────────────────────────────────────────────────────────────────────
 * 4 · CAPABILITY — WHAT THE READER IS TOLD ABOUT PROVIDERS
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Mirrors `ProviderEligibility` from the ingest registry: rights and activation are two
 * INDEPENDENT conditions and both are required to run — SI-18.5. The reader surface shows
 * both, separately, because "we are allowed to use this" and "this is running" are
 * different claims and collapsing them is how a surface implies a dead provider is live.
 */
export interface MarketCapabilityRow {
  readonly providerId: string;
  readonly rightsEligible: boolean;
  readonly activated: boolean;
  readonly runnable: boolean;
}

/**
 * The state the platform reports today, and the registry's own comment is the citation:
 * *"TED, GLEIF and Eurostat satisfy (1) and none satisfies (2), which is the correct
 * state and the one this module reports."* — `market-provider-registry.ts`.
 *
 * `ACTIVATION_ALLOWLIST_DEFAULT` is `[]`, so `activated` is false for every provider and
 * `runnable` is false for every provider. World Bank and ECB are absent from this list
 * rather than listed as false, because they have no rights record at all: showing them
 * with an empty checkbox would imply they are one switch away, and they are not.
 */
export const MARKET_CAPABILITY: readonly MarketCapabilityRow[] = [
  { providerId: 'TED', rightsEligible: true, activated: false, runnable: false },
  { providerId: 'EUROSTAT', rightsEligible: true, activated: false, runnable: false },
  { providerId: 'GLEIF', rightsEligible: true, activated: false, runnable: false },
];

/** No provider runs. Derived from the rows, never authored beside them. */
export const MARKET_HAS_RUNNABLE_PROVIDER: boolean = MARKET_CAPABILITY.some((p) => p.runnable);

/**
 * Snapshot-backed writes may not be declared final while Main's Snapshot Contract R2 is
 * in flight. Mirrors `SNAPSHOT_SEAM_STATUS`. The surface carries it so a figure that
 * arrives before R2 lands is not read as settled.
 */
export const MARKET_RETENTION_IS_PROVISIONAL = true;
