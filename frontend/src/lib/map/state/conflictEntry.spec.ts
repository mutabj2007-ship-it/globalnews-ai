import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DOMAIN_QUERY_KEY, decodeDomainEntry, domainEntryFromSearchParams,
  searchParamsWithDomainEntry, specialistEntryHref,
} from './mapDomainEntry';
import { mapStateFromSearchParams, searchParamsWithMapState } from './mapUrl';
import { MAP_MODES, LIVE_MAP_MODES } from './mapState';
import { searchParamsWithCamera } from '@/lib/map/camera/cameraUrl';
import { WORLD_CAMERA } from '@/lib/map/camera/cameraState';
import { resolveMapShellVariant } from '@/lib/map/mapShellFlag';
import { SPECIALIST_DOMAIN_IDS } from '@/lib/specialist/specialistDomain';
import { INTELLIGENCE_MODULES, isModuleNavigable } from '@/lib/intelligenceModules';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CONFLICT DISTINCT ENTRY — H's CONSUMPTION OF MAIN's SEAM
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `MAIN-CONFLICT-DISTINCT-ENTRY-SEAM-R1` resolved the last open Engine seam and
 * proved its own codec with 26 probes. This file does not re-prove the codec.
 * It proves the things that are only true once the codec is LANDED IN THIS TREE
 * and CONSUMED BY THIS ENGINE — which is the part Main could not run:
 *
 *   the file landed byte-for-byte, not re-authored;
 *   the writer in `MapPageClient` actually composes it, measured both ways;
 *   the card's destination follows the variant, and the gate follows the card;
 *   Country and Conflict are distinct, and `/map` is unchanged;
 *   nothing else the Engine governs moved.
 */

const SRC = join(__dirname, '..', '..', '..');
const read = (...p: string[]): string => readFileSync(join(SRC, ...p), 'utf-8');
const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

const conflictCard = (): typeof INTELLIGENCE_MODULES[number] =>
  INTELLIGENCE_MODULES.find((m) => m.id === 'conflict') as typeof INTELLIGENCE_MODULES[number];

/* ═══ 1 · MAIN'S BYTES, LANDED RATHER THAN RE-AUTHORED ════════════════════ */

describe('1 · the codec is Main’s file, verbatim', () => {
  it('sha256 of the landed module equals the sha256 of the package contract', () => {
    /*
      `MAIN-CONFLICT-DISTINCT-ENTRY-SEAM-R1.zip`
        sha256 08671c0af2f9078ff2003b4005930378b58979fbdd81717e497cc771427dee4f
        verified on the Product Owner's machine before the archive was opened.
      `contract/mapDomainEntry.ts` inside it
        sha256 8cba6ef0ad8cbfe8d4fc8be9affda962d474e39c7215cbc1d609cee5a721cea3

      Pinned here so a later "tidy-up" of an accepted contract fails a test
      rather than passing review.
    */
    expect(sha(read('lib', 'map', 'state', 'mapDomainEntry.ts')))
      .toBe('8cba6ef0ad8cbfe8d4fc8be9affda962d474e39c7215cbc1d609cee5a721cea3');
  });

  it('Plan B adds a dedicated route without adding a map mode', () => {
    expect(existsSync(join(SRC, 'app', 'conflict', 'page.tsx'))).toBe(true);
    expect(MAP_MODES).toEqual(['WORLD', 'EVIDENCE', 'SITUATIONS', 'WATCH', 'CHANGE', 'SOURCES']);
    expect(LIVE_MAP_MODES).toEqual(['WORLD', 'EVIDENCE']);
    /* the two vocabularies still share nothing — Main's B-3 */
    const shared = (MAP_MODES as readonly string[])
      .filter((m) => (SPECIALIST_DOMAIN_IDS as readonly string[]).includes(m));
    expect(shared).toEqual([]);
  });

  it('`mode=conflict` is not accepted anywhere', () => {
    /* A URL asking for it decodes to no domain and to the default mode. */
    const params = new URLSearchParams('mode=conflict');
    expect(mapStateFromSearchParams(params).mode).toBe('WORLD');
    expect(domainEntryFromSearchParams(params)).toBeNull();
  });
});

/* ═══ 2 · THE CARD'S DESTINATION IS A FUNCTION OF THE VARIANT ═════════════ */

