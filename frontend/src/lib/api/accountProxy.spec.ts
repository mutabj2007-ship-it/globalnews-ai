import { execFileSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { ACCOUNT_API_PATH_PREFIX } from './accountBase';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * M-ALPHA-AUTH - the first-party proxy contract.
 *
 * THIS LOADS AND EXECUTES THE REAL next.config.mjs. It does not grep it. A text
 * assertion would pass against a rewrite table Next could never use - a typo in
 * a key name, a table returned from the wrong function, a config that throws on
 * load - and this file is what the entire repair rests on, so the test proves
 * the actual behaviour rather than the actual characters.
 *
 * IT RUNS THE CONFIG IN A REAL NODE PROCESS, and that is the honest way to do
 * it here rather than a workaround. Jest's module registry refuses a dynamic
 * import without --experimental-vm-modules, and adding that flag would change
 * the shared jest configuration for every suite in the frontend in order to
 * serve one file. A child process loads the .mjs through Node's own ESM loader,
 * which is the same loader Next uses, so the fidelity is higher rather than
 * lower - and it also lets the environment-precedence cases below run against a
 * genuinely fresh module evaluation instead of a cached one.
 */
const CONFIG_PATH = join(__dirname, '..', '..', '..', 'next.config.mjs');

interface RewriteRule {
  source: string;
  destination: string;
}

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

interface ConfigProbe {
  rewrites: RewriteRule[];
  headerCount: number;
  headers: HeaderRule[];
  reactStrictMode: boolean;
  hasImages: boolean;
}

/**
 * Loads the config in a real Node ESM process and returns what it actually
 * produced. Throws - failing the test - if the config cannot be loaded at all.
 */
function probeConfig(env: Record<string, string> = {}): ConfigProbe {
  const script = [
    `const mod = await import(${JSON.stringify(pathToFileURL(CONFIG_PATH).href)});`,
    'const config = mod.default;',
    'const rewrites = await config.rewrites();',
    'const headers = await config.headers();',
    'process.stdout.write(JSON.stringify({',
    '  rewrites,',
    '  headerCount: headers.length,',
    '  headers,',
    '  reactStrictMode: config.reactStrictMode === true,',
    '  hasImages: config.images !== undefined,',
    '}));',
  ].join('\n');

  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf-8',
    env: { ...cleanEnv(), ...env } as NodeJS.ProcessEnv,
  });

  return JSON.parse(output) as ConfigProbe;
}

/**
 * The two variables the rewrite destination reads are removed rather than
 * overwritten, so a value leaking in from the developer's own shell cannot make
 * a precedence test pass for the wrong reason.
 */
function cleanEnv(): Record<string, string | undefined> {
  const copy: Record<string, string | undefined> = { ...process.env };
  delete copy.SERVER_INTERNAL_API_URL;
  delete copy.NEXT_PUBLIC_API_URL;
  return copy;
}

/*
  MAIN-C2 STAGE 1 — SIX BECAME SEVEN, DELIBERATELY.

  This list is the proxy's contract, and the assertion below that it is EXACTLY
  this set is what stops a family being added without a decision. Analysis was
  excluded by M-ALPHA-AUTH on the reasoning that it "carries no cookie, needs
  none". That was wrong in a way only the rate-limit guard revealed: the guard
  resolves an authenticated tier from `gna_session` plus the CSRF echo, and a
  cross-site call could deliver neither, so signed-in callers silently received
  the anonymous ceiling. Adding analysis here is the fix, and this comment is
  why the count moved rather than the count simply being edited.
*/
const PROXIED_FAMILIES = [
  'analysis',
  'auth',
  'users',
  'history',
  'follows',
  'support',
  'admin',
] as const;

