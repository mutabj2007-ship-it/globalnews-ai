'use client';

import { useState } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import type { WatchNextEntry } from './analysisClaims';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';

/**
 * H2D — E-25 Watch Next.
 *
 * Forward indicators the analysis itself named, kept distinct from
 * uncertainty (what the evidence does not settle) and from effects
 * (what has already happened).
 *
 * THE ACCENT IS DELIBERATE AND IS NOT AMBER. R1 is explicit: these are
 * interpretation, not evidentiary gaps, and colouring them like
 * uncertainty would tell the reader something false about their status.
 * They take --gn-ai, the same register as the executive brief.
 *
 * THE QUALIFIER IS PART OF THE ACCESSIBLE NAME. "AI-projected, not a
 * forecast" is not decoration that can be lost to colour, layout or a
 * screen reader — it is in the region's own label.
 *
 * THIS IS THE ANALYSIS'S WATCH NEXT, AND NOTHING ELSE. It is not a
 * follow list, not a watchlist, not an alert and not a notification. It
 * persists nothing: this array lives exactly as long as the response
 * object it came from. No storage, no subscription, no identity.
 */

const PREVIEW_COUNT = 3;

export interface WatchNextModuleProps {
  entries: readonly WatchNextEntry[];
  language?: LanguageCode;
}

export function WatchNextModule({
  entries,
  language = 'en',
}: WatchNextModuleProps): JSX.Element | null {
  const dict = getDictionary(language).analysisWorkspace;
  const t = dict.watchNext;
  const [expanded, setExpanded] = useState(false);

  /* Absent field -> module not rendered. Never an empty panel. */
  if (entries.length === 0) return null;

  const visible = expanded ? entries : entries.slice(0, PREVIEW_COUNT);

  return (
    <section
      aria-label={`${t.heading}, ${t.qualifier}, ${pluralWithForms(entries.length, language, dict.itemForms)}`}
      className="mt-3 rounded-gn-module border border-gn-line-ai bg-gn-ai-wash px-[14px] py-[13px]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-gn-mono text-gn-hud-label uppercase text-gn-brief-label">
          {t.heading}
        </span>
        <span className="rounded-[4px] bg-gn-line-strong px-[6px] py-[1px] font-gn-mono text-gn-hud-cell text-gn-ink-chip">
          {entries.length}
        </span>
      </div>

      {/* Visible as well as assistive — the reader must see what this is. */}
      <p className="mt-[6px] font-gn-mono text-gn-hud-micro uppercase text-gn-disabled">
        {t.qualifier}
      </p>

      <ul className="mt-3 flex list-none flex-col gap-[10px] p-0">
        {visible.map((entry) => (
          <li key={`${entry.ordinal}-${entry.hingeType}`} className="flex gap-[10px]">
            {/* Square, not the dot used for status — R1 HUD distinction. */}
            <span aria-hidden="true" className="mt-[6px] h-[6px] w-[6px] shrink-0 bg-gn-ai" />
            <div className="min-w-0 flex-1">
              <p className="font-gn-display text-gn-watch text-gn-ink-watch">{entry.claim}</p>
              <p className="mt-[3px] font-gn-mono text-gn-hud-micro uppercase text-gn-hud-faint">
                {t.hingeTypes[entry.hingeType]}
                {entry.uncited && ` · ${dict.claim.uncited}`}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {entries.length > PREVIEW_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="mt-3 font-gn-mono text-gn-hud-toggle uppercase text-gn-ink-toggle transition-colors duration-[120ms] hover:text-gn-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
        >
          {expanded ? t.showLess : `${t.showAll} ${entries.length}`}
        </button>
      )}
    </section>
  );
}
