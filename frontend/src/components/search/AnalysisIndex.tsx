'use client';

import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import type { AccentToken, DimensionModel, PrimaryDimensionKey } from './analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';

/**
 * H2B — E-07 AnalysisIndex (desktop) and E-19 DimensionNavigator (mobile).
 *
 * ONE tablist implementation, two presentations. The design specifies two
 * elements, but forking them would mean two keyboard models, two roving
 * tabindex implementations and two places for an accessibility regression
 * to live. The variant prop changes chrome and axis; the semantics,
 * focus model and activation rules are shared.
 *
 * Only one variant is ever in the accessibility tree: the inactive one is
 * `display:none` (Tailwind `hidden`), which removes it entirely rather than
 * merely hiding it visually. That is also why the two variants use
 * different DOM ids — a `display:none` duplicate would otherwise collide.
 *
 * ACTIVATION IS MANUAL, not automatic. E-07 specifies "Up/Down move,
 * Home/End jump, Enter/Space activate", so arrow keys move focus only and
 * the panel changes on explicit activation. That matters here: a dimension
 * change resets the viewport scroll and moves focus, which would be hostile
 * if it fired on every arrow keypress.
 */

export type AnalysisIndexVariant = 'desktop' | 'mobile';

/* ------------------------------------------------------------------ *
 * Pure keyboard model — exported so it can be unit-tested in the
 * repository's existing node harness, with no jsdom.
 * ------------------------------------------------------------------ */

/**
 * Resolves which row an arrow/Home/End keypress should move FOCUS to.
 * Returns null for any key this tablist does not handle, so the event
 * keeps bubbling and Tab still leaves the tablist normally.
 *
 * No wrap-around: the design's mobile navigator rubber-bands at the ends
 * rather than cycling, and the desktop index matches it so the two axes
 * behave identically.
 */
export function resolveArrowTarget(
  key: string,
  currentIndex: number,
  total: number,
  variant: AnalysisIndexVariant,
): number | null {
  if (total <= 0) return null;

  const forward = variant === 'desktop' ? 'ArrowDown' : 'ArrowRight';
  const backward = variant === 'desktop' ? 'ArrowUp' : 'ArrowLeft';

  if (key === forward) return Math.min(currentIndex + 1, total - 1);
  if (key === backward) return Math.max(currentIndex - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return total - 1;
  return null;
}

/** Enter and Space activate the focused row. Nothing else does. */
export function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ' || key === 'Spacebar';
}

/**
 * Roving tabindex: exactly one row is in the tab order at a time.
 * Focus follows the focused row when the user is arrowing; otherwise it
 * rests on the active row, so tabbing into the index lands on the
 * dimension currently on screen.
 */
export function rovingTabIndex(rowIndex: number, focusedIndex: number): 0 | -1 {
  return rowIndex === focusedIndex ? 0 : -1;
}

/* ------------------------------------------------------------------ *
 * Accent classes — static strings only.
 * Tailwind cannot see a class name assembled at runtime, so every
 * accent variant is written out in full and selected by lookup.
 * ------------------------------------------------------------------ */

interface AccentClassSet {
  readonly rail: string;
  readonly activeSurface: string;
  readonly activeCount: string;
  readonly chipBorder: string;
  readonly chipSurface: string;
  readonly chipLabel: string;
}

