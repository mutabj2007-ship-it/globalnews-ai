import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import { DISALLOWED_PREFIXES } from './routes';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B5-F — ALPHA NOINDEX: **HOLD**, AND THE MEASUREMENT THAT FORCES IT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The instruction was to implement Alpha `noindex` ONLY IF it can be done with
 * a RELIABLE SERVER-SIDE Alpha/Production distinction, and to record HOLD
 * rather than guess.
 *
 * **NOTHING WAS IMPLEMENTED. THE DISTINCTION DOES NOT EXIST IN THIS TREE.**
 *
 * This file is the evidence for that ruling, written as assertions so it cannot
 * quietly stop being true — and so the day the identifier is added, the test
 * that says "there is no identifier" fails and someone revisits this.
 *
 * ── WHAT WAS INSPECTED, AND WHAT EACH CANDIDATE FAILS ────────────────────
 *
 *   NODE_ENV               'production' on the Alpha build AND the Production
 *                          build. It distinguishes dev from deployed, which is
 *                          not the question being asked.
 *
 *   NEXT_PUBLIC_SITE_URL   Two separate failures, either one disqualifying.
 *
 *                          (a) IT IS A BUILD IDENTITY, NOT A RUNTIME ONE. Next
 *                          inlines NEXT_PUBLIC_* at build time, which
 *                          siteOrigin.ts documents and depends on. The same
 *                          artifact promoted to another origin carries the same
 *                          value, so it describes where a build was MADE, not
 *                          where it is SERVED.
 *
 *                          (b) ITS FAILURE MODE IS DEINDEXING PRODUCTION.
 *                          resolveSiteOrigin() returns null for unset,
 *                          malformed or non-origin values. Any rule of the form
 *                          "not the production host ⇒ noindex" therefore fires
 *                          on a Production deploy that forgets or fat-fingers
 *                          the variable — silently, and discovered weeks later
 *                          in search results rather than at deploy time.
 *
 *                          (c) And the value that WOULD identify Alpha does not
 *                          exist yet: alpha.globalnewsai.live is explicitly not
 *                          bound, so Alpha has no distinguishing origin to read.
 *
 *   an explicit env var    NONE. There is no NEXT_PUBLIC_ENV, APP_ENV,
 *                          DEPLOY_ENV or read of any RAILWAY_* variable
 *                          anywhere in frontend, backend or shared.
 *
 * ── WHY A GUESS IS WORSE THAN A HOLD HERE ────────────────────────────────
 *
 * The two failure directions are NOT symmetric. An Alpha that is indexable for
 * another week is a containable problem, visible to anyone who searches for it,
 * and reversible. A Production that silently went `noindex` is an invisible
 * outage in the product's entire discovery surface, and recovery takes as long
 * as the crawler takes to come back. An inference whose worst case is the
 * second is not a distinction — it is a coin flip with an unbounded downside.
 *
 * ── THE ARMING CONDITION, SO THIS IS RESUMABLE ───────────────────────────
 *
 * A deployment-set, SERVER-SIDE identifier that is read at request time and
 * fails towards Production. Concretely: a non-public variable, treated as Alpha
 * ONLY on an exact literal match, with everything else — unset, empty,
 * misspelt — behaving exactly as Production does today. That way a
 * misconfigured Production keeps its index, and a misconfigured Alpha is a
 * deployment-verification failure rather than a silent one.
 *
 * Recorded as ALPHA-NOINDEX-ENV-SIGNAL-1.
 */

const ROOT = join(__dirname, '..', '..');

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf-8');
}

