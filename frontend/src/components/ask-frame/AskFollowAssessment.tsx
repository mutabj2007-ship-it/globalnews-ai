'use client';

import type { JSX } from 'react';
import { safeExternalHref, type DisplayLocale } from '@globalnews-ai/shared';
import type {
  AskV2ChangedEvidence,
  AskV2FollowedCheck,
  AskV2StructuredRecordChange,
} from '@/lib/api/askV2Api';
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
      {items.map((item) => {
        /* B-1 — every external href goes through the one boundary; an unsafe URL is text only */
        const href = safeExternalHref(item.url);
        return (
        <li key={item.id}>
          {href === undefined ? (
            <span>{item.title}</span>
          ) : (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {item.title}
            </a>
          )}
          <span>
            {' · '}
            {item.publisher}
            {item.publishedAt === null ? '' : ` · ${askFormatLocalDay(new Date(item.publishedAt), locale)}`}
          </span>
        </li>
        );
      })}
    </ul>
  );

  const st = a.structured;
  /* a governed record: source-stated period · place · label · source (never a quotation) */
  const records = (items: readonly AskV2StructuredRecordChange[]) => (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const href = item.source.url === null ? undefined : safeExternalHref(item.source.url);
        return (
          <li key={`${item.contributorId}:${item.scope ?? ''}:${item.reference}`}>
            <span>
              {item.period} · {item.geography}
              {item.label === null ? '' : ` · ${item.label}`}
              {' · '}
            </span>
            {href === undefined ? (
              <span>{item.source.name}</span>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {item.source.name}
              </a>
            )}
          </li>
        );
      })}
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
      {/* CTO R1-B §3 — governed specialist records: what changed, and what could not be assessed */}
      {st !== undefined && st.unassessed.length > 0 && (
        <p data-ask="follow-structured-unassessed">{s.structuredUnassessed(st.unassessed.join(', '))}</p>
      )}
      {st !== undefined && st.revised.length > 0 && (
        <section data-ask="follow-structured-revised">
          <h4>{s.structuredRevised}</h4>
          {records(st.revised)}
        </section>
      )}
      {st !== undefined && st.newEvents.length > 0 && (
        <section data-ask="follow-structured-new">
          <h4>{s.structuredNew}</h4>
          {records(st.newEvents)}
        </section>
      )}
      {st !== undefined && st.lateAdmitted.length > 0 && (
        <section data-ask="follow-structured-late">
          <h4>{s.structuredLate}</h4>
          <p>{s.structuredLateNote}</p>
          {records(st.lateAdmitted)}
        </section>
      )}
      {st !== undefined && st.carriedOverCount > 0 && <p>{s.structuredCarried(st.carriedOverCount)}</p>}
      {st !== undefined && st.notSeenThisCheckCount > 0 && <p>{s.structuredNotSeen(st.notSeenThisCheckCount)}</p>}
      <p>{s.expiredNotNote}</p>
    </div>
  );
}
