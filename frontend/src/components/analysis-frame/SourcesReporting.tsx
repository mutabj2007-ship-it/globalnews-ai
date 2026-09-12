'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, SyntheticEvent } from 'react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import type { SourceSupportEntry } from '../search/analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { RelationalEvidencePanel, UnmatchedRelationalEvidence } from './RelationalEvidencePanel';
import { assessmentsFor, EMPTY_RELATIONAL_EVIDENCE } from './relationalEvidence';
import type { RelationalEvidenceModel } from './relationalEvidence';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import {
  CARD_RADIUS,
  CARD_TEXT_BLOCK,
  DESKTOP_CARD_WIDTH,
  DESKTOP_FROM,
  GAP_DESKTOP,
  GAP_MOBILE,
  MOBILE_CARD_PCT,
  NAV_CLEAR,
  NAV_INSET,
  NAV_TARGET,
  SECTION_GUTTER,
  SNAP_MS,
  TEXT_PADDING,
  advanceOffset,
  cardHeightFor,
  resolveStrip,
  sourceSectionHeight,
  stripPosition,
} from './sourcesReportingGeometry';
import type { StripLayout } from './sourcesReportingGeometry';

/* ==================================================================== *
 * SOURCES & REPORTING — DESIGN-C2 LOCK 1 (proportions) AND LOCK 2
 * (desktop navigation), over the H-ALPHA-VISUAL-1 image-led card.
 *
 * THE IMAGERY RULE IS ABSOLUTE AND IS THE REASON THIS FILE EXISTS.
 * The only image a card may ever show is the retained article's OWN
 * `imageUrl`. No stock photograph, no topical substitute, no remote
 * placeholder service, and never an image borrowed from a sibling
 * article. `search/SourceArticleCard.tsx` does substitute a shipped
 * photograph (`article.imageUrl || '/images/article-placeholder.jpg'`)
 * and is deliberately NOT reused here for exactly that reason.
 *
 * A missing or failed image keeps the FULL image footprint and shows the
 * striped panel. The row stays even; nothing collapses; the reader is
 * never told a picture exists where one does not. Lock 1 makes that a
 * measurement rather than a promise: no image element under 96px in
 * either dimension, and the footprint is the same rect a real image
 * would have occupied, so sibling card heights stay within 2px.
 *
 * WHAT LOCK 1 CHANGED, AND WHAT IT COST — REPORTED, NOT SOFTENED.
 * The text block below the image is now EXACTLY THREE LINES, which is
 * the locked composition. The old fourth element — a standalone 44px
 * "OPEN SOURCE" row — is gone: the TITLE is now the link and carries
 * the 44px target itself, with the destination stated in its accessible
 * name. R3's requirements that every card carry a way to the source and
 * that the link state it leaves the page are both still met; only the
 * element that carried them moved.
 * ==================================================================== */

/** The library and dock treatment, unchanged, so three surfaces agree. */
const STRIPES =
  'repeating-linear-gradient(135deg, rgba(148,163,184,.09) 0 6px, transparent 6px 12px)';

export function hasArticleImage(article: NewsArticle): boolean {
  return typeof article.imageUrl === 'string' && article.imageUrl.length > 0;
}

/**
 * Stateless, exported, and shared with the dock's own handler contract.
 * Hiding the failed <img> uncovers the striped wrapper beneath it, so the
 * broken case and the absent case are pixel-identical and no browser
 * broken-image glyph can appear. No per-card React state is introduced.
 */
export function hideFailedArticleImage(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = 'none';
}

