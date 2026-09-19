/**
 * MAIN-MARKET-PLATFORM-1 — THE SHARED MARKET CONTRACT, MADE EXECUTABLE.
 *
 *     baseline  C37  37FDBB150AB1C5DF30D80B788C7094B9600779BE5613F592CE4C6889A48CC891
 *
 * Runs from the backend runner, so it exercises the COMPILED `shared/dist` a consumer imports.
 * Every absence claim carries a positive control: an absence test that cannot tell "nothing is
 * there" from "I looked in the wrong place" is not evidence.
 */
import {
  VINTAGE_PROVENANCE_KINDS,
  UNIT_AUTHORSHIP_KINDS,
  seamDeclarationIsHonest,
  MARKET_SUBJECT_DISPOSITIONS,
  MARKET_SUBJECT_TYPES_REUSED_AS_IS,
  MARKET_KEY_ENCODING_VERSION,
  marketProcurementIdentity,
  procurementPortalReferenceKey,
  PROCUREMENT_MERGE_AUTHORITIES,
  PROCUREMENT_REFERENCE_KINDS,
  PROCUREMENT_REFERENCE_KINDS_PRODUCIBLE_TODAY,
  PROCUREMENT_REFERENCE_PRODUCERS,
  procurementReferenceIsAuthorised,
  treatmentFor,
  PROCUREMENT_IDENTITY_TREATMENTS,
  PROCUREMENT_RENDERABLE_TREATMENTS,
  SECTOR_KEY_ENCODING_VERSION,
  sectorClassificationKey,
  sectorClassificationsEqual,
  PKD_MIGRATION_DEADLINE,
  COMMERCIAL_ENTITY_ROLES,
  PROCUREMENT_TO_COMPANY_JOIN,
  GLEIF_SUPPLIES_SECTOR_CODE,
  GLEIF_DIRECT_PARENT_WITH_LEI_SHARE,
  SECTOR_CLASSIFICATION_SCHEMES,
  SECTOR_SCHEME_CROSSWALKS,
  MARKET_WATCH_REGISTRATION_PROPOSAL,
  MARKET_CHANGE_STATES_PRODUCIBLE_TODAY,
  MARKET_CHANGE_STATE_PRODUCER_GAPS,
  MARKET_ARTIFACT_CLASSES,
  marketClassificationIsClaimScoped,
  MARKET_CORRIDOR_CAPABILITY,
  PRODUCIBLE_ROUTE_GEOMETRY,
  EQUITY_OR_INDEX_SOURCE_QUALIFIED,
  MARKET_RUNTIME_ENABLED_SUBJECTS,
  WATCH_CHANGE_STATES,
  WATCH_CHANGE_STATES_DERIVABLE_TODAY,
  WATCH_SUBJECT_TYPES_BY_SURFACE,
  ECONOMY_CORRIDOR_CAPABILITIES,
  ECONOMY_FIGURE_GAP_REASONS,
  ECONOMY_KEY_ENCODING_VERSION,
  type ProcurementReference,
  type StructuredObservationSeamDeclaration,
} from '@globalnews-ai/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MARKET_SRC = join(__dirname, '../../../shared/src/market/index.ts');
const ECONOMY_SRC = join(__dirname, '../../../shared/src/economy/index.ts');