describe('2 · variant-aware destination, and the gate that follows it', () => {
  it('shell yields the canonical entry; legacy yields nothing at all', () => {
    expect(specialistEntryHref('CONFLICT', 'shell')).toBe('/map?domain=conflict');
    expect(specialistEntryHref('CONFLICT', 'legacy')).toBeUndefined();
  });

  it('the flag default is OFF, so this build’s card is inert — and that is the accepted rollback', () => {
    /*
      NOT CHANGED HERE. `NEXT_PUBLIC_MAP_SHELL` is deployment configuration and
      the Product Owner owns it; H owns the consumption. The default is asserted
      because the card's current state depends on it and a silent flip of the
      default would change the Engine without touching the Engine.
    */
    expect(resolveMapShellVariant(undefined)).toBe('legacy');
    expect(resolveMapShellVariant('yes')).toBe('legacy');
    expect(resolveMapShellVariant('1')).toBe('shell');
    expect(resolveMapShellVariant('true')).toBe('shell');
  });

  it('the existing gate does the work — no renderer change, no third lock', () => {
    const conflict = conflictCard();
    expect(conflict.state).toBe('preview');

    /* legacy: no destination -> the second lock makes it inert */
    const onLegacy = { ...conflict, destination: specialistEntryHref('CONFLICT', 'legacy') };
    expect(isModuleNavigable(onLegacy)).toBe(false);

    /* shell: a destination -> PREVIEW is clickable, which is R2 §11 */
    const onShell = { ...conflict, destination: specialistEntryHref('CONFLICT', 'shell') };
    expect(isModuleNavigable(onShell)).toBe(true);
    expect(onShell.destination).toBe('/map?domain=conflict');

    /*
      AND THE RECONCILIATION WORTH RECORDING. Main measured this against
      baseline `6352d35`, where the gate still read `state === 'active' && …`.
      Under THAT gate a PREVIEW card would have been inert on BOTH variants, so
      the seam would not have landed as described. R2's widening is what makes
      Main's D-3 outcome true — asserted here rather than assumed.
    */
    expect(isModuleNavigable({ ...conflict, state: 'comingSoon', destination: '/map?domain=conflict' }))
      .toBe(false);
  });
});

/* ═══ 3 · COUNTRY AND CONFLICT DO NOT COLLAPSE ════════════════════════════ */

describe('3 · the two entries are distinguishable, and /map is untouched', () => {
  it('Country is the ABSENCE of the key, by construction', () => {
    /* COUNTRY is not a specialist domain, so it cannot acquire the parameter. */
    expect((SPECIALIST_DOMAIN_IDS as readonly string[]).includes('COUNTRY')).toBe(false);
    const country = INTELLIGENCE_MODULES.find((m) => m.id === 'country-intelligence');
    expect(country?.destination).toBe('/map');
  });

  it('the two destinations differ on the shell variant', () => {
    const country = INTELLIGENCE_MODULES.find((m) => m.id === 'country-intelligence')?.destination;
    const conflict = specialistEntryHref('CONFLICT', 'shell');
    expect(country).toBe('/map');
    expect(conflict).toBe('/map?domain=conflict');
    expect(conflict).not.toBe(country);
  });

  it('/map behaviour is unchanged — the parameter changes no map state', () => {
    /*
      Main's D-4: `decode('')` and `decode('domain=conflict')` return an
      IDENTICAL map state. Reproduced here against this tree's decoder, so the
      claim is about the landed code rather than the package's.
    */
    const plain = mapStateFromSearchParams(new URLSearchParams(''));
    const withDomain = mapStateFromSearchParams(new URLSearchParams('domain=conflict'));
    expect(withDomain).toEqual(plain);
  });

  it('an unreadable or absent domain falls back to the Country entry', () => {
    for (const raw of ['', 'country', 'COUNTRY', 'conflic', 'situations', 'x'.repeat(40)]) {
      expect(`${raw}: ${decodeDomainEntry(raw) === null}`).toBe(`${raw}: true`);
    }
    /* and the three accepted spellings are accepted */
    for (const raw of ['conflict', 'CONFLICT', 'Conflict']) {
      expect(decodeDomainEntry(raw)).toEqual({ domain: 'CONFLICT' });
    }
  });
});

/* ═══ 4 · THE DEEP LINK SURVIVES THE WRITER — MEASURED BOTH WAYS ══════════ */

