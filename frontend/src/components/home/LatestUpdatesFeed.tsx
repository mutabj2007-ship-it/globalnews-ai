import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { formatUtcClock } from '@/lib/formatRelativeTime';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { SafeImage } from '@/components/ui/SafeImage';
import { CARD_INTERACTION_CLASSES } from '@/components/home/interactionStyles';

interface LatestUpdatesFeedProps {
  updates: NewsArticle[];
  dataMode: NewsDataMode | null;
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

/** 1 lead + 5 secondary — a strong preview, not the full 12-article archive. Some overlap with Latest Now's own slice of the same array is expected and accepted (per explicit product guidance): the two sections serve different UX roles and article supply is not sacrificed merely to force uniqueness. */
const DISPLAY_COUNT = 6;

/**
 * Milestone #51 (browser-acceptance editorial redesign) — root
 * problem being corrected: the previous version was a long uniform
 * vertical list where every article received identical visual weight
 * (same row height, same metadata treatment, no imagery), reading like
 * a database table rather than an edited news homepage.
 *
 * New architecture: one large LEAD update (bigger image, bigger
 * headline, full summary) followed by a 2-column grid of SECONDARY
 * updates (compact thumbnail, headline, lighter metadata, shorter
 * clamped summary). This is an editorial hierarchy, not a redesign of
 * the section's chronological SEMANTICS — `updates` is still consumed
 * in the exact chronological order Phase B's `latestUpdates` already
 * guarantees; this component only changes how that ordered list is
 * PRESENTED, taking the same array Latest Now also slices from
 * (Section 10 of the M51 investigation covers why this overlap is
 * acceptable).
 *
 * No "View all updates" CTA: there is currently no dedicated
 * full-updates destination page in this codebase — inventing one
 * would be a broken link. Per explicit product guidance, the honest
 * choice is to omit the CTA entirely until such a page exists, rather
 * than sacrifice truthful navigation for visual completeness.
 *
 * Images: reuses the exact SafeImage + placeholder-fallback pattern
 * already established in FeaturedStory.tsx/InFocusSidebar.tsx — no
 * new image-handling logic, no fabricated images. An article with no
 * `imageUrl` falls back to the same shared placeholder every other
 * homepage image component already uses.
 */
export function LatestUpdatesFeed({
  updates,
  language = 'en',
}: LatestUpdatesFeedProps): JSX.Element {
  const t = getDictionary(language).latestUpdatesFeed;
  const items = updates.slice(0, DISPLAY_COUNT);
  const [lead, ...secondary] = items;

  return (
    <section className="border-b border-border bg-surface/40" aria-labelledby="updates-heading">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-8 flex flex-col gap-2 sm:mb-10">
          <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">{t.label}</span>
          <h2 id="updates-heading" className="font-display text-2xl font-medium tracking-tight text-ink-primary sm:text-3xl">
            {t.headline}
          </h2>
        </div>

        {items.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-ink-secondary">{t.unavailable}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {lead && (
              <a
                href={lead.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${t.readFullStoryPrefix} ${lead.title}`}
                className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-surface md:flex-row ${CARD_INTERACTION_CLASSES}`}
              >
                <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden border-b border-border md:aspect-auto md:w-2/5 md:border-b-0 md:border-r">
                  <SafeImage
                    src={lead.imageUrl || '/images/article-placeholder.jpg'}
                    alt={lead.title}
                    fill
                    sizes="(min-width: 768px) 40vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-center gap-2 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">
                    <span>{formatUtcClock(lead.publishedAt)}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{lead.category}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span className="normal-case tracking-normal text-ink-secondary">{lead.sourceName}</span>
                  </div>
                  <h3 className="line-clamp-2 text-balance font-display text-xl font-medium leading-snug text-ink-primary sm:text-2xl">
                    {lead.title}
                  </h3>
                  <p className="line-clamp-2 text-sm leading-relaxed text-ink-secondary">{lead.summary}</p>
                </div>
              </a>
            )}

            {secondary.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {secondary.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${t.readFullStoryPrefix} ${item.title}`}
                    className={`flex items-start gap-3 rounded-xl border border-border bg-surface p-3 ${CARD_INTERACTION_CLASSES}`}
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border">
                      <SafeImage
                        src={item.imageUrl || '/images/article-placeholder.jpg'}
                        alt={item.title}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-ink-tertiary">
                        <span>{formatUtcClock(item.publishedAt)}</span>
                        <span aria-hidden="true">&middot;</span>
                        <span>{item.category}</span>
                      </div>
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-ink-primary">{item.title}</p>
                      <p className="line-clamp-1 text-xs leading-relaxed text-ink-tertiary">
                        {item.sourcesCount === 1 ? item.sourceName : pluralWithForms(item.sourcesCount, language, t.sourceForms)}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
