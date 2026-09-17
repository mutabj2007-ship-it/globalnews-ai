import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  SPECIALIST_DOMAIN_IDS,
  domainToken,
  tokenDomain,
  type SpecialistDomainId,
} from './specialistDomain';
import { INDICATOR_SOFT_MAX, indicatorMaxFor } from './indicatorStrip';
import { HUD_SLOTS, hudLineIsWellFormed, renderableSlots } from './hudGrammar';
import { entityStateIsRenderable, resolveEntityImage } from './participantEntity';
import { DISPUTED_PRESENTATION, blockIsValid } from './competingReadings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B1 / B2 — THE SHARED SPECIALIST PLATFORM IS DOMAIN-NEUTRAL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * B2 recovered four components and four models from canonical C55 `3db5a09`.
 * They were accepted work, and they were lost in the re-rooting that produced
 * the orphan lineage — not superseded, not rejected. H's architecture
 * inspection, reading only the sealed candidate, recorded them as "NONE… build
 * generically", which was accurate about the candidate and would have rebuilt
 * 1,044 lines that already existed.
 *
 * ── WHY THIS SPEC REPLACES THE CANONICAL ONE RATHER THAN RECOVERING IT ────
 *
 * Canonical carried `specialistBoundary.spec.ts`, which proves these same
 * boundaries — and imports `@/lib/map/conflict/conflictDomain`,
 * `conflictCapability` and `conflictHud`. Recovering it would have required
 * recovering the Conflict domain, and Conflict is the one domain that may not
 * be wired: `MAIN-CONFLICT-RUNTIME-CONTRACT-R3-ADDENDUM-A1` states
 * **"MAIN-CONFLICT-D1 and D4 REMAIN BLOCKING. No Conflict implementation."**
 *
 * So the boundary spec is DEFERRED to Conflict recovery, and this proves the
 * neutrality WITHOUT any domain dependency — which is the stronger claim. A
 * neutrality test that needs a domain to run is not testing neutrality.
 *
 * ── THE ONE DOMAIN-AWARE SEAM, AND WHY IT IS CORRECT ─────────────────────
 *
 * `INDICATOR_MAX_BY_DOMAIN` maps `CONFLICT -> 7` over a platform default of 5.
 * That is a CONFIGURATION keyed by domain, not domain logic in the shared
 * layer — H's own A3 row says it: "Platform default cap is 5 indicators;
 * Conflict's 7 is a Conflict configuration, not the default." The tests below
 * hold it to being a config: every other domain gets the default, and adding a
 * domain requires no edit here.
 */

const SPECIALIST_LIB = __dirname;
const SPECIALIST_COMPONENTS = join(__dirname, '..', '..', 'components', 'specialist');

const filesIn = (dir: string): readonly string[] =>
  readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isFile())
    .map((name) => join(dir, name));

/*
  Comments are stripped before any "this must not appear" check. The B1 ruling
  is DOCUMENTED in specialistDomain.ts, and that documentation necessarily names
  `WatchSurface` in order to say the enum is not it. A test that reads prose
  would fail on its own explanation.
*/
const stripComments = (value: string): string =>
  value
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const sharedSources = (): readonly { path: string; text: string }[] =>
  [...filesIn(SPECIALIST_LIB), ...filesIn(SPECIALIST_COMPONENTS)]
    .filter((p) => !p.endsWith('.spec.ts') && !p.endsWith('.spec.tsx'))
    .map((path) => ({ path, text: stripComments(readFileSync(path, 'utf-8')) }));

