/* Jest setupFiles only (package.json "jest.setupFiles"). See reader-rights.ts: pre-R48 suites run
   with source-rights enforcement off so their GNews-shaped fixtures keep testing what they test;
   each R48 spec switches it back on in its own beforeAll. Never imported by application code. */
import { __setReaderRightsFixtureModeForTests } from '../modules/news/rights/reader-rights';

__setReaderRightsFixtureModeForTests(true);
