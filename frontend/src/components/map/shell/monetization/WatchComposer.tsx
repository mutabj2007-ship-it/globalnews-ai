'use client';

import { useState } from 'react';
import {
  DEFAULT_SENSITIVITY,
  INSTITUTIONAL_SENSITIVITIES,
  NO_RUN_RECORD,
  WATCH_SENSITIVITIES,
  runRecordIsDegraded,
  type WatchCapability,
  type WatchChain,
  type WatchSensitivity,
} from '@/lib/map/monetization/watchModel';
import { entitlementConfig } from '@/lib/map/monetization/entitlement';

/**
 * PART IV §6.3 — THE COMPOSER. FULLY USABLE BEFORE PAYMENT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE COMMERCIAL PRINCIPLE, IN ONE COMPONENT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * "The composer is FULLY USABLE BEFORE PAYMENT. A free user may compose a Watch
 * of any complexity and see exactly what would be monitored. Payment is
 * requested only at activation."
 *
 * That is not generosity, it is the argument: a user who has built the
 * assignment knows what they would be buying, and a product confident in its
 * labour lets them see it first. So every field here works, signed in or out,
 * and nothing is gated, ghosted or truncated inside this panel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS HONESTLY ABSENT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NO WATCH BACKEND EXISTS. Composition is real and local; nothing is persisted,
 * because there is nothing to persist it to. The panel says so in its own footer
 * rather than implying a save that will not happen, and there is no button here
 * that could be mistaken for one — activation is a separate surface with its own
 * honest state.
 *
 * The RUN RECORD renders from `NO_RUN_RECORD` and therefore renders DEGRADED,
 * which is §6.4.2 working exactly as intended: "A Watch that cannot report when
 * it last ran renders degraded, not confident." A composer that showed a
 * confident record before anything had run would be the first lie in the chain.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT REPLACES THE STORY LIST
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * §2.2's consequences are explicit: "The composer REPLACES the story list while
 * open and restores it on close." It arrives in a `RailDrawer` for that reason —
 * over the rail, never below it, never lengthening the column.
 */

export interface WatchComposerLabels {
  readonly title: string;
  readonly scope: string;
  readonly ceiling: string;
  readonly topics: string;
  readonly topicOptions: Readonly<Record<string, string>>;
  readonly sensitivity: string;
  readonly sensitivities: Readonly<Record<WatchSensitivity, string>>;
  readonly sensitivityHint: Readonly<Record<WatchSensitivity, string>>;
  readonly runRecord: string;
  readonly lastChecked: string;
  readonly lastChange: string;
  readonly cadence: string;
  readonly evidence: string;
  readonly neverRun: string;
  readonly degradedNote: string;
  readonly instMark: string;
  readonly capabilityNote: string;
  readonly notPersisted: string;
  readonly chainLimitNote: string;
  readonly review: string;
  readonly removeLink: string;
}

export interface WatchComposerProps {
  readonly chain: WatchChain;
  readonly capability: WatchCapability;
  readonly labels: WatchComposerLabels;
  readonly topics: readonly string[];
  readonly selectedTopics: ReadonlySet<string>;
  readonly onToggleTopic: (topic: string) => void;
  readonly onRemoveLink: (id: string) => void;
  readonly onReview: (sensitivity: WatchSensitivity) => void;
}

