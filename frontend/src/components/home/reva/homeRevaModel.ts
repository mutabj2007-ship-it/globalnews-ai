import { INTELLIGENCE_MODULES, isModuleNavigable } from '@/lib/intelligenceModules';

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

/** VISUAL_SPEC — the 60 s module sits in the right rail only when the content column is at least this wide. */
export const RIGHT_RAIL_MIN_CONTENT_PX = 1180;
/** REV_A_DELTA row 6 / TABLET_SPEC — Explore shows 7 columns when content ≥1000 px, else 4 + 3. */
export const EXPLORE_SEVEN_MIN_CONTENT_PX = 1000;

/** W60_MEDIA_SPEC — lead image heights. */
export const W60_LEAD_HEIGHT = { d1920: 176, d1440: 150, tablet: 190, p430: 156, p390: 140, p360: 120 } as const;
/** W60_MEDIA_SPEC — secondary rows: 4 desktop, 2 phone. Five stories in all on desktop. */
export const W60_ROWS = { desktop: 4, phone: 2 } as const;

export type ExploreDomainKey = 'world' | 'politics' | 'economy' | 'energy' | 'security' | 'humanitarian' | 'markets';

/**
 * CARD_ARROW_RULE — the domain accents, verbatim. World's registry entry
 * (`world-intelligence`) has no destination, so World resolves to the live
 * country map (`country-intelligence` → /map), which is what its line says:
 * "Live map of reporting by country."
 */
export const EXPLORE_DOMAINS: readonly { key: ExploreDomainKey; moduleId: string; accent: string }[] = [
  { key: 'world', moduleId: 'country-intelligence', accent: '#5abff5' },
  { key: 'politics', moduleId: 'politics', accent: '#9fc3ff' },
  { key: 'economy', moduleId: 'economy', accent: '#7fd4c1' },
  { key: 'energy', moduleId: 'energy', accent: '#f0c36a' },
  { key: 'security', moduleId: 'security', accent: '#f39a8f' },
  { key: 'humanitarian', moduleId: 'humanitarian', accent: '#c7a6f2' },
  { key: 'markets', moduleId: 'market', accent: '#8fd0f5' },
];

export interface ResolvedDomain {
  key: ExploreDomainKey;
  accent: string;
  href: string | null;
  /** Truthful: a domain is "Preview" while only a *-visual-preview route exists for it. */
  preview: boolean;
}

export function resolveDomain(entry: (typeof EXPLORE_DOMAINS)[number]): ResolvedDomain {
  const entryModule = INTELLIGENCE_MODULES.find((m) => m.id === entry.moduleId);
  const href = entryModule !== undefined && isModuleNavigable(entryModule) && entryModule.destination !== undefined ? entryModule.destination : null;
  return { key: entry.key, accent: entry.accent, href, preview: href !== null && /-visual-preview$/.test(href) };
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
