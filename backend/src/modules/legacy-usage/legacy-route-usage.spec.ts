import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Logger, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { lastValueFrom, of, throwError } from 'rxjs';
import {
  LEGACY_ROUTES,
  LegacyRouteUsageRegistry,
  classifyCaller,
  classifyUserAgent,
  frontendHosts,
  legacyRouteUsage,
} from './legacy-route-usage';
import { LegacyRouteUsageInterceptor } from './legacy-route-usage.interceptor';
import { AnalysisController } from '../analysis/controller/analysis.controller';
import { NewsController } from '../news/news.controller';
import { HistoryController } from '../history/history.controller';
import { AskV2Controller } from '../ask-v2/ask-v2.controller';
import { AdminLegacyUsageController } from '../admin/legacy-usage/admin-legacy-usage.controller';

/**
 * STAGE 2 / T4 — legacy-route usage telemetry.
 *
 * The promises, in order of importance:
 *   1. NO PII: no query text, no IP, no user id, no raw header value is ever stored or logged.
 *   2. Counts increment per legacy request, bucketed into closed enums.
 *   3. Ask V2 traffic is never counted: the interceptor is attached to legacy handlers only.
 *   4. Legacy behaviour is unchanged: the handler's response (or error) passes through as-is,
 *      and a measurement failure cannot fail the request.
 */

const HOSTS = ['alpha.example.test'];
const BODY_QUERY = 'what is happening to opposition leader Jane Example in Nairobi?';
const USER_ID = 'user-cuid-123456';
const IP = '203.0.113.77';
const UA_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

const httpContext = (request: Record<string, unknown>): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;
const handler = (payload: unknown): CallHandler =>
  ({ handle: () => of(payload) }) as unknown as CallHandler;

function legacyRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    method: 'POST',
    path: '/analysis/news',
    url: `/analysis/news?q=${encodeURIComponent(BODY_QUERY)}`,
    ip: IP,
    ips: [IP],
    body: { query: BODY_QUERY },
    user: { id: USER_ID },
    cookies: { gna_session: 'raw-session-token' },
    headers: {
      referer: `https://alpha.example.test/search?q=${encodeURIComponent(BODY_QUERY)}#frag`,
      origin: 'https://alpha.example.test',
      'user-agent': UA_CHROME,
      'x-forwarded-for': IP,
      cookie: 'gna_session=raw-session-token',
    },
    ...overrides,
  };
}

describe('T4 — caller and user-agent classification is coarse and closed', () => {
  it('maps a same-origin Referer to a known frontend route bucket, ignoring the query string', () => {
    expect(classifyCaller({ referer: 'https://alpha.example.test/search?q=x' }, HOSTS)).toBe(
      'frontend:/search',
    );
    expect(classifyCaller({ referer: 'https://alpha.example.test/' }, HOSTS)).toBe('frontend:/');
    expect(classifyCaller({ referer: 'https://alpha.example.test/ask/recent' }, HOSTS)).toBe(
      'frontend:/ask/*',
    );
    expect(classifyCaller({ referer: 'https://alpha.example.test/my-intelligence/' }, HOSTS)).toBe(
      'frontend:/my-intelligence',
    );
    expect(classifyCaller({ referer: 'https://alpha.example.test/some/unknown' }, HOSTS)).toBe(
      'frontend-other',
    );
  });

  it('origin-only same-host is frontend-other; foreign hosts are external; nothing is none', () => {
    expect(classifyCaller({ origin: 'https://alpha.example.test' }, HOSTS)).toBe('frontend-other');
    expect(classifyCaller({ referer: 'https://evil.example/search' }, HOSTS)).toBe('external');
    expect(classifyCaller({ referer: 'not a url' }, HOSTS)).toBe('external');
    expect(classifyCaller({}, HOSTS)).toBe('none');
  });

  it('frontendHosts reads FRONTEND_ORIGIN (comma-separated), defaulting to local dev', () => {
    expect(frontendHosts('https://a.test, https://b.test:8443')).toEqual(['a.test', 'b.test:8443']);
    expect(frontendHosts(undefined)).toEqual(['localhost:3000']);
    expect(frontendHosts('garbage')).toEqual(['localhost:3000']);
  });

  it('reduces a user-agent to a family from a fixed list', () => {
    expect(classifyUserAgent(UA_CHROME)).toBe('chrome');
    expect(classifyUserAgent('Mozilla/5.0 ... Chrome/129.0 Safari/537.36 Edg/129.0')).toBe('edge');
    expect(classifyUserAgent('Mozilla/5.0 (X11; Linux) Gecko/20100101 Firefox/131.0')).toBe(
      'firefox',
    );
    expect(
      classifyUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605 Version/18.0 Safari/604.1',
      ),
    ).toBe('safari');
    expect(classifyUserAgent('curl/8.5.0')).toBe('script');
    expect(classifyUserAgent('node')).toBe('script');
    expect(classifyUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe('bot');
    expect(classifyUserAgent(undefined)).toBe('none');
  });
});

