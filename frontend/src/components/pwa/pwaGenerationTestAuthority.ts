/**
 * PWA GENERATION — THE TEST-SIDE AUTHORITY.
 *
 * TEST SUPPORT ONLY. Nothing in the running application may import this file, and
 * `pwaGenerationAuthority.spec.ts` asserts that no non-spec module does.
 *
 * WHY THIS FILE EXISTS
 *
 * Two accepted suites pinned the service-worker generation as string literals, in
 * OPPOSITE directions:
 *
 *     serviceWorkerCacheFailure.spec.ts  T13   expected 'gna-pwa-v5'
 *     supportOfflineCopy.spec.ts         S3    expected 'gna-pwa-v6'
 *
 * Each was correct in the lane that wrote it, and each is a PATCH CONSEQUENCE — an
 * assertion that its own lane moved the version literal — rather than a preservation
 * guard. At C53 the production worker is at v6, so T13 failed. Nothing it guards had
 * regressed: the other twelve tests in that file, which are the quota and cache-write
 * hardening, all passed under v6. What failed was a marker left pinned to an earlier
 * lane's generation.
 *
 * A pin that must be hand-edited in several suites at every legitimate bump is a
 * tripwire on a schedule. The next bump would fire it again, in the other direction:
 * at v7, S3 would collide exactly as T13 did.
 *
 * WHY THIS IS A HAND-MAINTAINED LITERAL, AND MUST STAY ONE
 *
 * The tempting repair is to read `VERSION` out of `sw.js` and compare it to itself.
 * That would make BOTH assertions vacuous. They would pass for any value at all,
 * including a generation that was never bumped — which is the exact defect the bump
 * exists to prevent, and the one the real-browser negative control had to be built to
 * catch. A test whose expectation is derived from the artefact under test does not
 * test it; it agrees with it.
 *
 * So the expected generation is stated INDEPENDENTLY, here. This file reads no file,
 * imports nothing, and derives nothing. That is not an oversight to be optimised away
 * later — it is the property that gives the two assertions their content, and
 * `pwaGenerationAuthority.spec.ts` guards it by scanning this file's own source.
 *
 * WHEN THE PRODUCTION GENERATION LEGITIMATELY MOVES
 *
 * Change this ONE line, in the same change that moves `sw.js`. Nothing else. A
 * generation is never reused for different bytes: after v6 comes v7, including for a
 * rollback.
 */
export const CURRENT_EXPECTED_PWA_GENERATION = 'gna-pwa-v7';
