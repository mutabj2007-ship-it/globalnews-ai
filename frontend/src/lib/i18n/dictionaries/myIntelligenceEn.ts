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
    save: 'Save to My Intelligence',
    unsave: 'Remove from saved',
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
  },

  recent: {
    title: 'Recent intelligence',
    questionHistory: 'Question history',
    note: 'Questions you asked before appear here. Past answers are not kept up to date; Ask again opens the question in Ask AI and nothing runs until you press Send.',
    /* RECENT_INTELLIGENCE.md — the CURRENT capability is empty. */
    empty: 'No recent intelligence yet.',
    askAgain: 'Ask again',
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
    resultFullNote:
      'This is the full result for your selected stories. The Analysis Workspace opens single questions, so it can’t reopen this selection without running a different analysis.',
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
};
