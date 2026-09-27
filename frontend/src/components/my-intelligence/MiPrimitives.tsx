'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import {
  MI_BANNER_DEGRADED,
  MI_BANNER_ERROR,
  MI_CHIP,
  MI_SAND_TAG,
  MI_SAVED_OFF,
  MI_SAVED_ON,
  MI_TARGET,
} from './miPresentation';

/** Fills {name}-style placeholders. One helper, so no component invents its own. */
export function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce<string>(
    (out, [key, value]) => out.split(`{${key}}`).join(String(value)),
    template,
  );
}

/**
 * The bookmark control.
 *
 * `aria-pressed` rather than a checkbox role, because this is a toggle button
 * on an object, not a form field. `type="button"` matters more than it looks:
 * on Home this control sits beside a link inside a card, and a submit-typed
 * button there would behave differently under Enter.
 */
export function BookmarkButton({
  isSaved,
  onToggle,
  language,
  className = '',
  size = 'default',
}: {
  isSaved: boolean;
  onToggle: () => void;
  language: LanguageCode;
  className?: string;
  /**
   * UNIVERSAL BOOKMARK R1 — 44px wherever the geometry permits (the default).
   * 'compact' (32px) only on dense rows whose own controls are smaller, such as
   * the Spatial map source card; same states, same labels, same colours.
   */
  size?: 'default' | 'compact';
}): JSX.Element {
  const t = getDictionary(language).myIntelligence.saved;
  const box = size === 'compact' ? 'h-[32px] w-[32px]' : 'h-[44px] w-[44px]';
  const glyph = size === 'compact' ? 'h-[15px] w-[15px]' : 'h-[18px] w-[18px]';

  return (
    <button
      type="button"
      aria-pressed={isSaved}
      aria-label={isSaved ? t.unsave : t.save}
      title={isSaved ? t.unsave : t.save}
      onClick={(event) => {
        /*
          THE WHOLE REASON THIS IS NOT AN OVERLAY.

          On Home the story card is an `<a target="_blank">` around the image
          and headline. R1.2 places this button in the source/meta row as a
          SIBLING of that link, never nested inside it. These two calls are the
          belt and braces for the case where a future layout nests it anyway:
          without them a save would also open a publisher tab.
        */
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      data-bookmark={isSaved ? 'saved' : 'unsaved'}
      className={`inline-flex ${box} items-center justify-center rounded-full border bg-[#04162b]/80 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#5abff5] focus-visible:ring-offset-1 focus-visible:ring-offset-[#010a19] motion-reduce:transition-none ${
        isSaved ? MI_SAVED_ON : MI_SAVED_OFF
      } ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={glyph}
        fill={isSaved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      >
        <path d="M6 4.5h12a1 1 0 0 1 1 1V20l-7-4-7 4V5.5a1 1 0 0 1 1-1Z" />
      </svg>
    </button>
  );
}

/** Category chip. Neutral by design: category colour is Home's concern, not this surface's. */
export function CategoryChip({ label }: { label: string }): JSX.Element {
  return (
    <span
      className={`${MI_CHIP} inline-flex items-center border border-[#1d3a5a] bg-[#07203a] px-[6px] py-[2px] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#93cdf5]`}
    >
      {label}
    </span>
  );
}

/** Two-letter country chip used in the New-since rows. */
export function CountryChip({ code }: { code: string }): JSX.Element {
  return (
    <span
      className={`${MI_CHIP} inline-flex min-w-[26px] items-center justify-center border border-[#1d3a5a] bg-[#07203a] px-[5px] py-[2px] text-[11px] font-semibold tracking-[0.04em] text-[#93cdf5]`}
    >
      {code.slice(0, 2).toUpperCase()}
    </span>
  );
}

/**
 * The sand "AI" tag.
 *
 * Part IV's compute boundary, and the only thing on this surface allowed to
 * say that AI is involved before the user presses anything. It carries no
 * number: Sand charging is off and the fixture quotes are not prices.
 */
export function AiTag({ label }: { label: string }): JSX.Element {
  return (
    <span className={`${MI_SAND_TAG} ${MI_CHIP} inline-flex items-center px-[4px] py-[2px]`}>
      {label}
    </span>
  );
}

export function StatusBanner({
  tone,
  children,
  action,
}: {
  tone: 'degraded' | 'error';
  children: React.ReactNode;
  action?: React.ReactNode;
}): JSX.Element {
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-[12px] px-4 py-3 text-[13px] ${
        tone === 'error' ? MI_BANNER_ERROR : MI_BANNER_DEGRADED
      }`}
    >
      <span>{children}</span>
      {action}
    </div>
  );
}

/**
 * The development-fixture banner.
 *
 * Not decoration and not a design element — it is the control that keeps this
 * lane honest. The Product Owner's instruction was explicit: do not represent
 * fixture data as live production capability. Whenever any section on this
 * page is fixture-backed, this renders, and it does not dismiss.
 */
export function FixtureBanner({ language }: { language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).myIntelligence;

  return (
    <div
      role="note"
      className="flex flex-col gap-1 rounded-[12px] border border-dashed border-[#6a5634] bg-[#2e2618] px-4 py-3"
    >
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#D9B98A]">
        {t.fixtureBanner}
      </span>
      <span className="text-[12px] leading-[1.45] text-[#c9b48c]">{t.fixtureBannerDetail}</span>
    </div>
  );
}

/** The checkbox shown on every selectable story while selection mode is on. */
export function SelectCheckbox({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onChange();
      }}
      className={`${MI_TARGET} inline-flex h-[44px] w-[44px] items-center justify-center rounded-full border ${
        disabled
          ? 'border-[#24405e] text-[#54687e]'
          : checked
            ? 'border-[#1b6fa8] bg-[#07304f] text-[#5abff5]'
            : 'border-[#1d3a5a] text-[#cfe2f2]'
      }`}
    >
      {disabled ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] text-[#54687e]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M6 18 18 6" />
        </svg>
      ) : checked ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      ) : (
        <span aria-hidden="true" className="h-[18px] w-[18px] rounded-full border border-current" />
      )}
    </button>
  );
}
