import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client';
import type { PrismaService } from '../../../database/prisma.service';
import type { OperationalSwitchService } from '../../compute-controls/operational-switch.service';
import { AskObservationService } from '../../ask-observability/ask-observation.service';
import { AskObservationRetentionService } from '../../ask-observability/ask-observation-retention.service';
import { newAskObservationDraft } from '../../ask-observability/ask-observation.contract';
import { AdminAskIntelligenceService } from './admin-ask-intelligence.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK PUBLIC BETA OPERATIONS R1 — THE READER AGAINST A REAL POSTGRESQL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The unit suite drives this reader through a proxy, which proves the SHAPE of the response
 * and nothing about whether the queries are valid SQL. A `groupBy` over a nullable column, an
 * `aggregate` summing nullable integers, and a meter row whose units are a BIGINT are all
 * places where a query type-checks and then fails at runtime, so this suite runs the real
 * reader over real rows.
 *
 * NEVER FALLS BACK TO `DATABASE_URL`. Only a dedicated loopback database is accepted.
 */
const url = process.env.ASK_OBSERVATION_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/[a-z_]+@127\.0\.0\.1:\d+\/[a-z0-9_]+$/.test(url)) {
  throw new Error('Ask intelligence live tests require a dedicated loopback test database');
}
jest.setTimeout(30000);
const live = url ? describe : describe.skip;

