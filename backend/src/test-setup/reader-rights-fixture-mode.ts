/* Jest setupFiles only (package.json "jest.setupFiles"). See rights-enforcement.ts: pre-R48 suites run
   with source-rights enforcement off so their GNews-shaped fixtures keep testing what they test;
   each rights spec switches it back on in its own beforeAll. Never imported by application code.

   CTO R81 (Alpha convergence) — imports the SWITCH MODULE ONLY. Importing reader-rights here would
   load source-use-policy and the real feed registry BEFORE a spec's jest.mock of the registry takes
   effect, so specs that mock the registry (CLEARED fixture feeds) would see the real one. */
import { __setReaderRightsFixtureModeForTests } from '../modules/news/rights/rights-enforcement';

__setReaderRightsFixtureModeForTests(true);
