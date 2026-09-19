/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE SPECIALIST DOMAIN ENTRY STATE — MAIN-CONFLICT-DISTINCT-ENTRY-SEAM-R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PROPOSED for `frontend/src/lib/map/state/mapDomainEntry.ts`.
 * Nothing lands without authorization. No provider. No activation. No deployment.
 *
 * ── THE QUESTION THIS ANSWERS, AND THE ONE IT REFUSES ─────────────────────
 *
 * Clicking Conflict Intelligence must open the accepted D1 workspace AS CONFLICT,
 * not as generic Country/Map state. `/map` with no distinguishing parameter IS
 * the Country entry, so the seam is a distinguishing STATE — and the only state
 * mechanism this route has is its query string.
 *
 * WHICH PARAMETER IS NOT A CHOICE OF TASTE. It was measured:
 *
 *   `/map` has ONE `page.tsx` and no dynamic segment, so there is no route-
 *   segment mechanism to reuse. The route's complete read set is `country`,
 *   `category`, `mode`, `period`, `sel`, `def` plus the camera — every one a
 *   pure codec over `URLSearchParams`, with exactly ONE writer.
 *
 * ── WHY THIS IS NOT `mode=conflict` ───────────────────────────────────────
 *
 * `mode` was the obvious candidate and it is the wrong one, for a reason the
 * accepted vocabulary states about itself. `SpecialistDomainId` was ruled at
 * Gate B1 after THREE accepted declarations of "what the domains are" were
 * measured and no two agreed, and the ruling was that **they stay separate**:
 *
 *     "`WatchSurface` is NOT this enum ... They are not to be forced into one
 *      type for symmetry ... Merging them would force `MAP` into the domain
 *      vocabulary."
 *
 * `MapMode` is a third such vocabulary — WORLD · EVIDENCE · SITUATIONS · WATCH
 * · CHANGE · SOURCES, a set of PROJECTIONS, not of domains. Putting CONFLICT in
 * it is the same merge that ruling forbids, and it would cost three further
 * untruths:
 *
 *   1. `modeAvailability` is live only for WORLD and EVIDENCE, and `ModeSwitcher`
 *      computes `disabled = !isLive || …` WITHOUT consulting `isActive`. So a
 *      CONFLICT mode would render as the checked chip AND `aria-disabled` — and
 *      a reader who switched to WORLD could never switch back. A ONE-WAY DOOR.
 *   2. `modeUnavailableReason` has no entry for a new member and falls to
 *      `TEMPORARILY_UNAVAILABLE` — the one reason that says RETRY. The file's own
 *      docblock calls that fallback "a GAP, not a default".
 *   3. `LIVE_MAP_MODES` is the BUILT question — `ModeSwitcher`: "whether this
 *      mode's model exists at all". Conflict's map-mode model does not exist in
 *      this lineage (`lib/map/conflict/` is absent) and `MAIN-CONFLICT-D1-BIND`
 *      is OPEN, so claiming it does is a claim the register forbids.
 *
 * ── WHY `SpecialistDomainId` IS EXACTLY RIGHT ─────────────────────────────
 *
 * Because of the one sentence in its own docblock that the whole seam rests on:
 *
 *     "A member here is a reserved identity, NOT A CLAIM THAT ANYTHING IS BUILT."
 *
 * That is precisely what a distinct entry needs to assert and precisely what it
 * must not exceed. Naming the domain says which intelligence the reader asked
 * for. It says nothing about layers, incidents, severity or data — and this
 * module gives it no way to.
 *
 * ── ENFORCEMENT BY ABSENCE ────────────────────────────────────────────────
 *
 * `MapDomainEntry` carries a domain id and NOTHING ELSE. There is deliberately
 * no path from it to a layer id, a severity, a record predicate or a camera —
 * the same discipline `mapComposition.ts` applies to `MapSplitMode` ("a split
 * mode may change how much map is on screen; it may never change what the map is
 * allowed to claim"). A probe asserts the type carries no such field.
 *
 * So "the entry fabricates no incidents" is not a rule anyone has to remember.
 * There is no wire through which it could.
 */

import {
  SPECIALIST_DOMAIN_IDS,
  type SpecialistDomainId,
} from '@/lib/specialist/specialistDomain';
import type { MapShellVariant } from '@/lib/map/mapShellFlag';

export const DOMAIN_QUERY_KEY = 'domain';

/**
 * THERE IS NO DEFAULT DOMAIN, AND THAT IS THE COUNTRY-ENTRY GUARANTEE.
 *
 * `SpecialistDomainId` has six members and COUNTRY is not one of them — Country
 * Intelligence is not a specialist domain. So the Country entry is the ABSENCE
 * of this parameter, exactly as WORLD and 24H are absences in `mapUrl.ts`:
 *
 *     "'no parameter' and 'the default' are the same thing in both directions".
 *
 * A plain `/map` therefore stays a plain `/map` BY CONSTRUCTION rather than by
 * a careful edit, and no byte of the Country entry changes.
 */
export const DEFAULT_MAP_DOMAIN: null = null;

/**
 * The entry state, and the whole of it.
 *
 * ONE FIELD. Adding `layers`, `severity`, `records` or `camera` here is what the
 * probe suite exists to prevent: each would let a navigation decision become a
 * claim about the world.
 */
export interface MapDomainEntry {
  readonly domain: SpecialistDomainId;
}

/** Lowercase in the URL — the spelling `mapUrl.ts` already uses for mode and period. */
export function encodeDomainEntry(entry: MapDomainEntry | null): string | null {
  return entry === null ? null : entry.domain.toLowerCase();
}

/**
 * EVERY INPUT IS UNTRUSTED — this arrives from an address bar a person can type
 * into. Never throws; returns null for anything it cannot read, and the caller
 * falls back to no domain, which is the Country entry.
 *
 * Membership is read from `SPECIALIST_DOMAIN_IDS` rather than re-listed, for the
 * reason that list states: "ONE LIST, SO THE TYPE AND THE RUNTIME CANNOT DRIFT."
 *
 * ── CASE-INSENSITIVE HERE, CASE-SENSITIVE IN `tokenDomain`, DELIBERATELY ──
 *
 * `tokenDomain('conflict:lowercase')` is `null`, and an accepted guard pins it.
 * This decoder accepts `conflict`, `CONFLICT` and `Conflict` alike. That is not
 * drift: the two parse different things. A DomainStateToken is machine-produced
 * and a lowercase one is a foreign token that must not be normalised into a
 * native-looking answer. A URL is HAND-TYPED, and `decodeMode` already answers
 * the same question the same way — `raw.toUpperCase()` before the membership
 * test. The seam follows the precedent for the surface it is actually on.
 */
export function decodeDomainEntry(raw: string | null | undefined): MapDomainEntry | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 32) return null;

  const upper = raw.toUpperCase();

  return (SPECIALIST_DOMAIN_IDS as readonly string[]).includes(upper)
    ? { domain: upper as SpecialistDomainId }
    : null;
}

