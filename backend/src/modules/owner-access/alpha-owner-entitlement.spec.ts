import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { lastValueFrom, of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';
import { ComputeMeterService } from '../compute-controls/compute-meter.service';
import {
  ALPHA_OWNER_USER_ID,
  ALPHA_RAILWAY_ENVIRONMENT_ID,
  OWNER_PREVIEW_COOKIE,
  isAlphaDeployment,
  isAlphaOwnerAccount,
  ownerAccessContext,
  ownerAccessMode,
  ownerExemptionApplies,
} from './alpha-owner-entitlement';
import { OwnerAccessInterceptor } from './owner-access.interceptor';
import { OwnerAccessController } from './owner-access.controller';

/**
 * PHONE-FIRST HOME CORRECTION R1 · §2 — the contract's required negative controls, plus the meter
 * integration (owner uncapped but still metered; everyone else capped exactly as before).
 */
const ALPHA = { DEPLOYMENT_ENVIRONMENT: 'ALPHA', RAILWAY_ENVIRONMENT_ID: ALPHA_RAILWAY_ENVIRONMENT_ID };
const PRODUCTION = { DEPLOYMENT_ENVIRONMENT: 'PRODUCTION', RAILWAY_ENVIRONMENT_ID: 'some-production-env-id' };
const OTHER = '11111111-2222-4333-8444-555555555555';

const inRequest = <T>(accountId: string | null, previewOrdinary: boolean, fn: () => T): T =>
  ownerAccessContext.run({ accountId, previewOrdinary }, fn);

describe('Alpha owner entitlement — identity and environment', () => {
  it('verified owner + Alpha = exemption', () => {
    expect(isAlphaOwnerAccount(ALPHA_OWNER_USER_ID, ALPHA)).toBe(true);
    expect(inRequest(ALPHA_OWNER_USER_ID, false, () => ownerExemptionApplies(ALPHA_OWNER_USER_ID, 'ask-account-day', ALPHA))).toBe(true);
  });

  it('different account + Alpha = no exemption', () => {
    expect(isAlphaOwnerAccount(OTHER, ALPHA)).toBe(false);
    expect(inRequest(OTHER, false, () => ownerExemptionApplies(OTHER, 'ask-account-day', ALPHA))).toBe(false);
  });

  it('guest / signed-out + Alpha = no exemption', () => {
    expect(isAlphaOwnerAccount(null, ALPHA)).toBe(false);
    expect(inRequest(null, false, () => ownerExemptionApplies(null, 'ask-account-day', ALPHA))).toBe(false);
    /* No request context at all (signed out, background job without a request) — nothing. */
    expect(ownerExemptionApplies(ALPHA_OWNER_USER_ID, 'ask-account-day', ALPHA)).toBe(false);
  });

  it('same owner + Production = no exemption (both environment facts are required)', () => {
    expect(isAlphaOwnerAccount(ALPHA_OWNER_USER_ID, PRODUCTION)).toBe(false);
    expect(isAlphaDeployment({ DEPLOYMENT_ENVIRONMENT: 'ALPHA', RAILWAY_ENVIRONMENT_ID: 'some-production-env-id' })).toBe(false);
    expect(isAlphaDeployment({ DEPLOYMENT_ENVIRONMENT: 'PRODUCTION', RAILWAY_ENVIRONMENT_ID: ALPHA_RAILWAY_ENVIRONMENT_ID })).toBe(false);
    expect(isAlphaDeployment({ DEPLOYMENT_ENVIRONMENT: 'alpha', RAILWAY_ENVIRONMENT_ID: ALPHA_RAILWAY_ENVIRONMENT_ID })).toBe(false);
    expect(isAlphaDeployment({})).toBe(false);
    expect(inRequest(ALPHA_OWNER_USER_ID, false, () => ownerExemptionApplies(ALPHA_OWNER_USER_ID, 'ask-account-day', PRODUCTION))).toBe(false);
  });

  it('a service cannot exempt an account other than the one the request authenticated as', () => {
    expect(inRequest(OTHER, false, () => ownerExemptionApplies(ALPHA_OWNER_USER_ID, 'ask-account-day', ALPHA))).toBe(false);
    expect(inRequest(ALPHA_OWNER_USER_ID, false, () => ownerExemptionApplies(OTHER, 'ask-account-day', ALPHA))).toBe(false);
  });

  it('ordinary preview removes the exemption; it can never add one', () => {
    expect(ownerAccessMode(ALPHA_OWNER_USER_ID, true, ALPHA)).toBe('ORDINARY_PREVIEW');
    expect(ownerAccessMode(ALPHA_OWNER_USER_ID, false, ALPHA)).toBe('UNRESTRICTED');
    expect(ownerAccessMode(OTHER, false, ALPHA)).toBe('NOT_OWNER');
    expect(ownerAccessMode(OTHER, true, ALPHA)).toBe('NOT_OWNER');
    expect(inRequest(ALPHA_OWNER_USER_ID, true, () => ownerExemptionApplies(ALPHA_OWNER_USER_ID, 'ask-account-day', ALPHA))).toBe(false);
  });

  it('the interceptor takes identity ONLY from request.user — spoofed email, header, query, client flag and IP grant nothing', async () => {
    const seen: Array<ReturnType<typeof ownerAccessContext.getStore>> = [];
    const run = async (request: Record<string, unknown>): Promise<void> => {
      const ctx = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
      const next: CallHandler = { handle: () => of(seen.push(ownerAccessContext.getStore())) };
      await lastValueFrom(new OwnerAccessInterceptor().intercept(ctx, next));
    };
    await run({
      headers: { 'x-user-id': ALPHA_OWNER_USER_ID, 'x-user-email': 'mutabj2007@gmail.com', 'x-forwarded-for': '1.2.3.4' },
      query: { owner: '1', email: 'mutabj2007@gmail.com' },
      body: { userId: ALPHA_OWNER_USER_ID, email: 'mutabj2007@gmail.com' },
      cookies: { owner: '1', email: 'mutabj2007@gmail.com' },
      ip: '1.2.3.4',
    });
    await run({ user: { id: OTHER }, headers: { 'x-user-id': ALPHA_OWNER_USER_ID } });
    await run({ user: { id: ALPHA_OWNER_USER_ID }, cookies: { [OWNER_PREVIEW_COOKIE]: '1' } });
    expect(seen).toEqual([
      { accountId: null, previewOrdinary: false },
      { accountId: OTHER, previewOrdinary: false },
      { accountId: ALPHA_OWNER_USER_ID, previewOrdinary: true },
    ]);
  });

  it('the entitlement names no email and is read from no client-controlled source', () => {
    const src = readFileSync(join(__dirname, 'alpha-owner-entitlement.ts'), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(code).not.toMatch(/headers|query|\blocalStorage|x-forwarded|request\.ip/);
  });

  it('GET /users/me/access reports NOT_OWNER for everyone but the Alpha owner', () => {
    const prev = { ...process.env };
    try {
      Object.assign(process.env, ALPHA);
      const c = new OwnerAccessController();
      const req = (cookie?: string) => ({ cookies: cookie ? { [OWNER_PREVIEW_COOKIE]: cookie } : {} }) as never;
      expect(c.view({ id: ALPHA_OWNER_USER_ID }, req())).toEqual({ mode: 'UNRESTRICTED' });
      expect(c.view({ id: ALPHA_OWNER_USER_ID }, req('1'))).toEqual({ mode: 'ORDINARY_PREVIEW' });
      expect(c.view({ id: OTHER }, req())).toEqual({ mode: 'NOT_OWNER' });
      Object.assign(process.env, PRODUCTION);
      expect(c.view({ id: ALPHA_OWNER_USER_ID }, req())).toEqual({ mode: 'NOT_OWNER' });
    } finally {
      process.env = prev;
    }
  });
});

describe('Alpha owner entitlement — ComputeMeterService (the single Ask budget choke point)', () => {
  const fakeDb = () => {
    const meter = new Map<string, number>();
    let n = 0;
    return {
      meter,
      db: {
        $queryRaw: async (_s: TemplateStringsArray, scope: string, bucket: Date, units: bigint) => {
          const key = `${scope}|${bucket.toISOString()}`;
          const total = (meter.get(key) ?? 0) + Number(units);
          meter.set(key, total);
          return [{ units: BigInt(total) }];
        },
        computeReservation: { create: async () => ({ id: `r${++n}` }) },
        $transaction: async () => undefined,
      },
    };
  };
  const config = { get: (k: string) => ({ ASK_ACCOUNT_UNITS_PER_DAY: '100', ASK_IP_UNITS_PER_DAY: '100', ASK_CONCURRENT_PER_ACCOUNT: '1000', ASK_CONCURRENT_PER_IP_PREFIX: '1000', ASK_CONCURRENT_GLOBAL: '1000' })[k] } as unknown as ConfigService;
  const ask = (meter: ComputeMeterService, db: unknown, accountId: string | null) =>
    meter.reserve({ accountId, ipScope: 'ip:203.0.113.0/24', provider: 'openai', estimatedUnits: 60 }, db as never);

  let saved: NodeJS.ProcessEnv;
  beforeEach(() => {
    saved = { ...process.env };
    Object.assign(process.env, ALPHA);
  });
  afterEach(() => {
    process.env = saved;
  });

  it('owner on Alpha exceeds the ordinary account/IP day budget and keeps testing — still metered', async () => {
    const { db, meter } = fakeDb();
    const m = new ComputeMeterService({} as PrismaService, config);
    for (let i = 0; i < 5; i++) {
      const r = await inRequest(ALPHA_OWNER_USER_ID, false, () => ask(m, db, ALPHA_OWNER_USER_ID));
      expect(r.admitted).toBe(true);
    }
    const acct = [...meter.entries()].find(([k]) => k.startsWith(`acct:${ALPHA_OWNER_USER_ID}|`));
    expect(acct?.[1]).toBe(300); // 5 × 60 charged: cost visible, not capped
  });

  it('a normal Alpha user is still refused at the account day budget', async () => {
    const { db } = fakeDb();
    const m = new ComputeMeterService({} as PrismaService, config);
    expect((await inRequest(OTHER, false, () => ask(m, db, OTHER))).admitted).toBe(true);
    const second = await inRequest(OTHER, false, () => ask(m, db, OTHER));
    expect(second).toEqual({ admitted: false, kind: 'REFUSED', control: 'account-day' });
  });

  it('the owner in ordinary preview, or on Production, is refused like everyone else', async () => {
    const m = new ComputeMeterService({} as PrismaService, config);
    const a = fakeDb();
    await inRequest(ALPHA_OWNER_USER_ID, true, () => ask(m, a.db, ALPHA_OWNER_USER_ID));
    expect((await inRequest(ALPHA_OWNER_USER_ID, true, () => ask(m, a.db, ALPHA_OWNER_USER_ID))).admitted).toBe(false);
    Object.assign(process.env, PRODUCTION);
    const b = fakeDb();
    await inRequest(ALPHA_OWNER_USER_ID, false, () => ask(m, b.db, ALPHA_OWNER_USER_ID));
    expect((await inRequest(ALPHA_OWNER_USER_ID, false, () => ask(m, b.db, ALPHA_OWNER_USER_ID))).admitted).toBe(false);
  });

  it('shared network: another account on the owner\'s IP is still IP-capped', async () => {
    const { db } = fakeDb();
    const m = new ComputeMeterService({} as PrismaService, config);
    for (let i = 0; i < 3; i++) await inRequest(ALPHA_OWNER_USER_ID, false, () => ask(m, db, ALPHA_OWNER_USER_ID));
    const r = await inRequest(OTHER, false, () => ask(m, db, OTHER));
    expect(r).toEqual({ admitted: false, kind: 'REFUSED', control: 'ip-day' });
  });

  it('owner keeps per-request size and global ceilings (operational limits are not product limits)', async () => {
    const { db } = fakeDb();
    const m = new ComputeMeterService({} as PrismaService, {
      get: (k: string) => ({ ASK_UNITS_PER_REQUEST_MAX: '50', ASK_GLOBAL_UNITS_PER_HOUR: '100' })[k],
    } as unknown as ConfigService);
    expect(await inRequest(ALPHA_OWNER_USER_ID, false, () => ask(m, db, ALPHA_OWNER_USER_ID))).toEqual({
      admitted: false,
      kind: 'REFUSED',
      control: 'per-request-units',
    });
  });
});
