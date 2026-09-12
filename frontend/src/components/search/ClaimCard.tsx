'use client';

import { useId, useState } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import type { AccentToken } from './analysisDimensions';
import type { ClaimCitation, ClaimEntry } from './analysisClaims';
import { citedSourceCount } from './analysisClaims';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';

/**
 * H2C — E-16 ClaimCard and E-17 citation pill / evidence expansion.
 *
 * The atomic unit of every dimension: one finding, its citations, its
 * evidence basis. This is where the chain the whole product rests on
 * becomes visible on screen:
 *
 *     claim  ->  citation  ->  source  ->  provenance
 *
 * VERBATIM OR NOTHING. The claim text and the evidence excerpt are
 * printed exactly as the contract supplies them. Nothing here
 * paraphrases, re-summarises, or truncates mid-sentence; long text is
 * clamped visually with an expand control, which changes what is
 * painted and never what is said.
 *
 * CITATION NUMBERS ARE NOT POSITIONS. Every disc shows the number the
 * H2A adapter resolved from the articleId. A citation that resolves to
 * nothing renders as an unresolved citation and stays non-interactive —
 * it is never quietly renumbered to look tidy.
 *
 * THE ORDINAL IS THE NON-COLOUR IDENTITY CUE. 05 §1 forbids colour as
 * the only carrier of meaning; the accent rail is decorative and the
 * ordinal marker does the identifying work at every breakpoint.
 *
 * WHAT THE EVIDENCE BLOCK CLAIMS, AND WHAT IT DOES NOT. Milestone #32
 * proves that the excerpt was present in the text supplied to the model
 * for the cited source. It does not prove the excerpt entails the claim,
 * and the label says exactly that much: "evidence basis from cited
 * source", never "verified" or "confirmed".
 */

const ACCENT_BORDER: Readonly<Record<AccentToken, string>> = {
  'gn-verified': 'border-l-gn-verified',
  'gn-ai': 'border-l-gn-ai',
  'gn-geo': 'border-l-gn-geo',
  'gn-significance': 'border-l-gn-significance',
  'gn-uncertain': 'border-l-gn-uncertain',
  'gn-provenance': 'border-l-gn-provenance',
};

const ACCENT_TEXT: Readonly<Record<AccentToken, string>> = {
  'gn-verified': 'text-gn-verified',
  'gn-ai': 'text-gn-ai',
  'gn-geo': 'text-gn-geo',
  'gn-significance': 'text-gn-significance',
  'gn-uncertain': 'text-gn-uncertain',
  'gn-provenance': 'text-gn-provenance',
};

/** E-17: outlet names truncate at 18 characters; the full name stays in the accessible name. */
const OUTLET_MAX = 18;

function truncateOutlet(name: string): string {
  return name.length <= OUTLET_MAX ? name : `${name.slice(0, OUTLET_MAX)}…`;
}

export interface ClaimCardProps {
  entry: ClaimEntry;
  accent: AccentToken;
  /** Localized dimension name, used only to build the accessible name. */
  dimensionName: string;
  total: number;
  index: number;
  onOpenSource: (articleId: string) => void;
  language?: LanguageCode;
}

