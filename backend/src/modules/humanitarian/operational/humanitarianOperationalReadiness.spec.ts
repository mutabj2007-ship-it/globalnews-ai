import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HUMANITARIAN_SOURCE_RULINGS,
  RUNTIME_PERMITTING_VERDICT,
  SOURCE_ACTIVATION_VERDICTS,
} from '../source-activation.ruling';
import { READER_CLEARED_SOURCE_IDS } from '../reader-clearance.ruling';
import {
  READINESS_FOR_VERDICT,
  READINESS_REQUIREMENT,
  SOURCE_READINESS_STATES,
  assertReadinessMappingIsTotalAndInjective,
  deriveSourceReadiness,
} from './humanitarian-operational.readiness';
import { HumanitarianOperationalService } from './humanitarian-operational.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * READINESS — DERIVED FROM E1, TOTAL, INJECTIVE, AND ACTIONABLE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * HUMANITARIAN-F-OPS-R2 asks for readiness covering three named situations. The
 * tests below check the three, and then check the property that makes them safe:
 * that the other three verdicts are mapped too, so none of them can arrive at an
 * operator as a default.
 */

const status = new HumanitarianOperationalService().status();
const byId = Object.fromEntries(status.sources.map((s) => [s.sourceId, s]));

describe('READINESS IS A TOTAL, INJECTIVE FUNCTION OF E1’s VERDICT', () => {
  it('the mapping is total and injective, proven against E1’s own vocabulary', () => {
    expect(() => assertReadinessMappingIsTotalAndInjective()).not.toThrow();
    expect(Object.keys(READINESS_FOR_VERDICT).sort()).toEqual(
      [...SOURCE_ACTIVATION_VERDICTS].sort(),
    );
    expect(new Set(Object.values(READINESS_FOR_VERDICT)).size).toBe(
      SOURCE_ACTIVATION_VERDICTS.length,
    );
  });

  it('every declared readiness value is reachable from some verdict — no dead vocabulary', () => {
    const reachable = new Set(SOURCE_ACTIVATION_VERDICTS.map(deriveSourceReadiness));
    for (const state of SOURCE_READINESS_STATES) expect(reachable.has(state)).toBe(true);
  });

  it('EVERY READINESS NAMES THE NEXT ACTION — "not ready" with no action is unactionable', () => {
    for (const state of SOURCE_READINESS_STATES) {
      expect(typeof READINESS_REQUIREMENT[state]).toBe('string');
      expect(READINESS_REQUIREMENT[state].length).toBeGreaterThan(40);
    }
  });

  it('and says which of them are NOT the operator’s to fix', () => {
    /* A rights grant and an activation clearance are E1's and the Product Owner's. */
    expect(READINESS_REQUIREMENT.RIGHTS_CONFIRMATION_MISSING).toMatch(/not an operator action/i);
    expect(READINESS_REQUIREMENT.CREDENTIAL_MISSING).toMatch(/never be invented or hard-coded/i);
  });

  it('only E1’s runtime verdict yields RUNTIME_CLEARED', () => {
    for (const verdict of SOURCE_ACTIVATION_VERDICTS) {
      expect(deriveSourceReadiness(verdict) === 'RUNTIME_CLEARED').toBe(
        verdict === RUNTIME_PERMITTING_VERDICT,
      );
    }
  });

  it('DEV CAPTURE IS ITS OWN READINESS, never folded into cleared', () => {
    expect(deriveSourceReadiness('CLEARED_FOR_DEV_CAPTURE')).toBe('DEV_CAPTURE_ONLY');
    expect(deriveSourceReadiness('CLEARED_FOR_DEV_CAPTURE')).not.toBe('RUNTIME_CLEARED');
    expect(READINESS_REQUIREMENT.DEV_CAPTURE_ONLY).toMatch(/not cleared/i);
  });
});

