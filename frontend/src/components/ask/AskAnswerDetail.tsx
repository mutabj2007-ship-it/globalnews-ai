'use client';

import { useId, useState, type JSX } from 'react';
import { safeExternalHref, type AnalysisSourceRef, type DisplayLocale, type NewsAnalysisResult } from '@globalnews-ai/shared';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { AskCitation } from './AskCitation';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK DESIGN COMPLETENESS R1 — THE ANSWER'S DEPTH, AS THE DESIGN READS IT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * RECONCILIATION_GUIDE §5 maps the validated analysis fields onto the reading hierarchy. Two of
 * those placements are drawn here, from fields the response already carries — nothing is
 * generated, composed or re-ranked, and every item keeps the citations its own
 * `sourceArticleIds` give it (numbered against the SAME `analysis.sources` the opening uses):
 *
 *   uncertainties   → an inline "Not yet confirmed:" note directly after the opening — the
 *                     Design's rule for an uncertainty not attributable to one statement. Never
 *                     inside a disclosure: a caveat is never hidden.
 *   context · relevance · affectedParties · watchNext
 *                   → ONE full-width "More detail: …" disclosure naming what it contains,
 *                     collapsed. Toggling keeps focus on the button and does not move the scroll
 *                     position; the collapsed content stays in the DOM (`hidden`), so Copy and
 *                     find-in-page include it.
 *
 * Each item is a validated SourcedClaim (the backend drops ungrounded entries before the
 * frontend sees them); an item whose ids resolve to no listed source simply shows no number.
 */
function citationsFor(
  ids: readonly string[],
  sources: readonly AnalysisSourceRef[],
  label: (n: number, source: AnalysisSourceRef) => string,
): JSX.Element[] {
  return [...new Set(ids)]
    .map((id) => sources.findIndex((source) => source.articleId === id))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)
    .map((index) => {
      const n = index + 1;
      const source = sources[index];
      return (
        <AskCitation
          key={n}
          n={n}
          href={safeExternalHref(source.url)}
          label={label(n, source)}
          sources={sources}
        />
      );
    });
}

export function AskAnswerDetail({
  analysis,
  locale,
}: {
  readonly analysis: NewsAnalysisResult;
  readonly locale: DisplayLocale;
}): JSX.Element | null {
  const shell = askShellStrings(locale);
  const r = shell.askR2Strings.read;
  const citationLabel = shell.dict.askAi.citationLabel;
  const sources = analysis.sources ?? [];
  const label = (n: number, source: AnalysisSourceRef) =>
    citationLabel
      .replace('{n}', String(n))
      .replace('{title}', source.title)
      .replace('{publisher}', source.publisher);
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  const uncertainties = (analysis.uncertainties ?? []).filter((item) => item.description.trim() !== '');
  const sections = [
    { key: 'background', title: r.background, items: (analysis.context ?? []).map((c) => ({ text: c.claim, ids: c.sourceArticleIds, lead: null as string | null })) },
    { key: 'relevance', title: r.whyMatters, items: (analysis.relevance ?? []).map((c) => ({ text: c.claim, ids: c.sourceArticleIds, lead: null as string | null })) },
    { key: 'affected', title: r.whoAffected, items: (analysis.affectedParties ?? []).map((p) => ({ text: p.effect, ids: p.sourceArticleIds, lead: p.party })) },
    { key: 'watch', title: r.whatToWatch, items: (analysis.watchNext ?? []).map((w) => ({ text: w.claim, ids: w.sourceArticleIds, lead: null as string | null })) },
  ].filter((section) => section.items.some((item) => item.text.trim() !== ''));

  if (uncertainties.length === 0 && sections.length === 0) return null;

  /* "background and what to watch" — the sections' own names, joined the reader's way. Lower-
     cased only where the language does not capitalise nouns. */
  const lower = locale !== 'de' && locale !== 'ar';
  const names = sections.map((section) =>
    lower ? section.title.charAt(0).toLocaleLowerCase(locale) + section.title.slice(1) : section.title,
  );
  const what = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names);

  return (
    <div data-ask="answer-detail" className="flex flex-col">
      {uncertainties.map((item) => (
        <p key={item.description} data-ask="uncertainty-note">
          <strong>{r.notYetConfirmed}</strong> {item.description}
          {citationsFor(item.sourceArticleIds, sources, label)}
        </p>
      ))}
      {sections.length > 0 && (
        <div data-ask="more-detail">
          <button
            type="button"
            data-ask="more-detail-toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen(!open)}
          >
            <span>{r.moreDetail(what)}</span>
            <span aria-hidden="true">{open ? r.hide : r.show}</span>
          </button>
          <div id={bodyId} data-ask="more-detail-body" hidden={!open}>
            {sections.map((section) => (
              <section key={section.key} data-ask-detail={section.key}>
                <h4 data-ask="detail-heading">{section.title}</h4>
                <ul>
                  {section.items.map((item) => (
                    <li key={`${item.lead ?? ''}${item.text}`}>
                      {item.lead !== null && <strong className="font-semibold">{item.lead} </strong>}
                      {item.text}
                      {citationsFor(item.ids, sources, label)}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
