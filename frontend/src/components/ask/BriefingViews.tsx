import Link from 'next/link';
import { safeExternalHref, type DisplayLocale } from '@globalnews-ai/shared';
import type { AnalysisSourceRef } from '@globalnews-ai/shared';
import type {
  AskR2Payload,
  AskV2BriefingDetail,
  AskV2BriefingSummary,
  AskV2BriefingUpdate,
  AskV2BriefingVersion,
} from '@/lib/api/askV2Api';
import { formatUtc } from '@/lib/ask/askR2View';
import { briefingStrings } from '@/lib/ask/briefingStrings';
import { AskEvidenceTable } from './AskEvidenceTable';
import { AskIntelligenceBasis } from '@/components/ask-frame/AskIntelligenceBasis';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';

/**
 * R2 · D1 — PRESENTATION ONLY. Every view here renders a stored briefing exactly as the server
 * returned it: no fetch, no effect, no AI, nothing composed. The client wrappers
 * (SavedBriefings, BriefingDetailClient) do the reads.
 */
export function briefingHref(id: string, version?: number): string {
  const base = `/saved/briefing?id=${encodeURIComponent(id)}`;
  return version === undefined ? base : `${base}&v=${encodeURIComponent(String(version))}`;
}

function UpdateLine({
  update,
  locale,
}: {
  readonly update: AskV2BriefingUpdate | null;
  readonly locale: DisplayLocale;
}): JSX.Element | null {
  const t = askShellStrings(locale).briefingStrings;
  if (update === null) return null;
  const text = update.storyGone ? t.storyGone : update.available ? t.updateAvailable : t.noUpdate;
  return (
    <p
      data-briefing="update"
      data-update-available={update.available ? 'true' : 'false'}
      className={`text-[12.5px] ${update.available ? 'text-[#8fd3ff]' : 'text-ink-tertiary'}`}
    >
      {text}
    </p>
  );
}