describe('T4 — the registry counts, and stores nothing identifying', () => {
  const fixed = () => new Date('2026-10-04T12:00:00.000Z');

  it('counts increment per route and per bucket; untouched routes report a measured zero', () => {
    const registry = new LegacyRouteUsageRegistry(fixed);
    registry.record(
      'POST /analysis/news',
      { referer: 'https://alpha.example.test/search', userAgentHeader: UA_CHROME },
      'anonymous',
      HOSTS,
    );
    registry.record(
      'POST /analysis/news',
      { referer: 'https://alpha.example.test/search', userAgentHeader: UA_CHROME },
      'signed-in',
      HOSTS,
    );
    registry.record('POST /analysis/news', { userAgentHeader: 'curl/8' }, 'anonymous', HOSTS);

    const snapshot = registry.snapshot();
    expect(snapshot.scope).toBe('process');
    expect(snapshot.routes.map((r) => r.route)).toEqual([...LEGACY_ROUTES]);
    const analysis = snapshot.routes.find((r) => r.route === 'POST /analysis/news')!;
    expect(analysis.total).toBe(3);
    expect(analysis.lastSeenAt).toBe('2026-10-04T12:00:00.000Z');
    expect(analysis.byCaller).toEqual([
      { key: 'frontend:/search', count: 2 },
      { key: 'none', count: 1 },
    ]);
    expect(analysis.byAuth).toEqual([
      { key: 'anonymous', count: 2 },
      { key: 'signed-in', count: 1 },
    ]);
    expect(analysis.byUaFamily).toEqual([
      { key: 'chrome', count: 2 },
      { key: 'script', count: 1 },
    ]);
    const search = snapshot.routes.find((r) => r.route === 'GET /news/search')!;
    expect(search).toEqual({
      route: 'GET /news/search',
      total: 0,
      lastSeenAt: null,
      byCaller: [],
      byAuth: [],
      byUaFamily: [],
    });
  });

  it('the logged event has exactly the six allowed keys and no request-derived free text', () => {
    const registry = new LegacyRouteUsageRegistry(fixed);
    const logged: string[] = [];
    const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
    const previousOrigin = process.env.FRONTEND_ORIGIN;
    process.env.FRONTEND_ORIGIN = 'https://alpha.example.test';
    try {
      const interceptor = new LegacyRouteUsageInterceptor(
        'POST /analysis/news',
        () => 'signed-in',
        registry,
      );
      interceptor.intercept(httpContext(legacyRequest()), handler({ ok: true }));
    } finally {
      spy.mockRestore();
      if (previousOrigin === undefined) delete process.env.FRONTEND_ORIGIN;
      else process.env.FRONTEND_ORIGIN = previousOrigin;
    }

    expect(logged).toHaveLength(1);
    const event = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(Object.keys(event).sort()).toEqual([
      'at',
      'auth',
      'caller',
      'event',
      'route',
      'uaFamily',
    ]);
    expect(event).toMatchObject({
      event: 'legacy_route_use',
      route: 'POST /analysis/news',
      caller: 'frontend:/search',
      auth: 'signed-in',
      uaFamily: 'chrome',
    });

    const everything = logged[0] + JSON.stringify(registry.snapshot());
    for (const forbidden of [
      'Jane',
      'Nairobi',
      encodeURIComponent(BODY_QUERY),
      USER_ID,
      IP,
      'raw-session-token',
      'Windows NT',
      'AppleWebKit',
      'alpha.example.test',
      '#frag',
      '?q=',
    ]) {
      expect({ forbidden, present: everything.includes(forbidden) }).toEqual({
        forbidden,
        present: false,
      });
    }
  });

  it('the source never reads an IP, a cookie, the body, the URL or a user', () => {
    const dir = __dirname;
    const product = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
    expect(product.sort()).toEqual(['legacy-route-usage.interceptor.ts', 'legacy-route-usage.ts']);
    for (const file of product) {
      const code = readFileSync(join(dir, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      for (const forbidden of [
        /\.ip\b/,
        /\.ips\b/,
        /x-forwarded-for/i,
        /cookie/i,
        /\.body\b/,
        /\.url\b/,
        /\.user\b/,
        /userId/,
        /\.query\b/,
      ]) {
        expect({ file, forbidden: String(forbidden), hit: forbidden.test(code) }).toEqual({
          file,
          forbidden: String(forbidden),
          hit: false,
        });
      }
    }
  });
});

describe('T4 — legacy behaviour is unchanged by the interceptor', () => {
  it('passes the handler response through untouched', async () => {
    const registry = new LegacyRouteUsageRegistry();
    const payload = { provenance: { status: 'success' }, articles: [1, 2] };
    const interceptor = new LegacyRouteUsageInterceptor('POST /analysis/news', undefined, registry);
    await expect(
      lastValueFrom(interceptor.intercept(httpContext(legacyRequest()), handler(payload))),
    ).resolves.toBe(payload);
  });

  it('passes a handler error through, and the request is still counted', async () => {
    const registry = new LegacyRouteUsageRegistry();
    const interceptor = new LegacyRouteUsageInterceptor('GET /news/search', undefined, registry);
    const failing = {
      handle: () => throwError(() => new Error('provider down')),
    } as unknown as CallHandler;
    await expect(
      lastValueFrom(interceptor.intercept(httpContext(legacyRequest()), failing)),
    ).rejects.toThrow('provider down');
    expect(registry.snapshot().routes.find((r) => r.route === 'GET /news/search')!.total).toBe(1);
    expect(registry.snapshot().routes.find((r) => r.route === 'GET /news/search')!.byAuth).toEqual([
      { key: 'not-assessed', count: 1 },
    ]);
  });

  it('a measurement failure never fails the request', async () => {
    const broken = {
      record: () => {
        throw new Error('boom');
      },
    } as unknown as LegacyRouteUsageRegistry;
    const interceptor = new LegacyRouteUsageInterceptor('POST /analysis/news', undefined, broken);
    await expect(
      lastValueFrom(interceptor.intercept(httpContext(legacyRequest()), handler('ok'))),
    ).resolves.toBe('ok');
    const noRequest = {
      switchToHttp: () => {
        throw new Error('no http');
      },
    } as unknown as ExecutionContext;
    await expect(lastValueFrom(interceptor.intercept(noRequest, handler('ok')))).resolves.toBe(
      'ok',
    );
  });
});

describe('T4 — wiring: legacy handlers only, Ask V2 never', () => {
  const interceptorsOf = (target: object): unknown[] =>
    (Reflect.getMetadata(INTERCEPTORS_METADATA, target) as unknown[] | undefined) ?? [];
  const legacyOn = (target: object): string[] =>
    interceptorsOf(target)
      .filter((i): i is LegacyRouteUsageInterceptor => i instanceof LegacyRouteUsageInterceptor)
      .map((i) => (i as unknown as { route: string }).route);

  it('each legacy handler carries exactly its own route literal', () => {
    expect(legacyOn(AnalysisController.prototype.analyzeNews)).toEqual(['POST /analysis/news']);
    expect(legacyOn(NewsController.prototype.search)).toEqual(['GET /news/search']);
    expect(legacyOn(HistoryController.prototype.list)).toEqual(['GET /history']);
    expect(legacyOn(HistoryController.prototype.clear)).toEqual(['DELETE /history']);
  });

  it('no other news handler, and no Ask V2 controller or handler, carries it', () => {
    expect(legacyOn(NewsController.prototype.topHeadlines)).toEqual([]);
    expect(legacyOn(AskV2Controller)).toEqual([]);
    for (const name of Object.getOwnPropertyNames(AskV2Controller.prototype)) {
      const member = (AskV2Controller.prototype as unknown as Record<string, unknown>)[name];
      if (typeof member === 'function')
        expect({ name, legacy: legacyOn(member) }).toEqual({ name, legacy: [] });
    }
    const askV2Dir = join(__dirname, '..', 'ask-v2');
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? walk(join(dir, e.name))
          : e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')
            ? [join(dir, e.name)]
            : [],
      );
    for (const file of walk(askV2Dir)) {
      expect({ file, hit: readFileSync(file, 'utf8').includes('LegacyRouteUsage') }).toEqual({
        file,
        hit: false,
      });
    }
  });

  it('the analysis handler classifies auth from the verified-user marker only (boolean, not the id)', () => {
    const interceptor = interceptorsOf(AnalysisController.prototype.analyzeNews).find(
      (i): i is LegacyRouteUsageInterceptor => i instanceof LegacyRouteUsageInterceptor,
    )!;
    const resolve = (interceptor as unknown as { resolveAuth: (r: unknown) => string }).resolveAuth;
    expect(resolve({})).toBe('anonymous');
    expect(resolve({ user: { id: USER_ID } })).toBe('anonymous');
  });

  it('the admin readout returns the shared registry snapshot', () => {
    legacyRouteUsage.reset();
    legacyRouteUsage.record('GET /history', {}, 'signed-in', HOSTS);
    const snapshot = new AdminLegacyUsageController().legacyUsage();
    expect(snapshot.routes.find((r) => r.route === 'GET /history')!.total).toBe(1);
    legacyRouteUsage.reset();
  });
});
