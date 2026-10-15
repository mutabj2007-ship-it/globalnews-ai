/*
  CTO R81 (#93 J-10) — THE ONE ENFORCEMENT SWITCH for every rights gate on this lineage: the
  source-use policy's default (model input, Ask payloads, stored reads), the reader-rights response
  interceptor and Gate A provider admission all read it, so they can never disagree in polarity.

  TEST-ONLY SETTER. Suites written before the convergence use GNews-shaped fixtures to test OTHER
  behaviour; the backend Jest setup file (test-setup/reader-rights-fixture-mode.ts) turns enforcement
  off for them, and every rights spec turns it back on. Production code never calls the setter, and
  nothing here reads the environment: a running service is always enforced.
*/
let fixtureMode = false;
export function __setReaderRightsFixtureModeForTests(on: boolean): void {
  fixtureMode = on;
}
/** True in every running service; false only inside fixture-mode Jest suites. */
export function readerRightsEnforced(): boolean {
  return !fixtureMode;
}

/*
  TEST-ONLY feed table shared by every gate (the reviewed registry has no CLEARED feed, so the
  no-false-negative specs add one). Production never calls the setter; the registry is never modified.
*/
let testFeeds: readonly import('../providers/feed-source-registry').FeedSourceEntry[] | null = null;
export function __setRightsTestFeeds(feeds: typeof testFeeds): void {
  testFeeds = feeds;
}
export function rightsTestFeeds(): typeof testFeeds {
  return testFeeds;
}