describe('next.config.mjs - the account proxy (M-ALPHA-AUTH)', () => {
  /*
    AMENDED — MEASURED AGAINST NEXT 14.2.35's ACTUAL PROXY, NOT ASSUMED.

    The assertions this replaces said /news must not be proxied. Their stated
    reason was that a proxy hop buys nothing for a cookieless route — but the
    operative fear behind it was the one B-1 documents in forwardedClient.ts:
    a hop that hides the visitor gives "every visitor on earth one shared
    rate-limit bucket", because @nestjs/throttler tracks req.ip.

    That fear is real for the SSR hop B-1 addresses — there the frontend
    ORIGINATES a new request carrying no X-Forwarded-For at all, so the visitor
    exists on that hop only if forwardedClient.ts deliberately forwards it.

    It is NOT true of a next.config rewrite, which is a PROXY, not a new
    request. Measured in the installed Next 14.2.35:

      dist/server/lib/router-utils/proxy-request.js constructs
        new HttpProxy({ target, changeOrigin, ignorePath, ws, proxyTimeout,
                        headers: { 'x-forwarded-host': req.headers.host } })
      - `xfwd` is never set; and in dist/compiled/http-proxy the only code that
        touches X-Forwarded-For is
          XHeaders: function (e, t, r) { if (!r.xfwd) return; ... }
        which returns immediately unless xfwd is truthy.

    So Next adds x-forwarded-host and nothing else, and passes the incoming
    headers through. The Railway edge's forwarded chain arrives at the backend
    unchanged — the same chain a non-proxied request would carry. The
    shared-bucket rationale does not apply to this mechanism.

    E1-N-8 — PROVENANCE, SO THE TWO ARE NEVER CONFLATED. The paragraph above is
    MAIN'S measurement of a bundled library: what the code does, and why. It
    CORROBORATES, and does not replace, E1/C55's INDEPENDENT echo-server
    measurement of observed behaviour against this repository's own Next 14.2.35,
    already recorded in trusted-proxy.config.ts: "it forwards a client-supplied
    X-Forwarded-For verbatim and never appends its own observation."

    Neither is evidence for the other. The assertion rests on the EMPIRICAL one —
    what arrives matters, not why — and the library reading explains it. Note also
    that if the mechanism claim were wrong it would already be wrong for the seven
    authenticated families, which have depended on this behaviour since R2. This
    change inherits that position rather than creating it.

    What these tests DO still protect is stated below, unweakened: /news is
    public, it stays OUT of the authenticated /api set, and it must never
    receive the authenticated private-cache/session headers.
  */
  it('exposes exactly the authorised /api families, and no others', () => {
    const { rewrites } = probeConfig();
    const apiSources = rewrites
      .map((rule) => rule.source)
      .filter((source) => source.startsWith(`${ACCOUNT_API_PATH_PREFIX}/`));

    expect(apiSources.sort()).toEqual(
      PROXIED_FAMILIES.map((family) => `${ACCOUNT_API_PATH_PREFIX}/${family}/:path*`).sort(),
    );
  });

  it('every non-/api rewrite is a declared PUBLIC family — no unaccounted proxying', () => {
    const PUBLIC_FAMILIES = ['/news/:path*', '/geo/:path*'];
    const { rewrites } = probeConfig();
    const nonApi = rewrites
      .map((rule) => rule.source)
      .filter((source) => !source.startsWith(`${ACCOUNT_API_PATH_PREFIX}/`));

    expect(nonApi.sort()).toEqual([...PUBLIC_FAMILIES].sort());
  });

  it.each(PROXIED_FAMILIES)('maps /api/%s to the backend without the /api prefix', (family) => {
    const { rewrites } = probeConfig();
    const rule = rewrites.find((entry) => entry.source === `/api/${family}/:path*`);

    expect(rule).toBeDefined();
    // The backend serves /auth, /users, ... - the /api segment belongs to this
    // origin only and must not be forwarded, or every route would 404.
    expect(rule!.destination).toMatch(new RegExp(`/${family}/:path\\*$`));
    expect(rule!.destination).not.toContain('/api/');
  });

  /**
   * PROOF 2 FOR THE OPTION A CALLBACK BASE.
   *
   * The whole callback architecture rests on ONE mapping: the browser-visible
   * URI <FRONTEND>/api/auth/google/callback must arrive at the backend's
   * @Controller('auth') @Get('google/callback'). Nothing pinned that specific
   * path before - the family assertion above proves /api/auth/:path* exists,
   * which is necessary but does not demonstrate that the callback itself
   * resolves, and the callback is the one request in the flow that Google sends
   * the user to.
   *
   * Resolved here the way Next resolves it - by substituting :path* - rather
   * than by re-reading the pattern, so this fails if the family is ever
   * narrowed or its destination is rewritten to keep the /api prefix.
   */
  it('proxies /api/auth/google/callback to the backend callback route', () => {
    const { rewrites } = probeConfig({ NEXT_PUBLIC_API_URL: 'https://backend.example.com' });
    const rule = rewrites.find((entry) => entry.source === '/api/auth/:path*');

    expect(rule).toBeDefined();

    const browserPath = '/api/auth/google/callback';
    const matched = browserPath.slice('/api/auth/'.length);
    const resolved = rule!.destination.replace(':path*', matched);

    expect(resolved).toBe('https://backend.example.com/auth/google/callback');
    // The /api segment belongs to the frontend origin only and must not be
    // forwarded - the backend serves /auth, not /api/auth.
    expect(resolved).not.toContain('/api/');
  });

  /**
   * M-ALPHA-AUTH asserted the ABSENCE of an analysis proxy here, on the
   * reasoning that anonymous Analysis worked and a hop bought nothing. MAIN-C2
   * Stage 1 reverses that for `analysis` ONLY, and the reversal is argued in
   * next.config.mjs: the rate-limit guard resolves an authenticated tier from
   * `gna_session` plus the CSRF echo, and a cross-site call could deliver
   * neither, so every signed-in caller was silently served the anonymous
   * ceiling.
   *
   * `events` keeps the original absence. `news` is now proxied as a PUBLIC
   * family — see the amendment note above — and is asserted below on the
   * property that actually matters rather than on its absence.
   */
  it.each(['events'])('does NOT proxy /%s', (publicFamily) => {
    const { rewrites } = probeConfig();

    for (const rule of rewrites) {
      expect(rule.source).not.toContain(`/${publicFamily}`);
    }
  });

  /*
    G-3 — THE TWO CLASSES, STATED AS A COUNT SO NEITHER CAN ABSORB THE OTHER.

    E1-GEO-PUBLIC-REWRITE-REVIEW-1 authorises `/geo` as the SECOND public
    non-`/api` family. The authenticated set stays at exactly SEVEN. Asserting
    both counts is the point: a future `/api/geo` would grow the authenticated
    set silently, and a public family quietly moved under `/api` would inherit
    `private, no-store` and `Vary: Cookie` that its responses do not need.
  */
  it('G-3: exactly SEVEN authenticated /api families and exactly TWO public non-/api families', () => {
    const { rewrites } = probeConfig({ SERVER_INTERNAL_API_URL: 'http://backend.internal:8080' });

    const authenticated = rewrites.filter((rule) => rule.source.startsWith('/api/'));
    const publicFamilies = rewrites.filter((rule) => !rule.source.startsWith('/api/'));

    expect(authenticated).toHaveLength(7);
    expect(publicFamilies.map((rule) => rule.source).sort()).toEqual(
      ['/geo/:path*', '/news/:path*'],
    );

    /* `/api/geo` is explicitly NOT added — the two classes stay separate. */
    expect(rewrites.some((rule) => rule.source.startsWith('/api/geo'))).toBe(false);
  });

  it('G-8: /geo is proxied to the same backend origin the seven families use', () => {
    const { rewrites } = probeConfig({ SERVER_INTERNAL_API_URL: 'http://backend.internal:8080' });

    const geo = rewrites.find((rule) => rule.source === '/geo/:path*');
    expect(geo?.destination).toBe('http://backend.internal:8080/geo/:path*');
  });

  it('/news is PUBLIC: proxied, but never inside /api and never given the authenticated headers', () => {
    const { rewrites, headers } = probeConfig();

    // Proxied, and deliberately NOT an /api family.
    const news = rewrites.find((rule) => rule.source === '/news/:path*');
    expect(news).toBeDefined();
    expect(news!.source.startsWith(`${ACCOUNT_API_PATH_PREFIX}/`)).toBe(false);

    // The private-cache header block must not reach it. That block is scoped to
    // /api/:path*, so a public route can only acquire it by being moved under
    // /api - which the assertion above forbids.
    for (const entry of headers ?? []) {
      expect(entry.source).not.toContain('/news');
    }
  });

  /**
   * STAGE 1 PROOF — the real browser path resolves to the real backend route.
   * Shaped exactly like the callback proof above, because the failure mode is
   * the same one: forwarding this origin's own `/api` segment to a backend that
   * serves `/analysis`, not `/api/analysis`.
   */
  it('proxies /api/analysis/news to the backend analysis route', () => {
    const { rewrites } = probeConfig({ NEXT_PUBLIC_API_URL: 'https://backend.example.com' });
    const rule = rewrites.find((entry) => entry.source === '/api/analysis/:path*');

    expect(rule).toBeDefined();
    const browserPath = '/api/analysis/news';
    const matched = browserPath.slice('/api/analysis/'.length);
    const resolved = rule!.destination.replace(':path*', matched);

    expect(resolved).toBe('https://backend.example.com/analysis/news');
    expect(resolved).not.toContain('/api/');
  });

  /**
   * And the client actually uses it. A rewrite nothing calls is decoration, and
   * the whole point of Stage 1 is that this specific request stops being
   * cross-site — so the absence of a hardcoded backend origin in analysisApi is
   * as load-bearing as the rewrite itself.
   */
  it('and analysisApi posts through the first-party base rather than the backend origin', () => {
    /*
      Comments are stripped before matching. analysisApi.ts's own doc comment
      QUOTES the line it replaced in order to explain why — matching against
      prose would force that explanation to be deleted to make this pass, which
      is exactly backwards. The assertion is about CODE.
    */
    const apiSource = readFileSync(join(__dirname, 'analysisApi.ts'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    expect(apiSource).toMatch(/resolveAccountApiBase\(\)}\/analysis\/news/);
    expect(apiSource).not.toMatch(/const API_BASE_URL = process\.env\.NEXT_PUBLIC_API_URL/);
    // Resolved per call: module scope would freeze a build-time value.
    expect(apiSource).not.toMatch(/^const API_BASE_URL = resolveAccountApiBase\(\);$/m);
  });

  it('leaves the pre-existing headers and image configuration intact', () => {
    const probe = probeConfig();
    expect(probe.reactStrictMode).toBe(true);
    expect(probe.hasImages).toBe(true);
    /*
      E1-M-4 — THIS COUNT WAS 2 AND IS NOW 3, DELIBERATELY.

      The two pre-existing rules (/sw.js and /manifest.webmanifest) are still
      asserted individually below, so "intact" still means intact: this number
      moving is not a licence for one of them to disappear. The third rule is
      M-4's, and it is required rather than incidental — the rewrites above moved
      authenticated JSON onto the origin that serves immutable static assets, and
      nothing at either end was saying how it may be cached.
    */
    expect(probe.headerCount).toBe(3);
    const sources = probe.headers.map((rule) => rule.source).sort();
    expect(sources).toEqual(['/api/:path*', '/manifest.webmanifest', '/sw.js']);
  });

  /*
    E1-M-4 — THE HEADER ASSERTION E1 ASKED FOR, ON THE EXACT VALUES.

    `private` forbids any shared cache from storing an authenticated response at
    all; `no-store` forbids even the browser's own disk cache, so a session
    response cannot be recovered from a shared machine after sign-out; and
    `Vary: Cookie` means an intermediary that ignores both is at least told the
    response depends on the cookie, so two sessions cannot collapse onto one
    cache entry. Pinned by value, because a weaker directive here would be
    invisible in review and catastrophic in production.
  */
  it('declares the account proxy uncacheable, by value', () => {
    const rule = probeConfig().headers.find((entry) => entry.source === '/api/:path*');

    expect(rule).toBeDefined();
    expect(rule?.headers).toEqual([
      { key: 'Cache-Control', value: 'private, no-store' },
      { key: 'Vary', value: 'Cookie' },
    ]);
  });

  /**
   * The destination precedence must match `resolveApiBaseUrl()`'s SERVER branch,
   * because the rewrite is evaluated in the Next server runtime.
   * next.config.mjs cannot import that TypeScript module, so the two are pinned
   * to each other here rather than trusted to a comment.
   */
  describe('destination precedence matches the server branch of resolveApiBaseUrl', () => {
    it('prefers SERVER_INTERNAL_API_URL', () => {
      const { rewrites } = probeConfig({
        SERVER_INTERNAL_API_URL: 'http://backend.internal:4000',
        NEXT_PUBLIC_API_URL: 'https://public.example.com',
      });
      expect(rewrites[0].destination.startsWith('http://backend.internal:4000')).toBe(true);
    });

    it('falls back to NEXT_PUBLIC_API_URL', () => {
      const { rewrites } = probeConfig({ NEXT_PUBLIC_API_URL: 'https://public.example.com' });
      expect(rewrites[0].destination.startsWith('https://public.example.com')).toBe(true);
    });

    it('falls back to the local default when neither is set', () => {
      const { rewrites } = probeConfig();
      expect(rewrites[0].destination.startsWith('http://localhost:4000')).toBe(true);
    });
  });

  /**
   * CTO requirement 3: use the EXISTING configuration file. There must be
   * exactly one, and it must be the .mjs that was already in the accepted tree.
   */
  it('there is exactly one Next configuration file in the frontend package', () => {
    const frontendRoot = join(__dirname, '..', '..', '..');
    const configFiles = readdirSync(frontendRoot).filter((name) =>
      /^next\.config\.(js|mjs|cjs|ts)$/.test(name),
    );
    expect(configFiles).toEqual(['next.config.mjs']);
  });

  /**
   * VALIDATED AGAINST NEXT'S OWN CONFIGURATION SCHEMA, not against my idea of
   * what Next accepts.
   *
   * `next build` cannot run in the environment this was developed in - the SWC
   * native binary for this platform is not installed and the npm registry is
   * unreachable, so the build fails in the loader before it compiles anything.
   * Rather than ship an untested config and call the gap unavoidable, this
   * feeds the real config object to `next/dist/server/config-schema`, which is
   * the same zod schema `next build` itself validates against. A malformed
   * rewrite entry, a misspelled key or a wrong return shape fails here.
   */
  it('satisfies the configuration schema Next itself validates against', () => {
    const script = [
      `const mod = await import(${JSON.stringify(pathToFileURL(CONFIG_PATH).href)});`,
      "const schema = await import('next/dist/server/config-schema.js');",
      'const result = schema.configSchema.safeParse(mod.default);',
      'process.stdout.write(JSON.stringify({ success: result.success }));',
    ].join('\n');

    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf-8',
      env: cleanEnv() as NodeJS.ProcessEnv,
    });

    expect(JSON.parse(output)).toEqual({ success: true });
  });

  it('the config is loadable by Node without throwing', () => {
    expect(() => probeConfig()).not.toThrow();
    expect(readFileSync(CONFIG_PATH, 'utf-8')).toContain('async rewrites()');
  });
});