/** The domain a URL asks for. Absent or unreadable falls to no domain. */
export function domainEntryFromSearchParams(
  params: URLSearchParams | null | undefined,
): MapDomainEntry | null {
  return decodeDomainEntry(params?.get(DOMAIN_QUERY_KEY));
}

/**
 * Compose the domain onto params the SINGLE WRITER has already built.
 *
 * THIS ADDS NO SECOND WRITER, and that is not a hope — it is the same shape
 * `searchParamsWithMapState` has, for the same pinned reason: `c2RuntimeDefects`
 * fixes EXACTLY ONE writer of the URL on the map route, and two writers racing is
 * the original H-C2 defect. This is a pure function over `URLSearchParams`. It
 * calls no router and touches no history.
 *
 * Absence DELETES the key rather than writing an empty value that would read as
 * a choice of nothing.
 */
export function searchParamsWithDomainEntry(
  existing: URLSearchParams | null | undefined,
  entry: MapDomainEntry | null,
): URLSearchParams {
  const params = new URLSearchParams(existing?.toString() ?? '');
  const encoded = encodeDomainEntry(entry);

  if (encoded === null) params.delete(DOMAIN_QUERY_KEY);
  else params.set(DOMAIN_QUERY_KEY, encoded);

  return params;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE ENTRY HREF — AND WHY IT IS A FUNCTION OF THE SHELL VARIANT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE WRONG THING THIS MAKES UNREPRESENTABLE: a Conflict URL that renders
 * Country Intelligence.
 *
 * `NEXT_PUBLIC_MAP_SHELL` is DEFAULT OFF and its default is an accepted rollback
 * property, not an oversight — `mapShellFlag.ts`: "A flag whose failure mode is
 * 'ship the new thing' is not a rollback mechanism." With the flag off, `/map`
 * mounts the legacy `WorldMap`, which has no D1 composition, no HUD and no mode
 * row. A `?domain=conflict` link into THAT is a URL claiming Conflict while
 * showing Country — the exact outcome the objective forbids.
 *
 * So the destination is DERIVED FROM THE VARIANT and is `undefined` when the
 * surface cannot answer. `isModuleNavigable` already reads
 *
 *     module.state === 'active' && Boolean(module.destination)
 *
 * so an absent destination makes the card inert through the accepted gate, with
 * NO renderer change and NO third lock invented. H's two locks do the work.
 *
 * THE CONSEQUENCE, STATED PLAINLY: while the flag is off this returns
 * `undefined` for every domain and the Conflict card stays exactly as inert as
 * it is today. The seam's value is that the moment the flag is turned on —
 * a configuration the Product Owner already controls — Conflict has a distinct,
 * honest entry and no further decision is required.
 */
export function specialistEntryHref(
  domain: SpecialistDomainId,
  variant: MapShellVariant,
): string | undefined {
  if (variant !== 'shell') return undefined;

  const params = searchParamsWithDomainEntry(null, { domain });

  return `/map?${params.toString()}`;
}
