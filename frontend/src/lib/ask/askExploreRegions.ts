import {
  COUNTRIES,
  EAST_AFRICA_MEMBERS,
  MIDDLE_EAST_MEMBERS,
  findCountryByIso3,
  getLocalizedCountryName,
  type ConflictObservation,
  type MarketRetainedProcurementNotice,
} from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R135 ASK EXPLORE R1 — THE THREE COVERAGE REGIONS, AS DATA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Product Owner order (2026-10-17): "What changed in my region" must be ready and clickable inside
 * Ask, the Europe · East Africa · Middle East elements and the maps attached to Ask. This module is
 * the one place the regions are defined: membership by the SOURCE-STATED ISO3 country of a retained
 * record (never inferred from coordinates or text), the map camera each region opens at, and which
 * already-built Alpha pages belong to it.
 *
 * Membership is a list of countries, not a claim of coverage: a region with no retained record says
 * so. Memberships are READ from the shared authorities, never restated (EA R135 ruling): East Africa
 * = the product-governed EAST_AFRICA_MEMBERS (11, COD yes, COG no), Middle East = MIDDLE_EAST_MEMBERS
 * (16), Europe = the shared country catalogue's region 'Europe' (not the EU-27).
 */
export type AskRegionId = 'europe' | 'east-africa' | 'middle-east';

export interface AskRegion {
  readonly id: AskRegionId;
  readonly iso3: ReadonlySet<string>;
  /** `?cam=zoom/lng/lat` (lib/map/camera/cameraUrl.ts) for the conflict map. */
  readonly camera: string;
  /** Already-built Alpha pages for this region, in order. Platform mode only. */
  readonly pages: readonly AskExplorePageId[];
}

export type AskExplorePageId =
  | 'conflict'
  | 'imihigo'
  | 'market'
  | 'humanitarian'
  | 'energy'
  | 'map'
  | 'stories'
  | 'visual'
  | 'economy-preview'
  | 'politics-preview'
  | 'election-preview'
  | 'security-preview'
  | 'delivery-preview';

export const ASK_EXPLORE_HREF: Readonly<Record<AskExplorePageId, string>> = {
  conflict: '/conflict',
  imihigo: '/imihigo',
  market: '/market',
  humanitarian: '/humanitarian',
  energy: '/energy',
  map: '/map',
  stories: '/stories',
  visual: '/visual',
  'economy-preview': '/economy-visual-preview',
  'politics-preview': '/politics-visual-preview',
  'election-preview': '/election-visual-preview',
  'security-preview': '/security-visual-preview',
  'delivery-preview': '/delivery-visual-preview',
};

/** The drawer's Explore list: every built page, data pages first, design previews last. */
export const ASK_EXPLORE_DRAWER: readonly AskExplorePageId[] = [
  'map',
  'conflict',
  'humanitarian',
  'market',
  'imihigo',
  'energy',
  'stories',
  'visual',
  'economy-preview',
  'politics-preview',
  'election-preview',
  'security-preview',
  'delivery-preview',
];

export const ASK_REGIONS: readonly AskRegion[] = [
  {
    id: 'europe',
    iso3: new Set(COUNTRIES.filter((c) => c.region === 'Europe').map((c) => c.iso3)),
    camera: '2.8/12/52',
    pages: ['conflict', 'market', 'humanitarian'],
  },
  {
    id: 'east-africa',
    iso3: new Set(EAST_AFRICA_MEMBERS),
    camera: '3.2/36/2',
    pages: ['conflict', 'imihigo', 'humanitarian'],
  },
  {
    id: 'middle-east',
    iso3: new Set(MIDDLE_EAST_MEMBERS),
    camera: '3.0/44/28',
    pages: ['conflict', 'humanitarian'],
  },
];

export function askRegion(id: AskRegionId): AskRegion {
  const region = ASK_REGIONS.find((r) => r.id === id);
  if (region === undefined) throw new Error(`UNKNOWN_ASK_REGION ${id}`);
  return region;
}

/** The conflict map opened at the region. */
export function regionMapHref(region: AskRegion): string {
  return `${ASK_EXPLORE_HREF.conflict}?cam=${region.camera}`;
}

/** One recorded event opened on the conflict map (the record selected, the view over the region). */
export function eventMapHref(region: AskRegion, observationKey: string): string {
  return `${regionMapHref(region)}&observation=${encodeURIComponent(observationKey)}`;
}

export interface RegionEvent {
  readonly key: string;
  /** Source-stated event date, `YYYY-MM-DD`. Never the ingest or retrieval time. */
  readonly eventDate: string;
  /** Source-stated country label ("DR Congo (Zaire)"), as the conflict map shows it. */
  readonly place: string;
  readonly iso3: string;
  /** The reporting outlets the dataset cites for this event. Names only, never a headline. */
  readonly reportedBy: readonly string[];
}

