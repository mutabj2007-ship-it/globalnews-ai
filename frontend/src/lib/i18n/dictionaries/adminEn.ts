/**
 * F1.b — English Admin Platform dictionary.
 *
 * Spread into `en` as `admin`, so everything still resolves through the
 * SAME `getDictionary(language)` call every other section uses. It lives
 * in its own file only for readability: en.ts is already ~41 KB.
 *
 * IDENTIFIERS ARE NOT TRANSLATED. Screen codes (ADMIN-04), capability
 * strings, route paths and protocol tokens (LIVE, CACHED, UNKNOWN,
 * HEALTHY) are identifiers and appear verbatim in both languages. Their
 * EXPLANATIONS are translated.
 *
 * NOT ONE FIGURE APPEARS HERE. Every number in the approved artifact is
 * tagged D — design sample only — and none of it ships. Where a screen
 * has no backend, the copy says so.
 */
export const adminEn = {
  meta: {
    title: 'Admin — GlobalNews AI',
    description: 'GlobalNews AI administration.',
  },

  brand: {
    name: 'GlobalNews',
    accent: 'AI',
    subtitle: 'ADMIN CONTROL PLATFORM',
  },

  truthBanner: {
    title: 'Data provenance',
    body: 'Every field on this platform carries a provenance tag. Nothing shown here is illustrative: a surface with no backing data says so rather than displaying a placeholder figure.',
  },

  nav: {
    landmarkLabel: 'Admin sections',
    openMenu: 'Open admin navigation',
    closeMenu: 'Close admin navigation',
    skipToContent: 'Skip to admin content',
    emptyTitle: 'No sections available',
    emptyBody: 'Your role grants no administrative sections.',
    groups: {
      platform: 'PLATFORM',
      content: 'CONTENT',
      intelligence: 'INTELLIGENCE',
      audience: 'AUDIENCE',
      finance: 'FINANCE',
      support: 'SUPPORT',
      operations: 'OPERATIONS',
    },
    items: {
      overview: 'Overview',
      news: 'News management',
      sources: 'Global sources',
      ai: 'AI intelligence',
      aiProviders: 'AI providers',
      users: 'Users & access',
      subscriptions: 'Users & subscriptions',
      analytics: 'Analytics',
      geography: 'Geography / reach',
      payments: 'Payments & taxes',
      support: 'Feedback & support',
      systemHealth: 'System health & logs',
      audit: 'Audit logs',
      settings: 'Settings',
    },
  },

  topbar: {
    searchPlaceholder: 'Search is not implemented',
    searchNotImplemented: 'Global search has no backend and is not implemented.',
    roleLabel: 'Role',
    signedInAs: 'Signed in as',
    capabilityCount: 'capabilities',
  },

  access: {
    loadingTitle: 'Checking your access…',
    loadingBody: 'Nothing is displayed until the server confirms who you are.',
    signInTitle: 'Sign in required',
    signInBody: 'This area requires a signed-in administrator account.',
    signInCta: 'Sign in with Google',
    forbiddenTitle: 'Not available',
    forbiddenBody: 'This area is not available for your account.',
    unreachableTitle: 'Permissions unavailable',
    unreachableBody:
      'Your permissions could not be read, so no administrative section is shown. This is not a sign that you lack access — the check itself did not complete.',
    retry: 'Try again',
  },

  states: {
    noSource: 'No source',
    planned: 'Planned',
    unknown: 'UNKNOWN',
    notImplemented: 'NOT IMPLEMENTED',
    unavailable: 'UNAVAILABLE',
    loading: 'Loading…',
    failed: 'Failed',
    retry: 'Retry',
    correlationId: 'Correlation id',
    zeroNote: 'A measured zero for this window.',
    unavailableNote: 'No backend exposes this value.',
    notImplementedNote: 'Planned. No backend capability exists for this yet.',
    errorNote: 'This panel failed to load. The rest of the screen is unaffected.',
    inertFilters: 'Filters are shown for layout and are inert until this screen has data.',
  },

  provenance: {
    legendTitle: 'Provenance',
    a: 'Existing backend data',
    b: 'Exists, needs aggregation',
    c: 'New backend capability required',
    d: 'Design sample only — never shipped',
    ariaPrefix: 'Data provenance',
  },

  screens: {
    overview: {
      title: 'Overview',
      purpose: 'Is the platform operating normally, and what needs an administrator today.',
      kpis: {
        articlesIngested: 'ARTICLES INGESTED · 24H',
        activeUsers: 'ACTIVE USERS · 24H',
        countries: 'COUNTRIES WITH ACTIVITY',
        analysisRequests: 'ANALYSIS REQUESTS · 24H',
        providerErrors: 'PROVIDER ERRORS · 24H',
      },
      reachTitle: 'Global reach',
      reachPurpose: 'Requests by country for the selected window.',
      reachRequirement: 'Requires request-level geography, which this platform does not collect.',
      pipelineTitle: 'Pipeline mode',
      pipelineNote:
        'Live provider mode is reported by the news pipeline itself. Open News management for the per-provider view.',
      alertsTitle: 'Alerts',
      alertsRequirement: 'Requires an alerting store. None exists.',
      windowLabel: 'Window',
      windows: { h24: '24h', d7: '7d', d30: '30d' },
    },

    analytics: {
      title: 'Users, usage & geography',
      purpose: 'How the product is actually used, at a precision the backend can defend.',
      tabs: {
        analytics: 'Analytics',
        geography: 'Geography',
        users: 'Users & access',
        subscriptions: 'Subscriptions',
      },
      signedInOnlyNotice:
        'GlobalNews AI is usable without an account, and no route requires sign-in. Every user, session and history figure therefore covers signed-in accounts only and is a subset of real usage.',
      kpis: {
        activeUsers: 'ACTIVE USERS · 24H',
        newUsers: 'NEW ACCOUNTS · 7D',
        returning: 'RECORDED RETURN VISITS · 7D',
        sessions: 'SESSIONS · 24H',
        analysisRuns: 'ANALYSIS RUNS · 24H',
        clientErrors: 'CLIENT ERRORS · 24H',
        totalAccounts: 'TOTAL ACCOUNTS',
        neverObserved: 'NEVER OBSERVED RETURNING',
      },
      activeUsersRequirement:
        'Not implemented. No per-request activity is recorded, and readers without an account cannot be counted at all.',
      sessionsRequirement:
        'Not implemented. Session rows are deleted on sign-out and on expiry, so no historical session count can be derived from them.',
      returningMeaning:
        'Accounts whose recorded return visit falls in the window. This is NOT active users: an account that read all day without reaching the return surface is not counted, and a reader without an account never can be.',
      analysisTitle: 'Analysis runs',
      analysisPurpose:
        'One row per analysis request this server completed — cached responses, validation rejections and failures included. It is not a count of questions a person asked.',
      analysisOutcome: 'Outcome',
      analysisFailureReason: 'Failure reason',
      analysisProvider: 'Provider and model',
      analysisCacheHits: 'Served from cache',
      analysisCacheMisses: 'Computed',
      analysisLatency: 'Latency',
      analysisTokens: 'Tokens',
      analysisAverage: 'Average',
      analysisRange: 'Range',
      analysisSample: 'Sampled rows',
      analysisNoSample: 'No row in this window recorded a value, so there is no average to report.',
      mockProviderNote:
        'A mock provider is not live traffic. Rows attributed to one are runs the platform served without calling a real model.',
      recordedEventsTitle: 'Recorded events',
      recordedEventsPurpose: 'Product events this server recorded in the window.',
      instrumentationGapTitle: 'This is not complete feature usage',
      instrumentationGapBody:
        'Only an event name with a producer can ever appear here. Client interaction telemetry is not instrumented, so the names listed as having no producer are missing from the data rather than unused. Ranking what remains as feature usage would be false.',
      hasProducer: 'Has a producer',
      noProducer: 'No producer',
      retentionDisclosureTitle: 'Telemetry retention',
      retentionDeclared: 'Declared retention, in days',
      retentionNotEnforced:
        'DECLARED BUT NOT ENFORCED. No scheduler runs in this backend and no job prunes these tables, so long-window figures include rows the rule says should already be gone.',
      retentionIsEnforced: 'Enforced by a scheduled purge.',
      coverageCountryColumn: 'Country',
      coverageRelevantColumn: 'Relevant articles',
      coverageTotalColumn: 'All stored rows',
      coverageDistinct: 'COUNTRIES WITH RELEVANT COVERAGE',
      coverageTruncated:
        'The ranked list is capped. The count above is taken over every country, not over the rows shown.',
      followedTitle: 'Followed countries — declared interest, signed-in accounts only',
      followedPurpose:
        'Which countries signed-in accounts chose to follow. This is neither what the coverage is about nor where anyone is, and it is never used to infer either.',
      followedCountryColumn: 'Country',
      followedAccountsColumn: 'Following accounts',
      followedEmptyTitle: 'No country has been followed yet',
      followedEmptyBody: 'No account has followed a country. That is a measurement, not a gap.',
      audienceGeographyTitle: 'Audience geography',
      audienceGeographyRequirement:
        'Not implemented, and not approximated. No address is captured, no geographic enrichment runs, and the access log never records a query string. Audience location is never inferred from coverage, from followed countries, from retrieval scope, from interface language or from model output.',
      usersPurpose: 'Accounts, at the minimum an access view needs. Readable by SUPER_ADMIN alone.',
      usersIdColumn: 'Account',
      usersCreatedColumn: 'Created',
      usersLastSeenColumn: 'Last observed',
      usersRoleColumn: 'Admin role',
      usersNoRole: 'None',
      usersNeverSeen: 'Never observed',
      usersEmptyTitle: 'No accounts',
      usersEmptyBody: 'No account exists on this deployment yet.',
      usersTotal: 'ACCOUNTS',
      usersRoleDistribution: 'By admin role',
      usersOmittedFields:
        'DELIBERATELY ABSENT: address, any masked or partial address, domain, search history text, sign-in identity values, session data — and display name. None of them is filtered out on the way here; none is ever read from the database.',
      usersNoWritePath:
        'This view is read-only. No role can be granted, changed or removed from any administrative surface in this platform.',
      usersPagePrevious: 'Previous',
      usersPageNext: 'Next',
      usersPageLabel: 'Page',
      topCountries: 'Top countries',
      topLanguages: 'Top languages',
      topFeatures: 'Top features',
      retentionTitle: 'Retention',
      retentionPurpose: 'Activity by week since first session.',
      retentionRequirement: 'Requires a cohort job and an activity record. Neither exists.',
      geographyTitle: 'Coverage geography',
      geographyNote:
        'This is where published coverage is about — not where users are. Audience geography would require request-level collection this platform does not perform.',
      geographyRequirement:
        'Requires an aggregate endpoint over the stored article/country relation.',
      usersTitle: 'User records',
      usersRequirement: 'Requires an administrative user-list endpoint. None exists.',
      subscriptionsTitle: 'Subscriptions',
      subscriptionsRequirement: 'No subscription model exists in this platform.',
      errorsTitle: 'Errors',
      errorsRequirement: 'Requires client error telemetry. None is collected.',
    },

    payments: {
      title: 'Payments, taxes, Poland & KSeF',
      purpose:
        'Revenue, VAT, invoicing and Polish KSeF submission, with evidence for accounting and inspection.',
      notImplementedTitle: 'Not implemented',
      notImplementedBody:
        'This platform has no payment, tax, customer, invoice or KSeF capability of any kind — no payment provider, no ledger, no tax determination, no invoice numbering, no KSeF client. The structure below is the approved architecture, shown so the shape is agreed before anything is built. No figure, customer, invoice number, NIP or KSeF reference is displayed, because none exists.',
      tabs: {
        overview: 'Overview',
        vat: 'Polish VAT',
        customers: 'Business customers',
        invoices: 'Invoices',
        ksef: 'KSeF',
        traceability: 'Traceability',
      },
      ksefStatusTitle: 'KSeF integration',
      ksefStatusValue: 'DISCONNECTED',
      ksefStatusBody:
        'Integration not configured. Every KSeF surface stays behind a capability flag until backend evidence exists.',
      traceabilityTitle: 'Traceability chain',
      traceabilityBody:
        'Each node must be reachable from the one above it. None of the eight nodes has a backing record today.',
      chain: {
        customer: 'Customer / business',
        subscription: 'Subscription / purchase',
        payment: 'Payment',
        taxTreatment: 'Tax treatment',
        invoice: 'Invoice',
        ksefSubmission: 'KSeF submission',
        ksefResult: 'KSeF status / result / reference',
        auditHistory: 'Audit history',
      },
    },

    support: {
      title: 'Feedback & support',
      purpose:
        'Run the support queue with a permanent, auditable record of what was said to the user and what was said internally.',
      queueTitle: 'Queue',
      threadTitle: 'Conversation',
      replyComposer: 'Reply to user',
      noteComposer: 'Internal note',
      visibilityUser: 'Visible to the user',
      visibilityInternal: 'Internal note — not visible to the user',
      visibilityNote:
        'Reply visibility is a stored, server-enforced field, never a display convention. An internal note is filtered out of the requester’s query at the database and is not counted in what they see.',
      requestTypesTitle: 'Request types',
      identityNote:
        'A ticket is identified by its reference alone. No address, name or account identifier for the person who opened it is available on this screen.',
      columns: {
        reference: 'Reference',
        subject: 'Subject',
        category: 'Type',
        status: 'Status',
        replies: 'Visible',
        notes: 'Notes',
        updated: 'Last activity',
      },
      queueEmptyTitle: 'No support requests',
      queueEmptyBody:
        'Nobody has opened a support request yet, or none matches the selected status.',
      queueErrorTitle: 'The queue could not be loaded',
      queueErrorBody: 'The request failed. Nothing is shown rather than a partial queue.',
      selectPrompt: 'Select a request from the queue to read its conversation.',
      threadErrorBody: 'The conversation could not be loaded. No part of it is shown.',
      openTicket: 'Open',
      authors: {
        USER: 'Requester',
        ADMIN: 'Support administrator',
        SYSTEM_AI: 'GlobalNews AI Support Agent',
      },
      categories: {
        NEWS_QUESTION: 'News question',
        BUG_REPORT: 'Bug report',
        CONTENT_REPORT: 'Content report',
        FEEDBACK: 'Feedback',
        ABUSE_REPORT: 'Abuse report',
        ACCOUNT_PROBLEM: 'Account problem',
        OTHER: 'Other',
      },
      statuses: {
        OPEN: 'Open',
        AWAITING_USER: 'Awaiting user',
        AWAITING_ADMIN: 'Awaiting admin',
        RESOLVED: 'Resolved',
      },
      filterAll: 'All statuses',
      filterLabel: 'Filter by status',
      messageLabel: 'Message',
      replyPlaceholder: 'Write the reply the requester will read.',
      notePlaceholder: 'Write a note only administrators will read.',
      sendReply: 'Send reply',
      saveNote: 'Save internal note',
      sending: 'Sending…',
      submitFailed: 'Nothing was sent. The request failed and no message was stored.',
      replyConsequence: 'Sending a reply moves the request to “awaiting user”.',
      noteConsequence:
        'Saving a note changes nothing the requester can see, and does not move the request.',
      auditTitle: 'Request history',
      auditRequirement:
        'No audit store exists in this platform. A timeline assembled from message timestamps would look like a record of who changed what and would not be one, so nothing is shown here.',
      slaTitle: 'Response targets',
      slaRequirement:
        'No response-target model, clock or measurement exists in this platform. Any figure shown here would be an invention rather than a reading.',
      statusTitle: 'Request status',
      resolve: 'Mark resolved',
      reopen: 'Reopen',
      statusFailed: 'The status was not changed.',
      /*
        SUPPORT CLOSURE (G4) — WHAT "RESOLVED" ASSERTS, STATED AT THE CONTROL
        THAT ASSERTS IT. RESOLVED is a fact about the REQUEST, not about the
        thing the requester reported. "Something is broken" is one of the seven
        categories a person can choose, so an operator closing a thread can very
        easily be read as certifying a repair. Sending a reply is not a fix, and
        neither is a status. This line sits beside the control so the operator
        knows what they are and are not claiming.
      */
      resolveMeaning:
        'Resolving closes this request. It does not record that a reported problem has been fixed — say so in a reply only when it has been confirmed.',
    },

    operations: {
      title: 'News, sources & AI operations',
      purpose:
        'Which providers are answering, what mode the data is in, and how the AI layer behaves.',
      tabs: {
        news: 'News management',
        sources: 'Global sources',
        ai: 'AI intelligence',
        providers: 'AI providers',
      },
      providerHealthTitle: 'Provider health',
      providerHealthNote:
        'Live, from the provider health probe this platform already runs. Every registered provider is reported, including one that contributes no articles.',
      /*
        A-1 — the empty state for the NEWS provider table. It previously
        borrowed `aiProvidersRequirement`, which describes the AI analysis
        provider and asserts that no capability exists. Under this table that
        was wrong twice: wrong subsystem, and — because the table rendered the
        same copy on a failed fetch — it told the reader a working capability
        was missing. This wording claims only what a successful empty read
        actually establishes.
      */
      providerHealthEmptyTitle: 'No providers reported',
      providerHealthEmptyBody:
        'The request succeeded and returned no provider. This is a reading, not an absence of capability.',
      columns: {
        provider: 'Provider',
        health: 'Health',
        mode: 'Mode',
        serving: 'Serving reads',
        kind: 'Source',
        checkedAt: 'Last checked',
        requests: 'Requests',
        failures: 'Failures',
        latency: 'Latency',
        lastSuccess: 'Last success',
        rateLimit: 'Rate limit',
      },
      serving: {
        yes: 'Serving',
        no: 'Idle',
      },
      providerKinds: {
        REAL: 'Real source',
        MOCK: 'Synthetic',
        UNKNOWN: 'Unidentified',
      },
      servingNote:
        'Registered is not the same as serving. Only a provider marked Serving answers reads; a synthetic provider marked Serving means this deployment is returning generated news rather than real news.',
      countersNote:
        'The per-provider counters are declared by the provider health contract but populated by no provider, so they read UNKNOWN. A zero here would be a measurement that was never taken.',
      articlesTitle: 'Article inventory',
      articlesRequirement:
        'Requires an administrative article endpoint. The stored articles exist; no admin-shaped read does.',
      aiOpsTitle: 'AI operations',
      aiOpsRequirement:
        'Analysis provenance is returned per request and never persisted, so nothing counts it.',
      aiProvidersTitle: 'AI providers',
      aiProvidersRequirement:
        'Requires an AI provider health probe. None exists — status is only observable by running a real analysis.',
      modulesTitle: 'Intelligence modules',
      modulesRequirement:
        'Requires an operational module registry. None exists. This is not the public homepage Intelligence Engine.',
      claimsRemovedNote:
        'Accuracy, "AI verified" and "fact checked" claims are deliberately absent. They have no backend contract defining what they would mean.',
    },

    systemHealth: {
      title: 'System health',
      purpose: 'The platform’s actual condition, including "we do not know".',
      overallTitle: 'Overall status',
      overallNote:
        'Worst probed component wins. A platform with an unprobed component is not a healthy platform, so while any component reads UNKNOWN the overall status cannot read HEALTHY.',
      probedSummary: 'components probed',
      componentsTitle: 'Components',
      incidentsTitle: 'Incidents',
      incidentsRequirement: 'Requires an incident store. None exists.',
      components: {
        FRONTEND: 'Frontend',
        BACKEND: 'Backend API',
        DATABASE: 'Database',
        NEWS_PROVIDER: 'News provider',
        AI_PROVIDER: 'AI provider',
        AUTHENTICATION: 'Authentication',
        BACKGROUND_SERVICES: 'Background services',
        KSEF_INTEGRATION: 'KSeF integration',
      },
      statuses: {
        HEALTHY: 'HEALTHY',
        DEGRADED: 'DEGRADED',
        FAILING: 'FAILING',
        UNKNOWN: 'UNKNOWN',
        NOT_IMPLEMENTED: 'NOT IMPLEMENTED',
      },
      details: {
        'process-serving-requests': 'The process answered this request.',
        'database-reachable': 'Connectivity check succeeded.',
        'database-unreachable': 'Connectivity check failed.',
        'all-providers-ok': 'Every registered provider reported healthy.',
        'some-providers-degraded': 'At least one provider reported degraded.',
        'some-providers-down': 'At least one provider reported down.',
        'oauth-configured': 'Sign-in credentials are configured.',
        'oauth-not-configured':
          'Sign-in cannot start: at least one required credential is missing. Which one is deliberately not reported here.',
        'ai-provider-configured': 'A real analysis provider is configured and would answer.',
        'ai-provider-mock-active':
          'No analysis key is configured, so synthetic analysis would answer. Correct for development, never for production.',
        'ai-provider-not-configured': 'Production analysis is required but no key is configured.',
        'no-probe-configured': 'No probe is configured for this component.',
        'not-implemented': 'This component is planned and has no implementation.',
      },
      ingestionTitle: 'Ingestion liveness',
      ingestionNote:
        'Whether this deployment is actually holding and fetching articles. Aggregated over stored articles only — no user, session, search or location data is read to produce it.',
      ingestionCountLabel: 'Articles stored',
      ingestionLatestLabel: 'Last article fetched',
      lastProbeAt: 'Last probe',
      neverProbed: 'Never probed',
    },

    systemLogs: {
      title: 'System logs',
      purpose: 'The diagnostic log stream needed to investigate an incident.',
      requirement:
        'Requires a queryable log store. Logs are written to process output with a correlation id, which is not a store that can be searched or filtered.',
      correlationNote:
        'Request correlation itself is real: every request carries an X-Request-Id, and that id is the only join between system logs and audit records.',
    },

    audit: {
      title: 'Audit logs & admin security',
      purpose:
        'Every security-sensitive and administrative action traceable, searchable and exportable as evidence.',
      noStoreTitle: 'No audit store exists yet',
      noStoreBody:
        'This is not an empty result set. There is no append-only audit store in this platform, so there are no records to show, filter or export. The action classes below are the approved contract for when one is built.',
      actionClassesTitle: 'Audited action classes',
      recordShapeTitle: 'Audit record',
      separationNote:
        'System logs and audit records are different stores with different retention and different guarantees. They are never merged; the correlation id is the only join.',
      readOnlyNote:
        'Audit is read-only for every role. There is no update or delete path by design.',
    },

    settings: {
      title: 'Platform settings',
      purpose: 'Configuration, retention and access policy.',
      groups: {
        taxInvoicing: 'Tax & invoicing',
        ksef: 'KSeF',
        providers: 'Providers',
        access: 'Access',
        retention: 'Data & retention',
        localisation: 'Localisation',
      },
      requirement:
        'Requires a runtime settings store. Configuration is read from the environment at start-up and cannot be changed from this platform.',
      localisation: {
        adminLanguages: 'Admin languages',
        adminLanguagesValue: 'English, Polski',
        dateFormat: 'Date format',
        numberFormat: 'Number format',
        timezone: 'Timezone',
      },
      secretsNote:
        'No API key, OAuth secret or connection string is displayed here, and none will be editable from a web interface.',
    },
  },
};

/**
 * Deliberately NOT `as const`. The repository already carries a
 * regression guard for exactly this: an `as const` dictionary produces
 * literal types, which makes the Polish dictionary a type error rather
 * than a structural mirror (see dictionaries/index.spec.ts, "regression
 * guard for the as-const type bug found during homepage integration").
 */
export type AdminDictionary = typeof adminEn;
