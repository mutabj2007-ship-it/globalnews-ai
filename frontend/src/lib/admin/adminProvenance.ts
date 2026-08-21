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
  'admin-02.sessions': 'B',
  'admin-02.countriesWithActivity': 'C', // no request metadata is stored
  'admin-02.analysisRequests': 'C', //  AnalysisProvenance is never persisted
  'admin-02.providerErrors': 'C', //    counters declared, populated by nobody
  'admin-02.reachMap': 'C',
  'admin-02.pipelineMode': 'A', //      NewsDataMode, on every news response
  'admin-02.alerts': 'C',

  // ── ADMIN-03 Users, usage & geography ─────────────────────────────
  'admin-03.languagePerSession': 'C', // design said A: never persisted
  'admin-03.newUsers': 'B', //          User.createdAt
  'admin-03.activeReturning': 'C',
  'admin-03.audienceGeography': 'C', // design said B: no request metadata
  'admin-03.contentGeography': 'B', //  ArticleCountry — real, needs a rollup
  'admin-03.featureUsage': 'C',
  'admin-03.retention': 'C',
  'admin-03.userRecords': 'B',
  'admin-03.subscriptions': 'C',
  'admin-03.clientErrors': 'C',

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
  'admin-05.tickets': 'C', //           design said A: no ticket model
  'admin-05.userReplies': 'C', //       design said A: no messaging capability
  'admin-05.internalNotes': 'C',
  'admin-05.ticketAudit': 'C',
  'admin-05.sla': 'C',

  // ── ADMIN-06 News, sources & AI operations ────────────────────────
  'admin-06.providerHealth': 'A', //    GET /admin/news/providers (F1.b)
  'admin-06.providerMode': 'A', //      NewsDataMode
  'admin-06.providerCounters': 'C', //  design said A: declared, never populated
  'admin-06.articleLanguage': 'C', //   design said A: not persisted
  'admin-06.articleInventory': 'B',
  'admin-06.retrievalFreshness': 'C',
  'admin-06.rateLimitState': 'C',
  'admin-06.aiOperations': 'C',
  'admin-06.aiProviders': 'C',
  'admin-06.intelligenceModules': 'C',

  // ── ADMIN-07 System health & logs ─────────────────────────────────
  'admin-07.appProbe': 'A', //          GET /health
  'admin-07.databaseProbe': 'A', //     GET /health/ready
  'admin-07.newsProviderProbe': 'A', // GET /news/providers/health
  'admin-07.overallStatus': 'B', //     derived from the probes above
  'admin-07.frontendProbe': 'C',
  'admin-07.aiProviderProbe': 'C',
  'admin-07.authenticationProbe': 'C',
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
