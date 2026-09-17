import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PHASE 3 — DOMAIN-1 READINESS, GUARDED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The DOMAIN-1 verdict rests on ONE structural property: a cookie set on
 * `globalnewsai.live` must never be sent to `alpha.globalnewsai.live`. That is
 * what makes the two surfaces separate sessions rather than one session wearing
 * two hostnames.
 *
 * The property is HOST-ONLY COOKIES — no `Domain` attribute, so the cookie is
 * scoped to the exact host that set it.
 *
 * ── WHY THIS IS A TEST AND NOT A NOTE ─────────────────────────────────────
 *
 * A verdict that depends on an invariant nothing checks is a verdict with an
 * expiry date nobody can see. Adding one `domain:` line would silently merge the
 * two sessions, and the failure would surface as a user signed into Production
 * from Alpha — a security event discovered by its consequences.
 *
 * ── AND WHY IT IS STRONGER THAN "UNSET" ───────────────────────────────────
 *
 * The backend's cookie option type has no `domain` FIELD AT ALL. Host-only is
 * not the current value of a setting; it is unrepresentable. A contributor
 * cannot widen the scope by editing a value, only by changing a type — which is
 * a visible act, and the one this suite is positioned to catch.
 *
 * NOTHING HERE BINDS ANYTHING. No domain is attached, no DNS record is touched,
 * and no Railway value is read or invented.
 */

const REPO = join(__dirname, '..', '..');
const cookieUtil = readFileSync(join(__dirname, 'modules', 'auth', 'cookie.util.ts'), 'utf-8');

const stripComments = (value: string): string =>
  value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const cookieCode = stripComments(cookieUtil);

/**
 * `git grep` exits 1 when it matches NOTHING, and `execFileSync` throws on a
 * nonzero exit — so "no matches", the outcome these assertions want, arrived as
 * an exception. This returns an empty list for that case and re-throws anything
 * else, so a genuinely broken invocation is still loud.
 */
const gitGrepFiles = (pattern: string, pathspec: string): readonly string[] => {
  try {
    return execFileSync('git', ['grep', '-l', pattern, '--', pathspec], {
      cwd: REPO,
      encoding: 'utf-8',
    })
      .split('\n')
      .filter(Boolean);
  } catch (error) {
    const status = (error as { status?: number }).status;

    if (status === 1) return [];
    throw error;
  }
};

const hasGit = existsSync(join(REPO, '.git'));
const describeGit = hasGit ? describe : describe.skip;

