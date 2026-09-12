/**
 * Master Frontend Recomposition, Checkpoint 1 — the ONE canonical
 * intelligence-module configuration. Both the desktop radial
 * experience and the mobile grid render from this SAME array; no
 * second, independent module list exists anywhere in the codebase.
 *
 * Origin note: `frontend/src/app/workspace/page.tsx` (an older,
 * unlinked internal prototype — not part of the public product,
 * confirmed via NavBar audit to have zero inbound navigation links)
 * contained a `capabilityModules` array with genuinely useful,
 * already-honest status semantics (`Foundation ready` / `In
 * development` / `Planned`). Per CTO decision, that thinking is
 * reused here — mapped onto the approved product vocabulary
 * (`active` / `preview` / `comingSoon`) — but this file is now the
 * SOLE source of truth going forward; workspace/page.tsx's own array
 * is not imported from or kept in sync with this one.
 *
 * CTO's explicit active/preview/comingSoon assignments for the nine
 * MVP modules take precedence over workspace's own status labels —
 * Country Intelligence and Evidence & Source Comparison were already
 * 'Foundation ready' in workspace and remain active here; AI Research
 * Assistant and World Intelligence were 'In development' in
 * workspace, but the CTO's spec explicitly lists both as MVP-active
 * (real, working foundations: Search/Q&A for the former, the
 * homepage feed/allocation pipeline for the latter) — a deliberate,
 * CTO-directed promotion, not an unreviewed upgrade.
 *
 * Every `destination` is a real, existing route, or specifically
 * `undefined` — never a fabricated/placeholder link.
 */

export type IntelligenceModuleState = 'active' | 'preview' | 'comingSoon';

export type IntelligenceModuleAccent =
  | 'amber'
  | 'emerald'
  | 'blue'
  | 'violet'
  | 'cyan'
  | 'red'
  | 'purple'
  | 'magenta'
  | 'orange'
  | 'lime';

export interface IntelligenceModuleConfig {
  id: string;
  /** Key into dictionary().intelligenceModules.modules[key] */
  dictionaryKey: string;
  /**
   * M65.1 — the two-letter identifier the approved Claude Design
   * Intelligence Engine shows on every capability panel. Deliberately
   * part of the canonical configuration rather than a lookup table in a
   * component, so a module can never render with someone else's mark,
   * and so uniqueness is testable at the source.
   *
   * NOT localized: these are short product identifiers, in the same
   * class as the module `id` itself, not user-facing prose. The visible
   * title and description remain fully dictionary-driven.
   */
  code: string;
  accent: IntelligenceModuleAccent;
  /** lucide-react icon name, resolved by the renderer — kept as a string here so this config has zero UI-library import surface. */
  icon: 'Search' | 'Globe2' | 'MapPinned' | 'ScanSearch' | 'LineChart' | 'ShieldAlert' | 'TrendingUp' | 'History' | 'Radar';
  state: IntelligenceModuleState;
  /** A real, existing route, or undefined — never a fabricated/placeholder link. */
  destination?: string;
}

export const INTELLIGENCE_MODULES: IntelligenceModuleConfig[] = [
  {
    id: 'ai-research',
    dictionaryKey: 'aiResearch',
    code: 'AI',
    accent: 'amber',
    icon: 'Search',
    state: 'active',
    destination: '/search',
  },
  {
    id: 'world-intelligence',
    dictionaryKey: 'worldIntelligence',
    code: 'WD',
    accent: 'emerald',
    icon: 'Globe2',
    state: 'active',
    /*
      M66 — ACTIVE NOW MEANS ACTIONABLE, AND THIS DESTINATION IS REAL.

      CTO decision D-6 A previously left this module ACTIVE but inert, on the
      reasoning that the capability IS the homepage feed rather than a page and
      that no honest destination therefore existed. The first half of that is
      still true; the second half was not. The section this card describes has
      carried a real anchor all along:

        GlobalDevelopments.tsx  ->  id="global-developments-heading"

      and in-page hash navigation is already a released pattern in this product,
      not one invented here: MobileBottomNav ships href '#intelligence-modules'
      against IntelligenceEngineSection's own id.

      So the card now goes to the thing it names — its own description reads
      'Global developments organized by relevance, recency, and source
      diversity'. No /world route was created and no page was invented; the
      rooted form is used rather than a bare '#' so the link stays correct if
      the Engine is ever rendered on a non-home surface.
    */
    destination: '/#global-developments-heading',
  },
  {
    id: 'country-intelligence',
    dictionaryKey: 'countryIntelligence',
    code: 'CO',
    accent: 'blue',
    icon: 'MapPinned',
    state: 'active',
    destination: '/map',
  },
  {
    id: 'evidence',
    dictionaryKey: 'evidence',
    code: 'EV',
    accent: 'violet',
    icon: 'ScanSearch',
    state: 'active',
    destination: '/search',
  },
  {
    id: 'economy',
    dictionaryKey: 'economy',
    code: 'EC',
    // M65.1 — realigned to the approved reference, which shows this
    // panel in the same green family as World Intelligence.
    accent: 'emerald',
    icon: 'LineChart',
    state: 'preview',
  },
  {
    id: 'conflict',
    dictionaryKey: 'conflict',
    code: 'CF',
    accent: 'red',
    icon: 'ShieldAlert',
    state: 'preview',
  },
  {
    id: 'market',
    dictionaryKey: 'market',
    code: 'MK',
    accent: 'cyan',
    icon: 'TrendingUp',
    state: 'comingSoon',
  },
  {
    id: 'timeline',
    dictionaryKey: 'timeline',
    code: 'TL',
    // M65.1 — realigned to the approved reference (purple, not fuchsia).
    accent: 'purple',
    icon: 'History',
    state: 'comingSoon',
  },
  {
    id: 'forecast',
    dictionaryKey: 'forecast',
    code: 'FC',
    // M65.1 — realigned to the approved reference (amber, not lime).
    accent: 'amber',
    icon: 'Radar',
    state: 'comingSoon',
  },
];

/** A module is genuinely navigable only when both its state is 'active' AND it has a real destination — this is the single check every renderer (desktop radial, mobile grid) must use, so a preview/comingSoon module can never accidentally become clickable. */
export function isModuleNavigable(module: IntelligenceModuleConfig): boolean {
  return module.state === 'active' && Boolean(module.destination);
}