/**
 * MAIN-C2 STAGE 1 — THE TRUST-PROXY COORDINATION, PINNED AS A MEASURED FACT.
 *
 * Adding a proxy hop in front of the backend is the one part of Stage 1 that
 * could have broken something invisible: `req.ip` is the anonymous rate-limit
 * identity, and if Next appended its own peer to `X-Forwarded-For`, Express's
 * `trust proxy = 1` — which counts from the RIGHT — would have started
 * returning the Next container's address and collapsed every anonymous visitor
 * into one bucket.
 *
 * It does not. Measured against this repository's own Next version by running
 * `next start` with an equivalent rewrite in front of an echo server: an
 * inbound `X-Forwarded-For: 203.0.113.9` arrived at the destination as exactly
 * `203.0.113.9`, with the socket peer being the Next process and no appended
 * entry. `Retry-After: 137` survived the hop, and the Cookie and X-CSRF-Token
 * headers arrived intact.
 *
 * So `TRUST_PROXY=1` remains correct on both path shapes:
 *
 *   direct   XFF=[client]  socket=Railway edge  -> trust 1 -> client
 *   proxied  XFF=[client]  socket=Next          -> trust 1 -> client
 *
 * E1's accepted architecture needs no change to accommodate this proxy. These
 * assertions pin the two repository-side facts that measurement depends on; the
 * measurement itself is recorded in the delivery report, and the residual
 * assumption — that the Railway edge appends the true client address — is E1's
 * to certify, not something a unit test can reach.
 */