live('R1 — the Ask Intelligence reader on PostgreSQL', () => {
  let db: PrismaClient;
  let writer: AskObservationService;
  let reader: AdminAskIntelligenceService;
  const written: string[] = [];

  const switches = {
    state: jest.fn(async (name: string) => ({
      name,
      deploymentValueIsLiteralTrue: true,
      row: { enabled: true, setBy: 'operator', setAt: new Date(), reason: null },
      effective: true,
      readable: true,
    })),
  } as unknown as OperationalSwitchService;

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    writer = new AskObservationService(
      db as unknown as PrismaService,
      new AskObservationRetentionService(db as unknown as PrismaService),
    );
    reader = new AdminAskIntelligenceService(db as unknown as PrismaService, switches, {
      get: () => undefined,
    } as unknown as ConfigService);

    const record = async (over: Record<string, unknown>): Promise<void> => {
      const operationId = randomUUID();
      written.push(operationId);
      await writer.record({
        operationId,
        ...newAskObservationDraft('ask-r2-adapter/1', 'en'),
        ...over,
      });
    };

    /* An answered Ask, with measured tokens and reporting evidence. */
    await record({
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      answerState: 'CURRENT_REPORTING',
      answerBasis: 'REQUIRED_EVIDENCE_OBTAINED',
      evidenceRolesRequested: ['REPORTING'],
      evidenceRolesObtained: ['REPORTING'],
      geographyCodes: ['KEN'],
      domains: ['security'],
      providerId: 'openai',
      providerCallCount: 1,
      modelInvocationCount: 1,
      aiExecuted: true,
      breakerOutcome: 'SUCCESS',
      promptTokens: 3000,
      completionTokens: 800,
      latencyMs: 4200,
      reportingItemCount: 2,
    });
    /* A capability the executor cannot supply: requested and never obtained. */
    await record({
      questionClass: 'OFFICIAL_DOCUMENT',
      terminalState: 'EXECUTABLE',
      answerState: 'CAPABILITY_UNAVAILABLE',
      answerBasis: 'EXECUTOR_NOT_WIRED',
      capabilityUnavailable: true,
      evidenceRolesRequested: ['OFFICIAL'],
      evidenceRolesMissing: ['OFFICIAL'],
      geographyCodes: ['POL'],
      domains: ['political'],
      latencyMs: 90,
    });
    /* A control refusal: no model, no provider call, a named failure code. */
    await record({
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      answerState: 'UNROUTED',
      answerBasis: 'NOT_ROUTED',
      failureCode: 'BUDGET_REFUSED:account-day',
      providerId: 'openai',
      askR2Enabled: true,
      askPublicComputeEnabled: true,
      latencyMs: 35,
    });
    await writer.countAccess('SIGNED_OUT_ATTEMPT');
  });

  afterAll(async () => {
    await db.askObservation.deleteMany({ where: { operationId: { in: written } } });
    await db.$disconnect();
  });

  it('every query runs, and the four groups come back populated', async () => {
    const response = await reader.askIntelligence();

    expect(response.health).not.toBeNull();
    expect(response.evidence).not.toBeNull();
    expect(response.operations).not.toBeNull();
    expect(response.improvement).not.toBeNull();
    expect(response.alerts).not.toBeNull();
  });

  it('health separates executions from completions and counts the model work truthfully', async () => {
    const health = (await reader.askIntelligence()).health;

    expect(health?.executionsLast24h).toBeGreaterThanOrEqual(3);
    /* Three executions, one of which carried a failure code. */
    expect(
      (health?.executionsLast24h ?? 0) - (health?.completionsLast24h ?? 0),
    ).toBeGreaterThanOrEqual(1);
    expect(health?.failuresLast24h).toBeGreaterThanOrEqual(1);
    expect(health?.modelInvocationsLast24h).toBeGreaterThanOrEqual(1);
    expect(health?.providerCallsLast24h).toBeGreaterThanOrEqual(1);
    expect(health?.zeroModelLast24h).toBeGreaterThanOrEqual(2);
  });

  it('latency order statistics come from real rows, and tokens only from measured ones', async () => {
    const health = (await reader.askIntelligence()).health;

    expect(health?.latency.sampleCount).toBeGreaterThanOrEqual(3);
    expect(health?.latency.medianMs).toBeGreaterThan(0);
    expect(health?.latency.p95Ms).toBeGreaterThanOrEqual(health?.latency.medianMs ?? 0);

    /* Only ONE row carried a usage measurement, so the token sample is 1 — not 3. */
    expect(health?.tokens.sampleCount).toBe(1);
    expect(health?.tokens.promptTokens).toBe(3000);
    expect(health?.tokens.completionTokens).toBe(800);
    expect(health?.tokens.totalTokens).toBe(3800);
  });

  it('evidence demand shows a role that was requested and never obtained', async () => {
    const evidence = (await reader.askIntelligence()).evidence;
    const official = evidence?.roles.find((role) => role.role === 'OFFICIAL');

    expect(official?.requested).toBeGreaterThanOrEqual(1);
    expect(official?.obtained).toBe(0);
    expect(official?.unavailable).toBeGreaterThanOrEqual(1);

    const reporting = evidence?.roles.find((role) => role.role === 'REPORTING');
    expect(reporting?.obtained).toBeGreaterThanOrEqual(1);
  });

  it('operations names the control that refused, not a generic failure', async () => {
    const operations = (await reader.askIntelligence()).operations;

    expect(operations?.budgetRejections.map((row) => row.key)).toContain(
      'BUDGET_REFUSED:account-day',
    );
    expect(operations?.byBreakerOutcome.map((row) => row.key)).toContain('SUCCESS');
    expect(operations?.signedOutAttempts.map((row) => row.key)).toContain('SIGNED_OUT_ATTEMPT');
    expect(operations?.byRoutePath.map((row) => row.key)).toContain('ASK_R2');
    expect(operations?.legacyInstrumented).toBe(false);
  });

  it('the improvement queue names the class and the role to fix, and no question', async () => {
    const improvement = (await reader.askIntelligence()).improvement;

    expect(improvement?.capabilityUnavailableTotal).toBeGreaterThanOrEqual(1);
    expect(improvement?.unavailableByQuestionClass.map((row) => row.key)).toContain(
      'OFFICIAL_DOCUMENT',
    );
    expect(improvement?.missingEvidenceRoles.map((row) => row.key)).toContain('OFFICIAL');
    expect(improvement?.affectedCountries.map((row) => row.key)).toContain('POL');
    expect(improvement?.affectedDomains.map((row) => row.key)).toContain('political');
  });

  it('THE WHOLE PAYLOAD CARRIES NO QUESTION AND NO IDENTIFIER', async () => {
    const serialised = JSON.stringify(await reader.askIntelligence()).toLowerCase();
    ['"question"', '"prompt"', '"userid"', '"operationid"', '"fingerprint"', '"setby"'].forEach(
      (forbidden) => {
        expect({ forbidden, present: serialised.includes(forbidden) }).toEqual({
          forbidden,
          present: false,
        });
      },
    );
    /* And no operation id it wrote leaks through any field. */
    written.forEach((operationId) => {
      expect(serialised.includes(operationId.toLowerCase())).toBe(false);
    });
  });

  it('the alert block evaluates against a real meter read rather than failing', async () => {
    const alerts = (await reader.askIntelligence()).alerts;
    expect(alerts?.alerts.map((alert) => alert.id)).toContain('BUDGET_SATURATION_HOUR');
    alerts?.alerts.forEach((alert) => {
      expect(['OK', 'WARNING', 'CRITICAL', 'UNKNOWN']).toContain(alert.severity);
    });
  });
});
