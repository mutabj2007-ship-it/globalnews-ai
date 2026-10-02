import { readFileSync } from 'fs';
import { join } from 'path';
import {
  HUMANITARIAN_SOURCE_IDS,
  HUMANITARIAN_SOURCE_RULINGS,
  SOURCE_ACTIVATION_VERDICTS,
  RUNTIME_PERMITTING_VERDICT,
} from '../source-activation.ruling';
import { HUMANITARIAN_SOURCE_IDS as F_SOURCE_IDS } from './humanitarian-operational.contract';
import {
  HumanitarianOperationalService,
  deriveSourceActivation,
} from './humanitarian-operational.service';

/**
 * HUMANITARIAN CONVERGENCE (CTO ruling, F cleanup) — the Admin projection has ONE source
 * authority: E1's ruling. F measures implementation; E1 decides admission and activation.
 */
const code = (file: string) => readFileSync(join(__dirname, file), 'utf8');

describe('F derives its source registry and activation from E1', () => {
  const status = new HumanitarianOperationalService().status();

  it("F declares no source list of its own — the export IS E1's", () => {
    expect(F_SOURCE_IDS).toBe(HUMANITARIAN_SOURCE_IDS);
    for (const file of [
      'humanitarian-operational.contract.ts',
      'humanitarian-operational.service.ts',
    ]) {
      expect(code(file)).not.toMatch(/\[\s*'GDACS'\s*,\s*'RELIEFWEB'/);
    }
  });

  it("one row per E1 source, in E1 order, each carrying E1's verdict verbatim", () => {
    expect(status.sources.map((s) => s.sourceId)).toEqual([...HUMANITARIAN_SOURCE_IDS]);
    for (const row of status.sources) {
      expect(row.e1Verdict).toBe(HUMANITARIAN_SOURCE_RULINGS[row.sourceId].verdict);
      expect(row.e1RuledAt).toBe(HUMANITARIAN_SOURCE_RULINGS[row.sourceId].ruledAt);
    }
  });

  it('E1 R2 as ruled: GDACS rights-blocked, ReliefWeb credential, Copernicus protection — none active', () => {
    const byId = Object.fromEntries(status.sources.map((s) => [s.sourceId, s]));
    /* E1 R2: the dev capture was exercised; the operative GDACS verdict is now rights-blocked. */
    expect(byId.GDACS.e1Verdict).toBe('RIGHTS_CONFIRMATION_REQUIRED');
    expect(byId.RELIEFWEB.e1Verdict).toBe('CREDENTIAL_REQUIRED');
    expect(byId.COPERNICUS_EMS.e1Verdict).toBe('PROTECTION_AUTHORITY_REQUIRED');
    for (const row of status.sources) expect(row.activation).toBe('NOT_CLEARED');
  });

  it("only E1's runtime verdict lifts NOT_CLEARED, and even then nothing is reported RUNNING", () => {
    for (const verdict of SOURCE_ACTIVATION_VERDICTS) {
      expect(deriveSourceActivation(verdict)).toBe(
        verdict === RUNTIME_PERMITTING_VERDICT ? 'CLEARED_NOT_RUNNING' : 'NOT_CLEARED',
      );
    }
    /* dev capture is never runtime */
    expect(deriveSourceActivation('CLEARED_FOR_DEV_CAPTURE')).toBe('NOT_CLEARED');
  });

  it('still read-only: no write verb, no activation control, not registered in AppModule', () => {
    const controller = code('humanitarian-operational.controller.ts');
    ['@Post(', '@Put(', '@Patch(', '@Delete('].forEach((verb) =>
      expect(controller).not.toContain(verb),
    );
    const appModule = readFileSync(join(__dirname, '..', '..', '..', 'app.module.ts'), 'utf8');
    expect(appModule).not.toContain('HumanitarianOperationalModule');
  });
});
