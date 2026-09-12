'use client';

import { useRouter } from 'next/navigation';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { formatUtcClock } from '@/lib/formatRelativeTime';
import {
  PresentationRibbon,
  type RibbonCell,
} from '@/components/presentation/PresentationRibbon';

/**
 * `01 §6` — SOLID/BORDERED AMBER IS ACTION, TINTED AMBER IS UNCERTAINTY.
 *
 * Carried as a literal for the same reason `PresentationRibbon` carries it:
 * the hue is not in `tailwind.config.ts` and H owns that block. One value, one
 * meaning, and `todayWorkspace.spec.ts` asserts it equals the ribbon's own.
 */
const ACTION_AMBER = '#f59e0b';

/**
 * R7 `02 §4` — ONE SITUATION ROW. COMPACT UNTIL SELECTED.
 *
 * ── THE HONEST FIVE CELLS (CTO ruling, option (a)) ───────────────────────
 *
 * A Today record is a RETRIEVED ARTICLE, not an analysis. So:
 *
 *   ① WHAT HAPPENED   the article's own title            REAL
 *   ② WHERE           its resolved country, or unresolved REAL
 *   ③ WHY IT MATTERS  no significance rating exists       UNAVAILABLE
 *   ④ WHO IS AFFECTED no entities field exists            UNAVAILABLE
 *   ⑤ EVIDENCE        no rating, no cluster count         UNAVAILABLE
 *
 * All five cells render, in order, keeping their slots (R7 §8, T-03). NOTHING
 * is synthesised to fill ③④⑤: `sourcesCount` is hardcoded to 1 by the provider
 * and `confidence` is an uncalibrated retrieval heuristic, so neither may
 * become an evidence claim. DEEP ANALYSIS is how the reader asks for the richer
 * payload; the homepage does not precompute it.
 *
 * ── ② IS EVIDENCE-RESOLVED, AND ONLY AT COUNTRY PRECISION ────────────────
 *
 * `NewsArticle.countryCode` is resolved from the article's own text — the
 * contract says it is "never inferred from sourceName, never defaulted to a
 * query country". That makes it evidence-resolved rather than retrieved-for.
 * Its basis note says COUNTRY and stops there: no n-of-m corroboration count is
 * printed, because a single record cannot support one.
 *
 * Absent, it is `unresolved` — neutral, untinted, and stated in words (T-21).
 *
 * ── SOURCES ARE RETRIEVED ARTICLES, AND ARE LABELLED AS SUCH ─────────────
 *
 * The count is 1 because a Today row IS one retrieved article. It is never
 * presented as corroborating or independent evidence — the dock's own label
 * says RETRIEVED ARTICLES for exactly that reason.
 */
interface SituationRowProps {
  record: NewsArticle;
  expanded: boolean;
  onToggle: () => void;
  onOpenSources: () => void;
  sourcesExpanded: boolean;
  language: LanguageCode;
}

