'use client';

import type { JSX } from 'react';
import { MessagesSquare } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { openGlobalAsk } from '@/lib/ask/openGlobalAsk';
import { fill } from '@/components/home/reva/homeRevaModel';

/**
 * PHONE-FIRST HOME CORRECTION R1 · §7 — the separately labelled Ask offer on a no-results search.
 * It only OPENS the one Ask with the query staged (openGlobalAsk): nothing runs until the reader
 * presses Send there. Search itself never calls Ask.
 */
export function AskAboutQuery({ query, language }: { readonly query: string; readonly language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).visual.home;
  return (
    <div>
      <button
        type="button"
        data-story-search-ask=""
        onClick={() => openGlobalAsk(query)}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] border border-[var(--gt-line)] px-3 text-[0.875rem] font-semibold text-[var(--gt-link)] hover:border-[var(--gt-act)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
      >
        <MessagesSquare aria-hidden="true" className="h-4 w-4" />
        <span dir="auto">{fill(t.resultsNoneAsk, { query })}</span>
      </button>
      <p className="mt-1 text-[0.75rem] text-[var(--gt-ink2)]">{t.resultsNoneAskNote}</p>
    </div>
  );
}
