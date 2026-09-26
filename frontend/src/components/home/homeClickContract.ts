/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME CLICK CONTRACT R1 — the machine-checkable matrix
 * ════════════════════════════════════════════════════════════════════════════
 *
 * AUDIT DATA, NOT A ROUTE SOURCE. No product component imports this file.
 * Module destinations are NOT restated here: a registry-backed row names its
 * `INTELLIGENCE_MODULES` id and the spec resolves the route from the registry,
 * so there is still exactly one route table. The other destinations (anchors,
 * the Ask/Search workspaces, account endpoints, publisher URLs) have no
 * registry entry by design and are recorded as observed.
 *
 * Every row carries `evidence`: a file and a literal it must contain, so the
 * matrix fails the moment the code it describes changes. The human-readable
 * version is HOME-CLICK-CONTRACT-R1.md.
 */

export type Breakpoint = 'phone' | 'tablet' | 'desktop';
export type AiCost = 'none' | 'explicit-send' | 'explicit-deeper-analysis';

export interface HomeClickRow {
  id: string;
  label: string;
  breakpoints: readonly Breakpoint[];
  element: 'a' | 'Link' | 'button' | 'form' | 'textarea' | 'label' | 'span' | 'summary' | 'combobox';
  destination: string | { module: string };
  behavior:
    | 'navigate'
    | 'external-new-tab'
    | 'in-place-dock'
    | 'scroll-anchor'
    | 'toggle'
    | 'filter'
    | 'disabled'
    | 'oauth';
  signedIn: string;
  signedOut: string;
  back: 'history-push' | 'document-navigation' | 'hash-push' | 'new-tab' | 'none';
  unavailable: string;
  external: boolean;
  aiCost: AiCost;
  network: string;
  evidence: { file: string; contains: string };
}

const P: readonly Breakpoint[] = ['phone'];
const TD: readonly Breakpoint[] = ['tablet', 'desktop'];
const D: readonly Breakpoint[] = ['desktop'];
const T: readonly Breakpoint[] = ['tablet'];
const ALL: readonly Breakpoint[] = ['phone', 'tablet', 'desktop'];
const same = 'same as signed-out';

