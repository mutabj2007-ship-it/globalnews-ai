/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    /*
      B3.1 — THIS WORKTREE'S SHARED PACKAGE, NOT THE ALPHA WORKTREE'S.

      node_modules is junctioned from the Alpha worktree so the Beta branch
      needs no install of its own — and that junction made
      '@globalnews-ai/shared' resolve to ALPHA's build. Contracts recovered
      into THIS tree were invisible to its own tests: the MAIN-BUILD-2
      stale-dist trap by another route. A test that cannot see the thing it
      tests passes for the wrong reason.
    */
    '^@globalnews-ai/shared$': '<rootDir>/../shared/src/index.ts',
  },
  transform: {
    '^.+\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.jest.json',
      },
    ],
  },
};
