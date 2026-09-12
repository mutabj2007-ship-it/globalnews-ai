'use client';

import { forwardRef } from 'react';
import type { SyntheticEvent } from 'react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import type { SourceSupportEntry } from '../search/analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatObservationalTime } from '@/lib/formatRelativeTime';

export const SOURCES_DOCK_ID = 'gn-paf-sources-dock';

/**
 * P-11 — the bottom evidence dock (F-5, F-6).
 *
 * NOT AN OVERLAY. No scrim, no backdrop blur, no focus trap, no
 * body-scroll lock — the analysis stays fully legible while sources are
 * open, which is the entire defect this replaces.
 *
 * Expanding takes height from the CENTRE track only; the frame's own
 * height never changes and the brief, index and location panels never
 * move. That is a property of the grid, not of this component.
 *
 * RULING 1 — WHAT IS DELIBERATELY ABSENT. `05 §2` and handoff §6 ask
 * each source row to carry a per-source geographic-resolution tag (cyan
 * for city, neutral for country) and a per-source cluster label. Neither
 * exists in the contract: the analysis source record has no geographic
 * field, the article record's precision field is populated by nothing,
 * and no per-article cluster identity is exposed — source diversity is
 * aggregate-only. Both are omitted rather than fabricated. What IS shown
 * is what the contract supplies: outlet, title, age, language, and the
 * dimensions that cite the source. The spec asserts the absence against
 * this file's source text, so the identifiers are not written here.
 *
 * ORDER IS RESPONSE ORDER. Identity is `articleId`. Neither is changed
 * here, ever.
 */
import {
  RelationalEvidencePanel,
  UnmatchedRelationalEvidence,
} from './RelationalEvidencePanel';
import { assessmentsFor, EMPTY_RELATIONAL_EVIDENCE } from './relationalEvidence';
import type { RelationalEvidenceModel } from './relationalEvidence';

/* ------------------------------------------------------------------ *
 * THE SOURCE THUMBNAIL
 * ------------------------------------------------------------------ *
 *
 * WHY THIS IS NOT A NEW DESIGN. `LocationImage.tsx` states the contract
 * from the other side: "article imagery in the dock and library carries
 * a GREEN chip with different words in a different position (SS7.2)".
 * `EvidenceLibrary.tsx` built the library half. This is the dock half,
 * and it reuses the library's exact treatment: a real <img> when the
 * record carries one, and the same striped diagonal panel when it does
 * not.
 *
 * THE CHIP IS DELIBERATELY ABSENT HERE, under an explicit CTO ruling.
 * The chip is 18px tall with a fourteen-character label and does not fit
 * a 48px thumbnail; the confusion SS7.2 guards against - representative
 * location imagery mistaken for event evidence - cannot arise inside a
 * card that already names the outlet and the story, beside a location
 * column that carries its own grey chip in its own region. The green
 * treatment in `EvidenceLibrary.tsx` is untouched.
 *
 * WHAT IS NEVER SUBSTITUTED. Not `/images/article-placeholder.jpg`, not
 * any location asset, not a remote placeholder service. A record with no
 * image renders the striped panel and nothing else. The search lane's
 * `SourceArticleCard` does substitute a shipped photograph; doing that
 * here would put a stock picture where an article's own picture belongs,
 * which is the fabrication this lane's own library rule forbids.
 *
 * THE STRIPES ARE ALWAYS PRESENT, on the WRAPPER, underneath the image.
 * That is what makes the failure path free: nothing has to be swapped
 * in, only uncovered.
 */

const THUMB_STRIPES =
  'repeating-linear-gradient(135deg, rgba(148,163,184,.09) 0 6px, transparent 6px 12px)';

/** The library's own test, so the two surfaces cannot drift apart. */
export function hasSourceThumbnail(article: NewsArticle): boolean {
  return typeof article.imageUrl === 'string' && article.imageUrl.length > 0;
}

/**
 * A provider URL that 404s or times out would otherwise draw the
 * browser's own broken-image glyph. Hiding the failed element uncovers
 * the striped wrapper behind it, so the broken case and the absent case
 * render identically.
 *
 * Deliberately STATELESS and exported. No per-card React state is
 * introduced, and the spec can drive this function directly - an
 * `onError` handler never appears in server-rendered markup, so a
 * rendered-markup assertion could not reach it.
 */
export function hideFailedSourceThumbnail(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = 'none';
}

interface SourceThumbnailProps {
  article: NewsArticle;
  /** 48 in the compact row, 56 in the expanded card. */
  size: number;
}

function SourceThumbnail({ article, size }: SourceThumbnailProps): JSX.Element {
  const present = hasSourceThumbnail(article);
  return (
    <div
      data-paf="source-thumb"
      data-has-image={present ? 'true' : 'false'}
      /* Decorative: the card's own title names the story, so a second
         announcement here would be a duplicate for a screen reader. */
      aria-hidden="true"
      className="shrink-0 overflow-hidden rounded-[6px] border border-[#16202e] bg-[#071016]"
      style={{ width: `${size}px`, height: `${size}px`, backgroundImage: THUMB_STRIPES }}
    >
      {present ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={hideFailedSourceThumbnail}
        />
      ) : null}
    </div>
  );
}