export function ClaimCard({
  entry,
  accent,
  dimensionName,
  total,
  index,
  onOpenSource,
  language = 'en',
}: ClaimCardProps): JSX.Element {
  const t = getDictionary(language).analysisWorkspace.claim;
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidenceId = useId();

  const cited = citedSourceCount(entry);
  const partyTypeLabel =
    entry.partyType === null ? null : (t.partyTypes[entry.partyType] ?? entry.partyType);

  function pillLabel(citation: ClaimCitation): string {
    /* "Source 2, The Manila Times. Open in sources panel." — E-17 A11y. */
    if (citation.citationNumber === null) return t.unresolvedCitation;
    const outlet = citation.outletName === null ? '' : `, ${citation.outletName}`;
    return `${t.sourcePrefix} ${citation.citationNumber}${outlet}. ${t.openInSourcesPanel}`;
  }

  return (
    <article
      aria-label={`${dimensionName} ${t.findingPrefix} ${index + 1} ${t.findingOf} ${total}`}
      className={`flex gap-[14px] rounded-gn-card border border-gn-line-card border-l-2 bg-gn-panel px-[14px] py-3 md:px-[18px] md:py-4 ${ACCENT_BORDER[accent]}`}
    >
      <span
        aria-hidden="true"
        className={`shrink-0 font-gn-mono text-gn-hud-ordinal opacity-75 ${ACCENT_TEXT[accent]}`}
      >
        {entry.ordinal}
      </span>

      <div className="min-w-0 flex-1">
        {entry.party !== null && (
          <p className="mb-[6px] flex flex-wrap items-center gap-2">
            <span className="font-gn-display text-gn-entity text-gn-ink-primary">
              {entry.party}
            </span>
            {partyTypeLabel !== null && (
              <span className="rounded-[4px] border border-gn-line-kind px-[5px] py-[1px] font-gn-mono text-gn-hud-micro uppercase text-gn-ink-kind">
                {partyTypeLabel}
              </span>
            )}
          </p>
        )}

        <p className="font-gn-display text-gn-claim text-gn-ink-body">{entry.text}</p>

        <div className="mt-[11px] flex flex-wrap items-center gap-[10px]">
          {entry.uncited ? (
            /*
              A real state, not a defect. `unknowns` entries carry no
              citation field at all and some uncertainties name no
              article; saying so is more honest than hiding the entry or
              attaching a citation it does not have.
            */
            <span className="rounded-gn-pill border border-gn-line-pill px-[9px] py-[3px] font-gn-mono text-gn-hud-outlet uppercase text-gn-hud-faint">
              {t.uncited}
            </span>
          ) : (
            entry.citations.map((citation) =>
              citation.citationNumber === null ? (
                <span
                  key={citation.articleId}
                  className="rounded-gn-pill border border-gn-line-pill px-[9px] py-[3px] font-gn-mono text-gn-hud-outlet uppercase text-gn-hud-faint"
                >
                  {t.unresolvedCitation}
                </span>
              ) : (
                <button
                  key={citation.articleId}
                  type="button"
                  onClick={() => onOpenSource(citation.articleId)}
                  aria-label={pillLabel(citation)}
                  className="flex min-h-[22px] items-center gap-[6px] rounded-gn-pill border border-gn-line-pill bg-gn-chip py-[3px] pl-[4px] pr-[9px] transition-colors duration-[120ms] hover:border-gn-line-pill-hover hover:bg-gn-pill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
                >
                  <span className="flex h-[15px] w-[15px] items-center justify-center rounded-full bg-gn-line-inert font-gn-mono text-gn-hud-disc text-gn-ink-disc md:h-[15px] md:w-[15px]">
                    {citation.citationNumber}
                  </span>
                  {citation.outletName !== null && (
                    /* Hidden below 768px per E-17; the disc always remains. */
                    <span
                      aria-hidden="true"
                      className="hidden font-gn-mono text-gn-hud-outlet text-gn-ink-kind md:inline"
                    >
                      {truncateOutlet(citation.outletName)}
                    </span>
                  )}
                </button>
              ),
            )
          )}

          {cited !== null && (
            <span className="font-gn-mono text-gn-hud-supports uppercase text-gn-hud-faint">
              {t.citedByPrefix} {pluralWithForms(cited, language, t.sourceForms)}
            </span>
          )}

          {entry.evidenceBasis !== null && (
            <button
              type="button"
              onClick={() => setEvidenceOpen((open) => !open)}
              aria-expanded={evidenceOpen}
              aria-controls={evidenceId}
              className="font-gn-mono text-gn-hud-toggle uppercase text-gn-ink-toggle transition-colors duration-[120ms] hover:text-gn-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
            >
              {evidenceOpen ? `▾ ${t.hideEvidenceBasis}` : `▸ ${t.showEvidenceBasis}`}
            </button>
          )}
        </div>

        {/*
          E-17: the expanded region is aria-live="off" — it is a
          disclosure the user opened, not an event to announce.
        */}
        <div id={evidenceId} aria-live="off">
          {evidenceOpen && entry.evidenceBasis !== null && (
            <div className="mt-[11px] border-l-2 border-gn-verified bg-gn-verified-faint py-2 pl-3 pr-2">
              <p className="font-gn-mono text-gn-hud-micro uppercase text-gn-verified-soft">
                {t.evidenceBasisLabel}
              </p>
              <blockquote className="mt-[6px] font-gn-display text-gn-quote italic text-gn-ink-quote">
                {entry.evidenceBasis.excerpt}
                {entry.evidenceBasis.outletName !== null && (
                  <cite className="mt-2 block font-gn-mono text-gn-hud-outlet not-italic text-gn-ink-kind">
                    {entry.evidenceBasis.citationNumber !== null &&
                      `${t.sourcePrefix} ${entry.evidenceBasis.citationNumber} · `}
                    {entry.evidenceBasis.outletName}
                  </cite>
                )}
              </blockquote>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
