import type { JSX } from 'react';
import { ImageOff, Info } from 'lucide-react';
import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { SafeImage } from '@/components/ui/SafeImage';
import { DataModeLabel } from '@/components/ui/DataModeLabel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * H3 · "WHAT'S HAPPENING NOW" — THE READER-FACING EDITORIAL AREA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Issue #29 increment H3, H0 zones Z11 and Z13–Z15. The approved R4.1 Home
 * composition, from frames `1440x900_03` and `390x844_03`: a section heading
 * with an "Updated" stamp, the free-to-browse disclosure, one image-led lead
 * story, then a four-up grid of secondary stories.
 *
 * ── IT REPLACES TWO SURFACES, AND ABSORBS A THIRD'S DUTY ─────────────────
 *
 * `GlobalDevelopments` presented the same feed in the superseded M66
 * composition, and `LiveStatusStrip` carried Home's only degraded-data signal
 * in a band above the hero that appears in no approved frame. Both are retired
 * here — together, so the signal is never absent: when the feed returns
 * nothing this section says so in the reader's language, which is what §6
 * means by rendering a missing source as a truthful gap.
 *
 * ── CATEGORY CHIPS ARE DELIBERATELY ABSENT — N7 IS OPEN ──────────────────
 *
 * The approved frame draws chips (All, Energy, Economy, Security,
 * Humanitarian, Politics, Science) and SPEC §4.B defines them as a pure
 * client-side filter that spends nothing. They are still not built, and the
 * reason is specific rather than cautious: `NAVIGATION.md` records N7 as
 * "OPEN DECISION (taxonomy)", and those chip labels are *domain* categories
 * that this product's governed vocabulary does not contain — it carries
 * world, politics, business, technology, science, health, sports,
 * entertainment. Rendering the drawn chips would require inventing the
 * mapping between the two, which is exactly the taxonomy decision N7 reserves.
 * The `noAiNote` beneath the heading is kept, because its promise — that
 * browsing costs nothing — is true of this section as built.
 *
 * ── DATA TRUTH ──────────────────────────────────────────────────────────
 *
 * Every field is the feed's own: `title`, `summary`, `imageUrl` through
 * SafeImage or the governed "Image unavailable" treatment, `sourceName` as the
 * publisher credit, `sourcesCount`, and `publishedAt` through
 * `formatObservationalTime` so an observed timestamp is never presented as a
 * publication claim. No illustrative headline, no sample image, no invented
 * count, and no raw internal id reaches the reader.
 *
 * Stories link out to their publisher, which is current behaviour and stays
 * that way: `/story/:id` is N6, still OPEN.
 */

interface WhatsHappeningNowProps {
  /** The one `getHomeFeed()` response, by role. No second fetch. */
  lead: NewsArticle | null;
  secondary: NewsArticle[];
  discovery: NewsArticle[];
  /**
   * The provenance of what is being shown — live, cached, mock or unknown.
   *
   * It moves here with the rest of the retired strip's duty. §6 requires a
   * truthful availability state, and "these stories are cached" is exactly
   * that: without it the reader cannot tell fresh reporting from a stale copy.
   * Rendered through the governed `DataModeLabel` rather than a second
   * vocabulary invented here.
   */
  dataMode: NewsDataMode | null;
  language?: LanguageCode;
}

