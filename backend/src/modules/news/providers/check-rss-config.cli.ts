/*
  E1-TAA-1 — PRE-RELEASE RSS CONFIGURATION CHECK. Run against the target environment's values before
  a release: `npm run check:rss-config` (reads RSS_FEEDS_ENABLED and RSS_FEED_SOURCES from the
  process environment; prints feed ids only, never another variable). Exit 1 when the lane is enabled
  and the allowlist names a feed the source registry refuses or does not know.
*/
import { rssConfigViolations } from './rss-feed.provider';

const violations = rssConfigViolations(process.env.RSS_FEEDS_ENABLED, process.env.RSS_FEED_SOURCES);
if (violations.length > 0) {
  console.error(`RSS configuration REFUSED by the source registry:\n  ${violations.join('\n  ')}`);
  process.exit(1);
}
console.log('RSS configuration admissible (lane disabled, or every listed feed is CLEARED).');