/**
 * The map route's writer, reproduced as the pure chain it is.
 *
 * `MapPageClient` builds a FRESH `URLSearchParams` and re-adds only what it is
 * given, so this mirrors it exactly — including the fact that the domain link
 * is the only thing carrying `domain` through.
 */
function writerPass(search: string, composeDomain: boolean): string {
  const incoming = new URLSearchParams(search);
  const state = mapStateFromSearchParams(incoming);
  const entry = domainEntryFromSearchParams(incoming);

  /* the fresh params the writer starts from */
  const params = new URLSearchParams();
  const withMapState = searchParamsWithMapState(params, {
    mode: state.mode,
    period: state.period,
    selection: state.selection,
  });
  const composed = composeDomain
    ? searchParamsWithDomainEntry(withMapState, entry)
    : withMapState;
  const query = searchParamsWithCamera(composed, WORLD_CAMERA).toString();
  return query.length > 0 ? `/map?${query}` : '/map';
}

describe('4 · the Conflict deep link survives refresh and navigation', () => {
  it('3 of 3 writer round-trips preserve it — the positive control', () => {
    let url = '/map?domain=conflict';
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      url = writerPass(url.slice(url.indexOf('?') + 1), true);
      seen.push(url);
    }
    expect(seen).toEqual(['/map?domain=conflict', '/map?domain=conflict', '/map?domain=conflict']);
    expect(new Set(seen).size).toBe(1);
  });

  it('0 of 3 survive without the compose line — the negative control', () => {
    /*
      THIS IS WHY MAIN CALLS THAT LINE NOT OPTIONAL. Without it the first pass
      erases the parameter and the Conflict deep link silently becomes the
      Country entry — a URL that claims one thing and shows another.
    */
    let url = '/map?domain=conflict';
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      url = writerPass(url.slice(url.indexOf('?') + 1), false);
      seen.push(url);
    }
    expect(seen).toEqual(['/map', '/map', '/map']);
  });

  it('a plain /map stays a plain /map through the same chain', () => {
    expect(writerPass('', true)).toBe('/map');
  });

  it('the landed writer really does compose it — asserted on the component source', () => {
    const client = read('components', 'map', 'MapPageClient.tsx');
    expect(client).toContain('searchParamsWithDomainEntry(withMapState, domainEntry)');
    expect(client).toContain('searchParamsWithCamera(withDomain, camera)');
    /* and the read is the same initialiser discipline as its neighbour */
    expect(client).toContain('domainEntryFromSearchParams(');
  });

  it('it adds no second writer — the pinned rule still holds', () => {
    /*
      `c2RuntimeDefects.spec.ts` pins exactly one writer of the URL on the map
      route. The seam is a pure function over `URLSearchParams`: no router, no
      history, no `window` in the codec's executable bytes.
    */
    const codec = read('lib', 'map', 'state', 'mapDomainEntry.ts')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    for (const forbidden of ['router', 'history', 'window', 'location', 'fetch']) {
      expect(`${forbidden}: ${codec.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });
});

/* ═══ 5 · NO PROVIDER OR AI IS REACHABLE FROM THE ENTRY ═══════════════════ */

describe('5 · entering Conflict spends nothing and claims nothing', () => {
  it('the entry carries one key, and none of the keys that trigger retrieval', () => {
    const params = new URLSearchParams(specialistEntryHref('CONFLICT', 'shell')?.split('?')[1]);
    expect([...params.keys()]).toEqual([DOMAIN_QUERY_KEY]);
    /* selection, definition and country are what the map route retrieves on */
    for (const key of ['sel', 'def', 'country', 'category', 'cam']) {
      expect(`${key}: ${params.has(key)}`).toBe(`${key}: false`);
    }
  });

  it('the entry type carries a domain and nothing that could become a claim', () => {
    const entry = decodeDomainEntry('conflict');
    expect(Object.keys(entry ?? {})).toEqual(['domain']);
    const codec = read('lib', 'map', 'state', 'mapDomainEntry.ts')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    for (const claim of ['severity', 'incident', 'casualt', 'layer', 'camera', 'record']) {
      expect(`${claim}: ${new RegExp(claim, 'i').test(codec)}`).toBe(`${claim}: false`);
    }
  });
});

/* ═══ 6 · EVERYTHING R2 GOVERNED IS EXACTLY WHERE R2 LEFT IT ══════════════ */

describe('6 · the rest of the Engine did not move', () => {
  it('the other eight cards keep their state and destination', () => {
    /*
      ── ONE ROW DIFFERS FROM H's R3, AND IT IS NOT THIS ROUND THAT MOVED IT ──

      H wrote `politics:preview:-` because their R3 baseline (`6352d35`) did not
      carry the Politics package. THIS lineage landed
      `H-POLITICS-ALPHA-VISUAL-CONVERGENCE-R2` in the immediately preceding
      commit, where the card was given `/politics-visual-preview` under the
      Product Owner's own instruction.

      SO THE ROW IS CORRECTED, NOT THE GUARD RELAXED. What this test is for is
      that landing the CONFLICT entry disturbs nothing else — and it still pins
      all eight rows exactly, by full string, so any drift in any of them fails
      here. Politics was already at this value before `conflictDomainBind.ts`
      and `mapDomainEntry.ts` existed in this tree, which is the difference
      between a stale expectation and a regression.
    */
    const row = (id: string): string => {
      const m = INTELLIGENCE_MODULES.find((x) => x.id === id);
      return `${id}:${m?.state}:${m?.destination ?? '-'}`;
    };
    expect([
      row('security'), row('world-intelligence'), row('country-intelligence'),
      row('politics'), row('economy'), row('market'), row('humanitarian'), row('energy'),
    ]).toEqual([
      'security:preview:/security-visual-preview',
      'world-intelligence:comingSoon:-',
      'country-intelligence:active:/map',
      'politics:preview:/politics-visual-preview',
      'economy:preview:/economy-visual-preview',
      'market:preview:/market',
      'humanitarian:preview:/humanitarian',
      /*
        Energy moved COMING SOON -> PREVIEW with H-ENERGY-PARTXI-IMPLEMENTATION-R4,
        in the commit before this one. Same shape as the Politics correction above:
        the row is updated because the CARD moved for its own reason, not because
        the Conflict entry disturbed it. All eight rows are still pinned by full
        string, so any drift in any of them still fails here.
      */
      'energy:preview:/energy',
    ]);
    /*
      AND THE ONE THING CONFLICT MUST NEVER DO TO COUNTRY, asserted beside the
      rows rather than trusted: Country's destination is the bare `/map`, with
      no domain key. Conflict's entry is distinct BY the key's presence, so if
      Country ever acquired one the two would collapse — which is the whole
      failure this seam exists to prevent.
    */
    const country = INTELLIGENCE_MODULES.find((m) => m.id === 'country-intelligence');
    expect(country?.destination).toBe('/map');
    expect(`country carries a domain key: ${(country?.destination ?? '').includes('domain=')}`)
      .toBe('country carries a domain key: false');
  });

  it('COMING SOON navigation rules are unchanged', () => {
    for (const m of INTELLIGENCE_MODULES) {
      if (m.state === 'comingSoon') {
        expect(m.destination).toBeUndefined();
        expect(isModuleNavigable(m)).toBe(false);
      }
    }
    /*
      AND A COMING SOON CARD STAYS INERT EVEN IF HANDED THE CONFLICT ENTRY.

      The exemplar was `energy`, which is no longer COMING SOON —
      H-ENERGY-PARTXI-IMPLEMENTATION-R4 moved it to PREVIEW with a real route,
      so handing it a destination now correctly makes it navigable and the
      assertion inverted. The PROPERTY is unchanged and still worth asserting;
      it needs a card that is actually in the state it names, and
      `world-intelligence` is the last one.

      Chosen deliberately rather than by convenience: World is COMING SOON for
      a reason that no package can answer — MAIN-WORLD-INTELLIGENCE-CANONICAL-
      FOUNDATION-R1 rules it a surface that does not exist yet — so it will not
      quietly stop being the right exemplar the way Energy did.
    */
    const world = INTELLIGENCE_MODULES.find((m) => m.id === 'world-intelligence');
    expect(world?.state).toBe('comingSoon');
    expect(isModuleNavigable({ ...world!, destination: '/map?domain=conflict' })).toBe(false);
  });

  it('the nine, their order and their slots are untouched', () => {
    expect(INTELLIGENCE_MODULES.map((m) => m.id)).toEqual([
      'security', 'world-intelligence', 'country-intelligence', 'politics',
      'economy', 'conflict', 'market', 'humanitarian', 'energy',
    ]);
    expect(INTELLIGENCE_MODULES).toHaveLength(9);
  });
});
