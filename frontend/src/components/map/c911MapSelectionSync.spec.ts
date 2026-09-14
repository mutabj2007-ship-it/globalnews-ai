/**
 * ============================================================================
 * C911-V2 -- MAP COUNTRY / EVIDENCE STATE SYNCHRONIZATION
 * ============================================================================
 *
 * THE PRODUCTION DEFECT. On FULL /map, selecting RWANDA from JUMP TO
 * VALIDATION STATE changed the URL, the camera and the country highlight, and
 * the right intelligence rail went on showing "World view" over Poland's
 * evidence. No Rwanda evidence ever loaded.
 *
 * THE CAUSE. `onJump` dispatched `focus-bounds` and nothing else, so a jump
 * could only ever move a camera. Every other selection path -- a map click, a
 * search result, the context panel -- goes through `onSelectionChange`, which
 * is what resolves the country, clears the card filters and triggers the
 * retrieval that fills the rail. The jump path never joined it, and
 * `JumpTarget` carried no country identity for it to pass on.
 *
 * This is the M16 defect one route later: "selects nothing" implemented as
 * "changes nothing", leaving the previous country behind.
 *
 * These assertions read the real source, which is this repository's existing
 * convention for a wiring guarantee that cannot be exercised without a browser.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  DEPLOYMENT_JUMP_TARGETS,
  jumpTargetById,
  validationStates,
  VALIDATION_STATE_IDS,
} from '@/lib/map/navigation/breadcrumbs';
import { geographyTotals } from '@/lib/map/evidence/evidenceModel';
import type { EvidenceRecord } from '@/lib/map/evidence/evidenceModel';

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const shell = stripComments(
  readFileSync(join(__dirname, 'shell/GlobalMapShell.tsx'), 'utf-8'),
);
const page = stripComments(readFileSync(join(__dirname, 'MapPageClient.tsx'), 'utf-8'));

describe('C911-V2 -- a validation-state jump selects, it does not only fly', () => {
  describe('THE TARGET NOW CARRIES AN IDENTITY TO SELECT', () => {
    it('every COUNTRY-rung validation state names its country', () => {
      for (const target of validationStates()) {
        if (target.rung !== 'COUNTRY') continue;

        expect(typeof target.countryIso3).toBe('string');
        expect(target.countryIso3).toMatch(/^[A-Z]{3}$/);
      }
    });

    it('Rwanda -- the reported case -- resolves to RWA', () => {
      expect(jumpTargetById('rwanda')?.countryIso3).toBe('RWA');
    });

    it('Kenya and Poland resolve too, so this is not a Rwanda special case', () => {
      expect(jumpTargetById('kenya')?.countryIso3).toBe('KEN');
      expect(jumpTargetById('poland')?.countryIso3).toBe('POL');
    });

    it('a supranational region carries NO identity -- it is not selectable evidence geography', () => {
      expect(jumpTargetById('eastAfrica')?.countryIso3).toBeUndefined();
      expect(jumpTargetById('world')?.countryIso3).toBeUndefined();
      expect(jumpTargetById('africa')?.countryIso3).toBeUndefined();
      expect(jumpTargetById('europe')?.countryIso3).toBeUndefined();
    });

    it('the city rung carries no identity either', () => {
      expect(jumpTargetById('kigali')?.countryIso3).toBeUndefined();
    });

    it('the validation states are still the accepted four, in order', () => {
      expect(VALIDATION_STATE_IDS).toEqual(['rwanda', 'eastAfrica', 'kenya', 'poland']);
    });

    it('no jump target was added or removed', () => {
      expect(DEPLOYMENT_JUMP_TARGETS.map((t) => t.id)).toEqual([
        'world',
        'africa',
        'eastAfrica',
        'europe',
        'rwanda',
        'kenya',
        'poland',
        'kigali',
      ]);
    });
  });

  describe('THE JUMP HANDLER NOW CHANGES THE SELECTION', () => {
    const onJump = shell.slice(shell.indexOf('const onJump = useCallback'));
    const body = onJump.slice(0, onJump.indexOf('const onSelectSearchResult'));

    it('a COUNTRY target selects the country', () => {
      expect(body).toContain("onSelectionChange?.({ kind: 'COUNTRY', id: target.countryIso3 })");
    });

    it('a COUNTRY target does NOT also focus -- one camera commit, one history entry', () => {
      const countryBranch = body.slice(
        body.indexOf("target.rung === 'COUNTRY'"),
        body.indexOf('if (target.rung !== '),
      );

      expect(countryBranch).not.toContain('focus-bounds');
      expect(countryBranch).toContain('return;');
    });

    it('a target above country scale CLEARS an incompatible selection', () => {
      expect(body).toContain("target.rung !== 'CITY'");
      expect(body).toContain('onSelectionChange?.(null)');
    });

    it('the city rung is untouched -- Kigali does not clear Rwanda', () => {
      expect(body).toContain("target.rung !== 'CITY'");
    });

    it('a non-country target still focuses', () => {
      expect(body).toContain("dispatch({ kind: 'focus-bounds', bounds: target.bounds })");
    });

    it('the callback declares its new dependencies', () => {
      expect(body).toContain('[onSelectionChange, selection]');
    });
  });

  describe('THE SELECTION REACHES THE EVIDENCE RAIL', () => {
    it('one handler serves every selection path', () => {
      expect(page).toContain('function handleSpatialSelection(selection: MapSelection | null)');
      expect((page.match(/onSelectionChange=\{handleSpatialSelection\}/g) ?? []).length)
        .toBeGreaterThanOrEqual(1);
    });

    it('a COUNTRY selection triggers the retrieval that fills the rail', () => {
      const handler = page.slice(
        page.indexOf('function handleSpatialSelection'),
        page.indexOf('function handleCategoryChange'),
      );

      expect(handler).toContain('COUNTRIES.find');
      expect(handler).toContain('void loadCountry(country, ');
    });

    it('a null selection clears the country, so no stale evidence survives', () => {
      const handler = page.slice(
        page.indexOf('function handleSpatialSelection'),
        page.indexOf('function handleCategoryChange'),
      );

      expect(handler).toContain('if (selection === null)');
      expect(handler).toContain('setSelectedCountry(null)');
    });

    it('an honest no-evidence state is possible -- the rail reads the fetched response', () => {
      // `activeResponse` is null until the selected country's fetch lands, and
      // is the ONLY source the panel reads. There is no path that shows a
      // previous country's evidence under a new selection.
      expect(page).toContain('const activeResponse = selectedCountry ? cache[cacheKey(');
    });
  });
});

/**
 * C911-V2 (7) -- "WHY DOES POLAND APPEAR TWICE?"
 *
 * FINDING: it is NOT a true duplicate, and it must not be merged.
 *
 * `geographyTotals()` aggregates into a Map keyed by `record.geography.id`. A
 * Map cannot hold the same key twice, so two rows reading "Poland" CANNOT
 * share a geography id -- they are, necessarily, two DISTINCT governed
 * geography records that happen to carry the same display name (for example a
 * country-precision record and a finer record inside it).
 *
 * Collapsing them by country would destroy exactly the precision distinction
 * the ranked list exists to show, and each row already carries its own
 * precision and unverified markers. So the correct action here is NO CHANGE to
 * the aggregation, and these assertions pin that reasoning in place.
 */
