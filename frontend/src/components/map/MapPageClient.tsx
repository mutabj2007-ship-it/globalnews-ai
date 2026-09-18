'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { COUNTRIES, NEWS_CATEGORIES } from '@globalnews-ai/shared';
import type { CountryMeta, CountryNewsResponse, LanguageCode, NewsCategory, NewsResponse } from '@globalnews-ai/shared';
/*
  RELEASE-LINE RECONCILIATION (MAIN-CONVERGED-ALPHA-POST-AUTH-1-R3, 2 lines).
  C55 imports `sourceLanguageFor` and the `DisplayLocale` union from its shared
  `language/` module, which the release line does not carry. The release line's
  accepted equivalent is `@/lib/i18n/sourceLanguage`, written during the Spatial
  production decoupling against the release line's `LanguageCode` union for
  exactly this purpose, and documented there as behaviour-identical for every
  value this contract can produce. Nothing else in this file is changed.
*/
import { sourceLanguageFor } from '@/lib/i18n/sourceLanguage';
import type { CountryFeature } from '@/lib/map/countryGeometry';
import type { HoveredCountry } from '@/components/map/WorldMap';
import { mapShellVariant } from '@/lib/map/mapShellFlag';
import { CAMERA_QUERY_KEY, cameraFromSearchParams, searchParamsWithCamera } from '@/lib/map/camera/cameraUrl';
import type { CameraState } from '@/lib/map/camera/cameraState';
import {
  mapStateFromSearchParams,
  searchParamsWithMapState,
} from '@/lib/map/state/mapUrl';
import type { MapMode, MapPeriod, MapSelection } from '@/lib/map/state/mapState';
import { countryEvidenceSet, mapFeedRecordsFrom, mergeEvidenceSets } from '@/lib/map/evidence/evidenceFeed';
import { globalEvidenceSet, placeableArticles } from '@/lib/map/evidence/globalEvidenceFeed';
import { fetchRetainedTopHeadlines } from '@/lib/api/newsApi';
import {
  mapFeedRequestKey,
  type MapEvidenceGeography,
} from '@/lib/api/mapFeedApi';
import { sharedGeographyResolver } from '@/lib/map/evidence/geographyResolver';
import {
  globalFeedKey,
  retainCountryGeography,
  retainGlobalFeed,
  retainGlobalGeography,
  retainedCountryCorpora,
  retainedCountryGeographies,
  retainedGlobalFeed,
  retainedGlobalGeography,
  type ResolvedArticleGeography,
} from '@/lib/map/state/retainedMapState';
import {
  applyCardFilters,
  categoryDistribution,
  coverageStateFrom,
  providerStatusFrom,
  retainedItemsFrom,
  retainedTopics,
} from '@/lib/map/selection/selectionIntelligence';
import type { SelectionDetail } from '@/components/map/shell/GlobalMapShell';
import { useCountryFollows } from '@/components/home/useCountryFollows';
import type { EvidenceGeography } from '@/lib/map/evidence/evidenceModel';
import { getLocalizedCountryName } from '@globalnews-ai/shared';
import { CountrySearchBox } from '@/components/map/CountrySearchBox';
import { CountryPanel } from '@/components/map/CountryPanel';
import { MapTooltip } from '@/components/map/MapTooltip';
import { CoverageLegend } from '@/components/map/CoverageLegend';
import type { CategoryFilterValue } from '@/components/map/CategoryFilterBar';
/*
  THE COUNTRY NEWS CLIENT IS DELIBERATELY NOT IMPORTED HERE ANY MORE.

  `fetchCountryNews` executes GNews. With the import gone the Map has no way to
  reach it, which is a stronger guarantee than a rule about who may call it —
  and it is why the provider registry can assert the absence of a symbol rather
  than the correctness of a guard.
*/
import { countryParamFor } from '@/lib/map/retrieval/countryRetrievalAuthority';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { readLanguageCookie } from '@/lib/i18n/languages';

/**
 * Milestone #49 (Phase B cleanup) — next/dynamic's `loading` callback
 * is a module-scope function with no access to MapPageClient's own
 * `language` prop or React state. This callback only ever executes
 * client-side (guaranteed by `ssr: false` below), so it's safe to call
 * the SAME `readLanguageCookie()` utility already used for the
 * homepage's Hero.tsx language-sync logic directly here — reusing the
 * existing cookie-reading mechanism rather than introducing a second
 * one. Falls back to 'en' exactly like every other cookie-absent case
 * in this codebase.
 */
function DynamicMapLoadingFallback(): JSX.Element {
  const language = readLanguageCookie() ?? 'en';
  const t = getDictionary(language).map;

  return (
    <div className="flex h-full min-h-[360px] w-full items-center justify-center rounded-2xl border border-border bg-surface">
      <p className="font-mono text-xs text-ink-tertiary">{t.loading}</p>
    </div>
  );
}

const WorldMap = dynamic(() => import('@/components/map/WorldMap').then((m) => m.WorldMap), {
  ssr: false,
  loading: DynamicMapLoadingFallback,
});

/*
  SPATIAL M1a — THE SHELL, MOUNTED BESIDE THE EXISTING MAP AND NEVER INSTEAD
  OF IT IN THE TREE.

  `WorldMap` above is untouched and still fully wired. `resolveMapShellVariant`
  picks which one this route renders, so ROLLBACK IS UNSETTING AN ENVIRONMENT
  VARIABLE, not reverting a commit. Both are `ssr: false` dynamic imports, so
  the unchosen one is never even fetched by the browser.

  Default is 'legacy'. A flag whose failure mode is "ship the new thing" is not
  a rollback mechanism.
*/
const MobileSpatialShell = dynamic(
  () => import('@/components/map/mobile/MobileSpatialShell').then((m) => m.MobileSpatialShell),
  {
    ssr: false,
    loading: () => <div className="h-[100dvh] w-full bg-sp-bg" />,
  },
);

const GlobalMapShell = dynamic(
  () => import('@/components/map/shell/GlobalMapShell').then((m) => m.GlobalMapShell),
  { ssr: false, loading: DynamicMapLoadingFallback },
);

type CachedByCountry = Record<string, CountryNewsResponse>;

/*
  ── ONE ARTICLE'S GEOGRAPHY, AS G'S ROUTE RETURNED IT ─────────────────────

  CHECKPOINT C — THIS TYPE NOW LIVES IN `retainedMapState`, WHICH HOLDS IT.

  `feed` is still stored WHOLE and unmodified; the reasoning is unchanged and
  now lives beside the store that keeps it. The declaration moved rather than
  being duplicated because the store cannot import from a page component
  without a cycle, and two structurally identical interfaces would drift.
*/

/**
 * HOW MANY ARTICLES PER COUNTRY ARE SENT TO THE RESOLVER.
 *
 * A cap, not a sample: the country feed's records already cover every article
 * at country precision, and this enrichment only ever ADDS finer records on
 * top. So a bounded prefix produces a partially enriched map, never a partial
 * one — nothing disappears because it fell outside the cap.
 *
 * The number is a request-count decision, not a data decision. G's route
 * resolves in memory against the shipped gazetteer and spends no provider
 * quota, but it is still one HTTP round trip per headline.
 */
const MAP_FEED_ARTICLE_CAP = 12;

/**
 * H-1 — how many global headlines the world view asks for, and how many of
 * those are sent to G's resolver.
 *
 * RETRIEVAL-SIZE decisions, not data ones: every returned article that carries
 * a country becomes a record, any that do not are simply not placed, and the
 * country-level records already cover every placeable article before the
 * resolver adds finer ones on top. Raising either widens the world view; it
 * cannot change what a single record claims.
 *
 * P6 CORRECTION - 50 IS THE BACKEND'S CONTRACT, NOT A TASTE JUDGEMENT.
 *
 * GET /news/top-headlines is validated by TopHeadlinesQueryDto, whose `limit`
 * carries @Min(1) @Max(50), behind the global ValidationPipe registered in
 * backend/src/main.ts. A request for 60 is therefore rejected with HTTP 400
 * before any provider runs; getJson() turns that into a NewsApiError, the
 * fail-soft .catch() below leaves `globalFeed` null, and the world view shows
 * no ranked geography at all. 50 remains the largest value the accepted
 * contract admits.
 *
 * The frontend is the side that moves. The DTO is a backend-owned contract and
 * is deliberately NOT widened to fit this caller.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * B-2A CORRECTION - MAP OPEN ASKS FOR THE GOVERNED HOME CORPUS WIDTH, NOT 50.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * P6 asked for "the most the backend will ever give", and the cost of that was
 * invisible from here: `NewsService.buildHomeNewsCacheKey` keys the shared Home
 * corpus as `${limit}:${lang}`, so Home warming `24:en` and the Map asking for
 * `50:en` are TWO ENTRIES FOR ONE CORPUS. Map open therefore executed a live
 * provider retrieval no matter how warm Home was - and Home missed again
 * afterwards, because the fragmentation runs in both directions.
 *
 * THE WIDTH ISOLATION IS CORRECT AND IS NOT WHAT CHANGED. C7 of
 * news.service.home-cache.spec.ts states that a different retrieval width is a
 * different corpus and must not be served from the cache. That contract stands
 * untouched: a warm corpus of 12 genuinely cannot answer a request for 24, and
 * the cache is right to refuse. The fix is that this caller STOPS ASKING FOR A
 * DIFFERENT WIDTH, not that the cache starts blurring widths together.
 *
 * WHY 24 COSTS THE MAP NOTHING IT WAS DEMONSTRABLY USING. Enrichment is capped
 * at GLOBAL_FEED_ENRICH_CAP = 24 immediately below, so items 25-50 were never
 * resolved to a geography and never became finer-grained records. They reached
 * only `globalEvidenceSet`, as country-level entries for countries the first 24
 * articles very largely already name.
 *
 * IF THE MAP EVER GENUINELY NEEDS ITEMS 25-50, that must be an EXPLICIT later
 * retrieval - a pagination or "load more" action the reader takes - and not a
 * cost hidden inside opening the map. CTO ruling, B-2A.
 */
