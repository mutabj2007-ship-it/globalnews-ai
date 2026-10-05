/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMPACT VISUAL PRODUCT R1 — THE `/visual` CLICK CONTRACT (machine-checkable)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * AUDIT DATA, NOT A ROUTE SOURCE — the same discipline as components/home/homeClickContract.ts.
 * Every row carries `evidence`: a file and a literal it must contain (or must NOT contain), so the
 * matrix fails the moment the code it describes changes.
 *
 * SUPERSESSION. These rows implement the Product Owner story-card contract (Design R1 doc 03,
 * H0 ruling 4), which SUPERSEDES WP2 / Claude H T-14 ("image, headline and 'Read source' open
 * the publisher") for this surface. The current Home (`/`) is deliberately unchanged during
 * integration, so its rows `now.card`, `rail.brief.story` and `acct.foryou.card` in
 * homeClickContract.ts still describe `/` truthfully. They are re-authored — with a supersession
 * reference to this file, history kept — in the same change that promotes `/visual` to `/`.
 *
 * THE RULE: only an explicit "Read Original ↗" leaves GlobalNewsAI for a publisher or source.
 */
export type VisualAiCost = 'none' | 'zero-compute-read' | 'explicit-send' | 'explicit-generation';

export interface VisualClickRow {
  readonly id: string;
  readonly element: string;
  readonly activation: string;
  readonly leavesGlobalNewsAI: boolean;
  readonly aiCost: VisualAiCost;
  readonly supersedes: string | null;
  readonly evidence: { readonly file: string; readonly contains?: string; readonly lacks?: string };
}

const FEED = 'components/visual/VisualStoryFeed.tsx';
const BRIEF = 'components/visual/VisualBriefPanel.tsx';
const MAP = 'components/visual/VisualHeroMap.tsx';
const HERO = 'components/visual/VisualHero.tsx';
const WP2 = 'WP2 / Claude H T-14 (homeClickContract now.card) — superseded on /visual by H0 ruling 4';

export const VISUAL_CLICK_CONTRACT: readonly VisualClickRow[] = [
  {
    id: 'card.image', element: 'decorative image', activation: 'nothing (aria-hidden, pointer-events none, no anchor)',
    leavesGlobalNewsAI: false, aiCost: 'none', supersedes: WP2,
    evidence: { file: FEED, contains: 'data-visual-card-image="" className="pointer-events-none select-none"' },
  },
  {
    id: 'card.background', element: 'article', activation: 'nothing (no stretched link, no handler)',
    leavesGlobalNewsAI: false, aiCost: 'none', supersedes: WP2,
    /* The structural assertion (no handler on <article>, one anchor per card) lives in the spec. */
    evidence: { file: FEED, contains: 'data-visual-card=""' },
  },
  {
    id: 'card.title', element: 'h3', activation: 'nothing (plain heading; labels the card)',
    leavesGlobalNewsAI: false, aiCost: 'none', supersedes: WP2,
    evidence: { file: FEED, contains: '<h3 id={titleId} dir="auto"' },
  },
  {
    id: 'card.publisher', element: 'bdi', activation: 'nothing (attribution text)',
    leavesGlobalNewsAI: false, aiCost: 'none', supersedes: WP2,
    evidence: { file: FEED, contains: '<bdi data-visual-card-publisher=""' },
  },
  {
    id: 'card.read-brief', element: 'button', activation: 'opens the internal Story Brief; GET only (zero compute); a signed-in reader with generation available may get ONE explicit run when no Brief exists',
    leavesGlobalNewsAI: false, aiCost: 'zero-compute-read', supersedes: null,
    evidence: { file: FEED, contains: "openVisualBrief(briefStoryOf(story), 'top')" },
  },
  {
    id: 'card.discuss', element: 'button', activation: 'opens the SAME Story Brief at Discussion; never generates (discussion.read only)',
    leavesGlobalNewsAI: false, aiCost: 'zero-compute-read', supersedes: null,
    evidence: { file: FEED, contains: "openVisualBrief(briefStoryOf(story), 'discussion')" },
  },
  {
    id: 'card.save', element: 'StoryBookmark', activation: 'toggles the shared saved-stories store',
    leavesGlobalNewsAI: false, aiCost: 'none', supersedes: null,
    evidence: { file: FEED, contains: '<StoryBookmark url={article.url}' },
  },
  {
    id: 'card.read-original', element: 'a', activation: 'publisher article in a new tab — THE ONLY EXIT',
    leavesGlobalNewsAI: true, aiCost: 'none', supersedes: null,
    evidence: { file: FEED, contains: 'data-visual-action="read-original"' },
  },
  {
    id: 'brief.evidence-row', element: 'button', activation: 'internal evidence preview (inside the panel)',
    leavesGlobalNewsAI: false, aiCost: 'none', supersedes: null,
    evidence: { file: BRIEF, contains: 'data-visual-evidence-row=""' },
  },
  {
    id: 'brief.evidence-read-original', element: 'a', activation: 'publisher / source in a new tab — explicit exit',
    leavesGlobalNewsAI: true, aiCost: 'none', supersedes: null,
    evidence: { file: BRIEF, contains: 'data-visual-evidence-read-original=""' },
  },
  {
    id: 'brief.back-to-brief', element: 'button', activation: 'returns to the Brief at the saved scroll position (Escape too)',
    leavesGlobalNewsAI: false, aiCost: 'none', supersedes: null,
    evidence: { file: BRIEF, contains: 'data-visual-evidence-back=""' },
  },
  {
    id: 'brief.open-discussion', element: 'button', activation: 'the existing Stage B Discussion panel',
    leavesGlobalNewsAI: false, aiCost: 'none', supersedes: null,
    evidence: { file: BRIEF, contains: 'onClick={() => openDiscussion(target)}' },
  },
  {
    id: 'brief.ask-follow-up', element: 'button', activation: 'stages the story as Ask context and opens the dock; does NOT submit',
    leavesGlobalNewsAI: false, aiCost: 'none', supersedes: null,
    evidence: { file: BRIEF, contains: 'openGlobalAsk();' },
  },
  {
    id: 'hero.ask', element: 'form', activation: 'ONE Ask turn on the shared Ask (the reader’s explicit Send)',
    leavesGlobalNewsAI: false, aiCost: 'explicit-send', supersedes: null,
    evidence: { file: HERO, contains: 'submitGlobalAsk(draft)' },
  },
  {
    id: 'hero.example', element: 'button', activation: 'fills the box; does not submit',
    leavesGlobalNewsAI: false, aiCost: 'none', supersedes: null,
    evidence: { file: HERO, contains: 'onClick={() => stage(question)}' },
  },
  {
    id: 'map.region', element: 'button', activation: 'frames the camera and states the region’s declared meaning; no filter, no retrieval',
    leavesGlobalNewsAI: false, aiCost: 'none', supersedes: null,
    evidence: { file: MAP, contains: 'data-visual-map-preset={p.id}' },
  },
  {
    id: 'map.country', element: 'map / country list', activation: 'selects the country (scope only; zero country reads)',
    leavesGlobalNewsAI: false, aiCost: 'none', supersedes: null,
    evidence: { file: MAP, contains: 'countryStoryCounts={NO_COUNTS}' },
  },
  {
    id: 'map.open-country', element: 'a', activation: 'the same country in World Map (which owns explicit retrieval)',
    leavesGlobalNewsAI: false, aiCost: 'none', supersedes: null,
    evidence: { file: MAP, contains: 'href={visualCountryMapHref(selected.iso3)}' },
  },
  {
    id: 'map.ask-about-country', element: 'button', activation: 'geography context into Ask; does not submit',
    leavesGlobalNewsAI: false, aiCost: 'none', supersedes: null,
    evidence: { file: MAP, contains: 'data-visual-country-ask=""' },
  },
];
