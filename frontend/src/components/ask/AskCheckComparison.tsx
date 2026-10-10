'use client';

import { useEffect, useState, type JSX } from 'react';
import { safeExternalHref, type DisplayLocale } from '@globalnews-ai/shared';
import {
  askV2Api,
  type AskV2BriefingEvidenceRef,
  type AskV2BriefingVersion,
  type AskV2ChangedEvidence,
  type AskV2FollowedCheck,
  type AskV2StructuredRecordChange,
} from '@/lib/api/askV2Api';
import { formatUtc } from '@/lib/ask/askR2View';
import { followStrings } from '@/lib/ask/followStrings';
import { followComparisonStrings } from '@/lib/ask/followComparisonStrings';
import {
  comparisonStatus,
  evidenceForClaim,
  isIncompleteCheck,
  recordStatus,
  versionReadOf,
  versionsToCompare,
  type ComparisonStatus,
  type VersionRead,
} from '@/lib/ask/followComparison';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 · D09 — CHANGE DETAIL: BEFORE / LATEST OF ONE RECORDED CHECK
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Reads only what exists: the check record (already in `GET /ask-v2/briefings/:id`) and, when that
 * record names both, its own `baselineVersion` and `resultingVersion`
 * (`GET /ask-v2/briefings/:id/versions/:v`, two database reads: 0 AI · 0 provider · nothing
 * re-searched). No other version is ever read or paired. When the record lacks a side, or a read
 * fails or is withheld, the reader is told so and nothing is compared.
 *
 * Two classes stay apart: CHANGES (points of the latest answer citing reporting published after
 * the earlier answer; a governed record for a new period) and NEW REPORTING (listed to read, never
 * presented as a change to the answer). There is no reviewed state; nothing here implies one.
 */
export function AskCheckComparison({
  briefingId,
  check,
  locale,
}: {
  readonly briefingId: string;
  /** The recorded check (from the briefing detail), or null when the address names none. */
  readonly check: AskV2FollowedCheck | null;
  readonly locale: DisplayLocale;
}): JSX.Element {
  const [reads, setReads] = useState<{ before: VersionRead | null; latest: VersionRead | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReads(null);
    /* the record alone decides: nothing to read, so nothing is read */
    if (check === null || recordStatus(check) !== null) {
      setReads({ before: null, latest: null });
      return;
    }
    const { before, latest } = versionsToCompare(check);
    if (before === null || latest === null) return;
    void Promise.all([
      askV2Api.briefingVersion(briefingId, before),
      askV2Api.briefingVersion(briefingId, latest),
    ]).then(([b, l]) => {
      if (cancelled) return;
      setReads({ before: versionReadOf(before, b), latest: versionReadOf(latest, l) });
    });
    return () => {
      cancelled = true;
    };
  }, [briefingId, check]);

  if (reads === null) {
    return (
      <p data-ask-change="loading" role="status" className="text-[13.5px] text-ink-tertiary">
        {followComparisonStrings(locale).loading}
      </p>
    );
  }
  return (
    <AskCheckComparisonView
      check={check}
      status={comparisonStatus(check, reads.before, reads.latest)}
      before={reads.before?.kind === 'OK' ? reads.before.version : null}
      latest={reads.latest?.kind === 'OK' ? reads.latest.version : null}
      locale={locale}
    />
  );
}

const STATUS_TEXT: Readonly<Record<Exclude<ComparisonStatus, 'READY'>, keyof ReturnType<typeof followComparisonStrings>>> = {
  CHECK_NOT_FOUND: 'checkNotFound',
  NO_BASELINE: 'noBaseline',
  NO_RESULT: 'noResult',
  SAME_VERSION: 'sameVersion',
  BEFORE_WITHHELD: 'beforeWithheld',
  LATEST_WITHHELD: 'latestWithheld',
  BEFORE_UNAVAILABLE: 'beforeUnavailable',
  LATEST_UNAVAILABLE: 'latestUnavailable',
};

