/**
 * Milestone #47 — English dictionary. English behavior must remain
 * exactly what it already was before this milestone; this file exists
 * so the SAME rendering code path can look up either language, not to
 * change any existing English wording.
 */
export const en = {
  languageSelectorLabel: 'Language',
  yourQuestion: 'Your question',
  noQuestionProvided: 'No question provided',
  noQuestionMessage: 'No question was provided. Try searching from the homepage.',
  genericFetchError: 'Something went wrong while analyzing this question. Please try again.',
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
  hero: {
    badge: 'AI-powered news intelligence',
    headline: 'Understand today\u2019s world in seconds.',
    subhead:
      'Ask a question about any story and GlobalNews AI reads the coverage across outlets and viewpoints, then gives you a clear, sourced summary you can trust.',
    inputPlaceholder: 'Ask anything...',
    inputAriaLabel: 'Ask GlobalNews AI a question',
    formAriaLabel: 'Ask GlobalNews AI',
    submitAriaLabel: 'Submit question',
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
    headline: 'The story everyone\u2019s reading',
  },
  featuredStory: {
    unavailable: 'Live headlines are temporarily unavailable. Check that the backend is running.',
    viewSources: 'View sources',
    sourceForms: ['source', 'sources', 'sources'] as [string, string, string],
  },
  trendingSidebar: {
    heading: 'Trending now',
    unavailable: 'Live headlines are temporarily unavailable.',
  },
  categoryCards: {
    label: 'Today\u2019s coverage',
    headline: 'Six ways to see what\u2019s happening',
    unavailable: 'Live headlines are temporarily unavailable. Check that the backend is running.',
    sourceForms: ['source', 'sources', 'sources'] as [string, string, string],
  },
  latestUpdatesFeed: {
    label: 'Latest updates',
    headline: 'As it comes in',
    unavailable: 'Live headlines are temporarily unavailable. Check that the backend is running.',
    sourceForms: ['source', 'sources', 'sources'] as [string, string, string],
  },
  howItWorks: {
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
      '/api': 'API',
    } as Record<string, string>,
    comingSoon: 'Coming soon',
    copyrightSuffix: 'GlobalNews AI. All rights reserved.',
    closingTagline: 'Built for clarity, not clicks.',
  },
  navBar: {
    homeAriaLabel: 'GlobalNews AI home',
    primaryNavigationAriaLabel: 'Primary navigation',
    mobileNavigationAriaLabel: 'Mobile navigation',
    searchAriaLabel: 'Search',
    openMenuAriaLabel: 'Open menu',
    closeMenuAriaLabel: 'Close menu',
    signIn: 'Sign In',
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
    reconnecting: 'RECONNECTING',
    live: 'LIVE \u00b7 Powered by GNews',
    cached: 'CACHED \u00b7 Previously retrieved reporting',
    mock: 'DEMO MODE \u00b7 Sample content only',
    unknown: 'DATA STATUS UNKNOWN',
    monitoring: 'Monitoring trusted global sources',
    lastUpdatedPrefix: 'Last updated:',
  },
};
