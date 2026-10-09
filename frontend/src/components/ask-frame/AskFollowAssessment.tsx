'use client';

import type { JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import type { AskV2ChangedEvidence, AskV2FollowedCheck } from '@/lib/api/askV2Api';
import { followStrings } from '@/lib/ask/followStrings';
import { askFormatLocalDay } from '@/lib/ask/askDirection';

/**
 * REASON TO RETURN R1 · §8 / G9 — one check's assessment, exactly as the server decided it.
 * Lists only source-supported changes (new reporting with its own link and date); a possible
 * correction is flagged, never adjudicated; reporting not returned again is NOT a retraction;
 * an incomplete check says so and never reads as "nothing changed". No counts are invented:
 * every number shown is a length of a list the server returned.
 */
export function AskFollowAssessment({
  check,
  locale,
}: {
  readonly check: AskV2FollowedCheck;
  readonly locale: DisplayLocale;
}): JSX.Element {
  const s = followStrings(locale);
  const a = check.assessment;
  const evidence = (items: readonly AskV2ChangedEvidence[]) => (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.id}>
          <a href={item.url} target="_blank" rel="noopener noreferrer nofollow">
            {item.title}
          </a>
          <span>
            {' · '}
            {item.publisher}
            {item.publishedAt === null ? '' : ` · ${askFormatLocalDay(new Date(item.publishedAt), locale)}`}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div data-ask="follow-assessment" data-ask-follow-outcome={check.outcome} className="flex flex-col gap-2">
      <h3>{s.outcome[check.outcome]}</h3>
      <p>{s.outcomeDetail[check.outcome]}</p>
      {a.unassessedSources.length > 0 && <p>{s.partial(a.unassessedSources.join(', '))}</p>}
      {a.supportedChanges.length > 0 && (
        <section data-ask="follow-supported">
          <h4>{s.supportedChanges}</h4>
          <ul className="flex flex-col gap-1">
            {a.supportedChanges.map((change, i) => (
              <li key={i}>{change.claim}</li>
            ))}
          </ul>
        </section>
      )}
      {a.possibleCorrections.length > 0 && (
        <section data-ask="follow-corrections">
          <h4>{s.possibleCorrections}</h4>
          <p>{s.correctionNote}</p>
          {evidence(a.possibleCorrections)}
        </section>
      )}
      {a.newEvidence.length > 0 && (
        <section data-ask="follow-new-evidence">
          <h4>{s.newEvidence}</h4>
          {evidence(a.newEvidence)}
        </section>
      )}
      {a.earlierReportingFoundNow.length > 0 && (
        <section data-ask="follow-earlier">
          <h4>{s.earlierFound}</h4>
          <p>{s.earlierFoundNote}</p>
          {evidence(a.earlierReportingFoundNow)}
        </section>
      )}
      {a.carriedOverCount > 0 && <p>{s.carriedOver(a.carriedOverCount)}</p>}
      {a.notSeenThisCheckCount > 0 && <p>{s.notSeen(a.notSeenThisCheckCount)}</p>}
      <p>{s.expiredNotNote}</p>
    </div>
  );
}