function executableBody(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('1 · structured-observation seam — reuse, one added axis, no fork', () => {
  it('declares NO Market observation vocabulary — no Series, Period, Observation or ReleaseStatus', () => {
    const body = executableBody(MARKET_SRC);
    expect(body).not.toMatch(/(type|interface)\s+Market(Series|Period|Observation|ReleaseStatus|ValueKind|Freshness)\b/);
    expect(body).not.toMatch(/MARKET_(RELEASE_STATUSES|VALUE_KINDS|FRESHNESS_STATES)\s*=/);
    // POSITIVE CONTROL: the same search finds the Market types that ARE declared.
    expect(body).toMatch(/type\s+MarketArtifactClass\b/);
  });

  it('mints no second key encoding for observations — eco:1 stays the observation encoding', () => {
    expect(ECONOMY_KEY_ENCODING_VERSION).toBe('eco:1');
    expect(MARKET_KEY_ENCODING_VERSION).toBe('mkt:1');
    // mkt:1 keys PROCUREMENT identity only. No observation key function exists in the Market module.
    const body = executableBody(MARKET_SRC);
    expect(body).not.toMatch(/function\s+\w*[Oo]bservationKey\w*\s*\(/);
  });

  it('the accepted contract is not renamed or re-declared — Market imports it', () => {
    const economy = readFileSync(ECONOMY_SRC, 'utf8');
    expect(economy).toContain('export interface EconomyObservation');
    const body = readFileSync(MARKET_SRC, 'utf8');
    expect(body).toMatch(/import type \{[^}]*EconomyCorridorCapability[^}]*\} from '\.\.\/economy'/);
  });

  it('vintage provenance is a closed three-member axis, and the three are the measured ones', () => {
    expect(VINTAGE_PROVENANCE_KINDS).toEqual(['PUBLISHER_VINTAGE', 'PUBLISHER_CHANGED_AT', 'INGEST_SNAPSHOT']);
    expect(UNIT_AUTHORSHIP_KINDS).toEqual(['PUBLISHER_STATED', 'LOCALLY_ASSERTED']);
  });

  it('a source may not claim a publisher vintage it cannot retrieve history for', () => {
    const decl = (k: (typeof VINTAGE_PROVENANCE_KINDS)[number]): StructuredObservationSeamDeclaration => ({
      sourceId: 's', vintageProvenance: k, unitAuthorship: 'PUBLISHER_STATED', sourceKeyDimensions: ['a', 'b'],
    });
    expect(seamDeclarationIsHonest(decl('PUBLISHER_VINTAGE'), true)).toBe(true);
    expect(seamDeclarationIsHonest(decl('PUBLISHER_VINTAGE'), false)).toBe(false);
    // Eurostat, Comext and the Pink Sheet declare INGEST_SNAPSHOT and are honest without history.
    expect(seamDeclarationIsHonest(decl('INGEST_SNAPSHOT'), false)).toBe(true);
    expect(seamDeclarationIsHonest(decl('PUBLISHER_CHANGED_AT'), false)).toBe(true);
  });

  it('the accepted four gap reasons are reused, not extended', () => {
    expect(ECONOMY_FIGURE_GAP_REASONS.length).toBe(4);
    const body = executableBody(MARKET_SRC);
    expect(body).not.toMatch(/MARKET_FIGURE_GAP_REASONS\s*=/);
  });
});

describe('2 · six subjects, each ruled on its own evidence', () => {
  it('canonical placement is what the rulings are measured against', () => {
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.MARKET).toEqual(['INSTRUMENT', 'COMMODITY', 'ISSUER', 'EXPOSURE']);
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.ECONOMY).toContain('SECTOR');
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.CONFLICT).toContain('CORRIDOR');
  });

  it('only INSTRUMENT and COMMODITY are reused as-is', () => {
    expect(MARKET_SUBJECT_TYPES_REUSED_AS_IS).toEqual(['INSTRUMENT', 'COMMODITY']);
    expect(MARKET_SUBJECT_DISPOSITIONS.INSTRUMENT).toBe('REUSE_EXISTING_MARKET_TYPE');
    expect(MARKET_SUBJECT_DISPOSITIONS.COMMODITY).toBe('REUSE_EXISTING_MARKET_TYPE');
  });

  it('SECTOR is not minted as a Market subject type', () => {
    expect(MARKET_SUBJECT_DISPOSITIONS.SECTOR).toBe('NOT_A_SUBJECT_CLASSIFICATION_FACET');
    expect(MARKET_SUBJECT_TYPES_REUSED_AS_IS).not.toContain('SECTOR' as never);
  });

  it('ISSUER stays narrow — a buyer and a supplier are not issuers', () => {
    expect(MARKET_SUBJECT_DISPOSITIONS.COMMERCIAL_ENTITY).toBe('PARTICIPANT_FACET_ISSUER_STAYS_NARROW');
    expect(COMMERCIAL_ENTITY_ROLES).toContain('CONTRACTING_AUTHORITY');
    expect(COMMERCIAL_ENTITY_ROLES).toContain('SUPPLIER');
    expect(COMMERCIAL_ENTITY_ROLES).toContain('ISSUER');
  });

  it('CORRIDOR reuses the Economy corridor CONTRACT, not the Conflict subject label', () => {
    expect(MARKET_SUBJECT_DISPOSITIONS.CORRIDOR).toBe('REUSE_ECONOMY_CORRIDOR_CONTRACT');
    expect(ECONOMY_CORRIDOR_CAPABILITIES).toContain(MARKET_CORRIDOR_CAPABILITY);
  });

  it('PROCUREMENT_OPPORTUNITY is genuinely new and is not registered here', () => {
    expect(MARKET_SUBJECT_DISPOSITIONS.PROCUREMENT_OPPORTUNITY).toBe('NEW_SUBJECT_TYPE_REQUIRED');
    const registered = Object.values(WATCH_SUBJECT_TYPES_BY_SURFACE).flat();
    expect(registered).not.toContain('PROCUREMENT_OPPORTUNITY' as never);
  });
});