export const HOME_CLICK_CONTRACT: readonly HomeClickRow[] = [
  /* ── HERO ─────────────────────────────────────────────────────────────── */
  {
    id: 'hero.explore-world', label: 'Explore World', breakpoints: TD, element: 'a',
    destination: '#whats-happening-now', behavior: 'scroll-anchor', signedIn: same, signedOut: 'scrolls to What’s Happening Now',
    back: 'hash-push', unavailable: 'target section renders its degraded message when the feed is empty', external: false,
    aiCost: 'none', network: 'none',
    evidence: { file: 'components/home/BetaHero.tsx', contains: 'href="#whats-happening-now"' },
  },
  {
    id: 'hero.ask', label: 'Ask GlobalNewsAI', breakpoints: ALL, element: 'button',
    destination: 'in-place Ask dock (openGlobalAsk)', behavior: 'in-place-dock', signedIn: same, signedOut: 'opens dock, keeps any draft',
    back: 'none', unavailable: '—', external: false, aiCost: 'none', network: 'none (window event only)',
    evidence: { file: 'components/home/BetaHero.tsx', contains: '<HomeAskLauncher' },
  },
  {
    id: 'hero.open-map', label: 'Open Map', breakpoints: ALL, element: 'a',
    destination: { module: 'country-intelligence' }, behavior: 'navigate', signedIn: same, signedOut: 'navigates to the map',
    back: 'document-navigation', unavailable: '—', external: false, aiCost: 'none', network: '/map route load (retained corpus, no provider)',
    evidence: { file: 'components/home/BetaHero.tsx', contains: 'href="/map"' },
  },
  {
    id: 'hero.composer.form', label: 'Ask a question (Hero composer)', breakpoints: ALL, element: 'form',
    destination: 'in-place Ask dock with the exact draft staged', behavior: 'in-place-dock', signedIn: same,
    signedOut: 'stages draft in dock; no route action exists', back: 'none', unavailable: 'empty draft is a silent no-op',
    external: false, aiCost: 'none', network: 'none',
    evidence: { file: 'components/home/HeroAskField.tsx', contains: 'onSubmit={stageInAskDock}' },
  },
  {
    id: 'hero.composer.input', label: 'Ask anything…', breakpoints: ALL, element: 'textarea',
    destination: '—', behavior: 'toggle', signedIn: same, signedOut: 'focus/expand; Enter submits the form above',
    back: 'none', unavailable: '—', external: false, aiCost: 'none', network: 'none',
    evidence: { file: 'components/home/HeroAskField.tsx', contains: 'maxLength={1000}' },
  },
  {
    id: 'hero.premium.cta', label: 'Plans coming soon', breakpoints: TD, element: 'button',
    destination: '—', behavior: 'disabled', signedIn: same, signedOut: 'disabled',
    back: 'none', unavailable: 'disabled + aria-disabled + “Nothing on this page charges you.”', external: false,
    aiCost: 'none', network: 'none',
    evidence: { file: 'components/home/BetaHero.tsx', contains: 'aria-disabled="true"' },
  },
  {
    id: 'premium.teaser.cta', label: 'Plans coming soon (phone teaser)', breakpoints: P, element: 'button',
    destination: '—', behavior: 'disabled', signedIn: same, signedOut: 'disabled',
    back: 'none', unavailable: 'disabled + aria-disabled', external: false, aiCost: 'none', network: 'none',
    evidence: { file: 'components/home/HomePremiumTeaser.tsx', contains: 'disabled' },
  },

  /* ── ASK RAIL ─────────────────────────────────────────────────────────── */
  {
    id: 'rail.ask.suggestion', label: 'Suggested questions ×3', breakpoints: ALL, element: 'button',
    destination: 'in-place Ask dock with the suggestion staged', behavior: 'in-place-dock', signedIn: same,
    signedOut: 'stages the suggestion; nothing is sent', back: 'none', unavailable: '—', external: false,
    aiCost: 'none', network: 'none',
    evidence: { file: 'components/home/HomeSideRail.tsx', contains: 'HomeAskLauncher' },
  },
  {
    id: 'rail.brief.story', label: 'Your world in 60 seconds — story links', breakpoints: ALL, element: 'a',
    destination: 'publisher article URL', behavior: 'external-new-tab', signedIn: same, signedOut: 'opens publisher',
    back: 'new-tab', unavailable: 'panel renders nothing when there are no items', external: true,
    aiCost: 'none', network: 'none (publisher only)',
    evidence: { file: 'components/home/SixtySecondBrief.tsx', contains: 'target="_blank"' },
  },

  /* ── WHAT'S HAPPENING NOW ─────────────────────────────────────────────── */
  {
    id: 'now.card', label: 'Story cards', breakpoints: ALL, element: 'a',
    destination: 'publisher article URL', behavior: 'external-new-tab', signedIn: same, signedOut: 'opens publisher',
    back: 'new-tab', unavailable: 'role=status “Couldn’t load the latest updates.” when empty', external: true,
    aiCost: 'none', network: 'none (publisher only)',
    evidence: { file: 'components/home/WhatsHappeningNow.tsx', contains: 'rel="noopener noreferrer"' },
  },
  {
    id: 'now.chip', label: 'Category chips (All / World / Politics …)', breakpoints: ALL, element: 'label',
    destination: 'CSS radio filter', behavior: 'filter', signedIn: same, signedOut: 'filters in place',
    back: 'none', unavailable: 'not drawn with fewer than two categories', external: false, aiCost: 'none', network: 'none',
    evidence: { file: 'components/home/WhatsHappeningNow.tsx', contains: 'const showFilter = categories.length >= 2;' },
  },
  {
    id: 'now.view-all', label: 'View all', breakpoints: ALL, element: 'label',
    destination: 'the All radio (clears filter)', behavior: 'filter', signedIn: same, signedOut: 'clears the filter',
    back: 'none', unavailable: 'R1: rendered only when the All radio exists', external: false, aiCost: 'none', network: 'none',
    evidence: { file: 'components/home/WhatsHappeningNow.tsx', contains: "htmlFor={RADIO_ID('all')}" },
  },
  {
    id: 'now.rail.prev-next', label: 'Previous / Next story', breakpoints: ALL, element: 'button',
    destination: 'in-place rail scroll', behavior: 'toggle', signedIn: same, signedOut: 'scrolls the rail',
    back: 'none', unavailable: 'never disabled; no-op when the rail does not overflow', external: false,
    aiCost: 'none', network: 'none',
    evidence: { file: 'components/home/StoryRailMotion.tsx', contains: 'press(-1)' },
  },

  /* ── EXPLORE BY TOPIC ─────────────────────────────────────────────────── */
  ...(['economy', 'energy', 'security', 'humanitarian', 'market'] as const).map(
    (moduleId): HomeClickRow => ({
      id: `topics.${moduleId}`, label: `Topic card: ${moduleId}`, breakpoints: ALL, element: 'a',
      destination: { module: moduleId }, behavior: 'navigate', signedIn: same, signedOut: 'navigates to the module',
      back: 'document-navigation', unavailable: 'renders inert if the registry withdraws the destination', external: false,
      aiCost: 'none', network: 'module route load',
      evidence: { file: 'components/home/ExploreByTopic.tsx', contains: 'href={module.destination}' },
    }),
  ),
  {
    id: 'topics.world', label: 'Topic card: World (coming soon)', breakpoints: ALL, element: 'span',
    destination: { module: 'world-intelligence' }, behavior: 'disabled', signedIn: same, signedOut: 'inert',
    back: 'none', unavailable: 'R1: aria-disabled; muted, no pointer', external: false, aiCost: 'none', network: 'none',
    evidence: { file: 'components/home/ExploreByTopic.tsx', contains: 'aria-disabled="true"' },
  },
  {
    id: 'topics.view-all', label: 'View all topics · page coming', breakpoints: ALL, element: 'button',
    destination: '—', behavior: 'disabled', signedIn: same, signedOut: 'disabled',
    back: 'none', unavailable: 'disabled + aria-disabled + “page coming”', external: false, aiCost: 'none', network: 'none',
    evidence: { file: 'components/home/ExploreByTopic.tsx', contains: 'viewAllTopicsPending' },
  },

  /* ── FOR YOU / FOLLOWING / ACCOUNT ────────────────────────────────────── */
  {
    id: 'acct.signin-to-follow', label: 'Sign in to follow', breakpoints: ALL, element: 'a',
    destination: '/api/auth/google?returnTo=%2F', behavior: 'oauth', signedIn: 'not rendered',
    signedOut: 'first-party OAuth start → Google → back to Home', back: 'document-navigation',
    unavailable: 'panel renders nothing while the account is loading', external: false, aiCost: 'none',
    network: 'GET /api/users/me + GET /api/follows/countries on mount; click → OAuth redirect',
    evidence: { file: 'components/home/HomeAccountPanel.tsx', contains: "href={accountSignInUrl('/')}" },
  },
  {
    id: 'acct.foryou.card', label: 'For you — story links', breakpoints: ALL, element: 'a',
    destination: 'publisher article URL', behavior: 'external-new-tab', signedIn: 'followed-country stories from the Home feed',
    signedOut: 'not rendered', back: 'new-tab', unavailable: '“Nothing from the countries you follow in today’s coverage yet.”',
    external: true, aiCost: 'none', network: 'none (reuses the Home feed)',
    evidence: { file: 'components/home/HomeAccountPanel.tsx', contains: 'forYouEmpty' },
  },
  {
    id: 'acct.manage', label: 'Manage (following)', breakpoints: ALL, element: 'a',
    destination: { module: 'country-intelligence' }, behavior: 'navigate', signedIn: 'navigates to the map to follow/unfollow',
    signedOut: 'not rendered', back: 'document-navigation', unavailable: 'hidden while follows load', external: false,
    aiCost: 'none', network: '/map route load',
    evidence: { file: 'components/home/HomeAccountPanel.tsx', contains: 'href="/map"' },
  },
  {
    id: 'hdr.account.signin', label: 'Sign In (header)', breakpoints: ALL, element: 'a',
    destination: '/api/auth/google?returnTo=<current path>', behavior: 'oauth', signedIn: 'replaced by the Account menu',
    signedOut: 'first-party OAuth start', back: 'document-navigation', unavailable: 'empty placeholder while loading',
    external: false, aiCost: 'none', network: 'GET /api/users/me on mount',
    evidence: { file: 'components/navigation/AccountControl.tsx', contains: 'accountSignInUrl(pathname ?? undefined)' },
  },
  {
    id: 'hdr.account.menu', label: 'Account menu (History, Support, Settings, Sign out)', breakpoints: ALL, element: 'button',
    destination: '/history, /support, /account/settings, POST /api/auth/signout', behavior: 'toggle',
    signedIn: 'menu; History entries re-open staged (R1), never auto-run', signedOut: 'not rendered', back: 'history-push',
    unavailable: '—', external: false, aiCost: 'none', network: 'sign out = 1 POST',
    evidence: { file: 'components/navigation/AccountControl.tsx', contains: 'href="/history"' },
  },

  /* ── HEADER (tablet/desktop) ──────────────────────────────────────────── */
  {
    id: 'hdr.search', label: 'Search', breakpoints: TD, element: 'Link',
    destination: '/search', behavior: 'navigate', signedIn: same, signedOut: 'opens the research workspace',
    back: 'history-push', unavailable: '—', external: false, aiCost: 'none', network: 'RSC fetch on click only (prefetch disabled)',
    evidence: { file: 'components/home/BetaHomeHeader.tsx', contains: 'prefetch={false}' },
  },
  {
    id: 'hdr.modules', label: 'Economy / Energy / Security / Humanitarian (+ More menu)', breakpoints: D, element: 'Link',
    destination: 'registry (INTELLIGENCE_MODULES, isModuleNavigable)', behavior: 'navigate', signedIn: same,
    signedOut: 'navigates', back: 'history-push', unavailable: 'World Intel shown aria-disabled “Not yet”', external: false,
    aiCost: 'none', network: 'prefetch of module routes',
    evidence: { file: 'components/home/BetaHomeHeader.tsx', contains: 'INTELLIGENCE_MODULES' },
  },
  {
    id: 'hdr.world', label: 'World (header)', breakpoints: D, element: 'a',
    destination: '#whats-happening-now', behavior: 'scroll-anchor', signedIn: same, signedOut: 'scrolls to the story rail',
    back: 'hash-push', unavailable: '—', external: false, aiCost: 'none', network: 'none',
    evidence: { file: 'components/home/BetaHomeHeader.tsx', contains: '#whats-happening-now' },
  },
  {
    id: 'hdr.compact.ask', label: 'Ask AI (compact header)', breakpoints: T, element: 'Link',
    destination: '/ask', behavior: 'navigate', signedIn: same, signedOut: 'opens /ask; any ?q= is staged only',
    back: 'history-push', unavailable: '—', external: false, aiCost: 'none', network: 'prefetch of /ask',
    evidence: { file: 'components/home/BetaHomeHeader.tsx', contains: "href: '/ask'" },
  },
  {
    id: 'hdr.language', label: 'Language (EN/PL)', breakpoints: ALL, element: 'combobox',
    destination: 'persist cookie + router.refresh()', behavior: 'toggle', signedIn: same, signedOut: 'switches language',
    back: 'none', unavailable: '—', external: false, aiCost: 'none',
    network: 'RSC refresh → one server Home-feed read (provider cache 300 s)',
    evidence: { file: 'components/home/HomeLanguageControl.tsx', contains: 'router.refresh()' },
  },

  /* ── PHONE NAVIGATION ─────────────────────────────────────────────────── */
  {
    id: 'nav.m.search', label: 'Search (phone header)', breakpoints: P, element: 'Link',
    destination: '/search', behavior: 'navigate', signedIn: same, signedOut: 'opens the research workspace',
    back: 'history-push', unavailable: '—', external: false, aiCost: 'none', network: 'R1: no idle prefetch',
    evidence: { file: 'components/navigation/NavBar.tsx', contains: '<Link href="/search" prefetch={false}' },
  },
  {
    id: 'nav.m.menu', label: 'Menu (Home, World Map, Help, account; editorial items unavailable)', breakpoints: P,
    element: 'button', destination: '/, /map, /support', behavior: 'toggle', signedIn: same, signedOut: 'menu overlay',
    back: 'history-push', unavailable: 'seven editorial items aria-disabled “not yet available”', external: false,
    aiCost: 'none', network: 'GET /api/users/me when opened',
    evidence: { file: 'components/navigation/NavBar.tsx', contains: 'editorialUnavailableLabel' },
  },
  {
    id: 'bnav.tabs', label: 'Bottom nav: Home / World Map / Ask AI / Intelligence', breakpoints: P, element: 'a',
    destination: '/, /map, /ask, #intelligence-modules', behavior: 'navigate', signedIn: same, signedOut: 'navigates',
    back: 'document-navigation', unavailable: '—', external: false, aiCost: 'none', network: 'route loads only',
    evidence: { file: 'components/navigation/MobileBottomNav.tsx', contains: "href: '/ask'" },
  },

  /* ── GLOBAL ASK DOCK (root layout, on Home) ───────────────────────────── */
  {
    id: 'dock.launcher', label: 'Ask AI (floating launcher)', breakpoints: ALL, element: 'button',
    destination: 'toggles the dock', behavior: 'in-place-dock', signedIn: same, signedOut: 'opens the dock',
    back: 'none', unavailable: 'hidden while a launcher dialog covers it', external: false, aiCost: 'none', network: 'none',
    evidence: { file: 'components/ask/AskAiDock.tsx', contains: 'data-ask="launcher"' },
  },
  {
    id: 'dock.submit', label: 'Ask (dock Send)', breakpoints: ALL, element: 'button',
    destination: 'POST /api/analysis/news', behavior: 'in-place-dock', signedIn: 'signed-in rate ceiling',
    signedOut: 'anonymous rate ceiling', back: 'none', unavailable: 'disabled when empty or a turn is in flight',
    external: false, aiCost: 'explicit-send', network: 'exactly 1 analysis POST per Send',
    evidence: { file: 'components/ask/AskAiDock.tsx', contains: "if (phase.kind === 'loading') return;" },
  },
  {
    id: 'dock.open-full', label: 'Open full analysis', breakpoints: ALL, element: 'a',
    destination: '/search?q=…[&storyTitle&articleId&countryCode]', behavior: 'navigate', signedIn: same,
    signedOut: 'same-tab click runs the full analysis once; new tab / copied link lands staged', back: 'document-navigation',
    unavailable: 'shown only when the turn produced analysis or articles', external: false,
    aiCost: 'explicit-deeper-analysis', network: '1 analysis POST on same-tab activation; 0 otherwise',
    evidence: { file: 'components/ask/AskCompactResult.tsx', contains: 'grantAnalysisConsent(fullAnalysisHref(question, context));' },
  },
  {
    id: 'dock.dashboard-entry', label: 'Ask GlobalNews AI ↗ (dashboard)', breakpoints: ALL, element: 'a',
    destination: '/ask?q=<draft>[&anchor]', behavior: 'navigate', signedIn: same, signedOut: 'opens /ask with draft staged',
    back: 'document-navigation', unavailable: '—', external: false, aiCost: 'none', network: '/ask route load',
    evidence: { file: 'components/ask/AskAiDock.tsx', contains: 'dashboardHref(' },
  },

  /* ── FOOTER ───────────────────────────────────────────────────────────── */
  {
    id: 'footer.links', label: 'Help & Support / Privacy / Terms / Source Policy / Third-Party Notices', breakpoints: ALL,
    element: 'a', destination: '/support, /privacy, /terms, /source-policy, /third-party-notices', behavior: 'navigate',
    signedIn: same, signedOut: 'navigates', back: 'document-navigation', unavailable: '—', external: false,
    aiCost: 'none', network: 'route loads only',
    evidence: { file: 'lib/homeContent.ts', contains: "href: '/source-policy'" },
  },
];

/** Every component file the Home route mounts (page.tsx + root-layout dock). */
export const HOME_MOUNTED_FILES = [
  'app/page.tsx',
  'components/home/BetaHomeHeader.tsx',
  'components/navigation/NavBar.tsx',
  'components/navigation/AccountControl.tsx',
  'components/navigation/MobileBottomNav.tsx',
  'components/home/BetaHero.tsx',
  'components/home/HeroAskField.tsx',
  'components/home/HomeAskLauncher.tsx',
  'components/home/WhatsHappeningNow.tsx',
  'components/home/StoryRailMotion.tsx',
  'components/home/HomeSideRail.tsx',
  'components/home/SixtySecondBrief.tsx',
  'components/home/ExploreByTopic.tsx',
  'components/home/HomePremiumTeaser.tsx',
  'components/home/HomeAccountPanel.tsx',
  'components/home/HomeLanguageControl.tsx',
  'components/home/HowItWorks.tsx',
  'components/home/TrustSection.tsx',
  'components/layout/Footer.tsx',
] as const;
