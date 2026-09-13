'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * R7 `07` — THE WORKSPACE CTA, IN ITS TWO APPROVED POSITIONS.
 *
 * ONE component and one label, rendered at two densities, so the two positions
 * cannot drift into two different offers. `chrome` is the pinned header form
 * that must stay small enough not to steal the region label's line; `inline`
 * is the end-of-list form that has room to say why.
 *
 * WHAT IT DOES NOT DO: it does not pre-run anything. `02 §4`'s DEEP ANALYSIS
 * on a single row and this CTA both NAVIGATE — the homepage never precomputes
 * an analysis payload, which is the whole basis of the honest ③④⑤ states.
 *
 * ── R4 CORRECTION 2 — IT IS A FILLED PRIMARY ACTION ──────────────────────
 *
 * Both variants are now solid `ACTION_AMBER` on dark text at 700 weight. The
 * thin outline read as a tertiary link sitting beside ten bordered ANALYSE
 * controls that were louder than it — inverted priority, because the workspace
 * is the broader action and every row action is the narrower one.
 *
 * SOLID AMBER IS ALREADY THE PRESENTATION LANGUAGE'S WORD FOR ACTION, and it
 * is what `PresentationRibbon` gives DEEP ANALYSIS. Three surfaces now agree:
 * the row's ANALYSE (amber on a border), the ribbon's DEEP ANALYSIS (filled)
 * and this (filled). Nothing else on the surface is amber, so uncertainty
 * amber — a TINT, never a fill — stays unambiguous.
 *
 * The focus ring stays a 2px offset outline in the neutral focus blue rather
 * than an amber-on-amber ring that would vanish against the fill.
 */
const ACTION_AMBER = '#f59e0b';
/** Dark ink on amber. The page ground, so the control reads as cut out of it. */
const ACTION_INK = '#05080d';
interface WorkspaceCtaProps {
  variant: 'chrome' | 'inline';
  onOpen: () => void;
  language: LanguageCode;
}

export function WorkspaceCta({ variant, onOpen, language }: WorkspaceCtaProps): JSX.Element {
  const t = getDictionary(language).todayWorkspace.cta;

  if (variant === 'chrome') {
    return (
      <button
        type="button"
        onClick={onOpen}
        /*
          RIGHT-ALIGNED IN THE ANALYSE HEADER and outside the scroll region, so
          it stays visible for the whole list, never overlaps the scrollbar and
          never covers the first record — the header is its own track above the
          body, at ANALYSE_CHROME, and the body scrolls beneath it.
        */
        className="inline-flex min-h-[44px] shrink-0 items-center rounded-[7px] px-[13px] font-gn-mono text-[8.5px] font-bold uppercase tracking-[.10em] outline-none transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dc0ff]"
        style={{ backgroundColor: ACTION_AMBER, color: ACTION_INK, fontWeight: 700 }}
      >
        {t.open}
      </button>
    );
  }

  return (
    <div className="rounded-[10px] border border-[rgba(245,158,11,.22)] bg-[rgba(245,158,11,.04)] p-[14px]">
      <p className="font-gn-display text-[12.5px] leading-[1.45] text-[#a9bccf]">{t.description}</p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-[9px] inline-flex min-h-[44px] items-center rounded-[7px] px-[15px] font-gn-mono text-[9.5px] font-bold uppercase tracking-[.10em] outline-none transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dc0ff]"
        style={{ backgroundColor: ACTION_AMBER, color: ACTION_INK, fontWeight: 700 }}
      >
        {t.open}
      </button>
    </div>
  );
}
