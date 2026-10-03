'use client';

import { useEffect, useState } from 'react';
import { askV2Api, type AskV2BriefingSummary } from '@/lib/api/askV2Api';
import { briefingStrings } from '@/lib/ask/briefingStrings';
import type { AskLocale } from '@/lib/ask/askStrings';
import { BriefingListView } from './BriefingViews';

/**
 * R2 · D1 — the Briefings section of Saved. One read of the reader's own list (0 AI). When the
 * server has briefings off (404) or the reader is signed out, the section is not shown at all:
 * the existing Saved Questions surface is unchanged.
 */
export function SavedBriefings({ locale }: { readonly locale: AskLocale }): JSX.Element | null {
  const t = briefingStrings(locale);
  const [rows, setRows] = useState<readonly AskV2BriefingSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void askV2Api.briefings().then((result) => {
      if (!cancelled && result.ok) setRows(result.value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows === null) return null;
  return (
    <section data-saved-panel="briefings" className="mx-auto mt-8 max-w-3xl">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
        {t.sectionTitle}
      </h2>
      <p className="mt-1 text-[12.5px] text-ink-tertiary">{t.sectionIntro}</p>
      <BriefingListView rows={rows} locale={locale === 'pl' ? 'pl' : 'en'} />
    </section>
  );
}
