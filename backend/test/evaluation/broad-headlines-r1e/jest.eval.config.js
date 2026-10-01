/*
 * PUBLIC BETA HARDENING R1E — evaluation-only Jest config.
 *
 * The backend suite collects `src/**\/*.spec.ts` (package.json jest.rootDir = "src") and the
 * build compiles `src` only, so nothing under `test/evaluation/` can run in the normal suite or ship
 * in the runtime. Run explicitly:
 *   npx jest -c test/evaluation/broad-headlines-r1e/jest.eval.config.js
 */
module.exports = {
  rootDir: '../../..',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'test/evaluation/broad-headlines-r1e/.*\\.eval\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@globalnews-ai/shared$': '<rootDir>/../shared/dist/index.js',
    '^(\\.{1,2}/(?:src|corpus|fixtures)/[a-z-]+(?:\\.fixture)?|\\./(?:ports|envelope|planner|registry|classify|index))\\.js$':
      '$1',
  },
};
