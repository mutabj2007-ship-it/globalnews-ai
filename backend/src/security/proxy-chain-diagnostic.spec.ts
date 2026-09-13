import { readFileSync } from 'fs';
import { join } from 'path';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { TrustProxySetting } from './trusted-proxy.config';
import {
  countForwardedEntries,
  createProxyChainDiagnostic,
  describeProxyChain,
  formatProxyChainObservation,
  isProxiedFamilyPath,
} from './proxy-chain-diagnostic';

/**
 * E1-C2 / Q-6 — the diagnostic authorised to settle what this deployment's edge
 * actually does to X-Forwarded-For.
 *
 * Two properties carry the whole thing and both are asserted end to end against
 * a real Express instance rather than against a hand-built request object:
 *
 *   1. THE NUMBERS ARE RIGHT. They are read from a live `trust proxy` matrix, so
 *      a change in how Express populates `req.ips` fails here rather than
 *      producing a confident and wrong line in a production log.
 *   2. NO ADDRESS IS EVER EMITTED. Asserted by scanning the output for every
 *      address that went into the request, rather than by reading the format
 *      string and trusting it.
 */

@Controller()
class ProbeController {
  @Get('users/me')
  usersMe(): string {
    return 'ok';
  }

  @Get('follows/countries')
  follows(): string {
    return 'ok';
  }

  @Get('health')
  health(): string {
    return 'ok';
  }

