'use client';

import type { JSX, ReactNode } from 'react';
import { ASK_ABSENT, SUGGESTION_CATEGORIES } from '@/lib/ask/askFrame';
import type { AskStrings } from '@/lib/ask/askStrings';

/** Presentation primitives recovered from the v1.8 authority preview. */
export const ASK_MICRO = 'font-mono text-[10px] uppercase tracking-[0.14em] text-sp-ink-3';
export const ASK_LABEL = 'font-mono text-[11px] uppercase tracking-[0.12em] text-sp-ink-2';
const PANEL = 'border border-sp-line bg-sp-panel';

/**
 * A REGION. Present or absent — never "present but pretending".
 *
 * `data-ask-region` is what the first-viewport guard walks, so the id is the
 * contract rather than the heading text, which a translator may change.
 */
export function Region({
  id,
  label,
  children,
  className = '',
}: {
  readonly id: string;
  readonly label: string;
  readonly children?: ReactNode;
  readonly className?: string;
}): JSX.Element {
  return (
    <section data-ask-region={id} aria-label={label} className={className}>
      <h2 className={`${ASK_LABEL} mb-[6px]`}>{label}</h2>
      {children}
    </section>
  );
}

/**
 * A QUIET STATEMENT.
 *
 * No value parameter, deliberately. The Market round learned this the hard way:
 * a statement component that could print a value printed the same sentence four
 * times on one screen the moment there was no value to print. This one renders
 * the sentence it was given and nothing else.
 */
export function Statement({ text }: { readonly text: string }): JSX.Element {
  return (
    <p data-ask="statement" className="text-[12px] leading-[1.55] text-sp-ink-2">
      {text}
    </p>
  );
}

/** The absent mark. It is a mark, not a number, and it never becomes one. */
export function Absent({ label }: { readonly label: string }): JSX.Element {
  return (
    <span data-ask="absent" className="inline-flex items-baseline gap-[6px]">
      <span className={ASK_MICRO}>{label}</span>
      <span className="font-mono text-[13px] text-sp-ink-3" aria-label={`${label}: ${ASK_ABSENT}`}>
        {ASK_ABSENT}
      </span>
    </span>
  );
}

/**
 * A CHANGE-STATE CHIP POSITION, WITH NO STATE IN IT.
 *
 * Specification §9: the seven states are inherited and Ask introduces none of
 * its own. At Alpha no change record reaches this frame, so the chip's PLACE is
 * rendered and no member is selected — the same discipline the Security
 * severity ladder uses, and for the same reason: showing the instrument is
 * honest, showing a reading is not.
 */
export function ChangeChipSlot({ label }: { readonly label: string }): JSX.Element {
  return (
    <span
      data-ask="change-chip-slot"
      data-ask-selected="false"
      className="inline-flex items-center gap-[6px] rounded-[3px] border border-dashed border-sp-line px-[7px] py-[3px]"
    >
      <span className={ASK_MICRO}>{label}</span>
      <span className="font-mono text-[11px] text-sp-ink-3">{ASK_ABSENT}</span>
    </span>
  );
}

/**
 * A SUGGESTED-QUESTION ROW THAT CANNOT CARRY A QUESTION.
 *
 * It takes a CATEGORY and nothing else. Specification §6 names five categories
 * and says the rows come from the change digest; Master Authority §12 says the
 * digest is what feeds them; the digest does not exist here. So the row shows
 * where a question of that kind will sit, carries its change-state chip
 * position, and prints the absent mark where the question goes.
 *
 * No handler: a row that looked pressable and did nothing
 * is the dead-control case this codebase has already ruled against by name.
 */
