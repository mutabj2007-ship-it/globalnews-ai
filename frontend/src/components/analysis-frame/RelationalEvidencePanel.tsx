'use client';

import { useId, useState } from 'react';
import type { LanguageCode, RelationalEvidenceAssessment } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * R4.2 — one source's relational evidence, disclosed in place.
 *
 * IN PLACE is the whole point. The reader is verifying a claim; the
 * evidence that contradicts it must be reachable from the source row they
 * are already looking at, without a route change and without the claim
 * leaving the screen. So this is a local disclosure inside the source
 * card, not a second source list and not a Complete-Record-only route.
 *
 * COLOUR CARRIES MEANING HERE, AND IT IS NOT DECORATION.
 * Reverse evidence is amber because it is uncertainty about the requested
 * relationship — the CTA rule's tinted/bordered amber, never the solid
 * amber that means "action". Association-only and unclear are neutral
 * rather than green: they are not support, and colouring them like
 * support would be the exact re-labelling the contract forbids.
 *
 * EVERY ASSESSMENT RENDERS. There is no "top N", no filtering by
 * direction, and nothing is hidden behind a second disclosure. A count
 * the reader cannot open is the defect this component exists to remove.
 */
export interface RelationalEvidencePanelProps {
  assessments: readonly RelationalEvidenceAssessment[];
  /** Distinguishes the control per source row. */
  sourceKey: string;
  language?: LanguageCode;
  /** Test seam only — the state the panel OPENS in. */
  initialOpen?: boolean;
}

const TONE: Record<string, string> = {
  'requested-direction': 'border-l-[#67e8f9]',
  bidirectional: 'border-l-[#67e8f9]',
  'reverse-direction': 'border-l-[#e0a33d]',
  'association-only': 'border-l-[#54687f]',
  unclear: 'border-l-[#54687f]',
  'non-substantive': 'border-l-[#2a3a4d]',
};

export function RelationalEvidencePanel({
  assessments,
  sourceKey,
  language = 'en',
  initialOpen = false,
}: RelationalEvidencePanelProps): JSX.Element | null {
  const t = getDictionary(language).analysisFrame;
  const [open, setOpen] = useState(initialOpen);
  const reactId = useId();
  const panelId = `gn-paf-rel-${sourceKey}-${reactId}`;

  /*
   * No assessments means no control and no panel. Rendering a disclosure
   * that opens onto nothing would tell the reader a relational question
   * was evaluated for this source when none was.
   */
  if (assessments.length === 0) return null;

  return (
    <div data-paf="relational-evidence" data-source-key={sourceKey} className="mt-2">
      <button
        type="button"
        data-paf="relational-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-[6px] rounded-[4px] border border-[#22303f] px-2 py-[3px] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#a9bccf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        {open ? t.relationalHide : t.relationalShow}
        <span data-paf="relational-count" className="text-[#67e8f9]">
          {assessments.length}
        </span>
      </button>

      <div id={panelId} hidden={!open} data-paf="relational-list">
        <ul className="mt-2 flex flex-col gap-2">
          {assessments.map((a, i) => (
            <li
              key={`${a.direction}-${i}`}
              data-paf="relational-assessment"
              data-direction={a.direction}
              data-article-id={a.articleId}
              className={`border-l-2 pl-2 ${TONE[a.direction] ?? 'border-l-[#2a3a4d]'}`}
            >
              <p
                data-paf="relational-direction"
                className={`font-gn-mono text-[12px] md:text-[11px] uppercase leading-[1.4] tracking-[0.1em] ${
                  a.direction === 'reverse-direction' ? 'text-[#e0a33d]' : 'text-[#4b7f8c]'
                }`}
              >
                {t.relationalDirection[a.direction] ?? a.direction}
              </p>
              <blockquote
                data-paf="relational-excerpt"
                className="mt-[3px] font-gn-sans text-[12px] md:text-[11.5px] leading-[1.5] text-[#d5e1ee]"
              >
                {a.excerpt}
              </blockquote>
              {/*
                The two confidences, stated separately. The excerpt is
                backend-verified against the exact text the model was
                shown; the direction is the model's own classification and
                the backend cannot check it. Collapsing these into one
                reassurance would overstate the weaker half.
              */}
              <p
                data-paf="relational-validation"
                className="mt-[3px] font-gn-mono text-[12px] md:text-[11px] leading-[1.45] text-[#4a5c73]"
              >
                {t.relationalExcerptVerified} {t.relationalDirectionUnverified}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Assessments naming an article that is not among the retrieved sources.
 *
 * They are not discarded and no source is invented for them. They appear
 * under their own heading with the raw articleId, which is the only
 * identity the response actually supplies for them — inventing a
 * publisher, a title or a link would be fabricating provenance.
 */
export function UnmatchedRelationalEvidence({
  groups,
  language = 'en',
  initialOpen = false,
}: {
  groups: readonly { articleId: string; assessments: readonly RelationalEvidenceAssessment[] }[];
  language?: LanguageCode;
  initialOpen?: boolean;
}): JSX.Element | null {
  const t = getDictionary(language).analysisFrame;
  const [open, setOpen] = useState(initialOpen);
  const reactId = useId();
  const panelId = `gn-paf-rel-unmatched-${reactId}`;

  if (groups.length === 0) return null;
  const total = groups.reduce((n, g) => n + g.assessments.length, 0);

  return (
    <section data-paf="relational-unmatched" className="mt-3 border-t border-[#16202e] pt-2">
      <button
        type="button"
        data-paf="relational-unmatched-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-[6px] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#e0a33d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        {t.relationalUnmatchedHeading}
        <span data-paf="relational-unmatched-count">{total}</span>
      </button>

      <div id={panelId} hidden={!open}>
        <p className="mt-1 max-w-[70ch] font-gn-sans text-[12px] md:text-[11px] leading-[1.5] text-[#a9bccf]">
          {t.relationalUnmatchedNote}
        </p>
        <ul className="mt-2 flex flex-col gap-3">
          {groups.map((g) => (
            <li key={g.articleId} data-paf="relational-unmatched-group" data-article-id={g.articleId}>
              <p className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#4a5c73]">
                {t.relationalUnmatchedArticleId} · {g.articleId}
              </p>
              <RelationalEvidencePanel
                assessments={g.assessments}
                sourceKey={`unmatched-${g.articleId}`}
                language={language}
                initialOpen
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
