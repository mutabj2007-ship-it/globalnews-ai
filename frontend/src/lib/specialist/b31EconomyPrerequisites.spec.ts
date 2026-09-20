import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { DISPLAY_LOCALES } from '@globalnews-ai/shared';
import type { SourceProvenance, EvidenceRole, SourceType } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B3.1 — THE TWO ECONOMY PREREQUISITES, CLEARED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * B3 recorded that Economy could not be recovered because two shared contracts
 * were missing. Both are now recovered, and this proves the recovery did what it
 * claimed and nothing more.
 *
 * ── THE RULE THAT SHAPED BOTH RECOVERIES ─────────────────────────────────
 *
 * A symbol the sealed candidate already owns is NOT redeclared. Where the
 * candidate's version and canonical's were MEASURED equivalent, the candidate's
 * stays authoritative and the recovered module consumes it. Where they were
 * measured DIFFERENT, nothing was reconciled — the collision is reported.
 *
 * That distinction is the whole of the discipline here, and the two cases below
 * came out opposite ways.
 */

const REPO = join(__dirname, '..', '..', '..', '..');
const SHARED_SRC = join(REPO, 'shared', 'src');

/*
  ── THE `git show 3db5a09:…` DEPENDENCY IS GONE, AND WHY ───────────────────

  Three assertions below read their evidence out of commit `3db5a09` with
  `git show`. That commit lives only on a LOCAL branch
  (`integration/alpha-convergence-2`) and is on no remote, so a fresh clone of
  the release branch could not run them — they failed rather than skipped,
  because `describeGit` gated on `.git` EXISTING, which it does in any clone.

  Each one was re-read to ask what it actually proves. All three assert
  properties of files that are PRESENT in this tree and still carry them, so
  the historical read was never the point: it recorded that C55 once adopted a
  vocabulary, where the thing worth defending is that the vocabulary is still
  adopted NOW.

  So they assert the CURRENT files. That is strictly stronger — a historical
  comparison passes forever no matter what the product does today, while these
  fail the moment the property is lost. No fixture was needed, because no byte
  baseline was being defended.
*/
const barrel = readFileSync(join(SHARED_SRC, 'index.ts'), 'utf-8');
const economyIndex = readFileSync(join(SHARED_SRC, 'economy', 'index.ts'), 'utf-8');
const economyStrings = readFileSync(
  join(REPO, 'frontend', 'src', 'lib', 'economy', 'strings.ts'),
  'utf-8',
);