const ACCENT_CLASSES: Readonly<Record<AccentToken, AccentClassSet>> = {
  'gn-verified': {
    rail: 'bg-gn-verified',
    activeSurface: 'bg-gn-verified-tint',
    activeCount: 'text-gn-verified',
    chipBorder: 'border-gn-verified',
    chipSurface: 'bg-gn-verified-tint',
    chipLabel: 'text-gn-verified',
  },
  'gn-ai': {
    rail: 'bg-gn-ai',
    activeSurface: 'bg-gn-ai-tint',
    activeCount: 'text-gn-ai',
    chipBorder: 'border-gn-ai',
    chipSurface: 'bg-gn-ai-tint',
    chipLabel: 'text-gn-ai',
  },
  'gn-geo': {
    rail: 'bg-gn-geo',
    activeSurface: 'bg-gn-geo-tint',
    activeCount: 'text-gn-geo',
    chipBorder: 'border-gn-geo',
    chipSurface: 'bg-gn-geo-tint',
    chipLabel: 'text-gn-geo',
  },
  'gn-significance': {
    rail: 'bg-gn-significance',
    activeSurface: 'bg-gn-significance-tint',
    activeCount: 'text-gn-significance',
    chipBorder: 'border-gn-significance',
    chipSurface: 'bg-gn-significance-tint',
    chipLabel: 'text-gn-significance',
  },
  'gn-uncertain': {
    rail: 'bg-gn-uncertain',
    activeSurface: 'bg-gn-uncertain-tint',
    activeCount: 'text-gn-uncertain',
    chipBorder: 'border-gn-uncertain',
    chipSurface: 'bg-gn-uncertain-tint',
    chipLabel: 'text-gn-uncertain',
  },
  'gn-provenance': {
    rail: 'bg-gn-provenance',
    activeSurface: 'bg-gn-provenance-tint',
    activeCount: 'text-gn-provenance',
    chipBorder: 'border-gn-provenance',
    chipSurface: 'bg-gn-provenance-tint',
    chipLabel: 'text-gn-provenance',
  },
};

/* ------------------------------------------------------------------ *
 * Labels
 * ------------------------------------------------------------------ */

const LABEL_KEYS: Readonly<Record<PrimaryDimensionKey, keyof DimensionLabels>> = {
  brief: 'brief',
  significance: 'significance',
  'why-this-matters': 'whyThisMatters',
  'who-is-affected': 'whoIsAffected',
  'immediate-effects': 'immediateEffects',
  'key-facts': 'keyFacts',
  'insufficient-evidence': 'insufficientEvidence',
};

type DimensionLabels = ReturnType<typeof getDictionary>['analysisWorkspace']['dimensions'];

export function dimensionLabel(key: PrimaryDimensionKey, labels: DimensionLabels): string {
  return labels[LABEL_KEYS[key]];
}

/**
 * The accessible name carries the count, so a screen-reader user learns
 * how much is in a dimension without opening it — including that it is
 * empty. E-07: 'Counts are inside the accessible name: "Key facts, 4 items".'
 */