  @Get('analysis/news')
  analysis(): string {
    return 'ok';
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

/** Captures what the middleware logged, in order. */
function recordingLogger(): { lines: string[]; log: (message: unknown) => void } {
  const lines: string[] = [];
  return { lines, log: (message: unknown) => void lines.push(String(message)) };
}

async function createApp(
  trustProxy: TrustProxySetting,
  logger: { log: (message: unknown) => void },
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
  app.use(createProxyChainDiagnostic(logger as never));
  await app.init();
  return app;
}

/** Reads one numeric field out of the emitted line. */
function field(line: string, name: string): number {
  const match = new RegExp(`${name}=(-?\\d+)`).exec(line);
  return match ? Number(match[1]) : Number.NaN;
}

describe('Q-6 — countForwardedEntries', () => {
  it.each([
    ['an absent header', undefined, 0],
    ['a null header', null, 0],
    ['one entry', '203.0.113.7', 1],
    ['two entries', '198.51.100.66, 203.0.113.7', 2],
    ['three entries', '198.51.100.66, 203.0.113.7, 10.1.1.9', 3],
    ['entries with no spaces', '198.51.100.66,203.0.113.7', 2],
  ])('%s', (_name, header, expected) => {
    expect(countForwardedEntries(header)).toBe(expected);
  });

  /**
   * A stray comma must not inflate the count. This number is about to be read
   * as evidence of how many hops are in front of the deployment, and an
   * off-by-one here would be indistinguishable from a real second hop.
   */
  it.each([
    ['a trailing comma', '203.0.113.7,', 1],
    ['a doubled separator', '198.51.100.66,,203.0.113.7', 2],
    ['whitespace only', '   ', 0],
    ['an empty string', '', 0],
  ])('%s does not inflate the count', (_name, header, expected) => {
    expect(countForwardedEntries(header)).toBe(expected);
  });

  /** Node hands the header over as an array when it arrived more than once. */
  it('counts a repeated header the same as a joined one', () => {
    expect(countForwardedEntries(['198.51.100.66', '203.0.113.7'])).toBe(2);
    expect(countForwardedEntries(['198.51.100.66, 203.0.113.7'])).toBe(2);
  });
});

describe('Q-6 — describeProxyChain arithmetic', () => {
  it('reports the socket peer as position -1 rather than as position 0', () => {
    expect(describeProxyChain(undefined, [])).toEqual({
      forwardedEntries: 0,
      trustedEntries: 0,
      resolvedFromLeft: -1,
      resolvedFromRight: -1,
    });
  });

  it('a two-entry chain with one trusted hop resolves to the RIGHTMOST entry', () => {
    expect(describeProxyChain('198.51.100.66, 203.0.113.7', ['203.0.113.7'])).toEqual({
      forwardedEntries: 2,
      trustedEntries: 1,
      resolvedFromLeft: 1,
      resolvedFromRight: 0,
    });
  });

  it('the same chain with two trusted hops resolves to the LEFTMOST entry', () => {
    expect(
      describeProxyChain('198.51.100.66, 203.0.113.7', ['198.51.100.66', '203.0.113.7']),
    ).toEqual({
      forwardedEntries: 2,
      trustedEntries: 2,
      resolvedFromLeft: 0,
      resolvedFromRight: 1,
    });
  });

  /**
   * The clamp. `req.ips` and the raw header are read from different places, so
   * a disagreement is possible in principle; reporting resolvedFromLeft=-1 for
   * it would look like "Express used the socket peer", which is a different and
   * meaningful result. Clamping keeps a bug from impersonating a finding.
   */
  it('never reports a negative index when the trusted chain exceeds the raw header', () => {
    const observation = describeProxyChain('203.0.113.7', ['a', 'b', 'c']);

    expect(observation.trustedEntries).toBe(1);
    expect(observation.resolvedFromLeft).toBe(0);
    expect(observation.resolvedFromRight).toBe(0);
  });
});

describe('Q-6 — path scope', () => {
  it.each([
    '/analysis/news',
    '/auth/google',
    '/users/me',
    '/history',
    '/follows/countries',
    '/support/tickets',
    '/admin/me',
  ])('%s is one of the first-party proxied families', (path) => {
    expect(isProxiedFamilyPath(path)).toBe(true);
  });

  it.each(['/health', '/news/country/pl', '/', '/authentication', '/userscript', '/analysisx'])(
    '%s is not',
    (path) => {
      expect(isProxiedFamilyPath(path)).toBe(false);
    },
  );

  /**
   * PF-2. `/analysis/news` sat in the NEGATIVE table above until C29, and it was
   * correct there when this file was written: the frontend proxied six families
   * and analysis called the backend origin directly.
   *
   * next.config.mjs now rewrites `/api/analysis/:path*` and analysisApi.ts
   * reaches it through `resolveAccountApiBase()`, so proxied analysis traffic
   * was being labelled `other` — the label that means "did not traverse the
   * frontend". The sample taken under that label could not be read as evidence
   * about the direct path, which is the whole reason the class exists.
   *
   * The move is asserted from BOTH sides — present in the positive table, absent
   * from the negative one — because a one-sided edit is how a path ends up
   * silently in neither.
   */
  it('PF-2 — /analysis is a proxied family, and /analysisx is still not', () => {
    expect(isProxiedFamilyPath('/analysis')).toBe(true);
    expect(isProxiedFamilyPath('/analysis/')).toBe(true);
    expect(isProxiedFamilyPath('/analysis/news')).toBe(true);

    // The boundary is prefix-plus-separator, not bare startsWith. A family that
    // merely begins with the same letters is a different family, and sampling it
    // would answer the question about the wrong ingress class.
    expect(isProxiedFamilyPath('/analysisx')).toBe(false);
    expect(isProxiedFamilyPath('/analysistics')).toBe(false);
  });

  /**
   * The list is duplicated knowledge — it must equal the rewrite sources in
   * frontend/next.config.mjs, and drifting from them is exactly what PF-2 was.
   * Pinned by VALUE here rather than by reading that file: a backend spec that
   * reads across into frontend/ fails whenever the backend is tested without
   * the frontend present, and a gate that cannot run is worse than one checked
   * by hand. If a family is added to the rewrites, this test must be updated in
   * the same change — which is the point of it failing loudly.
   */
  it('the family set is exactly the seven rewrite sources at C29', () => {
    const families = ['/analysis', '/auth', '/users', '/history', '/follows', '/support', '/admin'];

    for (const family of families) {
      expect(isProxiedFamilyPath(family)).toBe(true);
    }

    // Nothing outside the set classifies as a family.
    for (const outside of ['/news', '/health', '/telemetry', '/geo', '/signals']) {
      expect(isProxiedFamilyPath(outside)).toBe(false);
    }
  });

  /**
   * `/authentication` and `/userscript` above are the reason the check is a
   * prefix-plus-boundary test rather than a bare startsWith: a route family
   * that merely begins with the same letters is a different family, and
   * sampling it would answer the question about the wrong ingress class.
   */
  it('matches the bare family root as well as its children', () => {
    expect(isProxiedFamilyPath('/history')).toBe(true);
    expect(isProxiedFamilyPath('/history/')).toBe(true);
    expect(isProxiedFamilyPath('/historyx')).toBe(false);
  });
});

describe('Q-6 — end to end against a real Express trust-proxy matrix', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  it('trust proxy 1, chain [forged, edge] — reports the RIGHTMOST entry', async () => {
    const logger = recordingLogger();
    app = await createApp(1, logger);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('X-Forwarded-For', '198.51.100.66, 203.0.113.7');

    expect(logger.lines).toHaveLength(1);
    expect(field(logger.lines[0], 'forwardedEntries')).toBe(2);
    expect(field(logger.lines[0], 'resolvedFromLeft')).toBe(1);
    expect(field(logger.lines[0], 'resolvedFromRight')).toBe(0);
    expect(logger.lines[0]).toContain('source=forwarded-header');
  });

  /**
   * The shape that says Fix B is safe. If the edge strips and sets a single
   * entry, both readings of Railway's documentation agree and there is no
   * client-controlled position for a resolver to land on.
   */
  it('trust proxy 1, a single edge-set entry — forwardedEntries=1 at position 0', async () => {
    const logger = recordingLogger();
    app = await createApp(1, logger);

    await request(app.getHttpServer()).get('/users/me').set('X-Forwarded-For', '203.0.113.7');

    expect(field(logger.lines[0], 'forwardedEntries')).toBe(1);
    expect(field(logger.lines[0], 'resolvedFromLeft')).toBe(0);
    expect(field(logger.lines[0], 'resolvedFromRight')).toBe(0);
  });

  /** The shape that says over-counting has landed on client-supplied data. */
  it('trust proxy 2, chain [forged, edge] — reports the LEFTMOST entry', async () => {
    const logger = recordingLogger();
    app = await createApp(2, logger);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('X-Forwarded-For', '198.51.100.66, 203.0.113.7');

    expect(field(logger.lines[0], 'resolvedFromLeft')).toBe(0);
    expect(field(logger.lines[0], 'resolvedFromRight')).toBe(1);
  });

  it('trust proxy false — reports the socket peer, not position 0', async () => {
    const logger = recordingLogger();
    app = await createApp(false, logger);

    await request(app.getHttpServer()).get('/users/me').set('X-Forwarded-For', '203.0.113.7');

    expect(field(logger.lines[0], 'trustedEntries')).toBe(0);
    expect(field(logger.lines[0], 'resolvedFromLeft')).toBe(-1);
    expect(logger.lines[0]).toContain('source=socket-peer');
  });

  it('no X-Forwarded-For at all is still a usable observation', async () => {
    const logger = recordingLogger();
    app = await createApp(1, logger);

    await request(app.getHttpServer()).get('/users/me');

    expect(field(logger.lines[0], 'forwardedEntries')).toBe(0);
    expect(logger.lines[0]).toContain('source=socket-peer');
  });
});

describe('Q-6 — it samples ONCE PER PATH CLASS, and never more', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  it('emits exactly one proxied-family line no matter how many family requests arrive', async () => {
    const logger = recordingLogger();
    app = await createApp(1, logger);
    const server = app.getHttpServer();

    for (let i = 0; i < 25; i += 1) {
      await request(server).get('/users/me').set('X-Forwarded-For', '203.0.113.7');
      await request(server).get('/follows/countries').set('X-Forwarded-For', '203.0.113.7');
    }

    expect(logger.lines).toHaveLength(1);
    expect(logger.lines[0]).toContain('pathClass=proxied-family');
  });

  /**
   * The confirmed Alpha topology has TWO live ingress paths and ONE `trust
   * proxy` setting that has to be correct for both. So the cap is two lines,
   * one per class — and it is a CAP, asserted under sustained traffic on both
   * classes rather than inferred from the implementation.
   */
  it('emits at most TWO lines, one per class, under sustained traffic on both', async () => {
    const logger = recordingLogger();
    app = await createApp(1, logger);
    const server = app.getHttpServer();

    /*
     * PF-2 — `/analysis/news` is kept here deliberately and now serves a second
     * purpose. It is a proxied family at C29, so this loop drives TWO family
     * paths and one direct path, and the cap must still hold at two lines: the
     * second family request must not earn a second family line. Before PF-2 the
     * same call landed in `other` and this test passed for the wrong reason.
     */
    for (let i = 0; i < 25; i += 1) {
      await request(server).get('/users/me').set('X-Forwarded-For', '203.0.113.7');
      await request(server).get('/analysis/news').set('X-Forwarded-For', '203.0.113.7');
      await request(server).get('/health').set('X-Forwarded-For', '203.0.113.7');
    }

    expect(logger.lines).toHaveLength(2);
    expect(logger.lines.filter((line) => line.includes('pathClass=proxied-family'))).toHaveLength(
      1,
    );
    expect(logger.lines.filter((line) => line.includes('pathClass=other'))).toHaveLength(1);
  });

  it('samples whichever class arrives first, without waiting for the other', async () => {
    const logger = recordingLogger();
    app = await createApp(1, logger);
    const server = app.getHttpServer();

    await request(server).get('/health').set('X-Forwarded-For', '203.0.113.7');

    expect(logger.lines).toHaveLength(1);
    expect(logger.lines[0]).toContain('pathClass=other');
  });

  /**
   * The property the two-class design has to keep from the one-class design:
   * direct traffic must not be able to consume the FAMILY sample. The family
   * chain is the one that tells you whether the private hop stayed private, and
   * it cannot be retaken without a redeploy.
   */
  /**
   * PF-2 — FIXTURE CORRECTED, ASSERTION UNCHANGED. This case used `/health` and
   * `/analysis/news` as its two examples of traffic that must not consume the
   * family sample. `/analysis/news` is a proxied family at C29, so that example
   * became false and the test failed — correctly. It is replaced with
   * `/news/country/pl`, which newsApi.ts still calls directly through
   * `resolveApiBaseUrl()` and which is therefore genuinely direct traffic.
   *
   * Nothing is weakened: the property asserted is the same one, that direct
   * traffic cannot consume the sample the family class needs, and it is still
   * asserted twice — empty before, exactly one after.
   */
  it('a health check and a direct news call cannot consume the proxied-family sample', async () => {
    const logger = recordingLogger();
    app = await createApp(1, logger);
    const server = app.getHttpServer();

    await request(server).get('/health').set('X-Forwarded-For', '203.0.113.7');
    await request(server).get('/news/country/pl').set('X-Forwarded-For', '203.0.113.7');
    expect(logger.lines.filter((line) => line.includes('pathClass=proxied-family'))).toEqual([]);

    await request(server).get('/users/me').set('X-Forwarded-For', '203.0.113.7');
    expect(logger.lines.filter((line) => line.includes('pathClass=proxied-family'))).toHaveLength(
      1,
    );
  });

  it('two instances keep separate state, so the factory is not a hidden global', async () => {
    const first = recordingLogger();
    const second = recordingLogger();
    const a = createProxyChainDiagnostic(first as never);
    const b = createProxyChainDiagnostic(second as never);
    const req = { path: '/users/me', headers: {}, ips: [] } as never;

    a(req, {} as never, () => undefined);
    a(req, {} as never, () => undefined);
    b(req, {} as never, () => undefined);

    expect(first.lines).toHaveLength(1);
    expect(second.lines).toHaveLength(1);
  });

  it('a throw latches BOTH classes, so one bad sample cannot become a stream', () => {
    const logger = recordingLogger();
    const middleware = createProxyChainDiagnostic(logger as never);
    let explode = true;

    const hostile = {
      get path() {
        if (explode) throw new Error('once');
        return '/analysis/news';
      },
      headers: {},
      ips: [],
    } as never;

    middleware(hostile, {} as never, () => undefined);
    explode = false;
    middleware(hostile, {} as never, () => undefined);
    middleware({ path: '/users/me', headers: {}, ips: [] } as never, {} as never, () => undefined);

    expect(logger.lines).toEqual([]);
  });
});

