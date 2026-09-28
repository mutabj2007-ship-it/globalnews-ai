import { INTELLIGENCE_MODULES, isModuleNavigable } from '@/lib/intelligenceModules';
import {
  CATEGORY_ARTWORK,
  CATEGORY_TEXT,
  CHIP_STYLE,
  TOPIC_FALLBACK,
  TOPIC_STYLE,
  type TopicStyle,
} from '@/components/home/homePresentation';

/**
 * HOME WELCOME & DISCOVERY R1 REV A — THE PURE MODEL.
 *
 * Authority: r6/HOME-WELCOME-DISCOVERY-R1-REV-A (LEFT_RAIL_SPEC, CARD_ARROW_RULE,
 * W60_MEDIA_SPEC, TABLET_SPEC, VISUAL_SPEC). Every destination is resolved from
 * the ONE registry (`INTELLIGENCE_MODULES`), never a second hand-kept list, so a
 * domain can only link where the registry says a real route exists.
 */

/** LEFT_RAIL_SPEC — 248 expanded (≥1280), 64 collapsed (1024–1279 always; ≥1280 by toggle). */
export const HOME_RAIL = { expandedPx: 248, collapsedPx: 64 } as const;

/**
 * VISUAL_SPEC — the 60 s module sits in the right rail only when the content
 * column is at least this wide. The spec says 1180, which assumes a page with
 * no scrollbar: a real 15–17 px desktop scrollbar leaves 1175 px at 1440, so the
 * implemented threshold is 1140 (DENSITY / 60-SECONDS CORRECTION R2).
 */
export const RIGHT_RAIL_MIN_CONTENT_PX = 1140;
/** REV_A_DELTA row 6 / TABLET_SPEC — Explore shows 7 columns when content ≥1000 px, else 4 + 3. */
export const EXPLORE_SEVEN_MIN_CONTENT_PX = 1000;

/** W60_MEDIA_SPEC — lead image heights. */
export const W60_LEAD_HEIGHT = { d1920: 176, d1440: 150, tablet: 190, p430: 156, p390: 140, p360: 120 } as const;
/** W60_MEDIA_SPEC — secondary rows: 4 desktop, 2 phone. Five stories in all on desktop. */
export const W60_ROWS = { desktop: 4, phone: 2 } as const;

export type ExploreDomainKey = 'world' | 'politics' | 'economy' | 'energy' | 'security' | 'humanitarian' | 'markets';

/**
 * The seven Explore domains. World's registry entry (`world-intelligence`) has
 * no destination, so World resolves to the live country map
 * (`country-intelligence` → /map), which is what its line says: "Live map of
 * reporting by country."
 *
 * `topicStyle` names the domain's EXISTING Home colour family in
 * `TOPIC_STYLE` (homePresentation.ts) — the governed surfaces the current
 * Home's topic cards already use. Politics has no TOPIC_STYLE entry (it was
 * not on the current Home), so it is composed from the existing Home POLITICS
 * category tokens instead (see `POLITICS_TOPIC_STYLE`). No new palette.
 */
export const EXPLORE_DOMAINS: readonly { key: ExploreDomainKey; moduleId: string; topicStyle: string }[] = [
  { key: 'world', moduleId: 'country-intelligence', topicStyle: 'world-intelligence' },
  { key: 'politics', moduleId: 'politics', topicStyle: 'politics' },
  { key: 'economy', moduleId: 'economy', topicStyle: 'economy' },
  { key: 'energy', moduleId: 'energy', topicStyle: 'energy' },
  { key: 'security', moduleId: 'security', topicStyle: 'security' },
  { key: 'humanitarian', moduleId: 'humanitarian', topicStyle: 'humanitarian' },
  { key: 'markets', moduleId: 'market', topicStyle: 'market' },
];

/**
 * HOME REV A COLOR RECONCILIATION — Politics, from EXISTING Home Politics tokens
 * only (homePresentation.ts): the category ARTWORK gradient (maroon,
 * #4a1b2d → #331726 → #141522), the category TEXT accent (#de979f) for the
 * glyph, the category CHIP (#2d1728 fill, #3d131d edge, #de979f text) for the
 * arrow, and the shared TOPIC_FALLBACK hover. The registry's module accent
 * ('violet') is deliberately NOT used: violet is the governed tier boundary.
 */
export const POLITICS_TOPIC_STYLE: TopicStyle = {
  surface: `bg-gradient-to-br ${CATEGORY_ARTWORK.politics}`,
  icon: CATEGORY_TEXT.politics,
  arrow: `border ${CHIP_STYLE.politics.className}`,
  hover: TOPIC_FALLBACK.hover,
};

export function domainStyle(topicStyle: string): TopicStyle {
  if (topicStyle === 'politics') return POLITICS_TOPIC_STYLE;
  return TOPIC_STYLE[topicStyle] ?? TOPIC_FALLBACK;
}

export interface ResolvedDomain {
  key: ExploreDomainKey;
  topicStyle: string;
  style: TopicStyle;
  href: string | null;
  /** Truthful: a domain is "Preview" while only a *-visual-preview route exists for it. */
  preview: boolean;
}

export function resolveDomain(entry: (typeof EXPLORE_DOMAINS)[number]): ResolvedDomain {
  const entryModule = INTELLIGENCE_MODULES.find((m) => m.id === entry.moduleId);
  const href = entryModule !== undefined && isModuleNavigable(entryModule) && entryModule.destination !== undefined ? entryModule.destination : null;
  return { key: entry.key, topicStyle: entry.topicStyle, style: domainStyle(entry.topicStyle), href, preview: href !== null && /-visual-preview$/.test(href) };
}

export const RESOLVED_DOMAINS: readonly ResolvedDomain[] = EXPLORE_DOMAINS.map(resolveDomain);

/** LEFT_RAIL_SPEC SPECIALISTS — Elections is a preview route; Imihigo is live. */
export const SPECIALIST_LINKS = {
  elections: { href: '/election-visual-preview', preview: true },
  imihigo: { href: '/imihigo', preview: false },
} as const;

/**
 * LEFT_RAIL_SPEC DEEP INTELLIGENCE — the Analysis Workspace landing. `/search`
 * with NO query never auto-runs; only `/search?q=` does, and Home never links it.
 */
export const ANALYSIS_WORKSPACE_HREF = '/search';

/** The Hero composer's anchor, which the header Ask launcher (D2) watches and returns to. */
export const HERO_COMPOSER_ID = 'home-hero-composer';
/** Suggested investigations stage their question into the Hero composer through this event (0 AI). */
export const STAGE_QUESTION_EVENT = 'globalnews:home-stage-question';
/** The header language switch, which the rail's "Language & region" row hands off to. */
export const HEADER_LANGUAGE_ID = 'home-header-language';

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
