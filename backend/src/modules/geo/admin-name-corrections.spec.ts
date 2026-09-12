import {
  ADMIN_NAME_CORRECTIONS,
  SUPERSEDED_RWANDA_NAME_CORRECTIONS,
  admin2Coverage,
  adminNameCorrectionFor,
  verifyAdminNameCorrections,
} from './admin-name-corrections';
import { allAdmin2, allCities } from './geo-gazetteer';
import { searchGazetteer, lookupGeographyId } from './gazetteer-search';
import { nisrDistricts } from './rwanda-nisr.authority';

const node = (q: string, country = 'RW') => searchGazetteer(q, { country }).nodes;

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS FILE USED TO PROVE THE READ-TIME NAME CORRECTIONS. IT NOW PROVES THEY
 * ARE SUPERSEDED, AND THAT NOTHING REGRESSED ON THE WAY OUT.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The old contract: five GeoNames admin2 labels were patched at read time so a
 * Rwandan district slot showed "Ngoma" rather than "Kibungo", with the
 * settlement name kept as an alias and the basis declared on the node.
 *
 * The new contract: Rwanda's districts come from NISR, all thirty of them,
 * under their published names. There is nothing to patch, so the table is
 * empty — and the interesting question is no longer "did the patch apply" but
 * "did anything a reader could do before stop working". That is what the second
 * half of this file measures.
 */

/* ── 1 · THE CORRECTION AUTHORITY IS RETIRED ────────────────────────────── */

describe('1 · the read-time correction authority is retired, not merely unused', () => {
  it('the active table is empty', () => {
    expect(ADMIN_NAME_CORRECTIONS).toHaveLength(0);
    expect(adminNameCorrectionFor('RW.11.56')).toBeUndefined();
    expect(adminNameCorrectionFor('RW.15.24')).toBeUndefined();
  });

  it('the verifier still works and has nothing to verify', () => {
    /*
     * The MECHANISM is kept — nothing about the problem was Rwanda-specific and
     * the next country labelled from principal settlements will need it. What
     * is retired is the claim of authority over Rwandan district names.
     */
    expect(verifyAdminNameCorrections()).toEqual([]);
  });

  it('the five superseded pairs survive as audit history and are marked inactive', () => {
    expect(SUPERSEDED_RWANDA_NAME_CORRECTIONS.active).toBe(false);
    expect(SUPERSEDED_RWANDA_NAME_CORRECTIONS.supersededBy).toBe('NISR');
    expect(SUPERSEDED_RWANDA_NAME_CORRECTIONS.pairs).toHaveLength(5);
  });

  it('every name the patch used to assert is now supplied by the authority itself', () => {
    const official = new Set(nisrDistricts().map((district) => district.name.canonicalName));

    for (const [, , currentAdminName] of SUPERSEDED_RWANDA_NAME_CORRECTIONS.pairs) {
      expect(official.has(currentAdminName)).toBe(true);
    }
  });

  it('and so are the two the patch could NOT safely assert', () => {
    /*
     * Muhanga and Nyamagabe were deliberately left uncorrected: one needed a
     * canonical-spelling decision, the other had no verifiable exonym edge at
     * all, and inventing either would have been fabrication with a citation to
     * nothing. The authority closes both without a judgement call.
     */
    const official = new Set(nisrDistricts().map((district) => district.name.canonicalName));

    expect(official.has('Muhanga')).toBe(true);
    expect(official.has('Nyamagabe')).toBe(true);
  });
});

/* ── 2 · THE GEONAMES ROWS ARE STILL THERE, AND ARE NO LONGER DISTRICTS ── */

describe('2 · GeoNames keeps its settlements and loses the admin DB', () => {
  it('the artifact still carries Rwanda’s 21 admin2 rows — nothing was deleted', () => {
    const rwanda = allAdmin2().filter((unit) => unit.cc === 'RW');

    expect(rwanda.length).toBe(21);
    expect(admin2Coverage().find((entry) => entry.cc === 'RW')?.units).toBe(21);
  });

  it('but none of them is served as an administrative node any more', () => {
    for (const unit of allAdmin2().filter((candidate) => candidate.cc === 'RW')) {
      expect(lookupGeographyId(`admin2:${unit.code}`)).toBeNull();
    }
  });

  it('a district search returns the official unit, not a settlement-derived one', () => {
    const ngoma = node('Ngoma').find((candidate) => candidate.kind === 'admin2');

    expect(ngoma).toBeDefined();
    expect(ngoma!.name).toBe('Ngoma');
    expect(ngoma!.precision).toBe('DISTRICT');
    expect(ngoma!.provenance.admittedBy).toBe('official-authority');
    expect(ngoma!.provenance.labelSource).toContain('NISR');
    expect(ngoma!.provenance.attribution).toContain('NISR');
  });

  it('no served Rwandan node claims a settlement-derived label source', () => {
    for (const name of ['Ngoma', 'Karongi', 'Huye', 'Rusizi', 'Gicumbi', 'Muhanga', 'Nyamagabe']) {
      for (const candidate of node(name)) {
        if (candidate.kind === 'admin2' || candidate.kind === 'admin3') {
          expect(candidate.provenance.labelSource).not.toBe('derived-from-principal-settlement');
          expect(candidate.provenance.labelSource).not.toBe('current-name-corrected');
        }
      }
    }
  });
});

/* ── 3 · NO READER-VISIBLE REGRESSION ───────────────────────────────────── */

describe('3 · everything a reader could find before, they can still find', () => {
  it.each([
    ['Kibungo', 'Ngoma'],
    ['Byumba', 'Gicumbi'],
    ['Kibuye', 'Karongi'],
    ['Cyangugu', 'Rusizi'],
    ['Butare', 'Huye'],
  ])('%s still resolves as a settlement, and %s as the district', (settlement, district) => {
    /*
     * THIS IS THE REGRESSION THE REPLACEMENT COULD EASILY HAVE CAUSED. The old
     * patch made both names reach one admin2 node. With the patch gone, the two
     * names must reach TWO DIFFERENT PLACES — which is what they always were.
     * The town keeps its name; the district has its own.
     */
    const town = node(settlement).find((candidate) => candidate.kind === 'city');
    expect(town).toBeDefined();
    expect(town!.name).toBe(settlement);
    expect(town!.precision).toBe('CITY');

    const unit = node(district).find((candidate) => candidate.kind === 'admin2');
    expect(unit).toBeDefined();
    expect(unit!.name).toBe(district);
    expect(unit!.precision).toBe('DISTRICT');
  });

  it('no settlement was renamed, merged or destroyed', () => {
    const towns = new Set(allCities().filter((city) => city.cc === 'RW').map((city) => city.n));

    for (const [, settlement] of SUPERSEDED_RWANDA_NAME_CORRECTIONS.pairs) {
      expect(towns.has(settlement)).toBe(true);
    }
  });

  it('all 30 districts are findable by name', () => {
    for (const district of nisrDistricts()) {
      const found = node(district.name.canonicalName).find(
        (candidate) =>
          candidate.kind === 'admin2' && candidate.name === district.name.canonicalName,
      );

      expect(found).toBeDefined();
    }
  });
});