describe('Q-6 — NO ADDRESS IS EVER EMITTED', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  /**
   * Asserted by searching the output for every address that went into the
   * request, rather than by reading the format string and trusting it. The
   * octet fragments are included because a truncated or partially redacted
   * address would still be a per-visitor identifier.
   */
  it('emits none of the addresses present in the request, whole or in part', async () => {
    const logger = recordingLogger();
    app = await createApp(1, logger);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('X-Forwarded-For', '198.51.100.66, 203.0.113.7')
      .set('X-Real-IP', '192.0.2.5')
      .set('Forwarded', 'for=192.0.2.60;proto=http');

    const line = logger.lines[0];

    for (const fragment of [
      '198.51.100.66',
      '203.0.113.7',
      '192.0.2.5',
      '192.0.2.60',
      '127.0.0.1',
      '198.51.100',
      '203.0.113',
      '192.0.2',
      '::1',
    ]) {
      expect(line).not.toContain(fragment);
    }
  });

  /**
   * And the same claim made structurally: the only digits in the line are the
   * four counts. Anything address-shaped would have to appear as a run of
   * digits and dots, and there is none.
   */
  it('contains no dotted-quad or colon-separated token anywhere', async () => {
    const logger = recordingLogger();
    app = await createApp(['loopback'], logger);

    await request(app.getHttpServer())
      .get('/support/tickets')
      .set('X-Forwarded-For', '198.51.100.66, 2001:db8::1');

    expect(logger.lines[0]).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    expect(logger.lines[0]).not.toMatch(/[0-9a-f]*:[0-9a-f:]+/i);
  });

  it('the formatter alone emits nothing but its four numbers', () => {
    const line = formatProxyChainObservation(
      {
        forwardedEntries: 2,
        trustedEntries: 1,
        resolvedFromLeft: 1,
        resolvedFromRight: 0,
      },
      'proxied-family',
    );

    expect(line.match(/-?\d+/g)).toEqual(['2', '1', '1', '0']);
  });
});

