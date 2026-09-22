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

import { resolveApiBaseUrl } from '@/lib/api/apiBase';

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
  readonly freshnessBasis?: 'RETAINED_ONLY';
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
  if (o.freshnessBasis === 'RETAINED_ONLY') {
    return { kind: 'STALE', at: o.publisherChangedAt ?? o.publisherVintage, atProvenance: o.vintageProvenance };
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
 * THE ONE INTERNAL READ POINT.
 *
 * The retained read seam now exists. It can transition the surface only from
 * "no retained observation" to observations already stored by the platform.
 * It cannot activate a provider, scheduler or external transport.
 *
 * Browser execution, if this helper is ever reused client-side, stays on the
 * same-origin /market-data rewrite. The current Market page calls it from a
 * Server Component through the deployment-internal backend origin.
 */
type MarketObservationReader = () => Promise<readonly MarketStoredObservation[]>;

const MARKET_READ_PATH = '/market-data/observations';

function marketReadUrl(): string {
  if (typeof window !== 'undefined') return MARKET_READ_PATH;
  return `${resolveApiBaseUrl()}/market/observations`;
}

async function retainedObservationReader(): Promise<readonly MarketStoredObservation[]> {
  /*
   * Same-deployment INTERNAL reader only. Browser execution uses the relative
   * /market-data rewrite; this Server Component uses the deployment's internal
   * backend base because Node has no document against which to resolve a
   * relative path. The backend target imports no scheduler or provider.
   */
  const response = await fetch(marketReadUrl(), {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) throw new Error('Market retained read unavailable');

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error('Malformed Market read envelope');
  return payload as MarketStoredObservation[];
}

/** Validate untrusted JSON before the dashboard calls string methods or renders values. */
export function isMarketReadObservation(value: unknown): value is MarketStoredObservation {
  if (value === null || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  if (!['observationKey', 'seriesId', 'periodId', 'unit', 'provider', 'sourceClass'].every(
    key => typeof o[key] === 'string' && (o[key] as string).trim().length > 0)) return false;
  if (o.provider !== 'EUROSTAT' || o.sourceClass !== 'STATISTICAL_RELEASE' || o.unit === 'PUBLISHER_STATED') return false;
  if (o.value !== null && (typeof o.value !== 'number' || !Number.isFinite(o.value))) return false;
  if (!['SCHEDULED', 'PRELIMINARY', 'REVISED', 'FINAL', 'WITHDRAWN'].includes(String(o.releaseStatus))) return false;
  if (!['PUBLISHER_VINTAGE', 'PUBLISHER_CHANGED_AT', 'INGEST_SNAPSHOT'].includes(String(o.vintageProvenance))) return false;
  const date = (v: unknown) => typeof v === 'string' && /T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
  if (![o.publisherVintage, o.publisherChangedAt].every(v => v === null || date(v))) return false;
  if (o.vintageProvenance === 'PUBLISHER_VINTAGE' && !date(o.publisherVintage)) return false;
  if (o.vintageProvenance === 'PUBLISHER_CHANGED_AT' && !date(o.publisherChangedAt)) return false;
  return o.retentionIsFinal === false && o.freshnessBasis === 'RETAINED_ONLY';
}
const MARKET_OBSERVATION_READER: MarketObservationReader = retainedObservationReader;

/**
 * Legacy vocabulary member retained because NO_READ_ENDPOINT is still a valid
 * failure reason for older serialized states. It is NOT the current Alpha state:
 * this reader now reports NO_OBSERVATION_STORED when the retained endpoint is
 * healthy but empty.
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
  let stored: readonly MarketStoredObservation[];
  try {
    stored = await MARKET_OBSERVATION_READER();
  } catch {
    return { kind: 'UNAVAILABLE', reason: 'NO_READ_ENDPOINT' };
  }
  if (stored.length === 0) {
    return { kind: 'UNAVAILABLE', reason: 'NO_OBSERVATION_STORED' };
  }
  const displayable = stored.filter(isMarketReadObservation).filter(observationIsDisplayable);
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