const GLOBAL_FEED_LIMIT = 24;
const GLOBAL_FEED_ENRICH_CAP = 24;

/** Shared empty filter set — an unfiltered selection allocates nothing. */
const EMPTY_CATEGORY_FILTERS: ReadonlySet<NewsCategory> = new Set<NewsCategory>();

/**
 * Milestone #49 — `language` is now part of the cache key. Without
 * this, switching from English to Polish (or back) could silently
 * reuse a response fetched in the other language, presenting
 * wrong-language source-language evidence as if it matched the
 * current selection.
 */
function cacheKey(iso3: string, category: CategoryFilterValue, language: LanguageCode): string {
  return `${iso3}:${category}:${language}`;
}

interface MapPageClientProps {
  /** Milestone #49 — defaults to 'en', so every pre-M49 caller renders exactly as before. */
  language?: LanguageCode;
}

/*
  ── H-C2 — THE MAP FORGOT ITSELF THE MOMENT YOU LEFT IT ────────────────

  The selected country and the category filter lived ONLY in React state.
  Nothing was written to the URL, the history entry or any store — so
  opening an analysis from a country panel and pressing Back remounted
  this component with `selectedCountry = null`. The reader came back to a
  blank world map and had to find their country again.

  The selection is now reflected in the URL, which is the browser's own
  mechanism for exactly this: Back restores the address, and the address
  restores the view. `router.replace` is deliberate — selecting a country
  should not manufacture a history entry per click, so Back still means
  "the page I came from" rather than "the previous country".

  RETRIEVAL IS UNTOUCHED. `loadCountry` is already keyed by
  (iso3, category, language) and already caches; restoring a selection
  calls the same path a click does. No new fetch, no new contract, and
  nothing here belongs to auth return-state, which remains Main's.
*/
/**
 * The reader's own name for a country, falling back to the backend's.
 *
 * `getLocalizedCountryName` is keyed by ISO-2 and the feed carries ISO-3, so
 * the registry is the bridge. Falls back to the response's own `countryName`
 * rather than to the code — a card headed "RWA" is the defect the browser run
 * already caught once.
 */
function localisedCountryName(iso3: string, fallback: string, language: LanguageCode): string {
  const meta = COUNTRIES.find((country) => country.iso3 === iso3);

  const source = sourceLanguageFor(language);
  return (meta && source ? getLocalizedCountryName(meta.iso2, source) : undefined) ?? fallback;
}

/*
  MUST-PRESERVE-CURRENT-AUTHORITY (MAIN-CONVERGED-ALPHA-POST-AUTH-1-R3).

  C55's version of this function casts the raw query value:

      return raw === null || raw === 'all' ? 'all' : (raw as CategoryFilterValue);

  The RELEASE LINE validates it against the published taxonomy, and that
  validation is accepted authority the Product Owner has named as DO NOT
  DISTURB. Taking the newer file wholesale would have silently dropped it, so
  the release line's body is kept verbatim and C55's is discarded. This is the
  one place in this file where the older line wins, and it wins because it is
  the stricter one.

  A category arriving from the address bar is UNTRUSTED INPUT, so it is
  checked against the taxonomy the product already publishes rather than
  cast. `?category=<anything>` would otherwise be forwarded verbatim to
  the country feed as a filter nobody defined.
*/
function readCategoryParam(raw: string | null): CategoryFilterValue {
  if (raw === null || raw === 'all') return 'all';
  return (NEWS_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as CategoryFilterValue)
    : 'all';
}