describe('Q-6 — it can never affect a response', () => {
  it('calls next() and stays silent when deriving the counts throws', () => {
    const logger = recordingLogger();
    const middleware = createProxyChainDiagnostic(logger as never);
    let called = 0;

    const hostile = {
      get path() {
        throw new Error('header parsing exploded');
      },
      headers: {},
      ips: [],
    } as never;

    expect(() => middleware(hostile, {} as never, () => void (called += 1))).not.toThrow();
    expect(called).toBe(1);
    expect(logger.lines).toEqual([]);
  });

  /**
   * And it latches after a throw. Retrying on every request would convert one
   * unusable sample into an unbounded stream of failures in a production log.
   */
  it('does not retry after a throw', () => {
    const logger = recordingLogger();
    const middleware = createProxyChainDiagnostic(logger as never);
    let called = 0;
    let explode = true;

    const request_ = {
      get path() {
        if (explode) throw new Error('once');
        return '/users/me';
      },
      headers: {},
      ips: [],
    } as never;

    middleware(request_, {} as never, () => void (called += 1));
    explode = false;
    middleware(request_, {} as never, () => void (called += 1));

    expect(called).toBe(2);
    expect(logger.lines).toEqual([]);
  });

  it('passes the request through untouched on the ordinary path', async () => {
    const logger = recordingLogger();
    const app = await createApp(1, logger);

    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('X-Forwarded-For', '203.0.113.7');

    expect(response.status).toBe(200);
    expect(response.text).toBe('ok');

    await app.close();
  });
});

