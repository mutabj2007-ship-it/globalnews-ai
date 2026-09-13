'use client';

import { useId, useState } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import type {
  AccentToken,
  BriefAnswerCell,
  BriefAnswerCellKey,
  PrimaryDimensionKey,
} from './analysisDimensions';
import type { ClaimEntry, ExecutiveBriefModel, WatchNextEntry } from './analysisClaims';
import { ClaimCard } from './ClaimCard';
import { WatchNextModule } from './WatchNextModule';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
/*
  ONE SPLITTER FOR BOTH BRIEF SURFACES. The R4 analysis frame already renders
  the synthesis as paragraphs through this function; importing it here is what
  stops the search surface growing a second, subtly different idea of where a
  paragraph ends.
*/
import { splitSynthesisParagraphs } from '@/components/analysis-frame/briefModel';
import { dimensionLabel } from './AnalysisIndex';

/**
 * H2C — E-09 Executive Brief hero and E-10 the six answer cells.
 *
 * E-09 IS VERBATIM. The prose is `analysis.summary`, printed exactly as
 * the backend produced it. 08-DATA-BINDING-MAP row 15 is explicit —
 * "Never re-summarised client-side" — so the only thing this component
 * decides about the text is how many lines of it are painted before the
 * expand control. It is labelled AI INTERPRETATION in visible text, not
 * only to assistive technology, because that is what it is.
 *
 * E-10 SELECTS, IT NEVER COMPOSES. Every cell value is an existing
 * string chosen by the H2A adapter's normative selection rules
 * (selectBriefAnswers), not a sentence assembled here. This component
 * receives the already-selected cells and renders them; if a cell
 * resolves to nothing it says NOT RESOLVED BY THIS ANALYSIS and stays
 * in the grid, because a missing answer is information and a vanished
 * cell is not.
 *
 * GEOGRAPHIC PRECISION IS NEVER UPGRADED. The WHERE cell prints the
 * resolution the payload actually carries — city, country, or none —
 * and its precision tag names that level. There is no path in this
 * component by which a country-level payload can be made to read as a
 * city, and `matchConfidence` is never shown: the contract documents it
 * as a geographic resolution signal unrelated to answer trust.
 *
 * NO SCORES. The EVIDENCE cell shows the backend trust word and the
 * retrieval counts. It does not show `analysis.confidence.score`, which
 * the contract documents as model self-assessment metadata and not the
 * authoritative trust signal, and it renders no percentage of any kind.
 *
 * H2D adds two things to this panel. E-24 is a collapsed context row
 * inside the hero, beneath the summary — situational background that
 * frames the analysis without displacing the answer grid, and it keeps
 * its citations so the evidence chain is no weaker inside the hero than
 * outside it. E-25 is the analytical watch-next module at the end of
 * the panel: the current analysis's forward indicators, and nothing
 * that persists beyond this response.
 */

const CELL_ACCENT_TEXT: Readonly<Record<AccentToken, string>> = {
  'gn-verified': 'text-gn-verified',
  'gn-ai': 'text-gn-ai',
  'gn-geo': 'text-gn-geo',
  'gn-significance': 'text-gn-significance',
  'gn-uncertain': 'text-gn-uncertain',
  'gn-provenance': 'text-gn-provenance',
};

const CELL_ACCENT_BORDER: Readonly<Record<AccentToken, string>> = {
  'gn-verified': 'border-l-gn-verified',
  'gn-ai': 'border-l-gn-ai',
  'gn-geo': 'border-l-gn-geo',
  'gn-significance': 'border-l-gn-significance',
  'gn-uncertain': 'border-l-gn-uncertain',
  'gn-provenance': 'border-l-gn-provenance',
};

const CELL_ACCENT_DOT: Readonly<Record<AccentToken, string>> = {
  'gn-verified': 'bg-gn-verified',
  'gn-ai': 'bg-gn-ai',
  'gn-geo': 'bg-gn-geo',
  'gn-significance': 'bg-gn-significance',
  'gn-uncertain': 'bg-gn-uncertain',
  'gn-provenance': 'bg-gn-provenance',
};

type BriefStrings = ReturnType<typeof getDictionary>['analysisWorkspace']['brief'];

function cellLabel(key: BriefAnswerCellKey, t: BriefStrings): string {
  switch (key) {
    case 'what-happened':
      return t.cells.whatHappened;
    case 'where':
      return t.cells.where;
    case 'why-it-matters':
      return t.cells.whyItMatters;
    case 'who-is-affected':
      return t.cells.whoIsAffected;
    case 'how-strong-is-the-evidence':
      return t.cells.evidence;
    case 'what-is-uncertain':
      return t.cells.uncertain;
  }
}