describe('C911-V2 -- ranked evidence rows are per governed geography, not per country', () => {
  const record = (id: string, iso3: string, displayName: string): EvidenceRecord =>
    ({
      id: 'rec-' + id,
      geography: { id, countryIso3: iso3, displayName, precision: 'COUNTRY' },
      precision: 'COUNTRY',
      provenance: 'STATED',
      reportCount: 1,
      sourceCount: 1,
    }) as unknown as EvidenceRecord;

  it('two records sharing ONE geography id collapse to ONE row', () => {
    const totals = geographyTotals([
      record('country:POL', 'POL', 'Poland'),
      record('country:POL', 'POL', 'Poland'),
    ]);

    expect(totals).toHaveLength(1);
    expect(totals[0].recordCount).toBe(2);
  });

  it('two DISTINCT governed geographies in one country stay two rows', () => {
    const totals = geographyTotals([
      record('country:POL', 'POL', 'Poland'),
      record('region:pl-mazowieckie', 'POL', 'Poland'),
    ]);

    // Not a duplicate: two governed records, two rows. Merging them would be
    // the actual defect.
    expect(totals).toHaveLength(2);
    expect(new Set(totals.map((t) => t.geographyId)).size).toBe(2);
  });

  it('a row can never be emitted twice for the same geography id', () => {
    const totals = geographyTotals([
      record('country:POL', 'POL', 'Poland'),
      record('country:POL', 'POL', 'Poland'),
      record('country:RWA', 'RWA', 'Rwanda'),
      record('country:RWA', 'RWA', 'Rwanda'),
    ]);

    const ids = totals.map((t) => t.geographyId);

    expect(ids.length).toBe(new Set(ids).size);
  });
});
