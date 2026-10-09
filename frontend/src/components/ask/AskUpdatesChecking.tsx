'use client';

import { useId, type JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askR3FullStrings } from '@/lib/ask/askR3FullStrings';

/**
 * ASK R3 FULL DESIGN R1 — D14 "How updates are checked" (prototype `vSchedule`).
 *
 * TRUTHFUL BY CONSTRUCTION. The only checking that exists is the reader's own manual check, so
 * "When I choose" is the one selected option and the in-page location is the one delivery. Daily,
 * Weekly, Email and Push are drawn as the design labels them — "coming later", DISABLED — and
 * nothing here is a control that changes anything (there is no schedule store and no scheduler).
 * The design's timezone row is omitted: with no scheduled check there is no time to localise.
 * The design's "manual checks stay free" clause is omitted: a check counts toward daily use.
 */
export function AskUpdatesChecking({ locale }: { readonly locale: DisplayLocale }): JSX.Element {
  const s = askR3FullStrings(locale);
  const name = useId();
  const row = 'flex items-start gap-3 py-1.5 text-[14px]';
  return (
    <details data-ask="updates-checking" className="rounded-lg border border-line px-4 py-3">
      <summary className="min-h-[44px] cursor-pointer py-2 text-[15px] font-semibold text-ink-primary">
        {s.howChecked}
      </summary>
      <fieldset className="mt-2">
        <legend className="text-[13px] font-semibold text-ink-secondary">{s.whenToCheck}</legend>
        <label className={row}>
          <input type="radio" name={name} checked readOnly className="mt-1" />
          <span className="flex flex-col">
            <span className="text-ink-primary">{s.whenIChoose}</span>
            <span className="text-[13px] text-ink-tertiary">{s.whenIChooseNote}</span>
          </span>
        </label>
        <label className={row}>
          <input type="radio" name={name} disabled className="mt-1" />
          <span className="flex flex-col">
            <span className="text-ink-tertiary">{s.dailyLater}</span>
            <span className="text-[13px] text-ink-tertiary">{s.dailyLaterNote}</span>
          </span>
        </label>
        <label className={row}>
          <input type="radio" name={name} disabled className="mt-1" />
          <span className="flex flex-col">
            <span className="text-ink-tertiary">{s.weeklyLater}</span>
            <span className="text-[13px] text-ink-tertiary">{s.notAvailableYet}</span>
          </span>
        </label>
      </fieldset>
      <fieldset className="mt-3">
        <legend className="text-[13px] font-semibold text-ink-secondary">{s.whereUpdates}</legend>
        <label className={row}>
          <input type="checkbox" checked disabled readOnly className="mt-1" />
          <span className="text-ink-primary">{s.inMyUpdates}</span>
        </label>
        <label className={row}>
          <input type="checkbox" disabled className="mt-1" />
          <span className="text-ink-tertiary">{s.emailLater}</span>
        </label>
        <label className={row}>
          <input type="checkbox" disabled className="mt-1" />
          <span className="text-ink-tertiary">{s.pushLater}</span>
        </label>
      </fieldset>
      <p className="mt-3 flex flex-col gap-0.5 text-[13px]">
        <span className="font-semibold text-ink-secondary">{s.plansHeading}</span>
        <span className="text-ink-tertiary">{s.plansNote}</span>
      </p>
    </details>
  );
}
