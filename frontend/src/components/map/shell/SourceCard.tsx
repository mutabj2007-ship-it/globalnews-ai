'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import { SafeImage } from '@/components/ui/SafeImage';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import type { RetainedItem } from '@/lib/map/selection/selectionIntelligence';
import type { DisplayPrecision } from '@/lib/map/spatial/precisionModel';

/**
 * SPATIAL M2 · DESIGN REVISION 1.2 — `SourceCard`, Part II §2 (S · M2).
 *
 * "One retained item: 44 px thumbnail (collapses to a category glyph when
 * absent), category label, two-line headline, publisher · age · item precision,
 * named open-in-new-tab affordance. In: item. Out: onSelect, onOpenSource.
 * MUST READ IDENTICALLY WITH ALL IMAGERY REMOVED."
 *
 * ── THE THUMBNAIL IS A RECOGNITION AID AND NOTHING ELSE ───────────────────
 *
 * Part I §E: "Imagery is never cropped to a face, never used as a card
 * background, and never carries meaning of its own." So it sits in its own
 * 44 px leading cell, `object-cover` inside a fixed square, and every word of
 * the card is outside it. Removing the image changes the picture and not the
 * sentence.
 *
 * When there is no image the slot COLLAPSES TO A GLYPH — Design's own wording —
 * rather than showing a placeholder photograph. The previous World Map card
 * substituted `/images/article-placeholder.jpg`, which is a picture of nothing
 * presented in the position where a picture of the story goes; the amendment
 * replaces it with a monospace category mark that is honestly not a photograph.
 *
 * ── AND THE SOURCE AFFORDANCE IS NAMED ────────────────────────────────────
 *
 * "A trailing affordance opens the source in a new tab, LABELLED AND REACHABLE
 * BY KEYBOARD, NEVER A BARE ICON WITHOUT A NAME." The glyph is decorative and
 * `aria-hidden`; the accessible name carries the publisher and the headline, so
 * a screen-reader user hears which source they are about to open rather than
 * "link, arrow".
 */

/** The monospace mark a missing thumbnail collapses to. Never a photograph. */
const CATEGORY_GLYPH: Readonly<Record<string, string>> = {
  world: 'WLD',
  politics: 'POL',
  business: 'BIZ',
  technology: 'TEC',
  science: 'SCI',
  health: 'HLT',
  sports: 'SPT',
  entertainment: 'ENT',
};

export interface SourceCardLabels {
  readonly categories: Readonly<Record<string, string>>;
  readonly levels: Readonly<Record<DisplayPrecision, string>>;
  /** "Open source in a new tab" — completed with publisher and headline. */
  readonly openSource: string;
  /** "Ask GlobalNews AI about this" — the accepted Map -> Story -> Q&A action. */
  readonly askAbout: string;
  /**
   * CHECKPOINT D — the VISIBLE name of the same action ("Ask AI").
   *
   * `askAbout` above remains the ACCESSIBLE name and is unchanged. This exists
   * because the two used to disagree: the label said "Ask GlobalNews AI about
   * this" while the surface showed a bare magnifier, and /search auto-executes
   * POST /analysis/news on arrival — so the click spent model compute behind a
   * glyph that reads as "inspect".
   */
  readonly askAiShort: string;
  /**
   * Prefix for an OBSERVED timestamp. `NewsArticle.publishedAtBasis`'s contract
   * rule: an observed time "may be rendered as 'Seen 3h ago' and must NEVER be
   * rendered as 'Published 3h ago'".
   */
  readonly seenPrefix: string;
  readonly publishedPrefix: string;
}

export interface SourceCardProps {
  readonly item: RetainedItem;
  readonly selected?: boolean;
  /**
   * r1.4: "2 px semantic edge: cyan on hover and selection, AMBER WHERE THE
   * ITEM IS AN ATTENTION OR CHANGE ITEM."
   *
   * NOTHING PRODUCES THIS YET, AND THAT IS WHY IT IS A PROP RATHER THAN A
   * DERIVATION. `RetainedItem` carries no attention or change flag, and the
   * one field that looks like a candidate — `sourcesCount` — is hard-coded to
   * 1 by all three providers (Main C-M §3.4), so deriving attention from it
   * would be inventing a signal. The branch is implemented and takes the
   * spec's amber the moment a caller has a real flag to pass; until then every
   * caller omits it and the edge is cyan, which is honest.
   */
  readonly attention?: boolean;
  readonly language?: LanguageCode;
  readonly labels: SourceCardLabels;
  readonly onSelect?: (id: string) => void;
  readonly onOpenSource?: (id: string) => void;
  readonly onAskAbout?: (id: string) => void;
}

