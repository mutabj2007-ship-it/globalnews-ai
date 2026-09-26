/**
 * Milestone #47 — English dictionary. English behavior must remain
 * exactly what it already was before this milestone; this file exists
 * so the SAME rendering code path can look up either language, not to
 * change any existing English wording.
 */
import { adminEn } from './adminEn';
import { supportEn } from './supportEn';

export const en = {
  /**
   * F1.b — the Admin Platform namespace. Spread here so it resolves
   * through the SAME getDictionary(language) call as every other
   * section; the strings live in their own file only because this one
   * is already large. No second i18n mechanism is introduced.
   */
  admin: adminEn,

  /**
   * RC-1 - the user Support namespace, folded in exactly the way `admin` above
   * is. The /support surface previously resolved its own dictionary with a
   * two-line ternary because F's checkpoint was not allowed to edit this file;
   * that was recorded as temporary in app/support/page.tsx. Folding it here
   * removes the second localization path, so every section of the product now
   * reaches its strings through the same getDictionary(language) call.
   */
  support: supportEn,

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
  /*
    ── C9 · THE TITLE NOW MATCHES THE PAGE ────────────────────────────────
    It read "Understand today's world in seconds." — a headline the Home has
    not carried since the approved hero landed, which reads "Understand /
    what's changing." R1 recorded this as a known defect and did not fix it
    unilaterally, because "/" is one of only five indexable routes and its
    title is an SEO decision rather than a composition one. R2 rules on it.

    The title, og:title and twitter:title all derive from this single key in
    `buildPageMetadata`, so one change covers all three. The robots directive
    comes from the route registry and is untouched — indexing policy is NOT
    part of this change.

    The description still describes the product rather than the hero, and is
    left as it is: it was never the string that advertised the superseded
    headline.
  */
  homeMetaTitle: 'GlobalNews AI — Understand what\u2019s changing.',
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
  /*
     PH-1 — TWO LIMITS GUARD THIS ROUTE, AND THE FRONTEND CANNOT TELL THEM APART.
     analysis.controller.ts carries @Throttle({ limit: 5, ttl: 60000 }) — a ONE-MINUTE
     window — and AnalysisRateLimitGuard adds ANALYSIS_WINDOW_MS = 15 * 60_000 with an
     anonymous ceiling of 5. analysisApi.ts maps ANY 429 to 'rate-limited', so this one
     string is shown for both. Naming a single wait would therefore be wrong roughly half
     the time, in one direction or the other, which is why it names a range instead.
     `analysisRateLimitCopy.spec.ts` reads the guard's own constants and fails if they move.
  */
  analysisErrorRateLimited:
    'You have made several analysis requests in a short time. Depending on which limit you reached, the wait is about a minute or up to about 15. Signing in raises the longer limit.',
  analysisErrorServer: 'GlobalNews AI could not complete this analysis right now. Please try again shortly.',
  noEvidenceMessage: 'No related articles were found for this question.',
  aiUnavailableMessage: 'AI analysis is temporarily unavailable, but the underlying articles are shown below.',
  originalSourcesHeading: 'Original sources',
  evidenceLanguageLabel: 'Evidence language',
  askAi: {
    launcher: 'Ask AI',
    title: 'Ask GlobalNews AI',
    panelLabel: 'Ask GlobalNews AI',
    close: 'Close',
    inputLabel: 'Ask a question about world events',
    inputPlaceholder: 'What would you like to understand?',
    submit: 'Ask',
    idle: 'Ask a question and the answer will be assembled from retrieved reporting, with its sources shown.',
    contextPending: 'Ask about this view \u2014 coming soon',
    contextPendingHint: 'Asking about the page you are on is not available yet. Questions here are answered from retrieved reporting only.',
    /*
     * ASK AI REV A §6 — the compact result's own words.
     *
     * These name STATES; they never stand in for an answer. The withheld
     * case deliberately reuses `analysisResultView.briefWithheld*`, which
     * is already the product's accepted wording for that state, so the
     * dock cannot describe it differently from Surface B.
     */
    contextChipAnchored: 'Asking about this story',
    contextChipGeneric: 'Asking about world events',
    resultSourcesHeading: 'Sources',
    resultSourcesNone: 'No sources were retrieved for this question.',
    resultSourcesTruncated: 'Showing {shown} of {total}. Open the full analysis for the rest.',
    resultBriefAbsent: 'This analysis carried no executive brief. That is an absence, not an assessment \u2014 nothing was measured and withheld.',
    resultNoAnswer: 'No answer was produced for this question. The state above says why.',
    resultNoAnswerProvider:
      'Live reporting could not be retrieved reliably enough to answer this question.',
    resultNoAnswerEvidence:
      'No retrieved reporting met the evidence threshold for this question.',
    resultNoAnswerSafety:
      'GlobalNews AI did not generate an answer without supporting evidence. Try again shortly or ask a narrower question about a place, event, or time period.',
    openFullAnalysis: 'Open full analysis',
    telemetryReports: 'retrieved reports',
    telemetryClusters: 'reporting clusters',
  },
  loadingStages: [
    'Searching trusted sources\u2026',
    'Grouping related reports\u2026',
    'Comparing coverage\u2026',
    'Preparing sourced analysis\u2026',
  ],
  analysisResultView: {
    /* C907 CORRECTION 3 — the complete-record view's own words for a brief the backend withheld. */
    briefWithheldHeading: 'Executive brief unavailable',
    briefWithheldBody:
      'The brief for this evidence set did not meet the structural requirement and was withheld rather than shown. Everything below was validated independently and is unaffected.',
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
    aiInterpretedUnverified: 'AI-INTERPRETED LOCATION \u00b7 UNVERIFIED',
    countries: 'Countries',
    locations: 'Locations',
    people: 'People',
    organizations: 'Organizations',
    topics: 'Topics',
  },

  /*
    H2B — the Analysis Workspace shell (GN-CD-ANALYSIS-WORKSPACE + R1).
    Application chrome only. No analysis content is described here: every
    claim, citation, source name and quotation continues to come from the
    production response and is rendered verbatim, never through this
    dictionary. The dimension names are the released design's own labels.
  */
  analysisWorkspace: {
    workspaceLabel: 'Analysis workspace',
    indexLabel: 'Analysis index',
    navigatorLabel: 'Analysis dimensions',
    /* The Executive Brief is not a countable list; the index shows a dash. */
    uncountable: '\u2014',
    showingPrefix: 'Showing',
    itemForms: ['item', 'items', 'items'] as [string, string, string],
    noItemsInDimension: 'No items in this dimension for this analysis',
    /*
      J-2 — AN EMPTY DIMENSION HAS TWO CAUSES AND THEY ARE OPPOSITE FACTS.

      `noItemsInDimension` above stays the honest FALLBACK, for when the product
      cannot tell which occurred: a result produced before the grounding census
      existed carries no counts, and guessing would be worse than a generic line.

      Neither sentence names a count. A reader needs to know whether the
      reporting was silent or whether it did not support what was drafted;
      "3 generated, 0 accepted" is diagnostics, not an answer.
    */
    noGroundedItemsInDimension: 'No grounded items supported by the current evidence',
    nothingReportedInDimension: 'The current evidence reports nothing for this dimension',
    regionNotInThisBuild: 'Detailed view for this dimension is not in this build',
    fullAnalysisBelow:
      'The complete analysis \u2014 every claim, citation and source \u2014 is shown below.',
    captions: {
      brief: 'The AI synthesis of this question, and the six orientation answers beneath it.',
      dimension: 'One analytical dimension at a time. Selecting another replaces this view.',
    },
    dimensions: {
      brief: 'Executive brief',
      significance: 'Significance',
      whyThisMatters: 'Why this matters',
      whoIsAffected: 'Who is affected',
      immediateEffects: 'Immediate effects',
      keyFacts: 'Key facts',
      insufficientEvidence: 'Insufficient evidence',
    },
    /* H2C — E-04/E-05/E-06 telemetry cluster. HUD labels, uppercased by CSS. */
    telemetry: {
      evidenceLabel: 'Evidence',
      evidenceAriaPrefix: 'Evidence support',
      segmentsOf: 'of',
      /*
        E-04 word labels. The meter is never colour-only, so the word is
        mandatory. UNRATED is not a low score — it is the absence of a
        rating, and must stay distinguishable from INSUFFICIENT.
      */
      evidenceLevels: {
        strong: 'Strong',
        moderate: 'Moderate',
        limited: 'Limited',
        insufficient: 'Insufficient',
        unrated: 'Unrated',
      },
      trustDetails: 'Evidence details',
      retrievalLabel: 'Retrieval',
      articleForms: ['article', 'articles', 'articles'] as [string, string, string],
      clusterForms: [
        'reporting cluster',
        'reporting clusters',
        'reporting clusters',
      ] as [string, string, string],
      /* Below 1280px the cell renders abbreviations; both still name what they count. */
      articlesShort: 'ART',
      clustersShort: 'CLU',
      across: 'across',
      noArticlesRetrieved: 'No articles retrieved',
      retrievalDetails: 'Retrieval details',
      sourcesLabel: 'Sources',
      noSources: 'No sources',
      openSourcesPanel: 'Open sources panel',
      /*
         R2a - RETRIEVAL AND EVIDENCE-USED ARE TWO DIFFERENT FACTS.
         The sources control previously carried a count that was the
         RETRIEVED article count wearing an evidentiary label. These
         keys let the strip state the two separately. The face text
         says 'used'; the accessible name says what that means. Neither
         may claim independence or corroboration - the contract for
         distinctSourceArticleCount forbids both readings.
      */
      evidenceUsedLabel: 'Evidence used',
      evidenceUsedAria: 'Evidence used: {n} distinct articles are cited across the grounded analysis',
      noEvidenceUsed: 'Not established',
    },
    /* H2C — E-09 hero and E-10 answer grid. */
    brief: {
      aiInterpretation: 'AI interpretation',
      briefLabel: 'AI-generated executive brief',
      /* C907 CORRECTION 3 — E-09's own words for a brief the backend withheld. */
      briefWithheldHeading: 'Executive brief unavailable',
      briefWithheldBody:
        'The brief for this evidence set did not meet the structural requirement and was withheld rather than shown. The answer grid and every cited claim below are unaffected.',
      expand: 'Show full summary',
      collapse: 'Show less',
      generatedPrefix: 'Generated',
      notResolved: 'Not resolved by this analysis',
      opensPrefix: 'Opens',
      answerGridLabel: 'Executive answers',
      cells: {
        whatHappened: 'What happened',
        where: 'Where',
        whyItMatters: 'Why it matters',
        whoIsAffected: 'Who is affected',
        evidence: 'Evidence',
        uncertain: 'Uncertain',
      },
      /* Geographic precision never exceeds the resolution in the payload. */
      precision: {
        city: 'RETRIEVED FOR',
        country: 'RETRIEVED FOR',
        unresolved: 'EVIDENCE LOCATION \u00b7 UNRESOLVED',
      },
      significanceLevels: {
        minor: 'Minor',
        moderate: 'Moderate',
        major: 'Major',
        critical: 'Critical',
      },
      significanceLabel: 'Significance',
      partyForms: ['party', 'parties', 'parties'] as [string, string, string],
      itemForms: ['item', 'items', 'items'] as [string, string, string],
    },
    /* H2C — E-16 claim card and E-17 citation pill. */
    claim: {
      findingPrefix: 'finding',
      findingOf: 'of',
      citedByPrefix: 'Cited by',
      sourceForms: ['source', 'sources', 'sources'] as [string, string, string],
      uncited: 'Uncited',
      /*
        Milestone #32 proves the excerpt was present in the text supplied
        to the model for that source. It does NOT prove the excerpt
        entails the claim, so this label says where the text came from
        and never that the claim is confirmed.
      */
      evidenceBasisLabel: 'Evidence basis from cited source',
      showEvidenceBasis: 'Evidence basis',
      hideEvidenceBasis: 'Hide evidence basis',
      sourcePrefix: 'Source',
      openInSourcesPanel: 'Open in sources panel.',
      unresolvedCitation: 'Unresolved citation',
      partyTypes: {
        person: 'Person',
        organization: 'Organization',
        country: 'Country',
        region: 'Region',
        group: 'Group',
        other: 'Other',
      },
    },
    /* H2C — E-22 sources drawer. */
    sources: {
      title: 'Original sources',
      drawerLabel: 'Original sources',
      close: 'Close sources panel',
      supportsPrefix: 'Supports',
      notCited: 'Not cited in this analysis',
      empty: 'No sources retrieved for this analysis',
      noImage: 'No image available for this source',
      opensInNewTab: 'opens in a new tab',
      retrievedPrefix: 'Retrieved',
    },
    /* H2D — E-13 geographic intelligence. */
    geography: {
      moduleLabel: 'Geographic intelligence',
      precision: {
        city: 'RETRIEVED FOR',
        country: 'RETRIEVED FOR',
        unresolved: 'EVIDENCE LOCATION \u00b7 UNRESOLVED',
      },
      /*
        Two different statements, deliberately. `noResolution` means the
        payload resolved no location at all. `noSubnationalPrecision`
        means a country resolved and nothing finer exists in evidence —
        which is a fact about the evidence, not a missing feature.
      */
      noResolution: 'No geographic resolution in evidence',
      noSubnationalPrecision: 'No subnational precision in evidence',
      resolvedFrom: 'Resolved from',
      mapModule: 'Map module · GNAI world map',
      /*
        Deliberately does not promise to focus this country: nothing
        currently reads the country parameter on the world map, so the
        link opens the map and no more than that.
      */
      openWorldMap: 'Open the world map',
    },
    /* H2D — E-24 context disclosure inside the executive brief. */
    context: {
      heading: 'Context',
      ariaLabel: 'Context, AI interpretation',
      show: 'Context',
      hide: 'Hide context',
    },
    /* H2D — E-25 analytical watch next. Not a follow list; nothing persists. */
    watchNext: {
      heading: 'Watch next',
      qualifier: 'AI-projected · not a forecast',
      showAll: 'Show all',
      showLess: 'Show less',
      hingeTypes: {
        pending_response: 'Pending response',
        scheduled_event: 'Scheduled event',
        announced_action: 'Announced action',
        deadline: 'Deadline',
        forthcoming_report: 'Forthcoming report',
      },
    },
    /* H2D — E-26 sub-view strip. */
    subViews: {
      viewsSuffix: 'views',
      viewOf: 'view',
      reportedFacts: 'Reported facts',
      agreements: 'Where sources agree',
      differences: 'Where sources differ',
      reportedEffects: 'Reported effects',
      spillover: 'Spillover',
      timeline: 'Timeline',
      affectedEntities: 'Affected entities',
      relationships: 'Relationships',
      /*
        Qualifies the SEGMENT, not the claims inside it: projected
        rather than reported, divergent rather than settled.
      */
      divergence: {
        aiProjected: 'AI-projected',
        sourcesDiverge: 'Sources diverge',
      },
      topic: 'Topic',
    },
    /* H2D — E-28 timeline. A list, never a chart. */
    timeline: {
      heading: 'Reported chronology',
    },
    /* H2D — E-29 relationships. Data-gated. */
    relationships: {
      heading: 'Relational evidence',
      eligibility: {
        supported: 'Requested direction supported',
        unsupported: 'Requested direction unsupported',
      },
      sufficiency: {
        adequate: 'Evidence adequate',
        limited: 'Evidence limited',
        insufficient: 'Evidence insufficient',
      },
      buckets: {
        supporting: 'Supports the requested direction',
        reverse: 'Evidence in the reverse direction',
        associationOnly: 'Association only',
        mixed: 'Assessments disagree',
        unclearOrNonSubstantive: 'Unclear or non-substantive',
      },
      unresolvedReferences: 'Some referenced claims could not be resolved',
    },
    /*
      H2D — the complete analysis record. The workspace above is the
      analysis; this discloses the full long-form presentation, which
      still carries the fields no workspace element binds yet.
    */
    classicRecord: {
      show: 'Complete analysis record',
      hide: 'Hide the complete analysis record',
      note: 'Every field of this analysis, including those the workspace does not yet present.',
    },
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
    /*
      The scope when NO country resolved. `countryEvidence` is a fact about the
      article-to-country JOIN; with no join there is no geographic scope to
      assert, and the only evidence in hand is the retrieved article itself.
      This says exactly that and nothing more. It is a LOWER scope than
      country, never a finer one — no city or regional variant exists or may.
    */
    articleEvidence: 'ARTICLE-LEVEL EVIDENCE',
    /*
      The place slot when resolvePrimaryCountry() returned undefined. The
      resolver's 35-point threshold is its statement that the article's own text
      carries no country, so this is a report of that outcome, not a placeholder
      standing in for a value we have. It must never read like a country.
    */
    locationUnresolved: 'Location unresolved',
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
    /*
      C907 CORRECTION 1 — THREE EMPTY STATES, NOT ONE.

      The panel used to render `feedPanelUnavailable*` whenever the stream
      carried no rows, whatever the retrieval had actually done. An empty
      stream over a HEALTHY provider therefore announced a source failure.
      These two additions give the other two outcomes their own words; the
      released `feedPanelUnavailable*` strings below are unchanged and are now
      reserved for the state they were written for.
    */
    /** Retrieval SUCCEEDED and carried no current stories. Never a fault claim. */
    feedPanelEmptyHeading: 'Stream empty',
    feedPanelEmptyBody: 'Retrieval succeeded. No current stories are in this stream right now.',
    /** Sample content is in use, so there is no live stream to be empty or full. */
    feedPanelDemoHeading: 'Demo mode',
    feedPanelDemoBody: 'Sample content is in use. No live stream is being reported here.',
    feedPanelUnavailableHeading: 'Source status',
    feedPanelUnavailableBody: 'Live feed temporarily unavailable.',
    feedPanelUnavailableFooter: 'Search and country intelligence remain accessible.',
    feedPanelSearchStatus: 'Search intelligence',
    feedPanelCountryStatus: 'Country intelligence',
    feedPanelMapStatus: 'Map intelligence',
    feedPanelAvailable: 'Available',
    /*
      STEP 5A - the country-focus vocabulary for the Hero live feed.

      Atomic parts, composed in the component, which is this dictionary's own
      established convention for counted strings (sourceForms, storyForms,
      moduleForms above). There is no placeholder-template mechanism in this
      file and this does not introduce one.

      `feedPanelFocusLive` is the SHORT form and is deliberately separate from
      `feedPanelHeading` ('Live feed'), which stays exactly as released for the
      unqualified global state.
    */
    feedPanelFocusLive: 'Live',
    feedPanelFocusOf: 'of',
    feedPanelFocusStoryForms: ['current story', 'current stories', 'current stories'] as [
      string,
      string,
      string,
    ],
    feedPanelFocusNone: 'No current stories resolve to',
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
    // R4 GDELT - prefixes an OBSERVED timestamp, so an aggregator's
    // index time is never presented as the outlet's publication time.
    seenPrefix: 'Seen',
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
  /*
    R2 — TODAY. A NEW TOP-LEVEL SECTION, DELIBERATELY.

    Today is its own surface, not a variation of the Hero, so its strings get
    their own section rather than being misfiled under `hero`. index.spec.ts
    checks the top-level key list with expect.arrayContaining and checks that
    en and pl carry the SAME top-level keys, so a new sibling section is legal
    in both and a missing Polish one is a compile error.

    Counted strings are ATOMIC PARTS composed in the component through the
    shared pluralWithForms(), which is this dictionary's own established
    convention (sourceForms, storyForms, moduleForms above). No placeholder
    template mechanism is introduced.
  */
  /* R7 — the shared PresentationRibbon vocabulary. The component owns these
     labels; no caller may relabel a step (spec 10 §1.1). Polish forms are
     quoted from R7 §17's own expansion table, not translated afresh. */
  /* R5.9 / R7 — the Today workspace regions. */
  todayWorkspace: {
    geography: {
      /* DESIGN-C2 LOCK 8 — restored: the retrieval-context and browsing
         classes the accepted authority requires on this surface. */
      retrievalContext: 'IN THIS RETRIEVAL: {n} COUNTRIES',
      viewing: 'VIEWING: {country}',
      regionLabel: 'GEOGRAPHY',
      countryLevel: 'COUNTRY-LEVEL',
      /* The canvas is an INDEX, not a projection. Stated, never inferred. */
      schematicIndex: 'SCHEMATIC INDEX \u00b7 NOT COORDINATES',
      /* R4 correction 1 — the canvas is a real map now, so the caption states
         the PRECISION rather than denying coordinates. Country outlines are
         real geography; nothing finer than a country is drawn or implied. */
      countryOutlines: 'COUNTRY OUTLINES \u00b7 NO FINER THAN COUNTRY',
      countryPrecision: 'COUNTRY',
      openWorldMap: 'OPEN WORLD MAP',
      worldMapCompact: 'WORLD MAP',
      noneResolved: 'No country resolved in this retrieval',
      unresolvedLabel: 'No country resolved',
      unresolvedNote: 'Absence means we do not know, never that the story is nowhere.',
    },
    /* R7 `08 §2` — the header track. Every counter states what WE retrieved.
       None of them claims completeness, and the bias note travels WITH them
       rather than hiding in a tooltip. */
    header: {
      regionLabel: 'TODAY',
      question: 'What did GlobalNews AI first observe today?',
      retrievedLabel: 'RETRIEVED',
      countriesLabel: 'COUNTRIES',
      unresolvedLabel: 'NO COUNTRY',
      watchingLabel: 'WATCHING',
      newLabel: 'NEW',
      biasNote: 'These counts describe this retrieval, not everything that happened.',
      collapse: 'Collapse the Today header',
      expand: 'Expand the Today header',
    },
    /* R7 `02` — ANALYSE, the principal internal scroll surface. */
    analyse: {
      regionLabel: 'ANALYSE',
      chipUnresolved: 'NO COUNTRY',
      firstSeen: 'FIRST SEEN',
      expandRow: 'Expand this record',
      collapseRow: 'Collapse this record',
      /* THE EXPLICIT ROW ACTION. A verb, not a glyph: the chevron discloses,
         this one leaves for the analysis workspace on this story. */
      analyse: 'ANALYSE',
      analyseStory: 'Analyse this story',
      /* ② WHERE — its basis, in words. Country precision, and it stops there:
         a single record cannot corroborate itself, so no n-of-m is printed. */
      resolvedToCountry: 'Resolved to country from the article text',
      whereUnresolved: 'No country resolved',
      unresolvedNotPlaced: 'Absence means we do not know, never that the story is nowhere.',
      empty:
        'This retrieval contains no article GlobalNews AI saw for the first time today. That is a statement about our retrieval, not about the world.',
      filteredEmpty: 'Nothing retrieved for this country today.',
      clearFilter: 'Clear country filter',
    },
    /* R7 `03` — WATCH. The zero wording is the R4-approved sentence, verbatim,
       so the two surfaces can never say different things about the same fact. */
    watch: {
      regionLabel: 'WATCH',
      /* The follow list is READ on mount. Until that read returns we know
         nothing about this visitor, so we say so rather than rendering the
         signed-in empty state and asserting they follow nothing. */
      loading: 'Reading your followed countries\u2026',
      markAllSeen: 'MARK ALL AS SEEN',
      newTag: 'NEW',
      zeroRetrieved: 'Nothing retrieved for this country today.',
      /* R1/T2 — the missed-since basis, from `POST /users/me/seen`. No device
         caveat, because the boundary is the server's own `User.lastSeenAt`
         rather than a clock held in one browser. */
      missedSince: 'first observed since your last visit',
      nothingSince: 'Nothing first observed since your last visit',
      /* THE HONEST FALLBACK, used wherever no interval can be established —
         a first-ever visit, or a refused return-state request. It names what
         IS on show and claims nothing about what was missed. */
      followedHeading: 'Today\u2019s intelligence from the countries you follow',
      signIn: 'Sign in',
      /* The signed-out column: one line saying what an account gives, beside
         the released sign-in path. No count, and no interval claim. */
      anonymousCompact: 'Sign in to follow countries and see what you missed.',
      anonymous:
        'Following a country needs an account. Sign in and Watch will show what GlobalNews AI first observes there.',
      empty:
        'Follow a country and Watch will show what GlobalNews AI first observes there.',
    },
    /* R7 `05` — the sources dock. A Today record IS one retrieved article, so
       the dock says RETRIEVED ARTICLES and never SOURCES: the count is not a
       corroboration count and must never be read as one. */
    dock: {
      label: 'RETRIEVED ARTICLES',
      expand: 'Show the retrieved articles',
      collapse: 'Hide the retrieved articles',
      openOriginal: 'OPEN ORIGINAL',
      retrievalNote:
        'One retrieved article. A retrieval count is not corroboration.',
      noneSelected: 'Open a record to see the article it was retrieved from.',
    },
    /* R7 `07` — the Workspace CTA, and the tab model below the S breakpoint. */
    cta: {
      open: 'OPEN ANALYSIS WORKSPACE',
      description: 'Ask a question and run a full analysis.',
    },
    tabs: {
      label: 'Today regions',
      analyse: 'ANALYSE',
      geography: 'GEOGRAPHY',
      watch: 'WATCH',
    },
  },
  presentationRibbon: {
    labels: {
      what: 'WHAT HAPPENED',
      where: 'WHERE',
      why: 'WHY IT MATTERS',
      who: 'WHO IS AFFECTED',
      evidence: 'EVIDENCE',
    },
    viewSources: 'VIEW SOURCES',
    showSources: 'SHOW ORIGINAL SOURCES',
    deepAnalysis: 'DEEP ANALYSIS',
    /* Spec 10 §8, verbatim. */
    unavailable: '\u2014 not available in this analysis',
    evidenceSupport: 'Evidence support',
    ofThree: 'of 3',
  },
  today: {
    eyebrow: 'Today',
    heading: 'Today\u2019s Intelligence',
    /* The 3-second answer. Design 08 §1: first in the DOM, text, counts only. */
    summaryAcross: 'across',
    summaryUnresolvedSuffix: 'with no country resolved',
    recordForms: ['article first observed today', 'articles first observed today', 'articles first observed today'] as [string, string, string],
    countryForms: ['country', 'countries', 'countries'] as [string, string, string],
    /* Retrieval-qualified counter labels (CTO decision D4). */
    counterRecordsLabel: 'Articles GlobalNews AI first saw today, in this retrieval',
    counterCountriesLabel: 'Countries represented in this retrieval',
    biasNote:
      'These counts reflect what GlobalNews AI retrieved, not everything that happened.',
    /* R-34 contract footer. Every field name is localized; values are real. */
    contractMetricLabel: 'Metric',
    contractMetricValue: 'articles first observed',
    contractUnitLabel: 'Unit',
    contractUnitValue: 'absolute count',
    contractGeographyLabel: 'Geography',
    contractGeographyValue: 'country',
    contractPeriodLabel: 'Period',
    contractBasisLabel: 'Basis',
    contractBasisValue: 'retrieved articles in this response',
    contractUpdatedLabel: 'Updated',
    contractCoverageLabel: 'Coverage',
    contractCoverageValue: 'not assessed',
    /* Geographic intelligence — country list. */
    /* R2.1 C5 — the compact geographic summary above the cards. Nominative
       count forms, distinct from countryForms, which the 3-second answer uses
       inside 'across N countries' and which Polish renders in the locative. */
    countryCountForms: ['country', 'countries', 'countries'] as [string, string, string],
    unresolvedShort: 'unresolved',
    geoSummaryLink: 'Go to the country breakdown',
    geoSectionLabel: 'Country breakdown',
    geoValuesToggleAria: 'Show the values behind this list',
    geoHeading: 'Countries in this retrieval',
    geoQuestion: 'Where are the articles we first saw today from?',
    filterAll: 'All countries',
    unresolvedLabel: 'No country resolved',
    unresolvedNote: 'Absence means we do not know, never that the story is nowhere.',
    openWorldMap: 'Open the World Map',
    showValues: 'Show values',
    hideValues: 'Hide values',
    tableCaption: 'Articles first observed today, by country',
    tableCountryHeading: 'Country',
    tableCountHeading: 'Articles',
    /* Card. */
    firstSeenLabel: 'First seen',
    publishedLabel: 'Published',
    publishedProviderNote: 'provider-reported',
    analyse: 'Analyse',
    analyseAriaPrefix: 'Analyse this story:',
    readStoryPrefix: 'Read the full story:',
    /* R4 \u2014 WATCH. Every string says what WE retrieved, never what happened.
       There is no alert, no "since your last visit", no forecast, and none of
       the six information-state words anywhere in this vocabulary. */
    watchHeading: 'Watch',
    watchQuestion: 'What did GlobalNews AI first observe today in the countries you follow?',
    watchReading: 'Reading your followed countries\u2026',
    watchAnonymous:
      'Following a country needs an account. Sign in and Watch will show what GlobalNews AI first observes there.',
    watchSignIn: 'Sign in',
    watchNoFollows:
      'Follow a country and Watch will show what GlobalNews AI first observes there. The follow control sits beside every country in the list below.',
    watchFollowedForms: ['country followed', 'countries followed', 'countries followed'] as [string, string, string],
    watchCapacityOf: 'of a maximum of',
    /* THE APPROVED ZERO WORDING, EXACTLY. Never \u2018nothing happened\u2019. */
    watchZeroRecords: 'Nothing retrieved for this country today.',
    watchAtLimit:
      'You are following as many countries as an account may follow. Unfollow one to add another.',
    watchUnresolvedNote:
      'of today\u2019s records could not be attributed to any country, so they cannot appear here.',
    watchNothingRetrieved:
      'This retrieval reached none of your countries today. That is a statement about our retrieval, not about those countries.',
    watchFollow: 'Follow',
    watchFollowing: 'Following',
    watchUnfollow: 'Unfollow',
    watchPending: 'Saving\u2026',
    watchFailed: 'Not saved',
    watchFollowAria: 'Follow',
    watchUnfollowAria: 'Stop following',
    /* Honest states. */
    emptyHeading: 'Nothing first observed today',
    emptyBody:
      'This retrieval contains no article GlobalNews AI saw for the first time today. That is a statement about our retrieval, not about the world.',
    degradedHeading: 'No first-observation record',
    degradedBody:
      'GlobalNews AI has not recorded a first observation for the articles in this retrieval, so today cannot be established for them. The articles themselves remain available above.',
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

    /*
      ── C3 · WAS A HARD-CODED ENGLISH SENTENCE IN THE COMPONENT ───────────
      HomepageSituationMap carried this string inline, so a Polish reader who
      selected a country was answered in English. Restoring the card to Home
      makes that reachable again, so it becomes a governed key like every
      other string on the surface.
    */
    selectionScopeNote:
      'Selection changes geographic scope only. Open the full map to inspect retained evidence or explicitly request country intelligence.',

    /*
      ── C3 · THE LEGEND ──────────────────────────────────────────────────
      The four legend entries are NOT map layers. This product's map
      vocabulary is country coverage, and its governed news taxonomy is
      world/politics/business/technology/science/health/sports/entertainment
      — none of which is Energy, Conflict, Humanitarian or Economy. Those
      four are INTELLIGENCE MODULE ids, so each legend entry links to its
      real module surface and the map itself draws no marks for them. That
      is the only reading of "must map to real layers" that does not invent
      a layer, and it is why no dot, count or severity is rendered.
    */
    /* situationMap.legendLabels — the four conceptual categories, named as the
       Product Owner prototype names them. The module registry's titles are
       "Energy Intelligence", "Conflict Intelligence" and so on, which is right
       inside the Engine and wrong in a four-entry legend under a 150px map.
       THE LABEL NAMES THE CATEGORY; the registry still owns the entry, its
       colour and whether it resolves anywhere. */
    legendLabels: { energy: 'Energy', conflict: 'Conflict', humanitarian: 'Humanitarian', economy: 'Economy' } as Record<string, string>,
    legendTitle: 'Intelligence layers',
    legendNote: 'Each opens its module. The map itself shows country coverage only.',
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
      Help: 'Help',
    } as Record<string, string>,
    /*
      SUPPORT CLOSURE — the footer renders every group FLATTENED into ONE row,
      so once a Help destination sits beside the legal ones its accessible name
      can no longer be "Legal". CTO decision D-4 A required a concise EXISTING
      localized string and forbade a new key; this is the narrowly approved
      exception to that, and nothing else about D-4 A moves — still concise,
      still localized, still genuinely translated, and the footer's geometry
      and visible copy are untouched.
    */
    navigationAriaLabel: 'Footer links',
    linkLabels: {
      '/support': 'Help & Support',
      '/about': 'About',
      '/careers': 'Careers',
      '/contact': 'Contact',
      '/privacy': 'Privacy Policy',
      '/terms': 'Terms of Service',
      '/source-policy': 'Source Policy',
      '/third-party-notices': 'Third-Party Notices',
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
    /*
      R4 HEADER ACCOUNT PRIVACY — THE CLOSED PUBLIC HEADER IS NEUTRAL.
      `account` is what an authenticated visitor sees in the navbar at all
      times. It is a CONSTANT, not a rendering of the account: never the
      email, never its local part, never initials, and deliberately not the
      display name either, so that a future backend populating displayName
      cannot silently turn the public header into a real-name disclosure
      surface. `signedInAs` heads the identity row that appears only inside
      the OPENED control, where the caller may see their OWN address.
      `accountMenuAriaLabel` names the trigger for assistive technology.
    */
    account: 'Account',
    accountMenuAriaLabel: 'Account menu',
    signedInAs: 'Signed in as',
    // Milestone #57 — Optional Accounts. Only rendered once a real
    // session exists (see AccountControl.tsx) — a signed-out visitor
    // never sees any of these three.
    /*
      SUPPORT CLOSURE — TWO ENTRIES, TWO AUDIENCES, DELIBERATELY DISTINCT.
      `help` is the PUBLIC affordance in the header rail, mobile menu and
      footer: anyone, signed in or not, looking for a way to get help.
      `support` is the SIGNED-IN account-menu entry to the caller's own
      correspondence, and stays exactly as it was. Both resolve to /support,
      which serves the public explanation when signed out and the person's own
      threads when signed in.
    */
    help: 'Help',
    history: 'History',
    support: 'Support',
    /*
      ACCOUNT DESTRUCTIVE-ACTION SAFETY. The quick account menu's fourth entry
      used to be the DESTRUCTIVE "Delete Account" action, one click away from
      Sign Out. It is now this NAVIGATIONAL entry to /account/settings, where
      deletion lives behind a typed confirmation. `deleteAccount` and
      `deleteAccountConfirm` below are unchanged and keep their single source
      of truth (accountDeletionCopy.spec still guards them) — they are
      simply consumed by that settings surface now instead of by the header.
    */
    settings: 'Settings',
    signOut: 'Sign Out',
    deleteAccount: 'Delete Account',
    deleteAccountConfirm:
      'Delete your account? This permanently deletes your account and its data \u2014 your saved history, your followed countries, your support requests and their messages, and your active sessions. This cannot be undone.',
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
    /*
      ── A MAP CLICK SELECTS. IT HAS NOT LOADED ANYTHING SINCE THE QUOTA FIX ──

      `MAIN-COUNTRY-READER-RETRIEVAL-CONTRACT-R1` §7.1 names `tooltipLoadAction`
      as false, and it is: *"Click to load live news coverage for this
      country"* promises retrieval from a click, and `MAP-GNEWS-QUOTA-REGRESSION-1`
      removed retrieval from selection entirely. It also promised "live"
      before any request had been made.

      REPORTED, AND CORRECTED TOO: §7.1 rules `tooltipRefreshAction` still
      truthful because it *"describes a country that already has a response"*.
      Its STATE description is fine; its VERB is not. It said *"Click to
      refresh"*, and a click does not refresh in either variant — the same
      false promise in the other branch. `explored` is `knownStoryCount !==
      null`, which means a RETAINED count exists, not that the reader loaded
      anything, so the branch does not even mean what the sentence assumed.

      Both now say what a click does, and point at where loading actually
      lives. The two badges above — LOADED / READY — are state labels, not
      action promises, and are left exactly as §7.1 leaves them.
    */
    tooltipRefreshAction: 'Click to select this country. Retrieving its intelligence is a separate action in the panel.',
    tooltipLoadAction: 'Click to select this country. Nothing is retrieved until you ask for it in the panel.',
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
      analyseCountry: 'Analyse this country',
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
    shell: {
      regionLabel: 'World map',
      canvasLabel: 'Interactive world map',
      controlsLabel: 'Map camera controls',
      /* D1 §3d — the lower-left cluster. Three distinct controls, three keys:
         a shared label would be the merge the specification forbids. */
      lowerLeftControlsLabel: 'Map controls',
      globeLocator: 'Global camera position',
      goGlobal: 'Return to the global view',
      layersTitle: 'Layers',
      threeD: '3D view',
      threeDUnavailable: 'No terrain source is configured for this deployment',
      /* R2-B §8 — on, but the 10° grid may place no line in this viewport. */
      layerOutOfScale: 'Not at this scale',
      layerStatusLive: 'Available',
      layerStatusGated: 'Not yet available',
      layerStatusNotImplemented: 'Not built',
      layerStatusUnmeasured: 'Unverified',
      interactionHint:
        'Drag or use the arrow keys to pan. Scroll, pinch, or press plus and minus to zoom. Press 0 to reset to the world view, or Backspace to return to the previous view.',
      resetWorld: 'Reset world',
      previousView: 'Previous view',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      precisionCountry: 'Country level',
      precisionUnresolved: 'No location resolved',
    },
    spatial: {
      /*
        CC BY 4.0 REQUIRES THIS WHEREVER THE DATA IS PRESENTED. G's §8 supplies
        the string; it is reproduced rather than paraphrased, because a licence
        notice that has been reworded is not the notice the licence asked for.

        ── R2-B §9 — THE URI WAS MISSING, AND THE COMMENT ABOVE SAID WHY THAT
           MATTERED ──────────────────────────────────────────────────────────

        Compared against the publisher's own string, fetched from the deployed
        backend while classifying the licences:

            published   "... licensed CC BY 4.0
                         (https://creativecommons.org/licenses/by/4.0/).
                         Subdivision data from iso3166-2-db (MIT)."
            rendered    "... licensed CC BY 4.0. Subdivision data from
                         iso3166-2-db (MIT). ..."

        CC BY 4.0 §3(a)(1)(v) asks for "a URI or hyperlink to the Public
        License to the extent reasonably practicable", and dropping it is
        exactly the rewording this comment already forbade. Restored verbatim.

        The Natural Earth sentence is an ADDITION to G's string, not an edit of
        it: Natural Earth is public domain and owes no notice, and naming it is
        courtesy rather than compliance.
      */
      attribution:
        'Contains data from the GeoNames geographical database, licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Subdivision data from iso3166-2-db (MIT). Base geography: Natural Earth, public domain.',
      railLabel: 'Intelligence panel',
      resetEvidence: 'Reset evidence',
      /*
        ── MAIN-CONFLICT-D1-DOMAIN-BIND-R1 §6 · THE THREE STRINGS THE BIND OWES ─

        The bind refuses to invent copy: a `lib/` module writing its own English
        would be a second copy authority with no Polish half. So the three
        labels live here, beside every other string this surface speaks.

        `holdingLabel` IS A RESULT, NEVER AN EMPTY STATE. Shared Specialist
        Addendum §15, and `attentionQueue.ts` fixes `emptyIsResult: true` so a
        domain cannot configure it back. "Nothing yet" would turn the product's
        paid output into an absence; what the reader bought is the checking.

        `orderedBy` MUST NOT NAME A RANKING RULE THE PRODUCT DID NOT APPLY.
        `MAIN-CONFLICT-RUNTIME-CONTRACT-R1` refused MCR-15 (`attentionRank`) —
        no producer exists — so this says that no upstream ordering ran. Naming
        "severity, then change recency" here would cite a rule nothing executed,
        which is precisely the claim §6 forbids.
      */
      conflictQueue: {
        headerLabel: 'Conflict attention',
        holdingLabel: 'Checked. Nothing meets the attention threshold.',
        orderedBy: 'Not ordered — no upstream ranking has run for this domain.',
      },
      topBar: {
        brand: 'GlobalNews AI',
        brandSub: 'Spatial intelligence',
        brandHome: 'back to GlobalNews AI',
        languageGroup: 'Language',
        periodGroup: 'Time period',
        periods: { NOW: 'Now', '24H': '24h', '7D': '7d', '30D': '30d' },
      },
      modes: {
        group: 'Map mode',
        modes: {
          WORLD: 'World',
          EVIDENCE: 'Evidence',
          SITUATIONS: 'Situations',
          WATCH: 'Watch',
          CHANGE: 'Change',
          SOURCES: 'Sources',
        },
        unavailable: 'Unavailable',
        /*
          CHECKPOINT E — FIVE REASONS, BECAUSE THEY ARE NOT INTERCHANGEABLE.

          Four modes shared one word for four different situations, which told a
          reader a capability was absent while saying nothing about whether it
          was coming, broken, empty here, or gated.

          NOT_CONNECTED is the honest word for Watch, Change and Sources:
          Watchboard, ChangeStrip and SourceCard all render elsewhere on this
          very screen, so calling them "not built" would be FALSER than the
          generic word it replaces.
        */
        unavailableReasons: {
          NOT_BUILT: 'Not built yet',
          NOT_CONNECTED: 'Built, but not connected to the map yet',
          NO_DATA_FOR_GEOGRAPHY: 'No data for this geography',
          TIER_RESTRICTED: 'Not included in your access',
          TEMPORARILY_UNAVAILABLE: 'Temporarily unavailable',
        },
        beta: 'Beta',
      },
      layers: {
        group: 'Map layers',
        reference: 'Reference',
        evidence: 'Evidence',
        /*
          CHECKPOINT E-3 — RETAINED AS A FALLBACK, NO LONGER THE ANSWER.

          Every unavailable layer used to render this one phrase, which is the
          exact collapse the ruling names. It now applies only to a layer whose
          runtime status says nothing more specific.
        */
        unavailable: 'No data yet',
        /* Derived from each layer's own runtime evidence — see layerUnavailableReason(). */
        unavailableReasons: {
          NOT_BUILT: 'Not built yet',
          NOT_CONNECTED: 'Built, but not connected to the map yet',
          NO_DATA_FOR_GEOGRAPHY: 'No data for this geography',
          TIER_RESTRICTED: 'Not included in your access',
          TEMPORARILY_UNAVAILABLE: 'Temporarily unavailable',
        },
        /*
          NOT an unavailability. The layer is built and works; this mode simply
          does not draw it. Saying "not built" here would be untrue.
        */
        notInMode: 'Not shown in this mode',
        outOfRange: 'Not at this zoom',
        codes: {
          countryEvidence: 'EVID',
          evidencePoints: 'PTS',
          sourceDensity: 'SRC',
          watch: 'WATCH',
          situations: 'SITU',
          hydrography: 'WATER',
          rivers: 'RIVER',
          labels: 'LABEL',
          graticule: 'GRID',
          base: 'LAND',
          admin0: 'ADM0',
          admin1: 'ADM1',
          admin2: 'ADM2',
          places: 'CITY',
        },
        layers: {
          base: 'Land & ocean',
          admin0: 'Country borders',
          hydrography: 'Lakes & seas',
          rivers: 'Rivers',
          places: 'Cities',
          labels: 'Labels',
          graticule: 'Graticule',
          countryEvidence: 'Country evidence',
          evidencePoints: 'Evidence points',
          watch: 'Watched places',
          sourceDensity: 'Source density',
          situations: 'Situations',
          admin1: 'Provinces',
          admin2: 'Districts',
        },
      },
      /*
        MAP LABEL COPY. Continents and oceans are not in the shared country
        registry — country names come from `getLocalizedCountryName`, so they
        are NOT duplicated here and cannot drift from the registry.
      */
      continents: {
        africa: 'Africa', europe: 'Europe', asia: 'Asia',
        northAmerica: 'North America', southAmerica: 'South America', oceania: 'Oceania',
      },
      waters: {
        atlantic: 'Atlantic Ocean', pacific: 'Pacific Ocean', indian: 'Indian Ocean',
        arctic: 'Arctic Ocean', southernOcean: 'Southern Ocean',
        mediterranean: 'Mediterranean Sea', baltic: 'Baltic Sea', redSea: 'Red Sea',
        blackSea: 'Black Sea', caribbean: 'Caribbean Sea', northSea: 'North Sea',
        gulfOfGuinea: 'Gulf of Guinea', arabianSea: 'Arabian Sea',
        bayOfBengal: 'Bay of Bengal', southChinaSea: 'South China Sea',
      },
      territories: { greenland: 'Greenland' },
      readout: {
        zoom: 'Z',
        centre: 'CTR',
        mode: 'MODE',
        modes: {
          WORLD: 'WORLD', EVIDENCE: 'EVIDENCE', SITUATIONS: 'SITUATIONS',
          WATCH: 'WATCH', CHANGE: 'CHANGE', SOURCES: 'SOURCES',
        },
        periods: { NOW: 'NOW', '24H': '24H', '7D': '7D', '30D': '30D' },
      },
      legend: {
        heading: 'Evidence grammar',
        collapse: 'Collapse legend',
        expand: 'Expand legend',
        entries: {
          verified: 'Verified evidence',
          attention: 'Attention & change',
          interpreted: 'Interpreted or contested',
          none: 'No retained evidence',
          reference: 'Reference geography',
        },
      },
      search: {
        label: 'Search for a place',
        placeholder: 'Search places, cities and regions',
        resultsLabel: 'Search results',
        noResults: 'No place matches that name',
        coverageNote: 'Regions, countries, provinces, districts and cities',
        searching: 'Searching the gazetteer\u2026',
        reference: 'Reference',
        reports: 'reports',
        inCountry: 'in',
        kinds: {
          COUNTRY: 'Country',
          REGION: 'Region',
          CITY: 'City',
          WATER: 'Water',
          SITUATION: 'Situation',
        },
      },
      breadcrumbs: {
        group: 'Scale and jump targets',
        scaleLabel: 'Current map scale',
        jumpsLabel: 'Jump to a region',
        rungs: {
          WORLD: 'World',
          CONTINENT: 'Continent',
          SUBREGION: 'Subregion',
          COUNTRY: 'Country',
          CITY: 'City',
        },
        targets: {
          world: 'World',
          africa: 'Africa',
          eastAfrica: 'East Africa',
          europe: 'Europe',
          rwanda: 'Rwanda',
          kenya: 'Kenya',
          poland: 'Poland',
          kigali: 'Kigali',
        },
      },
      /*
        THE TRUST BANNER. Part I \u00a7G gives these almost verbatim: "Country
        level is the evidence ceiling, City level \u2014 location interpreted,
        unverified, Province level \u2014 sources contested, No resolvable
        location \u2014 interpreted, Reference geography ceiling reached."
      */
      banner: {
        levels: {
          EXACT: 'Exact location',
          CITY: 'City level',
          SECTOR: 'Sector level',
          DISTRICT: 'District level',
          PROVINCE: 'Province level',
          COUNTRY: 'Country level',
          REGION: 'Regional level',
          UNKNOWN: 'No resolvable location',
          NONE: 'No evidence shown',
        },
        interpreted: 'location interpreted, unverified',
        contested: 'sources contested',
        referencePrefix: 'Reference geography ceiling:',
        governingRule: 'Zoom reveals more world. It never reveals more evidence.',
        coarserThanEvidence: 'drawn coarser than the record',
      },
      callout: {
        close: 'Dismiss this callout',
        actionUnavailable: 'Not wired on this surface yet',
        focus: 'Focus',
        analysis: 'Analysis',
        sources: 'Sources',
      },
      card: {
        heading: 'Selected geography',
        scope: 'Evidence',
        watching: 'Watching',
        stateHeading: 'Evidence state',
        ceilingNote: 'This is the level the evidence asserts. Anything finer on the map is reference geography.',
        reports: 'Reports',
        sources: 'Sources',
        newSince: 'New since last visit',
        precisionLabel: 'Precision',
        provenanceLabel: 'Location provenance',
        provenanceValues: {
          STATED: 'Stated by the source',
          INTERPRETED: 'Interpreted \u2014 unverified',
          CONTESTED: 'Contested between sources',
        },
        /*
          THE COUNTRY REGISTRY'S FIVE GROUPINGS — MAP-DISPLAY-NAME-CENTRALISATION.

          Keyed by the registry's own English values, because that is what
          arrives on `identity.region`. `KEN · AFRICA` rendered that value raw
          in every language.

          DELIBERATELY NOT `map.spatial.continents`, which already exists one
          level up and is a DIFFERENT SET: that block is canvas LABEL copy keyed
          `africa / northAmerica / southAmerica / …` — six landmasses, with the
          Americas split the way a map draws them. The registry groups countries
          into five and keeps the Americas together, so a lookup against the
          label block would miss `Americas` and render the English through the
          gap.

          Part I §E block 01: this is NOT a REGION-precision record, which is
          why it is not folded into `levels` below.
        */
        continents: {
          Americas: 'Americas',
          Europe: 'Europe',
          Asia: 'Asia',
          Africa: 'Africa',
          Oceania: 'Oceania',
        },
        levels: {
          EXACT: 'Exact location',
          CITY: 'City',
          SECTOR: 'Sector',
          DISTRICT: 'District',
          PROVINCE: 'Province',
          COUNTRY: 'Country',
          REGION: 'Supranational region',
          UNKNOWN: 'Unresolved',
          NONE: 'None',
        },
        verifiedReports: 'Verified reports',
        unverifiedQualifier: 'some unverified',
        noEvidenceTitle: 'No retained evidence for this area',
        noEvidenceBody: 'Nothing has been retained here in the selected period:',
        widenPeriod: 'Widen the period',
        periods: {
          NOW: 'the last hour',
          '24H': 'the last 24 hours',
          '7D': 'the last 7 days',
          '30D': 'the last 30 days',
        },
        drawnCoarser:
          'This record asserts a finer location than the map can currently draw \u2014 province and district geography is not yet loaded.',
        actions: {
          focus: 'Focus evidence',
          follow: 'Follow',
          unfollow: 'Unfollow',
          openAnalysis: 'Open analysis',
          openSources: 'Open sources',
        },
        /*
          ── THE EXPLICIT COUNTRY READ · PHASE G's REQUIRED SEMANTICS ───────

          The ruling names the split these strings have to carry:

              map / search action  = SELECT a country
              explicit control     = LOAD country intelligence

          So not one of these words is "click", and not one of them promises
          "live" anything before a request has been made. The map's own tooltip
          keeps that promise separately; what this block owes is the other half
          — naming the action that actually costs something.

          `notLoaded` REPLACES THE FALSE SENTENCE IN SPIRIT, IN THE RIGHT
          COMPONENT. Main §7.2 reports that the legacy panel's `!response`
          branch tells a reader to *"select one on the map"* in a slot only
          reachable once they HAVE selected one. The modern card must not
          repeat it: this says the country is selected and that nothing has
          been retrieved yet, which is what is true.

          `noCoverage` IS A RESULT. "Checked" is the word doing the work — it
          says a request was made and answered. Anything shaped like "no news"
          would state something about the world that an empty provider response
          is not evidence for.

          `failed` IS THE ONLY SENTENCE ANY FAILURE PRODUCES — a 502, a
          timeout, an abort and a rate-limit are one sentence to a reader. The
          class, the status and the message go to telemetry.
        */
        countryRead: {
          heading: 'Country intelligence',
          notLoaded: 'This country is selected. Nothing has been retrieved yet.',
          loading: 'Retrieving current reporting for this country…',
          noCoverage: 'Checked. No verified reporting for this country in this period.',
          failed: 'Could not retrieve reporting just now. You can try again.',
          load: 'Load country intelligence',
          reload: 'Retrieve again',
        },
        /* ── DESIGN REVISION 1.2 · THE RESTORED SELECTED-COUNTRY BLOCKS ─── */
        identityHeading: 'Identity',
        provider: {
          live: 'Live feed',
          delayed: 'Delayed feed',
          none: 'No provider configured',
          stored: 'stored reporting',
        },
        coverage: {
          heading: 'Coverage',
          bands: {
            STRONG: 'Strong coverage',
            MODERATE: 'Moderate coverage',
            THIN: 'Thin coverage',
            NONE: 'No coverage',
          },
          flags: { AGING: 'Aging', STALE: 'Stale' },
          publishers: 'publishers',
          newest: 'newest',
          seenPrefix: 'seen',
          publishedPrefix: 'published',
        },
        categoriesHeading: 'Categories',
        allCategories: 'All categories',
        categories: {
          world: 'World',
          politics: 'Politics',
          business: 'Business',
          technology: 'Technology',
          science: 'Science',
          health: 'Health',
          sports: 'Sport',
          entertainment: 'Culture',
        },
        situationsHeading: 'Situations',
        situationsUnavailable:
          'The situation model is not built yet, so this is not \u201cno situations here\u201d \u2014 it is a capability that cannot answer the question.',
        retainedHeading: 'Retained reporting',
        retainedFilteredEmpty: 'No retained reporting in the selected categories.',
        openSource: 'Open source in a new tab',
        askAbout: 'Ask GlobalNews AI about this',
        /*
          CHECKPOINT D — THE VISIBLE NAME OF THE AI ACTION.

          `askAbout` is the ACCESSIBLE name and stays exactly as it was. This is
          the name a SIGHTED reader sees, which until now was a bare magnifier
          glyph. /search auto-executes POST /analysis/news on arrival, so this
          control is the decision point at which model compute is spent, and it
          has to say so on the surface rather than only to a screen reader.

          Deliberately NOT "paid": the monetization contract is still under
          review, and naming a price the product has not agreed would be a
          different kind of untruth.
        */
        askAiShort: 'Ask AI',
        topicsHeading: 'Topics',
        clearSelection: 'Clear selection',
        follow: {
          follow: 'Follow this country',
          watching: 'Watching',
          stopWatching: 'Stop watching',
          pending: 'Saving\u2026',
          failed: 'Follow not saved \u2014 nothing changed',
          signIn: 'Sign in to follow',
        },
      },
      mobile: {
        shellLabel: 'World map and place intelligence',
        mapLabel: 'World map. Drag to pan, pinch to zoom, tap a country to select it.',
        mapHint: 'Drag to pan the map. Pinch to zoom. Tap a country to select it.',
        sheetLabel: 'Place intelligence',
        handleLabel: 'Resize the intelligence sheet',
        stops: { PEEK: 'Peek', HALF: 'Half', FULL: 'Full' },
        noSelection: 'Search for a place above, or tap a country on the map, to see what is retained there.',
        clearSelection: 'Clear selection',
        searchAlternative: 'You can also find a country by typing its name in the search field above; the map is not the only way to reach one.',
        a11yNote: 'An interactive world map fills this screen. Drag to pan, pinch to zoom, and tap a country to select it. You do not need to use it \u2014 the search field finds and selects any supported country by name, with full keyboard support.',
      },
      /*
        PART IV — MONETIZATION LAYERING. THE COPY IS PART OF THE CONTRACT.

        Two strings here are specified rather than merely translated:

        `activation.assignmentSentence` is §12.4's own sentence, and the
        specification says "the sentence IS the specification. Implementation
        must not paraphrase it into feature language." It describes LABOUR —
        assess, tell you — and names no article, no reading, no access and no
        limit. The frame is carried per language so translation keeps that
        shape; only the subjects and the cadence are filled in.

        The Watch verb is likewise fixed. Never "subscribe", never "upgrade",
        never "unlock" — the user is buying work, not entry.
      */
      monetization: {
        watch: {
          glyph: 'Watch this subject',
          watch: 'Watch',
          description:
            'Continuously assess this subject and tell you when the assessment materially changes.',
        },
        composer: {
          title: 'Watch composer',
          scope: 'Scope',
          ceiling: 'This link\u2019s own precision ceiling',
          topics: 'Monitored topics',
          topicOptions: {
            supply: 'Supply',
            pricing: 'Pricing',
            logistics: 'Logistics',
            policy: 'Policy',
            security: 'Security',
            infrastructure: 'Infrastructure',
          },
          sensitivity: 'Alert sensitivity',
          sensitivities: {
            CRITICAL_ONLY: 'Critical only',
            MATERIAL_ONLY: 'Material changes only',
            ALL_MEANINGFUL: 'All meaningful changes',
            CUSTOM_THRESHOLD: 'Custom threshold',
          },
          sensitivityHint: {
            CRITICAL_ONLY: 'Severity-critical transitions only.',
            MATERIAL_ONLY: 'Significant change only. The default.',
            ALL_MEANINGFUL: 'Also new evidence, developing situations and disputes.',
            CUSTOM_THRESHOLD: 'Set your own thresholds.',
          },
          runRecord: 'Run record',
          lastChecked: 'Last checked',
          lastChange: 'Last material change',
          cadence: 'Cadence',
          evidence: 'Evidence',
          neverRun: '\u2014',
          degradedNote:
            'This watch has never run, so it has no record yet. A watch that cannot say when it last ran is shown as incomplete rather than as confident.',
          instMark: 'INST',
          capabilityNote: 'Plan limits are not configured, so none are shown',
          notPersisted:
            'Nothing composed here is saved yet. Monitoring is not running, so this is a preview of the assignment rather than a stored one.',
          chainLimitNote: 'Longer chains need a higher plan',
          review: 'Review this assignment',
          removeLink: 'Remove',
        },
        activation: {
          title: 'Begin monitoring',
          assignmentSentence:
            'GlobalNews AI will assess {subjects} {cadence}, and tell you when the assessment materially changes.',
          and: 'and',
          cadenceValue: 'every 15 minutes',
          sensitivityLine: 'Alerting on',
          unavailableTitle: 'Monitoring cannot begin yet',
          unavailableBody:
            'No activation or entitlement contract is configured for monitoring, so nothing here can be activated or charged for. The assignment above is real \u2014 it is what would be monitored.',
          signedOutTitle: 'Sign in to keep an assignment',
          signedOutBody:
            'Composing is free and needs no account. Keeping an assignment does, and activation is not configured yet in any case.',
          signIn: 'Sign in',
          followInstead: 'Follow instead \u2014 free',
          dismiss: 'Return to the situation',
          capabilityNote: 'No plan or price is configured, so none is shown',
        },
        changeStrip: {
          label: 'Change in view',
          states: {
            NEW: 'New',
            NEW_EVIDENCE: 'New evidence',
            SIGNIFICANT_CHANGE: 'Significant',
            DEVELOPING: 'Developing',
            DISPUTED: 'Disputed',
            STABLE: 'Stable',
            NO_MATERIAL_CHANGE: 'No material change',
          },
          ringsSuppressed: 'Rings hidden at this scale',
          noChange: 'Nothing new',
        },
        watchboard: {
          title: 'My watches',
          tabMine: 'Mine',
          onMap: 'On map',
          states: {
            NEW: 'New',
            NEW_EVIDENCE: 'New evidence',
            SIGNIFICANT_CHANGE: 'Significant',
            DEVELOPING: 'Developing',
            DISPUTED: 'Disputed',
            STABLE: 'Stable',
            NO_MATERIAL_CHANGE: 'No material change',
          },
          emptyTitle: 'Nothing is being monitored yet',
          emptyBody:
            'Monitoring has not started. When a watch runs, every check appears here \u2014 including the checks that found nothing, because those prove the work ran.',
          signedOutBody:
            'Composing a watch is free and needs no account. Keeping one does, and activation is not configured yet in any case.',
          checked: 'Checked',
          ceiling: 'Ceiling',
        },
        timeline: {
          title: 'How this changed',
          openLabel: 'Open',
          countLabel: 'entries',
          transitions: {
            FIRST_DETECTED: 'First detected',
            EVIDENCE_ADDED: 'Evidence added',
            PRECISION_IMPROVED: 'Precision improved',
            ASSESSMENT_CHANGED: 'Assessment changed',
            DISPUTED: 'Disputed',
            CONFIRMED: 'Confirmed',
            STABILISED: 'Stabilised',
          },
          withheldTitle: 'Earlier history',
          withheldBody:
            'Earlier transitions are listed by date and title. Their content is part of a professional plan.',
          proMark: 'PRO',
          emptyTitle: 'No recorded transitions',
          emptyBody:
            'The assessment history for this subject has not been recorded yet. When it is, every movement in precision, provenance and assessment appears here in order.',
        },
        deck: {
          open: 'Deep analysis',
          title: 'Deep analysis',
          close: 'Close',
          actions: {
            'explain-change': 'Explain this change',
            'summarise-30d': 'Summarise the last 30 days',
            'compare-regions': 'Compare two regions',
            'explain-watch': 'Explain implications for my watch',
            'what-next': 'What should I watch next?',
            'business-impact': 'Assess business impact',
            'humanitarian-impact': 'Assess humanitarian impact',
            'cross-border': 'Cross-border impact analysis',
          },
          costUnit: 'action',
          tierMark: { PROFESSIONAL: 'PRO', INSTITUTIONAL: 'INST' },
          requiresWatch: 'Needs a watch on this subject',
          meterUnset: 'Monthly allowance not set',
          previewNote:
            'These actions are shown so you can see what the product does. None can be started until deep analysis is enabled for this account.',
        },
        costPrompt: {
          title: 'Before this runs',
          costLine: 'This costs',
          costUnitOne: 'action',
          costUnitMany: 'actions',
          allowanceUnset: 'No monthly allowance is configured, so none is shown.',
          allowanceMeter: '{used} of {total} used this month \u00b7 resets {resets}',
          unavailable:
            'Deep analysis is not enabled for this account, so this cannot be started. Nothing has been spent.',
          run: 'Run',
          cancel: 'Cancel \u2014 nothing spent',
        },
        workspace: {
          back: 'Back',
          backToMap: 'Back to map',
          subjectLine: 'Subject',
          noResultTitle: 'No result yet',
          noResultBody:
            'Deep analysis is not enabled for this account, so there is nothing here to read. Once it is, the result is saved to this subject and can itself be watched.',
        },
        drawerClose: 'Close panel',
      },
      /*
        RSC-1 / RSC-1.1 — THE REGIONAL RAIL.

        Every line here is either a NAME G published, a DEFINITION G published
        verbatim, or a statement of what the product does NOT claim. There is no
        regional count, no regional verification figure and no aggregate: a
        region selection makes no evidence claim, and copy is where that rule is
        either honoured or quietly broken.
      */
      city: {
        heading: 'City',
        evidenceCeilingHeading: 'Evidence geography',
        evidenceCeilingBody:
          'This is the country the reporting is retained against. GlobalNews AI resolves evidence at country level, so the figures beside this selection are the country’s and not the city’s.',
        noCountryHeading: 'Evidence geography',
        noCountryBody:
          'No country is published for this place, so there is no geography to retain evidence against.',
        unresolvedHeading: 'This place could not be resolved',
        unresolvedBody:
          'The selection is still real and is kept in the address. The gazetteer did not answer for this identifier, so nothing further is claimed about it.',
        provenanceHeading: 'Source',
        clear: 'Clear selection',
      },
      region: {
        heading: 'Region',
        types: {
          INSTITUTIONAL: 'Institutional \u00b7 a published body defines the members',
          STATISTICAL: 'Statistical \u00b7 a published standard defines the members',
          OPERATIONAL: 'In common use \u00b7 membership is disputed',
          GOVERNED:
            'Product coverage region \u00b7 membership declared by GlobalNews AI for this deployment',
          ADMINISTRATIVE:
            'Administrative subdivision \u00b7 defined by the ISO 3166-2 standard',
          UNDEFINED: 'No definition is encoded for this region',
        },
        definitionHeading: 'Definition',
        /* R2-B §7 — a product declaration is not a published definition. */
        declaredByHeading: 'Declared by',
        membersHeading: 'Members',
        membersUnknown: 'Not published',
        noDefinitionSelected: 'No definition is asserted',
        evidenceScopeHeading: 'Evidence',
        evidenceScopeBody:
          'Regional scope, with no regional claim. Evidence is retained per country at its own precision, and this product does not add those together \u2014 a combined regional figure would have a precision nobody could state.',
        evidenceScopeBodySubnational:
          'This is the country the reporting is retained against. GlobalNews AI resolves evidence at country level, so the figures beside this selection are the country\u2019s and not this subdivision\u2019s.',
        cameraHeld:
          'The camera did not move, because no agreed extent is published for this region. The selection is still real.',
        noBoundary:
          'No regional boundary is drawn. A member-country union is not a border, and none is published here.',
        noBoundarySubnational:
          'No boundary is drawn for this subdivision. The view is framed from published bounds, which is a camera target and not a border.',
        unresolvedHeading: 'This region could not be resolved',
        unresolvedBody:
          'The geography service did not return this identifier, so nothing about it can be stated. The identifier is shown exactly as it arrived.',
        clear: 'Clear region',
        watchUnavailable:
          'Watch scope for a region is not defined yet, so no watch can be composed from here.',
      },
      /*
        PART V CONFLICT INTELLIGENCE + THE SHARED SPECIALIST LAYER.

        Every line here is either an inherited vocabulary word, a statement of
        what the platform has observed, or a statement of what it does NOT
        claim. There is no forecast copy, no composite score, and no averaged
        figure — §06's forbidden list is asserted against this block by test.
      */
      conflict: {
        situationLabel: 'Conflict situation',
        assessmentHeading: 'Current assessment',
        confidence: 'Confidence',
        geography: 'Geography',
        participantsHeading: 'Participants',
        consequenceHeading: 'Human consequence',
        evidenceHeading: 'Evidence',
        severities: {
          CRITICAL: 'Critical',
          HIGH: 'High',
          MODERATE: 'Moderate',
          LOW: 'Low',
        },
        states: {
          ACTIVE: 'Active',
          CONTAINED: 'Contained',
          NEGOTIATED: 'Negotiated',
          DORMANT: 'Dormant',
        },
        watchScopeHeading: 'Watch scope',
        watchScopeHold: {
          NO_BACKEND:
            'Monitoring cannot be scoped from here yet, because no activation contract is configured.',
          PREDICATE_NOT_IN_BASELINE:
            'Whether this subject can be monitored depends on a scope rule the platform does not yet carry, so nothing is offered rather than offered and broken.',
          CONTESTED_DEFINITION_UNRESOLVED:
            'This region has no agreed membership and no definition has been chosen, so there is no set of places a watch could cover.',
          REGION_SCOPE_UNSETTLED:
            'Watch scope for a region is not defined yet, so no watch can be composed from here.',
          AVAILABLE: 'This subject can be monitored.',
        },
        noService:
          'No conflict assessment is available for this subject. The platform has not assessed it \u2014 that is a statement about our coverage, not about the world.',
        queueHeading: 'Requires attention',
        queueHolding: 'Checked, holding',
        queueUnavailable: 'Nothing currently requires attention.',
        queueUnordered:
          'The ranked attention queue is produced by the shared assessment service, which is not supplying an order yet. Listing these in arrival order would look like a ranking and would not be one.',
        entity: {
          evidence: 'records',
          provenance: 'Provenance',
          noImage: 'No image on record',
          unlicensedImage: 'Image not licensed for display',
        },
        roles: {
          actor: 'Actor',
          participant: 'Participant',
        },
        indicators: {
          heading: 'Observed escalation indicators',
          risingOf: '{rising} of {total} rising',
          showAll: 'Show all indicators',
          noneObserved: 'No indicators have been observed for this subject.',
          staleSuffix: 'not updated',
          directions: { RISING: 'Rising', FALLING: 'Falling', FLAT: 'Unchanged', UNKNOWN: 'Unknown' },
          indicators: {
            INCIDENT_FREQUENCY: 'Incident frequency',
            GEOGRAPHIC_SPREAD: 'Geographic spread',
            ACTOR_ACTIVITY: 'Actor activity',
            INFRASTRUCTURE_ATTACKS: 'Infrastructure attacks',
            DISPLACEMENT_REPORTS: 'Displacement reporting',
            CEASEFIRE_VIOLATIONS: 'Ceasefire violations',
            EVIDENCE_VOLUME: 'Evidence volume',
          },
          /* §06's caveats belong ON the indicator, not in a footnote. */
          notes: {
            DISPLACEMENT_REPORTS: 'Reporting volume, not a population estimate.',
            CEASEFIRE_VIOLATIONS: 'Shown only where a cessation state exists.',
            EVIDENCE_VOLUME: 'May indicate a change in access rather than escalation.',
          },
        },
        readings: {
          heading: 'Two credible readings \u2014 not averaged',
          notResolved: 'Not resolved',
          agreedHeading: 'What is not disputed',
          basis: 'Basis',
          countingRule: 'Counts',
          unresolvedNote:
            'GlobalNews AI has not resolved this. The readings count different populations. No single figure is presented, and no midpoint is calculated.',
          sourceClasses: {
            OFFICIAL: 'Official',
            INDEPENDENT: 'Independent',
            SELF_REPORTED: 'Self-reported',
            EVIDENCE_BACKED: 'Evidence-backed',
          },
          sources: 'sources',
          incomplete: 'One of these readings does not state its basis or counting rule, so the two cannot be compared on equal terms.',
        },
      },
      context: {
        heading: 'What is on the map',
        inMode: 'Showing',
        totalsReports: 'Reports',
        totalsGeographies: 'Places',
        totalsSituations: 'Situations',
        totalsUnsupplied: 'not supplied',
        totalsVerified: 'Verified',
        unverifiedQualifier: 'some unverified',
        worldView: 'World view',
        totalsSources: 'Sources',
        pillGeographies: 'geographies with evidence',
        pillNewSince: 'new since last visit',
        pillUnresolved: 'unresolved location',
        noEvidenceRow: 'no retained evidence',
        noEvidenceRowMeta: 'None \u00b7 reference geography only',
        sources: 'src',
        newCount: 'new',
        jumpHeading: 'Jump to validation state',
        jumpTargets: {
          world: 'World',
          africa: 'Africa',
          eastAfrica: 'East Africa',
          europe: 'Europe',
          rwanda: 'Rwanda',
          kenya: 'Kenya',
          poland: 'Poland',
        },
        rankedHeading: 'Where the evidence is',
        watching: 'Watching',
        noEvidenceHeading: 'Looked at, nothing retained',
        noEvidenceNote:
          'These places were queried in this period and returned no retained reporting. That is a statement about what has been collected, not about what has happened.',
        emptyHeading: 'Nothing to show in this view',
        emptyBody:
          'No evidence qualifies for the selected mode and period. Widen the period, or switch mode, to see what else is retained.',
        reports: 'reports',
        modes: {
          WORLD: 'World',
          EVIDENCE: 'Evidence',
          SITUATIONS: 'Situations',
          WATCH: 'Watch',
          CHANGE: 'Change',
          SOURCES: 'Sources',
        },
        periods: {
          NOW: 'the last hour',
          '24H': 'the last 24 hours',
          '7D': 'the last 7 days',
          '30D': 'the last 30 days',
        },
        levels: {
          EXACT: 'Exact',
          CITY: 'City',
          SECTOR: 'Sector',
          DISTRICT: 'District',
          PROVINCE: 'Province',
          COUNTRY: 'Country',
          REGION: 'Region',
          UNKNOWN: 'Unresolved',
          NONE: 'None',
        },
      },
    },
  },
  /*
    ── BETA HOME · R4.1 APPROVED COPY ────────────────────────────────────────
    Issue #29. Every string below is quoted verbatim from the verified R4.1
    package's own catalogue, `i18n/i18n_en_pl.json`, under the key named beside
    it. Nothing here is authored by the implementation.

    WHY A SEPARATE BLOCK rather than edits to `hero` and `globalDevelopments`:
    those belong to the M66/GN-CD Home composition that the approved Beta Home
    replaces zone by zone. Keeping the two vocabularies apart means a retired
    zone's copy stays inspectable beside the copy that replaced it, and neither
    can be left half-migrated.

    TIME IS NEVER BAKED IN. The R4.1 catalogue reads "· 08:40 ·" and
    "20 min ago" because those are sample frames. They are templates here,
    substituted from the real feed, because §6 forbids presenting a placeholder
    as current intelligence.
  */
  betaHome: {
    /* beta.heroA / beta.heroB — two lines, the second in the accent colour. */
    heroA: 'Understand',
    heroB: 'what’s changing.',
    /* beta.heroSub */
    heroSub: 'Global events. Deeper context. Evidence you can trust.',
    /* beta.askPh — APPROVED (repo): this string came from this codebase. */
    askPlaceholder: 'Ask anything...',
    /* beta.askAria */
    askAria: 'Ask a question',
    /* beta.askBtn */
    askButton: 'Ask',
    /* beta.askHint — the metered-cost disclosure beneath the field. */
    askHint: 'Ask runs an AI analysis. Browsing, sources and the map are free.',
    /* beta.askToday / beta.askTodaySub — primary CTA. */
    askToday: 'Ask GlobalNewsAI',
    askTodaySub: 'Get a source-backed answer',
    /* beta.openMap / beta.openMapSub — secondary CTA. */
    openMap: 'Open Map',
    openMapSub: 'Explore events on a live map',
    /* beta.brief — the panel heading. */
    briefTitle: 'Your world in 60 seconds',
    /*
      beta.briefMeta. The catalogue reads "Latest updates · 08:40 · no AI used"
      because it is a sample frame; {time} is substituted from the real feed,
      and the panel renders nothing where there is no time to state.
    */
    briefMeta: 'Latest updates · {time} · no AI used',
    /* beta.imgMissing — the governed fallback when a story carries no image. */
    imageUnavailable: 'Image unavailable',
    /* beta.feedErr / beta.retry — truthful degraded state, never hidden. */
    feedUnavailable: 'Couldn’t load the latest updates.',
    /* beta.developing / beta.breaking — status chips, only where the feed says so. */
    breaking: 'Breaking',
    developing: 'Developing',
    /* Screen-reader name for the sources count, e.g. "8 sources". */
    /*
      Source count, pluralised through the existing governed helper rather than
      a bare noun: "1 sources" is wrong in English, and wrong in three different
      ways in Polish. Forms are [singular, plural, genitive-plural], the triple
      pluralize.ts expects.
    */
    sourceForms: ['source', 'sources', 'sources'] as [string, string, string],
    /* beta.now — the editorial section heading. */
    nowHeading: 'What’s happening now',
    /*
      beta.updated. The catalogue reads "Updated 20 min ago" because it is a
      sample frame; {time} is substituted from the newest item the feed
      actually returned, and the stamp is omitted where there is no time.
    */
    updatedStamp: 'Updated {time}',
    /* beta.noAi — the free-to-browse disclosure under the heading. */
    noAiNote: 'Choosing a category or opening a story never starts an AI analysis.',
    /* beta.firstVisit / beta.chooseTopics — the signed-out rail card. */
    firstVisit: 'New here? Sign in to follow countries and topics and shape your briefing.',
    signInToFollow: 'Sign in to follow',
    /* beta.pulse / beta.pulseNote — the map gateway. Explanatory, never live marks. */
    pulseTitle: 'World Pulse',
    pulseNote: 'Explanatory preview. Open the map to see country coverage and sources.',
    /* beta.suggested / beta.fillNote — prefill only; nothing runs until Send. */
    suggestedTitle: 'Suggested questions',
    /* The Ask rail's supporting line, as ruled. `suggestedNote` stays: it is
       the no-AI-on-browse guarantee and it is not interchangeable with this. */
    askRailSubtitle: 'Get clear, source-backed answers.',
    suggestedNote: 'Tapping a suggestion fills the box. Nothing runs until you press Send.',

    /*
      ── C1 · THE THIRD HERO ACTION ────────────────────────────────────────
      The contract requires three hero actions where the rendered prototype
      draws two. Ask -> /ask and Open Map -> /map already exist; this is the
      third. It goes to the editorial section's anchor rather than a new
      route, because browsing today's coverage is exactly what that section
      is, and inventing a /world route would assign a destination the
      registry states does not exist (world-intelligence has none).
    */
    exploreWorld: 'Explore World',
    exploreWorldSub: 'See key developments',

    /*
      ── C1 · THE TIER BOUNDARY, WHICH DOES NOT SELL ANYTHING ──────────────
      "Go further with GlobalNewsAI". Violet carries the tier boundary and
      sand carries metered compute, per the contract's colour meanings.

      IT HAS NO CALL TO ACTION ON PURPOSE. The contract says to inspect the
      real plans routes before assigning one, and the inspection found none:
      there is no plans, pricing, billing, upgrade or checkout route in the
      app, and /account has a layout but no page, so it does not even
      resolve. A button here would have to point somewhere that does not
      exist. So this states where the free product ends and stops — no
      price, no credit balance, no checkout, exactly as §5 requires.
    */
    premiumTitle: 'Go further with GlobalNewsAI',
    premiumFree: 'Browsing, sources and the world map stay free.',
    premiumMetered: 'Deeper AI analysis runs on metered compute.',
    premiumNote: 'Plans are not open yet. Nothing on this page charges you.',
    /*
      beta.premiumCap1..4 — BETA HOME FINAL RECOVERY R1, zone Z3. The four
      capability lines the Product Owner's prototype card carries. They NAME
      what belongs to the paid layer; they are not offers, and none of them is
      reachable from this card, because `premiumNote` above states in the same
      card that plans are not open. Watch in particular is named as a paid-layer
      capability and remains inactive product-wide.
    */
    premiumCap1: 'Watch what matters',
    premiumCap2: 'Track changes over time',
    premiumCap3: 'Access deeper analysis',
    premiumCap4: 'Professional tools & exports',
    /* beta.premiumFreeNote — the prototype's closing line under the card. */
    /* beta.navMore / beta.navUnavailable — the Home header's overflow control
       and the inert label an entry carries when its module has no route. */
    /* beta.navLabels — the Home header's primary nav wording. The module
       registry's shortTitle is "Economy Intel", "Energy Intel" and so on,
       which is right inside the Engine and wrong in a top-level nav; the
       prototype's header says plainly Economy, Energy, Security,
       Humanitarian. DESTINATIONS STILL COME FROM THE REGISTRY — this names
       the item, it never decides where it goes. */
    viewAllTopicsPending: '· page coming',
    connectedPerspective: 'A more connected perspective.',
    nowStandfirst: 'Selected global developments',
    /* beta.topicLabels — the six topic cards' wording. The registry's own
       titles are "World Intelligence", "Market Intelligence" and so on, which
       is right inside the Engine and wraps to two lines on a card; the
       prototype's strip says World, Economy, Energy, Security, Humanitarian,
       Markets. This names the card; the registry still decides where it
       goes and whether it goes anywhere at all. */
    topicLabels: { 'world-intelligence': 'World', economy: 'Economy', energy: 'Energy', security: 'Security', humanitarian: 'Humanitarian', market: 'Markets' } as Record<string, string>,
    /* beta.topicBlurbs — PREMIUM VISUAL PASS S6 ("shorter copy on the topic
       cards"). The registry's own module descriptions are written for the
       Engine's full-width panels; on a measured 136px card they clamp to
       "Early-stage: economic and..." and read as truncation rather than copy.
       These are the prototype's own one-breath lines, and they say nothing the
       module descriptions do not already say -- they claim no capability, no
       data and no route. The registry still decides where each card goes. */
    topicBlurbs: { 'world-intelligence': 'Top global stories and trends', economy: 'Growth, policy and development', energy: 'Oil, gas, power and transition', security: 'Safety, threats and stability', humanitarian: 'People, needs and response', market: 'Commodities, companies and capital' } as Record<string, string>,
    navLabels: { economy: 'Economy', energy: 'Energy', security: 'Security', humanitarian: 'Humanitarian' } as Record<string, string>,
    navMore: 'More',
    navUnavailable: 'Not yet',
    premiumCta: 'Plans coming soon',
    premiumFreeNote: 'Free to explore.',

    /*
      ── C2 · THE CATEGORY FILTER AND THE STORY RAIL ───────────────────────
      The chips are built from the governed `map.categories` vocabulary and
      only for the categories the feed actually returned, so no chip can be
      offered that leads to an empty result and no taxonomy is invented.

      "View all" CLEARS THE FILTER; it is not a link. There is no
      all-stories route in this product — /search is the analysis workspace
      and runs analyzeNews, /story/:id is N6 and still OPEN — so pointing it
      at a route would have meant inventing a destination. Flagged for the
      Product Owner in case a route was intended.
    */
    categoryFilterAria: 'Filter stories by category',
    viewAll: 'View all',
    storyRailAria: 'Current stories. Use the arrow keys to scroll.',
    /* C3 — the rail used to be labelled "World Pulse" because that card was in
       it. That card is now the Global Situation Map in the main column, so the
       landmark needed a name that describes what it actually holds. */
    sideRailAria: 'Sign in and suggested questions',

    /*
      ── C4 · EXPLORE BY TOPIC ─────────────────────────────────────────────
      The six entries are read from INTELLIGENCE_MODULES, so their names and
      destinations are the registry's rather than a second list written here.
      World is the one module the registry gives no destination, so it renders
      as plain text instead of a dead link — the note says so plainly rather
      than leaving a reader to discover it by clicking.
    */
    exploreTopicsTitle: 'Explore by topic',
    exploreTopicsNote:
      'Preview surfaces open with partial data. A topic with no surface yet is not a link.',
    viewAllTopics: 'View all topics',

    /*
      ── C7 · THE SIGNED-IN SURFACES ───────────────────────────────────────
      "For you" has NO backend of its own — there is no personalised-feed
      endpoint — so it is derived from the one feed already fetched, filtered
      by the countries this reader follows. That is why the empty state talks
      about today's coverage rather than about a feed that failed: nothing
      failed, the followed countries simply are not in today's stories.

      Following and Manage are backed by the real GET/POST/DELETE
      /follows/countries surface. Manage points at /map, which is where
      countries are actually followed and unfollowed.
    */
    forYouTitle: 'For you',
    forYouNote: 'From the countries you follow. Opening a story starts no analysis.',
    forYouEmpty: 'Nothing from the countries you follow in today\u2019s coverage yet.',
    followingTitle: 'Following',
    manageFollows: 'Manage',
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

    /*
      ── GATE A · R5.1 INTELLIGENCE-MODULES DELTA ────────────────────────────
      HOME_R4.1_DELTA.md's "Section subtitle", "Summary line", "Card route
      line" and "Card note" rows. The wording is R5.1's own, taken from the
      approved Home copy, with ONE substitution.

      P1 IS PROPOSED, SO ITS FALLBACK APPLIES. R5.1 renders the registry state
      `comingSoon` as "Unavailable" and summarises "1 unavailable".
      PROPOSED_DELTAS.md marks that a Product Owner decision and names the
      Beta-parity fallback: the registry's own badge text, which is
      `stateLabels.comingSoon` above. So "unavailable" reads "coming soon"
      here and in the PL catalogue, and nothing else in the R5.1 wording
      changes. Adopting P1 later is a two-string edit, both in this block.

      THE SUMMARY IS A TEMPLATE, never a sentence with the numbers baked in.
      `IntelligenceModulesSection` counts the canonical INTELLIGENCE_MODULES
      array and substitutes, so the line cannot drift from the registry the
      way a hardcoded "9 modules" would — which is also R5.1's own rule for
      it ("computed from the array, never hard-coded").
    */
    sectionTitle: 'Intelligence modules',
    modulesSummary: '{n} modules · {a} active · {p} preview · {u} coming soon',
    modulesSubtitle:
      'Active opens a working surface. Preview opens a routed surface whose data and providers are not fully connected. Coming soon has no surface yet.',
    /** Card route line where a module has no destination. */
    routeNone: 'No route',
    /** R5.1's "Opens preview" card note — never its review-package sibling, which describes the ZIP rather than the product. */
    opensPreview: 'Opens preview',

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
      /*
        ENGINE-CONVERGENCE-R1 §4 — this slot now carries Security Intelligence.

        The Ask AI / AI Research capability is NOT gone: §9 requires it stay
        reachable, and it does — the global Ask dock over every route, the
        mobile bottom-nav "Ask AI" tab, the map HUD control and `/search`
        itself. Its dictionary home is `askAi`, which is untouched. What ended
        is its occupancy of a specialist-dashboard slot.
      */
      security: {
        title: 'Security Intelligence',
        shortTitle: 'Security Intel',
        description: 'Early-stage: security conditions and exposure, with what has not been assessed stated plainly.',
      },
      worldIntelligence: {
        title: 'World Intelligence',
        shortTitle: 'World Intel',
        /*
          R2 §1 — A COPY CHANGE FORCED BY THE ROUTE CHANGE, AND FLAGGED AS ONE.

          This sentence described the homepage feed, because that is what the
          card pointed at. `MAIN-WORLD-INTELLIGENCE-CANONICAL-FOUNDATION-R1`
          rules World a SURFACE distinct from Home/Public Today, Map and
          Country, so a description of Home is now a description of something
          this module is defined as not being.

          R2 is scoped to route and status. Leaving the old sentence beside a
          COMING SOON badge would have shipped stale copy of exactly the kind
          R1 §14 forbids, so it is replaced with the intended PURPOSE in the
          house voice for an unavailable module — and nothing about the
          dashboard is invented. One line to revert if the Product Owner reads
          this as outside R2's scope.
        */
        description: 'Planned: a world-level view of what is changing, as its own intelligence surface.',
      },
      countryIntelligence: {
        title: 'Country Intelligence',
        shortTitle: 'Country Intel',
        description: 'Explore coverage, categories, and freshness for any country on the map.',
      },
      /*
        ENGINE-CONVERGENCE-R1 §4 — this slot now carries Politics Intelligence.

        §10 — evidence comparison is a SHARED capability and keeps every part of
        itself: source comparison, provenance, citations, the Sources Dock, the
        Complete Analysis Record. None of those files is touched by this round;
        what is removed is a top-level card that named a platform capability as
        if it were a specialist dashboard.

        The description avoids the one thing Politics must never do. Part VIII's
        neutrality rule forbids endorsing, ranking or implying a preferred
        outcome, so the card says what the dashboard covers and adds the
        commitment rather than a characterisation.
      */
      politics: {
        title: 'Politics Intelligence',
        shortTitle: 'Politics Intel',
        description: 'Early-stage: governments, institutions and political events, presented without taking a side.',
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
        /*
          ENGINE-CONVERGENCE-R1 §7 — the badge moved from COMING SOON to
          PREVIEW because the Part VII Alpha visual frame exists and renders, so
          the copy moves with it. "Planned" would now be false; the route is
          prepared and its data is not connected, which is what this says.
        */
        description: 'Early-stage: market and pricing coverage, ahead of its dedicated data.',
      },
      /*
        ENGINE-CONVERGENCE-R1 §4 — this slot now carries Humanitarian Intelligence.

        §3 — the timeline capability stays where it is used: the Assessment
        Timeline in the map's Part IV surfaces and the Timeline sub-view in the
        analysis workspace. Neither is touched.
      */
      humanitarian: {
        title: 'Humanitarian Intelligence',
        shortTitle: 'Humanitarian',
        description: 'Early-stage: humanitarian needs, access and response, where the evidence supports it.',
      },
      /*
        ENGINE-CONVERGENCE-R1 §4 — this slot now carries Energy Intelligence.

        §11 — Watch is NOT what left. Watch/Follow remains the shared Part IV
        mechanism and keeps its own surfaces; no alert system is created here
        and none is renamed. What left is a card that read as a second,
        forecast-shaped monitoring product beside it.

        The only module with no surface of any kind, so the description states
        the intended purpose and the badge states that it cannot be opened —
        which is exactly what §15 asks of an unavailable module.
      */
      energy: {
        title: 'Energy Intelligence',
        shortTitle: 'Energy Intel',
        /*
          PRICE IS MARKET'S REFERENCE, NOT ENERGY'S — and the card must not claim it.

          The previous sentence named pricing as one of Energy's three subjects.
          Part XI gives Energy supply, infrastructure and flow; PRICE reference
          semantics are Market-owned, and a second card claiming them would put
          two modules in front of one number.

          The banned phrase is deliberately NOT quoted here. Energy's own guard
          scans this entry as raw text, so writing the words down — even to
          explain their removal — would re-introduce exactly what it forbids,
          and would leave them sitting one uncomment away from being true again.

          The badge also moves COMING SOON -> PREVIEW with this landing, so the
          sentence stops saying 'not yet available' about a surface that now
          opens. What is still absent is the DATA, which is what it now says.
        */
        description: 'Early-stage: energy supply, infrastructure and flow, ahead of its dedicated data.',
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
  /*
    R2-B §9 — THIRD-PARTY NOTICES.

    HEADINGS ARE PRODUCT COPY AND ARE LOCALISED. The licence BODIES are not:
    they are rendered from `thirdPartyNotices.generated.ts`, verbatim from the
    installed packages, and the CTO ruling is explicit — "Do not translate
    license texts. Product/UI headings around them may be localized; license
    bodies remain exact."

    `dataAttribution` is the upstream notice string itself and is therefore
    NOT translated either, exactly as `map.spatial.attribution` is not.
  */
  thirdPartyNoticesPage: {
    title: 'Third-party notices',
    intro:
      'GlobalNews AI includes open-source software and third-party geographic data. The notices below are reproduced from the licences of the versions actually shipped, so they can be read here rather than found inside a build artefact.',
    softwareHeading: 'Open-source software',
    softwareIntro:
      'Reproduced exactly as published by each project. The MapLibre notice also carries the notices MapLibre itself is required to pass on, for mapbox-gl-js, glfx.js and d3-color.',
    licenceLabel: 'Licence',
    licenceUnstated: 'Not stated by the package',
    dataHeading: 'Map and geography data',
    dataIntro:
      'The map draws on published geographic datasets. The notice below is the attribution published with that data and is shown wherever the data appears, including on the map itself.',
    dataAttribution: 'Contains data from the GeoNames geographical database, licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Subdivision data from iso3166-2-db (MIT).',
    dataSources: [
      {
        name: 'GeoNames',
        licence: 'CC BY 4.0',
        note: 'Place names, coordinates and hierarchy. Reached through the GlobalNews AI geography service. The licence and its address are stated in the notice above.',
      },
      {
        name: 'iso3166-2-db 2.3.11',
        licence: 'MIT',
        note: 'Country subdivision codes and names, used to build the geography service. The package is consumed by that build rather than shipped in this application, so its full notice text is not reproduced here; it is named with its licence as published in the build record.',
      },
      {
        name: 'Natural Earth 1:50m',
        licence: 'Public domain',
        note: 'Lakes, rivers, sub-national boundary lines and populated places, bundled with the map. Natural Earth places no attribution requirement on its data; it is named here as a courtesy.',
      },
    ],
  },
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
  /**
   * PAF-R1 — the Persistent Analysis Frame. Additive: no existing key is
   * touched, and in particular no geographic precision string is
   * modified (those are pinned by the GEO-4 contract tests).
   */
  analysisFrame: {
    skipToAnalysis: 'Skip to analysis',
    /*
      C907 CORRECTION 3 — THE EXECUTIVE BRIEF WAS ASSESSED AND REFUSED.

      Deliberately distinct from `stateNoEvidence` / `stateProviderUnavailable`
      above, which describe RETRIEVAL outcomes. This one describes a brief that
      was produced, measured against the structural requirement and rejected —
      while the rest of the analysis record remains valid and is still shown.
      Saying "unavailable" without saying which half is unavailable would be the
      vaguer, less useful sentence.

      C907 ASK+ANALYSIS CONVERGENCE 1 — CORRECTED, BECAUSE IT BECAME FALSE.
      This copy previously said the brief failed "and the one permitted
      correction did not either". The synchronous repair was REMOVED under the
      accepted Alpha latency correction, so no correction is attempted at all:
      the sentence described an attempt that no longer happens. Telling a reader
      that a second, more careful try was made and also failed is a stronger
      claim about the evidence than the product can now support, so it is gone.
      The brief is measured ONCE and withheld if it fails, and the copy says
      exactly that and nothing more.
    */
    briefWithheldHeading: 'EXECUTIVE BRIEF UNAVAILABLE',
    briefWithheldBody:
      'The brief produced for this evidence set did not meet the structural requirement. It is withheld rather than shown. The analysis below is unaffected: every claim, source and timeline entry was validated independently.',
    sourceGeographyAbsent: 'NO RESOLVED COUNTRY',
    /* R4 - four different reasons an analysis can be absent. */
    stateNoQuestion: 'NO QUESTION ASKED YET',
    stateNoQuestionBody: 'Ask a question to open an analysis in this frame.',
    stateNoEvidence: 'NO REPORTING MATCHED THIS QUESTION',
    stateNoEvidenceBody: 'The provider was queried and returned nothing for this question, so no AI analysis was attempted.',
    stateProviderUnavailable: 'REPORTING COULD NOT BE RETRIEVED',
    stateProviderUnavailableBody: 'No news provider could be reached and no stored reporting was available, so there was nothing to analyse.',
    stateAnalysisFailed: 'ANALYSIS UNAVAILABLE \u00b7 REPORTING SURVIVES',
    /*
      MAIN-C2 STAGE 2, REPRODUCED VERBATIM. Main authored these three strings;
      they are carried here unchanged so this package's wiring compiles and can
      be tested on its own. If Main's patch lands first they are already
      present and identical — take either, not both.

      They are separated because a reader acts on them differently: an
      unreachable provider is worth retrying, an answer that failed validation
      probably is not. `stateAnalysisFailed` above is retained unchanged as the
      heading for both and as the fallback body, so nothing regresses if a
      surface has not adopted the distinction yet.
    */
    stateAiProviderUnavailable: 'AI PROVIDER UNAVAILABLE \u00b7 REPORTING SURVIVES',
    stateAiProviderUnavailableBody:
      'The AI provider could not be reached for this question, so no analysis was produced. The reporting below was retrieved successfully and is unaffected. Trying again later is reasonable.',
    stateAiResponseUnusableBody:
      'The AI provider answered, but the answer did not pass validation and was discarded rather than shown to you. The reporting below was retrieved successfully and is unaffected.',
    /*
      H-C2 MICRO-CLOSURE — THE CLARIFICATION STATE.

      G's classifier declines to guess the members of an under-specified
      question and states so in a language-neutral code; the sentence a reader
      sees is this lane's to write, and G held that line deliberately. The
      copy below never says nothing was FOUND, because nothing was LOOKED FOR,
      and it never blames the provider for a question.
    */
    stateClarificationRequired: 'THIS QUESTION NEEDS NARROWING \u00b7 NOTHING WAS SEARCHED FOR',
    stateClarificationRequiredBody:
      'This question could not be turned into a search without deciding part of it for you, so no search was run. That is not a finding about what exists \u2014 it is a request for one more detail.',
    clarificationComparisonMembers:
      'You asked for a comparison and the question does not name what to compare. Choosing the subjects here would be choosing your evidence for you.',
    clarificationTooManyEntities:
      'This question names more subjects than one retrieval covers. Answering for some of them would imply we had looked at all of them.',
    clarificationAskComparisonMembers: 'Which subjects should be compared?',
    clarificationAskTooManyEntities: 'Which two or three subjects matter most here?',
    clarificationAskGeneral: 'Which part of this question should the search narrow to?',
    clarificationRetryNote:
      'Running the same question again reaches the same point \u2014 editing it is what moves this forward.',
    /* R4.1 — the evidence map. Legend terms are the CONTRACT's own
       distinction between what retrieval aimed at and what the retained
       reporting supports; none of them is a precision claim. */
    mapRegion: 'Evidence map',
    mapLegendQueryTarget: 'QUERY TARGET',
    mapLegendEvidence: 'EVIDENCE GEOGRAPHY',
    mapLegendActive: 'ACTIVE EVIDENCE',
    mapLegendUnresolved: 'UNRESOLVED',
    mapCountryLevel: 'COUNTRY-LEVEL',
    mapUnresolvedEvidence: 'No country resolved from the retained reporting',
    mapUnresolvedArticles: 'UNRESOLVED REPORTS',
    mapTargetNotSupported: 'The question named this place. The retained reporting does not support it.',
    mapNothingToDraw: 'NO GEOGRAPHY TO DRAW',
    mapReportsSuffix: 'REPORTS',
    mapBasisRetrievalFilter: 'COUNTRY-FILTERED POOL',
    mapAriaEvidenceCountry: 'Evidence geography',
    mapAriaTargetCountry: 'Query target, not evidence',
    /* R4.2 — relational evidence. The six labels below are the CONTRACT's
       own directions. None is a causal finding: the contract states a
       direction establishes only that an excerpt is relevant to the
       relationship "in this sense", never that X caused Y. Reverse,
       association-only, unclear and non-substantive are never softened
       into a generic positive word. */
    relationalHeading: 'RELATIONAL EVIDENCE',
    relationalShow: 'SHOW RELATIONAL EVIDENCE',
    relationalHide: 'HIDE RELATIONAL EVIDENCE',
    relationalDirection: {
      'requested-direction': 'SUPPORTS THE REQUESTED DIRECTION',
      bidirectional: 'SUPPORTS BOTH DIRECTIONS',
      'reverse-direction': 'REVERSE \u00b7 EVIDENCE FOR THE OPPOSITE DIRECTION',
      'association-only': 'ASSOCIATION ONLY \u00b7 NOT CAUSATION',
      unclear: 'UNCLEAR \u00b7 RELATIONSHIP NOT ESTABLISHED',
      'non-substantive': 'NON-SUBSTANTIVE',
    },
    /* The two confidences, kept apart. */
    relationalExcerptVerified: 'Excerpt verified as text from this source.',
    relationalDirectionUnverified: 'The direction is the model\u2019s classification and is not independently verified.',
    relationalUncitedNote: 'Retained even though no claim cites it.',
    relationalUnmatchedHeading: 'RELATIONAL EVIDENCE WITHOUT A RETRIEVED SOURCE',
    relationalUnmatchedNote: 'These assessments name an article that is not among the retrieved sources. They are shown rather than discarded; no source has been invented for them.',
    relationalUnmatchedArticleId: 'ARTICLE ID',
    skipToLocationContext: 'Skip to location context',
    briefRegion: 'Analysis thesis',
    briefLabel: 'EXECUTIVE BRIEF \u00b7 AI INTERPRETATION',
    expandBrief: 'FULL BRIEF',
    collapseBrief: 'Collapse the full brief',
    orientationOnly: 'ORIENTATION ONLY',
    relationalAnswer: 'RELATIONAL ANSWER',
    generated: 'GENERATED',
    retrievedReports: 'RETRIEVED REPORTS',
    reportingClusters: 'REPORTING CLUSTERS',
    openQuestions: 'OPEN QUESTIONS',
    indexRegion: 'Analysis index',
    centreRegion: 'Analysis',
    locationRegion: 'Location context',
    sourcesRegion: 'Sources',
    dockHeader: 'SOURCES DOCK',
    dockExpand: 'Expand the sources dock',
    dockCollapse: 'Collapse the sources dock',
    dockViewAll: 'VIEW ALL',
    dockCollapseShort: 'COLLAPSE',
    noReportsRetrieved: 'NO REPORTS RETRIEVED',
    /* H-ALPHA-VISUAL-1 ITEM A — the reader-facing source section.
       ADDITIVE. `dockHeader` still says SOURCES DOCK and still names
       the forensic dock under the Complete Analysis Record, which is
       where that wording belongs. No existing key changed value. */
    sourcesReporting: 'SOURCES & REPORTING',
    sourcesShowAll: 'SHOW ALL SOURCES',
    openSource: 'OPEN SOURCE',
    /* DESIGN-C2 LOCK 1 — the source card's locked third line, and the
       destination statement the title link carries now that the separate
       OPEN SOURCE row is gone. ADDITIVE: no existing key changed value. */
    opensNewTab: 'opens in a new tab',
    sourceSupportCited: 'CITED \u00b7 {n}',
    sourceSupportNotCited: 'NOT CITED IN THIS ANALYSIS',
    /* DESIGN-C2 LOCK 2 — desktop source navigation. */
    sourcesPrev: 'Previous sources',
    sourcesNext: 'Next sources',
    sourcesPosition: '{a}\u2013{b} OF {n}',
    geoExpand: 'EXPAND MAP',
    geoClose: 'CLOSE MAP',
    geoZoomIn: 'Zoom in',
    geoZoomOut: 'Zoom out',
    geoZoomReset: 'Reset view',
    geoExpandedRegion: 'Expanded evidence geography',
    geoNoSubnational: 'COUNTRY LEVEL IS THE CEILING · NO SUBNATIONAL DETAIL EXISTS TO SHOW',
    geoSchematic: 'SCHEMATIC · NOT TO SCALE',
    analysisUnavailableRetrievalSucceeded: 'ANALYSIS UNAVAILABLE \u00b7 RETRIEVAL SUCCEEDED',
    analysisUnavailableExplanation:
      'The analysis could not be produced. The retrieved reporting below is unaffected and remains fully inspectable.',
    retry: 'RETRY',
    /* H-ALPHA-1 — the two recovery actions the zero-report state owes
       the reader, and a page-level Back distinct from the frame's own
       'ANALYSIS WORKSPACE' destination return. */
    editQuestion: 'EDIT QUESTION',
    backLabel: 'BACK',
    showRemaining: 'SHOW REMAINING',
    uncited: 'UNCITED',
    noItemsInDimension: 'NO ITEMS IN THIS DIMENSION FOR THIS ANALYSIS',
    locationContextChip: 'LOCATION CONTEXT',
    representativeImagery: 'Representative location imagery \u2014 not imagery of this story.',
    noVerifiedLocationImage: 'NO VERIFIED LOCATION IMAGE',
    /** {place} is substituted with the RESOLVED place, never the query. */
    locationImageAlt: 'Representative location imagery of {place}. Not imagery of this story.',
    notACoordinate: 'NOT A COORDINATE',
    mapAltCity: 'Map showing {place} at city level. Marker indicates the resolved city, not a coordinate.',
    mapAltCountry: 'Map showing {place} at country level. Marker indicates the resolved country, not a coordinate.',
    mapAltUnresolved: 'Map with no marker. The evidence did not resolve a location.',
    completeRecord: 'COMPLETE ANALYSIS RECORD',
    completeRecordSub: 'FORENSIC / AUDIT PATH \u00b7 NOT THE READING PATH',
    completeRecordAction: 'VIEW COMPLETE ANALYSIS RECORD',
    completeRecordCount: '{n} ITEMS',
    completeRecordExists: 'A complete analysis record is available for this question · {n} items',
    evidenceLibrary: 'EVIDENCE LIBRARY',
    openEvidenceLibrary: 'Open the evidence library',
    citationMarker: 'Source {n}, {outlet}. Show in sources dock.',
    backToWorkspace: 'ANALYSIS WORKSPACE',
    sourcesDestinationTitle: 'SOURCES',
    /* PAF-R1.1 — the route's non-analysing states and the workflow transition. */
    noQuestionTitle: 'NO QUESTION SUPPLIED',
    noQuestionBody:
      'The analysis frame presents an analysis that has already been requested. It does not start one from here.',
    askAQuestion: 'ASK A QUESTION',
    requestFailedTitle: 'ANALYSIS REQUEST FAILED',
    requestFailedNote: 'No reporting was retrieved for this question, so there is nothing to inspect below.',
    queryTarget: 'QUERY TARGET',
    evidenceGeography: 'EVIDENCE GEOGRAPHY',
    targetNotEstablished: 'Named in the question. Not established by the evidence.',
  },
  /**
   * ACCOUNT DESTRUCTIVE-ACTION SAFETY — the copy for /account/settings.
   *
   * The destructive WARNING itself is deliberately NOT duplicated here: the
   * page renders `navBar.deleteAccountConfirm`, the single reviewed string
   * that enumerates every category deletion destroys (accountDeletionCopy.spec
   * guards it). These keys are only the surface around it.
   */
  accountSettings: {
    heading: 'Account settings',
    intro: 'Manage the account you are signed in to.',
    signInPrompt: 'Sign in to manage your account.',
    dangerZoneHeading: 'Danger zone',
    dangerZoneNote: 'These actions are permanent. Nothing below can be undone.',
    confirmationLabel: 'Type your account email address to confirm',
    confirmationHint:
      'Deletion stays disabled until this matches the address above, character for character.',
    confirmationMismatch: 'This does not match the address of the account you are signed in to.',
    deletePermanently: 'Delete account permanently',
    deletingLabel: 'Deleting\u2026',
    deletedHeading: 'Account deleted',
    deletedNote: 'Your account and its data have been deleted. You are now signed out.',
    deleteFailed: 'The account could not be deleted. Nothing was removed. Please try again.',
  },
  /**
   * B5-A · OAUTH V1 — the two frozen auth-error strings.
   *
   * These say the least that is true. "cancelled" states the person stopped and
   * asserts no fault; "failed" states only that it did not complete and names no
   * cause — because the handler genuinely cannot tell which stage failed, so any
   * named cause would be a guess presented as a diagnosis.
   *
   * NEITHER MAY EVER CARRY A LINK, AN EMAIL ADDRESS OR A PHONE NUMBER. That is a
   * security property, not a style rule: `auth_error` is attacker-supplied, so
   * anyone can manufacture this banner on the real site. The forgery is inert
   * precisely because the message gives its reader nothing to act on except the
   * site's own sign-in button.
   */
  authError: {
    cancelled: 'Sign-in was cancelled. You can sign in whenever you\u2019re ready.',
    failed: 'Sign-in didn\u2019t complete. Please try again.',
    dismissLabel: 'Dismiss',
  },
};