describe('B5-F · the environment distinction does not exist — measured', () => {
  it('no explicit environment identifier is read anywhere in the frontend', () => {
    /*
      If this test ever fails, an identifier has appeared and the HOLD should be
      revisited rather than inherited.
    */
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry !== 'node_modules') walk(full, out);
        } else if (/\.tsx?$/.test(entry) && !/\.spec\.tsx?$/.test(entry)) {
          out.push(full);
        }
      }
      return out;
    };

    const offenders: string[] = [];

    for (const file of walk(ROOT)) {
      const text = readFileSync(file, 'utf-8');
      if (/process\.env\.(NEXT_PUBLIC_ENV|APP_ENV|DEPLOY_ENV|RAILWAY_[A-Z_]+|SITE_ENVIRONMENT)\b/.test(text)) {
        offenders.push(file);
      }
    }

    /*
      ══ SUPERSEDED BY B5.1 — AND THIS TRIPWIRE FIRED EXACTLY AS DESIGNED ════

      B5 wrote: "If this test ever fails, an identifier has appeared and the
      HOLD should be revisited rather than inherited." It failed, for that
      reason, and the HOLD was revisited rather than inherited.

      A Railway-injected `RAILWAY_ENVIRONMENT_ID` was then measured read-only
      against both governed environments and found to discriminate them exactly.
      The single reader is `deploymentEnvironment.ts`, which
      `alphaNoindex.spec.ts` constrains in far more detail than a file-count
      could.

      The assertion is kept and NARROWED rather than deleted, so the property it
      really protects survives: there must be exactly ONE environment reader. A
      second one is how two parts of the product start disagreeing about which
      environment they are in.
    */
    const ENVIRONMENT_AUTHORITY = 'deploymentEnvironment.ts';

    expect(offenders.map((f) => f.split(/[\\/]/).pop())).toEqual([ENVIRONMENT_AUTHORITY]);
  });

  it('NEXT_PUBLIC_SITE_URL is inlined at BUILD time, so it cannot identify a runtime environment', () => {
    const source = read('lib/seo/siteOrigin.ts');

    /* The file says so itself, and the static access is what makes it true. */
    expect(source).toContain('inlines `process.env.NEXT_PUBLIC_*` at build time');
    expect(source).toContain('process.env.NEXT_PUBLIC_SITE_URL');
  });

  it('and it resolves to null when unset or malformed — the deindexing failure mode', () => {
    /*
      This is the property that makes "origin is not production ⇒ noindex"
      dangerous rather than merely imprecise.
    */
    const source = read('lib/seo/siteOrigin.ts');

    expect(source).toMatch(/return resolved\.ok \? resolved\.origin : null;/);
  });
});

describe('B5-F · the environment now drives noindex — and ONLY through the authority', () => {
  it('no noindex rule keys off a FORBIDDEN signal anywhere', () => {
    /*
      ══ SUPERSEDED BY B5.1 ══════════════════════════════════════════════════

      B5 asserted that NOTHING keyed off an environment, because nothing could:
      no reliable signal existed. B5.1 found one and implemented it, so the
      blanket ban is now false by design.

      What must STILL hold is the part that was never about availability: the
      FORBIDDEN signals remain forbidden. NODE_ENV is 'production' in both
      environments; a hostname comparison and NEXT_PUBLIC_SITE_URL both fail
      towards deindexing Production. None of them may appear here whatever
      signal is available.

      `metadata.ts` may now name the authority — that IS the implementation —
      but it must not re-derive the environment for itself.
    */
    const metadata = read('lib/seo/metadata.ts');
    const routes = read('lib/seo/routes.ts');

    for (const source of [metadata, routes]) {
      expect(source).not.toMatch(/NODE_ENV/);
      expect(source).not.toMatch(/RAILWAY_/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/hostname/i);
      expect(source).not.toMatch(/NEXT_PUBLIC_SITE_URL/);
    }
  });

  it('metadata consults the authority rather than reading the environment itself', () => {
    const metadata = read('lib/seo/metadata.ts');

    expect(metadata).toContain('isAlphaEnvironment()');
    expect(metadata).toContain("from './deploymentEnvironment'");
  });

  it('indexability still comes only from the route registry', () => {
    /*
      One table, read by page metadata, robots.ts and sitemap.ts alike — which
      is the property that stops a page saying noindex while the sitemap
      advertises it.
    */
    expect(read('lib/seo/metadata.ts')).toContain('indexable');
    expect(read('lib/seo/routes.ts')).toContain("export type Indexability = 'index' | 'noindex'");
  });
});

describe('B5-F · Disallow: / was NOT used as a substitute for noindex', () => {
  it('robots.txt allows the root', () => {
    /*
      THE RULING, AND THE REASON, WHICH THIS TREE ALREADY GOT RIGHT ONCE.
      A noindex directive must be CRAWLABLE to be obeyed: a blocked URL is never
      fetched, so the directive on the page is never read, and the URL can still
      surface when discovered from elsewhere. Blocking is therefore not a
      stronger form of noindex — it DEFEATS noindex.

      robots.ts records that this exact mistake was made and corrected by CTO
      ruling once before. Adding `Disallow: /` for Alpha would reintroduce it at
      the scale of the whole site.
    */
    const source = read('app/robots.ts');

    expect(source).toContain("allow: '/'");
    expect(source).toContain('A `noindex` rule must be crawlable to be obeyed');
  });

  it('and the disallow list stays scoped to /api, which carries no directive to read', () => {
    expect([...DISALLOWED_PREFIXES]).toEqual(['/api']);
  });
});