describe('THE THREE SITUATIONS R2 NAMED, AS E1 ACTUALLY RULES THEM TODAY', () => {
  it('ReliefWeb: CREDENTIAL MISSING', () => {
    expect(byId.RELIEFWEB.e1Verdict).toBe('CREDENTIAL_REQUIRED');
    expect(byId.RELIEFWEB.readiness).toBe('CREDENTIAL_MISSING');
  });

  it('Copernicus: PROTECTION AUTHORITY MISSING', () => {
    expect(byId.COPERNICUS_EMS.e1Verdict).toBe('PROTECTION_AUTHORITY_REQUIRED');
    expect(byId.COPERNICUS_EMS.readiness).toBe('PROTECTION_AUTHORITY_MISSING');
  });

  /*
    GDACS — THE ONE DIVERGENCE FROM THE BRIEF'S WORDING, ASSERTED RATHER THAN
    SMOOTHED OVER. R2's contract says "GDACS dev-only". E1's R1 ruling did say
    CLEARED_FOR_DEV_CAPTURE; E1's R2 ruling moved GDACS to
    RIGHTS_CONFIRMATION_REQUIRED after the dev capture was exercised and produced
    a rights fact pointing away from runtime. Source authority is E1's, so this
    test asserts E1's verdict and the readiness derived from it, and separately
    that DEV_CAPTURE_ONLY remains a live, reachable value — held by no source.
  */
  it('GDACS: RIGHTS CONFIRMATION MISSING, which is E1 R2 and not the brief’s wording', () => {
    expect(byId.GDACS.e1Verdict).toBe('RIGHTS_CONFIRMATION_REQUIRED');
    expect(byId.GDACS.readiness).toBe('RIGHTS_CONFIRMATION_MISSING');
    expect(byId.GDACS.readiness).not.toBe('DEV_CAPTURE_ONLY');
    /* and the surface never implies a reader may see it: no source is reader-cleared */
    expect([...READER_CLEARED_SOURCE_IDS]).toEqual([]);
  });

  it('NO SOURCE IS READY FOR RUNTIME, and none is reported RUNNING', () => {
    for (const row of status.sources) {
      expect(row.readiness).not.toBe('RUNTIME_CLEARED');
      expect(row.activation).toBe('NOT_CLEARED');
    }
  });
});

describe('READINESS AND BLOCKING CONDITIONS ARE READ, NEVER RESTATED', () => {
  it('each row’s readiness is exactly the mapping applied to E1’s verdict', () => {
    for (const row of status.sources) {
      expect(row.readiness).toBe(
        deriveSourceReadiness(HUMANITARIAN_SOURCE_RULINGS[row.sourceId].verdict),
      );
      expect(row.readinessRequires).toBe(READINESS_REQUIREMENT[row.readiness]);
    }
  });

  it('BLOCKING CONDITIONS ARE E1’s ARRAY ITSELF — identity, not a copy that could drift', () => {
    for (const row of status.sources) {
      expect(row.blockingConditions).toBe(
        HUMANITARIAN_SOURCE_RULINGS[row.sourceId].blockingConditions,
      );
      expect(row.blockingConditions.length).toBeGreaterThan(0);
    }
  });

  it('the service names no readiness literal of its own', () => {
    const body = readFileSync(join(__dirname, 'humanitarian-operational.service.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const state of SOURCE_READINESS_STATES) expect(body).not.toContain(`'${state}'`);
    /* positive control: the stripped body is still the service */
    expect(body).toContain('deriveSourceReadiness');
  });
});

describe('PARSER REFUSALS ARE A SEPARATE AXIS FROM WITHHOLDS AND FROM SOURCE ERRORS', () => {
  it('all three exist per source, and all three are NOT_INSTRUMENTED for distinct reasons', () => {
    for (const row of status.sources) {
      const reasons = [row.withholdReasons, row.parserRefusals, row.sourceErrors].map((fact) => {
        expect(fact.state).toBe('NOT_INSTRUMENTED');
        return fact.state === 'NOT_INSTRUMENTED' ? fact.because : '';
      });
      expect(new Set(reasons).size).toBe(3);
    }
  });

  it('the parser-refusal reason names the sink that emits without storing', () => {
    const fact = byId.COPERNICUS_EMS.parserRefusals;
    expect(fact.state).toBe('NOT_INSTRUMENTED');
    if (fact.state === 'NOT_INSTRUMENTED') {
      expect(fact.because).toMatch(/sink/i);
      expect(fact.because).toMatch(/stores no row|not persisted|stores nothing/i);
    }
  });

  it('and it never serialises as 0', () => {
    const serialised = JSON.stringify(status);
    expect(serialised).not.toMatch(/"parserRefusals":\s*0/);
    expect(serialised).not.toMatch(/"parserRefusals":\s*\[\]/);
  });
});
