import Link from 'next/link';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { formatRelativeTime, formatUtcClock } from '@/lib/formatRelativeTime';

/**
 * R2 — ONE TODAY RECORD.
 *
 * ── THE CLOSED FIELD LIST, AND WHY IT IS CLOSED ───────────────────────────
 *
 * Everything this card renders is a real field of a real NewsArticle:
 * title, summary, source name, category, resolved country, provider-reported
 * publication time, and `firstSeenAt`. Nothing else is permitted here, and the
 * omissions are rulings rather than preferences:
 *
 *   - `sourcesCount` is provider-reported and never verified. Beside a country
 *     and a first-seen time it would read as corroboration breadth, which the
 *     TrustState contract explicitly disclaims;
 *   - `confidence` is an internal retrieval heuristic, never externally
 *     calibrated, so it is not a quality score;
 *   - `tag` and `sourceLanguage` exist on the contract but are not persisted;
 *   - TrustState, evidence breadth and any percentage exist ONLY inside an
 *     analysis result and are never computed for a headline.
 *
 * ── NO INFORMATION STATE ──────────────────────────────────────────────────
 *
 * The approved design gives a situation card a state badge and a coloured
 * accent rail. All six of its states — DEVELOPING, NEW, NEW EVIDENCE,
 * CONTESTED, SIGNIFICANT CHANGE, STABLE — derive from ANALYSIS records, and a
 * Today record is a retrieved article with no analysis at all. The design's own
 * rule then applies: a state with zero instances is not rendered as an empty
 * chip. So there is no badge, and the rail is NEUTRAL — present as structure,
 * carrying no claim.
 *
 * ── FIRST SEEN IS ABOUT US, NOT ABOUT THE WORLD ───────────────────────────
 *
 * `firstSeenAt` is the persisted first observation, written once and never
 * moved by re-observation. It is rendered as an explicit UTC clock so no
 * reader is shown a local-looking time the data does not support, and it is
 * labelled separately from `publishedAt`, which is marked provider-reported.
 * Conflating the two would present our ingestion schedule as editorial
 * recency. An article with no `firstSeenAt` never reaches this component.
 *
 * ── THE ANALYSE ACTION REUSES THE EXISTING CONTRACT, EXACTLY ──────────────
 *
 * `q` + `articleId` + optional `countryCode`, which SearchPageClient already
 * reads. No new analysis client, no second pipeline, nothing pre-run, and
 * components/search/** is untouched. `articleId` is PASSED THROUGH here as the
 * deep link's own parameter; it is never used as identity for grouping or
 * deduplication, which is keyed on `url` (see allocateToday).
 */
interface TodayCardProps {
  record: NewsArticle;
  language: LanguageCode;
}

export function TodayCard({ record, language }: TodayCardProps): JSX.Element {
  const t = getDictionary(language).today;
  const categoryLabels = getDictionary(language).map.categories;

  const countryLabel =
    record.countryCode && record.countryName
      ? getCountryDisplayName(record.countryCode, language, record.countryName)
      : null;

  const analysisParams = new URLSearchParams({ q: record.title, articleId: record.id });
  if (record.countryCode) {
    analysisParams.set('countryCode', record.countryCode);
  }

  return (
    <article
      className="relative rounded-gn-card border border-gn-line-card bg-gn-panel py-[16px] pl-[18px] pr-[18px]"
      aria-label={`${countryLabel ?? t.unresolvedLabel}, ${record.title}`}
    >
      {/* Neutral structural rail. It carries no state and no claim. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[2px] rounded-l-gn-card bg-gn-line-strong"
      />

      <div className="flex flex-wrap items-center gap-[8px] font-gn-mono text-gn-hud-label uppercase text-gn-ink-meta">
        <span>{categoryLabels[record.category] ?? record.category}</span>
        {countryLabel !== null && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span className="text-gn-ink-geo">{countryLabel}</span>
          </>
        )}
        <span aria-hidden="true">&middot;</span>
        <span>{record.sourceName}</span>
      </div>

      <h3 className="mt-[8px] font-gn-display text-gn-card-title text-gn-ink-primary">
        <a
          href={record.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-gn-cell outline-none transition-colors hover:text-gn-ink-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
          aria-label={`${t.readStoryPrefix} ${record.title}`}
        >
          {record.title}
        </a>
      </h3>

      {/*
        R2.1 C2 — the provider summary reads in the SECONDARY PROSE ink.

        gn-ink-quote (#b8cbdc) is one deliberate step below gn-ink-prose
        (#d5e1ee), which is the prose ink the released analysis surfaces use for
        primary prose. It is emphatically NOT gn-ai (#60a5fa): nothing on a Today
        card is an interpretation or a link, and colouring provider text in the
        AI hue would say it was.
      */}
      <p className="mt-[6px] font-gn-display text-gn-prose text-gn-ink-quote">{record.summary}</p>

      {/*
        R2.1 C4 — BELOW 768px THE TWO TIMES ARE SEPARATE LINES.

        Stacked, a middle dot is a separator between things that are no longer
        side by side, so it is removed rather than rotated or kept as decoration.
        768px is the design's own mobile boundary, not a Tailwind default.

        R2.1 C7 — FIRST SEEN IS PROMOTED, PUBLISHED STAYS SUBORDINATE.

        First observation is OUR fact and the one this surface is built on, so it
        takes gn-hud-index (10.5px, 0.09em) in gn-ink-value (#a9bccf) — both
        released tokens, matching the correction's stated 10.5px / ~0.08em /
        #A9BCCF exactly, so no token is added and no arbitrary value is invented.
        Publication time is the PROVIDER's claim: it stays at gn-hud-meta in
        gn-ink-meta and keeps its explicit provider-reported qualifier, so the two
        can never be read as one kind of statement.
      */}
      <div className="mt-[10px] flex flex-col items-start gap-[4px] border-t border-gn-line-telemetry pt-[10px] uppercase md:flex-row md:flex-wrap md:items-center md:gap-[10px]">
        <span className="font-gn-mono text-gn-hud-index text-gn-ink-value">
          {t.firstSeenLabel} {formatUtcClock(record.firstSeenAt as string)}
        </span>
        <span aria-hidden="true" className="hidden font-gn-mono text-gn-hud-meta text-gn-ink-meta md:inline">
          &middot;
        </span>
        <span className="font-gn-mono text-gn-hud-meta text-gn-ink-meta">
          {t.publishedLabel} {formatRelativeTime(record.publishedAt, language)} ({t.publishedProviderNote})
        </span>

        <Link
          href={`/search?${analysisParams.toString()}`}
          aria-label={`${t.analyseAriaPrefix} ${record.title}`}
          className="inline-flex min-h-[44px] items-center rounded-gn-pill md:ml-auto border border-gn-line-pill px-[12px] text-gn-ink-active outline-none transition-colors hover:border-gn-line-pill-hover hover:bg-gn-pill-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
        >
          {t.analyse}
        </Link>
      </div>
    </article>
  );
}
