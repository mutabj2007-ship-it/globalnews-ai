'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import type { RelationshipsSurfaceModel } from './analysisClaims';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * H2D — E-29 Relationships. DATA-GATED.
 *
 * Renders the backend's relational conclusion for questions that asked
 * about a relationship between two things. For every other analysis
 * `relationalComposition` is absent, the adapter drops the segment, and
 * this component never mounts. There is no empty decorative panel.
 *
 * A DISCLOSED DEPARTURE FROM THE APPROVED DESIGN. R1 draws this surface
 * as rows of "subject -> relation -> object". RelationalComposition
 * contains no such triples: it carries one backend-authored summary
 * string and five buckets of references into other claim arrays.
 * Rendering triples would mean inventing the subject, the relation and
 * the object from prose. So the register is kept — the cyan relational
 * accent, the connector rule, the HUD labels — and the content is what
 * the contract actually holds. Flagged in the H2D report rather than
 * quietly approximated.
 *
 * THE SUMMARY IS VERBATIM. Milestone #41 authored it server-side. This
 * component does not re-derive direction, sufficiency or causality, and
 * nothing here asserts that X caused Y — the contract is explicit that
 * a validated direction means "this excerpt is evidence relevant to the
 * relationship in this sense", never proof of causation.
 *
 * NO NETWORK GRAPH. There is no metric contract for one.
 */

export interface RelationshipsSubViewProps {
  model: RelationshipsSurfaceModel;
  onOpenSource: (articleId: string) => void;
  language?: LanguageCode;
}

export function RelationshipsSubView({
  model,
  onOpenSource,
  language = 'en',
}: RelationshipsSubViewProps): JSX.Element {
  const dict = getDictionary(language).analysisWorkspace;
  const t = dict.relationships;

  return (
    <section aria-label={t.heading} className="flex flex-col gap-3">
      <div className="rounded-gn-module border border-gn-line-geo bg-gn-geo-wash px-[14px] py-3">
        <p className="font-gn-mono text-gn-hud-label uppercase text-gn-geo-header">{t.heading}</p>
        {/* Backend-authored, rendered exactly as supplied. */}
        <p className="mt-2 max-w-[70ch] font-gn-display text-gn-claim text-gn-ink-body">
          {model.summary}
        </p>
        <p className="mt-2 font-gn-mono text-gn-hud-micro uppercase text-gn-geo-dim">
          {t.eligibility[model.directionalEligibility]} · {t.sufficiency[model.evidenceSufficiency]}
        </p>
      </div>

      {model.buckets.map((bucket) => {
        /* A bucket the backend left empty is not a finding. */
        if (bucket.count === 0) return null;
        return (
          <div
            key={bucket.key}
            className="rounded-gn-card border border-gn-line-card bg-gn-panel px-[14px] py-3"
          >
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-gn-mono text-gn-hud-supports uppercase text-gn-geo-header">
                {t.buckets[bucket.key]}
              </span>
              <span className="font-gn-mono text-gn-hud-meta text-gn-hud-faint">
                {bucket.count}
              </span>
            </p>

            <ul className="mt-2 flex list-none flex-col gap-2 p-0">
              {bucket.entries.map((entry, index) => (
                <li key={`${bucket.key}-${index}`} className="flex gap-[10px]">
                  <span aria-hidden="true" className="mt-[9px] h-px w-3 shrink-0 bg-gn-line-geo" />
                  <div className="min-w-0 flex-1">
                    <p className="font-gn-display text-gn-claim text-gn-ink-body">{entry.text}</p>
                    {entry.citations.length > 0 && (
                      <div className="mt-[6px] flex flex-wrap items-center gap-[10px]">
                        {entry.citations.map((citation) =>
                          citation.citationNumber === null ? null : (
                            <button
                              key={citation.articleId}
                              type="button"
                              onClick={() => onOpenSource(citation.articleId)}
                              aria-label={`${dict.claim.sourcePrefix} ${citation.citationNumber}${
                                citation.outletName === null ? '' : `, ${citation.outletName}`
                              }. ${dict.claim.openInSourcesPanel}`}
                              className="flex min-h-[22px] items-center gap-[6px] rounded-gn-pill border border-gn-line-pill bg-gn-chip py-[3px] pl-[4px] pr-[9px] transition-colors duration-[120ms] hover:border-gn-line-pill-hover hover:bg-gn-pill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
                            >
                              <span className="flex h-[15px] w-[15px] items-center justify-center rounded-full bg-gn-line-inert font-gn-mono text-gn-hud-disc text-gn-ink-disc">
                                {citation.citationNumber}
                              </span>
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
              {bucket.entries.length < bucket.count && (
                /*
                  The backend counted more references than resolved to a
                  claim. Saying so is better than silently showing fewer
                  rows than the number beside the heading.
                */
                <li className="font-gn-mono text-gn-hud-micro uppercase text-gn-hud-faint">
                  {t.unresolvedReferences}
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
