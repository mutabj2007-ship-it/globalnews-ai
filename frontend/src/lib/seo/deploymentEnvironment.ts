/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE DEPLOYMENT ENVIRONMENT AUTHORITY — SERVER-SIDE, RUNTIME, EXACT-MATCH
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `ALPHA-NOINDEX-ENV-SIGNAL-1`. One question, answered in one place: **is this
 * process serving the Alpha environment?**
 *
 * ── WHY `RAILWAY_ENVIRONMENT_ID` AND NOT THE NAME ────────────────────────
 *
 * Both are injected and both currently discriminate. The **id** is used because
 * it is the only one that is *stable by construction*:
 *
 *   - A Railway environment can be RENAMED. `RAILWAY_ENVIRONMENT_NAME` would
 *     follow the rename; the id would not. A rename is a UI action nobody would
 *     think to connect to search indexing.
 *   - The id is the value the governance record already names, so the code and
 *     the ruling cite the same string.
 *
 * Measured on the frontend service, read-only, before this was written:
 *
 *     RAILWAY_ENVIRONMENT_ID   alpha       70105bf5-b195-41af-b237-8745c8e76506
 *                              production  8f4c9c3e-21f5-4fc1-abed-89e3b30eaddc
 *
 * ── WHY IT IS SAFE TO READ AT RUNTIME, WHICH IS THE WHOLE QUESTION ───────
 *
 * This is NOT a `NEXT_PUBLIC_*` variable, so Next does not inline it into the
 * client bundle, and it is read here through a **static property access** on
 * `process.env` in server-only code. Proven empirically rather than assumed:
 * the frontend was built with the variable **UNSET**, then started with it
 * **SET**, and a server-rendered route returned the correct Alpha id. It
 * therefore cannot have been baked at build time — it could not have been,
 * since it was absent then.
 *
 * That matters because the Dockerfile's build stage declares `ARG` for exactly
 * three variables and this is not one of them, so it is genuinely unavailable
 * during `next build`. Any mechanism that needed it at build time would
 * silently get `undefined` and quietly behave as Production.
 *
 * ── AND WHY IT FAILS TOWARDS PRODUCTION ──────────────────────────────────
 *
 * THE TWO FAILURE DIRECTIONS ARE NOT SYMMETRIC, and that asymmetry decides the
 * default. An Alpha that is indexable for another week is visible, containable
 * and reversible. A Production that silently went `noindex` is an invisible
 * outage across the product's entire discovery surface, and recovery takes as
 * long as the crawler takes to return.
 *
 * So ONLY an exact match on the Alpha id is Alpha. Unset, empty, whitespace,
 * misspelt, a different environment, a value with surrounding quotes — every
 * one of them is Production behaviour. A misconfigured Production keeps its
 * index; a misconfigured Alpha is a deployment-verification failure, which is
 * the kind you can see.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ───────────────────────────────────
 *
 * It does not read `NODE_ENV` (`'production'` in BOTH environments), the
 * hostname, `NEXT_PUBLIC_SITE_URL` (a build identity that resolves null when
 * unset), or any "is this the production host" comparison. Each was ruled out,
 * and each would reintroduce the deindexing failure mode above.
 */

/** The governed Alpha environment. Cited by id in the governance record. */
export const ALPHA_ENVIRONMENT_ID = '70105bf5-b195-41af-b237-8745c8e76506';

/** The governed Production environment. Recorded for evidence; never a trigger. */
export const PRODUCTION_ENVIRONMENT_ID = '8f4c9c3e-21f5-4fc1-abed-89e3b30eaddc';

export const ENVIRONMENT_ID_VAR = 'RAILWAY_ENVIRONMENT_ID';

/**
 * Pure, so the decision can be tested without mutating the process environment.
 *
 * NO TRIMMING, NO CASE FOLDING, NO UNQUOTING. A value that needs repairing
 * before it matches is a value somebody set wrongly, and quietly repairing it
 * here would turn a visible misconfiguration into a silent one — in the
 * direction that costs Production its index.
 */
export function isAlphaEnvironmentId(value: string | undefined | null): boolean {
  return value === ALPHA_ENVIRONMENT_ID;
}

/**
 * Is THIS process serving Alpha?
 *
 * Read as a static property access so the reference is unambiguous to any
 * bundler that inspects it, and evaluated per call rather than captured in a
 * module constant — a constant would freeze the answer at first import, which
 * on a long-lived server is a different thing from reading the environment.
 */
export function isAlphaEnvironment(): boolean {
  return isAlphaEnvironmentId(process.env.RAILWAY_ENVIRONMENT_ID);
}
