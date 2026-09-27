/**
 * DEVELOPMENT FIXTURES — NOT LIVE DATA, AND NEVER PRESENTED AS LIVE.
 *
 * The Product Owner authorised a FRONTEND lane and forbade building backend
 * persistence, migrations, API architecture, Watch runtime, charging or
 * provider logic in it. Three capabilities the frozen design renders do not
 * exist on the release:
 *
 *   Saved Stories persistence and its APIs   NOT PRESENT  (capability sheet §1.6)
 *   A `/my-intelligence` route                NOT PRESENT  (§1.7)
 *   A writer for `POST /history`              NOT PRESENT  (§0.1)
 *
 * Without something to render, the approved states cannot be inspected. These
 * fixtures exist for that and nothing else, under three hard rules:
 *
 *   1. They are OFF unless `NEXT_PUBLIC_MI_DEV_FIXTURES === 'true'`.
 *   2. Whenever any section is fixture-backed, the page renders a persistent
 *      "DEVELOPMENT FIXTURES · NOT LIVE DATA" banner, and every card's meta
 *      line carries "Sample" — which the frozen design already specifies.
 *   3. Nothing here is written to any store. There is no persistence in this
 *      lane, so a reload discards every fixture interaction.
 *
 * The publishers are invented names. The URLs point at example.com, which
 * cannot be mistaken for a real publisher and cannot be followed to one.
 */

import type { ObservableRecord } from './newSince';

export const MI_FIXTURES_ENABLED = process.env.NEXT_PUBLIC_MI_DEV_FIXTURES === 'true';

