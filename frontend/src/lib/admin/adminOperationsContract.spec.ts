import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ADMIN_OPERATIONS_REASON_MAX,
  ADMIN_OPERATIONS_REASON_MIN,
  DEPLOYMENT_ENVIRONMENTS,
} from './adminOperationsTypes';
import { ADMIN_OPERATIONS_API, ADMIN_API } from './adminRoutes';

/**
 * ADMIN OPERATIONS R1 — the mirror cannot drift from the backend.
 *
 * `adminOperationsTypes.ts` duplicates the backend contract because this
 * milestone may not change `shared/**`. Duplication is only safe while
 * something fails when the two disagree, which is what this file is.
 */
const BACKEND = join(__dirname, '../../../../backend/src/modules/admin/operations');
const contract = readFileSync(join(BACKEND, 'admin-operations.contract.ts'), 'utf8');
const environment = readFileSync(join(BACKEND, 'deployment-environment.ts'), 'utf8');
const controller = readFileSync(join(BACKEND, 'admin-operations.controller.ts'), 'utf8');
const service = readFileSync(join(BACKEND, 'admin-operations.service.ts'), 'utf8');

describe('ADMIN OPERATIONS R1 — client mirror matches the backend contract', () => {
  it('the deployment environments are the same set, in the same order', () => {
    const match = environment.match(
      /export const DEPLOYMENT_ENVIRONMENTS = \[([^\]]*)\] as const;/,
    );
    expect(match).not.toBeNull();
    const backendList = match![1]
      .split(',')
      .map((entry) => entry.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
    expect(backendList).toEqual([...DEPLOYMENT_ENVIRONMENTS]);
  });

  it('the reason bounds are the same numbers', () => {
    expect(contract).toContain(`ADMIN_OPERATIONS_REASON_MIN = ${ADMIN_OPERATIONS_REASON_MIN}`);
    expect(contract).toContain(`ADMIN_OPERATIONS_REASON_MAX = ${ADMIN_OPERATIONS_REASON_MAX}`);
  });

  it('every blocked reason the client renders exists in the backend union', () => {
    ['ENVIRONMENT_UNCONFIRMED', 'STORE_UNREADABLE', 'DEPLOYMENT_VALUE_NOT_TRUE'].forEach((reason) =>
      expect(contract).toContain(`'${reason}'`),
    );
  });

  it('every label key the client renders exists in the backend union', () => {
    ['pauseNewAiAnswers', 'stopAskR2Execution'].forEach((key) =>
      expect(contract).toContain(`'${key}'`),
    );
  });

  it('the client paths match the routes the controller declares', () => {
    expect(controller).toContain("@Controller('admin/operations')");
    expect(controller).toContain("@Post('switches/:name')");
    expect(ADMIN_OPERATIONS_API.state).toBe('/admin/operations');
    expect(ADMIN_OPERATIONS_API.setSwitch('ASK_R2_ENABLED')).toBe(
      '/admin/operations/switches/ASK_R2_ENABLED',
    );
  });

  it('THE WRITE IS NOT IN ADMIN_API — the read surface keeps its documented meaning', () => {
    const readSurface = Object.values(ADMIN_API);
    expect(readSurface).not.toContain('/admin/operations');
    readSurface.forEach((path) => expect(path.startsWith('/admin')).toBe(true));
  });

  it('the write requires the operations capability, and the read does not', () => {
    expect(controller).toContain('@RequireCapability(CAPABILITIES.OperationsControl)');
    expect(controller).toContain('@RequireCapability(CAPABILITIES.AnalyticsView)');
  });

  it('the write is CSRF-guarded on the server', () => {
    expect(controller).toContain('@UseGuards(CsrfGuard)');
  });

  it('THE SERVICE DOES NOT REIMPLEMENT THE SWITCH TRANSACTION OR THE AUDIT WRITE', () => {
    /* It must delegate to the landed service, not write either row itself. */
    expect(service).toContain('this.switches.set(');
    [
      'operationalSwitch.upsert',
      'operationalSwitchAudit.create',
      '$executeRaw',
      '$queryRaw',
    ].forEach((forbidden) => expect(service).not.toContain(forbidden));
  });

  it('POSITIVE CONTROL — the same scan finds those calls where they really live', () => {
    const landed = readFileSync(
      join(
        __dirname,
        '../../../../backend/src/modules/compute-controls/operational-switch.service.ts',
      ),
      'utf8',
    );
    expect(landed).toContain('operationalSwitch.upsert');
    expect(landed).toContain('operationalSwitchAudit.create');
  });

  it('the environment identity is validated, not merely displayed, and NODE_ENV is never the label', () => {
    expect(environment).toContain('isDeploymentEnvironment');
    /* nodeEnv is carried, but the confirmed branch never assigns it to `environment`. */
    expect(environment).toContain('nodeEnv');
    expect(environment).not.toMatch(/environment:\s*nodeEnv/);
  });
});