export function MapPageClient({ language = 'en' }: MapPageClientProps): JSX.Element {
  const router = useRouter();

  /*
    SPATIAL M1a — camera <-> URL.

    Read ONCE, at mount: the shell owns the camera thereafter, and re-reading
    the URL on every render would fight the user's own panning. Writes use
    `searchParamsWithCamera`, which PRESERVES the country and category
    parameters this route already carries — replacing the search string
    wholesale would drop the user's selection every time they panned.

    `replace`, not `push`, and `scroll: false`: panning a map should not fill
    the browser's back button with camera frames, and the shell has its own
    Previous View for that.
  */
  const mapVariant = mapShellVariant();

  /*
    ══ R5 · STRUCTURAL COMPOSITION SELECTION ════════════════════════════════

    H measured, on the R4 build, a SECOND MapLibre canvas collapsed to 0x0 and
    a 0x0 Spatial search input shadowing the real one. Both came from here: the
    desktop and mobile Spatial compositions were separated by `spatial:block` /
    `spatial:hidden`, which is a CSS rule — so the inactive composition was
    still MOUNTED, still ran MapLibre, and still owned a focusable input.

    THE RULING IS THAT CSS-HIDING IS NOT ENOUGH. Exactly one composition may be
    mounted, so the choice has to be structural. The BOUNDARY is unchanged and
    is still C55's: Part II's 861 px, the same value `spatial` registers in
    `tailwind.config.ts`. No breakpoint behaviour is invented — only the
    mechanism moves from "render both, hide one" to "render one".

    `null` until the effect runs, because the server cannot know the viewport
    and guessing would mount the wrong composition and then swap it. While it
    is null the workspace renders its loading frame — the same frame the
    dynamic import already shows — so nothing flashes and no map is built
    twice.
  */
  const SPATIAL_MIN_WIDTH_QUERY = '(min-width: 861px)';
  const [spatialWide, setSpatialWide] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia(SPATIAL_MIN_WIDTH_QUERY);
    const apply = () => setSpatialWide(query.matches);

    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);
  const [initialCamera] = useState<CameraState>(() =>
    cameraFromSearchParams(
      typeof window === 'undefined' ? null : new URLSearchParams(window.location.search),
    ),
  );

  /*
    M1a.1 CAMERA RESTORE — the fact only this component can know.

    Whether `cam=` was PRESENT in the address bar, read at mount from the same
    search string `initialCamera` is decoded from. The shell uses it to avoid
    fitting the mount-time country over a camera the user asked for explicitly.

    Deliberately `.has()` and not a comparison against the world camera: a link
    to `?country=USA&cam=1.1/12/20` is an explicit request for the world view
    beside a selected country, and comparing values would misread it as "no
    camera given" and re-frame the country anyway.
  */
  const [initialCameraRestored] = useState<boolean>(() =>
    typeof window === 'undefined'
      ? false
      : new URLSearchParams(window.location.search).has(CAMERA_QUERY_KEY),
  );

  /*
    SEEDED FROM THE URL, NOT null.

    The browser acceptance run caught this: with the camera starting as null,
    the single URL writer fired as soon as `restored` flipped — BEFORE the
    shell had reported a camera — and wrote a URL with no `cam`, erasing the
    camera the restore had just read. The map showed the right place (the
    shell had `initialCamera`) while the address bar lost it, so the link was
    no longer shareable and a second reload went to the world view.

    Seeding this from the same decode as `initialCamera` closes the window:
    there is no render in which the writer knows less about the camera than
    the URL already did. At the world view `searchParamsWithCamera` removes
    the key, so a plain /map is still written as plain /map.
  */
  const [camera, setCamera] = useState<CameraState>(initialCamera);
  const handleCameraChange = useCallback((next: CameraState) => setCamera(next), []);

  /*
    SPATIAL M2 — MODE, PERIOD AND SELECTION, READ ONCE FROM THE ADDRESS BAR.

    Same discipline as the camera at M1a and for the same reason: a `useState`
    initialiser runs exactly once, and `useSearchParams()` is empty on the first
    client render unless the route is wrapped in Suspense — which is what made
    an earlier restore silently never happen. `window.location.search` is
    available the moment this runs.

    Defaults (WORLD, 24H, no selection) are ABSENT from the URL rather than
    written, so a plain /map stays a plain /map.
  */
  const [initialMapState] = useState(() =>
    mapStateFromSearchParams(
      typeof window === 'undefined' ? null : new URLSearchParams(window.location.search),
    ),
  );
  const [mode, setMode] = useState<MapMode>(initialMapState.mode);
  const [period, setPeriod] = useState<MapPeriod>(initialMapState.period);
  const [spatialSelection, setSpatialSelection] = useState<MapSelection | null>(
    initialMapState.selection,
  );

  const [selectedCountry, setSelectedCountry] = useState<CountryMeta | null>(null);
  const [category, setCategory] = useState<CategoryFilterValue>('all');
  /* Nothing may be written to the URL until the URL has been read, or the
     first render would erase the very selection it is meant to restore. */
  const [restored, setRestored] = useState(false);
  /*
    ── CHECKPOINT C · THE MAP REMEMBERS WHAT IT WAS SHOWING ─────────────────

    Opening Analysis is a route navigation, so this component UNMOUNTS and Back
    REMOUNTS it. Initialising from the retained store is what makes returning a
    restore rather than a rebuild: the corpora, the resolved geographies and the
    world feed are all already here on the first render, so no effect below
    finds a gap it needs to fill by retrieving.

    The store is module-scope with a TTL mirroring the backend's own freshness
    window, so a restored corpus can never outlive what the server would serve.
  */
  const [cache, setCache] = useState<CachedByCountry>(() => retainedCountryCorpora());
  /*
    Retained-only: nothing on this surface loads asynchronously any more, so the
    country panel is never in a loading state. Kept as a constant rather than
    removed from the panel's contract, which other surfaces still use.
  */
  const isLoading = false;
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<HoveredCountry | null>(null);
  /*
    RESOLVED GEOGRAPHY FROM G's MAP FEED, KEYED BY COUNTRY.

    Fetched AFTER the country feed and never instead of it: the country feed is
    what the page has always shown, and this is an enrichment that adds real
    settlement coordinates and ISO 3166-2 region codes where G's gazetteer has
    them. If the route is unreachable every entry is absent and this map is
    exactly the country map, with no error surfaced to the reader.

    ONE ENTRY PER ARTICLE, NOT ONE PER COUNTRY. The country is already a record
    from the country feed; what this adds is the finer level a single report
    legitimately asserted, and collapsing several articles' places into one row
    per country would destroy exactly that.
  */
  const [geography, setGeography] = useState<Record<string, readonly ResolvedArticleGeography[]>>(
    () => retainedCountryGeographies(),
  );

  /*
    ── DESIGN REVISION 1.2 · BLOCK 06, AND THE FOUR THINGS IT IS NOT ────────

    Part II §3 adds `cardFilters Set<categoryId>` with four constraints, and
    each is met by WHERE this lives rather than by a comment:

      selection-scoped   component state on the route, cleared by
                         `handleSpatialSelection`.
      not a mode         `mode` is a different state above, serialised to a
                         different URL key; nothing writes one from the other.
      not URL-serialised `mapUrl.ts` has no key for it and the effect that
                         writes the URL does not read it.
      never alters the   the evidence set memo below does not depend on it. The
      evidence set       filter is applied where the LIST and the MARKERS are
                         chosen, downstream of the set the shell was given.
  */
  /*
    ── H-1 · THE WORLD VIEW'S OWN EVIDENCE ─────────────────────────────────

    Held separately from the per-country `cache` because they answer different
    questions: `cache` records what the reader ASKED about, this records what
    the platform is currently retaining across the world. Merging them into one
    map would make "looked at, nothing retained" indistinguishable from "never
    looked at".

    `null` until the first response lands — distinct from an empty response,
    which is a real answer and renders as one.
  */
  const [globalFeed, setGlobalFeed] = useState<NewsResponse | null>(() =>
    retainedGlobalFeed(globalFeedKey(GLOBAL_FEED_LIMIT, language)),
  );
  const [globalGeography, setGlobalGeography] = useState<readonly ResolvedArticleGeography[]>(
    () => retainedGlobalGeography(globalFeedKey(GLOBAL_FEED_LIMIT, language)) ?? [],
  );
  /*
    CHECKPOINT C — A RESTORED ENRICHMENT IS A COMPLETED ENRICHMENT.

    This flag is what stops the global enrichment effect running twice. If it
    started false after a restore, Back would re-resolve every headline the map
    had already resolved — which is the exact cost this checkpoint removes.
  */
  const globalEnrichmentDone = useRef(
    retainedGlobalGeography(globalFeedKey(GLOBAL_FEED_LIMIT, language)) !== null,
  );

  const [cardFilters, setCardFilters] = useState<ReadonlySet<NewsCategory>>(EMPTY_CATEGORY_FILTERS);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  /*
    ── THE ONE FOLLOWS INSTANCE THIS ROUTE OWNS ─────────────────────────────

    The accepted `useCountryFollows()` contract, consumed and not rebuilt: no
    new route, no schema change, no second fetch path, no follow state of its
    own. It feeds all three of the capabilities the ruling keeps apart —

      the FOLLOW/UNFOLLOW ACTION on the intelligence card,
      the WATCHING STATUS annotating evidence geography,
      the WATCHED-PLACES OVERLAY the layer rail toggles

    — from a single list, which is what stops them contradicting each other.
    It is also handed to `CountryPanel` below the card, so the control in the
    card and the control in the shelf cannot disagree after a mutation.
  */
  const follows = useCountryFollows();

  /*
    Followed geography as a set of ISO-3.

    `follows.follows === null` is the ACCEPTED SIGNED-OUT CONTRACT — anonymous,
    401, or a failed read — and is deliberately NOT the same as `[]`, which
    means signed in and following nothing. An empty set is correct for both as
    far as the OVERLAY is concerned; the distinction is carried separately to
    the action below, where it decides whether a control exists at all.
  */
  const watchSet = useMemo(
    () => new Set((follows.follows ?? []).map((iso3) => iso3.toUpperCase())),
    [follows.follows],
  );

  /*
    THE RELATIONSHIP FOR THE CURRENT SELECTION, or null.

    Null when there is no selection, when the selection is not a country, or —
    the honest case — when the follows contract cannot speak for this visitor.
    The card then renders NO control rather than a disabled one or one that
    would fail on click. A follow that appears to have saved and did not is the
    one outcome worse than no control at all.
  */
  const selectionFollow = useMemo(() => {
    if (follows.follows === null) return null;
    if (selectedCountry === null) return null;

    const iso3 = selectedCountry.iso3;

    return {
      countryIso3: iso3,
      isFollowed: watchSet.has(iso3.toUpperCase()),
      isPending: follows.pendingCountry === iso3,
      hasFailed: follows.failedCountry === iso3,
      onFollow: follows.follow,
      onUnfollow: follows.unfollow,
    };
  }, [follows, selectedCountry, watchSet]);

  const t = getDictionary(language).map;

  /*
    ══ THE MAP NO LONGER RETRIEVES AT ALL ═══════════════════════════════════

    `loadCountry` used to live here: it set the selected country AND called
    `GET /news/country/:iso3`, which executes GNews. Live acceptance caught it
    doing exactly that for KEN and RWA from an act the reader understood as
    navigation.

    It is DELETED rather than left dormant behind a stricter reason. A fetch
    path that nothing calls today is how this defect returns: the guard gets
    relaxed, or a new handler reaches for the convenient function already in
    the file. With the function gone, the Map has no way to execute a news
    provider, which is a stronger guarantee than a rule about who may.

    RETRIEVAL STILL EXISTS, on the surface that is about retrieval: Open
    Analysis carries the selection to /search, which retrieves under
    EXPLICIT_ANALYSIS_REQUEST. Deliberate country analysis is unaffected.

    RETAINED EVIDENCE IS UNAFFECTED TOO — `cache` is still seeded from
    `retainedCountryCorpora()`, so a country the reader has already analysed
    still shows its corpus the moment it is selected.
  */

  /*
    ══ THE MAP FEED, ON THE LIVE PATH ═══════════════════════════════════════

    G's `GET /geo/map-feed?q=…&country=…` — the R2 route, called with real
    headlines from the real country feed, resolving against the shipped
    gazetteer.

    ── WHY IT RUNS FROM AN EFFECT AND NOT FROM `loadCountry` ────────────────

    Because it needs the articles. The route resolves TEXT; until the country
    response has landed there is nothing to send it. Running it here also means
    a country restored from the URL, a country clicked on the map and a country
    chosen from search all enrich by the same path, rather than by whichever
    handler happened to remember to.

    ── WHAT IS SENT, AND WHAT IS DELIBERATELY NOT ──────────────────────────

    Sent: the article's own title, and the ISO-3 of the feed it came from as
    `country` context. G's DTO whitelists exactly those two.

    NOT SENT: the reader's query, the selected country when it differs from the
    article's feed, the publisher's country, or any retrieval context. Passing
    a country the ARTICLE did not come from would be manufacturing the very
    context the resolver is supposed to find, and it is the mechanism by which
    a map starts agreeing with whatever it was already showing.

    ── AND THE RESULT IS BOUNDED BY THE FEED IT CAME FROM ──────────────────

    `expectCountryIso3` below discards a resolution that lands outside the
    country whose feed produced the headline. See `mapFeedRecordsFrom`.
  */
  /*
    ══ H-1 · THE GLOBAL FEED, FETCHED ON ARRIVAL ════════════════════════════

    THE FIX FOR P6, AND IT IS THE ABSENCE OF A REQUEST RATHER THAN A BAD ONE.

    Measured on this tree before the change: a clean `/map` made ZERO evidence
    requests, because the evidence model's only feeder was
    `GET /news/country/:iso3` and that runs on selection. `GET /geo/map-feed`
    passing was unrelated — it resolves text, and there was no text.

    `GET /news/top-headlines` is the shipped route the homepage already uses,
    and every article it returns carries `countryCode`, `geographicPrecision`,
    `locationProvenance`, `sourceId`, `url`, `imageUrl`, `publishedAt` and
    `category` — each resolved by the backend, none by this route.

    Keyed on language only. NOT on selection, mode, period or camera: those
    choose which retained records QUALIFY, and re-fetching the world because a
    reader pressed 7d would be a second retrieval answering a question the
    first already answered.

    FAILS SOFT. A failed global feed leaves the map exactly as it was; the
    country path is untouched and still loads on selection, because a world
    view that could not load is no reason to withhold a country the reader
    explicitly asked for.

    ══ R5 · AND IT NOW READS A CORPUS IT CANNOT BUY ═════════════════════════

    **Product invariant: opening or navigating the Map must never execute
    GNews merely to obtain the global corpus.**

    WHAT R4 MEASURED. The effect above was keyed on language, so no navigation
    re-ran it — World to East Africa and back cost nothing, and still costs
    nothing. But EVERY MOUNT ran it: a cold open, a hard reload, a
    `LanguageSync` refresh. Each of those reached `fetchTopHeadlines`, whose
    route executes a provider on any cache miss, and the only thing standing
    between a visual-testing session and the quota was a 300-second window.
    The Product Owner's dashboard moved 22 → 25 with ZERO country retrievals,
    which is exactly what three cache-cold arrivals look like.

    `fetchRetainedTopHeadlines` reads the SAME `limit:language` corpus from the
    SAME backend cache through `GET /news/top-headlines/retained`, a route that
    cannot call a provider at all. So the frequency question disappears: this
    effect may now run on every mount forever at zero quota.

    AND IF NOTHING IS RETAINED, NOTHING IS BOUGHT. The response comes back
    `dataMode: 'unavailable'` with no articles, and the world view renders the
    honest empty state it already had for the failure case. There is no retry,
    no timer and no fallback to the executing route — a silent upgrade to a
    retrieving call is precisely the defect being closed.

    HOME IS UNCHANGED and still uses the executing route, which is what keeps
    this corpus warm for the map to find. That asymmetry is the whole design:
    one surface pays for the corpus deliberately, the other only ever reads it.
  */
  useEffect(() => {
    /*
      ── CHECKPOINT C · RETAINED FIRST, RETRIEVAL ONLY IF THERE IS NOTHING ───

      On Back this returns before touching the network. It also covers a
      LANGUAGE CHANGE back to a language already retained, which the mount-time
      initialiser above cannot: that runs once, for the language present at
      mount.
    */
    const feedKey = globalFeedKey(GLOBAL_FEED_LIMIT, language);
    const retained = retainedGlobalFeed(feedKey);

    if (retained !== null) {
      setGlobalFeed(retained);

      const retainedGeography = retainedGlobalGeography(feedKey);

      if (retainedGeography !== null) {
        setGlobalGeography(retainedGeography);
        globalEnrichmentDone.current = true;
      }

      return;
    }

    let cancelled = false;

    void fetchRetainedTopHeadlines(GLOBAL_FEED_LIMIT, language)
      .then((response) => {
        if (cancelled) return;

        setGlobalFeed(response);
        /* Refused if empty — see retainGlobalFeed. A bad moment is not evidence. */
        retainGlobalFeed(feedKey, response);
      })
      .catch(() => {
        /* Left null. The world view says what it can and claims nothing. */
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  /*
    ══ CHECKPOINT B-1 · ONE RESOLUTION PATH, SHARED BY BOTH ENRICHMENTS ══════

    THE DEFECT. Both enrichments below issued ONE HTTP REQUEST PER ARTICLE —
    capped at 24 (global) and 12 (per country). Measured in Alpha, one user
    action produced /geo/map-feed x3, x4, x7 and x8.

    None of it spent provider quota: the backend resolver is synchronous and
    touches no provider, database or network. The cost was N round-trips and N
    rate-limit slots for one action.

    TWO SEPARATE REDUNDANCIES, AND THEY NEED DIFFERENT ANSWERS:

      the FAN-OUT   removed by batching. N inputs go in one request, so the
                    requests stop existing rather than stop being visible.
      the OVERLAP   the global feed resolves a country's headlines with that
                    country as context, and selecting the country then resolves
                    largely the SAME articles. The memo below is what stops the
                    second path re-asking, and it is a DEDUPLICATION on top of
                    the batch, never a substitute for it.

    A FAILURE IS NEVER MEMOISED. `fetchMapFeedBatch` fails soft and yields null
    for a chunk it could not resolve; writing that null into the memo would make
    a transient outage permanent for those articles, because nothing would ever
    ask again. Only real resolutions are remembered, so a later render retries
    exactly the ones that did not land.
  */
  /*
    CHECKPOINT C — module-scope, so the resolution memo survives the unmount
    that opening Analysis causes. A per-mount resolver lost its memo exactly
    when returning to the map needed it most.
  */
  const resolveGeographies = sharedGeographyResolver;

  /*
    The global headlines go through the SAME resolver, the SAME article gate and
    the SAME join guard as the per-country path. The only difference is where
    the text came from: each headline is resolved with its OWN country as
    context and as the expectation, so the global feed cannot place a record in
    a country its article did not name.
  */
  useEffect(() => {
    if (globalFeed === null || globalEnrichmentDone.current) return;

    globalEnrichmentDone.current = true;

    let cancelled = false;

    const candidates = placeableArticles(globalFeed.articles).slice(0, GLOBAL_FEED_ENRICH_CAP);

    /*
      B-1: up to 24 resolutions, in ONE request. The cap is unchanged and still
      bounds how much is asked for; what changed is that asking no longer costs
      one round-trip per article.
    */
    void resolveGeographies(
      candidates.map(({ article, iso3 }) => ({
        text: article.title,
        mode: 'article' as const,
        contextCountryIso3: iso3,
      })),
    )
      .then((byKey) => {
        /*
          Association is by the REQUEST KEY, not by array position, so a
          deduplicated or reordered response cannot attribute one article's
          geography to another.
        */
        const entries = candidates.map(({ article, iso3 }) => {
          const feed =
            byKey.get(
              mapFeedRequestKey({
                text: article.title,
                mode: 'article',
                contextCountryIso3: iso3,
              }),
            ) ?? null;

          return feed === null
            ? null
            : {
                recordId: article.id,
                feed,
                observedAt: article.publishedAt,
                headline: article.title,
                sourceCount: article.sourcesCount > 0 ? article.sourcesCount : 1,
                /* CHECKPOINT H — the real outlet identity, for distinct-publisher counting. */
                publisherId: article.sourceId,
                category: article.category,
                countryIso3: iso3,
              };
        });

        return entries;
      })
      .then((entries) => {
        if (cancelled) return;

        const resolved = entries.filter(
          (entry): entry is ResolvedArticleGeography => entry !== null,
        );

        setGlobalGeography(resolved);
        retainGlobalGeography(globalFeedKey(GLOBAL_FEED_LIMIT, language), resolved);
      })
      .catch(() => {
        globalEnrichmentDone.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [globalFeed, resolveGeographies]);

  const enrichmentInFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    for (const [key, response] of Object.entries(cache)) {
      const [iso3, cachedCategory, cachedLanguage] = key.split(':');

      /*
        The unfiltered, current-language feed only. Geography does not change
        with a category filter, so resolving the same headlines again under
        'politics' would be the same requests for the same answers.
      */
      if (cachedCategory !== 'all' || cachedLanguage !== language) continue;
      if (geography[iso3] !== undefined) continue;
      if (enrichmentInFlight.current.has(iso3)) continue;
      if (response.articles.length === 0) continue;

      enrichmentInFlight.current.add(iso3);

      const articles = response.articles.slice(0, MAP_FEED_ARTICLE_CAP);

      /*
        ARTICLE MODE — the gate for evidence text, routed by G's C-N correction
        and present in this tree's own controller. A headline is prose, not a
        question, and the query gate refuses most of it.

        B-1: up to 12 resolutions in ONE request, and any headline the global
        feed already resolved with this same country context is served from the
        shared memo without reaching the network at all.
      */
      void resolveGeographies(
        articles.map((article) => ({
          text: article.title,
          mode: 'article' as const,
          contextCountryIso3: iso3,
        })),
      )
        .then((byKey) =>
          articles.map((article) => {
            const feed =
              byKey.get(
                mapFeedRequestKey({
                  text: article.title,
                  mode: 'article',
                  contextCountryIso3: iso3,
                }),
              ) ?? null;

            return feed === null
              ? null
              : {
                  recordId: article.id,
                  feed,
                  observedAt: article.publishedAt,
                  headline: article.title,
                  sourceCount: article.sourcesCount > 0 ? article.sourcesCount : 1,
                /* CHECKPOINT H — the real outlet identity, for distinct-publisher counting. */
                publisherId: article.sourceId,
                  category: article.category,
                  countryIso3: iso3,
                };
          }),
        )
        .then((entries) => {
          enrichmentInFlight.current.delete(iso3);

          if (cancelled) return;

          const resolved = entries.filter(
            (entry): entry is ResolvedArticleGeography => entry !== null,
          );

          /*
            An empty list is WRITTEN, not skipped. It records that this country
            was enriched and nothing finer than country level came back — which
            is a different state from "not asked yet", and is what stops the
            effect asking again on every render.
          */
          setGeography((current) =>
            current[iso3] === undefined ? { ...current, [iso3]: resolved } : current,
          );
          retainCountryGeography(iso3, resolved);
        })
        .catch(() => {
          /*
            `fetchMapFeedBatch` already fails soft per chunk, so reaching here means
            something structural. The country map is unaffected; the flag is
            cleared so a later render may retry.
          */
          enrichmentInFlight.current.delete(iso3);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [cache, geography, globalFeed, globalGeography, language, resolveGeographies]);

  /*
    The URL follows the selection. Written from an effect rather than from
    each handler so there is ONE writer and the restored-on-mount case
    cannot fight the click case.
  */
  /*
    READ ONCE, FROM THE ADDRESS BAR ITSELF.

    `useSearchParams()` is empty on the first client render unless the
    route is wrapped in Suspense, and a `useState` initialiser runs
    exactly once — so reading the params that way captured `null` and the
    restore silently never happened, which is what the live probe caught.
    `window.location.search` is available the moment this effect runs and
    has no such timing.
  */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const iso3 = params.get('country');
    const restoredCategory = readCategoryParam(params.get('category'));
    const country = iso3 === null ? null : (COUNTRIES.find((c) => c.iso3 === iso3) ?? null);
    if (country) {
      setSelectedCountry(country);
      setCategory(restoredCategory);
      /*
        SPATIAL M2 — `?country=` SEEDS THE SPATIAL SELECTION TOO.

        The browser run caught this: restoring `?country=POL` opened the
        country panel but left the intelligence rail on its no-selection state,
        so the map showed a selected country with no card describing it. The
        two are one fact seen from two layers — see `handleSpatialSelection` —
        and the restore path was setting only one of them.

        `sel=` still wins when present, because it is the more specific
        statement and may name a non-country selection.
      */
      setSpatialSelection((current) => current ?? { kind: 'COUNTRY', id: country.iso3 });

      /*
        ══ HYDRATION RESTORES. IT DOES NOT RETRIEVE. ═══════════════════════

        THIS LINE WAS THE QUOTA LEAK. It read `?country=` and called
        `loadCountry` unconditionally, so every load, reload, restore and
        shared link spent provider quota for whatever ISO-3 happened to be in
        the address bar — with no user in the loop at all.

        That is what made a single wrong frame permanent. A camera-derived
        country reached `selectedCountry`, the URL writer persisted it, and
        from then on the mistake re-spent quota on every visit. It is also
        exactly why three of the four measured retrievals were countries the
        reader never selected.

        WHAT REPLACES IT IS NOT "NOTHING". The retained corpus is already
        seeded into `cache` at mount, so a country whose evidence is still
        within the 300s TTL renders immediately — a shared link keeps working,
        warm Home->Map reuse is untouched, and none of it costs a request.

        What a cold link no longer does is silently buy fresh evidence. The
        reader selects the country to ask for that, which is the deliberate act
        the authority contract requires.
      */
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
    Then the URL follows the selection. One writer, and never before the read.

    SPATIAL M1a — THE CAMERA JOINS THIS WRITER RATHER THAN ADDING A SECOND ONE.

    My first cut gave the camera its own `router.replace`, and
    `c2RuntimeDefects.spec.ts` correctly failed it: "there is exactly ONE
    writer of the URL, so restore cannot fight a click". That invariant is not
    a formality — two writers racing is precisely the H-C2 defect this effect
    was written to fix, and a camera settling mid-restore could erase a
    selection the same way. So the camera is state, and this one effect
    serialises everything.

    `searchParamsWithCamera` appends the camera to the params built here, and
    removes the key entirely at the world view — so a link to the default map
    stays exactly as clean as it was before M1a.
  */
  /*
    SPATIAL M2 — MODE, PERIOD AND SELECTION JOIN THIS WRITER TOO.

    Design Part II §3 requires all four in the URL. They are COMPOSED onto the
    params this one effect already builds, exactly as the camera was at M1a,
    rather than each acquiring a `router.replace` of its own.

    That is not tidiness. `c2RuntimeDefects.spec.ts` pins "there is exactly ONE
    writer of the URL, so restore cannot fight a click", and it pins it because
    two writers racing IS the original H-C2 defect: a mode settling mid-restore
    could erase a selection the same way a camera could. One effect serialises
    everything, and adding a parameter never adds a writer.
  */
  useEffect(() => {
    if (!restored) return;
    const params = new URLSearchParams();

    /*
      ══ MAP-EAST-AFRICA-REGION-COLLAPSE-1 · SEMANTIC SELECTION DECIDES ════

      `country=` used to be written from `selectedCountry` ALONE, so the two
      layers could disagree in the address bar:
      `?country=CAN&sel=region:eastern-africa` — the panel describing Canada,
      the rail describing Eastern Africa, and a shared link restoring both.

      The semantic selection is now the authority: the country parameter is
      written ONLY when the selection IS that country. A REGION selection
      therefore cannot leave a country in the URL, which is what stopped the
      East Africa collapse from being persisted — and, with hydration no longer
      retrieving, from being re-spent.

      THE CAMERA IS UNTOUCHED BY THIS. It keeps its own parameters below and
      describes the viewport, which is the separation the ruling requires:
      camera-centre lookup may DESCRIBE what is on screen, and may never
      REWRITE what the reader selected.
    */
    const countryParam = countryParamFor(spatialSelection, selectedCountry?.iso3 ?? null);

    if (countryParam !== null) params.set('country', countryParam);
    if (category !== 'all') params.set('category', category);
    const withMapState = searchParamsWithMapState(params, {
      mode,
      period,
      selection: spatialSelection,
    });
    const query = searchParamsWithCamera(withMapState, camera).toString();
    router.replace(query.length > 0 ? `/map?${query}` : '/map', { scroll: false });
  }, [restored, selectedCountry, category, camera, mode, period, spatialSelection, router]);

  /*
    ══ SELECTION ESTABLISHES SCOPE. IT DOES NOT RETRIEVE. ═══════════════════

    THE BOUNDARY THE CTO MOVED. Live acceptance showed `GET /news/country/KEN`
    and `/RWA` executing GNews from an act the reader understood as choosing a
    place on a map. The old authority permitted it; the product's explicit-cost
    direction does not.

    So this is the whole of what selecting a country now does:

      · sets the semantic COUNTRY scope (which the single URL writer persists)
      · clears the previous error
      · shows the RETAINED corpus for that country if one is already held

    No fetch. No provider. `/geo/map-feed` enrichment is unaffected — it runs
    from its own effect over articles that are already present, and it is not a
    news provider.

    WHAT DID NOT HAPPEN HERE: the ability to analyse a country deliberately was
    not removed. It moved behind the reader's own request — Open Analysis
    carries the selection to the research surface, which retrieves under
    EXPLICIT_ANALYSIS_REQUEST.
  */
  const selectCountryScope = useCallback(
    (country: CountryMeta): void => {
      setSelectedCountry(country);
      setError(null);
    },
    [],
  );

  function handleSelectFromSearch(country: CountryMeta): void {
    setCategory('all');
    /* The reader committed a COUNTRY result from place search. Scope only. */
    selectCountryScope(country);
  }

  function handleSelectFromMap(feature: CountryFeature): void {
    const country = feature.properties.country;
    if (!country) return; // geometry feature we don't have metadata for yet
    setCategory('all');
    setSpatialSelection({ kind: 'COUNTRY', id: country.iso3 });
    /* The reader clicked the country's own fill. Scope only — no provider. */
    selectCountryScope(country);
  }

  /*
    ONE SELECTION MODEL, NOT TWO.

    The spatial selection and the route's `selectedCountry` are the same fact
    seen from two layers, so selecting from the rail, the search box or the
    context panel resolves to a country and goes down the SAME path a map click
    takes — including the retrieval it triggers. Letting the shell hold a
    second, parallel selection is how a card ends up describing a country the
    panel beneath it is not showing.
  */
  function handleSpatialSelection(selection: MapSelection | null): void {
    setSpatialSelection(selection);
    /*
      ── CARD FILTERS ARE SELECTION-SCOPED, AND THIS IS WHERE THAT IS TRUE ───

      Part II §3: "cleared when `selected` changes". Cleared HERE, in the single
      handler every selection path goes through — map click, search result,
      rail jump and URL restore alike — rather than in an effect watching the
      selection, which would clear them one render late and briefly show
      Poland's list filtered by Rwanda's categories.
    */
    setCardFilters(EMPTY_CATEGORY_FILTERS);
    setSelectedItemId(null);

    if (selection === null) {
      setSelectedCountry(null);

      return;
    }

    /*
      ── RSC-1 STEP 1 — A REGION CLEARS THE COUNTRY, IT DOES NOT KEEP IT ──────

      MEASURED before this branch existed, and it is the M16 defect returning by
      a new route: committing a region set `spatialSelection` to the region and
      then fell through to `COUNTRIES.find('region:eastern-africa')`, which is
      null, which RETURNED EARLY — leaving `selectedCountry` untouched. The URL
      writer below then produced `?country=CAN&sel=region:eastern-africa`: the
      panel describing Canada, the rail describing Eastern Africa, and a shared
      link that restores both.

      M16 fixed exactly this by CLEARING, in the era when a region selected
      nothing. Now that a region selects something, the clearing has to be
      explicit rather than a side effect of `selection === null`.
    */
    if (selection.kind === 'REGION') {
      setSelectedCountry(null);

      return;
    }

    const country = COUNTRIES.find((candidate) => candidate.iso3 === selection.id) ?? null;

    if (country === null) return;

    setCategory('all');
    /*
      Reached ONLY from the COUNTRY branch of the single selection funnel; the
      REGION branch above has already returned, and a selection whose id is not
      a known country returned before this line.
    */
    selectCountryScope(country);
  }

  /*
    A CATEGORY FILTER NARROWS WHAT IS HELD; IT DOES NOT GO AND GET MORE.

    It used to retrieve under CATEGORY_CHANGE_ON_SELECTED_COUNTRY, which meant
    moving a filter could spend provider quota. With selection no longer
    retrieving there is nothing to "re-fetch" either: the filter now applies to
    the retained corpus, and an empty result is an honest empty rather than a
    reason to buy more.
  */
  function handleCategoryChange(value: CategoryFilterValue): void {
    setCategory(value);
  }

  const activeResponse = selectedCountry ? cache[cacheKey(selectedCountry.iso3, category, language)] : null;

  // Countries we know have stories, across any category we've fetched —
  // used only to lightly emphasize already-explored countries on the
  // map. This never triggers new requests; it just reflects what's
  // already been loaded client-side.
  const countryStoryCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};

    for (const [key, response] of Object.entries(cache)) {
      const [iso3, cachedCategory, cachedLanguage] = key.split(':');

      // Use only the unfiltered "all" response, and only for the
      // currently active language — a count loaded under a different
      // language reflects a different, potentially not-yet-fetched
      // set of results for the language currently being viewed.
      if (cachedCategory !== 'all' || cachedLanguage !== language) continue;

      counts[iso3] = response.totalResults;
    }

    return counts;
  }, [cache, language]);

  /*
    ══ DESIGN REVISION 1.2 · THE SELECTED-COUNTRY BLOCKS ════════════════════

    Blocks 01, 02, 05, 06, 09 and 10, derived from the country feed this route
    already holds. `selectionIntelligence.ts` owns every derivation; this memo
    only assembles them and wires the handlers.

    `undefined` WHEN THERE IS NOTHING TO SHOW, because Design's rule is that a
    block with no data is OMITTED rather than rendered empty — and the way a
    caller says "omit" to the card is to pass nothing.

    UNFILTERED, ALL-CATEGORY RESPONSE ONLY. The blocks describe the country's
    retained set; deriving them from a category-filtered response would make
    the category BARS depend on the category filter, so selecting one would
    delete the others from the very control used to select them.
  */
  /*
    ══ THE SELECTED-GEOGRAPHY ACTION CLUSTER ════════════════════════════════

    CTO correction, 2026-09-01: "the popup must expose the full selected-
    geography action cluster, not a reduced subset."

    THE DEFECT WAS HERE, not in either card. `GlobalMapShell` renders its
    Analysis and Sources buttons only when a handler exists, and this route
    never supplied one — so BOTH surfaces silently dropped two of the four
    actions, and the callout, which has fewer of them, made it visible. The
    conditional rendering was doing exactly what it was written to do; there
    was nothing for it to render.

    Both handlers are real navigations, not stubs:

      ANALYSIS  the accepted `/search?q=<canonical English name>` navigation
                the country panel's own button already performs. The canonical
                name, not the localised one — this is a query string, not a
                display string, which is the rule that route has always used.
      SOURCES   the retained reporting for this selection, which is block 09 of
                the rail. Revealed rather than re-fetched: the source cards are
                already rendered, and a second surface listing the same items
                would be a second thing to keep in step with the first.
  */
  const handleOpenAnalysis = useCallback(() => {
    if (selectedCountry === null) return;

    const params = new URLSearchParams({ q: selectedCountry.name });

    params.set('countryCode', selectedCountry.iso2);
    router.push(`/search?${params.toString()}`);
  }, [router, selectedCountry]);

  const handleOpenSources = useCallback(() => {
    /*
      The rail owns the scroll, so this reaches for the block rather than
      lifting a scroll position into React state that would then have to be
      kept correct across every selection change. `smooth` respects the
      reader's reduced-motion setting through the browser itself.
    */
    const block = document.querySelector('[data-gn="card-retained"]');

    if (block instanceof HTMLElement) {
      block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const selectionDetail = useMemo<SelectionDetail | undefined>(() => {
    if (selectedCountry === null) return undefined;

    const response = cache[cacheKey(selectedCountry.iso3, 'all', language)];

    const identity = {
      iso3: selectedCountry.iso3,
      /*
        THE COUNTRY'S GEOGRAPHIC GROUPING — Part I §E block 01 is explicit that
        this is "NOT a REGION-precision record". It comes from the country
        registry, never from the precision model, and there is no path by which
        a precision value could reach this field.
      */
      region: selectedCountry.region,
    };

    if (response === undefined) return { identity };

    const items = retainedItemsFrom(response.articles);
    const categories = categoryDistribution(response.articles);
    const topics = retainedTopics(response.articles);

    return {
      identity,
      providerStatus: providerStatusFrom(response),
      coverage: coverageStateFrom(response, period, Date.now(), language),
      ...(categories.length > 0 ? { categories } : {}),
      cardFilters,
      onToggleCategory: (categoryId: NewsCategory) =>
        setCardFilters((current) => {
          const next = new Set(current);

          /* MULTI-SELECT, and "All clears" is the separate control below. */
          if (next.has(categoryId)) next.delete(categoryId);
          else next.add(categoryId);

          return next;
        }),
      onClearCategories: () => setCardFilters(EMPTY_CATEGORY_FILTERS),
      ...(items.length > 0 ? { items } : {}),
      selectedItemId,
      onSelectItem: setSelectedItemId,
      /*
        THE ACCEPTED Map -> Story -> Q&A NAVIGATION, unchanged. Milestone #51
        Phase B, with the CTO's correction: `articleId` and `countryCode` travel
        with the query so the backend resolves THIS article as a trusted
        evidence anchor rather than re-detecting a country from a headline.
      */
      onAskAbout: (id: string) => {
        const article = response.articles.find((candidate) => candidate.id === id);

        if (article === undefined) return;

        const params = new URLSearchParams({ q: article.title, articleId: article.id });

        params.set('countryCode', selectedCountry.iso2);
        router.push(`/search?${params.toString()}`);
      },
      ...(topics.length > 0 ? { topics } : {}),
    };
  }, [cache, cardFilters, language, period, router, selectedCountry, selectedItemId]);

  const hoveredKnownCount = hovered?.country ? countryStoryCounts[hovered.country.iso3] ?? null : null;

  /*
    ── THE REAL EVIDENCE FEED THE SPATIAL MAP DRAWS ─────────────────────────

    Built from the SAME live `/news/country/:iso3` responses this route has
    always fetched. Nothing new is requested of the backend and no second cache
    exists: `cache` already holds real `NewsArticle[]`, and every article
    carries `geographicPrecision` and `locationProvenance` — the two axes, on
    the wire, today. M2 stops discarding them.

    ONE RECORD PER ARTICLE, at the article's own precision, so a country holding
    a STATED country-level article and an INTERPRETED city-level article shows
    two claims rather than one averaged row.

    Keyed on the ISO code the request was made with, never on resolving a
    country NAME out of text — which is why this path is unaffected by the
    resolver finding reported to G alongside this package.
  */
  const evidenceSet = useMemo(() => {
    const sets = Object.entries(cache)
      .filter(([key]) => {
        const [, cachedCategory, cachedLanguage] = key.split(':');

        return cachedCategory === 'all' && cachedLanguage === language;
      })
      .map(([, response]) =>
        countryEvidenceSet(response, localisedCountryName(response.countryCode, response.countryName, language)),
      );

    /*
      G's MAP FEED BECOMES ITS OWN RECORDS, at the level G actually asserted —
      CITY with a real GeoNames settlement coordinate, PROVINCE with an ISO
      3166-2 code, COUNTRY with neither. `mapFeedRecordsFrom` is the production
      path and it declines a CONTESTED projection outright, because the resolver
      deliberately refused to choose and picking for it here would undo that
      refusal.

      `expectCountryIso3` is the country whose feed produced the headline, so a
      resolution that lands in a different country contributes nothing rather
      than putting a marker somewhere no article claimed.
    */
    const resolvedFromFeed = (entry: ResolvedArticleGeography) =>
      mapFeedRecordsFrom({
        id: entry.recordId,
        feed: entry.feed,
        lastObservedAt: entry.observedAt,
        sourceCount: entry.sourceCount,
        publisherId: entry.publisherId,
        headline: entry.headline,
        topics: [entry.category],
        expectCountryIso3: entry.countryIso3,
      });

    const geoRecords = [
      ...Object.values(geography).flat().flatMap(resolvedFromFeed),
      /* H-1 — the world view's own resolved cities, under the same rules. */
      ...globalGeography.flatMap(resolvedFromFeed),
    ];

    /*
      H-1 — the global feed joins the same merge, FIRST, so a country the reader
      actually opened wins on display name. Records are keyed by ISO-3, so a
      country present in both contributes both: the global feed's article and
      the country feed's article are two reports, not one counted twice.

      Articles with no `countryCode` produce nothing. See `globalEvidenceFeed`.
    */
    const globalSet =
      globalFeed === null
        ? null
        : globalEvidenceSet(globalFeed, {
            displayNameFor: (iso3, fallback) => localisedCountryName(iso3, fallback, language),
            language,
          });

    const merged = mergeEvidenceSets(globalSet === null ? sets : [globalSet, ...sets]);

    return geoRecords.length === 0
      ? merged
      : {
          ...merged,
          records: [...merged.records, ...geoRecords],
          loadedAt:
            Date.parse(merged.loadedAt) > 0 ? merged.loadedAt : new Date().toISOString(),
        };
    /*
      `globalFeed` and `globalGeography` ARE dependencies. Omitting them was a
      real defect during this repair: the memo closed over both, so the code
      read correctly, but it never recomputed when the global feed arrived and
      the world view stayed empty while the requests visibly succeeded.
    */
  }, [cache, geography, globalFeed, globalGeography, language]);

  /*
    ── "LOOKED AT, NOTHING RETAINED" — SUPPLIED, NEVER INFERRED ─────────────

    The countries this session actually QUERIED that came back with no
    articles. Derived from the cache keys, which record what was asked, so the
    context panel can say what was looked at and found empty — as opposed to
    the entire rest of the world, which was not looked at and about which the
    panel says nothing.
  */
  const noEvidenceGeography = useMemo<readonly EvidenceGeography[]>(() => {
    const out: EvidenceGeography[] = [];

    for (const [key, response] of Object.entries(cache)) {
      const [iso3, cachedCategory, cachedLanguage] = key.split(':');

      if (cachedCategory !== 'all' || cachedLanguage !== language) continue;
      if (response.articles.length > 0) continue;

      out.push({
        id: iso3,
        countryIso3: iso3,
        displayName: localisedCountryName(iso3, response.countryName, language),
      });
    }

    return out;
  }, [cache, language]);

  /*
    ══ DESIGN REVISION 1.2 · BLOCK 06 NARROWS THE MARKERS TOO ═══════════════

    "Activating one narrows blocks 07-09 AND THE MAP'S EVIDENCE MARKERS FOR
    THIS SELECTION ONLY."

    Three properties of this memo carry the whole rule:

      IT IS DOWNSTREAM.  `evidenceSet` is memoised above and does not depend on
                         `cardFilters`. This derives a narrowed VIEW from it, so
                         Part II §3's "never alters the evidence set the surface
                         was given" is structural rather than promised — the set
                         above is unchanged and still available.

      IT TOUCHES ONE     Only records inside the selected country are eligible
      COUNTRY.           for removal. A filter on Rwanda's card must not empty
                         Kenya's markers, which is exactly what a global mode
                         would do and precisely what §3 says this is not.

      AN EMPTY SET       No filters means every record, matching "All clears".
      MEANS ALL.
  */
  const narrowedEvidenceSet = useMemo(() => {
    if (cardFilters.size === 0 || selectedCountry === null) return evidenceSet;

    const iso3 = selectedCountry.iso3;

    return {
      ...evidenceSet,
      records: evidenceSet.records.filter((record) => {
        if (record.geography.countryIso3 !== iso3) return true;

        /*
          A record with no category is KEPT. Absent is not "uncategorised" — it
          is unknown, and hiding a record because nobody labelled it would let a
          filter delete evidence on the strength of missing metadata.
        */
        return (
          record.topics === undefined ||
          record.topics.length === 0 ||
          record.topics.some((topic) => cardFilters.has(topic as NewsCategory))
        );
      }),
    };
  }, [cardFilters, evidenceSet, selectedCountry]);


  /*
    ══ SPATIAL M2 OWNS THE VIEWPORT ══════════════════════════════════════════

    A SEPARATE TREE, NOT A WIDER VERSION OF THE OLD ONE.

    The legacy page is `mx-auto max-w-7xl px-4 py-12` wrapping a heading block,
    a search row and a three-column grid whose map cell is a 480 px card. Every
    one of those is page furniture from a surface that predates the Spatial
    system, and the CTO's ruling is that none of it may determine the Spatial
    map's width, height, rail widths, HUD placement or responsive geometry.

    Widening that container would have left the same hierarchy in place. So the
    shell branch returns its own tree: no max-width, no page padding, no
    heading block above the map, no card framing, and no grid column deciding
    how much room the workspace gets. The workspace is the page.

    WHAT IT FILLS. `100dvh` minus the NavBar, in DYNAMIC viewport units per Part
    II §5's cross-cutting rule, so mobile browser chrome cannot clip it. The
    footer that follows sits below the fold rather than eating visible height —
    reachable by scrolling, consuming nothing.

    WHAT MOVED RATHER THAN DISAPPEARED. The accepted country panel — articles,
    imagery, Follow/Watch, Open Analysis — is now hosted INSIDE the
    intelligence rail as `railDetail`, unmodified and still owned by this
    route. Part II §5 puts the rail in the same viewport as the map, so that is
    where the detail surface belongs; it did not need a page column beside the
    workspace, and having one is what made the map a card.

    THE LEGACY BRANCH BELOW IS UNTOUCHED. Its container, heading, grid, sticky
    480 px box, coverage legend and mobile fallback are exactly as accepted.
    Rollback stays "flip the flag".
  */
  if (mapVariant === 'shell') {
    return (
      <>
        {/*
          R5 — EXACTLY ONE COMPOSITION IS MOUNTED. `spatialWide` is null until
          the viewport is known, true at/above C55's 861 px boundary and false
          below it. Each branch is a MOUNT, not a CSS state, so the inactive
          composition carries no MapLibre canvas, no search input and no state.
        */}
        {spatialWide === null && (
          <div data-gn="spatial-workspace-pending" className="h-dvh w-full bg-sp-bg" />
        )}

        {spatialWide === true && (
        <div
          data-gn="spatial-workspace"
          /*
            `h-dvh` — THE WHOLE VIEWPORT, not the viewport minus a NavBar.

            It was `calc(100dvh - 4rem)` while the product bar sat above this
            workspace. The CTO's ruling of 2026-09-01 removed that bar at this
            breakpoint, so subtracting its height would now leave a 64 px band
            of nothing at the bottom of the screen — the geometry the ruling
            exists to reclaim, kept by arithmetic instead of by markup.

            DYNAMIC viewport units, per Part II §5's cross-cutting rule, so
            mobile browser chrome cannot clip the workspace.

            `overflow-hidden` so the workspace never scrolls itself; the map
            pans, the rails scroll internally, and the page does not move under
            them. No horizontal padding at all: Part II §5's "minimal unused
            outer margins", and the rails are meant to sit against the edges.
          */
          className="h-dvh w-full overflow-hidden"
          aria-describedby="map-a11y-note"
        >
          <GlobalMapShell
            language={language}
            initialCamera={initialCamera}
            initialCameraRestored={initialCameraRestored}
            onCameraChange={handleCameraChange}
            /*
              FULL — Part II §1 calls this surface "the reference
              implementation ... Intentionally absent: NOTHING". The shell
              derives the entire HUD from it; this route passes no control
              flags, because there are none to pass.
            */
            surfaceDensity="FULL"
            mode={mode}
            onModeChange={setMode}
            period={period}
            onPeriodChange={setPeriod}
            selection={spatialSelection}
            onSelectionChange={handleSpatialSelection}
            onOpenAnalysis={handleOpenAnalysis}
            onOpenSources={handleOpenSources}
            evidenceSet={narrowedEvidenceSet}
            noEvidenceGeography={noEvidenceGeography}
            watch={watchSet}
            follow={selectionFollow}
            countryStoryCounts={countryStoryCounts}
            selectedIso3={selectedCountry?.iso3 ?? null}
            onHoverCountry={setHovered}
            onSelectCountry={handleSelectFromMap}
            /*
              ── SUPERSEDED BY DESIGN REVISION 1.2 ──────────────────────────

              `railDetail` used to host the accepted `CountryPanel` beneath the
              card, because the card had no blocks for articles, imagery,
              provider state or category filtering and the panel did.

              Revision 1.2 specifies those blocks. The card now carries all of
              them — 02 provider status, 05 coverage and freshness, 06 category
              filters, 09 source cards with thumbnail, publisher, time and a
              named source affordance, 10 topics — so hosting the panel as well
              would put two of every control in one rail, disagreeing with each
              other after the first click.

              THE PANEL IS NOT DELETED. It is still the accepted surface at
              flag-off and below 1024 px, both of which render it unchanged
              further down this file. What ended is its residency in the FULL
              Spatial rail, which is a Design decision and now a Design ruling.
            */
            selectionDetail={selectionDetail}
          />

          {hovered && (
            <MapTooltip hovered={hovered} knownStoryCount={hoveredKnownCount} language={language} />
          )}
        </div>
        )}

        {/*
          THIS NOTE IS NOW DESKTOP-ONLY, AND THE REASON IS ACCURACY.

          It reads "An interactive world map is shown below ON LARGER SCREENS."
          That was true while the phone had no map. It is not true now, and it
          would be read out to exactly the users least able to check it, so
          below the Spatial boundary the mobile shell states its own note
          instead. The string, the id and the desktop rendering are untouched:
          at >= 861 px this is byte-for-byte what it was, and it is still the
          target of the canvas's `aria-describedby`.
        */}
        {spatialWide === true && (
          <p className="sr-only" id="map-a11y-note">
            {t.mapA11yNote}
          </p>
        )}

        {/*
          ── MOBILE SPATIAL MVP · BELOW THE 861 px SPATIAL BOUNDARY ─────────

          What used to run here was the accepted non-map fallback: a search
          box, a country panel, and a sentence saying "the interactive map is
          available on larger screens". That sentence is now false, and the
          fallback is replaced by a real touch-first Spatial composition.

          IT IS A DIFFERENT COMPOSITION, NOT A SMALLER ONE. `MobileSpatialShell`
          shares this route's contracts — the same evidence set, the same
          selection, the same camera reducer, the same search, the same story
          cards — and none of the desktop shell's geometry. Nothing above this
          block changed, so desktop Spatial is untouched by definition: the two
          are separate subtrees behind the same `spatial:` breakpoint that P25
          already established.

          The legacy CountryPanel path is NOT deleted. It is still what the
          flag-off rollback renders, further down this file.
        */}
        {spatialWide === false && (
        <div>
          <p className="sr-only">{t.spatial.mobile.a11yNote}</p>
          <MobileSpatialShell
            language={language}
            initialCamera={initialCamera}
            initialCameraRestored={initialCameraRestored}
            onCameraChange={handleCameraChange}
            selection={spatialSelection}
            onSelectionChange={handleSpatialSelection}
            onSelectCountry={handleSelectFromMap}
            onOpenAnalysis={handleOpenAnalysis}
            onOpenSources={handleOpenSources}
            evidenceSet={narrowedEvidenceSet}
            selectedIso3={selectedCountry?.iso3 ?? null}
            displayName={selectedCountry ? localisedCountryName(selectedCountry.iso3, selectedCountry.name, language) : null}
            follow={selectionFollow ?? undefined}
            selectionDetail={selectionDetail}
            countryStoryCounts={countryStoryCounts}
          />
        </div>
        )}

        {/*
          R5 — THE LEGACY NON-MAP BLOCK IS NOT RENDERED IN THE SPATIAL BRANCH.

          It rendered `t.headline` ("World News Map") and a `CountrySearchBox`
          whose input id is `country-search-input`. Both are LEGACY controls, and
          H measured both in the DOM with the flag ON: a second heading below the
          fold and a second country-search input shadowing the real one. The
          acceptance contract names each of them explicitly as forbidden while
          Spatial is selected.

          IT IS NOT DELETED — it is untouched in the legacy branch further down,
          which is exactly what the flag-off rollback renders.

          ACCESSIBILITY CONSEQUENCE, RECORDED AND NOT DECIDED HERE. Design's rule
          is that the map is never the only way to reach a country. Both Spatial
          compositions carry their own place search, so a non-map path to a
          country still exists on this route — but it is the Spatial one, not this
          sr-only legacy duplicate. If Design requires a separate assistive path
          in the Spatial composition, that belongs to the Spatial surface and is
          flagged for ruling rather than reinstated here as a duplicate control.
        */}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mb-8 max-w-2xl">
        <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">{t.exploreLabel}</span>
        <h1 className="mt-2 font-display text-2xl font-medium text-ink-primary sm:text-3xl">{t.headline}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{t.intro}</p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CountrySearchBox onSelectCountry={handleSelectFromSearch} language={language} />
        <p className="sr-only" id="map-a11y-note">
          {t.mapA11yNote}
        </p>
      </div>

      {/*
        Milestone #50 Phase E (sticky World Map — corrected) — root
        cause of the M50 v2 failure, confirmed by tracing the actual
        containing-block relationship: the PREVIOUS structure applied
        `lg:sticky` to the SAME element that both (a) had the fixed
        `h-[480px]` height and (b) was a direct grid item under
        `lg:items-start`. `items-start` collapses a grid item's height
        to exactly its own content's height — but that content WAS the
        sticky element, so its containing block (the grid cell) was
        exactly 480px tall too. Sticky positioning needs its
        containing block to be TALLER than the sticky element itself —
        that's the "extra scroll room" the browser holds the element
        within. With container height == element height, there is no
        room to stick at all, and the element behaves as ordinary
        `position: relative`, scrolling away with the page — exactly
        the reported symptom.

        Fix: `lg:items-start` is REMOVED from this grid entirely, so
        the left column reverts to CSS Grid's default
        `align-items: stretch` and grows to match the (taller) right
        column's natural height. The actual `lg:sticky` wrapper is now
        a SEPARATE, INNER element nested inside that tall cell — its
        own content is still only ~480px+legend tall, but its
        containing block (the now-tall outer cell) is taller, giving
        it genuine room to stick within. The sticky unit chosen is
        "map + coverage legend" (not the map alone): both are compact,
        directly related visual context, and observed by the CTO
        moving together — separating them would serve no purpose.
        Because sticking is bounded by the outer cell (which ends
        where the two-column section ends, not the whole page), the
        map naturally releases before the Footer below — Footer is a
        separate sibling in page.tsx, entirely outside this grid.
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Outer cell: no fixed height of its own, stretches to match
            the right column via Grid's default align-items: stretch —
            this is what gives the inner sticky wrapper room to work. */}
        <div className="hidden lg:col-span-2 lg:block" aria-describedby="map-a11y-note">
          {/* Inner sticky wrapper: shorter than its (now-tall) parent.
              top-20 clears the sticky NavBar's 64px height with a
              small gap; z-40 stays below the NavBar's z-50 so overlap
              is structurally impossible. */}
          <div className="lg:sticky lg:top-20 lg:z-40">
            <div className="relative h-[480px]">
              {/*
                THE MAP COLUMN IS NOW LEGACY-ONLY.

                Under the shell flag the map has moved to the full-width
                section above, so this column renders only the accepted
                `WorldMap`. Nothing about that component, its props or its
                sticky container has changed.
              */}
              {(
                <>
                  <WorldMap
                    countryStoryCounts={countryStoryCounts}
                    selectedIso3={selectedCountry?.iso3 ?? null}
                    onHoverCountry={setHovered}
                    onSelectCountry={handleSelectFromMap}
                    language={language}
                  />

                  {hovered && (
                    <MapTooltip hovered={hovered} knownStoryCount={hoveredKnownCount} language={language} />
                  )}
                </>
              )}
            </div>
            <div className="mt-4">
              <CoverageLegend language={language} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          {selectedCountry ? (
            <CountryPanel
              country={selectedCountry}
              response={activeResponse ?? null}
              isLoading={isLoading}
              error={error}
              category={category}
              onCategoryChange={handleCategoryChange}
              language={language}
            />
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-2xl border border-border bg-surface p-8 text-center">
              <p className="text-sm text-ink-secondary">{t.noSelectionPrompt}</p>
            </div>
          )}
        </div>
      </div>

      {/* Always-visible simplified summary for narrow screens, so the
          experience never depends on hover or the visual map. */}
      <div className="mt-6 lg:hidden">
        {!selectedCountry && (
          <p className="rounded-2xl border border-border bg-surface p-4 text-center text-sm text-ink-secondary">
            {t.mobileFallback}
          </p>
        )}
      </div>
    </div>
  );
}
