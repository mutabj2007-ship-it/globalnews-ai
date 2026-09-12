import type { AdminRoleName } from '../rbac/capabilities';

/**
 * ADMIN-03 — the Admin analytics, coverage-geography and account
 * contracts.
 *
 * ADMIN-LOCAL, LIKE admin-system.contract.ts, AND FOR THE SAME REASON:
 * this lane is authorized to change no shared file. The frontend mirrors
 * these literals in `frontend/src/lib/admin/adminApiTypes.ts` and
 * `adminApiContract.spec.ts` reads both files and fails on drift, so the
 * duplication cannot rot silently. Move it into shared the next time a
 * shared change is authorized.
 *
 * THE RULE THIS WHOLE FILE EXISTS TO ENFORCE. A dashboard card is not
 * evidence that a measurement exists. Every field below is something
 * this platform genuinely persists today; everything the design asks for
 * that it does not persist is ABSENT FROM THIS CONTRACT ENTIRELY rather
 * than present and empty. There is no field here for active users, for
 * sessions over a window, for languages, for client errors, for
 * retention cohorts, for audience location or for subscriptions, because
 * there is no source of truth for any of them and a nullable field that
 * nothing ever fills eventually gets rendered as a zero by somebody who
 * did not read this comment.
 *
 * THREE RULES INHERITED FROM admin-system.contract.ts, UNCHANGED:
 *   - machine keys, never prose. The surface is EN and PL, so a sentence
 *     returned from the backend is untranslatable by construction.
 *   - a genuine counter is OMITTED when unpopulated, never zero-filled.
 *   - a section is null when it could NOT BE READ. Null is a failure,
 *     never an absence and never a zero.
 */

/** A counted dimension. `key` is always a machine value, never prose. */
export interface AdminAnalyticsCount {
  key: string;
  count: number;
}

/**
 * Analysis runs grouped by the provider that served them.
 *
 * `model` is null for mock analysis, which reports no model. That null
 * is a real property of the row, not a read failure.
 */
export interface AdminAnalyticsProviderCount {
  provider: string;
  model: string | null;
  count: number;
}

/**
 * An aggregate over a NULLABLE column, carrying the number of rows that
 * actually had a value.
 *
 * `sampleCount` IS NOT DECORATION. AnalysisRun.latencyMs and the three
 * token columns are all nullable, so an average over them is an average
 * over an unknown subset unless the subset size travels with it. A mean
 * latency computed from two rows out of nine hundred is not a latency
 * measurement, and without this field nothing on the screen could tell
 * the difference.
 *
 * The aggregate fields are omitted entirely when sampleCount is 0.
 */
export interface AdminAnalyticsSample {
  sampleCount: number;
  averageMs?: number;
  minMs?: number;
  maxMs?: number;
}

