import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_FOLLOWED_COUNTRIES, ALL_ISO3_CODES } from '@globalnews-ai/shared';

/**
 * H-FOLLOW-AUTHENTICATED-ALPHA-1 — THE FRONTEND IS MEASURED AGAINST THE
 * BACKEND, NOT AGAINST AN ASSUMPTION.
 *
 * The brief is explicit: *measure exact backend endpoint compatibility rather
 * than inventing a frontend contract.* So this suite reads the REAL backend
 * source — controller, DTOs, constants, guards — and asserts that the shipped
 * frontend hook agrees with it, field by field.
 *
 * It is a source-text test and that is admissible here for a specific reason:
 * the property under test genuinely IS a property of the two sources. What a
 * route is called, which verb it answers, where the country code sits, and
 * which alphabet it is in are facts about the code, and a drift on either side
 * breaks this file rather than a user. The RUNTIME half — that a real browser
 * follows, persists, unfollows and is denied when signed out — is proven
 * separately in the evidence harness, against a server built from these same
 * measured routes.
 *
 * This file adds no behaviour. Nothing in the Follow feature is modified by
 * this package; the mechanism already shipped and already matched. What was
 * missing was anything that would NOTICE if it stopped matching.
 */

const FRONTEND_SRC = join(__dirname, '..', '..');
const BACKEND_SRC = join(FRONTEND_SRC, '..', '..', 'backend', 'src');
const FOLLOWS = join(BACKEND_SRC, 'modules', 'follows');

const read = (path: string): string => readFileSync(path, 'utf-8');
const code = (path: string): string =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const hook = code(join(__dirname, 'useCountryFollows.ts'));
const controller = code(join(FOLLOWS, 'follows.controller.ts'));
const followDto = code(join(FOLLOWS, 'dto', 'follow-country.dto.ts'));
const paramsDto = code(join(FOLLOWS, 'dto', 'follow-country-params.dto.ts'));
const constants = code(join(FOLLOWS, 'follows.constants.ts'));
const accountFetch = code(join(FRONTEND_SRC, 'lib', 'api', 'accountFetch.ts'));

