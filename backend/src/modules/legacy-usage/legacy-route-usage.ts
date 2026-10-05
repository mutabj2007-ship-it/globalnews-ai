import { Logger } from '@nestjs/common';

/**
 * STAGE 2 / T4 — LEGACY ROUTE USAGE: PROVE (OR DISPROVE) THAT ANYONE STILL CALLS THE LEGACY
 * ANALYSIS FAMILY, WITHOUT LEARNING WHO THEY ARE OR WHAT THEY ASKED.
 *
 * Every mounted Ask surface at Alpha (5513275f) and Production (58f80fd4) sends questions to
 * Ask V2. POST /analysis/news, GET /news/search and the SearchHistoryEntry reads behind
 * GET|DELETE /history are still served, and nothing measured whether any caller still uses
 * them. This file is that measurement. It decides one thing — when the public legacy route can
 * become internal-only — so it records only what that decision needs:
 *
 *   route        a fixed literal, never the URL (no query string, no path parameter);
 *   caller       a COARSE bucket: a known frontend route when the Referer/Origin is this
 *                deployment's FRONTEND_ORIGIN, else 'frontend-other', 'external' or 'none';
 *   auth         'signed-in' | 'anonymous' | 'not-assessed' — a class, never an account;
 *   uaFamily     a browser/script FAMILY from a fixed list, never the user-agent string;
 *   at           the time.
 *
 * NEVER RECORDED: the query or body, the full Referer/Origin URL or its query string, an IP or
 * forwarded address, a cookie, a session, a user id, the raw user-agent. The raw header values
 * are read once, reduced to a bucket from a closed enum, and dropped; nothing below holds a
 * reference to them. Every stored value is one of a finite set of literals, so the counters have
 * bounded cardinality and cannot become a behavioural log.
 *
 * WHY THIS IS NOT IN modules/telemetry. That module's privacy contract is that no telemetry file
 * reads a header at all (telemetry.privacy.spec.ts), and that contract is left exactly as it is.
 * A caller-class measurement needs the Referer/Origin path and the user-agent family, so it lives
 * here, behind its own privacy spec, and reduces both to buckets at the boundary.
 *
 * WHY NO PERSISTENCE. ProductEvent's twelve names are a closed Prisma enum and AnalysisRun has
 * no column for a route or caller; carrying this would need a migration. So: a structured log
 * line per request (searchable in the platform log drain, survives restarts) plus in-process
 * counters read through the admin-only GET /admin/analytics/legacy-usage. Like every other
 * in-process counter in this backend the counters are PER INSTANCE and reset on restart; the
 * readout says so (`scope: 'process'`, `countingSince`).
 *
 * A MEASUREMENT FAILURE NEVER FAILS THE REQUEST. `record()` is wrapped by the interceptor.
 */

export const LEGACY_ROUTES = [
  'POST /analysis/news',
  'GET /news/search',
  'GET /history',
  'DELETE /history',
] as const;
export type LegacyRoute = (typeof LEGACY_ROUTES)[number];

/** Known frontend routes a legacy request could be attributed to. Closed list. */
export const CALLER_ROUTE_BUCKETS = [
  '/',
  '/ask',
  '/ask/*',
  '/search',
  '/my-intelligence',
  '/history',
  '/map',
  '/saved',
  '/admin/*',
] as const;
export type CallerClass =
  `frontend:${(typeof CALLER_ROUTE_BUCKETS)[number]}` | 'frontend-other' | 'external' | 'none';

export type AuthClass = 'signed-in' | 'anonymous' | 'not-assessed';

export const UA_FAMILIES = [
  'edge',
  'chrome',
  'firefox',
  'safari',
  'other-browser',
  'bot',
  'script',
  'none',
] as const;
export type UaFamily = (typeof UA_FAMILIES)[number];

export interface LegacyUsageEvent {
  event: 'legacy_route_use';
  route: LegacyRoute;
  caller: CallerClass;
  auth: AuthClass;
  uaFamily: UaFamily;
  at: string;
}

/** The only request shape this file accepts: two optional header strings, already chosen. */
export interface LegacyCallerSignals {
  referer?: string;
  origin?: string;
  userAgentHeader?: string;
}

/** Hosts this deployment's frontend is served from, from FRONTEND_ORIGIN (comma-separated). */
export function frontendHosts(
  frontendOrigin: string | undefined = process.env.FRONTEND_ORIGIN,
): string[] {
  const hosts = (frontendOrigin ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        return [new URL(value).host.toLowerCase()];
      } catch {
        return [];
      }
    });
  return hosts.length > 0 ? hosts : ['localhost:3000'];
}

function routeBucket(pathname: string): CallerClass {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return 'frontend:/';
  if (path === '/ask') return 'frontend:/ask';
  if (path.startsWith('/ask/')) return 'frontend:/ask/*';
  if (path === '/admin' || path.startsWith('/admin/')) return 'frontend:/admin/*';
  for (const bucket of ['/search', '/my-intelligence', '/history', '/map', '/saved'] as const) {
    if (path === bucket) return `frontend:${bucket}`;
  }
  return 'frontend-other';
}