export function SuggestionRow({
  category,
  categoryLabel,
  stateLabel,
}: {
  readonly category: string;
  readonly categoryLabel: string;
  readonly stateLabel: string;
}): JSX.Element {
  return (
    <li
      data-ask="suggestion-row"
      data-ask-category={category}
      className="flex min-h-[44px] items-center justify-between gap-[10px] border-b border-sp-line px-[10px] py-[9px] last:border-b-0"
    >
      <span className="flex items-center gap-[9px]">
        <ChangeChipSlot label={stateLabel} />
        <span className="font-mono text-[13px] text-sp-ink-3">{ASK_ABSENT}</span>
      </span>
      <span className={ASK_MICRO}>{categoryLabel}</span>
    </li>
  );
}

/** The five rows, in the specification's order. The list is never shortened. */
export function SuggestionList({ t }: { readonly t: AskStrings }): JSX.Element {
  return (
    <ul data-ask="suggestions" className={`${PANEL} rounded-[4px]`}>
      {SUGGESTION_CATEGORIES.map((category) => (
        <SuggestionRow
          key={category}
          category={category}
          categoryLabel={t.suggestionCategories[category]}
          stateLabel={t.regions.changeStrip}
        />
      ))}
    </ul>
  );
}

/** Persistent composer; only form submission starts analysis. */
export function Composer({
  value,
  onChange,
  inputLabel,
  placeholder,
  submitLabel,
  costNote,
  onSubmit,
  pending = false,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly inputLabel: string;
  readonly placeholder: string;
  readonly submitLabel: string;
  readonly costNote: string;
  readonly onSubmit?: () => void;
  readonly pending?: boolean;
}): JSX.Element {
  return (
    <form
      data-ask="composer"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
      className={`${PANEL} rounded-[4px] p-[10px]`}
    >
      <label className="sr-only" htmlFor="ask-frame-composer">
        {inputLabel}
      </label>
      <textarea
        id="ask-frame-composer"
        data-ask="composer-input"
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={1000}
        className="w-full resize-none bg-transparent text-[13px] leading-[1.5] text-sp-ink placeholder:text-sp-ink-3 focus:outline-none"
      />
      {/*
        THE COST MARKER GETS ITS OWN LINE.
        `AI-COST-MAP.md` enforcement rule 1 requires it in the same surface that
        triggers the spend, and at 452px it was wrapping to two lines beside the
        button and reading as a caption on it. Above the row it is a statement
        about the action, which is what it is.
      */}
      <p className={`${ASK_MICRO} mt-[8px] normal-case tracking-normal`}>{costNote}</p>
      <div className="mt-[7px] flex items-center justify-end gap-[10px]">
        <button
          type="submit"
          data-ask="composer-submit"
          disabled={pending || !value.trim() || !onSubmit}
          className="inline-flex min-h-[44px] items-center rounded-[4px] border border-sp-cyan/55 bg-sp-cyan/15 px-[16px] text-[12px] font-semibold text-sp-cyan"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

/**
 * THE VIOLET TIER BOUNDARY, IN THE MONETIZATION LANGUAGE'S OWN WORDS.
 *
 * `spatial.monetization.activation.unavailableTitle` / `unavailableBody` are
 * the product's accepted answer to "why can I not turn this on": *"No
 * activation or entitlement contract is configured for monitoring, so nothing
 * here can be activated or charged for."* Reused verbatim, in EN and PL,
 * rather than re-worded — a second phrasing of the same state is a second
 * product answer.
 *
 * Violet because Part IV assigns violet to a tier boundary and this is one.
 * Never gold: activation §12, and the codebase's own rule that mint, violet and
 * sand are the whole language.
 */
export function TierBoundary({
  title,
  body,
}: {
  readonly title: string;
  readonly body: string;
}): JSX.Element {
  return (
    <div
      data-ask="tier-boundary"
      className="rounded-[4px] border border-[#3d3266] bg-[rgba(45,36,80,.45)] p-[10px]"
    >
      <p className="text-[12px] font-semibold text-[#b9a2f0]">{title}</p>
      <p className="mt-[4px] text-[11px] leading-[1.5] text-sp-ink-2">{body}</p>
    </div>
  );
}