export function SituationRow({
  record,
  expanded,
  onToggle,
  onOpenSources,
  sourcesExpanded,
  language,
}: SituationRowProps): JSX.Element {
  const router = useRouter();
  const t = getDictionary(language).todayWorkspace.analyse;
  const countryLabel =
    record.countryCode !== undefined && record.countryName !== undefined
      ? getCountryDisplayName(record.countryCode, language, record.countryName)
      : null;

  /*
    THE RELEASED ANALYSIS CONTRACT, BUILT ONCE AND USED BY BOTH ACTIONS.

    `q + articleId + optional countryCode` is byte-identical to the map's call
    site and to what `SearchPageClient` already reads. The compact row's ANALYSE
    and the ribbon's DEEP ANALYSIS therefore share ONE route, ONE request shape
    and ONE navigation — no second pipeline, no new endpoint, and nothing is
    pre-run here or anywhere else on this surface.
  */
  const analysisParams = new URLSearchParams({ q: record.title, articleId: record.id });
  if (record.countryCode !== undefined) analysisParams.set('countryCode', record.countryCode);
  const openAnalysis = (): void => {
    router.push(`/search?${analysisParams.toString()}`);
  };

  const cells: [RibbonCell, RibbonCell, RibbonCell, RibbonCell, RibbonCell] = [
    { kind: 'what', value: record.title },
    countryLabel !== null
      ? {
          kind: 'where',
          value: countryLabel,
          provenance: 'evidence-resolved',
          basisNote: t.resolvedToCountry,
        }
      : {
          kind: 'where',
          value: t.whereUnresolved,
          provenance: 'unresolved',
          basisNote: t.unresolvedNotPlaced,
        },
    { kind: 'why', value: null },
    { kind: 'who', value: null },
    { kind: 'evidence', value: null },
  ];

  return (
    <article
      className="grid grid-cols-[3px_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border border-[#16202e] bg-[#080d14]"
    >
      {/* `02 §4` — a 3px rail. NEUTRAL here: the six information states derive
          from analysis records, and a Today row has none, so a coloured rail
          would be a claim. The badge beside it carries the words. */}
      <span aria-hidden="true" className="bg-[#1b2634]" />

      {/* R4 CORRECTION — COMPACT UNTIL SELECTED, AND MEASURABLY SO.

          `02 §4` already required "title plus ONE line, never a text block";
          the released row clamped to two and set the title at 14.5px, which at
          the centre column's new width produced rows near 155px tall — the
          "giant article wall" this correction names. Title 13px, ONE clamped
          line, tighter padding: the same information, at roughly half the
          height, so more than two situations are visible at once. */}
      <div className="min-w-0 px-[13px] py-[9px]">
        <div className="flex flex-wrap items-center gap-[7px]">
          {/* Geography chip: cyan-bordered when resolved, neutral when not. */}
          <span
            className={`rounded-[4px] border px-[5px] py-[1px] font-gn-mono text-[7px] uppercase tracking-[.10em] ${
              countryLabel !== null
                ? 'border-[rgba(34,211,238,.3)] text-[#67e8f9]'
                : 'border-[#2a3a4d] text-[#7d92aa]'
            }`}
          >
            {countryLabel ?? t.chipUnresolved}
          </span>
          <span className="font-gn-mono text-[7.5px] uppercase tracking-[.10em] text-[#4a5c73]">
            {record.sourceName}
          </span>
          {record.firstSeenAt !== undefined && (
            <span className="font-gn-mono text-[7.5px] uppercase tracking-[.10em] text-[#4a5c73]">
              {t.firstSeen} {formatUtcClock(record.firstSeenAt)}
            </span>
          )}
        </div>

        {/* Step ① — the title. `02 §4`: title plus ONE line, never a text block. */}
        <h3 className="mt-[5px] max-w-[86ch] font-gn-display text-[13px] font-semibold leading-[1.3] text-[#f1f6fb]">
          {record.title}
        </h3>

        {/* The supporting line exists ONLY while collapsed; the ribbon carries
            the content when open, so nothing is stated twice. */}
        {!expanded && (
          <p className="mt-[3px] max-w-[86ch] line-clamp-1 font-gn-display text-[11.5px] leading-[1.45] text-[#8ba3bd]">
            {record.summary}
          </p>
        )}
      </div>

      {/*
        TWO ACTIONS, AND THEY ARE NOT THE SAME ACTION.

        ANALYSE leaves this page and opens the analysis workspace on THIS story.
        The chevron opens the ribbon in place. A chevron alone cannot stand for
        both: it is a disclosure glyph, it carries no verb, and a reader has no
        way to learn from it that an analysis exists at all.

        THE DIFFERENCE IS CARRIED FOUR WAYS, not by position alone:
          ANALYSE   a WORD, in ACTION AMBER, bordered, with an arrow
          chevron   a glyph, neutral grey, unbordered, aria-expanded
        Amber-means-action is the presentation language's own rule and the same
        treatment `PresentationRibbon` gives DEEP ANALYSIS, so the compact row
        and the expanded ribbon name the same action the same way.
      */}
      <div className="flex items-start gap-[6px] p-[8px]">
        <button
          type="button"
          onClick={openAnalysis}
          aria-label={`${t.analyseStory}: ${record.title}`}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-[5px] rounded-[7px] border px-[10px] font-gn-mono text-[9px] font-bold uppercase tracking-[.10em] outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dc0ff]"
          style={{ color: ACTION_AMBER, borderColor: 'rgba(245,158,11,.42)' }}
        >
          {t.analyse}
          <span aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`today-ribbon-${record.id}`}
          onClick={onToggle}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[7px] font-gn-mono text-[10px] text-[#94a3b8] outline-none transition-colors hover:text-[#cbd5e1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dc0ff]"
        >
          <span className="sr-only">{expanded ? t.collapseRow : t.expandRow}</span>
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
        </button>
      </div>

      {expanded && (
        <div id={`today-ribbon-${record.id}`} className="col-span-3">
          <PresentationRibbon
            cells={cells}
            sources={{ count: 1, expanded: sourcesExpanded, onToggle: onOpenSources }}
            /* THE SAME navigation the compact row's ANALYSE performs. */
            deepAnalysis={{ onOpen: openAnalysis }}
            density="card"
            language={language}
          />
        </div>
      )}
    </article>
  );
}