export function WhatsHappeningNow({
  lead,
  secondary,
  discovery,
  dataMode,
  language = 'en',
}: WhatsHappeningNowProps): JSX.Element {
  const t = getDictionary(language).betaHome;
  const categoryLabels = getDictionary(language).map.categories;

  /* The approved grid is four cards; secondary first, topped up from discovery. */
  const grid = [...secondary, ...discovery].slice(0, 4);

  /*
    The stamp describes the FRESHEST thing actually returned, not render time.
    Using `new Date()` here would state a freshness the feed never claimed.
  */
  const newest = lead ?? grid[0];
  const stampTime =
    newest === undefined
      ? ''
      : formatObservationalTime(newest.publishedAt, newest.publishedAtBasis, language);
  const stamp = stampTime === '' ? null : t.updatedStamp.replace('{time}', stampTime);

  return (
    <section aria-labelledby="beta-now-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="beta-now-heading" className="font-display text-2xl font-semibold text-ink-primary sm:text-3xl">
          {t.nowHeading}
        </h2>
        <span className="flex items-center gap-3">
          <DataModeLabel dataMode={dataMode} language={language} />
          {stamp === null ? null : <span className="text-sm text-ink-tertiary">{stamp}</span>}
        </span>
      </div>

      <p className="flex items-start gap-2 text-sm text-ink-tertiary">
        <Info size={15} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>{t.noAiNote}</span>
      </p>

      {lead === null && grid.length === 0 ? (
        /*
          THE DEGRADED STATE, inherited from the retired status strip. A gap is
          stated, never disguised — §6.
        */
        <p role="status" className="rounded-2xl border border-border-strong bg-void/60 p-6 text-sm text-ink-tertiary">
          {t.feedUnavailable}
        </p>
      ) : (
        <>
          {lead === null ? null : <LeadStory article={lead} language={language} />}

          {grid.length === 0 ? null : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {grid.map((article) => (
                <li key={article.id} className="h-full">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full flex-col overflow-hidden rounded-2xl border border-border-strong bg-void/60 transition-colors hover:border-cyan-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none"
                  >
                    <StoryImage article={article} language={language} className="aspect-[16/9]" />
                    <span className="flex flex-1 flex-col gap-1 p-3">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                        {categoryLabels[article.category] ?? article.category}
                      </span>
                      <span className="text-sm font-semibold leading-snug text-ink-primary">
                        {article.title}
                      </span>
                      <span className="mt-auto pt-1 text-xs text-ink-tertiary">
                        {article.sourceName}
                        {' · '}
                        {pluralWithForms(article.sourcesCount, language, t.sourceForms)}
                        <Elapsed article={article} language={language} />
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function LeadStory({ article, language }: { article: NewsArticle; language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).betaHome;
  const categoryLabels = getDictionary(language).map.categories;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border-strong bg-void/60 transition-colors hover:border-cyan-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none sm:grid-cols-2"
    >
      <StoryImage article={article} language={language} className="aspect-[16/10] sm:h-full" />
      <div className="flex flex-col gap-2 p-5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
          {categoryLabels[article.category] ?? article.category}
        </span>
        <h3 className="font-display text-xl font-semibold leading-snug text-ink-primary sm:text-2xl">
          {article.title}
        </h3>
        {/* The publisher's own summary. Never an AI-written one — none is generated here. */}
        <p className="line-clamp-3 text-sm leading-relaxed text-ink-tertiary">{article.summary}</p>
        <p className="mt-auto pt-2 text-xs text-ink-tertiary">
          {article.sourceName}
          {' · '}
          {pluralWithForms(article.sourcesCount, language, t.sourceForms)}
          <Elapsed article={article} language={language} />
        </p>
      </div>
    </a>
  );
}

/**
 * The image, or the governed absence treatment. SPEC §6 records that licensed
 * editorial photography was not available to the design review, so a card
 * without a feed image states that plainly rather than borrowing an
 * illustration — which §6 of the Home contract forbids on the live path.
 */
function StoryImage({
  article,
  language,
  className,
}: {
  article: NewsArticle;
  language: LanguageCode;
  className: string;
}): JSX.Element {
  const t = getDictionary(language).betaHome;

  if (article.imageUrl === undefined) {
    return (
      <span className={`flex w-full items-center justify-center gap-2 bg-surface text-xs text-ink-tertiary ${className}`}>
        <ImageOff size={16} strokeWidth={1.75} aria-hidden="true" />
        {t.imageUnavailable}
      </span>
    );
  }

  return (
    <span className={`relative block w-full bg-surface ${className}`}>
      <SafeImage src={article.imageUrl} alt="" fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
    </span>
  );
}

/** Basis-aware elapsed time, or nothing at all where the feed gives none. */
function Elapsed({ article, language }: { article: NewsArticle; language: LanguageCode }): JSX.Element | null {
  const elapsed = formatObservationalTime(article.publishedAt, article.publishedAtBasis, language);
  if (elapsed === '') return null;
  return <>{' · '}{elapsed}</>;
}
