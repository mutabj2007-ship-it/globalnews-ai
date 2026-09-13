'use client';

import { entitlementConfig } from '@/lib/map/monetization/entitlement';

/**
 * PART IV v1.2 R2 §16.1 STATE H1 — THE ANALYSIS COST PROMPT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE INVARIANT THIS SURFACE EXISTS TO SATISFY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * §16A's second invariant, attached to every row: "No surface may spend AI
 * compute without an explicit user action THAT STATED THE COST FIRST."
 *
 * §16.1 H1 spells out the shape: "Action named, allowance metered, cost stated
 * IN WORDS, explicit Run. NOTHING SPENDS UNTIL IT IS PRESSED. Cancel returns
 * with nothing spent."
 *
 * So this is a gate, not a confirmation dialog. A confirmation asks whether you
 * meant it; this states what will happen and what it costs, and the Run button
 * is the first and only moment anything could be spent.
 *
 * TEMPORARY class: it dismisses to the previous state, losing nothing, because
 * nothing has happened yet.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AND THE HONESTY THAT MATTERS MOST HERE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * R2 keeps AI allowances open (§18.8) and forbids hard-coded commercial values.
 * With no configured allowance there is NO METER, NO CREDIT COUNT AND NO PRICE —
 * not a zero, not "unlimited", not "free while in beta". Each of those is a
 * commercial claim, and the last one is the most tempting and the least true.
 *
 * What is stated instead is the honest thing: the action's cost in ACTIONS, which
 * is a property of the action rather than of anybody's plan, and the fact that
 * the allowance is not configured.
 *
 * THE RUN CONTROL IS DISABLED, AND THE REASON IS PRECISE. GlobalNewsAI HAS an
 * Analysis system — Main is proving its live-provider activation. What does not
 * exist is the MONETIZED DEEP ANALYSIS ACTIVATION AND ENTITLEMENT CONTRACT: no
 * allowance is configured, no cost is authorised, and nothing says this account
 * may spend. Running without that would spend against a contract nobody signed.
 * A Run that did nothing would be worse than no Run at all.
 */

export interface AnalysisCostPromptLabels {
  readonly title: string;
  readonly costLine: string;
  readonly costUnitOne: string;
  readonly costUnitMany: string;
  readonly allowanceUnset: string;
  readonly allowanceMeter: string;
  readonly unavailable: string;
  readonly run: string;
  readonly cancel: string;
}

export interface AnalysisCostPromptProps {
  readonly actionLabel: string;
  readonly cost: number;
  readonly labels: AnalysisCostPromptLabels;
  readonly onCancel: () => void;
  /**
   * Present only when the MONETIZED DEEP ANALYSIS ACTIVATION AND ENTITLEMENT
   * CONTRACT is configured. GlobalNewsAI has an Analysis system — Main is
   * proving its live-provider activation — but nothing here may start a paid
   * Run until that contract exists, so today no handler is supplied and the
   * Run control is disabled rather than wired to nothing.
   */
  readonly onRun?: () => void;
}

export function AnalysisCostPrompt({
  actionLabel,
  cost,
  labels,
  onCancel,
  onRun,
}: AnalysisCostPromptProps): JSX.Element {
  const entitlement = entitlementConfig();

  return (
    <div
      data-gn="analysis-cost-prompt"
      data-gn-surface-class="TEMPORARY"
      role="dialog"
      aria-label={labels.title}
      className="flex flex-col gap-[12px]"
    >
      <h3 className="font-gn-mono text-[9.5px] uppercase tracking-[0.14em] text-sp-ink-3">
        {labels.title}
      </h3>

      <p data-gn="cost-action" className="text-[13.5px] leading-[1.5] text-sp-ink">
        {actionLabel}
      </p>

      {/*
        THE COST, IN WORDS, BEFORE ANYTHING RUNS. Sand marks it — this is an
        invoking control's cost, and sand appears nowhere else in the product.
      */}
      <p
        data-gn="cost-line"
        className="border-s-2 border-sp-compute-line py-[2px] ps-[9px] font-gn-mono text-[10px] uppercase tracking-[0.1em] text-sp-compute"
      >
        {labels.costLine} {cost} {cost === 1 ? labels.costUnitOne : labels.costUnitMany}
      </p>

      {/*
        THE METER, OR THE HONEST ABSENCE OF ONE. §18.8 keeps AI allowances open,
        so a figure here would be invented. "0 / 5 this month" is a commercial
        claim; so is "unlimited"; so is "free during beta".
      */}
      <p data-gn="cost-allowance" className="text-[11px] leading-[1.5] text-sp-ink-3">
        {entitlement === null
          ? labels.allowanceUnset
          : labels.allowanceMeter
              .replace('{used}', String(entitlement.actionsUsed))
              .replace('{total}', String(entitlement.actionsTotal))
              .replace('{resets}', entitlement.resetsLabel)}
      </p>

      <div className="flex flex-col gap-[7px]">
        <button
          type="button"
          data-gn="cost-run"
          /*
            Enabled only when the deep-analysis activation/entitlement contract
            is configured. The Analysis system exists; the authorisation to
            spend against it does not.
          */
          disabled={onRun === undefined}
          onClick={onRun}
          className="flex min-h-[44px] w-full items-center justify-center rounded-[2px] border border-sp-compute-line px-[10px] py-[11px] font-gn-mono text-[10px] uppercase tracking-[0.14em] text-sp-compute outline-none transition-[color,background-color,border-color] duration-[140ms] hover:bg-[rgba(216,192,138,.1)] disabled:cursor-default disabled:opacity-[.45] disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sp-compute"
        >
          {labels.run}
        </button>

        {onRun === undefined && (
          <p data-gn="cost-unavailable" className="text-[11px] leading-[1.5] text-sp-ink-3">
            {labels.unavailable}
          </p>
        )}

        {/* Cancel returns with nothing spent — because nothing could have been. */}
        <button
          type="button"
          data-gn="cost-cancel"
          onClick={onCancel}
          className="min-h-[40px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] text-sp-ink-3 outline-none transition-colors hover:text-sp-ink-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-sp-cyan"
        >
          {labels.cancel}
        </button>
      </div>
    </div>
  );
}
