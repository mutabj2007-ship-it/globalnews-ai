import type { JSX } from 'react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { RAIL_CARD_SHELL } from '@/components/home/homePresentation';
import { StoryVisual } from '@/components/home/StoryVisual';
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
  /**
   * `rail` is the DESKTOP form, added by the completion ruling:
   *
   *   "Add a desktop equivalent. Do not simply copy the tall phone card into
   *    desktop ... If the rail becomes too tall, use a compact carousel/list
   *    treatment rather than deleting the feature. On phone, preserve the
   *    larger existing `Your world in 60 seconds` treatment because the Claude
   *    Design phone authority optimized that surface intentionally."
   *
   * So the two variants are genuinely different shapes of the same governed
   * data, not one shape scaled. `full` keeps the phone's lead photograph and
   * its rows. `rail` drops the lead image entirely and renders every item as a
   * compact row, which is what lets three cards stack in a 368px rail without
   * it becoming the "giant analyst dashboard" item 7 rules out.
   *
   * Neither variant fetches anything. Both read `items`, which is a role of
   * the single `getHomeFeed()` response the page already has.
   */
  variant?: 'full' | 'rail';
  /** Distinct per variant: both can exist in one document at different widths. */
  headingId?: string;
}

export function SixtySecondBrief({
  items,
  language = 'en',
  variant = 'full',
  headingId = 'beta-brief-heading',
}: SixtySecondBriefProps): JSX.Element | null {
  const isRail = variant === 'rail';
  const t = getDictionary(language).betaHome;
  const categoryLabels = getDictionary(language).map.categories;

  const [lead, ...rest] = items;
  /* The rail has no lead photograph, so it can afford one more headline. */
  const rows = rest.slice(0, isRail ? 3 : 2);

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
      aria-labelledby={headingId}
      className={
        isRail
          ? `overflow-hidden ${RAIL_CARD_SHELL}`
          : 'overflow-hidden rounded-2xl border border-border-strong bg-void/80'
      }
    >
      <div className={isRail ? 'px-[15px] pb-2 pt-[15px]' : 'p-4'}>
        <h2
          id={headingId}
          className={
            isRail
              ? 'text-[15px] font-bold leading-tight text-white'
              : 'text-lg font-semibold text-ink-primary'
          }
        >
          {t.briefTitle}
        </h2>
        {meta === null ? null : (
          <p className={isRail ? 'mt-[3px] text-[11.5px] text-[#8ca3bd]' : 'mt-1 text-xs text-ink-tertiary'}>
            {meta}
          </p>
        )}
      </div>

      <a
        href={lead.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none"
      >
        {/*
            The R4.1/R5.1 phone frame draws this block as headline rows. At 390
            the 2:1 lead image is ~195px of a first screen the approved design
            spends on the hero and the search field, so it folds away below
            `sm`. The lead STORY is untouched -- headline, category, source
            count and link all remain, and the image returns from `sm` up.
          */}
        {/*
            SIMPLIFICATION RULING: on desktop this card is now the PRIMARY
            right-rail intelligence surface and "must be image-led, not just a
            text list" — so the rail keeps the lead image, at a tighter 2.2:1
            crop that suits a 368px column.

            Below `sm` the phone frame draws this block as headline rows, and
            the ruling says to preserve the phone treatment, so the image
            folds away there exactly as before.
          */}
        {/*
          SIMPLIFICATION RULING: this card is the primary right-rail
          intelligence surface and "must be image-led, not just a text list" —
          with "the approved visual fallback" where the feed gives no image,
          and never an invented photograph.

          `StoryVisual` is that system, shared with the story cards: the
          category's artwork is always painted, the publisher photograph layers
          over it when there is one, and a failed image reveals the artwork
          rather than the generic placeholder. Below `sm` the phone frame draws
          this block as headline rows, so the image folds away there.
        */}
        <StoryVisual
          article={lead}
          /*
            FINAL CORRECTION: "restore the stronger large-image treatment in
            `Your world in 60 seconds`" on phone.

            An earlier pass folded this image away below `sm` to buy back first
            screen. That was the wrong trade: the approved Claude Design phone
            frame leads this block with a picture, and the Product Owner has
            now ruled the image back. It is the taller 16:9 crop on phone —
            the stronger treatment, not merely a restored one — and the tighter
            22:10 in the desktop rail, where the column is 368px.
          */
          className={isRail ? 'block aspect-[22/10]' : 'block aspect-[16/9] sm:aspect-[2/1]'}
          missingLabel={t.imageUnavailable}
          sizes="(min-width: 1024px) 368px, 100vw"
        />
        <div className={isRail ? 'px-[15px] pb-3 pt-2.5' : 'p-4'}>
          <h3
            className={
              isRail
                ? 'line-clamp-2 text-[15px] font-bold leading-[1.28] text-white'
                : 'text-base font-semibold leading-snug text-ink-primary'
            }
          >
            {lead.title}
          </h3>
          {/* The concise briefing the ruling asks for, from the governed
              summary the feed already supplies. Rail only — the phone form
              keeps its own rhythm. */}
          {isRail && lead.summary !== undefined && lead.summary !== '' ? (
            <p className="mt-[5px] line-clamp-2 text-[12px] leading-[1.42] text-[#93a9c2]">{lead.summary}</p>
          ) : null}
          <p className={isRail ? 'mt-1 text-[11px] text-[#8299b4]' : 'mt-1 text-xs text-ink-tertiary'}>
            {categoryLabels[lead.category] ?? lead.category}
            {' · '}
            {pluralWithForms(lead.sourcesCount, language, t.sourceForms)}
            {' · '}
            {lead.sourceName}
          </p>
        </div>
      </a>

      {rows.length === 0 ? null : (
        <ul className={isRail ? '' : 'border-t border-border-strong'}>
          {rows.map((item) => (
            <li
              key={item.id}
              className={
                isRail ? 'border-t border-[#0d2137]' : 'border-b border-border-strong last:border-b-0'
              }
            >
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  isRail
                    ? 'flex min-h-[44px] flex-col gap-[3px] px-[15px] py-2.5 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none'
                    : 'flex min-h-[44px] flex-col gap-1 p-4 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none'
                }
              >
                <span
                  className={
                    isRail
                      ? 'line-clamp-2 text-[13px] font-semibold leading-[1.32] text-white'
                      : 'text-sm font-semibold leading-snug text-ink-primary'
                  }
                >
                  {item.title}
                </span>
                <span className={isRail ? 'text-[11px] text-[#8299b4]' : 'text-xs text-ink-tertiary'}>
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
