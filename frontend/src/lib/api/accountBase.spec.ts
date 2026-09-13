import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  ACCOUNT_API_PATH_PREFIX,
  accountSignInUrl,
  resolveAccountApiBase,
} from './accountBase';

/**
 * M-ALPHA-AUTH - the first-party account contract on the frontend side.
 *
 * The jest environment here is 'node', matching the rest of this package, so the
 * browser branch is exercised by defining `window` for the duration of a test.
 * That is the same discriminator `isServerExecutionContext()` uses in
 * production, so the branch under test is the real one.
 */
const SRC = join(__dirname, '..', '..');

function read(...segments: string[]): string {
  return readFileSync(join(SRC, ...segments), 'utf-8');
}

/** See the note at its first call site: assigning undefined stores "undefined". */
function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

function inBrowser<T>(body: () => T): T {
  const globalWithWindow = global as unknown as { window?: unknown };
  const had = 'window' in globalWithWindow;
  globalWithWindow.window = { location: { pathname: '/support' } };
  try {
    return body();
  } finally {
    if (!had) delete globalWithWindow.window;
  }
}

describe('resolveAccountApiBase', () => {
  /**
   * THE PROPERTY THE WHOLE REPAIR RESTS ON. A relative base cannot be
   * cross-site. There is no environment variable that could point account
   * traffic at another host, so the SameSite=Lax session cookie that was being
   * withheld on every cross-site fetch is now sent on every one of these.
   */
  it('is a relative, same-origin path in the browser', () => {
    inBrowser(() => {
      const base = resolveAccountApiBase();
      expect(base).toBe('/api');
      expect(base.startsWith('/')).toBe(true);
      expect(base).not.toMatch(/^https?:\/\//);
    });
  });

  it('cannot be pointed at another host by any environment variable', () => {
    const originalPublic = process.env.NEXT_PUBLIC_API_URL;
    const originalInternal = process.env.SERVER_INTERNAL_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'https://backend-production-bed5.up.railway.app';
    process.env.SERVER_INTERNAL_API_URL = 'https://somewhere.else.example';

    try {
      inBrowser(() => {
        expect(resolveAccountApiBase()).toBe('/api');
      });
    } finally {
      /*
        RESTORED BY DELETE WHEN THE ORIGINAL WAS UNSET. Assigning `undefined` to
        a process.env key stores the literal string "undefined", which then
        leaks into the next test as a real value. That is not hypothetical here:
        it made the very next test in this file read a base URL of "undefined"
        before this was corrected.
      */
      restoreEnv('NEXT_PUBLIC_API_URL', originalPublic);
      restoreEnv('SERVER_INTERNAL_API_URL', originalInternal);
    }
  });

  it('returns an absolute base on the server, where a relative URL cannot be fetched', () => {
    const original = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'https://backend.example.com';
    try {
      expect(resolveAccountApiBase()).toBe('https://backend.example.com');
    } finally {
      restoreEnv('NEXT_PUBLIC_API_URL', original);
    }
  });
});

describe('accountSignInUrl', () => {
  it('is relative in every execution context, server included', () => {
    expect(accountSignInUrl('/support').startsWith('/api/auth/google')).toBe(true);
    inBrowser(() => {
      expect(accountSignInUrl('/support').startsWith('/api/auth/google')).toBe(true);
    });
  });

  it('carries the return destination as a query parameter', () => {
    expect(accountSignInUrl('/support')).toBe('/api/auth/google?returnTo=%2Fsupport');
    expect(accountSignInUrl('/admin/system/health')).toBe(
      '/api/auth/google?returnTo=%2Fadmin%2Fsystem%2Fhealth',
    );
  });

  it('omits the parameter entirely when there is no destination, preserving the old default', () => {
    expect(accountSignInUrl()).toBe('/api/auth/google');
    expect(accountSignInUrl(undefined)).toBe('/api/auth/google');
    expect(accountSignInUrl('')).toBe('/api/auth/google');
  });

  /**
   * Encoding here is CORRECTNESS, not the security control - the backend
   * allowlist is. This asserts that a hostile value cannot break OUT of the
   * query parameter and become a second parameter or a fragment, which is this
   * function's own responsibility.
   */
  it('cannot be broken out of by a hostile destination', () => {
    const hostile = accountSignInUrl('/support&admin=1#x');
    expect(hostile.split('?')[1].split('&')).toHaveLength(1);
    expect(hostile).not.toContain('#');

    const absolute = accountSignInUrl('https://evil.example');
    expect(absolute.startsWith('/api/auth/google?')).toBe(true);
    expect(absolute).not.toContain('//evil.example');
  });

  it('matches the proxy prefix the rewrites declare', () => {
    expect(accountSignInUrl('/')).toContain(`${ACCOUNT_API_PATH_PREFIX}/auth/google`);
  });
});

/**
 * CTO requirement 8 - all five entry points under ONE shared contract.
 *
 * Asserted at source level because these are .tsx components and this package's
 * jest environment does not render them; the existing accepted specs in this
 * repository (headerAccountPrivacy.spec.ts, supportSurface.spec.ts,
 * adminSecurityPosture.spec.ts) use the same technique, so this follows the
 * house style rather than introducing a second one.
 */
describe('the five sign-in entry points', () => {
  const ENTRY_POINTS: ReadonlyArray<[string, string[]]> = [
    ['Account (header, nine surfaces)', ['components', 'navigation', 'AccountControl.tsx']],
    ['homepage Watch', ['components', 'home', 'WatchModule.tsx']],
    ['Today Watch', ['components', 'today', 'WatchPanel.tsx']],
    ['Support', ['components', 'support', 'SupportScreen.tsx']],
    ['Admin', ['components', 'admin', 'shell', 'AdminAccessState.tsx']],
  ];

  it.each(ENTRY_POINTS)('%s uses the shared accountSignInUrl helper', (_name, segments) => {
    const source = read(...segments);
    expect(source).toContain("from '@/lib/api/accountBase'");
    expect(source).toContain('accountSignInUrl(');
  });

  /**
   * THE REGRESSION THIS BLOCKS. Every one of these five used to build its own
   * `${API_BASE_URL}/auth/google`, which pointed at the backend's own origin and
   * is precisely what made the session cookie cross-site. A sixth entry point
   * added later must not reintroduce that shape.
   */
  it.each(ENTRY_POINTS)('%s no longer constructs a cross-origin sign-in URL', (_name, segments) => {
    const source = read(...segments);
    expect(source).not.toMatch(/\$\{API_BASE_URL\}\/auth\/google/);
    expect(source).not.toMatch(/resolveApiBaseUrl\(\)\}\/auth\/google/);
    expect(source).not.toMatch(/NEXT_PUBLIC_API_URL[^\n]*\/auth\/google/);
  });

  /**
   * THE REPOSITORY-WIDE INVARIANT, SCANNED WITH NODE ONLY.
   *
   * WHAT WAS WRONG BEFORE. This test shelled out to `grep` and treated exit
   * status 1 as "no matches". Windows has no `grep`, so the process never
   * started, the status was not 1, and the test failed on a machine where the
   * invariant was in fact perfectly satisfied. That is a portability defect in
   * the test, not a finding about the product - and it is worse than a mere
   * annoyance, because a test that cannot run cannot protect anything.
   *
   * It also depended on an external tool's exit-code convention for its
   * correctness. Nothing here does now: the walk, the read and the match are all
   * Node, present by definition wherever Jest runs.
   *
   * THE INVARIANT ITSELF IS UNCHANGED IN MEANING AND STRICTLY WIDER IN REACH.
   * The old check looked for one literal, `${API_BASE_URL}/auth/google`. The
   * three patterns below catch that plus every other way to build a sign-in URL
   * against a foreign origin - any interpolation, any origin symbol on the line,
   * and a hardcoded absolute URL. Nothing that used to fail this test can now
   * pass it.
   */
  const FORBIDDEN_CONSTRUCTIONS: ReadonlyArray<{ name: string; pattern: RegExp; why: string }> = [
    {
      name: 'interpolated-origin',
      pattern: /\}\s*\/auth\/google/,
      why: 'a template interpolation immediately before the sign-in path, e.g. ${API_BASE_URL}/auth/google',
    },
    {
      name: 'origin-symbol-on-the-same-line',
      pattern: /(API_BASE_URL|NEXT_PUBLIC_API_URL|SERVER_INTERNAL_API_URL|resolveApiBaseUrl)[^\n]*auth\/google/,
      why: 'a backend-origin symbol used on the same line as the sign-in path',
    },
    {
      name: 'hardcoded-absolute-url',
      pattern: /['"`]https?:\/\/[^'"`\n]*\/auth\/google/,
      why: 'a hardcoded absolute sign-in URL',
    },
  ];

  /**
   * Directories excluded from the walk, and the justification for each. Nothing
   * else is excluded: narrowing the scan to obtain a green result would defeat
   * the test.
   *
   * None of these should exist beneath frontend/src at all. They are listed
   * defensively so that a stray build output can never make the walk enormous or
   * the result misleading.
   */
  const EXCLUDED_DIRECTORIES = new Set(['node_modules', '.next', 'dist', 'build', 'coverage']);

  /**
   * Files excluded, with justification:
   *  - *.spec.ts / *.spec.tsx : a test that FORBIDS a shape has to be able to
   *    write that shape down. Specs are also never shipped to a browser.
   *  - lib/api/accountBase.ts : the single module permitted to define the
   *    first-party sign-in path. That is the whole point of it existing.
   */
  function isExcludedFile(relativePath: string): boolean {
    if (/\.spec\.tsx?$/.test(relativePath)) return true;
    return relativePath.replace(/\\/g, '/') === 'lib/api/accountBase.ts';
  }

  function collectSourceFiles(root: string): string[] {
    const found: string[] = [];

    function walk(directory: string): void {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const full = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
          walk(full);
          continue;
        }
        if (/\.tsx?$/.test(entry.name)) found.push(full);
      }
    }

    walk(root);
    return found;
  }

  /**
   * A SCAN THAT LOOKED AT NOTHING WOULD PASS SILENTLY, so the walk is verified
   * before its result is trusted. This is the failure mode the grep version
   * could also have had - a wrong path would have produced "no matches" and a
   * green test.
   */
  /**
   * THE RULE TABLE IS LOAD-BEARING, SO IT IS PINNED.
   *
   * A mutation exposed this: deleting the `hardcoded-absolute-url` entry and
   * then inserting a hardcoded absolute sign-in URL into a production file left
   * all tests passing. That is the expected consequence of removing a rule - and
   * exactly why the set needs a guard of its own. A future edit that trims the
   * table "because it looks redundant" would silently retire a whole class of
   * violation, with nothing failing to say so.
   *
   * Pinning the names, not the patterns: a pattern may legitimately be widened
   * or made more precise, but losing a rule outright should require deliberately
   * editing this assertion too.
   */
  it('the forbidden-construction rule set is intact', () => {
    expect(FORBIDDEN_CONSTRUCTIONS.map((rule) => rule.name).sort()).toEqual([
      'hardcoded-absolute-url',
      'interpolated-origin',
      'origin-symbol-on-the-same-line',
    ]);
    for (const rule of FORBIDDEN_CONSTRUCTIONS) {
      expect(rule.why.length).toBeGreaterThan(0);
    }
  });

  it('the scanner actually reaches the frontend source tree', () => {
    const files = collectSourceFiles(SRC);
    expect(files.length).toBeGreaterThan(100);

    const relative = files.map((file) => file.slice(SRC.length + 1).replace(/\\/g, '/'));
    for (const entryPoint of [
      'components/navigation/AccountControl.tsx',
      'components/home/WatchModule.tsx',
      'components/today/WatchPanel.tsx',
      'components/support/SupportScreen.tsx',
      'components/admin/shell/AdminAccessState.tsx',
      'lib/api/accountFetch.ts',
    ]) {
      expect(relative).toContain(entryPoint);
    }
  });

  it('no file anywhere in the frontend still builds a cross-origin sign-in URL', () => {
    const offences: string[] = [];

    for (const file of collectSourceFiles(SRC)) {
      const relative = file.slice(SRC.length + 1).replace(/\\/g, '/');
      if (isExcludedFile(relative)) continue;

      const lines = readFileSync(file, 'utf-8').split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const rule of FORBIDDEN_CONSTRUCTIONS) {
          if (rule.pattern.test(line)) {
            offences.push(`${relative}:${index + 1} [${rule.name}] ${line.trim()}`);
          }
        }
      });
    }

    // The offending file, line and text are reported, so a failure names the
    // defect instead of merely asserting that one exists.
    expect(offences).toEqual([]);
  });

  /**
   * CTO requirement 9. No follow is replayed after the OAuth round trip. An
   * action performed on the strength of a value that survived a redirect is a
   * CSRF primitive however well signed that value is.
   */
  it.each([
    ['homepage Watch', ['components', 'home', 'WatchModule.tsx']],
    ['Today Watch', ['components', 'today', 'WatchPanel.tsx']],
  ] as ReadonlyArray<[string, string[]]>)(
    '%s performs no automatic follow after sign-in',
    (_name, segments) => {
      const source = read(...segments);
      expect(source).not.toMatch(/autoFollow|replayFollow|pendingFollow/);
      expect(source).not.toMatch(/returnTo[^\n]*follow/i);
    },
  );
});