describe('3 · procurement identity — C-15 enforced by absence', () => {
  const ref = (over: Partial<ProcurementReference> = {}): ProcurementReference => ({
    kind: 'AMENDS', fromIdentity: 'a', toIdentity: 'b',
    authority: 'DOCUMENTED_AMENDMENT_OR_SUCCESSOR_CHAIN', evidenceRefs: ['ev:1'], ...over,
  });

  it('NO SIMILARITY, SCORE OR CONFIDENCE FIELD EXISTS — AI similarity cannot be recorded as merge authority', () => {
    const body = executableBody(MARKET_SRC);
    expect(body).not.toMatch(/readonly\s+(score|similarity|confidence|matchStrength|probability|likelihood)\b/i);
    expect(body).not.toMatch(/function\s+\w*(similar|match|score)\w*\s*\(/i);
    // POSITIVE CONTROL: the same searches find the predicate that IS present.
    expect(body).toMatch(/function\s+procurementReferenceIsAuthorised\s*\(/);
  });

  it('internal canonical identity is minted from OUR tuple, never from a portal string', () => {
    const id = marketProcurementIdentity({ jurisdiction: 'PL', contractingAuthorityRef: 'auth-1', canonicalDiscriminator: 'd1' });
    expect(id.startsWith('mkt:1:')).toBe(true);
    expect(id).not.toContain('2026/S');
    // Length-prefixed: a separator inside a part cannot collide with a boundary.
    const a = marketProcurementIdentity({ jurisdiction: 'PL:X', contractingAuthorityRef: 'a', canonicalDiscriminator: 'd' });
    const b = marketProcurementIdentity({ jurisdiction: 'PL', contractingAuthorityRef: 'X:a', canonicalDiscriminator: 'd' });
    expect(a).not.toBe(b);
  });

  it('a portal reference is not an identity, and an absent version is not version 1', () => {
    const withV = procurementPortalReferenceKey({ portalId: 'TED', noticeId: 'N1', noticeVersion: '01' });
    const noV = procurementPortalReferenceKey({ portalId: 'TED', noticeId: 'N1' });
    expect(withV).not.toBe(noV);
    // Two portals publishing the same notice id are different references.
    expect(procurementPortalReferenceKey({ portalId: 'WB_PROCNOTICES', noticeId: 'N1' })).not.toBe(noV);
  });

  it('the four deterministic merge authorities are closed, and the five relationships are closed', () => {
    expect(PROCUREMENT_MERGE_AUTHORITIES.length).toBe(4);
    expect(PROCUREMENT_REFERENCE_KINDS).toEqual(['POSSIBLY_RELATED', 'AMENDS', 'SUPERSEDES', 'REISSUES', 'CROSS_PORTAL_NOTICE']);
  });

  it('REISSUES and CROSS_PORTAL_NOTICE are declared and have NO producer; only TED-derived kinds do', () => {
    expect(PROCUREMENT_REFERENCE_KINDS_PRODUCIBLE_TODAY).toEqual(['AMENDS', 'SUPERSEDES']);
    expect(PROCUREMENT_REFERENCE_PRODUCERS.REISSUES).toContain('NO PRODUCER IN THE P0 SET');
    expect(PROCUREMENT_REFERENCE_PRODUCERS.CROSS_PORTAL_NOTICE).toContain('NO PRODUCER');
    for (const kind of PROCUREMENT_REFERENCE_KINDS) {
      expect(PROCUREMENT_REFERENCE_PRODUCERS[kind].length).toBeGreaterThan(0);
    }
  });

  it('a merge-bearing reference must cite an authority; POSSIBLY_RELATED must NOT', () => {
    expect(procurementReferenceIsAuthorised(ref())).toBe(true);
    expect(procurementReferenceIsAuthorised(ref({ authority: undefined }))).toBe(false);
    expect(procurementReferenceIsAuthorised(ref({ kind: 'POSSIBLY_RELATED', authority: undefined }))).toBe(true);
    // The half an implementer would erode first: POSSIBLY_RELATED carrying an authority.
    expect(procurementReferenceIsAuthorised(ref({ kind: 'POSSIBLY_RELATED' }))).toBe(false);
    expect(procurementReferenceIsAuthorised(ref({ evidenceRefs: [] }))).toBe(false);
  });

  it('merged and merely-related are two visibly different treatments', () => {
    expect(treatmentFor(ref())).toBe('MERGED_IDENTITY');
    expect(treatmentFor(ref({ kind: 'POSSIBLY_RELATED', authority: undefined }))).toBe('MERELY_RELATED');
  });
});

describe('4 · commercial entity — a facet and a reference, not a company database', () => {
  it('declares no company identity system — no companyId, no resolver, no merge', () => {
    const body = executableBody(MARKET_SRC);
    expect(body).not.toMatch(/readonly\s+(companyId|organizationId|organisationId)\b/);
    expect(body).not.toMatch(/function\s+\w*(resolveCompany|mergeEntit|dedupe)\w*\s*\(/i);
    expect(body).toContain('readonly entityRef: string');
  });

  it('the register join key is the GLEIF PAIR, because either half alone identifies nothing', () => {
    const body = executableBody(MARKET_SRC);
    expect(body).toContain('readonly registrationAuthorityId?: string');
    expect(body).toContain('readonly registrationAuthorityEntityId?: string');
  });

  it('THE MEASURED NON-JOIN: TED buyer identity does not deterministically join to LEI', () => {
    expect(PROCUREMENT_TO_COMPANY_JOIN).toBe('NO_DETERMINISTIC_JOIN');
  });

  it('GLEIF supplies no sector code, so Market classification cannot come from it', () => {
    expect(GLEIF_SUPPLIES_SECTOR_CODE).toBe(false);
  });

  it('ownership coverage is stated at its real value, not the misleading headline', () => {
    expect(GLEIF_DIRECT_PARENT_WITH_LEI_SHARE).toBeCloseTo(0.04);
    expect(GLEIF_DIRECT_PARENT_WITH_LEI_SHARE).toBeLessThan(0.99);
  });

  it('no second relationship graph — Market declares no edge model of its own', () => {
    const body = executableBody(MARKET_SRC);
    expect(body).not.toMatch(/(type|interface)\s+Market(Edge|Relationship|Graph)\b/);
  });
});

describe('5 · sector namespace — three meanings, geography keeps its one', () => {
  it('GEOGRAPHY IS NOT RENAMED — Rwanda\'s Sector is still an administrative rung in canonical', () => {
    const tranche = readFileSync(join(__dirname, '../modules/geo/east-africa.tranche.ts'), 'utf8');
    expect(tranche).toContain("name: 'Sector'");
    expect(tranche).toMatch(/RWANDA'S SECTOR IS A REAL LEVEL/);
  });

  it('a Market sector is ALWAYS scheme-qualified — a bare sector string cannot be represented', () => {
    const body = executableBody(MARKET_SRC);
    expect(body).toMatch(/readonly scheme: SectorClassificationScheme;/);
    expect(body).not.toMatch(/readonly\s+sector\s*:\s*string/);
    expect(SECTOR_CLASSIFICATION_SCHEMES).toContain('NACE_REV2');
    expect(SECTOR_CLASSIFICATION_SCHEMES).toContain('PKD_2007');
    expect(SECTOR_CLASSIFICATION_SCHEMES).toContain('PKD_2025');
  });

  it('NO CROSSWALK EXISTS, and the empty array is the measurement', () => {
    expect(SECTOR_SCHEME_CROSSWALKS).toEqual([]);
  });
});

describe('6 · Watch — proposal only, and the same two-of-seven ceiling', () => {
  it('adds NO change state', () => {
    expect(WATCH_CHANGE_STATES.length).toBe(7);
    expect(MARKET_CHANGE_STATES_PRODUCIBLE_TODAY).toEqual([...WATCH_CHANGE_STATES_DERIVABLE_TODAY]);
  });

  it('registers nothing, and every blocked state names its missing capability', () => {
    const registered = Object.values(WATCH_SUBJECT_TYPES_BY_SURFACE).flat();
    for (const proposed of MARKET_WATCH_REGISTRATION_PROPOSAL.proposedNewSubjectTypes) {
      expect(registered).not.toContain(proposed as never);
    }
    expect(MARKET_WATCH_REGISTRATION_PROPOSAL.blockedBy.length).toBe(3);
    expect(Object.keys(MARKET_CHANGE_STATE_PRODUCER_GAPS).sort()).toEqual(
      ['DEVELOPING', 'DISPUTED', 'NEW', 'SIGNIFICANT_CHANGE', 'STABLE'],
    );
  });
});

describe('7 · source class — reuse, with no registry-derived assignment', () => {
  it('there is nowhere to record that a class came from the registry', () => {
    const body = executableBody(MARKET_SRC);
    const union = /export type MarketClassAssignment =([^;]*);/.exec(body);
    expect(union).not.toBeNull();
    expect(union![1]).not.toMatch(/'REGISTRY'|'INSTITUTION'|'AUTHORITY_CLASS'/);
    expect(union![1]).toContain("'ARTIFACT_INSPECTION'");
  });

  it('SourceType x EvidenceRole is reused, not replaced', () => {
    const body = executableBody(MARKET_SRC);
    expect(body).not.toMatch(/(type|interface)\s+Market(Provenance|SourceType|EvidenceRole)\b/);
    expect(body).toMatch(/readonly provenance\?: SourceProvenance/);
  });

  it('every artifact class is claim-scoped', () => {
    expect(MARKET_ARTIFACT_CLASSES).toContain('PROCUREMENT_NOTICE');
    expect(marketClassificationIsClaimScoped({
      artifactRef: 'a', artifactClass: 'PROCUREMENT_NOTICE', assignedFrom: 'ARTIFACT_INSPECTION',
      authoritativeForClaimRef: 'claim:terms',
    })).toBe(true);
    expect(marketClassificationIsClaimScoped({
      artifactRef: 'a', artifactClass: 'PROCUREMENT_NOTICE', assignedFrom: 'ARTIFACT_INSPECTION',
      authoritativeForClaimRef: '  ',
    })).toBe(false);
  });
});

describe('8 · measured data limits, preserved as constants', () => {
  it('ENDPOINT_ONLY, no route geometry, no qualified equity or index source', () => {
    expect(MARKET_CORRIDOR_CAPABILITY).toBe('ENDPOINT_ONLY');
    expect(PRODUCIBLE_ROUTE_GEOMETRY).toBe(false);
    expect(EQUITY_OR_INDEX_SOURCE_QUALIFIED).toBe(false);
  });

  it('no Market subject is runtime-enabled, and no provider is activated by this contract', () => {
    expect(MARKET_RUNTIME_ENABLED_SUBJECTS).toEqual([]);
    const body = executableBody(MARKET_SRC);
    expect(body).not.toMatch(/https?:\/\//);
    expect(body).not.toMatch(/apiKey|API_KEY|fetch\(|axios/);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * R1 · E1-MARKET-PLATFORM-1 CORRECTIONS
 * ═══════════════════════════════════════════════════════════════════════════ */
describe('R1 · M-4 · treatment cannot be obtained from an invalid reference', () => {
  const ref = (over: Partial<ProcurementReference> = {}): ProcurementReference => ({
    kind: 'AMENDS', fromIdentity: 'a', toIdentity: 'b',
    authority: 'DOCUMENTED_AMENDMENT_OR_SUCCESSOR_CHAIN', evidenceRefs: ['ev:1'], ...over,
  });

  it('1 · THE DEFECT: AMENDS with an authority but NO evidence no longer merges', () => {
    const r = ref({ evidenceRefs: [] });
    expect(procurementReferenceIsAuthorised(r)).toBe(false);
    expect(treatmentFor(r)).toBe('UNAUTHORISED');
    expect(treatmentFor(r)).not.toBe('MERGED_IDENTITY');
  });

  it('2 · THE DEFECT: POSSIBLY_RELATED carrying a deterministic authority no longer merges', () => {
    const r = ref({ kind: 'POSSIBLY_RELATED' });
    expect(procurementReferenceIsAuthorised(r)).toBe(false);
    expect(treatmentFor(r)).toBe('UNAUTHORISED');
  });

  it('3 · a malformed SUPERSEDES is refused too', () => {
    expect(treatmentFor(ref({ kind: 'SUPERSEDES', authority: undefined }))).toBe('UNAUTHORISED');
    expect(treatmentFor(ref({ kind: 'SUPERSEDES', evidenceRefs: [] }))).toBe('UNAUTHORISED');
  });

  it('4 · EXHAUSTIVE: no reference rejected by the predicate can reach MERGED_IDENTITY', () => {
    const authorities = [undefined, ...PROCUREMENT_MERGE_AUTHORITIES];
    const evidences = [[], ['ev:1']];
    let rejected = 0;
    for (const kind of PROCUREMENT_REFERENCE_KINDS) {
      for (const authority of authorities) {
        for (const evidenceRefs of evidences) {
          const r = ref({ kind, authority, evidenceRefs }) as ProcurementReference;
          if (!procurementReferenceIsAuthorised(r)) {
            rejected++;
            expect(treatmentFor(r)).toBe('UNAUTHORISED');
          }
        }
      }
    }
    // POSITIVE CONTROL: the sweep actually exercised rejected references.
    expect(rejected).toBeGreaterThan(0);
  });

  it('5 · the two legitimate treatments are unchanged, and only they are renderable', () => {
    expect(treatmentFor(ref())).toBe('MERGED_IDENTITY');
    expect(treatmentFor(ref({ kind: 'POSSIBLY_RELATED', authority: undefined }))).toBe('MERELY_RELATED');
    expect(PROCUREMENT_RENDERABLE_TREATMENTS).toEqual(['MERGED_IDENTITY', 'MERELY_RELATED']);
    expect(PROCUREMENT_IDENTITY_TREATMENTS).toContain('UNAUTHORISED');
  });

  it('6 · a caller that never validates first still cannot see a false merge', () => {
    // The whole point of the correction: no second call is required of the consumer.
    const invalid = ref({ evidenceRefs: [] });
    expect(treatmentFor(invalid)).not.toBe('MERGED_IDENTITY');
  });
});

describe('R1 · M-9 · sector identity is scheme-qualified', () => {
  it('7 · THE NAMED TRAP: PKD_2007 62.10.A !== PKD_2025 62.10.A', () => {
    const a = { scheme: 'PKD_2007' as const, code: '62.10.A' };
    const b = { scheme: 'PKD_2025' as const, code: '62.10.A' };
    expect(a.code === b.code).toBe(true);                       // the naive comparison says equal
    expect(sectorClassificationsEqual(a, b)).toBe(false);       // the canonical one does not
    expect(sectorClassificationKey(a)).not.toBe(sectorClassificationKey(b));
  });

  it('8 · same scheme and code ARE equal, so the primitive is not vacuously false', () => {
    const a = { scheme: 'NACE_REV2' as const, code: '62.10' };
    expect(sectorClassificationsEqual(a, { ...a })).toBe(true);
    expect(sectorClassificationKey(a)).toBe(sectorClassificationKey({ ...a }));
  });

  it('9 · different codes in one scheme are not equal', () => {
    expect(sectorClassificationsEqual({ scheme: 'PKD_2007', code: '62.10.A' }, { scheme: 'PKD_2007', code: '62.10.B' })).toBe(false);
  });

  it('10 · cross-scheme equivalence requires a REGISTERED authority, and there is none', () => {
    expect(SECTOR_SCHEME_CROSSWALKS).toEqual([]);
    for (const s1 of SECTOR_CLASSIFICATION_SCHEMES) {
      for (const s2 of SECTOR_CLASSIFICATION_SCHEMES) {
        if (s1 === s2) continue;
        expect(sectorClassificationsEqual({ scheme: s1, code: 'X' }, { scheme: s2, code: 'X' })).toBe(false);
      }
    }
  });

  it('11 · the key is length-prefixed and version-stamped', () => {
    expect(SECTOR_KEY_ENCODING_VERSION).toBe('sec:1');
    expect(sectorClassificationKey({ scheme: 'CPV', code: '45:00' })).not.toBe(
      sectorClassificationKey({ scheme: 'CPV', code: '45' } as never),
    );
    expect(sectorClassificationKey({ scheme: 'NACE_REV2', code: 'A' }).startsWith('sec:1:')).toBe(true);
  });

  it('12 · the migration window the trap lives in is still recorded', () => {
    expect(PKD_MIGRATION_DEADLINE).toBe('2026-12-31');
  });
});
