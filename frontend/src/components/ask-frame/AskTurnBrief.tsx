'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  askR2PayloadOf,
  askV2Api,
  type AskV2BriefingSummary,
  type AskV2Operation,
} from '@/lib/api/askV2Api';
import { briefingStrings, briefingsAvailable } from '@/lib/ask/briefingStrings';
import type { AskR2Locale } from '@/lib/ask/askR2Strings';
import { ASK_SAVABLE_ANSWER_STATES } from './AskTurnSave';
import { briefingHref } from '@/components/ask/BriefingViews';

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
}: {
  readonly operation: AskV2Operation | undefined;
  readonly locale: AskR2Locale;
}): JSX.Element | null {
  const t = briefingStrings(locale);
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
    'block w-full rounded-[6px] px-2.5 py-2 text-start text-[12.5px] text-[#d6e2f0] hover:bg-[#07304f] disabled:opacity-60';

  return (
    <div data-ask="brief" className="relative inline-flex items-center gap-2">
      <button
        type="button"
        data-ask="brief-save"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy}
        onClick={() => void toggleMenu()}
        className="inline-flex min-h-[32px] items-center gap-1.5 rounded-[8px] border border-[#1d4a73] px-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#b6c9de] hover:border-[#5abff5] disabled:opacity-60"
      >
        {busy ? t.saving : t.save}
      </button>
      {open && (
        <div
          role="menu"
          data-ask="brief-menu"
          className="absolute end-0 top-full z-20 mt-1 w-[260px] rounded-[10px] border border-[#1d4a73] bg-[#04162b] p-1 shadow-lg"
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
            <p className="px-2.5 pb-1 pt-2 text-[11px] text-[#8299b4]">{t.addTo}</p>
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
        <span data-ask="brief-failed" role="status" className="text-[12px] text-[#c9b27a]">
          {t.failed}
        </span>
      )}
      {result !== null && result !== 'failed' && (
        <span data-ask="brief-saved" role="status" className="text-[12px] text-[#8fd3ff]">
          {t.savedAs(result.version)} ·{' '}
          <Link href={briefingHref(result.id)} className="underline">
            {t.open}
          </Link>
        </span>
      )}
    </div>
  );
}
