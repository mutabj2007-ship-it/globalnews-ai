'use client';
import { useRef, useState, type JSX } from 'react';
import { EXTERNAL_LINK_REL, safeExternalHref, type DisplayLocale } from '@globalnews-ai/shared';
import {
  fetchCoverageLeads,
  type CoverageLeadsOutcome,
  type CoverageLeadsResult,
} from '@/lib/api/coverageLeadsApi';
import { askCoverageLeadsStrings } from '@/lib/ask/askCoverageLeadsStrings';
import { COVERAGE_LEADS_UI_ENABLED } from '@/lib/ask/coverageLeadsActivation';
import { formatUtc } from '@/lib/ask/askR2View';
import { isolatedAuto } from '@/lib/ask/askDirection';

/* H R168 E1 — every control on this panel is a 44 px touch target */
const TAP = 'inline-flex min-h-[44px] items-center underline underline-offset-2';

/*
  CTO R168 — GDELT coverage leads, a clearly separate OPTIONAL section after the answer. It is NOT
  part of the answer: nothing here is a source, a citation, a count or evidence, and the answer,
  Sources panel and Search activity never read it.

  Nothing is sent until the reader presses "Show coverage leads": rendering a turn (live, restored
  or reopened) never makes a request, so every "nothing is sent" invariant of the Ask surface holds.
  The control exists only when the code switch COVERAGE_LEADS_UI_ENABLED is on (R169: never a build
  variable; see coverageLeadsActivation.ts) and only
  for an explicit news question; any other class renders nothing. Outlet names are plain text; each
  link goes through the shared external-href boundary and opens the outlet's page in a new tab.
*/
export const COVERAGE_LEAD_QUESTION_CLASSES: ReadonlySet<string> = new Set([
  'CURRENT_REPORTING',
  'CURRENT_STATUS_VERIFICATION',
]);


export function wantsCoverageLeads(questionClass: string | undefined, displayOnly: boolean, switchOn: boolean): boolean {
  return switchOn && !displayOnly && questionClass !== undefined && COVERAGE_LEAD_QUESTION_CLASSES.has(questionClass);
}

const NOTE = 'text-[0.8125rem] leading-[1.5] text-[var(--ask-read-ink3,#8299b4)]';

export function AskCoverageLeadsList({
  result,
  locale,
}: {
  readonly result: CoverageLeadsResult;
  readonly locale: DisplayLocale;
}): JSX.Element {
  const s = askCoverageLeadsStrings(locale);
  return (
    <>
      <h3 className="text-[0.8125rem] font-semibold leading-[1.4] text-[var(--ask-read-ink2,#9fb4cc)]">{s.heading}</h3>
      <p data-ask="coverage-leads-note" className={NOTE}>
        {s.note}
      </p>
      <ul className="flex flex-col gap-1.5">
        {result.leads.map((lead) => {
          /* H R168 note — an unformattable time is dropped, never shown raw beside "Seen by GDELT" */
          const seen = formatUtc(lead.seenByGdeltAt, locale);
          return (
          <li key={lead.url} data-ask="coverage-lead" className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem] leading-[1.5]">
            {/* H R168 E2/E4 — names wrap at word boundaries; outlet and time are bidi-isolated runs */}
            <span data-ask="coverage-lead-outlet" className="break-words text-[var(--ask-read-ink,#dbe6f3)]" {...isolatedAuto()}>
              {lead.outlet}
            </span>
            {seen !== null && (
              <span data-ask="coverage-lead-seen" className="text-[var(--ask-read-ink3,#8299b4)]" {...isolatedAuto()}>
                {s.seenBy(seen)}
              </span>
            )}
            <a
              data-ask="coverage-lead-link"
              href={safeExternalHref(lead.url)}
              target="_blank"
              rel={`${EXTERNAL_LINK_REL} nofollow`}
              referrerPolicy="no-referrer"
              aria-label={`${s.readOriginalAria} — ${lead.outlet} (${s.opensOutlet})`}
              className={TAP}
            >
              {s.readOriginal}
            </a>
          </li>
          );
        })}
      </ul>
      <p data-ask="coverage-leads-credit" className="text-[0.75rem] leading-[1.5] text-[var(--ask-read-ink3,#8299b4)]">
        <a
          href={safeExternalHref(result.attribution.link)}
          target="_blank"
          rel={EXTERNAL_LINK_REL}
          referrerPolicy="no-referrer"
          className={TAP}
        >
          {s.credit}
        </a>
      </p>
    </>
  );
}

type PanelState = { readonly kind: 'IDLE' } | { readonly kind: 'LOADING' } | CoverageLeadsOutcome;

export function AskCoverageLeads({
  question,
  questionClass,
  locale,
  displayOnly,
  switchOn = COVERAGE_LEADS_UI_ENABLED,
}: {
  readonly question: string;
  readonly questionClass: string | undefined;
  readonly locale: DisplayLocale;
  readonly displayOnly: boolean;
  readonly switchOn?: boolean;
}): JSX.Element | null {
  const [state, setState] = useState<PanelState>({ kind: 'IDLE' });
  const inFlight = useRef(false);
  if (!wantsCoverageLeads(questionClass, displayOnly, switchOn)) return null;
  const s = askCoverageLeadsStrings(locale);

  const load = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ kind: 'LOADING' });
    void fetchCoverageLeads(question).then((outcome) => setState(outcome));
  };

  return (
    <section
      data-ask="coverage-leads"
      data-ask-coverage-state={state.kind}
      aria-label={s.heading}
      /* H R168 E3 — no bordered card around the lone button: the frame appears with content */
      className={`mt-4 flex flex-col gap-2 ${state.kind === 'IDLE' ? '' : 'rounded-[12px] border border-[var(--ask-read-rule,#26384f)] p-3.5'}`}
    >
      {state.kind === 'IDLE' && (
        <button type="button" data-ask="coverage-leads-show" onClick={load} className={`self-start text-[0.8125rem] ${TAP}`}>
          {s.show}
        </button>
      )}
      {state.kind === 'LOADING' && (
        <p className={NOTE} role="status">
          {s.loading}
        </p>
      )}
      {state.kind === 'NONE' && <p className={NOTE}>{s.none}</p>}
      {state.kind === 'UNAVAILABLE' && <p className={NOTE}>{s.unavailable}</p>}
      {state.kind === 'LEADS' && <AskCoverageLeadsList result={state.result} locale={locale} />}
    </section>
  );
}
