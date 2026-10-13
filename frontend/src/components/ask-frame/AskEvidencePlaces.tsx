import type { JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import type { AskR2Payload } from '@/lib/api/askV2Api';
import { evidencePlacesOf } from '@/lib/ask/askEvidencePlaces';
import { askR32Strings } from '@/lib/ask/askR32Strings';
import { placeResearchDraft } from '@/lib/ask/d01PlaceDraft';

/**
 * MASTER CTO R32 · D10 — the places of THIS answer's cited reports, as a compact line inside the
 * answer (never a map, never a separate page). Country level only, as recorded for each report;
 * a report without an established country is counted as such, not guessed. "Ask about …" STAGES
 * the place research draft (the same executable wording Choose a place uses) in the composer:
 * nothing is sent until the reader presses Send, and a reader's own unsent words are kept.
 */
export function AskEvidencePlaces({
  payload,
  locale,
  onStageDraft,
}: {
  readonly payload: AskR2Payload;
  readonly locale: DisplayLocale;
  /** Absent (a display-only reopened answer) → the places are listed without the action. */
  readonly onStageDraft?: (draft: string) => void;
}): JSX.Element | null {
  const s = askR32Strings(locale);
  const view = evidencePlacesOf(payload.analysis?.analysis?.sources ?? [], payload.analysis?.articles ?? [], locale);
  if (view === null) return null;
  return (
    <section data-ask="evidence-places" aria-label={s.placesTitle} className="mt-4 flex flex-col gap-1.5">
      <p className="text-[0.75rem] font-semibold text-[var(--ask-read-ink2,#8fa6c0)]">{s.placesTitle}</p>
      <ul className="flex flex-col gap-1">
        {view.places.map((place) => (
          <li
            key={place.iso2}
            data-ask="evidence-place"
            data-ask-place={place.iso3}
            className="flex flex-wrap items-center gap-x-2 text-[13.5px] leading-[1.45] text-[var(--ask-read-ink,#cfe2f2)]"
          >
            <span className="font-semibold">{place.name}</span>
            <span className="text-[0.75rem] text-[var(--ask-read-ink3,#8299b4)]">{s.placeReports(place.reports)}</span>
            {onStageDraft !== undefined && (
              <button
                type="button"
                data-ask="evidence-place-ask"
                onClick={() => onStageDraft(placeResearchDraft(locale, place.name))}
                className="inline-flex min-h-[44px] items-center text-[0.8125rem] font-medium text-[var(--ask-read-control-ink,#7cc4f5)] underline underline-offset-2"
              >
                {s.askAboutPlace(place.name)}
              </button>
            )}
          </li>
        ))}
        {view.notEstablished > 0 && (
          <li
            data-ask="evidence-place-unestablished"
            className="flex flex-wrap items-center gap-x-2 text-[13.5px] leading-[1.45] text-[var(--ask-read-ink2,#8fa6c0)]"
          >
            <span>{s.placeNotEstablished}</span>
            <span className="text-[0.75rem] text-[var(--ask-read-ink3,#8299b4)]">{s.placeReports(view.notEstablished)}</span>
          </li>
        )}
      </ul>
      <p className="text-[0.75rem] text-[var(--ask-read-ink3,#8299b4)]">{s.placesBasis}</p>
    </section>
  );
}
