import { BadRequestException, type ExecutionContext } from '@nestjs/common';
import {
  SEARCH_HISTORY_LIST_LIMIT,
  SEARCH_HISTORY_RETENTION_LIMIT,
  type AnalysisApiResponse,
} from '@globalnews-ai/shared';
import type { PrismaService } from '../../database/prisma.service';
import { HistoryService, HISTORY_DUPLICATE_WINDOW_MS } from './history.service';
import { AnalysisRateLimitGuard } from '../analysis/security/analysis-rate-limit.guard';
import { AnalysisController } from '../analysis/controller/analysis.controller';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { HistoryController } from './history.controller';
import type { AnalysisService } from '../analysis/service/analysis.service';

/**
 * MY INTELLIGENCE R1 — RECENT INTELLIGENCE BECOMES REAL.
 *
 * The one writer (HistoryService.recordExplicitQuestion) is reached only from
 * POST /analysis/news, for a caller the analysis guard VERIFIED (session +
 * CSRF). Exercised here through the real guard and the real controller.
 */

interface Row {
  id: string;
  userId: string;
  query: string;
  countryCode: string | null;
  createdAt: Date;
}

function historyDouble() {
  const rows: Row[] = [];
  let seq = 0;
  const prisma = {
    searchHistoryEntry: {
      findFirst: jest.fn(async ({ where }: { where: { userId: string } }) =>
        rows
          .filter((row) => row.userId === where.userId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Omit<Row, 'id'> & { createdAt?: Date } }) => {
        const row = { id: `h-${(seq += 1)}`, ...data, createdAt: data.createdAt ?? new Date() } as Row;
        rows.push(row);
        return row;
      }),
      findMany: jest.fn(
        async ({ where, skip, take }: { where: { userId: string }; skip?: number; take?: number }) => {
          const list = rows
            .filter((row) => row.userId === where.userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          return list.slice(skip ?? 0, take !== undefined ? (skip ?? 0) + take : undefined);
        },
      ),
      deleteMany: jest.fn(async ({ where }: { where: { userId: string; id?: { in: string[] } } }) => {
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (rows[i].userId === where.userId && (!where.id || where.id.in.includes(rows[i].id))) rows.splice(i, 1);
        }
        return { count: 0 };
      }),
    },
  } as unknown as PrismaService;
  return { service: new HistoryService(prisma), rows, prisma };
}

describe('the one history writer', () => {
  it('stores the question and optional country — nothing else', async () => {
    const { service, rows } = historyDouble();
    await service.recordExplicitQuestion('user-1', '  What changed in Sudan?  ', 'SDN');
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(['countryCode', 'createdAt', 'id', 'query', 'userId']);
    expect(rows[0]).toMatchObject({ query: 'What changed in Sudan?', countryCode: 'SDN' });
  });

  it('a duplicate of the same question inside the window is recorded once', async () => {
    const { service, rows } = historyDouble();
    const t0 = new Date('2026-09-27T10:00:00.000Z');
    await service.recordExplicitQuestion('user-1', 'Why is inflation high?', undefined, t0);
    await service.recordExplicitQuestion('user-1', 'Why is inflation high?', undefined, new Date(t0.getTime() + 2_000));
    expect(rows).toHaveLength(1);
    await service.recordExplicitQuestion(
      'user-1',
      'Why is inflation high?',
      undefined,
      new Date(t0.getTime() + HISTORY_DUPLICATE_WINDOW_MS),
    );
    expect(rows).toHaveLength(2);
  });

  it('two concurrent writes of the same question (React retry / double submit) produce one entry', async () => {
    const { service, rows } = historyDouble();
    await Promise.all([
      service.recordExplicitQuestion('user-1', 'Same question'),
      service.recordExplicitQuestion('user-1', 'Same question'),
    ]);
    expect(rows).toHaveLength(1);
  });

  it(`retention is bounded to ${SEARCH_HISTORY_RETENTION_LIMIT}; the list to ${SEARCH_HISTORY_LIST_LIMIT}`, async () => {
    const { service, rows } = historyDouble();
    const base = Date.parse('2026-09-01T00:00:00.000Z');
    for (let i = 0; i < SEARCH_HISTORY_RETENTION_LIMIT + 5; i += 1) {
      await service.recordExplicitQuestion('user-1', `Question ${i}`, undefined, new Date(base + i * 60_000));
    }
    expect(rows).toHaveLength(SEARCH_HISTORY_RETENTION_LIMIT);
    expect(rows.some((row) => row.query === 'Question 0')).toBe(false);
    const list = await service.listForUser('user-1');
    expect(list).toHaveLength(SEARCH_HISTORY_LIST_LIMIT);
    expect(list[0].query).toBe(`Question ${SEARCH_HISTORY_RETENTION_LIMIT + 4}`);
  });

  it('never throws: a database failure is logged and the analysis proceeds', async () => {
    const { service, prisma } = historyDouble();
    (prisma.searchHistoryEntry.findFirst as jest.Mock).mockRejectedValueOnce(new Error('db down'));
    await expect(service.recordExplicitQuestion('user-1', 'Question')).resolves.toBe(false);
  });
});

/* ── through the real guard and the real controller ──────────────────── */

function makeContext(options: { signedIn: boolean; csrfMatches?: boolean }) {
  const request = {
    ip: '203.0.113.9',
    cookies: options.signedIn ? { gna_session: 'valid-token', gna_csrf: 'csrf-abc' } : {},
    headers: options.signedIn ? { 'x-csrf-token': options.csrfMatches === false ? 'other' : 'csrf-abc' } : {},
  };
  const response = { setHeader: jest.fn() };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    getHandler: () => function analyzeNews() {},
    getClass: () => class AnalysisController {},
  } as unknown as ExecutionContext;
  return { request, context };
}