describe('the three routes, measured on the backend and matched on the frontend', () => {
  it('the backend exposes exactly three follow routes, under /follows', () => {
    expect(controller).toContain("@Controller('follows')");
    expect(controller).toContain("@Get('countries')");
    expect(controller).toContain("@Post('countries')");
    expect(controller).toContain("@Delete('countries/:countryCode')");
    expect((controller.match(/@(Get|Post|Delete|Put|Patch)\(/g) ?? []).length).toBe(3);
  });

  it('the frontend calls that exact path, and builds it in ONE place', () => {
    expect(hook).toContain("const FOLLOWS_PATH = '/follows/countries'");
    // Every call site uses the constant; no second path literal exists.
    expect((hook.match(/'\/follows/g) ?? []).length).toBe(1);
  });

  it('the verbs match: GET to read, POST to follow, DELETE to unfollow', () => {
    expect(hook).toMatch(/accountFetch\(FOLLOWS_PATH\)/);
    expect(hook).toMatch(/method:\s*'POST'/);
    expect(hook).toMatch(/method:\s*'DELETE'/);
    expect(hook).not.toMatch(/method:\s*'(PUT|PATCH)'/);
  });

  it('follow sends the country in the BODY; unfollow sends it in the PATH — as the controller declares', () => {
    expect(controller).toContain('@Body() body: FollowCountryDto');
    expect(controller).toContain('@Param() params: FollowCountryParamsDto');
    expect(hook).toMatch(/method: 'POST', body: \{ countryCode: code \}/);
    expect(hook).toMatch(/\$\{FOLLOWS_PATH\}\/\$\{code\}`, \{ method: 'DELETE' \}/);
  });

  it('the body field is named exactly as the DTO declares it', () => {
    expect(followDto).toMatch(/countryCode!: string;/);
    expect(hook).toContain('body: { countryCode: code }');
  });
});

describe('the country code: one alphabet, one case, on both sides', () => {
  it('the backend validates against the canonical ISO-3 list, not a shape', () => {
    for (const source of [followDto, paramsDto]) {
      expect(source).toContain('@IsIn(ALL_ISO3_CODES)');
      expect(source).not.toMatch(/@Length|@MaxLength|@Matches/);
    }
  });

  it('the backend upper-cases and trims before validating — and so does the frontend, identically', () => {
    for (const source of [followDto, paramsDto]) {
      expect(source).toContain('value.trim().toUpperCase()');
    }
    expect(hook).toContain('countryCode.trim().toUpperCase()');
    expect(hook).toContain('entry.countryCode.trim().toUpperCase()');
  });

  it('the frontend never truncates an ISO-3 code into an ISO-2 one', () => {
    expect(hook).not.toMatch(/slice\(0,\s*2\)/);
    expect(hook).not.toMatch(/substring\(0,\s*2\)/);
  });

  it('a real ISO-3 code round-trips through the frontend transform unchanged', () => {
    const sample = ALL_ISO3_CODES.slice(0, 5);
    for (const iso3 of sample) {
      expect(iso3.trim().toUpperCase()).toBe(iso3);
      expect(iso3).toHaveLength(3);
    }
  });

  it('POSITIVE CONTROL — the ISO-2 guard fires on a truncating hook', () => {
    expect(() => expect("code.slice(0, 2)").not.toMatch(/slice\(0,\s*2\)/)).toThrow();
  });
});

describe('ownership never travels in a request — the frontend must not offer to send it', () => {
  it('neither DTO declares a user identifier', () => {
    for (const source of [followDto, paramsDto]) {
      expect(source).not.toMatch(/userId/);
      expect(source).not.toMatch(/\bid!?:/);
    }
  });

  it('the frontend sends no identifier of any kind — the body has exactly one field', () => {
    const body = hook.slice(hook.indexOf('body: {'), hook.indexOf('}', hook.indexOf('body: {')) + 1);
    expect(body).toBe('body: { countryCode: code }');
    expect(hook).not.toMatch(/userId|accountId|email/);
  });

  it('this matters because the backend REJECTS an extra field rather than ignoring it', () => {
    const main = code(join(BACKEND_SRC, 'main.ts'));
    expect(main).toMatch(/forbidNonWhitelisted:\s*true/);
    expect(main).toMatch(/whitelist:\s*true/);
  });
});

describe('the guards, and what the frontend has to do to satisfy them', () => {
  it('every follow route is behind RequireAuthGuard at CLASS level — no route can escape by omission', () => {
    expect(controller).toMatch(/@Controller\('follows'\)\s*@UseGuards\(RequireAuthGuard\)/);
  });

  it('both mutations carry CsrfGuard; the safe read does not', () => {
    const post = controller.slice(controller.indexOf("@Post('countries')"), controller.indexOf("@Delete("));
    const del = controller.slice(controller.indexOf("@Delete("));
    const get = controller.slice(controller.indexOf("@Get('countries')"), controller.indexOf("@Post("));
    expect(post).toContain('@UseGuards(CsrfGuard)');
    expect(del).toContain('@UseGuards(CsrfGuard)');
    expect(get).not.toContain('CsrfGuard');
  });

  it('the frontend echoes the CSRF cookie as the header the guard reads, on mutations only', () => {
    const guard = code(join(BACKEND_SRC, 'modules', 'auth', 'csrf.guard.ts'));
    expect(guard).toContain("request.headers['x-csrf-token']");
    expect(accountFetch).toContain("headers['X-CSRF-Token'] = csrfToken");
    expect(accountFetch).toContain("const MUTATING_METHODS = new Set(['POST', 'DELETE'])");
  });

  it('the frontend reads the CSRF cookie under the name the backend writes', () => {
    const cookieUtil = code(join(BACKEND_SRC, 'modules', 'auth', 'cookie.util.ts'));
    expect(cookieUtil).toContain("CSRF_COOKIE_NAME = 'gna_csrf'");
    expect(accountFetch).toContain("CSRF_COOKIE_NAME = 'gna_csrf'");
  });

  it('the frontend sends the session cookie cross-origin — without it every route is a 401', () => {
    expect(accountFetch).toContain("credentials: 'include'");
  });
});

describe('the ceiling is the SERVER’s number, echoed — never hard-coded in the UI', () => {
  it('the backend derives its ceiling from the shared contract', () => {
    expect(constants).toContain('MAX_COUNTRY_FOLLOWS = MAX_FOLLOWED_COUNTRIES');
    expect(MAX_FOLLOWED_COUNTRIES).toBeGreaterThan(0);
  });

  it('the frontend takes maxFollows from the response and never writes the number itself', () => {
    expect(hook).toContain('setMaxFollows(data.maxFollows)');
    expect(hook).not.toMatch(/maxFollows\s*=\s*\d+/);
    expect(hook).not.toContain(String(MAX_FOLLOWED_COUNTRIES));
  });

  it('POSITIVE CONTROL — the hard-coding guard fires', () => {
    expect(() => expect('const maxFollows = 50;').not.toMatch(/maxFollows\s*=\s*\d+/)).toThrow();
  });
});

describe('signed out is not an error, and it is not an empty list either', () => {
  it('a failed or unauthorized read yields null, never []', () => {
    expect(hook).toMatch(/if \(!response\.ok\) \{\s*setFollows\(null\);/);
    expect(hook).toMatch(/catch \{\s*setFollows\(null\);/);
  });

  it('nothing persists a follow anywhere on the client — there is no anonymous identity', () => {
    expect(hook).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
  });
});

describe('FOLLOW IS NOT WATCH — no scheduler, no monitoring, nothing between page loads', () => {
  it('the hook has no timer, no socket, no listener and no worker', () => {
    for (const pattern of [
      /setInterval/, /setTimeout/, /requestAnimationFrame/,
      /WebSocket/, /EventSource/, /addEventListener/,
      /navigator\.serviceWorker/, /Notification/,
    ]) {
      expect(hook).not.toMatch(pattern);
    }
  });

  it('there is exactly ONE read path, and exactly one mount read', () => {
    expect((hook.match(/accountFetch\(FOLLOWS_PATH\)/g) ?? []).length).toBe(1);
    expect((hook.match(/async function read\(/g) ?? []).length).toBe(1);
    expect(hook).toMatch(/useEffect\(\(\) => \{\s*void read\(\);/);
    expect(hook).toMatch(/\}, \[\]\);/);
  });

  it('the only re-read follows a mutation the USER performed', () => {
    const mutate = hook.slice(hook.indexOf('async function mutate('));
    expect(mutate).toContain('await read();');
    expect((mutate.match(/await read\(\)/g) ?? []).length).toBe(1);
  });

  it('POSITIVE CONTROL — the scheduler guard fires on a polling hook', () => {
    expect(() => expect('setInterval(read, 30000)').not.toMatch(/setInterval/)).toThrow();
  });
});