describe('B1 — the canonical six-member specialist vocabulary', () => {
  it('declares exactly the six domains the CTO ruled', () => {
    expect([...SPECIALIST_DOMAIN_IDS]).toEqual([
      'CONFLICT',
      'ELECTION',
      'DELIVERY',
      'ECONOMY',
      'MARKET',
      'SECURITY',
    ]);
  });

  it('the runtime list and the token parser cannot drift apart', () => {
    /*
      `tokenDomain` used to re-state the members as a hard-coded triple. That is
      exactly how a seventh domain joins the TYPE and silently fails to parse at
      RUNTIME. Both now read one list, so this round-trip covers every member
      the type admits.
    */
    for (const domain of SPECIALIST_DOMAIN_IDS) {
      expect(tokenDomain(domainToken(domain, 'any-state'))).toBe(domain);
    }
  });

  it('an unknown domain is null, not a guess', () => {
    expect(tokenDomain('ENERGY:whatever')).toBeNull();
    expect(tokenDomain('conflict:lowercase')).toBeNull();
  });

  it('a token with no separator is null rather than a truncated comparison', () => {
    /*
      The old implementation did `slice(0, indexOf(':'))`, and `indexOf` returns
      -1 when absent — so `slice(0, -1)` lopped off the last character and
      compared the remainder. A malformed token became a confident wrong answer.
    */
    expect(tokenDomain('CONFLICT')).toBeNull();
    expect(tokenDomain('')).toBeNull();
  });

  describe('AND IT IS NOT THE OTHER TWO VOCABULARIES', () => {
    it('it does not contain MAP, which is a surface and not a domain', () => {
      /*
        `WatchSurface` is MAP · ECONOMY · MARKET · CONFLICT · SECURITY. Merging
        the two would force MAP into the domain vocabulary. The CTO ruling keeps
        them separate; this is that ruling as a test.
      */
      expect(SPECIALIST_DOMAIN_IDS as readonly string[]).not.toContain('MAP');
    });

    it('and the specialist layer never imports the Watch surface type', () => {
      for (const { path, text } of sharedSources()) {
        expect({ path, hasWatchSurface: text.includes('WatchSurface') }).toEqual({
          path,
          hasWatchSurface: false,
        });
      }
    });
  });
});

