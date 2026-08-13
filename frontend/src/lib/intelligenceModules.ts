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
    accent: 'amber',
    icon: 'Search',
    state: 'active',
    destination: '/search',
  },
  {
    id: 'world-intelligence',
    dictionaryKey: 'worldIntelligence',
    accent: 'emerald',
    icon: 'Globe2',
    state: 'active',
    // No separate destination: this capability IS the homepage feed
    // itself (Global Developments below), not a distinct page.
  },
  {
    id: 'country-intelligence',
    dictionaryKey: 'countryIntelligence',
    accent: 'blue',
    icon: 'MapPinned',
    state: 'active',
    destination: '/map',
  },
  {
    id: 'evidence',
    dictionaryKey: 'evidence',
    accent: 'violet',
    icon: 'ScanSearch',
    state: 'active',
    destination: '/search',
  },
  {
    id: 'economy',
    dictionaryKey: 'economy',
    accent: 'orange',
    icon: 'LineChart',
    state: 'preview',
  },
  {
    id: 'conflict',
    dictionaryKey: 'conflict',
    accent: 'red',
    icon: 'ShieldAlert',
    state: 'preview',
  },
  {
    id: 'market',
    dictionaryKey: 'market',
    accent: 'cyan',
    icon: 'TrendingUp',
    state: 'comingSoon',
  },
  {
    id: 'timeline',
    dictionaryKey: 'timeline',
    accent: 'magenta',
    icon: 'History',
    state: 'comingSoon',
  },
  {
    id: 'forecast',
    dictionaryKey: 'forecast',
    accent: 'lime',
    icon: 'Radar',
    state: 'comingSoon',
  },
];

/** A module is genuinely navigable only when both its state is 'active' AND it has a real destination — this is the single check every renderer (desktop radial, mobile grid) must use, so a preview/comingSoon module can never accidentally become clickable. */
export function isModuleNavigable(module: IntelligenceModuleConfig): boolean {
  return module.state === 'active' && Boolean(module.destination);
}
