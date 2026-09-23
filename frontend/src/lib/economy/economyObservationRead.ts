/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE ECONOMY OBSERVATION READ — THE SEAM H MEASURED, WIRED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * H's inventory named this seam exactly: *"`lib/economy/economyConfig.ts` —
 * `ECONOMY_DATA_CAPABILITY` is a LITERAL. It becomes the return of a nullable reader."*
 * That is what this file is, on the shape Market already proved:
 *
 *   1. the reader is a NULLABLE FUNCTION, not a flag — unwired is a value, not a branch;
 *   2. THREE DISTINGUISHABLE ABSENCES, not one: no reader · none retained · none
 *      displayable;
 *   3. the absence reason names the PLATFORM gap rather than the world — it must never
 *      read as "Rwanda has no inflation";
 *   4. it is called from a SERVER COMPONENT, so the reader's browser makes no request on
 *      load. The server performs one INTERNAL retained-reader fetch; zero EXTERNAL
 *      provider/AI acquisition on page load remains the invariant.
 *
 * ── WHAT IT READS, AND WHAT IT CANNOT CAUSE ───────────────────────────────
 *
 * One backend route that opens an artifact the snapshot store already retained. **It
 * cannot cause a provider request**: `rw-nisr` is `enabled: false`, there is no scheduler,
 * and the route's dependency graph contains no transport. Rendering this page a thousand
 * times contacts NISR zero times and consumes no GNews quota.
 *
 * ── AND IT MANUFACTURES NOTHING ───────────────────────────────────────────
 *
 * `ECON-UI-1`: *"fixtures are illustrative, never production facts."* This reader returns
 * ONLY what the backend read returned. Where a series is not held, it produces a GAP WITH
 * A REASON — never a number, never a zero, and never a fixture standing in for one.
 */

import { ECONOMY_OBSERVATION_AVAILABILITY_STATES } from '@globalnews-ai/shared';

import { resolveApiBaseUrl } from '@/lib/api/apiBase';

import type { EconomyDataCapability } from './economyConfig';

/** The provenance a reader needs to judge the figure. Governance state is not here. */
export interface RetainedObservationProvenance {
  readonly institution: string;
  readonly jurisdiction: string;
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
  /** The day the document itself printed. See the backend note on vintage precision. */
  readonly publicationDateStated: string;
  readonly sourceUrl?: string;
}

export interface RetainedObservation {
  readonly seriesLabel: string;
  readonly geographyLabel: string;
  readonly value: number;
  readonly unit: string;
  readonly periodId: string;
  readonly provenance: RetainedObservationProvenance;
}

export type EconomyReadResult =
  | { readonly kind: 'OBSERVATIONS'; readonly observations: readonly RetainedObservation[] }
  | { readonly kind: 'UNAVAILABLE'; readonly reason: EconomyReadAbsence };

/**
 * THREE ABSENCES, AND EACH NAMES THE PLATFORM RATHER THAN THE WORLD.
 *
 * A surface that renders "no data" for all three tells a reader nothing they can act on,
 * and — worse — a reader could take it to mean the publisher has stopped publishing.
 */
export type EconomyReadAbsence =
  /** No reader is wired in this deployment. A fact about us. */
  | 'NO_OBSERVATION_READER'
  /** A reader is wired and the store holds no admitted NISR capture. */
  | 'NO_OBSERVATION_RETAINED'
  /** Something is retained and none of it is publishable — a gap, with its own reason. */
  | 'NO_DISPLAYABLE_OBSERVATION';

export const ECONOMY_READ_ABSENCE_TEXT: Readonly<Record<EconomyReadAbsence, string>> = {
  NO_OBSERVATION_READER:
    'This deployment has no economy observation reader wired. No figure is held here.',
  NO_OBSERVATION_RETAINED:
    'No official economy artifact has been retained yet. No figure is held here.',
  NO_DISPLAYABLE_OBSERVATION:
    'No publishable economy figure could be read from this deployment.',
};

/* ══════════════════════════════════════════════════════════════════════════
 * THE READER
 * ══════════════════════════════════════════════════════════════════════════ */

type EconomyObservationReader = () => Promise<EconomyReadResult>;

/**
 * THE PATH IS RELATIVE, AND THAT IS THE PROPERTY THE ACCEPTED GUARD PROTECTS.
 *
 * Browser use is same-origin through the existing `/economy` rewrite. Server rendering
 * uses the deployment's configured backend base from `apiBase.ts`; it is an internal read,
 * not a provider request. This read does not follow a source citation or acquire evidence.
 */
const ECONOMY_READ_PATH = '/economy/observations/rw-nisr-cpi';

