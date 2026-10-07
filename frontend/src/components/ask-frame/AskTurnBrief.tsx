'use client';
import type { DisplayLocale } from '@globalnews-ai/shared';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  askR2PayloadOf,
  askV2Api,
  type AskV2BriefingSummary,
  type AskV2Operation,
} from '@/lib/api/askV2Api';
import { briefingStrings, briefingsAvailable } from '@/lib/ask/briefingStrings';
import { ASK_SAVABLE_ANSWER_STATES } from './AskTurnSave';
import { briefingHref } from '@/components/ask/BriefingViews';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';

/** How many of the reader's briefings the "add as next version" list offers. */
export const BRIEFING_MENU_LIMIT = 5;

/**
 * R2 · D1 — "Save as briefing" on the reader's own stored answer.
 *
 * Shown only where Save is (a signed-in reader's COMPLETED, produced answer) and only when the
 * server has briefings switched on (one shared probe; off = hidden). The reader either starts a
 * NEW briefing from this answer or adds it as the NEXT VERSION of one they already have (the
 * update after a followed story changed). Each press is one request; the state shown is the
 * server's answer. Zero AI, zero provider: saving copies our stored output and its source
 * references, never runs anything.
 */
export function AskTurnBrief({
  operation,
  locale,
  label,
}: {
  readonly operation: AskV2Operation | undefined;
  readonly locale: DisplayLocale;
  /**
   * ASK DESIGN COMPLETENESS R1 — the Design's More-menu wording ("Use in a briefing"). The
   * control still renders ONLY when the server has briefings on, so the label never appears
   * beside nothing.
   */
  readonly label?: string;
}): JSX.Element | null {
  const t = askShellStrings(locale).briefingStrings;
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<readonly AskV2BriefingSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { readonly id: string; readonly version: number } | 'failed' | null
  >(null);
  const inFlight = useRef(false);
  const turnId = operation?.turnId ?? null;
  const state = askR2PayloadOf(operation)?.answer.state;
  const eligible =
    turnId !== null &&
    operation?.status === 'COMPLETED' &&
    operation.result !== null &&
    state !== undefined &&
    ASK_SAVABLE_ANSWER_STATES.has(state);

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    void briefingsAvailable(() => askV2Api.briefings()).then((on) => {
      if (!cancelled) setAvailable(on);
    });
    return () => {
      cancelled = true;
    };
  }, [eligible]);

  if (!eligible || !available) return null;

  async function toggleMenu(): Promise<void> {
    const next = !open;
    setOpen(next);
    if (!next) return;
    const list = await askV2Api.briefings();
    if (list.ok) setMine(list.value.slice(0, BRIEFING_MENU_LIMIT));
  }

  async function save(target: string | null): Promise<void> {
    if (inFlight.current || turnId === null) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const outcome =
        target === null
          ? await askV2Api.createBriefing(turnId)
          : await askV2Api.addBriefingVersion(target, turnId);
      if (!outcome.ok) setResult('failed');
      else
        setResult({
          id: 'id' in outcome.value ? outcome.value.id : outcome.value.briefingId,
          version: outcome.value.version,
        });
      setOpen(false);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const item =
    'block min-h-[44px] w-full rounded-[6px] px-2.5 py-2 text-start text-[0.9375rem] text-[var(--ad-ink,#edeff5)] hover:bg-[var(--ad-surface-2,#161d2c)] disabled:opacity-60';

  return (
    <div data-ask="brief" className="flex w-full flex-col items-start gap-1">
      <button
        type="button"
        data-ask="brief-save"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy}
        onClick={() => void toggleMenu()}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[8px] px-0 text-start text-[1.0625rem] text-[var(--ad-ink,#edeff5)] disabled:opacity-60"
      >
        {busy ? t.saving : (label ?? t.save)}
      </button>
      {open && (
        <div
          role="menu"
          data-ask="brief-menu"
          className="mt-1 w-full rounded-[10px] border border-[var(--ad-line,#1e2636)] bg-[var(--ad-surface,#0f1420)] p-1"
        >
          <button
            type="button"
            role="menuitem"
            data-ask="brief-new"
            disabled={busy}
            onClick={() => void save(null)}
            className={item}
          >
            {t.newBriefing}
          </button>
          {mine.length > 0 && (
            <p className="px-2.5 pb-1 pt-2 text-[0.8125rem] text-[var(--ad-ink-3,#7d89a1)]">{t.addTo}</p>
          )}
          {mine.map((b) => (
            <button
              key={b.id}
              type="button"
              role="menuitem"
              data-ask="brief-add"
              disabled={busy}
              onClick={() => void save(b.id)}
              className={item}
            >
              {b.title}
            </button>
          ))}
        </div>
      )}
      {result === 'failed' && (
        <span data-ask="brief-failed" role="status" className="text-[0.8125rem] text-[var(--ad-err,#ff8a7a)]">
          {t.failed}
        </span>
      )}
      {result !== null && result !== 'failed' && (
        <span data-ask="brief-saved" role="status" className="text-[0.8125rem] text-[var(--ad-accent-text,#6c93ff)]">
          {t.savedAs(result.version)} ·{' '}
          <Link href={briefingHref(result.id)} className="underline">
            {t.open}
          </Link>
        </span>
      )}
    </div>
  );
}
