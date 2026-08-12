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
};