export interface AdminAnalyticsTokenTotals {
  sampleCount: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * Account aggregates. SIGNED-IN ACCOUNTS ONLY, WHICH IS THE WHOLE
 * CAVEAT: GlobalNews AI is usable without an account and no public route
 * requires sign-in, so every number here describes a subset of real
 * usage whose size is unknown.
 *
 * `observedReturningLast24h` AND `observedReturningLast7d` ARE NOT
 * ACTIVE USERS, AND MUST NEVER BE RENDERED AS ACTIVE USERS. They count
 * accounts whose User.lastSeenAt falls inside the window, and
 * lastSeenAt is written ONLY by the return surface. An account that
 * read the whole day without hitting that surface is not counted, and
 * an anonymous reader can never be counted at all. "Active users" has
 * no source of truth in this platform; this is a different, narrower
 * measurement that happens to share a shape with it, which is exactly
 * how a fabricated metric gets born. It is named for what it measures.
 *
 * `neverObservedReturning` counts accounts whose lastSeenAt is NULL.
 * NULL means "never observed", never "inactive".
 */
export interface AdminAccountAggregates {
  total: number;
  createdLast24h: number;
  createdLast7d: number;
  observedReturningLast24h: number;
  observedReturningLast7d: number;
  neverObservedReturning: number;
}

/**
 * Analysis-run aggregates, from the AnalysisRun table R3/T7 populates
 * server-side on every completed request.
 *
 * THIS IS THE RICHEST GENUINELY POPULATED SOURCE IN THE PLATFORM, and
 * the one place where a live figure needs no new instrumentation.
 *
 * NOT "AI QUESTIONS". A row here is one analysis REQUEST the server
 * served -- including cached responses, validation rejections and
 * failures. It is not a count of questions a human asked, and the two
 * diverge as soon as anything retries. The grouped counts cover the
 * long window.
 */
export interface AdminAnalysisAggregates {
  runsLast24h: number;
  runsLast7d: number;
  byStatus: AdminAnalyticsCount[];
  byFailureReason: AdminAnalyticsCount[];
  byProvider: AdminAnalyticsProviderCount[];
  cacheHits: number;
  cacheMisses: number;
  latency: AdminAnalyticsSample;
  tokens: AdminAnalyticsTokenTotals;
}

/**
 * Recorded product events, AND THE DISCLOSURE THAT MAKES THEM HONEST.
 *
 * ProductEvent declares twelve event names. FIVE have an emitter --
 * all five are emitted by this server's own code after work it already
 * did. The remaining SEVEN describe client interactions, and although
 * the public ingest endpoint that would accept them exists, is rate
 * limited and is privacy reviewed, NO CLIENT CALLS IT. Those seven
 * names cannot appear in the table at all.
 *
 * So a "top features" panel built from this data would rank five
 * server-side events and silently omit every interaction a person
 * actually performs. Presenting that as feature usage would be false.
 * The two name lists travel WITH the counts so the screen can state the
 * gap rather than imply completeness, and
 * `admin-analytics.instrumentation.spec.ts` re-derives the instrumented
 * list from the emitter call sites on every run -- so wiring a client
 * emitter later fails the spec until this list is corrected.
 *
 * `recorded` contains only names actually present in the window. A name
 * with no rows is absent, not zero: nobody measured a zero for an event
 * that cannot be emitted.
 */
export interface AdminProductEventAggregates {
  recorded: AdminAnalyticsCount[];
  instrumentedEventNames: string[];
  uninstrumentedEventNames: string[];
}

/**
 * R3/T7 records a 90-day retention rule for ProductEvent and
 * AnalysisRun. THERE IS NO SCHEDULER IN THIS BACKEND AND NO PURGE JOB,
 * so the rule is declared and not enforced.
 *
 * That gap was tolerable while nothing read these tables. Presenting
 * them on an admin screen makes it a property of the product, so it
 * travels in the response and is stated on the screen rather than
 * living only in a schema comment.
 */
export interface AdminRetentionDisclosure {
  declaredDays: number;
  enforced: boolean;
}

export interface AdminAnalyticsWindows {
  shortHours: number;
  longHours: number;
}

/**
 * GET /admin/analytics/usage -- capability analytics.view.
 *
 * AGGREGATES ONLY. There is no row, no identifier and no free text in
 * this response, and no column of ProductEvent that could carry a user
 * is selected by the service that builds it.
 *
 * Each section is null when its read FAILED. The frontend renders a
 * null section as an error with a retry, never as "no source" and never
 * as a zero -- that distinction is the A-1 finding, and this contract
 * preserves it by giving a failure its own representation.
 */
export interface AdminAnalyticsUsageResponse {
  accounts: AdminAccountAggregates | null;
  analysis: AdminAnalysisAggregates | null;
  events: AdminProductEventAggregates | null;
  retention: AdminRetentionDisclosure;
  windows: AdminAnalyticsWindows;
  generatedAt: string;
}

/**
 * One country's stored coverage.
 *
 * COVERAGE GEOGRAPHY IS WHERE PUBLISHED REPORTING IS ABOUT. It is not
 * where readers are, it is not derived from any request, and nothing in
 * this shape could be used to infer a location: every value is computed
 * over Article and ArticleCountry, which describe articles.
 */
export interface AdminCoverageCountry {
  countryCode: string;
  countryName: string;
  /** Rows where ArticleCountry.isRelevant is true. */
  relevantArticleCount: number;
  /** Every row for this country, relevant or not. */
  totalArticleCount: number;
}

/**
 * One country's DECLARED INTEREST, from CountryFollow.
 *
 * A THIRD CATEGORY, NAMED EXPLICITLY BECAUSE IT IS NEITHER OF THE OTHER
 * TWO. It is not coverage geography -- it says nothing about articles.
 * It is not audience geography -- it says nothing about where anyone
 * is. It is the set of countries signed-in accounts CHOSE to follow,
 * and a person in one country routinely follows another.
 *
 * The CTO-approved wording for this panel is exact:
 * "Followed countries -- declared interest, signed-in accounts only".
 *
 * KNOWN LIMITATION, STATED RATHER THAN SOLVED: at very small account
 * counts a follower count is a narrow cohort. It identifies nobody --
 * no account id leaves the service -- but it is thin, and no minimum
 * cohort suppression is applied because none was authorized.
 */
export interface AdminFollowedCountry {
  countryCode: string;
  followerAccountCount: number;
}

/**
 * GET /admin/analytics/coverage-geography -- capability analytics.view.
 *
 * AUDIENCE GEOGRAPHY IS ABSENT FROM THIS CONTRACT AND HAS NO FIELD.
 * This platform captures no IP address, performs no geo enrichment, and
 * its access logger deliberately never records a query string, so there
 * is nothing to compute it from. Audience location is never inferred
 * from coverage geography, followed countries, retrieval scope, UI
 * language or any AI output -- and the absence of a field is what makes
 * that structural rather than a matter of discipline.
 */
export interface AdminCoverageGeographyResponse {
  countries: AdminCoverageCountry[] | null;
  distinctCountriesWithRelevantCoverage: number | null;
  followedCountries: AdminFollowedCountry[] | null;
  /** The cap applied to `countries`, so a truncated list is never read as the whole. */
  countryLimit: number;
  generatedAt: string;
}

/**
 * One account, at the minimum an access-management view needs.
 *
 * WHAT IS DELIBERATELY ABSENT, BY CTO RULING AND BY CONSTRUCTION: the
 * address, any masked or partial form of it, its domain, any search
 * history text, any OAuth identity value, and any session token or
 * hash. There is no field here for any of them, so no future edit to a
 * screen can surface one without changing this contract first.
 *
 * displayName IS ALSO ABSENT, AND THAT IS A JUDGEMENT I AM FLAGGING
 * RATHER THAN BURYING. The ruling forbade six fields and did not name
 * displayName. It is, however, a real person's name taken from their
 * sign-in profile, and it identifies an individual about as well as the
 * address the ruling removed. "The minimum approved account-management
 * fields" reads to me as excluding it. No write path exists for any
 * account today -- no role assignment endpoint, by standing order -- so
 * nothing on this screen acts on a person, and the fields below answer
 * every question it can currently ask: how many accounts, when they
 * arrived, which hold a role, and whether they have been seen. If the
 * CTO wants a human-readable label, it is one field and one line.
 */
export interface AdminAccountRecord {
  id: string;
  createdAt: string;
  /** ISO-8601, or null for "never observed" -- never "inactive". */
  lastSeenAt: string | null;
  /** null means NOT an administrator. There is no NONE role. */
  adminRole: AdminRoleName | null;
}

/**
 * GET /admin/users -- capability access.manage, i.e. SUPER_ADMIN alone.
 *
 * NOT analytics.view. That capability is held by all four roles,
 * SUPPORT and ANALYST included, and the role matrix denies SUPPORT the
 * evidence-export capability precisely so that an operator handling one
 * person's data cannot bulk-export everyone's. A paginated list of every
 * account behind analytics.view would hand every role the bulk
 * enumeration that decision exists to refuse. The capability here is the
 * matrix row that already covers account administration.
 *
 * `byAdminRole` LIVES HERE RATHER THAN ON THE USAGE ENDPOINT for the
 * same reason: how many super administrators exist is access
 * information, and it does not belong behind a capability every role
 * holds.
 */
export interface AdminUsersResponse {
  accounts: AdminAccountRecord[] | null;
  totalCount: number | null;
  byAdminRole: AdminAnalyticsCount[] | null;
  page: number;
  pageSize: number;
  generatedAt: string;
}

/** The default and maximum page sizes, so no caller can request the whole table. */
export const ADMIN_USERS_PAGE_SIZE_DEFAULT = 25;
export const ADMIN_USERS_PAGE_SIZE_MAX = 100;

/** The cap on the coverage-geography country list. */
export const ADMIN_COVERAGE_COUNTRY_LIMIT = 25;

/** R3/T7's declared retention, and whether anything enforces it. */
export const ADMIN_TELEMETRY_RETENTION_DAYS = 90;
export const ADMIN_TELEMETRY_RETENTION_ENFORCED = false;

export const ADMIN_ANALYTICS_SHORT_WINDOW_HOURS = 24;
export const ADMIN_ANALYTICS_LONG_WINDOW_HOURS = 24 * 7;

/**
 * The five ProductEvent names that HAVE a server-side emitter today.
 *
 * Not a preference and not a plan -- a statement about the code, which
 * `admin-analytics.instrumentation.spec.ts` re-derives from the emitter
 * call sites and compares against this list on every run. Adding an
 * emitter without correcting this list fails that spec.
 */
export const INSTRUMENTED_PRODUCT_EVENT_NAMES = [
  'analysis_completed',
  'analysis_started',
  'follow_created',
  'follow_removed',
  'return_visit',
] as const;