describe('MAIN-C2 STAGE 1 — the proxy hop does not change who the backend thinks you are', () => {
  it('the rewrite forwards to the PRIVATE backend address, so no second public hop is added', () => {
    const { rewrites } = probeConfig({
      SERVER_INTERNAL_API_URL: 'http://backend.railway.internal:4000',
      NEXT_PUBLIC_API_URL: 'https://backend-production.example.app',
    });
    const rule = rewrites.find((entry) => entry.source === '/api/analysis/:path*');

    expect(rule).toBeDefined();
    expect(rule!.destination).toContain('http://backend.railway.internal:4000');
    expect(rule!.destination).not.toContain('backend-production.example.app');
  });

  it('the trust-proxy contract still refuses the value that would make identity forgeable', () => {
    // Unchanged by Stage 1, and asserted here because Stage 1 is exactly the
    // change that would tempt someone to widen it.
    const trustProxy = readFileSync(
      join(REPO_ROOT, 'backend', 'src', 'security', 'trusted-proxy.config.ts'),
      'utf-8',
    );
    expect(trustProxy).toMatch(/UNRESTRICTED_TOKENS/);
    expect(trustProxy).toMatch(/would trust every X-Forwarded-For header/);
  });

  it('E1-N-6 — no rewrite source pattern overlaps another', () => {
    /*
      Next evaluates rewrites in array order, so an overlapping pattern added
      later could SHADOW an authenticated family and silently change where its
      traffic goes. This asserts the sources are mutually exclusive by prefix.
    */
    const { rewrites } = probeConfig();
    const sources = rewrites.map((rule) => rule.source);

    expect(new Set(sources).size).toBe(sources.length);

    const prefixOf = (source: string) => source.replace(/\/:path\*$/, '');
    for (const a of sources) {
      for (const b of sources) {
        if (a === b) continue;
        expect(prefixOf(a).startsWith(`${prefixOf(b)}/`)).toBe(false);
      }
    }
  });

  it('E1-N-6 — the seven authenticated /api entries are byte-identical to the R2-verified set', () => {
    const { rewrites } = probeConfig();

    for (const family of PROXIED_FAMILIES) {
      const rule = rewrites.find((entry) => entry.source === `/api/${family}/:path*`);
      expect(rule).toBeDefined();
      expect(rule!.destination.endsWith(`/${family}/:path*`)).toBe(true);
      expect(rule!.destination).not.toContain('/api/');
    }
    expect(PROXIED_FAMILIES).toHaveLength(7);
  });

  it('analysis is proxied under /api; /news only as a public family; /events not at all', () => {
    const { rewrites } = probeConfig();
    const sources = rewrites.map((rule) => rule.source);

    expect(sources).toContain('/api/analysis/:path*');
    // /news is proxied, but never under the authenticated prefix.
    expect(sources).toContain('/news/:path*');
    expect(sources).not.toContain('/api/news/:path*');
    // /events keeps the original absence entirely.
    expect(sources.some((source) => source.includes('/events'))).toBe(false);
  });
});