/* ==================================================================== *
 * BOUNDED CURSOR-RELATIVE DEPTH — R3 CEILINGS, C2-10 SUPPRESSION
 *
 *   image shift   <= 6px      IMAGE_SHIFT_MAX
 *   image zoom    <= 1.02     IMAGE_ZOOM
 *   rotation      <= 1.5deg   IMAGE_TILT_MAX
 *   card scale    <= 1.01     see CARD_SCALE below
 *   reset         <= 120ms    RESET_MS
 *
 * "TEXT RECTS MUST NEVER MOVE" IS ABSOLUTE, AND IT DECIDES WHERE THE
 * TRANSFORMS LIVE. Every transform is applied to the IMAGE, inside a
 * fixed-size overflow-hidden frame. Nothing is applied to the card box.
 *
 * That is also why CARD_SCALE is 1. A card scale of 1.01 on a 320px card
 * moves its edges by ~1.6px, and every text rect inside it moves with
 * them — which the ceiling permits but the absolute rule forbids. Faced
 * with a permitted maximum and an absolute prohibition, the absolute
 * prohibition wins: 1 satisfies "<= 1.01".
 * ==================================================================== */
export const IMAGE_SHIFT_MAX = 6;
export const IMAGE_ZOOM = 1.02;
export const IMAGE_TILT_MAX = 1.5;
export const CARD_SCALE = 1;
export const RESET_MS = 120;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Fine pointer only. A coarse pointer never enters the motion path at
 * all — this is a capability query, not a width query, so a touchscreen
 * laptop is judged on its pointer and not on its viewport.
 */
export function supportsFinePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/** Normalised pointer position -> the bounded image transform. Pure, so it is testable. */
export function imageTransform(nx: number, ny: number): string {
  const clamp = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v);
  const x = clamp(nx);
  const y = clamp(ny);
  const dx = (x * IMAGE_SHIFT_MAX).toFixed(2);
  const dy = (y * IMAGE_SHIFT_MAX).toFixed(2);
  const ry = (x * IMAGE_TILT_MAX).toFixed(2);
  const rx = (-y * IMAGE_TILT_MAX).toFixed(2);
  return `translate3d(${dx}px, ${dy}px, 0) rotateX(${rx}deg) rotateY(${ry}deg) scale(${IMAGE_ZOOM})`;
}

export const IMAGE_REST_TRANSFORM = 'translate3d(0px, 0px, 0) rotateX(0deg) rotateY(0deg) scale(1)';

/* ==================================================================== *
 * LOCK 1 AS CSS.
 *
 * Both locked widths are expressible without measurement, which matters:
 * the first paint is already correct, and the JS below only has to solve
 * Lock 2's peek, which genuinely depends on the lane.
 *
 *   phone    --sr-card: 86vw          (Lock 1: 86% of the viewport)
 *   desktop  --sr-card: 320px         (Lock 1: see the geometry header)
 *   both     --sr-img:  card * 9/16   (Lock 1: full card width, 16:9)
 * ==================================================================== */
function bandCss(): string {
  return [
    `[data-paf="sources-reporting"]{`,
    `--sr-card:${MOBILE_CARD_PCT * 100}vw;`,
    `--sr-img:calc(var(--sr-card) * ${9 / 16});`,
    `--sr-gap:${GAP_MOBILE}px;`,
    `--sr-gutter:${SECTION_GUTTER}px}`,
    `@media (min-width:${DESKTOP_FROM}px){[data-paf="sources-reporting"]{`,
    `--sr-card:${DESKTOP_CARD_WIDTH}px;--sr-gap:${GAP_DESKTOP}px}}`,
    /* R3 / C2-10 — no transform survives reduced motion, whatever JS did. */
    `@media (prefers-reduced-motion: reduce){[data-paf="source-image"]{transform:none !important;transition:none !important}`,
    `[data-paf="sources-reporting-track"]{scroll-behavior:auto !important}}`,
    /*
      R4.2's disclosure keeps its 44px target without occupying a fourth
      text line: the BOX stays on the locked 12px support line and the
      TARGET is grown by a transparent pseudo-element, which takes part in
      hit-testing and not in layout.
    */
    `[data-paf="relational-toggle"]{position:relative}`,
    `[data-paf="relational-toggle"]::before{content:"";position:absolute;top:-14px;bottom:-14px;left:-8px;right:-8px}`,
  ].join('');
}