/**
 * Referer first (it carries the page path), Origin second (host only → 'frontend-other' when it
 * is ours). Only the URL's host and pathname are inspected; the query string and fragment are
 * never read.
 */
export function classifyCaller(
  signals: Pick<LegacyCallerSignals, 'referer' | 'origin'>,
  hosts: readonly string[] = frontendHosts(),
): CallerClass {
  const candidate = signals.referer || signals.origin;
  if (!candidate) return 'none';
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return 'external';
  }
  if (!hosts.includes(url.host.toLowerCase())) return 'external';
  if (!signals.referer) return 'frontend-other';
  return routeBucket(url.pathname);
}

export function classifyUserAgent(value: string | undefined): UaFamily {
  if (!value) return 'none';
  const ua = value.toLowerCase();
  if (/bot\b|crawler|spider|slurp|preview/.test(ua)) return 'bot';
  if (
    /^(curl|wget|python|node|undici|axios|go-http|java\/|okhttp|postman|insomnia|k6|libwww|httpie)/.test(
      ua,
    )
  ) {
    return 'script';
  }
  if (/headlesschrome|playwright|puppeteer/.test(ua)) return 'script';
  if (/edg\//.test(ua)) return 'edge';
  if (/firefox\/|fxios\//.test(ua)) return 'firefox';
  if (/chrome\/|crios\//.test(ua)) return 'chrome';
  if (/safari\//.test(ua)) return 'safari';
  if (/mozilla\//.test(ua)) return 'other-browser';
  return 'script';
}

export interface LegacyRouteCounters {
  route: LegacyRoute;
  total: number;
  lastSeenAt: string | null;
  byCaller: Array<{ key: string; count: number }>;
  byAuth: Array<{ key: string; count: number }>;
  byUaFamily: Array<{ key: string; count: number }>;
}

export interface LegacyUsageSnapshot {
  scope: 'process';
  countingSince: string;
  routes: LegacyRouteCounters[];
  generatedAt: string;
}

interface MutableCounters {
  total: number;
  lastSeenAt: string | null;
  byCaller: Map<string, number>;
  byAuth: Map<string, number>;
  byUaFamily: Map<string, number>;
}

const sorted = (map: Map<string, number>): Array<{ key: string; count: number }> =>
  [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

export class LegacyRouteUsageRegistry {
  private readonly logger = new Logger('LegacyRouteUsage');
  private countingSince: string;
  private counters = new Map<LegacyRoute, MutableCounters>();

  constructor(private readonly now: () => Date = () => new Date()) {
    this.countingSince = this.now().toISOString();
  }

  /** Classify, count and log ONE legacy request. Returns the event exactly as logged. */
  record(
    route: LegacyRoute,
    signals: LegacyCallerSignals,
    auth: AuthClass,
    hosts: readonly string[] = frontendHosts(),
  ): LegacyUsageEvent {
    const event: LegacyUsageEvent = {
      event: 'legacy_route_use',
      route,
      caller: classifyCaller(signals, hosts),
      auth,
      uaFamily: classifyUserAgent(signals.userAgentHeader),
      at: this.now().toISOString(),
    };

    let entry = this.counters.get(route);
    if (!entry) {
      entry = {
        total: 0,
        lastSeenAt: null,
        byCaller: new Map(),
        byAuth: new Map(),
        byUaFamily: new Map(),
      };
      this.counters.set(route, entry);
    }
    entry.total += 1;
    entry.lastSeenAt = event.at;
    entry.byCaller.set(event.caller, (entry.byCaller.get(event.caller) ?? 0) + 1);
    entry.byAuth.set(event.auth, (entry.byAuth.get(event.auth) ?? 0) + 1);
    entry.byUaFamily.set(event.uaFamily, (entry.byUaFamily.get(event.uaFamily) ?? 0) + 1);

    this.logger.log(JSON.stringify(event));
    return event;
  }

  /** Every legacy route is listed, a route with no traffic as total 0 — a measured zero. */
  snapshot(): LegacyUsageSnapshot {
    return {
      scope: 'process',
      countingSince: this.countingSince,
      routes: LEGACY_ROUTES.map((route) => {
        const entry = this.counters.get(route);
        return {
          route,
          total: entry?.total ?? 0,
          lastSeenAt: entry?.lastSeenAt ?? null,
          byCaller: entry ? sorted(entry.byCaller) : [],
          byAuth: entry ? sorted(entry.byAuth) : [],
          byUaFamily: entry ? sorted(entry.byUaFamily) : [],
        };
      }),
      generatedAt: this.now().toISOString(),
    };
  }

  /** Test seam only. */
  reset(): void {
    this.counters = new Map();
    this.countingSince = this.now().toISOString();
  }
}

/**
 * ONE registry per process, shared by the per-route interceptors and the admin readout without
 * DI: the interceptors are attached as instances (`@UseInterceptors(new …)`) and the admin
 * controller must stay constructible by the existing AdminModule test graphs, so neither can
 * depend on a provider those graphs do not register.
 */
export const legacyRouteUsage = new LegacyRouteUsageRegistry();
