/**
 * ════════════════════════════════════════════════════════════════════════════
 * ALPHA MAJOR CONVERGENCE R1 — THE SHARED PACKAGE GAINS A TEST RUNNER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MEASURED, NOT ASSUMED. Before this round `shared/src/**\/*.spec.ts` executed
 * NOWHERE:
 *
 *   backend  jest.rootDir = "src"                  -> backend/src only
 *   frontend testMatch = "<rootDir>/src/**\/*.spec.ts" -> frontend/src only
 *   shared   no jest config and no test script     -> nothing at all
 *
 * Eleven spec files — including the strict-JSON decoder's own suite, the source
 * rights suite and the observation contracts — were being written, committed and
 * never run. A suite nobody executes is documentation with a `.spec.ts`
 * extension.
 *
 * The convergence brief requires shared validation (strict typecheck, the
 * official-data suites, the parser dispatch mutation proofs), and that
 * requirement cannot be met by a package with no runner. So the runner is added
 * here rather than the requirement being reported as satisfied by the two
 * workspaces that never covered it.
 *
 * `isolatedModules` is off deliberately: the parser dispatch proofs invoke the
 * real compiler themselves and need full type information available to ts-jest
 * for the surrounding suite.
 */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['<rootDir>/**/*.spec.ts'],
  transform: {
    '^.+\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
};
