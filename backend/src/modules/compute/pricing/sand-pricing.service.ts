import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ComputeClass, ComputeOperationKind } from '@globalnews-ai/shared';

/**
 * BETA-SIMPLE-ASK-SAND-1 §8 — THE SINGLE PRICING AUTHORITY.
 *
 * §8: "Do not hard-code Sand prices throughout React components. One
 * backend/config authority must own pricing."
 *
 * This service is that authority. The numbers below exist in exactly
 * one place in the entire repository. Nothing in `shared` carries a
 * price (so no price is ever shipped to the frontend bundle), and no
 * component performs Sand arithmetic — the frontend only ever renders
 * the `quotedSand` integer a server-issued SandQuote hands it.
 *
 * §9: "All Sand values during this tranche are design/testing fixtures
 * unless separately approved." The defaults below are exactly that —
 * fixtures chosen to make the quote/confirm/ledger machinery
 * exercisable, NOT a commercial price list. They are deliberately
 * round numbers so nobody mistakes them for a modelled tariff, and
 * every one is overridable by environment variable so setting real
 * economics later is a config change, not a code change.
 *
 * §34: no payment processor, no purchase flow, no tax, no final
 * pricing. This file converts a compute class into an integer. That is
 * all it does.
 */

/**
 * §5/§7 — STORED and CONTEXTUAL are structurally free.
 *
 * This is not a pricing decision that could later be revised upward by
 * config; it is a product invariant from §7, which states plainly that
 * Sand is NOT a charge for reading, for opening the map, for evidence,
 * for Timeline, for Watch, or for reopening stored analysis. All of
 * those are STORED/CONTEXTUAL operations.
 *
 * So these two classes are pinned to 0 in code and are NOT read from
 * the environment. An operator cannot accidentally start charging for
 * reading by setting a stray variable.
 */
const STRUCTURALLY_FREE_CLASSES: readonly ComputeClass[] = ['STORED', 'CONTEXTUAL'] as const;

/**
 * Design/testing fixtures (§9). FRESH_BOUNDED is 0 because §5 says an
 * ordinary fresh Ask is "controlled by quota/fair-use architecture",
 * not by Sand — quota is a separate mechanism from metered compute,
 * and conflating them would make ordinary Ask a paid feature, which
 * §20 and §7 both rule out.
 */
const DEFAULT_SAND_PRICES: Readonly<Record<ComputeClass, number>> = {
  STORED: 0,
  CONTEXTUAL: 0,
  FRESH_BOUNDED: 0,
  DEEP_ANALYSIS: 24,
  RESEARCH_REPORT: 120,
} as const;

/** Env override names. Only the two genuinely metered classes are overridable. */
const PRICE_ENV_KEYS: Partial<Record<ComputeClass, string>> = {
  FRESH_BOUNDED: 'SAND_PRICE_FRESH_BOUNDED',
  DEEP_ANALYSIS: 'SAND_PRICE_DEEP_ANALYSIS',
  RESEARCH_REPORT: 'SAND_PRICE_RESEARCH_REPORT',
};

/**
 * User-facing labels for the quote panel (§9's "Deep Analysis / 24 Sand").
 *
 * Server-supplied alongside the price so a component can never render
 * one class's label above another class's number. Kept in English
 * here; the frontend maps the compute class to a localized dictionary
 * entry and falls back to this label, matching the repository's
 * existing "dictionary with English fallback" discipline.
 */
const CLASS_LABELS: Readonly<Record<ComputeClass, string>> = {
  STORED: 'Stored result',
  CONTEXTUAL: 'Context',
  FRESH_BOUNDED: 'Ask',
  DEEP_ANALYSIS: 'Deep Analysis',
  RESEARCH_REPORT: 'Research Report',
} as const;

@Injectable()
export class SandPricingService {
  constructor(private readonly config: ConfigService) {}

  /**
   * The Sand price for one compute class. Always a non-negative
   * integer.
   *
   * Sand is a whole-unit quantity — there is no such thing as 2.5 Sand
   * — so a fractional or non-numeric override is rejected in favour of
   * the default rather than silently truncated. A misconfigured
   * deployment must fall back to a known-good fixture, never to
   * `NaN`, which would propagate into a quote and then into a ledger
   * row as a corrupt amount.
   */
  priceFor(computeClass: ComputeClass): number {
    if (STRUCTURALLY_FREE_CLASSES.includes(computeClass)) {
      return 0;
    }

    const envKey = PRICE_ENV_KEYS[computeClass];
    const fallback = DEFAULT_SAND_PRICES[computeClass];
    if (!envKey) return fallback;

    const raw = this.config.get<string>(envKey);
    if (raw === undefined || raw.trim() === '') return fallback;

    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) return fallback;

    return parsed;
  }

  /** The label shown beside the price in a quote panel. */
  labelFor(computeClass: ComputeClass): string {
    return CLASS_LABELS[computeClass];
  }

  /**
   * Whether a class is free at point of use for everyone, regardless
   * of tier, entitlement or configuration (§7).
   */
  isStructurallyFree(computeClass: ComputeClass): boolean {
    return STRUCTURALLY_FREE_CLASSES.includes(computeClass);
  }

  /**
   * §9 — how long a quote stays valid, in seconds.
   *
   * Bounded because a quote pins a classification, and classification
   * depends on evidence revision. A quote confirmed an hour later
   * could execute against an evidence corpus that would now classify
   * differently. Short enough to stay honest, long enough for a person
   * to read a confirmation dialog.
   */
  quoteTtlSeconds(): number {
    const raw = this.config.get<string>('SAND_QUOTE_TTL_SECONDS');
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) return 300;
    return parsed;
  }

  /**
   * §5 — the operation kinds that are never metered, whatever they
   * classify to.
   *
   * `category-view` is listed because §16 requires that clicking
   * Economy/Energy/Security never triggers expensive new synthesis.
   * The classifier already caps that kind at CONTEXTUAL, so this is a
   * second, independent guarantee: even if the cap were removed, a
   * category view still could not produce a non-zero quote.
   * Defence in depth on the rule the Product Owner stated most
   * emphatically ("minimize every click that runs AI quota").
   */
  isNeverMeteredKind(kind: ComputeOperationKind): boolean {
    return kind === 'category-view';
  }
}