interface RenderedCell {
  readonly value: string | null;
  readonly meta: string | null;
}

/**
 * Turns one already-selected cell into the two strings it displays.
 * Every branch either copies an existing string or states a count of
 * existing records. No branch writes a sentence.
 */
function renderCell(cell: BriefAnswerCell, t: BriefStrings, language: LanguageCode): RenderedCell {
  switch (cell.value.kind) {
    case 'unresolved':
      return { value: null, meta: null };

    case 'claim':
      return {
        value: cell.value.claim.claim,
        meta:
          cell.value.claim.evidenceBreadth === null ||
          cell.value.claim.evidenceBreadth === undefined
            ? null
            : pluralWithForms(cell.value.claim.evidenceBreadth.sourceCount, language, t.itemForms),
      };

    case 'geography': {
      const geo = cell.value.geography;
      if (geo.precision === 'unresolved') return { value: null, meta: t.precision.unresolved };
      /* City precision prints the city; country precision never invents one. */
      const value =
        geo.precision === 'city'
          ? [geo.city, geo.countryName].filter((part) => part !== null).join(', ')
          : (geo.countryName ?? geo.countryCode);
      return {
        value: value === null || value === '' ? null : value,
        meta: geo.precision === 'city' ? t.precision.city : t.precision.country,
      };
    }

    case 'relevance-with-significance': {
      const level = cell.value.significanceLevel;
      return {
        value: cell.value.claim === null ? null : cell.value.claim.claim,
        meta: level === null ? null : `${t.significanceLabel}: ${t.significanceLevels[level]}`,
      };
    }

    case 'affected-parties': {
      const parties = cell.value.parties;
      if (parties.length === 0) return { value: null, meta: null };
      return {
        /* Existing name and existing role string, joined. Neither is re-worded. */
        value: parties.map((party) => `${party.party} — ${party.effect}`).join(' · '),
        meta: pluralWithForms(parties.length, language, t.partyForms),
      };
    }

    case 'evidence-strength':
      /*
        Composed in the component rather than here, because the trust
        word must come from the SAME telemetry dictionary group E-04
        reads. Two surfaces naming one trust level differently would be
        a correctness bug, not a wording preference.
      */
      return { value: null, meta: null };

    case 'uncertainty':
      return {
        value: cell.value.first === null ? null : cell.value.first.description,
        meta: pluralWithForms(cell.value.count, language, t.itemForms),
      };
  }
}

export interface ExecutiveBriefProps {
  /** From buildExecutiveBriefModel(); null omits E-09 entirely. */
  brief: ExecutiveBriefModel | null;
  cells: readonly BriefAnswerCell[];
  /** E-24. Empty means the row is not rendered at all. */
  contextEntries?: readonly ClaimEntry[];
  /** E-25. Empty means the module is not rendered at all. */
  watchNextEntries?: readonly WatchNextEntry[];
  onSelectDimension: (key: PrimaryDimensionKey) => void;
  onOpenSource?: (articleId: string) => void;
  language?: LanguageCode;
}