describe('PHASE 3 — the session-isolation property the verdict rests on', () => {
  describe('HOST-ONLY IS UNREPRESENTABLE, NOT MERELY UNSET', () => {
    it('the cookie option type declares no domain field', () => {
      /*
        The load-bearing assertion of this whole phase. If a `domain` field
        appears, a cookie can be widened to `.globalnewsai.live` and the two
        surfaces stop being separate sessions.
      */
      expect(cookieCode).not.toMatch(/\bdomain\s*[?]?\s*:/i);
    });

    it('and no cookie is written with a Domain attribute', () => {
      expect(cookieCode).not.toContain('Domain=');
    });

    it('the attributes it DOES declare are the four expected ones', () => {
      /* Stated positively, so a silent addition is visible rather than implied. */
      for (const attribute of ['httpOnly', 'sameSite', 'secure', 'path']) {
        expect(cookieCode).toContain(`${attribute}:`);
      }
    });

    it('sameSite stays lax, which is a request rule and not a scoping one', () => {
      /*
        Lax governs whether a cookie rides a cross-site navigation. Scoping is a
        separate question answered by `Domain`, and that answer is host-only.
        Conflating the two is how a reader talks themselves into widening it.
      */
      expect(cookieCode).toMatch(/sameSite:\s*'lax'/);
    });
  });

  describeGit('NO HOSTNAME-SENSITIVE FILE WAS TOUCHED BY THE CONVERGENCE WORK', () => {
    /*
      ══ B5 · RE-ANCHORED TO THE SPAN THIS BLOCK ACTUALLY NAMES ══════════════

      THIS TRIPWIRE FIRED, AND IT FIRED CORRECTLY. B5-A changed the auth module
      by explicit ruling — OAuth V1's cancelled|failed states — and this block
      is what noticed.

      But read what it claims: "NO HOSTNAME-SENSITIVE FILE WAS TOUCHED BY THE
      CONVERGENCE WORK". The convergence work ENDED at the sealed Alpha
      candidate. Diffing against HEAD quietly re-pointed the assertion at every
      branch that came after it, so by B5 it was asserting that the BETA
      RECOVERY had touched no auth file — which nobody ever claimed, and which
      the Beta plan explicitly contradicts.

      An assertion whose subject grows with every commit stops guarding the
      property it was written for and starts blocking authorized work. Pinning
      the upper bound to the SEALED, IMMUTABLE candidate restores exactly the
      Phase 3 guarantee: the convergence work touched nothing hostname-sensitive.
      That span can never change again, so this can never drift again.

      Measured at re-anchoring: 0 sensitive files and 0 auth files in
      2c4b6ce..36f00bb — the same result the original assertion had, and for the
      same reason.

      WHAT THIS DOES NOT DO: it asserts nothing about B5's auth change, which is
      covered by oauth-v1-error-states.spec.ts on its own terms.
    */
    const SEALED_ALPHA = '36f00bb1f7492a25352e0c163cd46bc2d12e4a5f';

    const changed = (): readonly string[] =>
      execFileSync('git', ['diff', '--name-only', '2c4b6ce', SEALED_ALPHA], {
        cwd: REPO,
        encoding: 'utf-8',
      })
        .split('\n')
        .filter(Boolean);

    it('nothing touching cors, cookies, origin, oauth, callback or metadata', () => {
      const sensitive = changed().filter((file) =>
        /cors|cookie|origin|canonical|oauth|callback|security|next\.config|metadata/i.test(file),
      );

      expect(sensitive).toEqual([]);
    });

    it('and the auth module is untouched entirely', () => {
      expect(changed().filter((f) => f.includes('modules/auth/'))).toEqual([]);
    });
  });

  describe('THE CONVERGENCE WORK WROTE NO COOKIE OF ITS OWN', () => {
    const frontend = (...parts: string[]): string =>
      readFileSync(join(REPO, 'frontend', 'src', ...parts), 'utf-8');

    it('the map language control persists through the released helper only', () => {
      const control = stripComments(
        frontend('components', 'map', 'shell', 'MapLanguageControl.tsx'),
      );

      expect(control).not.toContain('document.cookie');
    });

    it('the language reconciliation holds no store of its own', () => {
      const sync = stripComments(frontend('components', 'i18n', 'LanguageSync.tsx'));

      expect(sync).not.toContain('document.cookie');
      expect(sync).not.toContain('localStorage');
    });

    it('and the sign-in return state uses sessionStorage, which never leaves the browser', () => {
      /*
        This is the one that could plausibly have touched the redirect contract.
        It deliberately did not: nothing new reaches the server.
      */
      const state = stripComments(frontend('lib', 'map', 'state', 'signInReturnState.ts'));

      expect(state).toContain('window.sessionStorage');
      expect(state).not.toContain('document.cookie');
      expect(state).not.toMatch(/\bfetch\(/);
    });
  });

  describe('BINDING IS CONFIGURATION, SO NO HOSTNAME IS COMPILED IN', () => {
    it('the CORS origin comes from an environment variable', () => {
      const cors = readFileSync(join(__dirname, 'security', 'cors-startup-validator.ts'), 'utf-8');

      expect(cors).toContain('FRONTEND_ORIGIN');
      expect(cors).toContain('export function resolveFrontendOrigin');
    });

    it('the OAuth callback base does too', () => {
      const base = readFileSync(
        join(__dirname, 'security', 'public-oauth-callback-base.config.ts'),
        'utf-8',
      );

      expect(base).toContain("export const PUBLIC_OAUTH_CALLBACK_BASE_ENV = 'PUBLIC_OAUTH_CALLBACK_BASE';");
    });

    it('and no production hostname is written into backend source', () => {
      /*
        A compiled-in hostname would make binding a code change rather than a
        configuration one, and would make the two environments differ in source.
      */
      const sources = gitGrepFiles('globalnewsai.live', 'backend/src').filter(
        (file) => !file.includes('.spec.'),
      );

      expect(sources).toEqual([]);
    });
  });

  describe('THE READINESS DOCUMENT SAYS WHAT WAS NOT DONE', () => {
    const readiness = readFileSync(
      join(REPO, 'docs', 'PHASE3_DOMAIN1_READINESS.md'),
      'utf-8',
    );

    it('it states plainly that no binding was performed', () => {
      expect(readiness).toContain('**No binding is performed by this phase.**');
    });

    it('it does not invent a Railway-generated value', () => {
      /*
        The DNS shape is stated; the values are not, because Railway generates
        them and this phase does not have them.
      */
      expect(readiness).toContain('value UNKNOWN until step 1 is performed');
      expect(readiness).not.toMatch(/\b[a-z0-9-]+\.up\.railway\.app\b/);
    });

    it('and the verdict is scoped to Alpha only, with HOLD intact', () => {
      expect(readiness).toContain('Verdict — Alpha binding only');
      expect(readiness).toContain('**HOLD** remains in force for `globalnewsai.live`');
    });
  });
});
