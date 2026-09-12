import { of, throwError, lastValueFrom, firstValueFrom } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { TelemetryInterceptor } from './telemetry.interceptor';
import { buildTelemetryDouble } from './telemetry.service.spec';

/**
 * R3/T7 — the analysis interceptor.
 *
 * THE ASSERTION THAT MATTERS MOST IS THE LAST ONE: a telemetry failure
 * must not fail a user's analysis request. Everything else here is
 * plumbing; that one is the promise.
 */
const context = (method: string, path: string): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ method, path }) }),
  }) as unknown as ExecutionContext;

const handler = (payload: unknown): CallHandler =>
  ({ handle: () => of(payload) }) as unknown as CallHandler;

const provenance = {
  provider: 'openai',
  model: 'gpt-x',
  executionMode: 'production',
  analysisMode: 'live-ai',
  status: 'success',
  latencyMs: 900,
  cached: false,
  tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
};

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('R3/T7 — what the interceptor observes', () => {
  it('records a run and the two server-side events for POST /analysis/news', async () => {
    const { service, events, runs } = buildTelemetryDouble();
    const interceptor = new TelemetryInterceptor(service);

    await lastValueFrom(
      interceptor.intercept(context('POST', '/analysis/news'), handler({ provenance })),
    );
    await settle();

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ provider: 'openai', status: 'success', totalTokens: 15 });
    expect(events.map((event) => event.name)).toEqual(['analysis_started', 'analysis_completed']);
  });

  it('the two events it emits are ANONYMOUS — an analysis is not account-scoped', async () => {
    const { service, events } = buildTelemetryDouble();
    const interceptor = new TelemetryInterceptor(service);

    await lastValueFrom(
      interceptor.intercept(context('POST', '/analysis/news'), handler({ provenance })),
    );
    await settle();

    events.forEach((event) => expect(event.userId).toBeNull());
  });

  it('ignores every other route', async () => {
    const { service, events, runs } = buildTelemetryDouble();
    const interceptor = new TelemetryInterceptor(service);

    await lastValueFrom(interceptor.intercept(context('GET', '/news/top-headlines'), handler({})));
    await lastValueFrom(interceptor.intercept(context('POST', '/support/tickets'), handler({})));
    await settle();

    expect(runs).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it('records nothing when the response carries no provenance', async () => {
    const { service, runs } = buildTelemetryDouble();
    const interceptor = new TelemetryInterceptor(service);

    await lastValueFrom(
      interceptor.intercept(context('POST', '/analysis/news'), handler({ articles: [] })),
    );
    await settle();

    expect(runs).toHaveLength(0);
  });

  it('records a FAILED analysis as truthfully as a successful one', async () => {
    const { service, runs } = buildTelemetryDouble();
    const interceptor = new TelemetryInterceptor(service);

    await lastValueFrom(
      interceptor.intercept(
        context('POST', '/analysis/news'),
        handler({
          provenance: {
            provider: 'openai',
            status: 'failed',
            failureReason: 'provider-timeout',
            cached: false,
          },
        }),
      ),
    );
    await settle();

    expect(runs[0]).toMatchObject({ status: 'failed', failureReason: 'provider-timeout' });
  });
});

describe('R3/T7 — TELEMETRY CANNOT FAIL AN ANALYSIS', () => {
  it('the response is unaffected when every telemetry write throws', async () => {
    const { service, runs } = buildTelemetryDouble({ failWrites: true });
    const interceptor = new TelemetryInterceptor(service);
    const payload = { provenance, articles: ['the answer the user asked for'] };

    const result = await lastValueFrom(
      interceptor.intercept(context('POST', '/analysis/news'), handler(payload)),
    );
    await settle();

    // The user still gets their answer, byte for byte. A metrics row that
    // would not insert must never cost somebody their analysis.
    expect(result).toBe(payload);
    expect(runs).toHaveLength(0);
  });

  it('an analysis error still propagates — telemetry never swallows a real failure', async () => {
    const { service } = buildTelemetryDouble();
    const interceptor = new TelemetryInterceptor(service);
    const boom = new Error('the analysis itself failed');

    const failing = {
      handle: () => throwError(() => boom),
    } as unknown as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(context('POST', '/analysis/news'), failing)),
    ).rejects.toBe(boom);
  });
});

describe('R3/T7 — the analysis module is not modified', () => {
  it('the interceptor reads the response and imports nothing from modules/analysis', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync } = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require('path') as typeof import('path');
    const source = readFileSync(join(__dirname, 'telemetry.interceptor.ts'), 'utf8')
      .replace(/\r\n/g, '\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(source).not.toMatch(/from '.*modules\/analysis/);
    expect(source).not.toContain('AnalysisService');
  });

  it('reads no request data beyond the method and the path', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync } = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require('path') as typeof import('path');
    const source = readFileSync(join(__dirname, 'telemetry.interceptor.ts'), 'utf8')
      .replace(/\r\n/g, '\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    ['request.ip', 'headers', 'user-agent', 'cookies', 'request.body', 'request.user'].forEach(
      (forbidden) => {
        expect({ forbidden, present: source.includes(forbidden) }).toEqual({
          forbidden,
          present: false,
        });
      },
    );
  });
});
