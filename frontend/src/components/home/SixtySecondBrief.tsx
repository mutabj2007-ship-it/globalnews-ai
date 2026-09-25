import type { JSX } from 'react';
import { ImageOff } from 'lucide-react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { SafeImage } from '@/components/ui/SafeImage';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * H2/H3 · "YOUR WORLD IN 60 SECONDS"
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Issue #29, H0 matrix zone Z10. The approved R4.1 Home places this panel in
 * the hero's right column, overlapping the globe — frames `1440x900_01`,
 * `430x932_01`, `390x844_01`, `360x800_01`. An image-led lead item, then two
 * follow-up rows, under a meta line that states the panel spent no AI.
 *
 * ── IT IS BUILT HERE, WITH THE HERO, ON PURPOSE ──────────────────────────
 *
 * The superseded Hero was "the sole presentation of `feed.latestUpdates`".
 * Replacing the hero without this panel would strand that data and leave Home
 * with no latest-updates surface at all — a content regression in the window
 * between increments. The approved design puts the two in one composition, so
 * they land in one commit.
 *
 * ── EVERY VALUE IS REAL, AND THE SAMPLE TREATMENT IS NOT REPRODUCED ──────
 *
 * The R4.1 frames badge each image "Illustration" and carry a credit line
 * reading *"not a news photograph · licensed publisher image required in
 * production"*. That is review-frame scaffolding, and SPEC §7 names what
 * production must use instead: headlines, source counts and times from the
 * feed, publisher names from `article.source`. So this panel renders:
 *
 *   - `title` as the headline, never an invented one;
 *   - `imageUrl` through SafeImage, or the governed "Image unavailable"
 *     treatment — never a stand-in illustration;
 *   - `sourceName` as the publisher credit;
 *   - `sourcesCount` as "N sources";
 *   - `publishedAt` through `formatObservationalTime`, which is basis-aware.
 *
 * THE TIME BASIS IS LOAD-BEARING. `publishedAtBasis` distinguishes an outlet's
 * own publication claim from GDELT's observation time, and the helper labels
 * the second as observed rather than presenting it as publication. Passing the
 * raw timestamp would quietly assert something the provider never said.
 *
 * NO METERED AI. This is static server-rendered output from the one feed the
 * page already fetched; the panel issues no request of its own, which is what
 * lets its meta line say "no AI used" truthfully.
 */

interface SixtySecondBriefProps {
  /** The one `getHomeFeed()` response's latest-updates role. No second fetch. */
  items: NewsArticle[];
  language?: LanguageCode;
}

export function SixtySecondBrief({ items, language = 'en' }: SixtySecondBriefProps): JSX.Element | null {
  const t = getDictionary(language).betaHome;
  const categoryLabels = getDictionary(language).map.categories;

  const [lead, ...rest] = items;
  const rows = rest.slice(0, 2);

  /*
    ── C7 · THE ALLOCATION, NOT THE EMPTY STATE, WAS THE DEFECT ────────────

    R1 shipped a bare `return null` here. It was the right emergency fix: the
    panel had been feeding on `latestUpdates`, which under the governed
    'exclusive' stream policy is only what REMAINS after the rail takes
    1 + 5 + 6 = 12, so a narrow provider response emptied it while the page
    below was full of reporting — and the panel then claimed a provider failure
    that had not happened. `homeFeedAllocation.ts` states the rule in terms:
    never infer provider failure from an empty stream.

    But a panel that disappears on every narrow day is not an architecture, and
    R2 says so outright. The fix belongs upstream, and that is where it now is.
    This component is fed `feed.briefUpdates`, whose rule is stated once on the
    `HomeFeed` type: the response's chronological head, minus the lead story,
    capped at three. The rail cannot starve it.

    SO REACHING THIS LINE NOW MEANS SOMETHING DEFINITE — the response carried
    one story or none, and there is genuinely nothing to summarise. The panel
    still makes no claim about why, because the one surface that legitimately
    reports a failed feed is WhatsHappeningNow, which reads the curated roles
    and the governed `dataMode`.
  */
  if (lead === undefined) return null;

  /*
    The meta line's time comes from the lead item, basis-aware. Where the feed
    gives no usable time the clause is dropped rather than filled — the
    catalogue's own "08:40" is a sample value and §6 forbids shipping a
    placeholder as current intelligence.
  */
  const leadTime = formatObservationalTime(lead.publishedAt, lead.publishedAtBasis, language);
  const meta = leadTime === '' ? null : t.briefMeta.replace('{time}', leadTime);

  return (
    <section
      aria-labelledby="beta-brief-heading"
      className="overflow-hidden rounded-2xl border border-border-strong bg-void/80"
    >
      <div className="p-4">
        <h2 id="beta-brief-heading" className="text-lg font-semibold text-ink-primary">
          {t.briefTitle}
        </h2>
        {meta === null ? null : <p className="mt-1 text-xs text-ink-tertiary">{meta}</p>}
      </div>

      <a
        href={lead.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
      >
        <div className="relative aspect-[2/1] w-full bg-surface">
          {lead.imageUrl === undefined ? (
            <span className="flex h-full w-full items-center justify-center gap-2 text-xs text-ink-tertiary">
              <ImageOff size={16} strokeWidth={1.75} aria-hidden="true" />
              {t.imageUnavailable}
            </span>
          ) : (
            <SafeImage
              src={lead.imageUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 460px, 100vw"
              className="object-cover"
            />
          )}
        </div>
        <div className="p-4">
          <h3 className="text-base font-semibold leading-snug text-ink-primary">{lead.title}</h3>
          <p className="mt-1 text-xs text-ink-tertiary">
            {categoryLabels[lead.category] ?? lead.category}
            {' · '}
            {pluralWithForms(lead.sourcesCount, language, t.sourceForms)}
            {' · '}
            {lead.sourceName}
          </p>
        </div>
      </a>

      {rows.length === 0 ? null : (
        <ul className="border-t border-border-strong">
          {rows.map((item) => (
            <li key={item.id} className="border-b border-border-strong last:border-b-0">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] flex-col gap-1 p-4 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none"
              >
                <span className="text-sm font-semibold leading-snug text-ink-primary">{item.title}</span>
                <span className="text-xs text-ink-tertiary">
                  {categoryLabels[item.category] ?? item.category}
                  {' · '}
                  {pluralWithForms(item.sourcesCount, language, t.sourceForms)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