/**
 * CTO requirement 11 - PROVE the first-party proxy preserves the EXISTING CSRF
 * double-submit rather than expanding /users/me with a token field.
 *
 * The double-submit needs one thing that the split-domain deployment could not
 * give it: the document that reads `gna_csrf` and the response that sets it must
 * share an origin. Under the proxy they do, because accountFetch's base is
 * relative. These assertions pin exactly that, and pin the absence of the
 * fallback the CTO authorised only if it proved necessary.
 */
describe('CSRF double-submit is preserved, not replaced', () => {
  it('accountFetch reads the cookie and sends the header from the same origin it fetches', () => {
    const source = read('lib', 'api', 'accountFetch.ts');
    expect(source).toContain("const CSRF_COOKIE_NAME = 'gna_csrf'");
    expect(source).toContain('document.cookie');
    expect(source).toContain("headers['X-CSRF-Token'] = csrfToken");
    expect(source).toContain('resolveAccountApiBase()');
    // The old cross-origin base is gone; if it came back the cookie read above
    // would silently return undefined again and every mutation would 403.
    expect(source).not.toContain('NEXT_PUBLIC_API_URL');
  });

  it('the fetch target is same-origin in the browser, which is what makes the cookie readable', () => {
    inBrowser(() => {
      expect(resolveAccountApiBase().startsWith('/')).toBe(true);
    });
  });

  it('GET requests still carry no CSRF header, and mutations still do', () => {
    const source = read('lib', 'api', 'accountFetch.ts');
    expect(source).toContain("const MUTATING_METHODS = new Set(['POST', 'DELETE'])");
    expect(source).toContain('if (MUTATING_METHODS.has(method))');
  });

  it('/users/me was NOT expanded with a CSRF token field', () => {
    /*
      The CTO authorised that fallback only if testing proved the first-party
      proxy could not preserve the existing mechanism. It can, so the fallback
      was not built - and this asserts the absence, so a later change cannot add
      it silently and quietly widen where the token is readable.

      Asserted against the RESPONSE SHAPES rather than by grepping the files for
      "csrf": users.controller.ts legitimately references CSRF_COOKIE_NAME when
      clearing cookies on account deletion, and a test that failed on that would
      be testing the wrong thing.
    */
    const backendService = readFileSync(
      join(SRC, '..', '..', 'backend', 'src', 'modules', 'users', 'users.service.ts'),
      'utf-8',
    );
    const summary = backendService.slice(
      backendService.indexOf('export interface UserSummary {'),
      backendService.indexOf('}', backendService.indexOf('export interface UserSummary {')),
    );
    expect(summary).not.toMatch(/csrf/i);
    expect(summary).toContain('email');

    const hook = read('lib', 'hooks', 'useAccount.ts');
    expect(hook).not.toMatch(/csrf/i);
  });
});
