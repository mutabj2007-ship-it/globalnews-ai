/**
 * MY INTELLIGENCE — ENGLISH COPY, TRANSCRIBED FROM THE FROZEN AUTHORITY.
 *
 * Source: MY-INTELLIGENCE-R1.2-DESIGN-AUTHORITY (Product Owner approved and
 * frozen). Where the authority gives a string verbatim, it is reproduced here
 * verbatim; the comments name which document each governed sentence comes from
 * so a reviewer can check a wording without opening the component.
 *
 * Folded into `en` as its own namespace, exactly as `admin` and `support` are,
 * so every string still resolves through one `getDictionary(language)` call
 * and no second localisation path is introduced.
 */
export const myIntelligenceEn = {
  eyebrow: 'MY INTELLIGENCE',
  metaTitle: 'My Intelligence — GlobalNews AI',
  metaDescription: 'Your saved stories, the places you follow, and what we have found since your previous visit.',

  greetingNamed: 'Welcome back, {name}',
  greetingAnonymous: 'Your intelligence',
  accountSettings: 'Account settings',

  /* FOLLOWING_AND_NEW_SINCE.md — the previous-visit line. */
  previousVisit: 'Previous visit {date}',
  newlyIdentifiedCount: '{count} newly identified stories about places you follow',
  newlyIdentifiedCountOne: '1 newly identified story about places you follow',

  tabs: {
    ariaLabel: 'My Intelligence sections',
    overview: 'Overview',
    saved: 'Saved',
    following: 'Following',
    recent: 'Recent',
  },
  select: 'Select',
  done: 'Done',

  newSince: {
    title: 'New since your previous visit',
    /* FOLLOWING_AND_NEW_SINCE.md, Explainer EN — verbatim. */
    explainer:
      'Reporting GlobalNewsAI identified about places you follow since your previous visit ({date}). A story counts as new when we first found it after that visit, even if it was published earlier. Checked when you opened this page.',
    /* The first-visit state. R1.2: nothing is marked new on a first visit. */
    firstVisit:
      'On your next visit, reporting we identify about the places you follow will appear here. Nothing is marked new on a first visit.',
    /* The empty state, including when every candidate lacks an observation time. */
    empty: 'Nothing newly identified about places you follow since your previous visit.',
    unavailable: "We couldn't check for new reporting. Saved stories are still available.",
    identifiedAgo: 'identified {age}',
    publishedAgo: 'published {age}',
    countLabel: '{count} new',
  },

  saved: {
    title: 'Saved stories',
    viewAll: 'View all ({count})',
    empty: 'Stories you save will appear here.',
    emptyAction: 'Browse the latest',
    savedAgo: 'saved {age}',
    filterAll: 'All',
    /* SAVED_STORIES.md — local filtering runs no AI. No commercial wording. */
    filterNote: 'Filtering happens locally. Runs no AI analysis.',
    sourceUnavailable:
      'Source unavailable. The publisher link no longer opens. We keep your saved reference.',
    noImage: 'No image',
    save: 'Save story',
    unsave: 'Remove saved story',
    saveUnavailable: 'This story can’t be saved yet: it isn’t in retained reporting.',
    savedToast: 'Saved to My Intelligence',
    unsavedToast: 'Removed from saved',
    saveFailed: "Couldn't save. Try again.",
    toastView: 'View',
    toastUndo: 'Undo',
  },

  forYou: {
    title: 'For you',
    note: 'Recommended from the places you follow. Not limited to new stories.',
    reason: 'Because you follow {country}',
    empty: 'Nothing from the countries you follow in the current coverage yet.',
  },

  following: {
    title: 'Following',
    manage: 'Manage on World Map',
    newSince: '{count} new since previous visit',
    nothingNew: 'Nothing new since previous visit',
    follow: 'Follow',
    following: 'Following',
    empty: 'Follow a country on the World Map to see it here.',
    /* Part IV: Follow is not Watch, and Watch is inactive on Beta. */
    watchDormant:
      'Watch alerts are not available in this Beta. Following does not send notifications.',
    /* DENSITY R1 — one compact control, one bounded list. */
    button: 'Following {count}',
    listTitle: 'Followed countries',
    filterLabel: 'Filter countries',
    noMatch: 'No followed country matches.',
    followAria: 'Follow {country}',
    unfollowAria: 'Unfollow {country}',
    updateFailed: 'Couldn’t update {country}. Try again.',
    close: 'Close',
  },

  recent: {
    title: 'Recent intelligence',
    questionHistory: 'Question history',
    note: 'Questions you asked before appear here. Past answers are not kept up to date; Ask again opens the question in Ask AI and nothing runs until you press Send.',
    /* RECENT_INTELLIGENCE.md — the CURRENT capability is empty. */
    empty: 'No recent intelligence yet.',
    askAgain: 'Ask again',
    askAgainAria: 'Ask again: {question}',
    viewAll: 'View all ({count})',
    askedOn: 'Asked {date}',
  },

  selection: {
    countLabel: '{count} selected',
    clear: 'Clear',
    /* SELECTED_STORIES_ACTIONS.md — neutral, no commercial framing. */
    summary: 'Choose stories, then pick an action. Each action asks you to confirm before it runs.',
    pickAction: 'Pick an action ({count})',
    selectAtLeast: 'Select at least {count}',
    maxReached: 'You can select up to {count} stories.',
    aiTag: 'AI',
    /* COLOR / ACTION-AWARENESS R1 — selection mode says what it is, how many, how to leave, what costs compute. */
    modeLabel: 'Selection mode',
    selectStories: 'Select stories',
    selectAria: 'Select stories. Enter selection mode. Selecting is free.',
    modeDone: 'Selection mode · Done',
    doneAria: 'Done — leave selection mode',
    storiesSelectedOne: '{count} story selected',
    storiesSelectedOther: '{count} stories selected',
    statusOne: '{count} story selected. Selection mode active.',
    statusOther: '{count} stories selected. Selection mode active.',
    statusNone: 'Selection mode active. No stories selected yet.',
    guidance: 'Choose what to do next',
    costNote: 'AI actions use compute. Selecting, filtering and clearing are free.',
    aiActionAria: '{action} — AI action. Uses compute and asks you to confirm before it runs.',
    moreActions: 'Show more actions',
    introBody: 'Selected stories unlock intelligence actions. Compare, summarize or ask about them when you’re ready.',
    introCompute: 'AI runs only when you confirm an AI action.',
    introDismiss: 'Got it',
    cannotSelect: 'This story cannot be selected because its source is unavailable.',
    /* INTEREST + SELECTION HOOK R1 — the sand selection hook. Selecting is free: no AI wording here. */
    hookSelect: 'Select this story for intelligence actions: {title}',
    hookRemove: 'Remove this story from selected stories: {title}',
    hookTitle: 'Select for intelligence',
    hookHint: 'Use the sand + controls on stories to select what you want to analyze.',
    actions: {
      compare: 'Compare',
      summarize: 'Summarize',
      askAbout: 'Ask about selected',
      explain: 'Explain disagreements',
      whatChanged: 'What changed',
      briefing: 'Create briefing',
    },
  },

  compute: {
    titleCompare: 'Compare {count} stories',
    titleSummarize: 'Summarize {count} stories',
    titleAsk: 'Ask about {count} stories',
    titleExplain: 'Explain disagreements across {count} stories',
    titleWhatChanged: 'What changed across {count} stories',
    titleBriefing: 'Create a briefing from {count} stories',
    storiesAttached: 'Stories attached: {count}',
    questionLabel: 'Your question',
    questionPlaceholder: 'What would you like to know about these stories?',
    draftOnly: 'Draft only. Nothing is sent yet.',
    /* The Part IV sand boundary. No price, credits or balance. */
    sandNote: 'Runs AI analysis — Nothing is sent until you confirm.',
    cancel: 'Cancel',
    run: 'Run comparison',
    runGeneric: 'Run analysis',
    send: 'Send question',
    /* Capability sheet CTO ruling: presentation changes never re-run compute. */
    languageNote: "Changing language doesn't rerun any analysis.",
    /* COMPUTE-ACTION CLOSURE R1 — the explicit Run, its progress, its failure and its result. */
    running: 'Running…',
    runningNote: 'Your selected stories stay selected while this runs.',
    retry: 'Try again',
    failedTitle: 'The analysis did not complete. Your selection is kept.',
    missingRefOne: '{count} selected story can’t be sent: it has no verified story reference, so it is left out.',
    missingRefOther: '{count} selected stories can’t be sent: they have no verified story reference, so they are left out.',
    tooFewVerified: 'Not enough verified stories for this action (it needs {count}).',
    questionRequired: 'Type a question to send.',
    resultLabel: 'Result',
    resultResolved: 'Resolved {resolved} of {requested} selected stories',
    resultUnresolved: 'Not found in retained reporting:',
    /* UNIFIED INTELLIGENCE BINDING R2D — the result is a canonical Ask answer: reopenable, never rerun. */
    resultFullNote: 'Saved to your Ask conversations. Opening it again shows this result — nothing is rerun.',
    openInAsk: 'Open in Ask',
    close: 'Close',
  },

  states: {
    loading: 'Loading your intelligence…',
    degraded:
      "Some of this page couldn't be loaded. Saved stories and your question history are unaffected.",
    offline: "You're offline. Nothing from this page is stored on this device.",
    error: 'Something went wrong loading this page.',
    retry: 'Retry',
    signedOutTitle: 'Sign in to open My Intelligence',
    signedOutBody:
      'My Intelligence keeps your saved stories, the places you follow, and what we have found since your previous visit.',
    signedOutAction: 'Sign in to continue',
    signedOutReturn: "You'll come back to My Intelligence after signing in.",
    emptyTitle: 'Nothing here yet',
    emptyBody:
      'Save a story, follow a country, or ask a question — what you keep will appear here.',
  },

  /* The development-fixture banner. Not a design element; a truthfulness control. */
  fixtureBanner: 'DEVELOPMENT FIXTURES · NOT LIVE DATA',
  fixtureBannerDetail:
    'Saved stories, recommendations and the previous-visit boundary on this page are development fixtures for design review. They are not live product data and nothing is stored.',
  sampleLabel: 'Sample',

  homeLink: 'Open My Intelligence',
  accountMenuItem: 'My Intelligence',
  accountMenuItemTag: 'New',

  /*
    PREMIUM WORKSPACE R1 — COPY_EN_PL.md (MY-INTELLIGENCE-PREMIUM-WORKSPACE-R1,
    package SHA256 4059e9b3…a567ed4). Governed strings above are reused
    verbatim; everything here is the package's new copy.
  */
  workspace: {
    subcopy: 'Reporting, developments and analysis shaped by what you follow and investigate.',
    workspaceLabel: 'WORKSPACE',
    railLabel: 'My Intelligence workspace',
    openRail: 'Open workspace navigation',
    collapseRail: 'Collapse workspace navigation',
    pin: 'Keep rail open',
    unpin: 'Unpin rail',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    search: 'Search',
    account: 'Account',
    groups: {
      mine: 'MY INTELLIGENCE',
      collections: 'COLLECTIONS',
      intelligence: 'INTELLIGENCE',
      specialists: 'SPECIALISTS',
      deep: 'DEEP INTELLIGENCE',
      account: 'ACCOUNT & CONTROL',
    },
    items: {
      today: 'Today for me',
      forYou: 'For you',
      newSince: 'New since last visit',
      saved: 'Saved',
      following: 'Following',
      history: 'Question history',
      selected: 'Selected stories',
      selectedSub: 'Compare, summarize, brief',
      analysisWorkspace: 'Analysis Workspace',
      analysisWorkspaceSub: 'Open a complete analysis from Ask AI',
      briefings: 'Briefings from selected stories',
      briefingsSub: 'Select stories, then Create briefing',
      deepIntelligence: 'Deep Intelligence',
      deepIntelligenceSub: 'Advanced, higher-compute intelligence',
      accountItem: 'Account',
      preferences: 'Preferences',
      language: 'Language',
      plan: 'Plan & usage',
      planStatus: 'Beta access · no paid plan active',
      settings: 'Settings',
      signOut: 'Sign out',
      betaAccess: 'Beta access',
    },
    domains: {
      map: 'World Map',
      politics: 'Politics',
      economy: 'Economy',
      market: 'Market',
      energy: 'Energy',
      conflict: 'Conflict & Security',
      humanitarian: 'Humanitarian',
    },
    whatChanged: 'WHAT CHANGED',
    /* D9 — the dashboard's short explainer; the verbatim one lives in View all. */
    newShort: 'Reporting we identified about places you follow since {date}. Checked when you opened this page.',
    viewAll: 'View all',
    viewAllCount: 'View all ({count})',
    back: 'Back to Today for me',
    promiseEyebrow: 'BUILD INTELLIGENCE',
    promiseTitle: 'Turn reporting into intelligence',
    promiseBody:
      'Select multiple stories to compare reporting, identify change, explain disagreements or build a briefing.',
    explore: 'Explore your intelligence',
    exploreNote: 'Intelligence domains across GlobalNewsAI.',
    preview: 'Preview',
    goDeeper: 'Go deeper',
    deepEyebrow: 'DEEP INTELLIGENCE',
    notInBeta: 'Not in Beta',
    historyShort: 'Past answers are not kept up to date. Nothing runs until you press Send.',
    selectedRemove: 'Remove {title} from selection',
    specialists: {
      group: 'SPECIALISTS',
      moduleTitle: 'Specialist intelligence',
      moduleNote: 'Focused workspaces for one kind of analysis. Country is the context.',
      viewAll: 'View specialists',
      pageTitle: 'Specialists',
      pageNote:
        'Specialists are focused analytical workspaces. They sit beside the broad intelligence domains and open with a country or place as context. Opening one runs no AI analysis.',
      elections: 'Elections',
      countryAware: 'Country-aware',
      country: 'Country',
      elFamily: 'COUNTRY-AWARE SPECIALIST',
      elBody:
        'One Elections workspace for every country with governed election data. The country you choose sets the context.',
      /*
        R1 IMPLEMENTATION — the frames draw "Kenya · Prepared". The release
        binds NO country to the Elections preview and its live route is gated
        closed (electionLiveRouteMayOpen() === false), so no country is named
        as prepared. The preview entry says exactly what it is.
      */
      openPreview: 'Open Elections preview',
      previewNote: 'Preview route today: /election-visual-preview · no country bound',
      noCountries: 'Follow a country to use it as context here.',
      unsupportedTitle: 'No governed election data for {country}',
      unsupportedBody:
        'Elections opens for a country only when governed election data is available. Nothing is estimated or filled in.',
      imihigo: 'Imihigo',
      imihigoSub: 'Rwanda · District intelligence',
      openImihigo: 'Open Imihigo',
      dpFamily: 'DELIVERY & PERFORMANCE',
      dpBody: 'Public-delivery and performance systems, each shown under its own national name.',
      dpFuture:
        'Other national delivery systems would appear here under their own names once governed data exists. They are not called Imihigo.',
    },
  },

  /*
    INTEREST + SELECTION HOOK R1 — explicit reader interests. The labels are
    the governed vocabulary (MY_INTELLIGENCE_INTERESTS); nothing is inferred.
  */
  interests: {
    labels: {
      politics_governance: 'Politics & governance',
      security_conflict: 'Security & conflict',
      economy_markets: 'Economy & markets',
      diplomacy: 'Diplomacy',
      humanitarian_society: 'Humanitarian & society',
      energy_infrastructure: 'Energy & infrastructure',
      technology: 'Technology',
      regional_affairs: 'Regional affairs',
      health_science: 'Health & science',
      sports: 'Sports',
      entertainment: 'Entertainment',
    },
    tune: 'Tune interests',
    title: 'Your interests',
    note: 'For you shows retained reporting from the places you follow that matches the interests you choose here. Nothing is inferred, and choosing runs no AI analysis.',
    apply: 'Apply',
    showAll: 'Show all',
    saving: 'Saving…',
    failed: 'Couldn’t save your interests. Try again.',
    close: 'Close',
    matchCountOne: '1 story matches your current interests.',
    matchCountOther: '{count} stories match your current interests.',
    noMatch: 'No retained reporting from the places you follow matches your current interests right now.',
    invite: 'Tune interests to focus For you on what you care about.',
    broader: 'Show broader reporting',
    focused: 'Show only my interests',
  },

};
