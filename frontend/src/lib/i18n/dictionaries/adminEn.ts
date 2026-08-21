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
        returning: 'RETURNING · 7D',
        sessions: 'SESSIONS · 24H',
        aiQuestions: 'AI QUESTIONS · 24H',
        clientErrors: 'CLIENT ERRORS · 24H',
      },
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
      notImplementedBody:
        'No ticket, message or notification capability exists in this platform, and the backend has no outbound messaging at all. The queue, thread and both composers are shown as the approved structure. No ticket, user or correspondence is displayed, because none exists.',
      queueTitle: 'Queue',
      threadTitle: 'Conversation',
      replyComposer: 'Reply to user',
      noteComposer: 'Internal note',
      visibilityUser: 'Visible to the user',
      visibilityInternal: 'Internal note — not visible to the user',
      visibilityNote:
        'Reply visibility will be a stored, server-enforced field, never a display convention.',
      requestTypesTitle: 'Request types',
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
      columns: {
        provider: 'Provider',
        health: 'Health',
        mode: 'Mode',
        checkedAt: 'Last checked',
        message: 'Detail',
        requests: 'Requests',
        failures: 'Failures',
        latency: 'Latency',
        lastSuccess: 'Last success',
        rateLimit: 'Rate limit',
      },
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
        'no-probe-configured': 'No probe is configured for this component.',
        'not-implemented': 'This component is planned and has no implementation.',
      },
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