/**
 * The newest retained conflict events whose SOURCE-STATED country is in the region. Rows arrive
 * already validated and newest-first from `reviewedObservations` (lib/conflict/retained.ts);
 * retractions and rows without a stated country are dropped here, never guessed.
 */
export function regionEvents(
  rows: readonly ConflictObservation[],
  region: AskRegion,
  limit: number,
): { readonly total: number; readonly latest: readonly RegionEvent[] } {
  const inRegion = rows.filter(
    (row) =>
      row.revision.revisionKind !== 'RETRACTION' &&
      typeof row.geography.countryIso3 === 'string' &&
      region.iso3.has(row.geography.countryIso3),
  );
  return {
    total: inRegion.length,
    latest: inRegion.slice(0, limit).map((row) => ({
      key: row.observationKey,
      eventDate: row.temporal.eventStartedAt.slice(0, 10),
      place: row.geography.sourceCountryName ?? row.geography.countryIso3 ?? '',
      iso3: row.geography.countryIso3 ?? '',
      reportedBy: reportingOutlets(row.sourceReference?.reportingOffice),
    })),
  };
}

/** "The New Times;Actualite.cd;@someone on X" → outlet names; social handles are not outlets. */
export function reportingOutlets(value: string | null | undefined): readonly string[] {
  if (typeof value !== 'string') return [];
  const names = value
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith('@') && !/\bon X\b/i.test(part));
  return Array.from(new Set(names)).slice(0, 3);
}

/** `YYYY-MM-DD` (or an ISO date with an offset) → a reader date, in UTC so the day never shifts. */
export function readerDate(value: string, locale: string): string {
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return value;
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${day}T00:00:00Z`),
    );
  } catch {
    return day;
  }
}

export interface TenderRow {
  readonly key: string;
  readonly title: string;
  readonly buyer: string | null;
  readonly country: string;
  readonly published: string;
  readonly deadline: string | null;
  /** True when the stated deadline day is before today (UTC). Unknown deadline → false, never "open". */
  readonly closed: boolean;
  readonly href: string;
}

/** Newest-first TED notices with a title; the reader's language first, the source's otherwise. */
export function tenderRows(
  notices: readonly MarketRetainedProcurementNotice[],
  locale: string,
  now: Date,
  limit: number,
): { readonly total: number; readonly latest: readonly TenderRow[] } {
  const today = now.toISOString().slice(0, 10);
  /* Still-open tenders first, soonest deadline first; then the rest, newest publication first. */
  const isOpen = (n: MarketRetainedProcurementNotice): boolean =>
    n.deadlineDate !== null && n.deadlineDate.slice(0, 10) >= today;
  const rows = notices
    .filter((n) => (n.title.en ?? n.title.pl ?? '').trim() !== '' && /^https:\/\//.test(n.sourceUrl))
    .slice()
    .sort((a, b) => {
      const ao = isOpen(a);
      const bo = isOpen(b);
      if (ao !== bo) return ao ? -1 : 1;
      const ka = ao ? a.deadlineDate ?? '' : b.publicationDate;
      const kb = ao ? b.deadlineDate ?? '' : a.publicationDate;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  return {
    total: rows.length,
    latest: rows.slice(0, limit).map((n) => {
      const title = (locale === 'pl' ? n.title.pl ?? n.title.en : n.title.en ?? n.title.pl) ?? '';
      const buyers = (locale === 'pl' ? n.buyerNames.pl : n.buyerNames.en) ?? n.buyerNames.source ?? [];
      const deadline = n.deadlineDate === null ? null : n.deadlineDate.slice(0, 10);
      return {
        key: `${n.portalReference.portalId}:${n.portalReference.noticeId}`,
        title,
        buyer: buyers[0] ?? null,
        country: n.buyerCountryIso3,
        published: n.publicationDate.slice(0, 10),
        deadline,
        closed: deadline !== null && deadline < today,
        href: n.sourceUrl,
      };
    }),
  };
}

/**
 * The region's member countries in the reader's language, sorted. COD is ALWAYS the caller's
 * explicit "DR Congo" label (EA R135 ruling 3: never bare "Congo", never "Congo - Kinshasa").
 */
export function regionMemberNames(region: AskRegion, locale: string, drCongo: string): readonly string[] {
  const out = Array.from(region.iso3).map((iso3) => {
    if (iso3 === 'COD') return drCongo;
    const iso2 = findCountryByIso3(iso3)?.iso2;
    return (iso2 !== undefined ? getLocalizedCountryName(iso2, locale as Parameters<typeof getLocalizedCountryName>[1]) : undefined) ?? findCountryByIso3(iso3)?.name ?? iso3;
  });
  return out.sort((a, b) => a.localeCompare(b, locale));
}
