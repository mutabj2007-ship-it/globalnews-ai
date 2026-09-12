'use client';

import { useState } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import type { ClaimEntry } from '../search/analysisClaims';
import type { DimensionModel } from '../search/analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { dimensionLabel } from '../search/AnalysisIndex';
import { ClaimRow } from './ClaimRow';

/** §5 — >8 claims renders 8 plus SHOW REMAINING n, appended in place. */
export const CLAIM_PAGE_SIZE = 8;

export const DIMENSION_HEADING_ID = 'gn-paf-dimension-heading';

export interface DimensionPanelProps {
  dimension: DimensionModel;
  entries: readonly ClaimEntry[];
  onOpenSource: (articleId: string) => void;
  language?: LanguageCode;
  /** The brief dimension renders the expanded thesis instead of claims. */
  children?: React.ReactNode;
  /**
   * DESIGN-C2 LOCK 6 — a slot at the FOOT of the panel, so the phone trust
   * summary can sit below a dimension's content on the surfaces that have no
   * "first paragraph" to sit under. Absent everywhere else, so no existing
   * caller changes.
   */
  footer?: React.ReactNode;
}

export function DimensionPanel({
  dimension,
  entries,
  onOpenSource,
  language = 'en',
  children,
  footer,
}: DimensionPanelProps): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.analysisFrame;
  const [showAll, setShowAll] = useState(false);

  const label = dimensionLabel(dimension.key, dict.analysisWorkspace.dimensions);
  const visible = showAll ? entries : entries.slice(0, CLAIM_PAGE_SIZE);
  const remaining = entries.length - visible.length;

  /*
    DESIGN-C2 LOCK 4 — C2-19: the phone reading measure is the viewport
    minus 32px of gutter. It was 48px (px-6), which cost 16px of line
    length on every paragraph of the answer. Desktop is unchanged.
  */
  return (
    <section data-paf="dimension-panel" className="px-4 py-5 md:px-6">
      <h2
        id={DIMENSION_HEADING_ID}
        tabIndex={-1}
        className="font-gn-sans text-[17px] font-semibold leading-[1.35] tracking-[-0.01em] text-[#eaf1f8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gn-focus md:text-[18px]"
      >
        {label}
      </h2>

      {children}

      {children === undefined ? (
        entries.length === 0 ? (
          <p
            data-paf="empty-dimension"
            className="mt-4 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#4a5c73]"
          >
            {t.noItemsInDimension}
          </p>
        ) : (
          <>
            <ul data-paf="claim-list" className="mt-3 flex flex-col">
              {visible.map((entry, index) => (
                <ClaimRow
                  key={`${entry.ordinal}-${index}`}
                  entry={entry}
                  index={index}
                  total={entries.length}
                  dimensionName={label}
                  onOpenSource={onOpenSource}
                  language={language}
                />
              ))}
            </ul>
            {remaining > 0 ? (
              <button
                type="button"
                data-paf="show-remaining"
                onClick={() => setShowAll(true)}
                className="mt-3 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#67e8f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
              >
                {t.showRemaining} {remaining}
              </button>
            ) : null}
          </>
        )
      ) : null}

      {footer}
    </section>
  );
}