export function WatchComposer({
  chain,
  capability,
  labels,
  topics,
  selectedTopics,
  onToggleTopic,
  onRemoveLink,
  onReview,
}: WatchComposerProps): JSX.Element {
  const [sensitivity, setSensitivity] = useState<WatchSensitivity>(DEFAULT_SENSITIVITY);

  /*
    ── THE CHAIN LIMIT IS A CONFIGURED VALUE, OR IT IS NOT STATED ────────────

    §12.1's permitted treatments are ghost, meter, shape and ceiling — a limit
    the user can SEE. But R2 keeps every chain-length figure open and forbids
    hard-coding one, so the limit is shown only where configuration supplies it.

    With no configuration there is no note and no silent refusal: a reader may
    compose any chain, which is the honest behaviour when the product cannot say
    what the ceiling is. Inventing "2" to have something to enforce would be a
    commercial claim, and inventing it as a suggestion would be the same claim
    in a quieter voice.
  */
  const entitlement = entitlementConfig();
  const chainCeiling = entitlement === null ? null : entitlement.chainLinks;
  const overChainCeiling =
    typeof chainCeiling === 'number' && chain.length > chainCeiling;

  const degraded = runRecordIsDegraded(NO_RUN_RECORD);

  return (
    <div data-gn="watch-composer" className="flex flex-col gap-[16px]">
      {/* ── SCOPE — the chain, each link showing its OWN ceiling ─────────── */}
      <section data-gn="composer-scope">
        <h3 className="mb-[7px] font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-ink-3">
          {labels.scope}
        </h3>

        <ol className="flex flex-col gap-[5px]">
          {chain.map((subject, index) => (
            <li
              key={subject.id}
              data-gn="composer-link"
              data-gn-ceiling={subject.ceiling}
              className="flex items-center gap-[9px] rounded-[2px] border border-sp-line-2 bg-sp-panel-2 px-[10px] py-[9px]"
            >
              <span
                aria-hidden="true"
                className="font-gn-mono text-[9px] tabular-nums text-sp-ink-3"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-sp-ink">
                {subject.label}
              </span>
              {/*
                THE PER-LINK CEILING. §6.2: the Rwanda leg does not inherit
                Mombasa's city-level confidence, so the ceiling is rendered on
                the LINK and never summarised for the chain.
              */}
              <span
                data-gn="composer-link-ceiling"
                title={labels.ceiling}
                className="shrink-0 rounded-[2px] border border-sp-line-2 px-[5px] py-[2px] font-gn-mono text-[8px] uppercase tracking-[0.12em] text-sp-ink-3"
              >
                {/*
                  THE LEVEL AS THE NAVIGATOR SUPPLIED IT. Not mapped, not
                  translated locally, not assumed to be one of four: G's ladder
                  now reaches Rwanda's Sector and Kenya's Ward, and a local
                  lookup table would be a claim about how a country is
                  administered. The code is the fallback because a wrong NAME is
                  worse than an unfamiliar code.
                */}
                {subject.ceilingLabel ?? subject.ceiling}
              </span>
              <button
                type="button"
                data-gn="composer-remove-link"
                aria-label={`${labels.removeLink} ${subject.label}`}
                onClick={() => onRemoveLink(subject.id)}
                className="shrink-0 font-gn-mono text-[11px] leading-none text-sp-ink-3 outline-none transition-colors hover:text-sp-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sp-cyan"
              >
                ×
              </button>
            </li>
          ))}
        </ol>

        {overChainCeiling && (
          <p
            data-gn="composer-chain-limit"
            className="mt-[7px] border-s-2 border-sp-capability-line ps-[8px] font-gn-mono text-[9px] uppercase leading-[1.6] tracking-[0.1em] text-sp-ink-3"
          >
            {labels.chainLimitNote}
          </p>
        )}
      </section>

      {/* ── MONITORED TOPICS — chips narrow what COUNTS as a change ──────── */}
      <section data-gn="composer-topics">
        <h3 className="mb-[7px] font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-ink-3">
          {labels.topics}
        </h3>
        <div className="flex flex-wrap gap-[5px]">
          {topics.map((topic) => {
            const on = selectedTopics.has(topic);

            return (
              <button
                key={topic}
                type="button"
                data-gn="composer-topic"
                data-gn-selected={on ? 'true' : 'false'}
                aria-pressed={on}
                onClick={() => onToggleTopic(topic)}
                className={`min-h-[30px] rounded-[2px] border px-[9px] py-[6px] font-gn-mono text-[9px] uppercase tracking-[0.1em] outline-none transition-[color,background-color,border-color] duration-[140ms] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-sp-cyan ${
                  on
                    ? 'border-sp-cyan/50 bg-sp-cyan/[0.16] text-sp-cyan'
                    : 'border-[rgba(126,166,186,.14)] bg-[rgba(126,166,186,.045)] text-sp-ui-idle hover:border-[rgba(126,166,186,.3)] hover:text-sp-ui-hover'
                }`}
              >
                {labels.topicOptions[topic] ?? topic}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── ALERT SENSITIVITY — four options, one Institutional ──────────── */}
      <section data-gn="composer-sensitivity">
        <h3 className="mb-[7px] font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-ink-3">
          {labels.sensitivity}
        </h3>
        <div role="radiogroup" aria-label={labels.sensitivity} className="flex flex-col gap-[4px]">
          {WATCH_SENSITIVITIES.map((value) => {
            const institutional = INSTITUTIONAL_SENSITIVITIES.includes(value);
            const active = value === sensitivity;

            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                data-gn="composer-sensitivity-option"
                data-gn-value={value}
                data-gn-locked={institutional ? 'true' : 'false'}
                disabled={institutional}
                onClick={() => { if (!institutional) setSensitivity(value); }}
                /*
                  GHOSTED, NOT REMOVED. §12.1's first and preferred treatment:
                  "control visible, readable, 45% opacity, violet left edge, tier
                  mark". The user can see what the product does before deciding
                  to pay — removing the option would teach them nothing, and
                  blurring it is explicitly forbidden by §12.2.
                */
                className={`flex items-start gap-[8px] rounded-[2px] border px-[10px] py-[8px] text-start outline-none transition-[color,background-color,border-color] duration-[140ms] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-sp-cyan ${
                  institutional
                    ? 'cursor-default border-s-2 border-l-sp-capability-line border-y-sp-line-3 border-r-sp-line-3 opacity-45'
                    : active
                      ? 'border-sp-watch-line bg-sp-watch-dim'
                      : 'border-[rgba(126,166,186,.14)] hover:border-[rgba(126,166,186,.3)]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-[3px] block h-[9px] w-[9px] shrink-0 rounded-full border ${
                    active ? 'border-sp-watch bg-sp-watch' : 'border-sp-line-2'
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-[6px]">
                    <span className="font-gn-mono text-[9.5px] uppercase tracking-[0.1em] text-sp-ink">
                      {labels.sensitivities[value]}
                    </span>
                    {institutional && (
                      /* A 1px edge and an 8px label. No gold, no crown, no fill. */
                      <span
                        data-gn="tier-mark"
                        data-gn-tier="INST"
                        className="rounded-[2px] border border-sp-capability-line px-[4px] py-px font-gn-mono text-[8px] uppercase tracking-[0.12em] text-sp-capability"
                      >
                        {labels.instMark}
                      </span>
                    )}
                  </span>
                  <span className="mt-[2px] block text-[11px] leading-[1.45] text-sp-ink-3">
                    {labels.sensitivityHint[value]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── RUN RECORD — degraded, because nothing has run ───────────────── */}
      <section data-gn="composer-run-record">
        <h3 className="mb-[7px] font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-ink-3">
          {labels.runRecord}
        </h3>
        <dl
          data-gn-degraded={degraded ? 'true' : 'false'}
          className="grid grid-cols-2 gap-px border-y border-sp-line bg-sp-line"
        >
          {[
            [labels.lastChecked, NO_RUN_RECORD.lastCheckedIso],
            [labels.lastChange, NO_RUN_RECORD.lastMaterialChangeIso],
            [labels.cadence, NO_RUN_RECORD.cadenceLabel],
            [
              labels.evidence,
              NO_RUN_RECORD.evidenceCount === null ? null : String(NO_RUN_RECORD.evidenceCount),
            ],
          ].map(([term, value]) => (
            <div key={String(term)} className="bg-sp-panel px-[9px] py-[8px]">
              <dt className="font-gn-mono text-[8px] uppercase tracking-[0.12em] text-sp-ink-3">
                {term}
              </dt>
              {/*
                A DASH, NOT A ZERO. A Watch that has never run has not run zero
                times — it has no record — and the two must not look the same.
              */}
              <dd className="mt-[3px] font-gn-mono text-[11px] text-sp-ink-2">
                {value ?? labels.neverRun}
              </dd>
            </div>
          ))}
        </dl>
        {degraded && (
          <p
            data-gn="composer-degraded-note"
            className="mt-[7px] text-[11px] leading-[1.5] text-sp-ink-3"
          >
            {labels.degradedNote}
          </p>
        )}
      </section>

      {/* ── REVIEW — the only way forward, and it opens the activation panel */}
      <div className="flex flex-col gap-[8px] border-t border-sp-line pt-[12px]">
        <button
          type="button"
          data-gn="composer-review"
          onClick={() => onReview(sensitivity)}
          className="flex min-h-[44px] w-full items-center justify-center rounded-[2px] border border-sp-watch-line px-[10px] py-[11px] font-gn-mono text-[10px] uppercase tracking-[0.14em] text-sp-watch outline-none transition-[color,background-color,border-color] duration-[160ms] hover:bg-sp-watch-dim focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sp-watch"
        >
          {labels.review}
        </button>

        {/*
          TWO CAVEATS, BOTH REQUIRED, BOTH STATED BEFORE THE USER ACTS.

          The first is that the figures in this panel are placeholders — §6.5
          says so of its own table, and a number rendered as fact is how a
          placeholder becomes a commitment nobody approved.

          The second is that nothing composed here is stored. That is a fact
          about this build, not a feature, and the user learns it here rather
          than by losing their work.
        */}
        <p
          data-gn="composer-capability-note"
          className="font-gn-mono text-[9px] uppercase leading-[1.6] tracking-[0.1em] text-sp-ink-3"
        >
          {labels.capabilityNote}
        </p>
        <p data-gn="composer-not-persisted" className="text-[11px] leading-[1.5] text-sp-ink-3">
          {labels.notPersisted}
        </p>
      </div>
    </div>
  );
}