export function SourceCard({
  item,
  selected = false,
  attention = false,
  language = 'en',
  labels,
  onSelect,
  onOpenSource,
  onAskAbout,
}: SourceCardProps): JSX.Element {
  const categoryLabel = labels.categories[item.category] ?? item.category;
  const glyph = CATEGORY_GLYPH[item.category] ?? item.category.slice(0, 3).toUpperCase();
  const age = formatRelativeTime(item.publishedAt, language);
  const timePrefix = item.timeIsObservedOnly ? labels.seenPrefix : labels.publishedPrefix;

  return (
    <div
      data-gn="source-card"
      data-gn-selected={selected ? 'true' : 'false'}
      data-gn-thumbnail={item.thumbnailUrl === undefined ? 'collapsed' : 'image'}
      /*
        ── DESIGN REVISION 1.4 · THE STORY SURFACE, TOKEN FOR TOKEN ──────────

        Until now a story wore `sp-panel-2` #0d1620 — the rail's own colour —
        so it merged with the rail and read as one more metadata row. r1.4
        gives it a petrol plane of its own, and every value below is the
        spec's, not an approximation:

          normal            #10262F   `sp-story`
          hover/focus       #163845   `sp-story-hover`
          selected          #112A34   `sp-story-selected`
          border 1 px       rgba(94,158,178,.22)
          border hover      rgba(94,158,178,.40)
          leading edge      2 px, semantic
          transition        160 ms ease, BACKGROUND AND BORDER ONLY

        SELECTED IS DARKER THAN HOVER — #112A34 under #163845 — so a selected
        card never reads as merely hovered. Selection is carried by the border,
        which is why the selected state keeps the cyan edge and the brighter
        line rather than the brighter fill.

        NO TRANSFORM, NO SHADOW, NO SCALE. The spec is explicit that cards must
        not move under the pointer in a dense list, so the transition names its
        two properties instead of using `transition-colors` and nothing here
        translates or lifts.

        THE LEADING EDGE IS THE ONLY SEMANTIC COLOUR ON THE CARD BODY: cyan on
        hover and selection, amber where the item is an attention or change
        item. Petrol carries containment precisely so cyan and amber can keep
        carrying meaning.
      */
      className={`group mb-[6px] grid grid-cols-[52px_1fr_26px] items-start gap-[9px] border border-s-2 px-[10px] py-[9px] transition-[background-color,border-color] duration-[160ms] ease-in-out ${
        selected
          ? `bg-sp-story-selected border-sp-story-line-hover ${attention ? 'border-l-sp-amber' : 'border-l-sp-cyan'}`
          : `bg-sp-story border-sp-story-line ${attention ? 'border-l-sp-amber' : 'border-l-sp-story-line'} hover:bg-sp-story-hover hover:border-sp-story-line-hover focus-within:bg-sp-story-hover focus-within:border-sp-story-line-hover ${attention ? '' : 'hover:border-l-sp-cyan focus-within:border-l-sp-cyan'}`
      }`}
    >
      {/*
        THE 44 px SLOT. Present in both states so the text column starts at the
        same x whether or not there is an image — Design's "reads identically"
        is a layout promise as well as a copy one.
      */}
      <div
        data-gn="source-thumb"
        /*
          52 px in r1.4, up from 44. The saturation lift is the WHOLE image
          treatment the spec allows — 85% at rest to 100% on hover — and it is
          on the frame so it reaches the image without touching the glyph.
        */
        className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden border border-sp-story-line saturate-[.85] transition-[filter,border-color] duration-[160ms] ease-in-out group-hover:border-sp-story-line-hover group-hover:saturate-100 group-focus-within:border-sp-story-line-hover group-focus-within:saturate-100"
        style={
          item.thumbnailUrl === undefined
            ? { background: 'repeating-linear-gradient(135deg,#16222c 0 4px,#1b2831 4px 8px)' }
            : undefined
        }
      >
        {item.thumbnailUrl === undefined ? (
          <span
            aria-hidden="true"
            className="font-gn-mono text-[8px] tracking-[0.06em] text-sp-muted"
          >
            {glyph}
          </span>
        ) : (
          <SafeImage
            src={item.thumbnailUrl}
            /*
              EMPTY ALT, DELIBERATELY. The image "never carries meaning of its
              own", and the headline it sits beside is the same text an alt
              attribute would repeat. Announcing it twice is noise, not access.
            */
            alt=""
            fill
            sizes="52px"
            className="object-cover"
          />
        )}
      </div>

      <button
        type="button"
        data-gn="source-body"
        onClick={() => onSelect?.(item.id)}
        className="min-w-0 cursor-pointer text-start outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sp-cyan"
      >
        <span
          data-gn="source-category"
          className="block font-gn-mono text-[8px] uppercase tracking-[0.14em] text-sp-cyan"
        >
          {categoryLabel}
        </span>
        {/* TWO LINES MAXIMUM — Design's own limit, enforced rather than hoped for. */}
        <span
          data-gn="source-headline"
          className="mt-[3px] line-clamp-2 block text-[12.5px] leading-[1.38] text-sp-story-headline"
        >
          {item.headline}
        </span>
        <span
          data-gn="source-meta"
          className="mt-[5px] flex flex-wrap gap-[7px] font-gn-mono text-[8.5px] uppercase tracking-[0.1em] text-sp-story-meta"
        >
          <span data-gn="source-publisher" className="text-sp-story-meta-strong">{item.publisher}</span>
          <span data-gn="source-age">
            {timePrefix} {age}
          </span>
          <span data-gn="source-precision" className="text-sp-cyan">
            {labels.levels[item.precision]}
          </span>
        </span>
      </button>

      <span className="flex flex-col items-center gap-[4px] self-center">
        {/*
          THE CANONICAL SOURCE. A real anchor, not a button that calls
          `window.open`, so the reader keeps every affordance a link has —
          middle-click, copy address, open in a background tab.
        */}
        <a
          data-gn="source-open"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onOpenSource?.(item.id)}
          aria-label={`${labels.openSource}: ${item.publisher} — ${item.headline}`}
          className="flex h-[26px] w-[26px] items-center justify-center border border-sp-story-line text-[11px] text-sp-story-meta outline-none transition-[background-color,border-color] duration-[160ms] ease-in-out group-hover:border-sp-story-line-hover hover:!border-sp-cyan/45 hover:bg-sp-cyan/[0.16] hover:text-sp-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sp-cyan"
        >
          <span aria-hidden="true">&#8599;</span>
        </a>

        {/*
          ── DECLARED DEVIATION · ONE AFFORDANCE MORE THAN THE ANATOMY ───────

          Design's card anatomy names ONE trailing affordance. This surface
          carries two, and the second is not decoration: "Ask GlobalNews AI
          about this" is accepted behaviour on this route (Milestone #51 Phase
          B, corrected by the CTO to pass `articleId` and `countryCode` so the
          backend resolves the exact article as a trusted evidence anchor).

          Dropping it to match the anatomy exactly would have removed a shipped
          capability from the desktop map while leaving it on the mobile
          fallback — the same control present or absent depending on viewport
          width. It is listed as a deviation in the handoff rather than absorbed
          silently, and it is named, keyboard-reachable and outside the source
          link exactly as the anatomy requires of the affordance it does define.
        */}
        {onAskAbout && (
          /*
            ══ CHECKPOINT D · AN AI ACTION MUST LOOK LIKE ONE ═══════════════

            THIS WAS A BARE MAGNIFIER — `&#8981;`, aria-hidden, in a box
            identical to the external-link arrow beside it. The accessible name
            was honest ("Ask GlobalNews AI about this"); the visible affordance
            was not. A magnifier conventionally means search, zoom, inspect,
            look closer — all free and all local.

            IT IS NOT FREE. `onAskAbout` pushes /search?q=…, and that route
            AUTO-EXECUTES POST /analysis/news on arrival (see
            analysisAutoRun.ts). This click IS the decision to spend model
            compute, and it was the only one the reader got.

            SO THE NAME IS NOW ON THE SURFACE. The accessible label is unchanged
            — a screen-reader user still hears the full sentence — and sighted
            readers now read the same thing the label always said.

            NOT LABELLED "PAID". The monetization contract is under review, and
            naming a price the product has not agreed would be its own untruth.

            THE CARD IS NOT REDESIGNED. Same row, same height, same border and
            hover language, same keyboard treatment. What changed is that the
            glyph became a word, and the box widened to hold it.
          */
          <button
            type="button"
            data-gn="source-ask"
            data-gn-ai-action="true"
            onClick={() => onAskAbout(item.id)}
            aria-label={`${labels.askAbout}: ${item.headline}`}
            className="flex h-[26px] items-center justify-center gap-[4px] border border-sp-story-line px-[6px] text-[10px] uppercase tracking-[0.08em] text-sp-story-meta outline-none transition-[background-color,border-color] duration-[160ms] ease-in-out group-hover:border-sp-story-line-hover hover:!border-sp-cyan/45 hover:bg-sp-cyan/[0.16] hover:text-sp-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sp-cyan"
          >
            {/*
              The indicator and the word carry the same fact. The glyph is
              aria-hidden because the button already has a full accessible
              name; announcing a decorative mark as well would be noise.
            */}
            <span aria-hidden="true" className="text-sp-cyan">&#9673;</span>
            <span>{labels.askAiShort}</span>
          </button>
        )}
      </span>
    </div>
  );
}
