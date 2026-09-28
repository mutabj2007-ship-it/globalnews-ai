/**
 * HOME WELCOME & DISCOVERY R1 REV A — Home copy (EN).
 *
 * Authority: r6/HOME-WELCOME-DISCOVERY-R1-REV-A/COPY_EN_PL.md (package SHA256
 * ae143a26…9670). Where the design frames show SAMPLE lines (How it works and
 * Built on trust bodies), the lines below are written to stay inside the
 * contract's avoided-claims list: no "all sources", "always live", "complete
 * coverage", "continuously updated" or "perfectly neutral".
 */
export const homeRevaEn = {
  rail: {
    ariaLabel: 'Product navigation',
    sections: {
      intelligence: 'Intelligence',
      specialists: 'Specialists',
      deep: 'Deep intelligence',
      account: 'Account & control',
    },
    home: 'Home',
    worldMap: 'World Map',
    askAi: 'Ask AI',
    myIntelligence: 'My Intelligence',
    myIntelligenceAnon: 'Available after sign-in',
    analysisWorkspace: 'Analysis Workspace',
    elections: 'Elections',
    imihigo: 'Imihigo',
    account: 'Account',
    accountAnon: 'Sign in to personalize',
    preferences: 'Preferences',
    language: 'Language & region',
    languageSub: 'Display language, date format',
    plan: 'Plan & Usage',
    settings: 'Settings',
    soon: 'Soon',
    preview: 'Preview',
    collapse: 'Collapse',
    expand: 'Expand navigation',
  },
  header: {
    askLauncher: 'Ask GlobalNewsAI',
    askLauncherAria: 'Return to the Ask box at the top of Home',
  },
  hero: {
    titleA: 'Understand',
    titleB: 'what’s changing.',
    sub: 'Global events. Deeper context. Evidence you can verify.',
    composerPlaceholder: 'Ask about any country, event or trend…',
    composerAria: 'Ask GlobalNewsAI a question',
    ask: 'Ask',
    note: 'Opens Ask AI with your question. Nothing runs until you press Send.',
    staged: 'Staged in Ask AI: “{question}”',
    exploreWorld: 'Explore World',
    askGlobalNews: 'Ask GlobalNewsAI',
    openMap: 'Open Map',
    globeLabel: 'Open World Map',
    newSince: '{count} new since your previous visit · My Intelligence',
  },
  w60: {
    title: 'Your world in 60 seconds',
    /* HOME R2 DEDUP R1 — count-neutral: the module shows up to five, and fewer when fewer distinct stories remain. */
    note: 'Latest stories on Home, with their sources.',
    noteSigned: 'Latest stories, places you follow first.',
    /* Shown only when every story in this update is already in What's happening now. */
    empty: 'Every story in this update is already in What’s happening now.',
    noImage: 'No image',
  },
  /*
    HOME R2 PROVIDER DISCLOSURE R1 — Home's provenance badge, provider-neutral.
    Same five truthful states as `liveStatusStrip`; only the live label drops
    the aggregator brand. Provider identity stays in Source Policy.
  */
  provenance: {
    live: 'LIVE REPORTING',
    cached: 'CACHED · Previously retrieved reporting',
    mock: 'DEMO MODE · Sample content only',
    unavailable: 'NO REPORTING AVAILABLE',
    unknown: 'DATA STATUS UNKNOWN',
  },
  suggested: {
    title: 'Suggested investigations',
    note: 'Adds the question to Ask. Nothing runs until you press Send.',
  },
  explore: {
    title: 'Explore intelligence',
    note: 'Specialist views of the same reporting.',
    domains: {
      world: { name: 'World', line: 'Live map of reporting by country.' },
      politics: { name: 'Politics', line: 'Governments, elections and policy.' },
      economy: { name: 'Economy', line: 'Growth, inflation, trade and jobs.' },
      energy: { name: 'Energy', line: 'Supply, prices and transition.' },
      security: { name: 'Security', line: 'Conflict and security reporting.' },
      humanitarian: { name: 'Humanitarian', line: 'Crises, aid and displacement.' },
      markets: { name: 'Markets', line: 'Currencies, rates and markets.' },
    },
    specialists: 'Specialists',
    elections: 'Elections',
    imihigo: 'Imihigo',
    rwanda: 'Rwanda',
    preview: 'Preview',
  },
  deep: {
    title: 'Deep Intelligence',
    body: 'Deeper, higher-compute analysis is planned for later. It is not part of the Beta.',
    tag: 'Not in Beta',
  },
  bridge: {
    eyebrow: 'My Intelligence',
    signedTitle: 'Your intelligence, your way',
    signedBody: 'Save stories, follow countries, and get a personalized view in My Intelligence.',
    newSince: '{count} new since your previous visit',
    open: 'Open My Intelligence',
    anonTitle: 'Make GlobalNewsAI yours',
    anonBody: 'Sign in to follow countries, save stories and see what is new since your last visit.',
    about: 'About My Intelligence',
    signIn: 'Sign in',
  },
  how: {
    title: 'How it works',
    steps: [
      { title: 'Ask or explore', body: 'Start with a question, a country on the map or the latest reporting.' },
      { title: 'GlobalNewsAI reads the reporting', body: 'It gathers the coverage available to it and compares what different sources say.' },
      { title: 'You get a sourced answer', body: 'Answers link to the articles they draw on. Go deeper in the Analysis Workspace.' },
    ],
  },
  trust: {
    title: 'Built on trust',
    intro: 'Original reporting and generated analysis stay separate, and you can always check the source.',
    principles: [
      { title: 'Source links', body: 'Answers link to the articles they draw on.' },
      { title: 'Several viewpoints', body: 'Where coverage differs, sources are shown side by side.' },
      { title: 'AI clearly marked', body: 'Generated text is labelled as AI analysis.' },
      { title: 'Freshness shown', body: 'Each item shows when it was published or identified.' },
      { title: 'Reporting stays distinct', body: 'Publisher articles open at the publisher, unchanged.' },
    ],
    methodology: 'How GlobalNewsAI works: methodology',
  },
};

export type HomeRevaDictionary = typeof homeRevaEn;
