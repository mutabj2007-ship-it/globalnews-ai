import { ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AskV2GuestController } from './ask-v2-guest.controller';
import { GuestSessionService } from './guest-session.service';

/**
 * STAGE 2 · T5 PART B — DB-free unit pins for `status.policy` and `POST /ask-v2/guest/forget`.
 * The live behaviour (cascade, isolation, claimed rows, guards) is proven on PostgreSQL by
 * `ask-v2-guest.forget.t5b.postgres.spec.ts`; this spec runs in every full jest run.
 */

const TOKEN = 'a'.repeat(64);
const HASH = GuestSessionService.hashToken(TOKEN);
const POLICY = { allowance: 3, sessionLifetimeH: 168, purgeGraceH: 24, sweepIntervalS: 900 };

function make(overrides: Partial<Record<string, unknown>> = {}) {
  const guests = {
    policy: jest.fn(() => POLICY),
    purgeAfter: jest.fn((d: Date) => new Date(d.getTime() + 24 * 3_600_000)),
    resolve: jest.fn(async () => null),
    rawTokenFrom: jest.fn((req: Request) => {
      const v = req.cookies?.gna_guest as string | undefined;
      return typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) ? v : undefined;
    }),
    cookieName: jest.fn(() => 'gna_guest'),
    csrfMatches: jest.fn((hash: string, presented: string) => hash === HASH && presented === 'ok'),
    csrfForRequest: jest.fn(() => 'ok'),
    forget: jest.fn(async () => ({ deleted: true })),
    clearCookie: jest.fn(),
    clearGuestCookies: jest.fn(),
    ...overrides,
  };
  const ask = {
    guestTrialAvailable: jest.fn(async () => false),
    guestAllowance: jest.fn(async () => ({
      available: true,
      allowance: 3,
      remaining: 2,
      committed: 1,
      reserved: 0,
      state: 'OPEN',
      cooldownUntil: null,
    })),
  };
  const sessions = { validateSession: jest.fn(async () => null) };
  const controller = new AskV2GuestController(
    ask as never,
    guests as never,
    {} as never,
    sessions as never,
  );
  return { controller, guests, ask };
}

const req = (cookies: Record<string, string>, headers: Record<string, string> = {}) =>
  ({ cookies, headers }) as unknown as Request;
const res = {} as Response;

describe('T5 Part B · guest status policy', () => {
  it('a visitor without a guest session sees the configured policy (no session minted)', async () => {
    const { controller, guests } = make();
    const body = (await controller.status(req({}))) as Record<string, unknown>;
    expect(body.policy).toEqual(POLICY);
    expect(body.session).toBeNull();
    expect(guests.forget).not.toHaveBeenCalled();
  });

  it('a live guest sees policy, expiresAt and the purge date (expiry + grace)', async () => {
    const expiresAt = new Date('2026-10-10T12:00:00Z');
    const { controller } = make({ resolve: jest.fn(async () => ({ id: 'g1', expiresAt })) });
    const body = (await controller.status(req({ gna_guest: TOKEN }))) as Record<string, unknown>;
    expect(body.policy).toEqual(POLICY);
    expect(body.session).toEqual({
      expiresAt,
      purgeAfter: new Date('2026-10-11T12:00:00Z'),
    });
    expect(body).toMatchObject({ remaining: 2, committed: 1, allowance: 3 });
  });
});

describe('T5 Part B · POST /ask-v2/guest/forget handler', () => {
  it('no guest cookie: idempotent success, nothing deleted, no cookie touched', async () => {
    const { controller, guests } = make();
    await expect(controller.forget(req({}), res)).resolves.toEqual({
      forgotten: true,
      deleted: false,
    });
    expect(guests.forget).not.toHaveBeenCalled();
    expect(guests.clearCookie).not.toHaveBeenCalled();
    expect(guests.clearGuestCookies).not.toHaveBeenCalled();
  });

  it('a malformed leftover guest cookie is cleared, nothing deleted', async () => {
    const { controller, guests } = make();
    await expect(controller.forget(req({ gna_guest: 'junk' }), res)).resolves.toEqual({
      forgotten: true,
      deleted: false,
    });
    expect(guests.clearCookie).toHaveBeenCalledTimes(1);
    expect(guests.forget).not.toHaveBeenCalled();
  });

  it.each([
    ['no header', {}, { gna_csrf: 'ok' }],
    ['header without cookie', { 'x-csrf-token': 'ok' }, {}],
    ['header ≠ cookie', { 'x-csrf-token': 'ok' }, { gna_csrf: 'other' }],
    ['value not bound to this guest', { 'x-csrf-token': 'bad' }, { gna_csrf: 'bad' }],
  ])('a token without the guest-bound CSRF value is 403 (%s)', async (_n, headers, cookies) => {
    const { controller, guests } = make();
    await expect(
      controller.forget(req({ gna_guest: TOKEN, ...cookies }, headers), res),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(guests.forget).not.toHaveBeenCalled();
    expect(guests.clearGuestCookies).not.toHaveBeenCalled();
  });

  it('a valid guest: deletes by THIS token hash only and clears both cookies', async () => {
    const { controller, guests } = make();
    await expect(
      controller.forget(req({ gna_guest: TOKEN, gna_csrf: 'ok' }, { 'x-csrf-token': 'ok' }), res),
    ).resolves.toEqual({ forgotten: true, deleted: true });
    expect(guests.forget).toHaveBeenCalledWith(HASH);
    expect(guests.clearGuestCookies).toHaveBeenCalledWith(res);
  });

  it('a refusal from the service (answer in progress) clears nothing', async () => {
    const boom = new Error('GUEST_ANSWER_IN_PROGRESS');
    const { controller, guests } = make({ forget: jest.fn(async () => Promise.reject(boom)) });
    await expect(
      controller.forget(req({ gna_guest: TOKEN, gna_csrf: 'ok' }, { 'x-csrf-token': 'ok' }), res),
    ).rejects.toBe(boom);
    expect(guests.clearGuestCookies).not.toHaveBeenCalled();
  });
});