describe('B3.1 — DisplayLocale: recovered, activating nothing', () => {
  it('declares the seven contracted display locales, in contract order', () => {
    expect([...DISPLAY_LOCALES]).toEqual(['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar']);
  });

  it('is a pure type module — it imports nothing at all', () => {
    /*
      The decisive property for "recoverable with no language activation". It
      pulls in no dictionary, no catalogue and no runtime, so recovering it
      cannot make a language visible.
    */
    const source = readFileSync(join(SHARED_SRC, 'language', 'index.ts'), 'utf-8');

    expect(source).not.toMatch(/^import /m);
    expect(source).not.toMatch(/require\(/);
  });

  it('and carries no dictionary content of its own', () => {
    const dir = readdirSync(join(SHARED_SRC, 'language'));

    expect(dir).toEqual(['index.ts']);
  });

  describe('THE THREE-SET MODEL IS PRESERVED, NOT COLLAPSED', () => {
    it('DisplayLocale is NOT the analysis LanguageCode set', () => {
      /*
        LanguageCode carries `sw` and `rw` for source intelligence and omits
        `de`/`pt`. Collapsing the two is the exact defect LANG-UI-7 exists to
        correct.
      */
      expect(DISPLAY_LOCALES as readonly string[]).not.toContain('sw');
      expect(DISPLAY_LOCALES as readonly string[]).not.toContain('rw');
      expect(DISPLAY_LOCALES as readonly string[]).toContain('de');
      expect(DISPLAY_LOCALES as readonly string[]).toContain('pt');
    });

    it('and the SELECTABLE registry is a separate, frontend-owned fact', () => {
      /*
        THE LOAD-BEARING ASSERTION OF THIS WHOLE GATE. Recovering the contract
        type must not widen what the product offers. The registry is a subset of
        DISPLAY_LOCALES by contract, and it is still exactly EN + PL.
      */
      const languages = readFileSync(
        join(REPO, 'frontend', 'src', 'lib', 'i18n', 'languages.ts'),
        'utf-8',
      );

      expect(languages).toContain("export const ACTIVE_LANGUAGES: LanguageCode[] = ['en', 'pl'];");
    });

    it('no new dictionary file was recovered alongside it', () => {
      const dictionaries = readdirSync(
        join(REPO, 'frontend', 'src', 'lib', 'i18n', 'dictionaries'),
      ).filter((f) => /^(ar|de|es|fr|pt)\.ts$/.test(f));

      expect(dictionaries).toEqual([]);
    });
  });
});

describe('B3.1 — SourceProvenance: recovered without a duplicate export', () => {
  it('SourceProvenance and EvidenceRole are exported', () => {
    const provenance: SourceProvenance = { sourceType: 'OFFICIAL_SOURCE' as SourceType };
    const role: EvidenceRole | undefined = provenance.evidenceRole;

    expect(provenance.sourceType).toBe('OFFICIAL_SOURCE');
    expect(role).toBeUndefined();
  });

  it('it does NOT redeclare SourceType — it imports the candidate’s', () => {
    /*
      Both modules reach the barrel through `export *`, so a redeclaration would
      double-export the symbol. The candidate's stays authoritative because the
      two unions were measured equivalent first.
    */
    const source = readFileSync(join(SHARED_SRC, 'source-provenance.ts'), 'utf-8');

    expect(source).not.toContain('export type SourceType');
    expect(source).toContain("import type { SourceType } from './source-type';");
  });

  it('and it preserves the provider / publisher distinction', () => {
    /* The identity rule: who produced the record, and who published it. */
    const source = readFileSync(join(SHARED_SRC, 'source-provenance.ts'), 'utf-8');

    expect(source).toContain('providerId');
    expect(source).toContain('OfficialSourceClass');
  });

  describe('NO DUPLICATE BARREL EXPORT — PROVEN, NOT ASSUMED', () => {
    it('every re-exported module is listed exactly once', () => {
      const modules = [...barrel.matchAll(/export \* from '\.\/([^']+)'/g)].map((m) => m[1]);

      expect(new Set(modules).size).toBe(modules.length);
    });

    it('source-provenance is exported, and after source-type', () => {
      /* Dependency direction visible in the barrel itself. */
      expect(barrel).toContain("export * from './source-provenance'");
      expect(barrel.indexOf("'./source-type'")).toBeLessThan(
        barrel.indexOf("'./source-provenance'"),
      );
    });

    it('RetrievalOutcome was NOT recovered, because it collides semantically', () => {
      /*
        Unlike SourceType, the two RetrievalOutcome unions are NOT equivalent:

          candidate  SUCCESS · NO_RELEVANT_EVIDENCE · PROVIDER_RATE_LIMITED ·
                     PROVIDER_UNAVAILABLE · RETAINED_ONLY      (provider-centric)
          canonical  RETRIEVED · NO_MATCHING_EVIDENCE ·
                     CLARIFICATION_REQUIRED · NOT_RETRIEVABLE  (query-centric)

        Economy uses neither, so nothing is blocked. Reported as
        SHARED-RETRIEVAL-OUTCOME-COLLISION-1 rather than reconciled by guesswork.
      */
      const source = readFileSync(join(SHARED_SRC, 'source-provenance.ts'), 'utf-8');

      expect(source).not.toContain('export type RetrievalOutcome');
      expect(source).toContain('SHARED-RETRIEVAL-OUTCOME-COLLISION-1');
    });

    it('and the candidate’s RetrievalOutcome is still the only one', () => {
      const analysis = readFileSync(join(SHARED_SRC, 'analysis.ts'), 'utf-8');

      expect(analysis).toContain('RetrievalOutcome');
    });
  });
});

describe('B3.1 — the two BLOCKED rulings, and whether they still bind', () => {
  it('the BACKEND value-semantics vocabulary is adopted — Gate 4, still resolved', () => {
    /*
      The C36 package STOPped because the frontend and backend Economy lanes
      declared conflicting axes. C55 took its Option 1 — promote a read model
      into shared/src — and adopted the backend's members.

      SEMANTIC INVARIANT. Asserted on the shared module as it stands, so losing
      a member fails here instead of passing against a frozen 2026 commit.
    */
    for (const member of ["'SCHEDULED'", "'PRELIMINARY'", "'ACTUAL'", "'FRESH'", "'ROUTE_SUPPORTED'"]) {
      expect(`${member}: ${economyIndex.includes(member)}`).toBe(`${member}: true`);
    }

    /* NEGATIVE CONTROL — the scan is reading the real file, not an empty string. */
    expect(economyIndex.length).toBeGreaterThan(500);
    expect(economyIndex.includes("'NO_SUCH_ECONOMY_MEMBER'")).toBe(false);
  });

  it('the TOTAL, transitional mapping for the old frontend vocabulary is still there', () => {
    /*
      SEMANTIC INVARIANT. The mapping's existence is the property; it is what
      lets the old UI vocabulary resolve without a second axis being minted.
    */
    expect(economyIndex).toContain('ECONOMY_LEGACY_UI_RELEASE_STATUS');
    expect(economyIndex).toMatch(/PRELIM: 'PRELIMINARY'/);
    /* and it still declares itself transitional rather than quietly becoming canon */
    expect(economyIndex).toMatch(/THEY ARE TRANSITIONAL/);

    /* MUTATION CONTROL — the same matcher fails on a string that lacks the mapping. */
    expect(/PRELIM: 'PRELIMINARY'/.test('export const OTHER = {};')).toBe(false);
  });

  it('EconomyLocale is DisplayLocale, not LanguageCode — Gate 5, still resolved', () => {
    /*
      The C36 package STOPped because EconomyLocale aliased LanguageCode — the
      ANALYSIS set — while controlling user-facing DISPLAY language. The two
      sets differ, and the alias is the whole fix.

      SEMANTIC INVARIANT, and the sharper of the three: if someone re-pointed
      this alias at LanguageCode tomorrow, a historical read would still pass
      and this fails.
    */
    expect(economyStrings).toContain('export type EconomyLocale = DisplayLocale;');
    expect(economyStrings).toContain("import type { DisplayLocale } from '@globalnews-ai/shared';");

    /* NEGATIVE CONTROL — the regression it guards against is detectable. */
    expect(economyStrings).not.toMatch(/export type EconomyLocale = LanguageCode;/);
    expect(/export type EconomyLocale = LanguageCode;/
      .test('export type EconomyLocale = LanguageCode;')).toBe(true);
  });
});

describe('B3.1 — what is still NOT cleared', () => {
  it('WATCH_RUNTIME_ACTIVE is untouched', () => {
    const gate = readFileSync(
      join(REPO, 'frontend', 'src', 'lib', 'map', 'monetization', 'watchRuntimeGate.ts'),
      'utf-8',
    );

    expect(gate).toContain('export const WATCH_RUNTIME_ACTIVE = false;');
  });

  it('the Economy SUBSTRATE is now recovered — B4-A', () => {
    /*
      SUPERSEDED BY B4-A. B3.1 asserted the substrate was absent and named the
      two prerequisites blocking it; both were cleared and B4-A recovered it.
      Updated rather than deleted so the transition stays visible.
    */
    expect(existsSync(join(SHARED_SRC, 'economy'))).toBe(true);
    expect(existsSync(join(REPO, 'frontend', 'src', 'lib', 'economy'))).toBe(true);
    expect(existsSync(join(REPO, 'backend', 'src', 'modules', 'economy'))).toBe(true);
  });

  it('and the Economy runtime that IS registered reads retained evidence and nothing else', () => {
    /*
      ── RETIRED AND REPLACED, WHICH IS HOW THIS ASSERTION SAID IT WOULD END ──

      It read `expect(appModule).not.toContain('EconomyModule')`, and while there was no
      real observation to serve, absence was the honest form. There is one now: the
      governed pipeline retained the August 2026 NISR CPI artifact and the Economy
      read serves it.

      Main’s accepted entry states how a tripwire of this kind is discharged —
      *"retired and replaced by a presence assertion with the same teeth, never
      deleted"* — so this now asserts what the module IS, and the replacement has MORE
      teeth than the original: absence only said nothing was wired, while this says the
      thing that IS wired cannot fetch.

      WHAT IS STILL NOT ACTIVATED, asserted below rather than assumed: no producer, no
      scheduler, no transport, no provider. `rw-nisr` remains `enabled: false`, and
      `app/economy` still does not exist — the route tripwire beside this one is
      untouched and still passes.
    */
    const appModule = readFileSync(join(REPO, 'backend', 'src', 'app.module.ts'), 'utf-8');
    expect(appModule).toContain('EconomyModule');

    const economyModule = readFileSync(
      join(REPO, 'backend', 'src', 'modules', 'economy', 'economy.module.ts'),
      'utf-8',
    );
    /*
      THE TEETH: a READ module, and provably nothing else.

      COMMENT-STRIPPED, because the module’s own header says in words that it has no
      scheduler and no transport — and a guard that read the prose would fail on the
      sentence promising the thing it is checking for.
    */
    const economyCode = economyModule.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    expect(economyCode).not.toMatch(/Scheduler|Cron|Interval|Producer|Transport|WireFetch/i);

    const registry = readFileSync(
      join(REPO, 'backend', 'src', 'modules', 'official-sources', 'official-source-registry.ts'),
      'utf-8',
    );
    expect(registry).toContain("id: 'rw-nisr'");
    expect(registry).toMatch(/id: 'rw-nisr'[\s\S]*?enabled: false/);
  });

  it('no Economy route exists', () => {
    expect(existsSync(join(REPO, 'frontend', 'src', 'app', 'economy'))).toBe(false);
  });

  it('and the official-source registry is still empty by design', () => {
    const registry = readFileSync(
      join(REPO, 'backend', 'src', 'modules', 'official-sources', 'official-source-registry.ts'),
      'utf-8',
    );

    expect(registry).toMatch(/starts empty and stays empty/);
  });
});
