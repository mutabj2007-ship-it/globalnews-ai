/**
 * Milestone #47 — English dictionary. English behavior must remain
 * exactly what it already was before this milestone; this file exists
 * so the SAME rendering code path can look up either language, not to
 * change any existing English wording.
 */
import { adminEn } from './adminEn';

export const en = {
  /**
   * F1.b — the Admin Platform namespace. Spread here so it resolves
   * through the SAME getDictionary(language) call as every other
   * section; the strings live in their own file only because this one
   * is already large. No second i18n mechanism is introduced.
   */
  admin: adminEn,

  languageSelectorLabel: 'Language',
  yourQuestion: 'Your question',
  noQuestionProvided: 'No question provided',
  noQuestionMessage: 'No question was provided. Try searching from the homepage.',
  genericFetchError: 'Something went wrong while analyzing this question. Please try again.',
  // M65 — /search with no question is a usable research workspace, not
  // an error-only dead end. These strings are its own copy.
  searchMetaTitle: 'Research workspace \u2014 GlobalNews AI',
  searchMetaDescription: 'Ask a question and get AI-powered, source-grounded analysis of the news.',
  /**
   * M66.13 — the root document title and description. Values are byte-identical
   * to the literals they replace in app/layout.tsx, so English output is
   * unchanged; the keys exist so Polish has a surface at all.
   */
  homeMetaTitle: 'GlobalNews AI — Understand today\u2019s world in seconds.',
  homeMetaDescription:
    'GlobalNews AI turns the day\u2019s news into clear, sourced, multi-perspective answers you can actually understand.',
  searchWorkspaceHeading: 'Ask GlobalNews AI',
  searchWorkspaceIntro: 'Ask a question about world events and get an evidence-grounded answer built from real sources.',
  searchWorkspacePlaceholder: 'What would you like to understand?',
  searchWorkspaceSubmitLabel: 'Analyze',
  searchWorkspaceAriaLabel: 'Ask a research question',
  // M65 — localized analysis failures. The underlying HTTP status is
  // preserved on the error object; users never see the raw number.
  analysisErrorTimeout: 'The analysis is taking longer than expected. Please try again.',
  analysisErrorNetwork: 'We could not reach GlobalNews AI. Check your connection and try again.',
  analysisErrorInvalidQuery: 'That question is too short to analyze. Please add a little more detail.',
  analysisErrorRateLimited: 'You have made several requests in quick succession. Please wait a moment and try again.',
  analysisErrorServer: 'GlobalNews AI could not complete this analysis right now. Please try again shortly.',
  noEvidenceMessage: 'No related articles were found for this question.',
  aiUnavailableMessage: 'AI analysis is temporarily unavailable, but the underlying articles are shown below.',
  originalSourcesHeading: 'Original sources',
  evidenceLanguageLabel: 'Evidence language',
  loadingStages: [
    'Searching trusted sources\u2026',
    'Grouping related reports\u2026',
    'Comparing coverage\u2026',
    'Preparing sourced analysis\u2026',
  ],
  analysisResultView: {
    generatedPrefix: 'Generated',
    relationshipEvidence: 'Relationship evidence',
    supporting: 'Supporting',
    reverse: 'Reverse',
    associationOnly: 'Association-only',
    mixed: 'Mixed',
    aiSelfAssessment: 'AI self-assessment (not the evidence trust rating)',
    aiSelfAssessmentPrefix: 'AI self-assessment',
    aiSelfAssessmentDisclaimer:
      "This is the AI model's own confidence estimate and is not the authoritative evidence trust rating above.",
    // Milestone #62 Phase 1.
    relevance: 'Why this matters',
    context: 'Background',
    // Milestone #62 Phase 2.
    affectedParties: 'Who is affected',
    immediateImpacts: 'Immediate effects',
    spilloverImplications: 'Wider implications',
    // Milestone #62 Phase 3.
    significance: 'Significance',
    significanceMinor: 'Minor',
    significanceModerate: 'Moderate',
    significanceMajor: 'Major',
    significanceCritical: 'Critical',
    // Milestone #62 Phase 4 (final).
    watchNext: 'What to watch next',
    keyFacts: 'Key facts',
    whereSourcesAgree: 'Where sources agree',
    whereReportingDiffers: 'Where reporting differs',
    whatRemainsUnknown: 'What remains unknown',
    insufficientEvidence: 'Insufficient evidence',
    timeline: 'Timeline',
    entitiesAndTopics: 'Entities & topics',
    aiInterpretedUnverified: '(AI-interpreted, unverified)',
    countries: 'Countries',
    locations: 'Locations',
    people: 'People',
    organizations: 'Organizations',
    topics: 'Topics',
  },
  /*
    M66.14B — the hero intelligence context card. THREE keys, all application
    chrome. The category label reuses map.categories (the one canonical
    taxonomy, M66.13C) and the country name is resolved through
    getCountryDisplayName(), so neither is restated here.
    Provider headlines are NEVER translated and appear nowhere in this group.
  */
  heroContext: {
    heading: 'INTELLIGENCE CONTEXT',
    /*
      The scope is a fact about the JOIN, not a claim about the article:
      ArticleCountry is country-scoped by construction, so country is the only
      precision this wording may ever assert. No city or regional variant
      exists, deliberately — geographicPrecision is populated by nothing.
    */
    countryEvidence: 'COUNTRY-LEVEL EVIDENCE',
    dismissLabel: 'Dismiss intelligence context',
  },

  hero: {
    badge: 'AI-powered news intelligence',
    headline: 'Understand today\u2019s world in seconds.',
    subhead:
      'Ask a question about any story and GlobalNews AI reads the coverage across outlets and viewpoints, then gives you a clear, sourced summary you can trust.',
    inputPlaceholder: 'Ask anything...',
    inputAriaLabel: 'Ask GlobalNews AI a question',
    formAriaLabel: 'Ask GlobalNews AI',
    submitAriaLabel: 'Submit question',
    // Query-limit correction — Hero.tsx's textarea character-limit
    // message, shown when the 1000-character maximum is reached.
    questionMaxLengthReached: 'Maximum question length reached',
    tryPrefix: 'Try:',
    /**
     * Milestone #47 (Defect 2 correction) — parallel, translated
     * replacement for homeContent.ts's exampleSearches rotation. Same
     * 6 questions, same order, same rotation logic in Hero.tsx — only
     * the DATA SOURCE moved from the untranslated homeContent.ts array
     * to this dictionary, so the rotating example is never English
     * while the rest of the Hero is Polish.
     */
    exampleQuestions: [
      'What\u2019s happening in the Middle East right now?',
      'Explain the new EU AI regulation in plain English',
      'Summarize today\u2019s central bank announcement',
      'What are scientists saying about the latest climate report?',
      'Break down this week\u2019s tech earnings',
      'What changed in the election polling this week?',
    ] as string[],
    credibilityLiveSources: 'Live sources',
    credibilityAiAnalysis: 'AI analysis',
    credibilityEvidence: 'Evidence-based context',
    credibilityMultiPerspective: 'Multi-perspective',
    dataStatusLabel: 'Data status',
    lastUpdatedLabel: 'Last updated',
    exploreMapCta: 'View World Map',
    feedPanelEyebrow: 'Global intelligence',
    feedPanelHeading: 'Live feed',
    feedPanelViewMap: 'View World Map',
    feedPanelUnavailableHeading: 'Source status',
    feedPanelUnavailableBody: 'Live feed temporarily unavailable.',
    feedPanelUnavailableFooter: 'Search and country intelligence remain accessible.',
    feedPanelSearchStatus: 'Search intelligence',
    feedPanelCountryStatus: 'Country intelligence',
    feedPanelMapStatus: 'Map intelligence',
    feedPanelAvailable: 'Available',
  },
  analysisModeBadge: {
    liveAiAnalysis: 'LIVE AI ANALYSIS \u00b7 Powered by OpenAI',
    demoAiAnalysis: 'DEMO AI ANALYSIS',
    analysisRejected: 'AI ANALYSIS REJECTED \u00b7 Failed validation',
    notAttempted: 'AI ANALYSIS NOT ATTEMPTED',
    unavailable: 'AI UNAVAILABLE',
    failed: 'AI ANALYSIS FAILED',
    cached: 'Cached',
  },
  evidenceSufficiencyNote: {
    citedByPrefix: 'Cited by',
    sourceSingular: 'source',
    sourcePlural: 'sources',
    evidenceBasisLabel: 'Evidence basis from cited source:',
  },
  retrievalContextStatus: {
    liveReporting: 'Live reporting',
    liveDataUnavailable: 'Live data unavailable',
    storedReporting: 'Stored reporting',
    demoReporting: 'Demo reporting',
    liveUnavailableStoredUsed: 'Live reporting was unavailable, so this analysis uses stored reporting.',
    liveNoResultsStoredUsed: 'The live provider returned no usable results, so stored reporting was used.',
    liveUnreachableNoStored:
      'The live news provider could not be reached, and no stored reporting was available for this question.',
    liveNothingNoStored:
      'Live retrieval found nothing usable, and no stored reporting was available for this question.',
    newestStoredArticle: 'Newest stored article:',
    interpretedAs: 'Interpreted',
    interpretedAsMiddle: 'as',
  },
  sourceEntitiesPanel: {
    organizationsIdentified: 'Organizations identified in source material',
    alsoReferredToAsPrefix: 'Also referred to as',
    alsoReferredToAsSuffix: 'in the source material',
    also: 'also',
  },
  formatRelativeTime: {
    justNow: 'just now',
    minAgo: 'min ago',
    hrAgo: 'hr ago',
    daySingular: 'day',
    dayPlural: 'days',
    ago: 'ago',
  },
  newsroomSnapshot: {
    label: 'Newsroom snapshot',
    headline: 'Top story right now',
  },
  featuredStory: {
    unavailable: 'Live headlines are temporarily unavailable. Check that the backend is running.',
    viewSources: 'View sources',
    sourceForms: ['source', 'sources', 'sources'] as [string, string, string],
    readFullStoryPrefix: 'Read the full story:',
  },
  inFocusSidebar: {
    heading: 'In focus',
    unavailable: 'Live headlines are temporarily unavailable.',
    readFullStoryPrefix: 'Read the full story:',
  },
  globalDevelopments: {
    eyebrow: 'Global developments',
    headline: 'What is happening right now',
    unavailable: 'Live headlines are temporarily unavailable. Check that the backend is running.',
    sourceForms: ['source', 'sources', 'sources'] as [string, string, string],
    readFullStoryPrefix: 'Read the full story:',
    viewSources: 'View sources',
    unavailableLabel: 'System status',
    statusFeedUnavailable: 'Live feed unavailable',
    statusCountryAvailable: 'Country intelligence available',
    statusSearchAvailable: 'Search available',
    statusMapAvailable: 'World map available',
    statusWaitingProvider: 'Waiting for provider',
    // M60 Phase 2 — carousel controls.
    previousLabel: 'Previous story',
    nextLabel: 'Next story',
  },
  situationMap: {
    eyebrow: 'Global situation map',
    heading: 'See what\u2019s happening, geographically',
    description: 'Select a country to see real-time coverage.',
    openFullMap: 'Open full map',
    storyForms: ['story', 'stories', 'stories'] as [string, string, string],
    publisherForms: ['publisher', 'publishers', 'publishers'] as [string, string, string],
    latestLabel: 'Latest',
    primaryTopicLabel: 'Primary topic',
    noSelectionPrompt: 'Select a country on the map to see real, current coverage.',
    hoverPrompt: 'Hover a region to inspect coverage.',
    countryCoverageLabel: 'Country coverage',
    countryCoverageValue: 'Available where provider data exists',
    mapModeLabel: 'Map mode',
    mapModeValue: 'Interactive',
    loadingLabel: 'Loading coverage\u2026',
    noCoverageLabel: 'No current coverage found for this country.',
  },
  categoryCards: {
    label: 'Today\u2019s coverage',
    headline: 'More from today\u2019s coverage',
    unavailable: 'Live headlines are temporarily unavailable. Check that the backend is running.',
    sourceForms: ['source', 'sources', 'sources'] as [string, string, string],
    readFullStoryPrefix: 'Read the full story:',
  },
  latestNowRail: {
    label: 'Latest now',
    unavailable: 'Live headlines are temporarily unavailable.',
    previousLabel: 'Previous updates',
    nextLabel: 'Next updates',
    readFullStoryPrefix: 'Read the full story:',
    regionLabel: 'Latest news, scrollable',
  },
  worldMapGateway: {
    label: 'Explore the world',
    headline: 'See what\u2019s happening, geographically',
    description: 'Browse live coverage by country on the interactive World Map.',
    cta: 'Open World Map',
  },
  latestUpdatesFeed: {
    label: 'Latest updates',
    headline: 'As it comes in',
    unavailable: 'Live headlines are temporarily unavailable. Check that the backend is running.',
    sourceForms: ['source', 'sources', 'sources'] as [string, string, string],
    readFullStoryPrefix: 'Read the full story:',
  },
  howItWorks: {
    /**
     * M66.8d (CTO decision D-1, option A) — the localized step prefix.
     * GN-CD-HIW-005 renders `STEP 01` where the current build shows a bare
     * `01`. The prefix is new user-facing copy, so it is a dictionary key
     * rather than a literal in the component: hardcoding an English `STEP`
     * would put an untranslated string on the Polish page. Composed with the
     * EXISTING processSteps numerals ('01', '02', '03'), which are
     * language-independent and unchanged.
     */
    stepPrefix: 'STEP',
    label: 'How it works',
    headline: 'From question to clarity, in three steps',
    steps: [
      {
        title: 'Ask anything',
        description:
          'Type a question the way you\u2019d ask a well-informed friend \u2014 no keywords or search syntax required.',
      },
      {
        title: 'AI reads the coverage',
        description:
          'GlobalNews AI scans reporting from multiple outlets and viewpoints, then reconciles what they agree and disagree on.',
      },
      {
        title: 'You get a clear answer',
        description:
          'A concise, sourced summary \u2014 with the original articles linked, so you can always go deeper.',
      },
    ],
  },
  trustSection: {
    label: 'Built on trust',
    headline: 'Why trust GlobalNews AI?',
    items: [
      {
        title: 'Full transparency',
        description:
          'Every summary links back to its original sources, so you can verify anything GlobalNews AI tells you.',
      },
      {
        title: 'Multiple viewpoints',
        description:
          'We surface how different outlets and regions are covering the same story \u2014 not just one narrative.',
      },
      {
        title: 'AI summaries, clearly labeled',
        description:
          'AI-generated context is always marked as such, and kept separate from direct reporting.',
      },
      {
        title: 'Live updates',
        description: 'Stories evolve as new reporting comes in, and your summary updates with them.',
      },
      {
        title: 'Educational context',
        description: 'Unfamiliar with a topic? GlobalNews AI fills in the background you need, not just the headline.',
      },
    ],
  },
  footer: {
    tagline:
      'Clear, sourced, multi-perspective news understanding \u2014 powered by AI, grounded in real reporting.',
    groupTitles: {
      Company: 'Company',
      Legal: 'Legal',
      Developers: 'Developers',
    } as Record<string, string>,
    linkLabels: {
      '/about': 'About',
      '/careers': 'Careers',
      '/contact': 'Contact',
      '/privacy': 'Privacy Policy',
      '/terms': 'Terms of Service',
      '/source-policy': 'Source Policy',
      '/api': 'API',
    } as Record<string, string>,
    comingSoon: 'Coming soon',
    copyrightSuffix: 'GlobalNews AI. All rights reserved.',
    closingTagline: 'Built for clarity, not clicks.',
  },
  mobileBottomNav: {
    navigationAriaLabel: 'Bottom navigation',
    home: 'Home',
    worldMap: 'World Map',
    ask: 'Ask AI',
    intelligence: 'Intelligence',
  },
  navBar: {
    homeAriaLabel: 'GlobalNews AI home',
    primaryNavigationAriaLabel: 'Primary navigation',
    mobileNavigationAriaLabel: 'Mobile navigation',
    searchAriaLabel: 'Search',
    openMenuAriaLabel: 'Open menu',
    closeMenuAriaLabel: 'Close menu',
    signIn: 'Sign In',
    // Milestone #57 — Optional Accounts. Only rendered once a real
    // session exists (see AccountControl.tsx) — a signed-out visitor
    // never sees any of these three.
    history: 'History',
    signOut: 'Sign Out',
    deleteAccount: 'Delete Account',
    deleteAccountConfirm: 'Delete your account? This permanently removes your saved history and cannot be undone.',
    languageSelectorLabel: 'Language',
    /**
     * M66.11 — the action half of the language control's accessible name,
     * and the listbox's own label. GN-CD-M66.11 §7 requires the trigger to be
     * named "Language: {current}. Select language" FROM LOCALIZED STRINGS,
     * never a concatenated English template.
     *
     * ONE key, not two. It serves both the trigger's action phrase and the
     * listbox aria-label, which are the same words for the same purpose — the
     * same reuse decision M48 made when DataModeLabel adopted
     * liveStatusStrip's four existing state labels rather than duplicating
     * them. No interpolation mechanism is introduced: NavBar composes
     * `${languageSelectorLabel}: ${endonym}. ${languageSelectorAction}` from
     * these two localized strings and LANGUAGE_NATIVE_LABELS.
     */
    languageSelectorAction: 'Select language',
    /**
     * M66.13 — the mobile menu's section heading. It was a bare 'SECTIONS'
     * literal in NavBar.tsx, ported verbatim from the Claude Design prototype
     * during the M65 header reconstruction, so it rendered English inside an
     * otherwise fully Polish menu. English value is byte-identical to what
     * shipped; only the Polish surface is new.
     */
    sectionsHeading: 'SECTIONS',
    editorialUnavailableLabel: 'not yet available',
    // M65 — the approved design's nine-item header sequence. Keyed by
    // navModel.ts's labelKey so every visible label localizes, including
    // the six editorial items that resolve to real /search queries and
    // the deliberately unavailable About entry.
    navItemLabels: {
      home: 'Home',
      worldMap: 'World Map',
      world: 'World',
      politics: 'Politics',
      business: 'Business',
      technology: 'Technology',
      science: 'Science',
      health: 'Health',
      about: 'About',
    } as Record<string, string>,
    linkLabels: {
      '/': 'Home',
      '/map': 'World Map',
      '/world': 'World',
      '/politics': 'Politics',
      '/business': 'Business',
      '/technology': 'Technology',
      '/science': 'Science',
      '/health': 'Health',
      '/about': 'About',
    } as Record<string, string>,
  },
  liveStatusStrip: {
    /**
     * M66.13 — the FOURTH NewsDataMode member finally gets its own label.
     * `unavailable` means live retrieval was attempted, no configured real
     * provider succeeded, and no stored reporting existed either — see
     * shared/src/news.ts, which states it 'must never be presented as "live"
     * or "cached"'. It previously collapsed into `unknown`, which is weaker
     * but not false; the two are now distinguished, per CTO decision G.
     */
    unavailable: 'NO REPORTING AVAILABLE',
    reconnecting: 'RECONNECTING',
    live: 'LIVE \u00b7 Powered by GNews',
    cached: 'CACHED \u00b7 Previously retrieved reporting',
    mock: 'DEMO MODE \u00b7 Sample content only',
    unknown: 'DATA STATUS UNKNOWN',
    monitoring: 'Monitoring trusted global sources',
    lastUpdatedPrefix: 'Last updated:',
  },
  map: {
    metaTitle: 'World Map \u2014 GlobalNews AI',
    metaDescription: 'Explore current news coverage by country on an interactive world map.',
    exploreLabel: 'Explore',
    headline: 'World News Map',
    intro:
      'Select a country to see its current headlines, sourced live where a provider is configured. Search by name, or click directly on the map.',
    mapA11yNote:
      'An interactive world map is shown below on larger screens. You do not need to use it \u2014 the country search field above lets you find and select any supported country by typing its name, with full keyboard support.',
    noSelectionPrompt: 'Search for a country above, or select one on the map, to see its current coverage.',
    mobileFallback:
      'The interactive map is available on larger screens. Use the search field above to select a country here.',
    loading: 'Loading world map\u2026',
    mapLoadErrorPrefix: 'The interactive map could not be loaded (',
    mapLoadErrorSuffix:
      '). Use the country search below instead \u2014 the same country coverage is available without the map.',
    searchLabel: 'Search for a country by name',
    searchPlaceholder: 'Search for a country (e.g. Spain)',
    categories: {
      all: 'All',
      world: 'World',
      politics: 'Politics',
      business: 'Business',
      technology: 'Technology',
      science: 'Science',
      health: 'Health',
      // M66.13C — the shared NewsCategory union has EIGHT members and the
      // backend classifier genuinely emits these two. They had no label, so
      // a sports or entertainment story fell through to its raw token in both
      // languages. Added here, in the one canonical mapping, not a new one.
      sports: 'Sports',
      entertainment: 'Entertainment',
    } as Record<string, string>,
    coverageLegendTitle: 'Coverage Legend',
    legendNoStories: 'No stories loaded',
    legendFew: '1\u20133 stories',
    legendSome: '4\u20137 stories',
    legendMany: '8\u201312 stories',
    legendLots: '13+ stories',
    tooltipLoaded: 'LOADED',
    tooltipReady: 'READY',
    tooltipStories: 'Stories',
    tooltipRefreshAction: 'Click to refresh and explore the latest coverage.',
    tooltipLoadAction: 'Click to load live news coverage for this country.',
    badge: {
      livePrefix: 'LIVE \u00b7 POWERED BY ',
      delayedPrefix: 'DELAYED FEED \u00b7 POWERED BY ',
      stored: 'STORED REPORTING',
      demo: 'DEMO MODE \u00b7 SAMPLE CONTENT ONLY',
      unavailable: 'FEED CURRENTLY UNAVAILABLE',
    },
    fallback: {
      providerErrorTitle: 'Live provider unavailable',
      noLiveResultsTitle: 'No usable live results',
      genericTitle: 'Stored reporting',
      providerErrorDescription:
        'The live news provider could not be reached. Previously retrieved reporting is shown instead.',
      noLiveResultsDescription:
        'The provider responded, but no usable current country stories were available. Stored reporting is shown instead.',
      genericDescription: 'Previously retrieved reporting is being shown for this country.',
    },
    newestStoredArticle: 'Newest stored article:',
    categoryFilterAriaLabel: "Filter this country's coverage by category",
    panel: {
      coverageQuality: 'Coverage Quality',
      coverageStrength: 'Coverage strength',
      coverageQualityBasis: 'Based on article volume, publisher diversity and reporting freshness.',
      publishers: 'Publishers',
      latest: 'Latest',
      coverageSnapshot: 'Coverage snapshot',
      stories: 'Stories',
      mainTopic: 'Main topic',
      categoryActivity: 'Category activity',
      noCoveragePrefix: 'No current coverage found for',
      noCoverageInCategory: 'in',
      noCoverageSuffix: '. Try a different category, or view full coverage below.',
      viewFullCoverage: 'View full country coverage',
      showDetails: 'Show details',
      hideDetails: 'Hide details',
    },
    storyForms: ['story', 'stories', 'stories'] as [string, string, string],
    storiesCurrentlyLoadedSuffix: 'currently loaded',
    genericFetchError: 'Something went wrong while loading this country\u2019s coverage.',
    coverageQualityLevels: {
      none: {
        label: 'No coverage',
        description: 'No current articles are available for this selection.',
      },
      limited: {
        label: 'Limited coverage',
        description: 'Only a small number of reports or publishers are currently available.',
      },
      developing: {
        label: 'Developing coverage',
        description: 'Several reports are available, but coverage may still be developing.',
      },
      strong: {
        label: 'Strong coverage',
        description: 'Coverage includes several recent articles from multiple publishers.',
      },
    },
    storedReportingNoticeAriaLabel: 'Stored reporting notice',
    coverageQualityAriaSuffix: 'coverage quality',
    readFullStoryPrefix: 'Read the full story:',
    askAboutStory: 'Ask GlobalNews AI about this',
    freshness: {
      fresh: 'FRESH',
      recent: 'RECENT',
      aging: 'AGING',
      limited: 'LIMITED',
    } as Record<string, string>,
  },
  intelligenceModules: {
    eyebrow: 'Intelligence engine',
    heading: 'How GlobalNews AI understands the world',
    description: 'Each module is a real capability the engine applies when you ask a question or explore coverage.',
    stateLabels: {
      active: 'Active',
      preview: 'Preview',
      comingSoon: 'Coming soon',
    },
    openAction: 'Open',
    hubLabel: 'GlobalNews AI Intelligence Engine',
    // M65.1 — the approved Claude Design canvas subtitle.
    canvasSubtitle: 'Connected capabilities powering deeper understanding',
    // M65.1 — the hub's capability line is DERIVED from the canonical
    // INTELLIGENCE_MODULES array (total count, and how many are actually
    // ACTIVE), never a hardcoded claim. These are only its grammatical
    // forms. English has two real forms; the third mirrors the second by
    // the convention pluralize.ts documents.
    moduleForms: ['module', 'modules', 'modules'] as [string, string, string],
    activeForms: ['active', 'active', 'active'] as [string, string, string],
    modules: {
      /*
        M66.5 — GN-CD-154. `shortTitle` is the MOBILE radial card's name.
        The released mobile card is a fixed 108x56 box with
        `overflow:hidden`, so the desktop `title` cannot simply be reused:
        measured against the released 71px text column and 46px vertical
        budget, `title` wraps `Evidence & Source Comparison` to three lines
        and clips it. Every value below is GN-CD-148's own
        `Short name (mobile)` column, stored in the same casing as its
        sibling `title` and uppercased by CSS exactly as `title` already is.
        Approved by the CTO under decision D-5 A. All nine fit in two lines
        or fewer; none clips.
      */
      aiResearch: {
        title: 'AI Research Assistant',
        shortTitle: 'AI Research',
        description: 'Ask a question and get an evidence-grounded answer built from real sources.',
      },
      worldIntelligence: {
        title: 'World Intelligence',
        shortTitle: 'World Intel',
        description: 'Global developments organized by relevance, recency, and source diversity.',
      },
      countryIntelligence: {
        title: 'Country Intelligence',
        shortTitle: 'Country Intel',
        description: 'Explore coverage, categories, and freshness for any country on the map.',
      },
      evidence: {
        title: 'Evidence & Source Comparison',
        shortTitle: 'Evidence & Source',
        // M65.1 — CTO Decision 2: the approved reference's own wording
        // included "Detect bias", which overstates what this product
        // does. SourceDiversity's own contract states it cannot prove
        // editorial independence or bias. This is the approved truthful
        // replacement.
        description: 'Compare sources. Find agreements and disagreements.',
      },
      economy: {
        title: 'Economy Intelligence',
        shortTitle: 'Economy Intel',
        description: 'Early-stage: economic and business coverage, without dedicated market data yet.',
      },
      conflict: {
        title: 'Conflict Intelligence',
        shortTitle: 'Conflict Intel',
        description: 'Early-stage: conflict-relevant coverage, without dedicated risk monitoring yet.',
      },
      market: {
        title: 'Market Intelligence',
        shortTitle: 'Market Intel',
        description: 'Planned: dedicated market and pricing data is not yet connected.',
      },
      timeline: {
        title: 'Timeline Intelligence',
        shortTitle: 'Timeline Intel',
        description: 'Planned: structured event timelines are not yet available.',
      },
      forecast: {
        title: 'Forecast & Watchlist',
        shortTitle: 'Forecast & Watchlist',
        description: 'Planned: monitored risks and indicators are not yet available.',
      },
    },
  },
  privacyPage: {
    title: 'Privacy Policy',
    lastUpdatedLabel: 'Last updated',
    lastUpdatedDate: '17 August 2026',
    intro:
      'This page explains, in plain language, what information GlobalNews AI collects and how it is used. It describes the product as it actually works today.',
    sections: [
      {
        heading: 'Account and sign-in',
        body: 'You can use GlobalNews AI to search and read analysis without signing in. If you choose to sign in with Google, we receive basic identity information from your Google account (such as your name, email address, and profile image) to create and maintain your account and keep you signed in across sessions.',
      },
      {
        heading: 'Search activity and history',
        body: 'When you are signed in, the questions you ask may be saved to your account so you can revisit them later. You can view and delete individual entries, or clear your entire search history, at any time from your account. Deleting your account removes your saved search history along with it.',
      },
      {
        heading: 'Language preference',
        body: 'Your chosen display language is stored in your browser (via local storage and a small cookie) so the site remembers your preference on your next visit. This is a technical preference setting only \u2014 it is not linked to any profiling or advertising activity.',
      },
      {
        heading: 'How your question is processed',
        body: 'To answer a question, GlobalNews AI retrieves relevant news reporting from third-party news providers and uses an AI language model to analyze and summarize that reporting. The text of your question and the retrieved articles are sent to these third-party services as part of generating your answer.',
      },
      {
        heading: 'What we do not collect',
        body: 'GlobalNews AI does not request or collect your precise physical location. We do not currently operate analytics, advertising, or administrative tracking systems beyond what is described on this page.',
      },
      {
        heading: 'Security',
        body: 'We use standard technical safeguards appropriate for a service of this kind to help protect your information. No online service can guarantee complete security, and we encourage you to use a strong, unique password with any account you connect to this service.',
      },
      {
        heading: 'Changes to this policy',
        body: 'As GlobalNews AI develops, this page will be updated to reflect how the product actually works. We encourage you to revisit this page from time to time.',
      },
    ],
  },
  termsPage: {
    title: 'Terms of Service',
    lastUpdatedLabel: 'Last updated',
    lastUpdatedDate: '17 August 2026',
    intro:
      'These terms describe how GlobalNews AI is intended to be used. Please read them before using the service.',
    sections: [
      {
        heading: 'What GlobalNews AI is',
        body: 'GlobalNews AI is an informational tool that helps you understand current events by retrieving news reporting and generating an AI-assisted analysis of it. It is intended to help you get oriented on a topic quickly \u2014 it is not a substitute for reading primary reporting yourself, and it is not professional, legal, financial, or medical advice.',
      },
      {
        heading: 'AI-generated analysis can be wrong',
        body: 'Analysis on this site is generated by an AI language model based on retrieved evidence. AI-generated content can be incomplete, outdated, or simply incorrect. Always check the cited sources and evidence shown alongside an analysis before relying on it, and use your own judgment.',
      },
      {
        heading: 'Coverage and availability are not guaranteed',
        body: 'GlobalNews AI depends on third-party news providers and AI services to function. Coverage of any given topic may be partial, delayed, or temporarily unavailable, and the service itself may be unavailable from time to time. We do not guarantee complete or continuous coverage of any topic, region, or event.',
      },
      {
        heading: 'Your account and responsibilities',
        body: 'If you create an account, you are responsible for keeping your sign-in credentials secure and for activity that happens through your account. You may delete your account and associated data at any time.',
      },
      {
        heading: 'Acceptable use',
        body: 'Please use GlobalNews AI for its intended purpose. Do not attempt to disrupt, overload, or circumvent the service, and do not use it in a way that violates applicable law or the rights of others.',
      },
      {
        heading: 'Source attribution',
        body: 'Analysis presented on this site is based on reporting from third-party news sources, which are cited alongside the analysis. Those sources retain their own rights in their original reporting; GlobalNews AI\u2019s role is to help you find and understand that reporting, not to replace it.',
      },
      {
        heading: 'Changes to the service and these terms',
        body: 'GlobalNews AI is under active development, and both the service and these terms may change as it evolves. We will update this page to reflect material changes.',
      },
      {
        heading: 'General disclaimer',
        body: 'The service is provided on an \u201cas is\u201d basis, without warranties of any kind, to the fullest extent permitted by applicable law.',
      },
    ],
  },
  /**
   * M66.10B — Source Policy. Every sentence below traces to a
   * repository finding recorded in the M66.10A Source Policy Contract
   * audit, and the CTO's four mandatory wording corrections (A-D) are
   * applied: no staffing claim, no universal sentence-level citation
   * guarantee, no claim to have established original/journalistic
   * origin, and no claim that every UI label states its data mode
   * using the exact internal name.
   *
   * Deliberately ABSENT, because the repository cannot support them:
   * per-story source counts (GNews hardcodes sourcesCount: 1), source
   * authority evaluation (the Official Source Registry is empty and
   * consumed by nothing), geographic/evidence precision (declared in
   * shared/src/news.ts and never written or read), complete coverage,
   * real-time guarantees, and accuracy guarantees.
   *
   * Same shape as privacyPage/termsPage — no new i18n mechanism.
   */
  sourcePolicyPage: {
    title: 'Source Policy',
    lastUpdatedLabel: 'Last updated',
    lastUpdatedDate: '20 August 2026',
    intro:
      'This page explains where the information in GlobalNews AI comes from, how it is presented, and what it does and does not tell you. It describes the product as it actually works today, not as it is intended to work later.',
    sections: [
      {
        heading: 'Where information comes from',
        body: 'GlobalNews AI retrieves published news reporting through a third-party news provider and uses that reporting for its news and analysis features. The provider returns articles from many different publishers. Production news retrieval currently depends on a single provider, GNews \u2014 GlobalNews AI does not draw on multiple live news providers today.',
      },
      {
        heading: 'Source names and article links',
        body: 'Each article is shown with the source name supplied by the news provider, and links to the page identified by that provider, using the URL supplied with the retrieved reporting. GlobalNews AI does not republish or rehost articles. Where the provider supplies no source name, GlobalNews AI shows that the source is unknown rather than guessing one.',
      },
      {
        heading: 'Comparing reporting across sources',
        body: 'When GlobalNews AI analyzes a question, it works from a set of retrieved articles and identifies where they agree and where they differ. This comparison describes what the retrieved reporting says. It is not a judgement about which source is right.',
      },
      {
        heading: 'AI-generated analysis',
        body: 'Summaries, comparisons and context in GlobalNews AI are generated by an AI language model and are shown separately from the reporting itself. Every analysis carries provenance and status information describing how it was produced \u2014 including when the AI service was unavailable, when a request failed, and when a demonstration mode is in use.',
      },
      {
        heading: 'How analysis entries are checked',
        body: 'Evidence-bearing claims and structured analysis entries are checked against the articles supplied to the analysis. Entries whose cited evidence cannot be resolved to those articles are removed before the result is returned, even when that leaves a section empty. The citations shown to you are created from the retrieved article records rather than being trusted directly from model output. An AI analysis can still misread or oversimplify the reporting it cites, which is why the links are there.',
      },
      {
        heading: 'Source diversity',
        body: 'For an analysis, GlobalNews AI counts structural properties of the reporting it retrieved: how many articles were returned, how many distinct source names appeared, how many distinct web domains appeared, and how many articles resembled repeats of one another. These are counts of what was retrieved. They do not establish editorial independence, syndication or wire-copy origin, or relationships between sources, and GlobalNews AI does not currently evaluate or rate source authority.',
      },
      {
        heading: 'Live, cached, sample and unavailable information',
        body: 'The news pipeline distinguishes four data states. Live means the news provider was queried and answered. Cached means the provider could not supply current results, so previously retrieved reporting from our own database is used instead, limited to a configured 24-hour fallback window. Mock means sample content, which is not permitted as production news. Unavailable means no reporting could be retrieved and none was stored, so nothing is shown. The interface uses status and provenance indicators so that cached or sample information is not presented as live reporting, and mock and real news responses are not blended together.',
      },
      {
        heading: 'Provider limitations and coverage',
        body: 'The coverage available in GlobalNews AI depends on what its news provider returns. If the provider is unavailable, rate-limited, or returns nothing for a query, GlobalNews AI falls back to cached reporting or reports that nothing is available; it does not substitute content from elsewhere. Coverage is therefore uneven, and a topic, region, language or source that the provider does not cover will not appear here. The absence of reporting in GlobalNews AI is not evidence that nothing happened.',
      },
      {
        heading: 'Corrections and how coverage changes',
        body: 'GlobalNews AI retrieves reporting again when you ask, and a stored copy of an article is replaced when a newer version of the same article is retrieved. There is no publisher correction or retraction tracking mechanism: GlobalNews AI does not track, annotate or notify you about corrections issued by a source. If a source corrects or retracts a story, the authoritative record is that source\u2019s own page, which the article links point to.',
      },
      {
        heading: 'What GlobalNews AI does not guarantee',
        body: 'GlobalNews AI does not guarantee that coverage of any topic is complete, that information is current at the moment you read it, or that any summary or analysis is accurate. It does not verify the factual accuracy of the reporting it retrieves, and it does not rank, rate or certify sources. Use the links \u2014 they lead to the reporting GlobalNews AI is describing.',
      },
    ],
  },
};
