import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { SafeImage } from '@/components/ui/SafeImage';
import { DataModeLabel } from '@/components/ui/DataModeLabel';
import { CARD_INTERACTION_CLASSES } from '@/components/home/interactionStyles';

interface GlobalDevelopmentsProps {
  lead: NewsArticle | null;
  secondary: NewsArticle[];
  dataMode: NewsDataMode | null;
  language?: LanguageCode;
}

const SECONDARY_COUNT = 4;

/**
 * Master Frontend Recomposition, Checkpoint 2 — replaces the M51
 * patchwork (separate NewsroomSection + CategoryCards sections
 * reading as unrelated stacked blocks) with ONE coherent editorial
 * surface: a large lead story plus exactly 4 secondary stories in a
 * vertical stack alongside it, per the approved reference layout.
 *
 * Data: `lead` is Phase B's `featured`, `secondary` is Phase B's
 * `inFocus` truncated to 4 — this is the SAME semantic allocation
 * (allocateHomeFeed.ts, untouched by this checkpoint), only the
 * PRESENTATION changed. `discovery` is intentionally not consumed
 * here — no second allocation truth was introduced to accommodate
 * this redesign.
 *
 * "Global developments" / "What is happening right now" — never
 * "Trending"/"Most read"/"Popular", matching the explicit product
 * principle carried over from M51.
 */
export function GlobalDevelopments({
  lead,
  secondary,
  dataMode,
  language = 'en',
}: GlobalDevelopmentsProps): JSX.Element {
  const t = getDictionary(language).globalDevelopments;
  const secondaryItems = secondary.slice(0, SECONDARY_COUNT);

  return (
    <section className="border-b border-border bg-void" aria-labelledby="global-developments-heading">
      <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-cyan-400">{t.eyebrow}</span>
            <h2
              id="global-developments-heading"
              className="mt-1 font-display text-2xl font-medium tracking-tight text-ink-primary sm:text-3xl"
            >
              {t.headline}
            </h2>
          </div>
          {dataMode && <DataModeLabel dataMode={dataMode} language={language} />}
        </div>

        {!lead ? (
          <div className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-xl border border-amber-500/25 bg-void/60 px-4 py-2.5 backdrop-blur-sm">
              <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-amber-400">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {t.unavailableLabel}
              </span>
              <p className="mt-1 text-xs text-ink-secondary">{t.unavailable}</p>
            </div>

            {/* Compact horizontal status-tile rail — matches the reference's "TRENDING AROUND THE WORLD" density even when live articles are unavailable. Every tile is a real system-state description, never a fabricated headline. */}
            <div className="flex gap-3 overflow-x-auto pb-1">
              {[
                { label: t.statusFeedUnavailable, ok: false },
                { label: t.statusCountryAvailable, ok: true },
                { label: t.statusSearchAvailable, ok: true },
                { label: t.statusMapAvailable, ok: true },
                { label: t.statusWaitingProvider, ok: false },
              ].map((tile) => (
                <div
                  key={tile.label}
                  className="flex w-[160px] shrink-0 flex-col gap-1.5 rounded-lg border border-border bg-surface p-3"
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${tile.ok ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  />
                  <p className="font-mono text-[10px] uppercase leading-snug tracking-wide text-ink-tertiary">
                    {tile.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
            <a
              href={lead.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${t.readFullStoryPrefix} ${lead.title}`}
              className={`group flex flex-col overflow-hidden rounded-2xl border border-cyan-500/15 bg-surface ${CARD_INTERACTION_CLASSES}`}
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border">
                <SafeImage
                  src={lead.imageUrl || '/images/article-placeholder.jpg'}
                  alt={lead.title}
                  fill
                  priority
                  sizes="(min-width: 1024px) 56vw, 100vw"
                  className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-105 motion-reduce:transition-none"
                />
                <span className="absolute left-4 top-4 rounded-full border border-cyan-500/30 bg-void/80 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-widest text-cyan-300 backdrop-blur-sm">
                  {lead.category}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <h3 className="mb-2 line-clamp-2 text-balance font-display text-xl font-medium leading-snug text-ink-primary transition-colors group-hover:text-cyan-300 sm:text-2xl">
                  {lead.title}
                </h3>
                <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-ink-secondary">{lead.summary}</p>
                <div className="mt-4 flex items-center gap-2 font-mono text-xs text-ink-tertiary">
                  <span>{lead.sourceName}</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{formatRelativeTime(lead.publishedAt, language)}</span>
                  {lead.sourcesCount > 1 && (
                    <>
                      <span aria-hidden="true">&middot;</span>
                      <span>{pluralWithForms(lead.sourcesCount, language, t.sourceForms)}</span>
                    </>
                  )}
                </div>
              </div>
            </a>

            {secondaryItems.length > 0 && (
              <ul className="flex flex-col divide-y divide-border rounded-2xl border border-cyan-500/15 bg-surface">
                {secondaryItems.map((item) => (
                  <li key={item.id} className="p-4 first:pt-4 last:pb-4">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${t.readFullStoryPrefix} ${item.title}`}
                      className="group -m-2 flex items-start gap-3 rounded-lg p-2 transition-colors duration-200 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 motion-reduce:transition-none"
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
                        <SafeImage
                          src={item.imageUrl || '/images/article-placeholder.jpg'}
                          alt={item.title}
                          fill
                          sizes="64px"
                          className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-105 motion-reduce:transition-none"
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">
                          {item.category}
                        </span>
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-ink-primary transition-colors group-hover:text-cyan-300">
                          {item.title}
                        </p>
                        <span className="font-mono text-[11px] text-ink-tertiary">
                          {item.sourceName} &middot; {formatRelativeTime(item.publishedAt, language)}
                        </span>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
