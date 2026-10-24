'use client';
import { useEffect, useState, type JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { fetchCoverageLeads, type CoverageLeadsResult } from '@/lib/api/coverageLeadsApi';
import { askCoverageLeadsStrings } from '@/lib/ask/askCoverageLeadsStrings';
import { formatUtc } from '@/lib/ask/askR2View';

/*
  CTO R168 — GDELT coverage leads, a clearly separate optional section after the answer. It is NOT
  part of the answer: nothing here is a source, a citation, a count or evidence, and the answer,
  Sources panel and Search activity never read it. Only an explicit news/current-events question
  asks for leads; any other class, any failure and any empty result render nothing at all (zero,
  never a fabricated list). Outlet names are plain text; each link opens the outlet's own page in a
  new tab with no referrer, only when the reader chooses "Read original".
*/
export const COVERAGE_LEAD_QUESTION_CLASSES: ReadonlySet<string> = new Set([
  'CURRENT_REPORTING',
  'CURRENT_STATUS_VERIFICATION',
]);

export function wantsCoverageLeads(questionClass: string | undefined, displayOnly: boolean): boolean {
  return !displayOnly && questionClass !== undefined && COVERAGE_LEAD_QUESTION_CLASSES.has(questionClass);
}

export function AskCoverageLeadsList({
  result,
  locale,
}: {
  readonly result: CoverageLeadsResult;
  readonly locale: DisplayLocale;
}): JSX.Element {
  const s = askCoverageLeadsStrings(locale);
  return (
    <section data-ask="coverage-leads" aria-label={s.heading} className="mt-4 flex flex-col gap-2 rounded-[12px] border border-[var(--ask-read-rule,#26384f)] p-3.5">
      <h3 className="text-[0.8125rem] font-semibold leading-[1.4] text-[var(--ask-read-ink2,#9fb4cc)]">{s.heading}</h3>
      <p data-ask="coverage-leads-note" className="text-[0.8125rem] leading-[1.5] text-[var(--ask-read-ink3,#8299b4)]">
        {s.note}
      </p>
      <ul className="flex flex-col gap-1.5">
        {result.leads.map((lead) => (
          <li key={lead.url} data-ask="coverage-lead" className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem] leading-[1.5]">
            <span data-ask="coverage-lead-outlet" className="text-[var(--ask-read-ink,#dbe6f3)]">
              {lead.outlet}
            </span>
            <span data-ask="coverage-lead-seen" className="text-[var(--ask-read-ink3,#8299b4)]">
              {s.seenBy(formatUtc(lead.seenByGdeltAt, locale) ?? lead.seenByGdeltAt)}
            </span>
            <a
              data-ask="coverage-lead-link"
              href={lead.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              referrerPolicy="no-referrer"
              aria-label={`${s.readOriginal} — ${lead.outlet} (${s.opensOutlet})`}
              className="underline underline-offset-2"
            >
              {s.readOriginal}
            </a>
          </li>
        ))}
      </ul>
      <p data-ask="coverage-leads-credit" className="text-[0.75rem] leading-[1.5] text-[var(--ask-read-ink3,#8299b4)]">
        <a href={result.attribution.link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="underline underline-offset-2">
          {s.credit}
        </a>
      </p>
    </section>
  );
}

export function AskCoverageLeads({
  question,
  questionClass,
  locale,
  displayOnly,
}: {
  readonly question: string;
  readonly questionClass: string | undefined;
  readonly locale: DisplayLocale;
  readonly displayOnly: boolean;
}): JSX.Element | null {
  const wanted = wantsCoverageLeads(questionClass, displayOnly);
  const [result, setResult] = useState<CoverageLeadsResult | null>(null);

  useEffect(() => {
    if (!wanted) return undefined;
    const controller = new AbortController();
    void fetchCoverageLeads(question, controller.signal).then((r) => {
      if (!controller.signal.aborted) setResult(r);
    });
    return () => controller.abort();
  }, [wanted, question]);

  if (!wanted || result === null) return null;
  return <AskCoverageLeadsList result={result} locale={locale} />;
}
