import {
  ADMIN_ROLES,
  ALL_CAPABILITIES,
  CAPABILITIES,
  ROLE_CAPABILITIES,
  capabilitiesFor,
  hasCapability,
  parseAdminRole,
  type AdminRoleName,
  type Capability,
} from './capabilities';

/**
 * F1.a — the role matrix is EXECUTED here, never pattern-matched.
 *
 * The table below is transcribed independently from the approved
 * Claude Design Admin Platform role matrix. It is deliberately NOT
 * derived from ROLE_CAPABILITIES, so an edit to the implementation
 * cannot silently move the goalposts: all 36 cells are asserted.
 */
const APPROVED_MATRIX: ReadonlyArray<readonly [Capability, boolean, boolean, boolean, boolean]> = [
  //                                  SUPER  ADMIN  SUPPORT ANALYST
  [CAPABILITIES.AnalyticsView, true, true, true, true],
  [CAPABILITIES.NewsManage, true, true, false, false],
  [CAPABILITIES.ProviderConfigure, true, false, false, false],
  [CAPABILITIES.PaymentAction, true, true, false, false],
  [CAPABILITIES.KsefSubmit, true, true, false, false],
  [CAPABILITIES.TaxSettings, true, false, false, false],
  [CAPABILITIES.AccessManage, true, false, false, false],
  [CAPABILITIES.SupportHandle, true, true, true, false],
  [CAPABILITIES.EvidenceExport, true, true, false, true],
];

const COLUMN: ReadonlyArray<AdminRoleName> = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ANALYST'];

describe('admin capability model', () => {
  it('defines exactly the four approved roles, in the approved order', () => {
    expect(ADMIN_ROLES).toEqual(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ANALYST']);
  });

  it('defines exactly nine capabilities — one per row of the approved matrix', () => {
    expect(ALL_CAPABILITIES).toHaveLength(APPROVED_MATRIX.length);
    expect([...ALL_CAPABILITIES].sort()).toEqual(APPROVED_MATRIX.map(([c]) => c).sort());
  });

  describe('all 36 cells of the approved role matrix', () => {
    APPROVED_MATRIX.forEach((row) => {
      const [capability, ...expected] = row;

      COLUMN.forEach((role, index) => {
        const allowed = expected[index];

        it(`${role} ${allowed ? 'HAS' : 'does NOT have'} ${capability}`, () => {
          expect(hasCapability(role, capability)).toBe(allowed);
          expect(capabilitiesFor(role).includes(capability)).toBe(allowed);
        });
      });
    });
  });

  it('grants no capability beyond the approved matrix to any role', () => {
    COLUMN.forEach((role, index) => {
      const expected = APPROVED_MATRIX.filter((row) => row[index + 1]).map(([c]) => c);
      expect([...capabilitiesFor(role)].sort()).toEqual([...expected].sort());
    });
  });

  it('LOCKS the deliberate asymmetry: ANALYST may export evidence, SUPPORT may not', () => {
    // This cell reproduces the approved design exactly and is
    // CTO-confirmed. If a future change "tidies" it, this fails.
    expect(hasCapability('ANALYST', CAPABILITIES.EvidenceExport)).toBe(true);
    expect(hasCapability('SUPPORT', CAPABILITIES.EvidenceExport)).toBe(false);
  });

  it('SUPER_ADMIN holds every capability and no role except SUPER_ADMIN does', () => {
    expect([...capabilitiesFor('SUPER_ADMIN')].sort()).toEqual([...ALL_CAPABILITIES].sort());

    (['ADMIN', 'SUPPORT', 'ANALYST'] as const).forEach((role) => {
      expect(capabilitiesFor(role).length).toBeLessThan(ALL_CAPABILITIES.length);
    });
  });

  describe('fail-closed behaviour', () => {
    it('a null role has NO capabilities at all', () => {
      expect(capabilitiesFor(null)).toEqual([]);
      ALL_CAPABILITIES.forEach((capability) => {
        expect(hasCapability(null, capability)).toBe(false);
      });
    });

    it('an unrecognised role string parses to null, never to a role', () => {
      ['', 'super_admin', 'ROOT', 'OWNER', 'NONE', 'admin', 'SUPER-ADMIN', ' ADMIN'].forEach(
        (value) => {
          expect(parseAdminRole(value)).toBeNull();
        },
      );
    });

    it('null and undefined parse to null', () => {
      expect(parseAdminRole(null)).toBeNull();
      expect(parseAdminRole(undefined)).toBeNull();
    });

    it('each approved role string parses back to itself', () => {
      ADMIN_ROLES.forEach((role) => {
        expect(parseAdminRole(role)).toBe(role);
      });
    });

    it('database drift can only ever REMOVE privilege — an unknown value yields an empty capability set', () => {
      const parsed = parseAdminRole('FUTURE_ROLE_THIS_BUILD_DOES_NOT_KNOW');
      expect(parsed).toBeNull();
      expect(capabilitiesFor(parsed)).toEqual([]);
    });
  });

  it('the published matrix is frozen — a caller cannot mutate a role into new privilege', () => {
    expect(Object.isFrozen(ROLE_CAPABILITIES)).toBe(true);
    expect(Object.isFrozen(ROLE_CAPABILITIES.SUPPORT)).toBe(true);
    expect(() => {
      (ROLE_CAPABILITIES.SUPPORT as Capability[]).push(CAPABILITIES.TaxSettings);
    }).toThrow();
    expect(hasCapability('SUPPORT', CAPABILITIES.TaxSettings)).toBe(false);
  });
});