function controllerHarness() {
  const history = historyDouble();
  const analysis = {
    analyzeNews: jest.fn(async () => ({ analysis: null }) as unknown as AnalysisApiResponse),
  };
  const guard = new AnalysisRateLimitGuard({
    validateSession: jest.fn(async (token: string) => (token === 'valid-token' ? { userId: 'user-1' } : null)),
  } as never);
  const controller = new AnalysisController(analysis as unknown as AnalysisService, history.service);
  const ask = async (body: Record<string, unknown>, options: { signedIn: boolean; csrfMatches?: boolean }) => {
    const { request, context } = makeContext(options);
    await guard.canActivate(context);
    return controller.analyzeNews(body as never, request as never);
  };
  return { history, analysis, ask };
}

describe('history is written by the explicit Ask — and only by it', () => {
  it('a verified signed-in Ask writes exactly one entry, before the analysis runs', async () => {
    const h = controllerHarness();
    await h.ask({ query: 'What is happening in Sudan?', storyContext: { title: 't', countryCode: 'SDN' } }, { signedIn: true });
    expect(h.history.rows).toEqual([expect.objectContaining({ query: 'What is happening in Sudan?', countryCode: 'SDN' })]);
    expect(h.analysis.analyzeNews).toHaveBeenCalledTimes(1);
  });

  it('a failed / no-evidence analysis still records the question (the reader asked it), never an answer', async () => {
    const h = controllerHarness();
    h.analysis.analyzeNews.mockRejectedValueOnce(new Error('provider down'));
    await expect(h.ask({ query: 'Question that fails' }, { signedIn: true })).rejects.toThrow('provider down');
    expect(h.history.rows.map((row) => row.query)).toEqual(['Question that fails']);
  });

  it('anonymous callers, and a signed-in caller without a matching CSRF header, write nothing', async () => {
    const h = controllerHarness();
    await h.ask({ query: 'Anonymous question' }, { signedIn: false });
    await h.ask({ query: 'Unverified question' }, { signedIn: true, csrfMatches: false });
    expect(h.history.rows).toEqual([]);
    expect(h.analysis.analyzeNews).toHaveBeenCalledTimes(2);
  });

  it('a double submit of one Ask is one history entry', async () => {
    const h = controllerHarness();
    await Promise.all([h.ask({ query: 'Once' }, { signedIn: true }), h.ask({ query: 'Once' }, { signedIn: true })]);
    expect(h.history.rows).toHaveLength(1);
  });

  it('a multi-story action below its minimum is refused before anything is recorded or computed', async () => {
    const h = controllerHarness();
    const oneStory = [{ articleRef: 'a'.repeat(64), url: 'https://wire.example/a' }];
    await expect(
      h.ask({ query: 'Compare the selected stories', selection: { action: 'COMPARE', stories: oneStory } }, { signedIn: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.history.rows).toEqual([]);
    expect(h.analysis.analyzeNews).not.toHaveBeenCalled();
  });

  it('staging, typing, opening Ask and reopening history have no route to this writer', () => {
    /* The only production caller of recordExplicitQuestion is the analysis controller. */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execSync } = require('child_process') as typeof import('child_process');
    const callers = execSync('git grep -l "recordExplicitQuestion(" -- "src/**/*.ts"', { cwd: `${__dirname}/../../..` })
      .toString()
      .trim()
      .split('\n')
      .filter((file) => !file.endsWith('.spec.ts'));
    expect(callers.sort()).toEqual([
      'src/modules/analysis/controller/analysis.controller.ts',
      'src/modules/history/history.service.ts',
    ]);
  });
});

describe('R1.1 — there is no second, public history writer', () => {
  const routes = () =>
    Object.getOwnPropertyNames(HistoryController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => {
        const handler = (HistoryController.prototype as unknown as Record<string, object>)[name];
        return { name, method: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined };
      })
      .filter((route) => route.method !== undefined);

  it('HistoryController exposes GET and DELETE /history only — no POST (or any other write verb)', () => {
    expect(Reflect.getMetadata(PATH_METADATA, HistoryController)).toBe('history');
    expect(routes().map((route) => RequestMethod[route.method as RequestMethod]).sort()).toEqual(['DELETE', 'GET']);
    for (const verb of [RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.ALL]) {
      expect(routes().some((route) => route.method === verb)).toBe(false);
    }
  });

  it('HistoryService has no public create(); recordExplicitQuestion is the sole writer', () => {
    expect((HistoryService.prototype as unknown as Record<string, unknown>).create).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execSync } = require('child_process') as typeof import('child_process');
    const writers = execSync('git grep -n -E "searchHistoryEntry[.](create|createMany|upsert|update|updateMany)[(]" -- "src/**/*.ts"', {
      cwd: `${__dirname}/../../..`,
    })
      .toString()
      .trim()
      .split('\n')
      .filter((line) => !line.split(':')[0].endsWith('.spec.ts'));
    expect(writers).toHaveLength(1);
    expect(writers[0]).toMatch(/^src\/modules\/history\/history\.service\.ts:/);
  });

  it('the create-history DTO that fed the removed POST is gone', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { existsSync } = require('fs') as typeof import('fs');
    expect(existsSync(`${__dirname}/create-history-entry.dto.ts`)).toBe(false);
  });
});