export interface FixtureStory extends ObservableRecord {
  /** Server-issued SHA-256 article reference when this row comes from retained live data. */
  readonly articleRef?: string;
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly sourceName: string;
  readonly publishedAt: string;
  readonly firstSeenAt?: string;
  readonly countryCode: string;
  readonly category: string;
  readonly imageUrl?: string;
  readonly savedAt?: string;
  /** Set when the publisher link no longer opens. The item is kept, honestly. */
  readonly sourceUnavailable?: boolean;
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

/**
 * The previous-visit boundary used while fixtures drive the page.
 *
 * The real mechanism is `POST /users/me/seen`. It is NOT called here, on
 * purpose: the capability sheet classifies it REUSE WITH ADDITIVE
 * VISIT-BOUNDARY REPAIR and lists "ship the surface on the unrepaired
 * endpoint" among the things this feature must not do. The repair is a backend
 * change and backend work is out of scope for this lane, so the frontend is
 * built against the boundary's SHAPE — one nullable ISO timestamp — and the
 * real call is wired in `useMyIntelligenceData` behind a flag that stays off.
 */
export const FIXTURE_PREVIOUS_SEEN_AT = hoursAgo(26);

/**
 * Deliberately mixed, because these five rows are what prove the rule.
 *
 *   n1  published 3 days ago, first identified 2 hours ago  → NEW
 *       This is the case the Product Owner refused to let disappear.
 *   n2  published 6 hours ago, identified 5 hours ago        → NEW
 *   n3  published 4 hours ago, identified 40 hours ago       → NOT NEW
 *       (published after the boundary, but we had already seen it)
 *   n4  no firstSeenAt at all                                → NOT ELIGIBLE
 *       Never counted, never labelled "identified", never guessed.
 *   n5  published 1 day ago, identified 20 hours ago         → NEW
 */
export const FIXTURE_NEW_SINCE: readonly FixtureStory[] = [
  {
    id: 'mi-n1',
    url: 'https://example.com/sample/eu-grid-connection-bill',
    title: 'Sejm committee advances grid-connection bill for renewables',
    sourceName: 'Baltic Ledger',
    publishedAt: daysAgo(3),
    firstSeenAt: hoursAgo(2),
    countryCode: 'PL',
    category: 'Energy',
  },
  {
    id: 'mi-n2',
    url: 'https://example.com/sample/nairobi-commuter-rail',
    title: 'Nairobi commuter rail extension receives funding approval',
    sourceName: 'Meridian Post',
    publishedAt: hoursAgo(6),
    firstSeenAt: hoursAgo(5),
    countryCode: 'KE',
    category: 'Economy',
  },
  {
    id: 'mi-n3',
    url: 'https://example.com/sample/port-tariff-review',
    title: 'Port tariff review reopens after operator appeal',
    sourceName: 'Harbor Daily',
    publishedAt: hoursAgo(4),
    firstSeenAt: hoursAgo(40),
    countryCode: 'KE',
    category: 'Economy',
  },
  {
    id: 'mi-n4',
    url: 'https://example.com/sample/unrecorded-observation',
    title: 'Regional grid operators publish winter adequacy outlook',
    sourceName: 'Northline Wire',
    publishedAt: hoursAgo(9),
    countryCode: 'PL',
    category: 'Energy',
  },
  {
    id: 'mi-n5',
    url: 'https://example.com/sample/brazil-soybean-record',
    title: 'Brazil soybean exports reach a September record',
    sourceName: 'Harbor Daily',
    publishedAt: daysAgo(1),
    firstSeenAt: hoursAgo(20),
    countryCode: 'BR',
    category: 'Economy',
  },
];

/** Saved stories, including the three edge states the authority draws. */
export const FIXTURE_SAVED: readonly FixtureStory[] = [
  {
    id: 'mi-s1',
    url: 'https://example.com/sample/europe-gas-storage',
    title: "Europe's gas storage reaches its winter target ahead of schedule",
    sourceName: 'Northline Wire',
    publishedAt: daysAgo(2),
    firstSeenAt: daysAgo(2),
    countryCode: 'EU',
    category: 'Energy',
    savedAt: daysAgo(1),
  },
  {
    id: 'mi-s2',
    url: 'https://example.com/sample/poland-central-bank-rates',
    title: "Poland's central bank holds rates as inflation eases for a third month",
    sourceName: 'Baltic Ledger',
    publishedAt: daysAgo(2),
    firstSeenAt: daysAgo(2),
    countryCode: 'PL',
    category: 'Economy',
    savedAt: daysAgo(1),
  },
  {
    /* Long headline + missing image: wraps in full, no clamp. */
    id: 'mi-s3',
    url: 'https://example.com/sample/warsaw-green-bond-fund',
    title:
      'Warsaw exchange lists its first green bond fund after two years of regulatory review, drawing strong early demand from pension funds and municipal issuers across Central Europe',
    sourceName: 'Harbor Daily',
    publishedAt: daysAgo(3),
    firstSeenAt: daysAgo(3),
    countryCode: 'PL',
    category: 'Economy',
    savedAt: daysAgo(2),
  },
  {
    /* Source unavailable: the item is KEPT and says so. It cannot be selected. */
    id: 'mi-s4',
    url: 'https://example.com/sample/geothermal-expansion-hearing',
    title: 'Geothermal expansion plan clears final environmental hearing',
    sourceName: 'Meridian Post',
    publishedAt: daysAgo(6),
    firstSeenAt: daysAgo(6),
    countryCode: 'JP',
    category: 'Energy',
    savedAt: daysAgo(4),
    sourceUnavailable: true,
  },
];

/** For you: follow-based, and never repeating an item already in New since. */
export const FIXTURE_FOR_YOU: readonly FixtureStory[] = [
  {
    id: 'mi-f1',
    url: 'https://example.com/sample/kenya-power-tariff',
    title: 'Kenya publishes revised power tariff schedule for industrial users',
    sourceName: 'Meridian Post',
    publishedAt: daysAgo(1),
    firstSeenAt: hoursAgo(30),
    countryCode: 'KE',
    category: 'Energy',
  },
  {
    id: 'mi-f2',
    url: 'https://example.com/sample/poland-rail-freight',
    title: 'Rail freight volumes rise for a second quarter on the Baltic corridor',
    sourceName: 'Baltic Ledger',
    publishedAt: daysAgo(2),
    firstSeenAt: daysAgo(2),
    countryCode: 'PL',
    category: 'Economy',
  },
];

/** Followed countries, when the real follow API has nothing to say (signed out). */
export const FIXTURE_FOLLOWS: readonly string[] = ['POL', 'KEN', 'BRA', 'JPN'];