export function ExecutiveBrief({
  brief,
  cells,
  contextEntries = [],
  watchNextEntries = [],
  onSelectDimension,
  onOpenSource,
  language = 'en',
}: ExecutiveBriefProps): JSX.Element {
  const dict = getDictionary(language).analysisWorkspace;
  const t = dict.brief;
  const tel = dict.telemetry;
  const ctx = dict.context;
  const [expanded, setExpanded] = useState(false);
  /*
    The model's own paragraph structure, split once per render by the same
    pure function the R4 frame uses. A brief of three paragraphs or fewer is
    never clamped — the control exists for genuinely long syntheses, not as a
    default state that hides the answer.
  */
  const paragraphs = splitSynthesisParagraphs(brief?.summary ?? '');
  const clampable = paragraphs.length > 3;
  const [contextOpen, setContextOpen] = useState(false);
  const contextRegionId = useId();

  return (
    <div>
      {/* ── E-09 ─────────────────────────────────────────────── */}
      {brief !== null && (
        <section
          aria-label={t.briefLabel}
          className="relative overflow-hidden rounded-gn-hero border border-gn-line-brief bg-gradient-to-b from-gn-ai-tint to-gn-page px-5 pb-6 pt-[22px] md:px-6"
        >
          {/* 1px telemetry line — E-09 HUD. Decorative. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gn-ai to-transparent"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-[14px] w-[14px] rotate-45 border border-gn-ai bg-gn-ai-tint"
              />
              {/* Visible, not assistive-only — E-09 A11y. */}
              <span className="font-gn-mono text-gn-hud-brief uppercase text-gn-brief-label">
                {t.aiInterpretation}
              </span>
            </span>
            <time
              dateTime={brief.generatedAt}
              className="font-gn-mono text-gn-hud-toggle uppercase text-gn-hud"
            >
              {/* Existing localized relative-time utility — 08 row 16. */}
              {t.generatedPrefix} {formatRelativeTime(brief.generatedAt, language)}
            </time>
          </div>

          {/*
            ══ PO RULING F-1 — THE BRIEF IS THE SUBSTANTIVE READABLE ANSWER ══

            TWO MEASURED DEFECTS, BOTH HERE, BOTH FIXED TOGETHER.

            1. ONE <p> DESTROYED THE PARAGRAPHS. The backend synthesis is now
               organised by material development and separated by blank lines,
               and HTML collapses every one of those into a single space. A
               multi-development brief arrived as a wall of text — so the
               reader could not see the structure the synthesis had, which is
               indistinguishable from the synthesis not having any.

            2. `line-clamp-4 md:line-clamp-5` CUT IT TO FIVE LINES. On the one
               surface whose job is the substantive answer, the answer was
               truncated by default and the reader had to ask for the rest.

            `splitSynthesisParagraphs` is the SAME pure splitter the R4
            analysis frame already uses — no re-summarising, no slicing, no
            reordering, no sentence detection. Both surfaces now render the
            model's own paragraph structure, and they do it through one
            function so they cannot drift apart again.

            The toggle stays, and still does something worth doing: a long
            brief is capped by HEIGHT, at a paragraph boundary, so nothing is
            cut mid-sentence and the first development is always whole. A brief
            short enough to fit needs no control at all, so it does not get
            one.
          */}
          {/*
            ══════════════════════════════════════════════════════════════════
            C907 CORRECTION 3 — E-09 STATES A WITHHELD BRIEF
            ══════════════════════════════════════════════════════════════════

            `brief.summary` is empty on this path because the backend does not
            transmit a brief it has measured and rejected. E-09 keeps its
            frame, its label and its timestamp — all of which remain true —
            and replaces the synthesis with the reason. The answer grid, the
            context row and Watch Next below are untouched and still render
            the validated record.
          */}
          {brief.withheld ? (
            <div data-gn="executive-brief-withheld" className="mt-[14px] max-w-[74ch]">
              <p className="font-gn-mono text-gn-hud-toggle uppercase text-gn-hud">
                {t.briefWithheldHeading}
              </p>
              <p className="mt-2 font-gn-display text-gn-brief-prose-m text-gn-ink-prose md:text-gn-brief-prose-t lg:text-gn-brief-prose">
                {t.briefWithheldBody}
              </p>
              {brief.withheldReason !== null && (
                <p className="mt-2 font-gn-display text-gn-hud-brief text-gn-hud">
                  {brief.withheldReason}
                </p>
              )}
            </div>
          ) : (
          <div
            data-gn="executive-brief-synthesis"
            data-gn-paragraphs={paragraphs.length}
            className={`mt-[14px] flex max-w-[74ch] flex-col gap-3 font-gn-display text-gn-brief-prose-m text-gn-ink-prose md:text-gn-brief-prose-t lg:text-gn-brief-prose ${
              expanded || !clampable ? '' : 'max-h-[22rem] overflow-hidden'
            }`}
          >
            {paragraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
            ))}
          </div>
          )}

          {!brief.withheld && clampable && (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              className="mt-3 font-gn-mono text-gn-hud-toggle uppercase text-gn-ink-toggle transition-colors duration-[120ms] hover:text-gn-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
            >
              {expanded ? t.collapse : t.expand}
            </button>
          )}

          {/*
            E-24. Collapsed by default, inside the hero, separated by the
            specified rule. Absent entirely when the field is empty — no
            placeholder, no "no context available". Never opens a drawer.
          */}
          {contextEntries.length > 0 && (
            <div className="mt-4 border-t border-gn-line-brief-rule pt-3">
              <button
                type="button"
                onClick={() => setContextOpen((open) => !open)}
                aria-expanded={contextOpen}
                aria-controls={contextRegionId}
                aria-label={ctx.ariaLabel}
                className="flex min-h-[40px] items-center font-gn-mono text-gn-hud-label uppercase text-gn-brief-label transition-colors duration-[120ms] hover:text-gn-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
              >
                {contextOpen ? `\u25be ${ctx.hide}` : `\u25b8 ${ctx.show}`}
              </button>
              <div id={contextRegionId}>
                {contextOpen && (
                  <div className="mt-2 flex max-w-[74ch] flex-col gap-2">
                    {contextEntries.map((entry, index) => (
                      <ClaimCard
                        key={`context-${entry.ordinal}`}
                        entry={entry}
                        accent="gn-ai"
                        dimensionName={ctx.heading}
                        total={contextEntries.length}
                        index={index}
                        onOpenSource={onOpenSource ?? (() => undefined)}
                        language={language}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── E-10 ─────────────────────────────────────────────── */}
      <div
        role="list"
        aria-label={t.answerGridLabel}
        className="mt-3 grid grid-cols-1 gap-[10px] md:grid-cols-2 xl:grid-cols-3"
      >
        {cells.map((cell) => {
          const rendered = renderCell(cell, t, language);
          const label = cellLabel(cell.key, t);
          const isEvidenceCell = cell.key === 'how-strong-is-the-evidence';

          /* Only dimension destinations exist in this build. The rail
             module (E-18) and the evidence popover (E-04) are later
             slices, so those cells stay non-interactive rather than
             offering an action that goes nowhere. */
          const target =
            cell.interactive && cell.destination.kind === 'dimension' ? cell.destination.key : null;

          let value = rendered.value;
          let meta = rendered.meta;

          if (isEvidenceCell && cell.value.kind === 'evidence-strength') {
            const meter = cell.value.meter;
            value = meter.rated
              ? {
                  STRONG: tel.evidenceLevels.strong,
                  MODERATE: tel.evidenceLevels.moderate,
                  LIMITED: tel.evidenceLevels.limited,
                  INSUFFICIENT: tel.evidenceLevels.insufficient,
                  UNRATED: tel.evidenceLevels.unrated,
                }[meter.label]
              : tel.evidenceLevels.unrated;
            /* Counts of existing records only — never a score. */
            const parts = [
              pluralWithForms(cell.value.articlesRetrieved, language, tel.articleForms),
            ];
            if (cell.value.reportingClusterCount !== null) {
              parts.push(
                pluralWithForms(cell.value.reportingClusterCount, language, tel.clusterForms),
              );
            }
            meta = parts.join(' · ');
          }

          const accessibleName =
            target === null
              ? `${label}: ${value ?? t.notResolved}`
              : `${label}: ${value ?? t.notResolved}. ${t.opensPrefix} ${dimensionLabel(target, dict.dimensions)}.`;

          const body = (
            <>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`h-[6px] w-[6px] shrink-0 rounded-full ${CELL_ACCENT_DOT[cell.accent]}`}
                />
                <span
                  className={`font-gn-mono text-gn-hud-cell-label uppercase ${CELL_ACCENT_TEXT[cell.accent]}`}
                >
                  {label}
                </span>
              </span>
              <span
                className={`mt-2 block font-gn-display text-gn-cell-value ${
                  value === null ? 'uppercase text-gn-hud-faint' : 'text-gn-ink-cell'
                } ${value === null ? '' : 'line-clamp-4'}`}
              >
                {value ?? t.notResolved}
              </span>
              {meta !== null && (
                <span className="mt-auto block pt-3 font-gn-mono text-gn-hud-meta uppercase text-gn-hud-faint">
                  {meta}
                </span>
              )}
            </>
          );

          const shell = `flex min-h-[132px] flex-col rounded-gn-cell border border-gn-line-card border-l-2 bg-gn-panel px-4 py-[14px] text-left ${CELL_ACCENT_BORDER[cell.accent]}`;

          return (
            <div role="listitem" key={cell.key} className="contents">
              {target === null ? (
                <div className={shell} aria-label={accessibleName}>
                  {body}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectDimension(target)}
                  aria-label={accessibleName}
                  className={`${shell} transition-colors duration-[120ms] hover:border-gn-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus`}
                >
                  {body}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/*
        E-25 at the end of the brief panel — the design's own rail-free
        placement, used at every breakpoint because E-18 is a later
        slice. The module omits itself when the field is empty.
      */}
      <WatchNextModule entries={watchNextEntries} language={language} />
    </div>
  );
}
