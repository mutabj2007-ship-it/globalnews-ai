'use client';

import { useId, useState } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import type { ClaimEntry } from '../search/analysisClaims';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * P-06 — a claim as a RULED ROW, not a card (§2.2, Test 12).
 *
 * 28px ordinal gutter + content, separated by 1px #101923 rules. No
 * border, no background, no radius, no shadow anywhere in the centre —
 * that is the whole visual difference from `ClaimCard`, which the frame
 * deliberately does not use here.
 *
 * The DATA BINDING is unchanged: the same `ClaimEntry` the existing
 * workspace renders, with the same verbatim text, the same citations and
 * the same evidence-basis mechanism. Only the presentation moved.
 */
export interface ClaimRowProps {
  entry: ClaimEntry;
  index: number;
  total: number;
  dimensionName: string;
  onOpenSource: (articleId: string) => void;
  language?: LanguageCode;
}

export function ClaimRow({
  entry,
  index,
  total,
  dimensionName,
  onOpenSource,
  language = 'en',
}: ClaimRowProps): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.analysisFrame;
  const claimText = dict.analysisWorkspace.claim;
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidenceId = useId();

  return (
    <li
      data-paf="claim-row"
      className="flex gap-3 border-b border-[#101923] px-1 py-3 last:border-b-0"
      aria-label={`${dimensionName} ${index + 1} / ${total}`}
    >
      <span
        data-paf="ordinal-gutter"
        aria-hidden="true"
        className="w-[28px] shrink-0 pt-[2px] font-gn-mono text-[12px] md:text-[11px] leading-none text-[#4a5c73]"
      >
        {entry.ordinal}
      </span>

      <div className="min-w-0 flex-1">
        {entry.party !== null ? (
          <h3 className="mb-1 font-gn-sans text-[13px] font-semibold text-[#eaf1f8]">{entry.party}</h3>
        ) : null}

        <p className="font-gn-sans text-[14px] leading-[1.6] text-[#d5e1ee]">
          {entry.text}
          {entry.uncited ? (
            <span
              data-paf="uncited"
              className="ml-2 align-baseline font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.1em] text-[#4a5c73]"
            >
              {t.uncited}
            </span>
          ) : (
            entry.citations.map((citation) => (
              <button
                key={`${citation.articleId}-${citation.citationNumber ?? "x"}`}
                type="button"
                data-paf="citation-marker"
                onClick={() => onOpenSource(citation.articleId)}
                aria-label={t.citationMarker
                  .replace('{n}', String(citation.citationNumber ?? ''))
                  .replace('{outlet}', citation.outletName ?? '')}
                className="mx-[2px] align-baseline font-gn-mono text-[12px] md:text-[11px] text-[#67e8f9] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
              >
                [{citation.citationNumber}]
              </button>
            ))
          )}
        </p>

        {entry.evidenceBasis !== null ? (
          <>
            <button
              type="button"
              aria-expanded={evidenceOpen}
              aria-controls={evidenceId}
              onClick={() => setEvidenceOpen((open) => !open)}
              className="mt-2 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#4b7f8c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
            >
              {evidenceOpen ? '▾' : '▸'} {claimText.evidenceBasisLabel}
            </button>
            <blockquote
              id={evidenceId}
              hidden={!evidenceOpen}
              data-paf="evidence-basis"
              className="mt-2 border-l-2 border-[#3f9d6a] pl-3 font-gn-sans text-[13px] leading-[1.55] text-[#a9bccf]"
            >
              {entry.evidenceBasis.excerpt}
            </blockquote>
          </>
        ) : null}
      </div>
    </li>
  );
}