/** Presentation only: the check, the status, and the two versions when (and only when) READY. */
export function AskCheckComparisonView({
  check,
  status,
  before,
  latest,
  locale,
}: {
  readonly check: AskV2FollowedCheck | null;
  readonly status: ComparisonStatus;
  readonly before: AskV2BriefingVersion | null;
  readonly latest: AskV2BriefingVersion | null;
  readonly locale: DisplayLocale;
}): JSX.Element {
  const c = followComparisonStrings(locale);
  const s = followStrings(locale);
  const when = (iso: string | null) => (iso === null ? '' : (formatUtc(iso, locale) ?? iso));
  const ready = status === 'READY' && before !== null && latest !== null;

  return (
    <section data-ask-change="detail" data-ask-change-status={status} className="flex flex-col gap-5">
      {check !== null && (
        <header className="flex flex-col gap-1">
          <p data-ask-change="checked" className="text-[12.5px] text-ink-tertiary">
            {c.checkOf(when(check.checkedAt))}
          </p>
          <p data-ask-change="outcome" data-ask-follow-outcome={check.outcome} className="text-[14px] font-semibold text-ink-primary">
            {s.outcome[check.outcome]}
          </p>
          <p className="text-[13.5px] text-ink-secondary">{s.outcomeDetail[check.outcome]}</p>
        </header>
      )}

      {/* an incomplete check is disclosed whatever else is shown */}
      {check !== null && isIncompleteCheck(check) && (
        <div data-ask-change="incomplete" role="note" className="flex flex-col gap-1 rounded-[10px] border border-dashed border-line p-3 text-[13.5px] text-ink-secondary">
          <p>{c.incompleteNote}</p>
          {check.assessment.unassessedSources.length > 0 && (
            <p>{s.partial(check.assessment.unassessedSources.join(', '))}</p>
          )}
          {(check.assessment.structured?.unassessed ?? []).length > 0 && (
            <p>{s.structuredUnassessed((check.assessment.structured?.unassessed ?? []).join(', '))}</p>
          )}
        </div>
      )}

      {!ready ? (
        <p data-ask-change="status" role="status" className="text-[14px] text-ink-secondary">
          {c[STATUS_TEXT[status as Exclude<ComparisonStatus, 'READY'>]] as string}
        </p>
      ) : (
        <>
          <div data-ask-change="pair" className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <VersionPanel side="before" label={c.before} version={before} when={when} c={c} />
            <VersionPanel side="latest" label={c.latest} version={latest} when={when} c={c} />
          </div>
          {check !== null && <ChangeLists check={check} latest={latest} when={when} locale={locale} />}
        </>
      )}
    </section>
  );
}

function EvidenceLine({
  title,
  url,
  publisher,
  publishedAt,
  when,
}: {
  readonly title: string;
  readonly url: string;
  readonly publisher: string;
  readonly publishedAt: string | null;
  readonly when: (iso: string | null) => string;
}): JSX.Element {
  /* B-1 — every external href goes through the one boundary; an unsafe URL is text only */
  const href = safeExternalHref(url);
  return (
    <li data-ask-change="evidence" className="text-[13px]">
      {href === undefined ? (
        <span>{title}</span>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-signal underline underline-offset-4">
          {title}
        </a>
      )}
      <span className="text-ink-tertiary">
        {' · '}
        {publisher}
        {publishedAt === null ? '' : ` · ${when(publishedAt)}`}
      </span>
    </li>
  );
}