export interface SourcesDockProps {
  sources: readonly SourceSupportEntry[];
  expanded: boolean;
  onToggle: () => void;
  /** articleId the citation binding last requested; highlighted 1.2s. */
  highlightedArticleId: string | null;
  /**
   * R4.2 — relational evidence, grouped by articleId. Defaults to the
   * empty model, so a caller that has none renders exactly the pre-R4.2
   * dock: no control, no panel, no zero.
   */
  relational?: RelationalEvidenceModel;
  language?: LanguageCode;
}

export const SourcesDock = forwardRef<HTMLDivElement, SourcesDockProps>(function SourcesDock(
  { sources, expanded, onToggle, highlightedArticleId, relational = EMPTY_RELATIONAL_EVIDENCE, language = 'en' },
  ref,
) {
  const dict = getDictionary(language);
  const t = dict.analysisFrame;
  const empty = sources.length === 0;

  return (
    <section
      data-paf="sources-dock"
      aria-label={t.sourcesRegion}
      className="flex min-h-0 flex-col overflow-hidden border-t border-[#16202e] bg-[#060a10]"
    >
      <h2 className="sr-only">{t.sourcesRegion}</h2>
      <button
        type="button"
        data-paf="dock-toggle"
        aria-expanded={expanded}
        aria-controls={SOURCES_DOCK_ID}
        aria-label={expanded ? t.dockCollapse : t.dockExpand}
        disabled={empty}
        onClick={onToggle}
        className="flex min-h-[26px] shrink-0 flex-wrap items-center gap-x-2 gap-y-1 px-5 py-[2px] text-left font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.16em] text-[#a9bccf] disabled:text-[#4a5c73] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gn-focus"
      >
        <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
        {empty ? t.noReportsRetrieved : `${t.dockHeader} · ${sources.length}`}

        {/*
          ALPHA CLOSURE — an OBVIOUS expand affordance, not just a caret.

          The caret alone read as decoration on a one-line dock. This is
          the same control (one button, one `aria-expanded`), so no second
          toggle and no competing state is introduced; the word simply
          makes the affordance legible. It says VIEW ALL only while there
          is more to see.
        */}
        {empty ? null : (
          <span
            data-paf="dock-view-all"
            aria-hidden="true"
            className="ml-auto rounded-[4px] border border-[#22303f] px-2 py-[2px] text-[12px] md:text-[11px] tracking-[0.14em] text-[#67e8f9]"
          >
            {expanded ? t.dockCollapseShort : `${t.dockViewAll} · ${sources.length}`}
          </span>
        )}
      </button>

      <div
        id={SOURCES_DOCK_ID}
        ref={ref}
        data-paf={expanded ? 'dock-expanded' : 'dock-compact'}
        tabIndex={expanded ? 0 : -1}
        className={
          expanded
            ? 'min-h-0 flex-1 overflow-y-auto px-5 pb-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gn-focus'
            : 'min-h-0 flex-1 overflow-hidden px-5'
        }
      >
        {empty ? null : expanded ? (
          <>
          <ul className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
            {sources.map((entry) => (
              <li key={entry.articleId}>
                <article
                  data-paf="source-card"
                  data-article-id={entry.articleId}
                  data-highlighted={highlightedArticleId === entry.articleId ? 'true' : undefined}
                  className={`rounded-[10px] border p-3 ${
                    highlightedArticleId === entry.articleId ? 'border-[#67e8f9]' : 'border-[#16202e]'
                  }`}
                >
                  {/*
                    The thumbnail LEADS, beside the text rather than above
                    it. A 16:9 strip across a 250px card is 140px of image
                    per card, which is the multi-column image-card wall R4
                    SS2 rejected and `r4Responsive.spec.ts` still guards.
                    The four text elements keep their existing order and
                    markup; only their container is new.
                  */}
                  <div className="flex gap-3">
                    <SourceThumbnail article={entry.article} size={56} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#54687f]">
                        <span className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border border-[#22303f] text-[12px] md:text-[11px] text-[#a9bccf]">
                          {entry.citationNumber ?? '–'}
                        </span>
                        {entry.article.sourceName}
                      </p>
                      <p className="mt-1 font-gn-sans text-[13px] font-medium leading-[1.4] text-[#d5e1ee]">
                        {entry.article.title}
                      </p>
                      <p className="mt-1 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.1em] text-[#4a5c73]">
                        {/* R4 GDELT — the elapsed time is the same number either
                            way; what changes is what it is a time OF. An
                            aggregator's index time renders as "Seen 3 hr ago"
                            and never as a publication time. */}
                        {formatObservationalTime(
                          entry.article.publishedAt,
                          entry.article.publishedAtBasis,
                          language,
                        )}
                        {entry.article.sourceLanguage !== undefined ? ` · ${entry.article.sourceLanguage.toUpperCase()}` : ''}
                      </p>
                      {/* R4 — the record's OWN resolved country. `countryCode` is
                          documented COUNTRY PRECISION ONLY and is never
                          back-filled from the query, so absence is a real fact
                          and is labelled as one rather than hidden. */}
                      <p
                        data-paf="source-geography"
                        data-resolved={entry.article.countryName === undefined ? 'false' : 'true'}
                        className={`mt-[3px] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] ${
                          entry.article.countryName === undefined ? 'text-[#4a5c73]' : 'text-[#4b7f8c]'
                        }`}
                      >
                        {entry.article.countryName ?? t.sourceGeographyAbsent}
                      </p>
                    </div>
                  </div>
                  {/*
                    R4.2 — this source's relational evidence, and only this
                    source's. `assessmentsFor` looks the group up by
                    articleId, so one card can never show another's.
                  */}
                  <RelationalEvidencePanel
                    assessments={assessmentsFor(relational, entry.articleId)}
                    sourceKey={entry.articleId}
                    language={language}
                  />

                  <a
                    href={entry.article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#67e8f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
                  >
                    {dict.analysisWorkspace.sources.opensInNewTab}
                  </a>
                </article>
              </li>
            ))}
          </ul>
          {/*
            R4.2 — assessments whose articleId is not among the retrieved
            sources. Shown here rather than dropped, under their own
            heading, with the raw articleId as the only identity the
            response supplies. No publisher, title or link is invented.
          */}
          <UnmatchedRelationalEvidence groups={relational.unmatched} language={language} />
          </>
        ) : (
          /*
            ── ALPHA CLOSURE: SOURCES MUST NOT START HIDDEN ─────────────

            This branch used to be a single row of publisher chips inside
            a 78px dock. On a real analysis that read as one thin line at
            the bottom edge and an ordinary reader could miss that
            evidence existed.

            Compact now means SMALL, not hidden: a real row of source
            cards carrying publisher, title, age, language and the
            record's own resolved geography, plus an explicit VIEW ALL
            control beside the header. Everything here is response data —
            the count is `sources.length`, never a fixed number.

            The row scrolls horizontally INSIDE the dock. It cannot widen
            the page, and the centre reader is untouched.
          */
          <div
            data-paf="dock-compact-row"
            className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sources.map((entry) => (
              <article
                key={entry.articleId}
                data-paf="compact-source-card"
                data-article-id={entry.articleId}
                data-highlighted={highlightedArticleId === entry.articleId ? 'true' : undefined}
                className={`flex w-[236px] shrink-0 flex-row gap-2 rounded-[8px] border p-2 ${
                  highlightedArticleId === entry.articleId ? 'border-[#67e8f9]' : 'border-[#16202e]'
                }`}
              >
                {/*
                  ZERO ADDITIONAL VERTICAL DEMAND, and that is arithmetic
                  rather than intent. The compact dock is 168px normal and
                  128px compressed (`frameGeometry.ts`), less the 26px
                  toggle header; this card already stands at roughly 79px.
                  A 16:9 strip over 220px of content width would be 124px
                  of image and would overflow BOTH bands. Beside the text
                  the 48px thumbnail is shorter than the text column it
                  sits next to, so the card's height is unchanged and
                  `DOCK_COMPACT_*` are untouched.
                */}
                <SourceThumbnail article={entry.article} size={48} />

                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="flex items-center gap-[6px] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#54687f]">
                    <span className="inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border border-[#22303f] text-[12px] md:text-[11px] text-[#a9bccf]">
                      {entry.citationNumber ?? '\u2013'}
                    </span>
                    <span className="truncate text-[#a9bccf]">{entry.article.sourceName}</span>
                  </p>

                  <p className="mt-[3px] line-clamp-2 font-gn-sans text-[12px] md:text-[11.5px] font-medium leading-[1.35] text-[#d5e1ee]">
                    {entry.article.title}
                  </p>

                  <p className="mt-auto pt-[4px] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.1em] text-[#4a5c73]">
                    {/* Same contract as the expanded card above: an
                        aggregator's index time renders as "Seen 3 hr ago" and
                        never as a publication time. This row was written
                        against the pre-E helper and its call site was not
                        converged when the observational wrapper landed. */}
                    {formatObservationalTime(
                      entry.article.publishedAt,
                      entry.article.publishedAtBasis,
                      language,
                    )}
                    {entry.article.sourceLanguage === undefined
                      ? ''
                      : ` \u00b7 ${entry.article.sourceLanguage.toUpperCase()}`}
                    {/* The record's OWN country, never back-filled. */}
                    {entry.article.countryName === undefined
                      ? ''
                      : ` \u00b7 ${entry.article.countryName}`}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
});