export function dimensionAccessibleName(
  dimension: DimensionModel,
  labels: DimensionLabels,
  language: LanguageCode,
  itemForms: [string, string, string],
): string {
  const label = dimensionLabel(dimension.key, labels);
  if (dimension.count === null) return label;
  return `${label}, ${pluralWithForms(dimension.count, language, itemForms)}`;
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export interface AnalysisIndexProps {
  dimensions: readonly DimensionModel[];
  activeDimension: PrimaryDimensionKey;
  onSelect: (key: PrimaryDimensionKey) => void;
  variant: AnalysisIndexVariant;
  panelId: string;
  language?: LanguageCode;
  /** Index of the row that currently owns the tab stop. */
  focusedIndex: number;
  onFocusedIndexChange: (index: number) => void;
  /**
   * PAF-R1.2 (P2) — OPT-IN, and every default below is today's exact class
   * string, so `/search` renders byte-identically without it.
   *
   * The released desktop row is a FIXED `w-[212px]`. Inside the frame's
   * narrower index track that fixed width overflows its container, and CSS
   * resolves the cross axis of `overflow-y-auto` to `auto` — which is the
   * horizontal scrollbar, not label length (the label is already truncated).
   *
   * `fluid` makes the row fill its track and lets a long label wrap instead
   * of truncating, so the bar cannot appear at ANY width. The dedicated
   * count column is untouched and gains a shared left edge, so a row of
   * badges reads as a column rather than as ragged chips.
   */
  fluid?: boolean;
  /**
   * H-ALPHA-1B — OPT-IN, DEFAULT FALSE, AND THE DEFAULT BRANCH OF EVERY
   * TERNARY BELOW IS TODAY'S EXACT CLASS STRING. `/search`'s released
   * `AnalysisWorkspace` does not pass it and renders byte-identically.
   *
   * The Surface-B floors are 12px phone / 11px desktop. The index labels
   * are sized by the GLOBAL `gn-hud-*` tokens — `gn-hud-index` 10.5px,
   * `gn-hud-section` / `gn-hud-meta` / `gn-hud-chip` 9px — which are also
   * consumed by Today, Watch, the homepage HUD and the map. Raising the
   * tokens would move all of those surfaces, so the floor is applied HERE,
   * to this component's own class strings, behind a flag only the frame
   * sets.
   *
   * Each replacement restates the token's line-height and letter-spacing
   * explicitly, so the ONLY property that changes is the font size.
   */
  typeFloor?: boolean;
  /**
   * H-C2 / DESIGN-C2 — OPT-IN 44px TOUCH TARGETS ON THE MOBILE CHIP ROW.
   *
   * MEASURED: the chips are `h-8` — 32px — inside a 44px row, so the row
   * looked compliant and every target in it was 12px short. The chip row is
   * SHARED with the released pre-R4 `/search` workspace, which carries its
   * own pinned tests, so the correction is a flag only the frame sets and the
   * released default is unchanged. Same pattern as `typeFloor`.
   */
  touchTargets?: boolean;
}

export function AnalysisIndex({
  dimensions,
  activeDimension,
  onSelect,
  variant,
  panelId,
  language = 'en',
  focusedIndex,
  onFocusedIndexChange,
  fluid = false,
  typeFloor = false,
  touchTargets = false,
}: AnalysisIndexProps): JSX.Element {
  const t = getDictionary(language).analysisWorkspace;
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const shouldRestoreFocus = useRef(false);

  useEffect(() => {
    if (!shouldRestoreFocus.current) return;
    shouldRestoreFocus.current = false;
    rowRefs.current[focusedIndex]?.focus();
  }, [focusedIndex]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const target = resolveArrowTarget(event.key, index, dimensions.length, variant);
    if (target !== null) {
      event.preventDefault();
      shouldRestoreFocus.current = true;
      onFocusedIndexChange(target);
      return;
    }
    if (isActivationKey(event.key)) {
      event.preventDefault();
      const dimension = dimensions[index];
      if (dimension !== undefined) onSelect(dimension.key);
    }
  }

  const isDesktop = variant === 'desktop';

  return (
    <div
      className={
        isDesktop
          ? [
              'hidden md:flex md:flex-col md:gap-[3px] md:border-r md:border-gn-line-structural md:pb-8 md:pt-5',
              fluid ? 'md:w-full md:px-3' : 'md:pl-6 md:pr-[14px]',
            ].join(' ')
          : 'flex md:hidden'
      }
    >
      {isDesktop && (
        <span
          className={[
            'mb-3 font-gn-mono uppercase text-gn-hud-faint',
            typeFloor
              ? 'text-[12px] leading-[1.2] tracking-[0.18em] md:text-[11px]'
              : 'text-gn-hud-section',
          ].join(' ')}
        >
          {t.indexLabel}
        </span>
      )}

      <div
        role="tablist"
        aria-orientation={isDesktop ? 'vertical' : 'horizontal'}
        aria-label={isDesktop ? t.indexLabel : t.navigatorLabel}
        className={
          isDesktop
            ? 'flex flex-col gap-[3px]'
            : [
                'flex w-full gap-[6px] overflow-x-auto px-4 py-[6px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                touchTargets ? 'scroll-pl-4' : '',
              ].join(' ').trim()
        }
        style={isDesktop ? undefined : { scrollSnapType: 'x proximity' }}
      >
        {dimensions.map((dimension, index) => {
          const isActive = dimension.key === activeDimension;
          const accent = ACCENT_CLASSES[dimension.accent];
          const label = dimensionLabel(dimension.key, t.dimensions);
          const accessibleName = dimensionAccessibleName(
            dimension,
            t.dimensions,
            language,
            t.itemForms,
          );

          const shared = {
            id: `gn-tab-${variant}-${dimension.key}`,
            role: 'tab' as const,
            type: 'button' as const,
            'aria-selected': isActive,
            'aria-controls': panelId,
            'aria-label': accessibleName,
            tabIndex: rovingTabIndex(index, focusedIndex),
            onClick: () => {
              onFocusedIndexChange(index);
              onSelect(dimension.key);
            },
            onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => handleKeyDown(event, index),
            ref: (node: HTMLButtonElement | null) => {
              rowRefs.current[index] = node;
            },
          };

          if (isDesktop) {
            return (
              <button
                {...shared}
                key={dimension.key}
                className={[
                  fluid
                    ? 'flex min-h-[33px] w-full items-center gap-[10px] rounded-gn-control px-[10px] py-[4px] text-left transition-colors duration-[120ms]'
                    : 'flex h-[33px] w-[212px] items-center gap-[10px] rounded-gn-control px-[10px] text-left transition-colors duration-[120ms]',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus',
                  isActive ? accent.activeSurface : 'bg-transparent hover:bg-white/[.03]',
                ].join(' ')}
              >
                {/* Shape cue: the rail carries the active state without colour. */}
                <span
                  aria-hidden="true"
                  className={[
                    'h-4 w-[3px] shrink-0 rounded-[2px]',
                    isActive ? accent.rail : 'bg-gn-line-inert',
                  ].join(' ')}
                />
                <span
                  className={[
                    fluid
                      ? 'min-w-0 flex-1 whitespace-normal break-words font-gn-mono uppercase leading-[1.25]'
                      : 'flex-1 truncate font-gn-mono uppercase',
                    typeFloor
                      ? 'text-[12px] tracking-[0.09em] md:text-[11px]'
                      : 'text-gn-hud-index',
                    isActive
                      ? 'font-medium text-gn-ink-active'
                      : dimension.isEmpty
                        ? 'text-gn-hud-faint'
                        : 'text-gn-ink-tertiary',
                  ].join(' ')}
                >
                  {label}
                </span>
                <span
                  aria-hidden="true"
                  className={[
                    'shrink-0 rounded-[4px] px-[6px] py-[1px] font-gn-mono',
                    typeFloor
                      ? 'text-[12px] leading-[1.3] tracking-[0.10em] md:text-[11px]'
                      : 'text-gn-hud-meta',
                    fluid ? 'min-w-[26px] text-right' : '',
                    isActive ? `bg-white/[.07] ${accent.activeCount}` : 'text-gn-hud-faint',
                  ].join(' ')}
                >
                  {dimension.countable ? dimension.count : t.uncountable}
                </span>
              </button>
            );
          }

          return (
            <button
              {...shared}
              key={dimension.key}
              style={{ scrollSnapAlign: 'start' }}
              className={[
                touchTargets
                  ? 'flex min-h-[44px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-gn-pill border px-[11px]'
                  : 'flex h-8 shrink-0 items-center gap-[6px] whitespace-nowrap rounded-gn-pill border px-[11px]',
                'font-gn-mono uppercase transition-colors duration-[120ms]',
                typeFloor
                  ? 'text-[12px] leading-[1.2] tracking-[0.08em] md:text-[11px]'
                  : 'text-gn-hud-chip',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus',
                isActive
                  ? `${accent.chipBorder} ${accent.chipSurface} ${accent.chipLabel} font-medium`
                  : 'border-gn-line-inert bg-gn-elevated text-gn-ink-tertiary',
              ].join(' ')}
            >
              {/* Shape cue on mobile too: a filled dot, not colour alone. */}
              <span
                aria-hidden="true"
                className={[
                  'h-[5px] w-[5px] shrink-0 rounded-[1px]',
                  isActive ? accent.rail : 'bg-gn-line-inert',
                ].join(' ')}
              />
              <span>{label}</span>
              {dimension.countable && dimension.count !== null && dimension.count > 0 && (
                <span aria-hidden="true" className="text-gn-hud-faint">
                  {dimension.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