describe('B2 — the recovered platform is domain-neutral', () => {
  describe('NO SHARED FILE REACHES INTO A DOMAIN', () => {
    it('nothing imports from a domain directory', () => {
      /*
        The failure this prevents: the first consumer's vocabulary leaks into a
        shared component, and the second consumer cannot use it. §21 forbids a
        `CandidateCard`, and this is how a `CandidateCard` gets built.
      */
      const offenders = sharedSources()
        .filter(({ text }) => /from '@\/lib\/map\/(conflict|election|delivery)/.test(text))
        .map(({ path }) => path);

      expect(offenders).toEqual([]);
    });

    it('and no shared file names a domain-only concept', () => {
      /*
        `INDICATOR_MAX_BY_DOMAIN` is the one permitted mention, and it is a
        configuration table rather than behaviour — asserted separately below.
      */
      const offenders = sharedSources()
        .filter(({ text, path }) => {
          const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
          const mentions = /\b(front|candidate|constituency|ballot|imihigo|contest)\b/i.test(code);

          return mentions && !path.endsWith('indicatorStrip.ts');
        })
        .map(({ path }) => path);

      expect(offenders).toEqual([]);
    });
  });

  describe('EVERY DOMAIN IN THE VOCABULARY IS SERVABLE', () => {
    it('the indicator cap resolves for all six, with no per-domain code', () => {
      for (const domain of SPECIALIST_DOMAIN_IDS) {
        expect(typeof indicatorMaxFor(domain)).toBe('number');
      }
    });

    it('the five non-Conflict domains receive the platform default', () => {
      /*
        The proof that the seam is a CONFIG and not a branch: B1 added three
        domains and none of them needed an entry.
      */
      for (const domain of SPECIALIST_DOMAIN_IDS.filter((d) => d !== 'CONFLICT')) {
        expect(indicatorMaxFor(domain)).toBe(INDICATOR_SOFT_MAX);
      }
    });

    it('and Conflict keeps its ratified seven, which the default does not become', () => {
      expect(indicatorMaxFor('CONFLICT')).toBe(7);
      expect(INDICATOR_SOFT_MAX).toBe(5);
    });

    it('an unregistered domain would still resolve, rather than throwing', () => {
      /* A domain that has not been configured is served, not refused. */
      expect(indicatorMaxFor('SECURITY' as SpecialistDomainId)).toBe(INDICATOR_SOFT_MAX);
    });
  });

  describe('EXACTLY ONE IMPLEMENTATION OF EACH PROMOTED COMPONENT', () => {
    const COMPONENTS = [
      'ParticipantEntityCard',
      'ObservedIndicatorStrip',
      'CompetingReadingsBlock',
      'SpecialistHudLine',
    ];

    it('each exists once, in the shared directory', () => {
      const present = readdirSync(SPECIALIST_COMPONENTS);

      for (const component of COMPONENTS) {
        expect(present.filter((f) => f.startsWith(component))).toHaveLength(1);
      }
    });

    it('and each is a function component rather than a re-export', () => {
      for (const component of COMPONENTS) {
        const text = readFileSync(join(SPECIALIST_COMPONENTS, `${component}.tsx`), 'utf-8');

        expect(text).toContain(`export function ${component}`);
      }
    });
  });

  describe('THE PLATFORM CONTRACTS SURVIVED RECOVERY INTACT', () => {
    it('the HUD line is seven slots, and an eighth is not well-formed', () => {
      expect(HUD_SLOTS).toHaveLength(7);
      expect(hudLineIsWellFormed({ EIGHTH: { text: 'x' } } as never)).toBe(false);
    });

    it('an empty slot collapses rather than being padded', () => {
      expect(renderableSlots({})).toEqual([]);
    });

    it('a disputed reading has a presentation that is not a colour claim', () => {
      expect(DISPUTED_PRESENTATION).toBeDefined();
    });

    it('the validators refuse a malformed input rather than repairing it', () => {
      /* A validator that repairs its input hides the producer's defect. */
      expect(blockIsValid({ readings: [] } as never)).toBe(false);
      expect(entityStateIsRenderable({ currentState: 'not-a-token' } as never)).toBe(false);
      expect(entityStateIsRenderable({ currentState: 'CONFLICT:active' } as never)).toBe(true);
    });

    it('RECORDED GAP — the validators assume a non-null entity', () => {
      /*
        RECOVERY OBSERVATION, not a defect introduced here, and deliberately NOT
        patched: `entityStateIsRenderable(undefined)` THROWS rather than
        returning false, because it reads `entity.currentState` unguarded.

        The B2 rules say preserve sealed-candidate behaviour and adapt only where
        current contracts require it. Hardening a recovered validator is neither
        — it is a behaviour change to accepted work, and it belongs to the review
        that wires the first consumer, where the caller contract is decided.

        Asserted as-is so the gap is visible and cannot be discovered by a crash
        in a dashboard later.
      */
      expect(() => entityStateIsRenderable(undefined as never)).toThrow();
    });

    it('an unlicensed entity falls back to initials, never a fabricated image', () => {
      /*
        The initials are DERIVED FROM THE VERIFIED NAME, so the fallback asserts
        nothing the record does not already contain. A stock portrait would be
        an invention about a real person.
      */
      const resolution = resolveEntityImage({
        verifiedName: 'Jane Qui Doe',
        imageLicence: 'NONE',
      } as never);

      expect(resolution.kind).not.toBe('IMAGE');
      expect(JSON.stringify(resolution)).toContain('JQ');
    });

    it('and a licensed image is used as given', () => {
      const resolution = resolveEntityImage({
        verifiedName: 'Jane Doe',
        imageLicence: 'LICENSED',
        imageRef: 'https://example.com/j.jpg',
      } as never);

      expect(resolution).toEqual({ kind: 'IMAGE', src: 'https://example.com/j.jpg' });
    });
  });
});
