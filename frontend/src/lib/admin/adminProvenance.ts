import { ADMIN_ROUTES } from './adminRoutes';

/**
 * F1.b — provenance, as a code-level constant on every rendered field.
 *
 *   A  existing backend data, readable from an endpoint today
 *   B  the rows exist, the rollup does not
 *   C  new backend capability required — no source of truth exists
 *   D  design sample only — must never ship as fact
 *
 * THE TAGS HERE ARE THE F0-VERIFIED ONES, NOT THE DESIGN'S ORIGINALS.
 * Claude Design tagged 46 fields without repository access; F0 re-ran the
 * instrument against the real backend and found 18 wrong, every one
 * optimistic. Nine fields tagged A have no backing data of any kind. The
 * corrected tags are the implementation truth the CTO accepted, and they
 * ship as data so a screen cannot quietly claim a better provenance than
 * the backend can support.
 *
 * `adminProvenance.spec.ts` asserts every rendered field has an entry
 * here and that the A-tagged entries are exactly the four capabilities
 * that genuinely exist today.
 */
export type ProvenanceTag = 'A' | 'B' | 'C' | 'D';

export const PROVENANCE = {
  // ── ADMIN-01 shell ────────────────────────────────────────────────
  'admin-01.identity': 'A', //  GET /admin/me
  'admin-01.role': 'A', //      GET /admin/me — real since F1.a
  'admin-01.capabilities': 'A', // GET /admin/me — derived server-side

  // ── ADMIN-02 Overview ─────────────────────────────────────────────
  'admin-02.articlesIngested': 'B', // design said A: rows exist, no endpoint
  'admin-02.activeUsers': 'C', //      design said B: no activity record exists
  // ADMIN-03 CORRECTION, CTO-AUTHORIZED. This was B -- "the rows exist,
  // the rollup does not" -- and that was wrong in a way B cannot express.
  // Session rows are DELETED on sign-out and again on expiry validation,
  // so the table holds only currently-valid sessions. No rollup over it
  // can ever produce a session count for a past window, however much
  // aggregation is written: the rows being counted are gone. That is C --
  // no source of truth exists -- not a missing endpoint.
  //
  // A count of CURRENT session records is a different, real measurement
  // and is not this field. ADMIN-03 implemented no session surface.
  'admin-02.sessions': 'C',
  'admin-02.countriesWithActivity': 'C', // no request metadata is stored
  // ADMIN-03 CORRECTION. This comment used to read "AnalysisProvenance
  // is never persisted", and that stopped being true at R3/T7: every
  // completed analysis is written to AnalysisRun, and
  // GET /admin/analytics/usage returns the aggregate. A is what A has
  // always meant here -- readable from an endpoint today. ADMIN-02's own
  // Overview screen does not consume it yet; that is screen wiring, not
  // provenance, and the same is already true of admin-07.appProbe.
  'admin-02.analysisRequests': 'A', // GET /admin/analytics/usage
  'admin-02.providerErrors': 'C', //    counters declared, populated by nobody
  'admin-02.reachMap': 'C',
  'admin-02.pipelineMode': 'A', //      NewsDataMode, on every news response
  'admin-02.alerts': 'C',

  // ── ADMIN-03 Users, usage & geography ─────────────────────────────
  // STILL C, AND CORRECTLY SO. Session-scoped language is not persisted
  // by anything, and ProductEvent.language -- the column that could hold
  // it -- is populated by none of the five emitters that exist.
  'admin-03.languagePerSession': 'C', // design said A: never persisted
  'admin-03.newUsers': 'A', //          GET /admin/analytics/usage
  // STILL C, AND THIS ONE IS A DISTINCTION WORTH KEEPING. This key
  // covers ACTIVE users, and active users have no source of truth: no
  // per-request activity is recorded, and anonymous readers -- most of
  // them -- can never be counted at all. The RETURNING half of the
  // original pairing is now real and has its own key below, precisely so
  // that a live number cannot be borrowed to fill an absent one.
  'admin-03.activeReturning': 'C',
  // STILL C, AND STRUCTURALLY SO. No address is captured, no geo
  // enrichment runs, and the access logger never records a query string.
  // The analytics contract has no field audience location could occupy.
  'admin-03.audienceGeography': 'C', // design said B: no request metadata
  'admin-03.contentGeography': 'A', //  GET /admin/analytics/coverage-geography
  // Recorded product events, WITH the instrumentation gap disclosed
  // beside them. Five of twelve names have an emitter; the panel says so
  // and does not present them as complete feature usage.
  'admin-03.featureUsage': 'A', //      GET /admin/analytics/usage
  'admin-03.retention': 'C',
  'admin-03.userRecords': 'A', //       GET /admin/users
  'admin-03.subscriptions': 'C',
  'admin-03.clientErrors': 'C',

  // ── ADMIN-03 fields ADDED by this lane ────────────────────────────
  // Each names a capability that did not exist before and could not be
  // expressed by an existing key without overstating it.
  //
  // NOT "active users". Accounts whose recorded return visit falls in
  // the window. An account that read all day without touching the
  // return surface is not here, and an anonymous reader never can be.
  'admin-03.observedReturnVisits': 'A', // GET /admin/analytics/usage
  // AnalysisRun rows. NOT "AI questions": a row is one request the
  // server served, cached responses and failures included.
  'admin-03.analysisRuns': 'A', //       GET /admin/analytics/usage
  // Declared interest -- which countries signed-in accounts follow.
  // Neither coverage geography nor audience geography, and named apart
  // from both wherever it is rendered.
  'admin-03.followedCountries': 'A', //  GET /admin/analytics/coverage-geography

  // ── ADMIN-04 Payments, taxes, Poland & KSeF ───────────────────────
  'admin-04.transactions': 'C', //      design said A: no payment model exists
  'admin-04.taxTreatment': 'C', //      design said A: zero tax logic
  'admin-04.customersNip': 'C', //      design said A: zero NIP concept
  'admin-04.invoices': 'C', //          design said A: zero invoice concept
  'admin-04.vatRegister': 'C',
  'admin-04.currencyFx': 'C',
  'admin-04.viesValidation': 'C',
  'admin-04.ksef': 'C',
  'admin-04.evidenceExports': 'C',
  'admin-04.traceability': 'C',

  // ── ADMIN-05 Feedback & support ───────────────────────────────────
  // S3 — the ticket model, the message model and the stored visibility
  // column all exist now (S1), and GET /admin/support/tickets returns
  // them (S3). These three are A because a real endpoint returns real
  // rows, which is exactly what A means. F0 tagged the first two C
  // against the F1.b codebase, where no ticket model existed at all;
  // that correction has been superseded by building the thing.
  'admin-05.tickets': 'A', //           GET /admin/support/tickets
  'admin-05.userReplies': 'A', //       GET /admin/support/tickets/:reference
  'admin-05.internalNotes': 'A', //     the same read, visibility INTERNAL
  // STILL C, AND NOT MOVED. S3 implemented neither, and neither is
  // approximated on the screen:
  'admin-05.ticketAudit': 'C', //       no audit store exists anywhere
  'admin-05.sla': 'C', //               no SLA model, target or clock exists

  // ── ADMIN-06 News, sources & AI operations ────────────────────────
  'admin-06.providerHealth': 'A', //    GET /admin/news/providers (F1.b)
  'admin-06.providerMode': 'A', //      NewsDataMode
  'admin-06.providerCounters': 'C', //  design said A: declared, never populated
  'admin-06.articleLanguage': 'C', //   design said A: not persisted
  'admin-06.articleInventory': 'A', // GET /admin/news/providers — measured retained Article inventory
  'admin-06.retrievalFreshness': 'A', // latest retained Article timestamp
  'admin-06.rateLimitState': 'A', // passive observed provider throttle state
  'admin-06.aiOperations': 'C',
  'admin-06.aiProviders': 'C',
  'admin-06.intelligenceModules': 'C',

  // ── ADMIN-07 System health & logs ─────────────────────────────────
  'admin-07.appProbe': 'A', //          GET /health
  'admin-07.databaseProbe': 'A', //     GET /health/ready
  'admin-07.newsProviderProbe': 'A', // GET /news/providers/health
  'admin-07.overallStatus': 'B', //     derived from the probes above
  'admin-07.frontendProbe': 'C',
  // MVP-G4 — both are now real backend reads (configuration state,
  // reported by GET /admin/system/health), so they graduate from C to A.
  'admin-07.aiProviderProbe': 'A', //   GET /admin/system/health (G4-2)
  'admin-07.authenticationProbe': 'A', // GET /admin/system/health (G4-1)
  // MVP-G4 (G4-5) — aggregations over the existing Article table, which
  // is exactly what B means. Not A: no endpoint returned these before.
  'admin-07.ingestionVolume': 'B',
  'admin-07.ingestionFreshness': 'B',
  'admin-07.backgroundServices': 'C',
  'admin-07.ksefIntegration': 'C',
  'admin-07.incidents': 'C',
  'admin-07.logStream': 'C',

  // ── ADMIN-08 Audit logs & admin security ──────────────────────────
  'admin-08.adminAuthEvents': 'C', //   design said A: no admin auth events
  'admin-08.auditStore': 'C',
  'admin-08.beforeAfter': 'C',
  'admin-08.sessionMetadata': 'C',
  'admin-08.evidenceExport': 'C',
  'admin-08.correlationId': 'A', //     X-Request-Id exists; retrieval does not

  // ── Settings ──────────────────────────────────────────────────────
  'settings.localisation': 'A', //      real, presentation-layer facts
  'settings.taxInvoicing': 'C',
  'settings.ksef': 'C',
  'settings.providers': 'C',
  'settings.access': 'C',
  'settings.retention': 'C',
} as const;

export type ProvenanceKey = keyof typeof PROVENANCE;

export function provenanceOf(key: ProvenanceKey): ProvenanceTag {
  return PROVENANCE[key];
}

/**
 * Guard used by the spec: no field may claim tag D. D is design sample
 * data, and design sample data does not ship.
 */
export const PROVENANCE_KEYS = Object.keys(PROVENANCE) as ProvenanceKey[];

/** Exported so the route manifest spec can assert the two files agree on screen coverage. */
export const PROVENANCE_SCREEN_PREFIXES = [
  'admin-01',
  'admin-02',
  'admin-03',
  'admin-04',
  'admin-05',
  'admin-06',
  'admin-07',
  'admin-08',
  'settings',
] as const;

/** Referenced so a route rename cannot silently orphan this registry. */
export const PROVENANCE_ANCHOR_ROUTE = ADMIN_ROUTES.overview;