export function BriefingListView({
  rows,
  locale,
}: {
  readonly rows: readonly AskV2BriefingSummary[];
  readonly locale: DisplayLocale;
}): JSX.Element {
  const t = askShellStrings(locale).briefingStrings;
  if (rows.length === 0)
    return (
      <p data-briefing="empty" className="mt-2 text-[13px] text-ink-tertiary">
        {t.empty}
      </p>
    );
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {rows.map((row) => (
        <li
          key={row.id}
          data-briefing="row"
          className="rounded-[10px] border border-white/10 px-3 py-2.5"
        >
          <Link
            href={briefingHref(row.id)}
            className="text-[14px] font-semibold text-ink-primary hover:underline"
          >
            {row.title}
          </Link>
          <p className="mt-0.5 text-[12px] text-ink-tertiary">
            {row.scope.storyId
              ? t.scopeStory
              : row.scope.countryCode
                ? `${t.scopeCountry}: ${row.scope.countryCode}`
                : t.scopeQuestion}
            {row.latestVersion !== null && row.latestAsOf !== null
              ? ` · ${t.latest(row.latestVersion, formatUtc(row.latestAsOf, locale) ?? row.latestAsOf)}`
              : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function BriefingVersionView({
  detail,
  version,
  locale,
}: {
  readonly detail: AskV2BriefingDetail;
  readonly version: AskV2BriefingVersion;
  readonly locale: DisplayLocale;
}): JSX.Element {
  const t = askShellStrings(locale).briefingStrings;
  const when = (iso: string | null) => (iso === null ? null : (formatUtc(iso, locale) ?? iso));
  /* the saved answer rests on at least one USED, non-context governed record (a structured answer) */
  const governedBasis = (version.blocks.intelligence?.contributions ?? []).some(
    (c) =>
      c.status === 'USED' &&
      c.applicability !== 'CONTEXT' &&
      c.contributorId !== 'GEOGRAPHY' &&
      (c.observations ?? []).length > 0,
  );
  /* The table's citation numbers point at this version's own stored references. */
  const sources: AnalysisSourceRef[] = version.evidenceRefs.map((r) => ({
    articleId: r.id,
    publisher: r.publisher,
    title: r.title,
    url: r.url,
    publishedAt: r.publishedAt ?? '',
  }));
  return (
    <article data-briefing="version" data-version={version.version} className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[24px] font-semibold text-ink-primary">{detail.title}</h1>
        <p className="text-[12.5px] text-ink-tertiary">
          {detail.scope.storyId
            ? t.scopeStory
            : detail.scope.countryCode
              ? `${t.scopeCountry}: ${detail.scope.countryCode}`
              : `${t.scopeQuestion}: ${detail.scope.question ?? ''}`}
        </p>
        <UpdateLine update={detail.update} locale={locale} />
      </header>

      <nav aria-label={t.versions} data-briefing="versions">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
          {t.versions}
        </h2>
        <ol className="mt-1 flex flex-wrap gap-2">
          {detail.versions.map((v) => (
            <li key={v.version}>
              <Link
                href={briefingHref(detail.id, v.version)}
                aria-current={v.version === version.version ? 'page' : undefined}
                className={`inline-block rounded-[8px] border px-2.5 py-1 text-[12px] ${
                  v.version === version.version
                    ? 'border-[#1b6fa8] bg-[#07304f] text-[#8fd3ff]'
                    : 'border-white/10 text-ink-secondary hover:border-[#5abff5]'
                }`}
              >
                {t.version(v.version)} · {when(v.asOf)}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <section className="flex flex-col gap-1">
        <p data-briefing="read-only" className="text-[12px] text-ink-tertiary">
          {t.readOnly}
        </p>
        <p className="text-[12px] text-ink-tertiary">
          {t.asOf} {when(version.asOf)}
          {version.windowFrom !== null
            ? ` · ${t.window}: ${when(version.windowFrom)} – ${when(version.windowTo)}`
            : ''}
        </p>
        {version.supersededBy !== null && (
          <p data-briefing="superseded" role="note" className="text-[12.5px] text-[#c9b27a]">
            {t.superseded(version.supersededBy)}
          </p>
        )}
      </section>

      <section data-briefing="summary" className="flex flex-col gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
          {t.summary}
        </h2>
        {version.blocks.summary !== null ? (
          <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink-primary">
            {version.blocks.summary}
          </p>
        ) : governedBasis ? null : (
          /* a governed-record answer is sourced by its records (shown below), never "no sourced answer" */
          <p className="text-[13px] text-ink-tertiary">{t.noSourcedAnswer}</p>
        )}
        {version.blocks.background !== null && (
          <div data-briefing="background" className="flex flex-col gap-1">
            <h3 className="text-[12px] font-semibold text-ink-secondary">{t.background}</h3>
            <p className="text-[12px] text-ink-tertiary">{t.backgroundNote}</p>
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-secondary">
              {version.blocks.background.text}
            </p>
          </div>
        )}
      </section>

      {version.blocks.keyFacts.length > 0 && (
        <section data-briefing="key-facts" className="flex flex-col gap-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
            {t.keyFacts}
          </h2>
          <ul className="flex list-disc flex-col gap-1 ps-5 text-[13.5px] text-ink-primary">
            {version.blocks.keyFacts.map((f, i) => (
              <li key={i}>
                {f.claim}{' '}
                {f.sourceArticleIds
                  .map((id) => sources.findIndex((s) => s.articleId === id) + 1)
                  .filter((n) => n > 0)
                  .map((n) => (
                    <span key={n} className="font-mono text-[11px] text-ink-tertiary">
                      [{n}]
                    </span>
                  ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <AskEvidenceTable
        table={version.blocks.comparisonTable}
        sources={sources}
        language={locale}
      />

      {/*
        CTO review of cf7a5d1 (Politics 4a0e501 reconciliation) — the governed specialist basis the
        saved answer used is STORED (blocks.intelligence) and is now SHOWN, through the SAME component
        and view rules as the live answer: only USED, non-context contributions, never a raw record.
        Old versions without the field show nothing (unknown, not none).
      */}
      {version.blocks.intelligence != null && (
        <div data-briefing="intelligence">
          <AskIntelligenceBasis
            payload={{ intelligence: version.blocks.intelligence } as unknown as AskR2Payload}
            locale={locale}
            reportingSourceCount={sources.length}
          />
        </div>
      )}

      <section data-briefing="gaps" className="flex flex-col gap-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
          {t.coverageGaps}
        </h2>
        {version.coverageGaps.length === 0 ? (
          <p className="text-[13px] text-ink-tertiary">{t.noGaps}</p>
        ) : (
          <ul className="flex list-disc flex-col gap-1 ps-5 text-[13px] text-ink-secondary">
            {version.coverageGaps.map((g, i) => (
              <li key={i}>{g === 'NO_SOURCED_ANSWER' ? t.noSourcedAnswer : g}</li>
            ))}
          </ul>
        )}
      </section>

      {sources.length > 0 && (
        <section data-briefing="sources" className="flex flex-col gap-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
            {t.sources}
          </h2>
          <ol className="flex flex-col gap-1.5">
            {version.evidenceRefs.map((r, i) => (
              <li key={r.id} className="text-[13px]">
                <span className="me-1.5 font-mono text-[11px] text-ink-tertiary">[{i + 1}]</span>
                <a
                  href={safeExternalHref(r.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-signal hover:underline"
                >
                  {r.title}
                </a>
                <span className="text-ink-tertiary">
                  {' '}
                  · {r.publisher}
                  {r.publishedAt ? ` · ${when(r.publishedAt)}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}
