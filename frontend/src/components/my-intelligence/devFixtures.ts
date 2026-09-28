import type { MyIntelligenceInterest } from '@globalnews-ai/shared';
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
  /** INTEREST + SELECTION HOOK R1 — the governed interests this retained story matches (server-derived). */
  readonly interests?: readonly MyIntelligenceInterest[];
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
    articleRef: '82c1a584826bec47c336b60bc8cb9b5aafd86dde7ad5546ed8edb490ed915b8a',
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
    articleRef: '2bf9d313cf703bbfeedf897debcbfe9ba0c678b1a7b901a64feb5a8bbf9b81d1',
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
    articleRef: 'c8acfb360fa29e1913786a8d39c3d7fa5599bb7aa7a9dbfa721f6d9488363644',
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
    articleRef: 'dfeb1e380fd895dcc76e93b566de0b6780397e4706ecf664737362286137428d',
    url: 'https://example.com/sample/unrecorded-observation',
    title: 'Regional grid operators publish winter adequacy outlook',
    sourceName: 'Northline Wire',
    publishedAt: hoursAgo(9),
    countryCode: 'PL',
    category: 'Energy',
  },
  {
    id: 'mi-n5',
    articleRef: '340ae5f2162695870e57dccb51734c10b4b19f80fca0cf20836eb786320293ce',
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
    articleRef: '239c6fc4186e0c2ce139b10e3d20d47593c8085eddf4b96c992c6392d63b87ba',
    url: 'https://example.com/sample/europe-gas-storage',
    /* Review fixture: exercises the image-present path (synthetic example.com URL). */
    imageUrl: 'https://example.com/sample/europe-gas-storage.jpg',
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
    articleRef: 'f7f3015b1ab1347233362c1da71b3be440dfcc8fb0d48ef28cbe5c57bc92b1ce',
    url: 'https://example.com/sample/poland-central-bank-rates',
    /* Review fixture: an image URL that may fail, exercising the broken-image fallback. */
    imageUrl: 'https://example.com/sample/poland-central-bank-rates.jpg',
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
    articleRef: 'e476fe34675cfd0a2be1204d3da589ad489c79ee9772b3da4154f453993614ce',
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
    articleRef: '7d9cdadc71dbefe4690ec53627e54c12c2d8ba30795371a7521ce63653c2bfe5',
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
    articleRef: '68c33e0b0044a32e9714ef38735a6a59efc83d65dbd4575200191b9b2924ce65',
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
    /* Review fixture with NO governed reference: exercises the honest refusal. */
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