/**
 * Q-6 — THE WIRING, PINNED AT SOURCE LEVEL.
 *
 * main.ts runs before DI and is not importable from a test, so this follows the
 * convention config/trustProxyWiring.spec.ts already established in this
 * repository for exactly that problem: read the file and assert the contract.
 *
 * The ORDER assertion is the one that matters. The diagnostic reports which
 * position Express's resolver chose, and `trust proxy` is what decides that.
 * Registered before the setting, it would report on a default that the next
 * line then replaces — a confident, wrong number in a production log, which is
 * worse than no number at all.
 */
describe('Q-6 — main.ts wiring contract', () => {
  const mainSource = readFileSync(join(__dirname, '..', 'main.ts'), 'utf-8').replace(/\r\n/g, '\n');

  it('registers the diagnostic', () => {
    expect(mainSource).toContain("from './security/proxy-chain-diagnostic'");
    expect(mainSource).toContain('app.use(createProxyChainDiagnostic());');
  });

  it('registers it AFTER trust proxy is set, so it reports the real trust model', () => {
    const trustProxyLine = mainSource.indexOf("set('trust proxy'");
    const registration = mainSource.indexOf('app.use(createProxyChainDiagnostic());');

    expect(trustProxyLine).toBeGreaterThan(-1);
    expect(registration).toBeGreaterThan(trustProxyLine);
  });

  /**
   * And before the guards, which is what plain Express middleware buys. A
   * request about to be refused with 429 describes the chain shape just as well
   * as one that succeeds, and in a deployment that is already rate-limited the
   * refused ones may be all there is.
   */
  it('registers it as plain Express middleware rather than a Nest interceptor', () => {
    expect(mainSource).not.toContain('APP_INTERCEPTOR');
    expect(mainSource).toContain('app.use(createProxyChainDiagnostic());');
  });
});