function VersionPanel({
  side,
  label,
  version,
  when,
  c,
}: {
  readonly side: 'before' | 'latest';
  readonly label: string;
  readonly version: AskV2BriefingVersion;
  readonly when: (iso: string | null) => string;
  readonly c: ReturnType<typeof followComparisonStrings>;
}): JSX.Element {
  const facts = version.blocks.keyFacts;
  const refs = version.evidenceRefs;
  return (
    <article data-ask-change={side} data-ask-change-version={version.version} className="flex flex-col gap-2 rounded-[12px] border border-line bg-surface p-4">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">{label}</h2>
      <p className="text-[12.5px] text-ink-tertiary">{c.versionRecorded(version.version, when(version.asOf))}</p>
      {version.blocks.summary !== null ? (
        <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-primary">{version.blocks.summary}</p>
      ) : facts.length === 0 ? (
        <p className="text-[13px] text-ink-tertiary">{c.noText}</p>
      ) : null}
      {facts.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 ps-5 text-[13.5px] text-ink-primary">
          {facts.map((f, i) => (
            <li key={i}>{f.claim}</li>
          ))}
        </ul>
      )}
      {refs.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">{c.sources}</h3>
          <ul className="flex flex-col gap-1">
            {refs.map((r: AskV2BriefingEvidenceRef) => (
              <EvidenceLine key={r.id} title={r.title} url={r.url} publisher={r.publisher} publishedAt={r.publishedAt} when={when} />
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function ChangeLists({
  check,
  latest,
  when,
  locale,
}: {
  readonly check: AskV2FollowedCheck;
  readonly latest: AskV2BriefingVersion;
  readonly when: (iso: string | null) => string;
  readonly locale: DisplayLocale;
}): JSX.Element {
  const c = followComparisonStrings(locale);
  const s = followStrings(locale);
  const a = check.assessment;
  const st = a.structured;
  const evidence = (items: readonly AskV2ChangedEvidence[]) => (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <EvidenceLine key={item.id} title={item.title} url={item.url} publisher={item.publisher} publishedAt={item.publishedAt} when={when} />
      ))}
    </ul>
  );
  const records = (items: readonly AskV2StructuredRecordChange[]) => (
    <ul className="flex flex-col gap-1 text-[13px]">
      {items.map((item) => {
        const href = item.source.url === null ? undefined : safeExternalHref(item.source.url);
        return (
          <li key={`${item.contributorId}:${item.scope ?? ''}:${item.reference}`}>
            {item.period} · {item.geography}
            {item.label === null ? '' : ` · ${item.label}`}
            {' · '}
            {href === undefined ? (
              <span>{item.source.name}</span>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-signal underline underline-offset-4">
                {item.source.name}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
  const changeCount = a.supportedChanges.length + (st?.newEvents.length ?? 0);

  return (
    <>
      {/* ACTUAL CHANGES — points of the latest answer citing post-baseline reporting */}
      <section data-ask-change="changes" className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold text-ink-primary">{c.changesHeading}</h2>
        <p className="text-[13px] text-ink-tertiary">{c.changesNote}</p>
        {changeCount === 0 ? (
          <p data-ask-change="no-changes" className="text-[13.5px] text-ink-secondary">{c.noChanges}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {a.supportedChanges.map((change, i) => (
              <li key={i} data-ask-change="change" className="flex flex-col gap-1">
                <p className="text-[14px] text-ink-primary">{change.claim}</p>
                <ul className="flex flex-col gap-1">
                  {evidenceForClaim(change.sourceArticleIds, latest).map((ref) => (
                    <EvidenceLine key={ref.id} title={ref.title} url={ref.url} publisher={ref.publisher} publishedAt={ref.publishedAt} when={when} />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {st !== undefined && st.newEvents.length > 0 && (
          <div data-ask-change="structured-new">
            <h3 className="text-[13.5px] font-semibold">{s.structuredNew}</h3>
            {records(st.newEvents)}
          </div>
        )}
      </section>

      {/* NEW REPORTING — to read; never presented as a change to the answer */}
      {(a.newEvidence.length > 0 ||
        a.earlierReportingFoundNow.length > 0 ||
        a.possibleCorrections.length > 0 ||
        (st?.contentChanged ?? []).length > 0 ||
        (st?.lateAdmitted ?? []).length > 0) && (
        <section data-ask-change="new-reporting" className="flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold text-ink-primary">{c.newReportingHeading}</h2>
          <p className="text-[13px] text-ink-tertiary">{c.newReportingNote}</p>
          {a.newEvidence.length > 0 && evidence(a.newEvidence)}
          {a.possibleCorrections.length > 0 && (
            <div data-ask-change="possible-corrections">
              <h3 className="text-[13.5px] font-semibold">{s.possibleCorrections}</h3>
              <p className="text-[13px] text-ink-tertiary">{s.correctionNote}</p>
              {evidence(a.possibleCorrections)}
            </div>
          )}
          {a.earlierReportingFoundNow.length > 0 && (
            <div data-ask-change="earlier-found">
              <h3 className="text-[13.5px] font-semibold">{s.earlierFound}</h3>
              <p className="text-[13px] text-ink-tertiary">{s.earlierFoundNote}</p>
              {evidence(a.earlierReportingFoundNow)}
            </div>
          )}
          {st !== undefined && (st.contentChanged ?? []).length > 0 && (
            <div data-ask-change="structured-content-changed">
              <h3 className="text-[13.5px] font-semibold">{s.structuredContentChanged}</h3>
              <p className="text-[13px] text-ink-tertiary">{s.structuredContentChangedNote}</p>
              {records(st.contentChanged ?? [])}
            </div>
          )}
          {st !== undefined && st.lateAdmitted.length > 0 && (
            <div data-ask-change="structured-late">
              <h3 className="text-[13.5px] font-semibold">{s.structuredLate}</h3>
              <p className="text-[13px] text-ink-tertiary">{s.structuredLateNote}</p>
              {records(st.lateAdmitted)}
            </div>
          )}
        </section>
      )}
      {a.carriedOverCount > 0 && <p className="text-[13px] text-ink-tertiary">{s.carriedOver(a.carriedOverCount)}</p>}
      {a.notSeenThisCheckCount > 0 && <p className="text-[13px] text-ink-tertiary">{s.notSeen(a.notSeenThisCheckCount)}</p>}
      <p className="text-[13px] text-ink-tertiary">{s.expiredNotNote}</p>
    </>
  );
}