interface SourceCardProps {
  entry: SourceSupportEntry;
  language: LanguageCode;
  highlighted: boolean;
  relational: RelationalEvidenceModel;
}

function SourceCard({ entry, language, highlighted, relational }: SourceCardProps): JSX.Element {
  const t = getDictionary(language).analysisFrame;
  const article = entry.article;
  const imageRef = useRef<HTMLDivElement | null>(null);
  const [motion, setMotion] = useState(false);

  useEffect(() => {
    setMotion(supportsFinePointer() && !prefersReducedMotion());
  }, []);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (!motion || event.pointerType !== 'mouse') return;
      const node = imageRef.current;
      if (node === null) return;
      const box = event.currentTarget.getBoundingClientRect();
      const nx = (event.clientX - box.left) / box.width - 0.5;
      const ny = (event.clientY - box.top) / box.height - 0.5;
      node.style.transform = imageTransform(nx * 2, ny * 2);
    },
    [motion],
  );

  const reset = useCallback((): void => {
    const node = imageRef.current;
    if (node !== null) node.style.transform = '';
  }, []);

  const citedDimensions = new Set(entry.supports.map((origin) => origin.dimension)).size;

  return (
    <article
      data-paf="source-card-v2"
      data-article-id={entry.articleId}
      data-highlighted={highlighted ? 'true' : undefined}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      onPointerCancel={reset}
      style={{
        width: 'var(--sr-card)',
        transform: `scale(${CARD_SCALE})`,
        borderRadius: `${CARD_RADIUS}px`,
      }}
      className={`flex shrink-0 snap-start flex-col overflow-hidden border bg-[#070d14] transition-colors duration-[120ms] ${
        highlighted ? 'border-[#67e8f9]' : 'border-[#16202e] hover:border-[#22303f]'
      }`}
    >
      {/*
        LOCK 1 — THE IMAGE REGION IS THE FULL CARD WIDTH AT 16:9 AND IS
        NEVER GIVEN UP. Present, absent or failed, this box is
        `var(--sr-img)` tall, which is 180px at the locked desktop card
        and >=140px at every phone width the product supports. The
        stripes live on the WRAPPER, underneath, so the failure path
        costs nothing: the <img> is hidden and the panel is uncovered.
      */}
      <div
        data-paf="source-image-frame"
        /*
          `data-has-image` is the contract marker the imagery suite counts
          on: exactly one treatment per record, never both and never
          neither, assertable from rendered markup alone.

          `aria-hidden` because the picture is decorative — the card
          already names the outlet and the headline in text, and a
          provider image carries no alt text this product could truthfully
          write.
        */
        data-has-image={hasArticleImage(article) ? 'true' : 'false'}
        aria-hidden="true"
        className="relative w-full shrink-0 overflow-hidden bg-[#071016]"
        style={{ height: 'var(--sr-img)', backgroundImage: STRIPES, perspective: '600px' }}
      >
        <div
          ref={imageRef}
          data-paf="source-image"
          className="absolute inset-0 will-change-transform"
          style={{ transitionProperty: 'transform', transitionDuration: `${RESET_MS}ms` }}
        >
          {hasArticleImage(article) ? (
            /*
              A PLAIN <img>, DELIBERATELY, and the same choice the dock,
              the library and the location asset already made.
              `next/image` is legal here (next.config allows hostname
              '**'), but it would proxy every provider image through the
              Next optimizer on this product's slowest surface, for an
              unbounded host set — and `SafeImage`, the wrapper its
              callers use, defaults to substituting a shipped photograph,
              which is the one thing this file must never do.
            */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              onError={hideFailedArticleImage}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        {hasArticleImage(article) ? null : (
          <span
            data-paf="source-image-absent"
            className="absolute bottom-[8px] left-[10px] font-gn-mono text-[12px] uppercase tracking-[0.12em] text-[#4a5c73] md:text-[11px]"
          >
            {article.sourceName}
          </span>
        )}
      </div>

      {/*
        LOCK 1 — THE TEXT BLOCK. Padding 16px, exactly three lines:
        outlet + age, title, support. Text lives OUTSIDE every transformed
        element, so its rects cannot move.
      */}
      <div
        data-paf="source-card-text"
        className="flex min-w-0 flex-1 flex-col gap-[5px]"
        style={{ padding: `${TEXT_PADDING}px` }}
      >
        {/* LINE 1 — outlet and age, 12px mono. */}
        <p className="flex items-center gap-[6px] font-gn-mono text-[12px] uppercase leading-[1.4] tracking-[0.12em] text-[#54687f] md:text-[11px]">
          <span className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border border-[#22303f] text-[12px] text-[#a9bccf] md:text-[11px]">
            {entry.citationNumber ?? '–'}
          </span>
          <span className="min-w-0 truncate text-[#a9bccf]">{article.sourceName}</span>
          <span aria-hidden="true">&middot;</span>
          <span className="shrink-0">
            {formatObservationalTime(article.publishedAt, article.publishedAtBasis, language)}
          </span>
          {typeof article.sourceLanguage === 'string' && article.sourceLanguage.length > 0 ? (
            <>
              <span aria-hidden="true">&middot;</span>
              <span data-paf="source-language" className="shrink-0">
                {article.sourceLanguage.toUpperCase()}
              </span>
            </>
          ) : null}
        </p>

        {/*
          LINE 2 — THE TITLE, AND THE WAY TO THE SOURCE.

          Lock 1 allows three lines below the image and the old standalone
          "OPEN SOURCE" row was a fourth. Making the title itself the link
          keeps every requirement the row carried: the target is the
          44px-tall title block rather than a 17px run of text, the
          accessible name states both the headline and that the link
          leaves the page, and `data-paf="source-open"` still marks the
          card's route to its source.
        */}
        <a
          data-paf="source-open"
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[44px] items-start font-gn-sans text-[15px] font-semibold leading-[1.35] text-[#e2ebf5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
        >
          <span data-paf="source-headline" className="line-clamp-2 min-w-0">
            {article.title}
          </span>
          <span className="sr-only">
            {' '}
            &mdash; {t.openSource} &middot; {t.opensNewTab}
          </span>
        </a>

        {/*
          LINE 3 — THE SUPPORT LINE, 12px mono, green when this source is
          actually cited. A source cited by nothing is never hidden and is
          never coloured as though it were support.

          R4.2's disclosure rides on this line rather than adding a fourth.
          Its box is 12px; its TARGET is 44px, grown by the pseudo-element
          declared in `bandCss` so no glyph moves.
        */}
        <p
          data-paf="source-support"
          className={`flex flex-wrap items-center gap-x-[8px] font-gn-mono text-[12px] uppercase leading-[1.4] tracking-[0.1em] md:text-[11px] ${
            entry.supportState === 'cited' ? 'text-gn-verified-soft' : 'text-[#4a5c73]'
          }`}
        >
          <span>
            {entry.supportState === 'cited'
              ? t.sourceSupportCited.replace('{n}', String(citedDimensions))
              : t.sourceSupportNotCited}
          </span>
          {/*
            R4.2 SURVIVES THE REDESIGN, ON THE READING PATH.

            This source's relational evidence, and only this source's,
            from the SAME `assessmentsFor` lookup and the SAME panel the
            dock used. R4.2's invariants are that an assessment no claim
            cites stays visible and that every counted item is rendered —
            both are about the reader reaching it, so moving it one
            destination away into the Complete Record would have satisfied
            the letter and broken the point. It is the same component, not
            a copy.
          */}
          <RelationalEvidencePanel
            assessments={assessmentsFor(relational, entry.articleId)}
            sourceKey={entry.articleId}
            language={language}
          />
        </p>
      </div>
    </article>
  );
}

/* ==================================================================== *
 * LOCK 2 — DESKTOP SOURCE NAVIGATION.
 *
 * The advance is animated here rather than by `scroll-behavior:smooth`
 * because Lock 2 prohibits a snap over 240ms and the UA's smooth-scroll
 * duration is not specified, not settable and in Chromium exceeds it.
 * An explicit rAF ramp is the only way the ceiling becomes a fact.
 * ==================================================================== */
function animateScrollTo(el: HTMLElement, target: number, instant: boolean): void {
  if (instant || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    el.scrollLeft = target;
    return;
  }
  const from = el.scrollLeft;
  const delta = target - from;
  if (delta === 0) return;
  const started = performance.now();
  const step = (now: number): void => {
    const p = Math.min(1, (now - started) / SNAP_MS);
    /* easeOutCubic — settles, never overshoots, so it cannot rest mid-card. */
    el.scrollLeft = from + delta * (1 - Math.pow(1 - p, 3));
    if (p < 1) window.requestAnimationFrame(step);
    else el.scrollLeft = target;
  };
  window.requestAnimationFrame(step);
}

export interface SourcesReportingProps {
  sources: readonly SourceSupportEntry[];
  highlightedArticleId?: string | null;
  /** R4.2 — relational evidence grouped by articleId, carried through unchanged. */
  relational?: RelationalEvidenceModel;
  language?: LanguageCode;
  /**
   * R3: where there is not enough vertical room, collapse to a labelled
   * control and count rather than shrinking cards. The frame decides;
   * this component obeys and still states the count.
   */
  collapsed?: boolean;
  onExpand?: () => void;
  /** Test seam and SSR hint. The live layout is measured. */
  initialViewportWidth?: number;
}

export function SourcesReporting({
  sources,
  highlightedArticleId = null,
  relational = EMPTY_RELATIONAL_EVIDENCE,
  language = 'en',
  collapsed = false,
  onExpand,
  initialViewportWidth = DESKTOP_FROM,
}: SourcesReportingProps): JSX.Element {
  const t = getDictionary(language).analysisFrame;

  const trackRef = useRef<HTMLDivElement | null>(null);
  const laneRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<StripLayout>(() =>
    resolveStrip(
      initialViewportWidth >= DESKTOP_FROM ? initialViewportWidth : initialViewportWidth - SECTION_GUTTER,
      initialViewportWidth,
      sources.length,
    ),
  );
  const [offset, setOffset] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [viewport, setViewport] = useState(initialViewportWidth);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  /* Measure the lane, not the viewport: the strip's own width is what
     decides how many whole cards plus a bounded peek fit inside it. */
  useEffect(() => {
    const lane = laneRef.current;
    if (lane === null || typeof ResizeObserver === 'undefined') return;
    const measure = (): void => {
      const vw = typeof window === 'undefined' ? initialViewportWidth : window.innerWidth;
      setViewport(vw);
      setLayout(resolveStrip(Math.round(lane.getBoundingClientRect().width), vw, sources.length));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(lane);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [initialViewportWidth, sources.length]);

  const position = stripPosition(offset, layout.stride, layout.visible, sources.length);

  const advance = useCallback(
    (direction: -1 | 1): void => {
      const el = trackRef.current;
      if (el === null) return;
      const target = advanceOffset(el.scrollLeft, layout.stride, direction, sources.length, layout.visible);
      animateScrollTo(el, target, reduced);
      setOffset(target);
    },
    [layout.stride, layout.visible, reduced, sources.length],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>): void => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        advance(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        advance(-1);
      }
    },
    [advance],
  );

  const header = (
    <div className="flex min-h-[26px] flex-wrap items-center gap-x-2 gap-y-1 px-4 py-[2px] font-gn-mono text-[12px] uppercase tracking-[0.16em] text-[#a9bccf] md:px-5 md:text-[11px]">
      <span data-paf="sources-reporting-label">
        {t.sourcesReporting} &middot; {sources.length}
      </span>
      {/*
        LOCK 2 — CONTROLS AND READOUT, VISIBLE AT REST.

        Desktop only, because Lock 2 is the DESKTOP navigation model and a
        phone reaches the remainder by swiping. The gate is the MEASURED
        viewport rather than a media query alone, so the readout is not
        merely invisible on a phone but absent from the phone's DOM —
        R1 RULING 1 forbids an "n OF m" basis anywhere on that surface and
        a hidden element is still anywhere. Never hidden until hover:
        C2-5 makes visibility at load the probe, and a control revealed by
        hover is not a discovery affordance.

        Boundary states are DISABLED, not removed — a control that
        disappears at the end makes the strip's extent unknowable.
      */}
      {viewport >= DESKTOP_FROM && sources.length > layout.visible ? (
        <span
          data-paf="sources-nav"
          className="ml-auto hidden items-center md:flex"
          style={{ gap: `${NAV_CLEAR}px`, marginRight: `${NAV_INSET}px` }}
        >
          <span data-paf="sources-position" className="tabular-nums tracking-[0.12em] text-[#54687f]">
            {t.sourcesPosition
              .replace('{a}', String(position.first))
              .replace('{b}', String(position.last))
              .replace('{n}', String(position.total))}
          </span>
          <button
            type="button"
            data-paf="sources-prev"
            aria-label={t.sourcesPrev}
            disabled={position.atStart}
            onClick={() => advance(-1)}
            style={{ width: `${NAV_TARGET}px`, height: `${NAV_TARGET}px` }}
            className="inline-flex items-center justify-center rounded-[6px] border border-[#22303f] text-[#a9bccf] disabled:border-[#141d29] disabled:text-[#3d4d61] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
          >
            <span aria-hidden="true">&#8592;</span>
          </button>
          <button
            type="button"
            data-paf="sources-next"
            aria-label={t.sourcesNext}
            disabled={position.atEnd}
            onClick={() => advance(1)}
            style={{ width: `${NAV_TARGET}px`, height: `${NAV_TARGET}px` }}
            className="inline-flex items-center justify-center rounded-[6px] border border-[#22303f] text-[#a9bccf] disabled:border-[#141d29] disabled:text-[#3d4d61] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
          >
            <span aria-hidden="true">&#8594;</span>
          </button>
        </span>
      ) : null}
    </div>
  );

  if (sources.length === 0) {
    return (
      <section data-paf="sources-reporting" aria-label={t.sourcesReporting} className="min-w-0">
        <style>{bandCss()}</style>
        <p className="px-4 py-3 font-gn-mono text-[12px] uppercase tracking-[0.12em] text-[#4a5c73] md:px-5 md:text-[11px]">
          {t.noReportsRetrieved}
        </p>
      </section>
    );
  }

  if (collapsed) {
    return (
      <section data-paf="sources-reporting" aria-label={t.sourcesReporting} className="min-w-0">
        <style>{bandCss()}</style>
        {/*
          COLLAPSED IS A LABELLED CONTROL AND A COUNT, never a shrunken
          card and never silence. The reader is told how much reporting
          there is and given a way to it.
        */}
        <button
          type="button"
          data-paf="sources-reporting-collapsed"
          onClick={onExpand}
          className="flex min-h-[44px] w-full items-center gap-2 px-4 text-left font-gn-mono text-[12px] uppercase tracking-[0.16em] text-[#a9bccf] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gn-focus md:px-5 md:text-[11px]"
        >
          <span aria-hidden="true">&#9656;</span>
          {t.sourcesReporting} &middot; {sources.length}
          <span className="ml-auto rounded-[4px] border border-[#22303f] px-2 py-[2px] text-[12px] tracking-[0.14em] text-[#67e8f9] md:text-[11px]">
            {t.sourcesShowAll}
          </span>
        </button>
      </section>
    );
  }

  return (
    <section data-paf="sources-reporting" aria-label={t.sourcesReporting} className="min-w-0">
      <style>{bandCss()}</style>
      {header}
      {/*
        ONE horizontal track. The lane is measured; the track's own width
        is PINNED to `visible * (card + gap) + peek`, which is what makes
        Lock 2's peek an exact 12-48px rather than whatever the lane
        happened to leave over — measured at 112px before the pin.
        `min-w-0` on the frame's cell plus this track's overflow keep the
        page from widening.
      */}
      <div ref={laneRef} className="min-w-0">
        <div
          ref={trackRef}
          data-paf="sources-reporting-track"
          role="group"
          tabIndex={0}
          aria-label={t.sourcesRegion}
          onKeyDown={onKeyDown}
          onScroll={(event) => setOffset(event.currentTarget.scrollLeft)}
          style={{
            gap: 'var(--sr-gap)',
            paddingLeft: 'var(--sr-gutter)',
            /*
              MEASURED DEFECT, AND WHY THE PIN ALONE WAS NOT ENOUGH.

              With `snap-mandatory` the snapport defaults to the container's
              PADDING BOX, so the browser immediately scrolled the strip by
              the 16px gutter to align card 1's `snap-start` with the padding
              edge. The left inset was therefore 0 in practice and the peek
              measured 64px against Lock 2's 48px ceiling at every desktop
              band. `scroll-padding-left` moves the snapport to the CONTENT
              edge, which is what "settles with a card edge aligned to the
              strip's left inset" actually requires.
            */
            scrollPaddingLeft: 'var(--sr-gutter)',
            maxWidth: layout.viewportWidth > 0 ? `calc(var(--sr-gutter) + ${layout.viewportWidth}px)` : undefined,
            scrollBehavior: 'auto',
          }}
          /*
            MANDATORY ON PHONE, PROXIMITY ON DESKTOP, AND THAT IS MEASURED
            RATHER THAN preferred. A swipe wants mandatory: it guarantees the
            strip never rests mid-card however hard the flick. But mandatory
            also re-snaps every programmatic scrollLeft the ramp writes, so
            the desktop advance completed in 53ms — the snap engine finished
            the move as soon as the ramp crossed the midpoint. Proximity lets
            the 240ms ramp run to its own end, and the quantised target is
            already a card edge, so nothing is lost by not forcing one.
          */
          className={`flex snap-x overflow-x-auto overflow-y-hidden pb-3 pt-1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gn-focus [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            viewport >= DESKTOP_FROM ? 'snap-proximity' : 'snap-mandatory'
          }`}
        >
          {sources.map((entry) => (
            <SourceCard
              key={entry.articleId}
              entry={entry}
              language={language}
              highlighted={highlightedArticleId === entry.articleId}
              relational={relational}
            />
          ))}
          {/*
            A TRAILING SPACER, NOT `pr-*`, AND ITS WIDTH IS LOAD-BEARING.

            Right padding on a horizontal scroller sits INSIDE the visible
            box, so the sliver of the next card measured 68px against a 28px
            intent — Lock 2's peek window is 12-48px and that missed it.

            The width is `peek + gap` because of a second measured defect:
            at the LAST position the browser clamps scrollLeft to
            `scrollWidth - clientWidth`, which was 636 against the quantised
            668. C2-6 asks the strip to settle on a card edge at EVERY
            position, including the last one, and it can only do that if the
            content extends far enough past the final card to let the scroll
            reach that offset. `peek + gap` is exactly that distance — the
            empty peek slot the last card would otherwise have shown.
          */}
          <span
            aria-hidden="true"
            className="shrink-0"
            style={{ width: layout.peek > 0 ? `${layout.peek + layout.gap}px` : 'var(--sr-gap)' }}
          />
        </div>
      </div>

      {/*
        R4.2 — assessments whose articleId is not among the retrieved
        sources. Shown rather than dropped, under their own heading, with
        the raw articleId as the only identity the response supplies.
      */}
      <div className="px-4 pb-3 md:px-5">
        <UnmatchedRelationalEvidence groups={relational.unmatched} language={language} />
      </div>
    </section>
  );
}

/** Re-exported so callers keep one import for the section's geometry. */
export { CARD_TEXT_BLOCK, cardHeightFor, sourceSectionHeight };
