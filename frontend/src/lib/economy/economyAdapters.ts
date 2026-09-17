import type {
  EconomyFigureGapReason,
  EconomyFigureSlot,
  EconomyObservation,
  EconomyValueSemantics,
} from '@globalnews-ai/shared';
import {
  ECONOMY_LEGACY_UI_FRESHNESS,
  ECONOMY_LEGACY_UI_GAP_REASON,
  ECONOMY_LEGACY_UI_RELEASE_STATUS,
  ECONOMY_LEGACY_UI_SOURCE_CLASS,
  ECONOMY_LEGACY_UI_VALUE_KIND,
} from '@globalnews-ai/shared';

/**
 * ECON-UI-CONTRACT-ADAPT-1 — THE ADAPTER BOUNDARY.
 *
 * MAIN-ECON-CONTRACT-1 permits presentation-only view models to stay frontend-local and says
 * to use explicit adapter functions where needed. This module is that boundary and nothing
 * else: it READS the shared contract and produces render-ready presentation values. It defines
 * no semantic set, it re-declares no canonical member, and every mapping it applies comes from
 * the contract's own `ECONOMY_LEGACY_UI_*` tables rather than from a table of mine.
 *
 * WHY IT EXISTS. The shared model draws a structural line the old UI model did not: a figure
 * either exists as an OBSERVATION or does not exist as a GAP with a stated reason. Components
 * still need one question answered — "is there a number to print, and if not, why not?" — and
 * this is the single place that answers it. Every em-dash on the Economy surface now traces to
 * `figureIsGap()` and carries `gapReason()` with it.
 */

/** Does this slot hold a reading? */
export function figureIsObservation(
  slot: EconomyFigureSlot,
): slot is Extract<EconomyFigureSlot, { kind: 'OBSERVATION' }> {
  return slot.kind === 'OBSERVATION';
}

/** Is this slot an absence? A GAP always carries a reason — the contract makes it impossible not to. */
export function figureIsGap(
  slot: EconomyFigureSlot,
): slot is Extract<EconomyFigureSlot, { kind: 'GAP' }> {
  return slot.kind === 'GAP';
}

/**
 * The observation, or `null` when the slot is a gap.
 *
 * Note what this deliberately does NOT do: it does not return a nullable NUMBER. The old model
 * offered `value: number | null`, which invited `value ?? 0` at a call site and turned an
 * unpublished figure into a zero. A caller here must handle the slot, not a null value.
 */
export function figureObservation(slot: EconomyFigureSlot): EconomyObservation | null {
  return figureIsObservation(slot) ? slot.observation : null;
}

/** The three value axes, or `null` for a gap — a gap has no release status, kind or freshness. */
export function figureSemantics(slot: EconomyFigureSlot): EconomyValueSemantics | null {
  return figureIsObservation(slot) ? slot.observation.semantics : null;
}

/** The stated reason an absent figure is absent. `null` only when the figure is present. */
export function gapReason(slot: EconomyFigureSlot): EconomyFigureGapReason | null {
  return figureIsGap(slot) ? slot.reason : null;
}

/** The unit to print beside a figure; a gap still knows the series it belongs to, not its unit. */
export function figureUnit(slot: EconomyFigureSlot, fallbackUnit: string): string {
  return figureIsObservation(slot) ? slot.observation.unit : fallbackUnit;
}

/**
 * A gap slot. Exposed so fixtures and the production-shaped subject construct absence the one
 * legal way — with a reason — rather than by writing a null somewhere.
 */
export function economyGap(
  seriesId: string,
  periodId: string,
  reason: EconomyFigureGapReason,
): EconomyFigureSlot {
  return { kind: 'GAP', seriesId, periodId, reason };
}

/** An observation slot. */
export function economyFigure(observation: EconomyObservation): EconomyFigureSlot {
  return { kind: 'OBSERVATION', observation };
}

/**
 * The period label to print beside a figure. Works for both slot kinds: a GAP still knows the
 * period it is a gap IN, which is what lets a surface say "Q2 2026 — not collected" instead of
 * just showing an em-dash with no idea what is missing.
 */
export function slotPeriodLabel(slot: EconomyFigureSlot): string {
  const periodId = figureIsObservation(slot) ? slot.observation.periodId : slot.periodId;
  return periodId.split(':').pop() ?? '';
}

/* ------------------------------------------------------------------ *
 * LEGACY VOCABULARY BRIDGES
 *
 * These exist ONLY so fixture data authored against the pre-contract UI spellings can be lifted
 * onto the canonical set without hand-editing every literal — and they use the CONTRACT'S OWN
 * tables, so the mapping is Main's, not mine. No production path calls them: a guard asserts
 * they appear only in the fixture module and the specs.
 * ------------------------------------------------------------------ */

export const legacyReleaseStatus = ECONOMY_LEGACY_UI_RELEASE_STATUS;
export const legacyValueKind = ECONOMY_LEGACY_UI_VALUE_KIND;
export const legacyFreshness = ECONOMY_LEGACY_UI_FRESHNESS;
export const legacyGapReason = ECONOMY_LEGACY_UI_GAP_REASON;
export const legacySourceClass = ECONOMY_LEGACY_UI_SOURCE_CLASS;
