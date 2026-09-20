/* MANUAL ONE-SHOT HARNESS — NISR first real data.
 *
 * Separate from the repository config for one reason: this run CAN ISSUE A NETWORK
 * REQUEST, and nothing that can issue a network request belongs in a config CI invokes.
 * The repository config has `rootDir: 'src'` and collects `.spec.ts`; the harness lives
 * in `tooling/` and is named `.run.ts`, so it is invisible to it on BOTH counts.
 *
 * `tooling/**` is ALREADY in `tsconfig.build.json`'s exclude list, so the harness is kept
 * out of the production image by an EXISTING rule rather than by a new exemption written
 * to accommodate it. Nothing about the build configuration was widened.
 *
 * `moduleNameMapper` DELIBERATELY MATCHES THE PRODUCTION BACKEND MAPPING (`shared/dist`),
 * so the run happens on the ACTUAL PRODUCER RUNTIME PATH — resolving the shared package
 * differently from production would make the result a statement about a different
 * runtime.
 *
 * Run deliberately, with the authorisation flag, and never otherwise:
 *
 *     NISR_REHEARSAL=1 npx jest --config jest.nisr-rehearsal.config.js
 */
module.exports = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'tooling/nisr-rehearsal/.*\\.run\\.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { isolatedModules: true }] },
  testEnvironment: 'node',
  testTimeout: 120000,
  moduleNameMapper: { '^@globalnews-ai/shared$': '<rootDir>/../shared/dist/index.js' },
};