/**
 * THE BASE FOR THE CURRENT EXECUTION CONTEXT — the construction `accountBase.ts` already
 * uses, and for the reason it already records:
 *
 *   BROWSER: the relative path, so the request is same-origin BY CONSTRUCTION and reaches
 *   the backend through the `/economy` rewrite.
 *
 *   SERVER: the direct backend base, because *"`fetch` in the Node runtime cannot resolve
 *   a relative URL — it has no document to resolve it against."* This read runs in a
 *   SERVER component, so this is the branch that actually carries it.
 *
 * The origin lives in `lib/api/apiBase.ts`, where it already lives for every other
 * server-side read. This module delegates backend configuration to that shared resolver.
 */
function economyReadUrl(): string {
  if (typeof window !== 'undefined') return ECONOMY_READ_PATH;
  return `${resolveApiBaseUrl()}${ECONOMY_READ_PATH}`;
}

/**
 * `null` when this deployment has no reader — the seam, explicitly unwired, exactly as
 * Market’s `activatedObservationReader()` is.
 *
 * It is wired here because there is now something to read. THE SEAM DID NOT MOVE: it is
 * still a nullable function, and setting it back to `null` restores the previous
 * behaviour with no other change.
 */
function activatedObservationReader(): EconomyObservationReader | null {
  return async () => {
    const response = await fetch(economyReadUrl(), {
      /* Evidence, not a page fragment: never served from a stale cache. */
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return { kind: 'UNAVAILABLE', reason: 'NO_DISPLAYABLE_OBSERVATION' };

    const body = (await response.json()) as {
      slot?: { kind?: string; observation?: { value?: number; unit?: string; periodId?: string } };
      publishable?: boolean;
      retainedState?: string;
      seriesLabel?: string;
      geographyLabel?: string;
      provenance?: RetainedObservationProvenance;
    };

    if (body.retainedState === 'NO_CAPTURE' && body.publishable === false && body.slot?.kind === 'GAP') {
      return { kind: 'UNAVAILABLE', reason: 'NO_OBSERVATION_RETAINED' };
    }
    if (body.slot?.kind !== 'OBSERVATION' || body.publishable !== true) {
      return { kind: 'UNAVAILABLE', reason: 'NO_DISPLAYABLE_OBSERVATION' };
    }
    const o = body.slot.observation;
    if (typeof o?.value !== 'number' || !Number.isFinite(o.value) ||
        o.unit !== 'PERCENT' || typeof o.periodId !== 'string' ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(o.periodId) ||
        body.provenance == null ||
        typeof body.provenance.contentAddress !== 'string' ||
        !/^[a-f0-9]{64}$/.test(body.provenance.contentAddress) ||
        body.provenance.referencePeriod !== o.periodId) {
      return { kind: 'UNAVAILABLE', reason: 'NO_DISPLAYABLE_OBSERVATION' };
    }

    return { kind: 'OBSERVATIONS', observations: [
      {
        seriesLabel: body.seriesLabel ?? 'Headline CPI',
        geographyLabel: body.geographyLabel ?? '',
        value: o.value,
        unit: o.unit,
        periodId: o.periodId,
        provenance: body.provenance,
      },
    ] };
  };
}
const ECONOMY_OBSERVATION_READER = activatedObservationReader();

/**
 * Called from a SERVER component. Never throws: a backend that is down is an absence with
 * a reason, not a render failure — the surface still has to say something truthful.
 */
export async function readEconomyObservations(): Promise<EconomyReadResult> {
  if (ECONOMY_OBSERVATION_READER === null) {
    return { kind: 'UNAVAILABLE', reason: 'NO_OBSERVATION_READER' };
  }
  try {
    return await ECONOMY_OBSERVATION_READER();
  } catch {
    return { kind: 'UNAVAILABLE', reason: 'NO_DISPLAYABLE_OBSERVATION' };
  }
}

/**
 * THE CAPABILITY BECOMES DERIVED, WHICH IS THE WHOLE POINT OF THE SEAM.
 *
 * It was a literal reading `NO_OBSERVATION_SOURCE`, and with no reader that literal was
 * correct. It is now the ANSWER TO A READ, so it cannot say `OBSERVED` unless something
 * was observed — and it can never say `FIXTURE`, because no branch here returns one.
 */
export function economyCapabilityFrom(read: EconomyReadResult): EconomyDataCapability {
  /*
    THE MEMBERS COME FROM THE CANONICAL VOCABULARY, NOT FROM TWO STRING LITERALS HERE.

    `ECON-UI-CONTRACT-ADAPT-1` forbids an Economy file re-spelling a canonical member,
    and for a reason this function would otherwise demonstrate: a literal typed here
    reads as the same word and is a second declaration, so the day the contract renames
    one, this keeps compiling and starts lying.
  */
  const [OBSERVED, NO_SOURCE] = ECONOMY_OBSERVATION_AVAILABILITY_STATES;
  return {
    numericObservations: read.kind === 'OBSERVATIONS' ? OBSERVED! : NO_SOURCE!,
  };
}
