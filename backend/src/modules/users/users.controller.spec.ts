import { UsersController } from './users.controller';
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from '../auth/cookie.util';
import type { UsersService } from './users.service';

/**
 * Milestone #58 privacy hardening — proves DELETE /users/me actively
 * clears the session and CSRF cookies after a successful deletion,
 * and — critically — that a failed database deletion is never
 * disguised as a success: if usersService.deleteAccount() rejects,
 * execution must never reach the cookie-clearing/204 lines at all.
 */
/**
 * Milestone #58 test-only correction — the previous makeFakeResponse()
 * declared `const response = { ..., status: jest.fn((code) => {
 * ...; return response; }), ... }` with no type annotation, so
 * TypeScript had to INFER response's type from an object literal that
 * itself references response inside status()'s return statement — a
 * genuine circular-inference problem (TS7022/TS7024), not a runtime
 * bug. Fixed with an explicit FakeResponse interface: response is now
 * declared with an explicit type annotation (`const response:
 * FakeResponse = {...}`), so TypeScript checks the initializer against
 * a known type instead of inferring one from it, and status()'s own
 * callback is given an explicit `: FakeResponse` return type for the
 * same reason. No `any`, no @ts-ignore/@ts-expect-error, no tsconfig
 * change — test semantics (four assertions below) are unchanged.
 */
interface FakeResponse {
  clearCookie: jest.Mock;
  status: jest.Mock;
  send: jest.Mock;
}

describe('UsersController.deleteMe (Milestone #58)', () => {
  function makeFakeResponse() {
    const cleared: Array<{ name: string; options: unknown }> = [];
    let statusCode: number | undefined;
    let sent = false;
    const response: FakeResponse = {
      clearCookie: jest.fn((name: string, options: unknown) => {
        cleared.push({ name, options });
      }),
      status: jest.fn((code: number): FakeResponse => {
        statusCode = code;
        return response;
      }),
      send: jest.fn(() => {
        sent = true;
      }),
    };
    return { response, cleared, getStatusCode: () => statusCode, wasSent: () => sent };
  }

  it('on successful deletion, clears both gna_session and gna_csrf with Path=/', async () => {
    const deleteAccount = jest.fn().mockResolvedValue(undefined);
    const usersService = { deleteAccount } as unknown as UsersService;
    const controller = new UsersController(usersService);
    const { response, cleared } = makeFakeResponse();

    await controller.deleteMe({ id: 'user-1' }, response as never);

    expect(cleared).toContainEqual({ name: SESSION_COOKIE_NAME, options: { path: '/' } });
    expect(cleared).toContainEqual({ name: CSRF_COOKIE_NAME, options: { path: '/' } });
  });

  it('on successful deletion, responds with 204', async () => {
    const deleteAccount = jest.fn().mockResolvedValue(undefined);
    const usersService = { deleteAccount } as unknown as UsersService;
    const controller = new UsersController(usersService);
    const { response, getStatusCode, wasSent } = makeFakeResponse();

    await controller.deleteMe({ id: 'user-1' }, response as never);

    expect(getStatusCode()).toBe(204);
    expect(wasSent()).toBe(true);
  });

  it('deletion is scoped to the current user\u2019s own id', async () => {
    const deleteAccount = jest.fn().mockResolvedValue(undefined);
    const usersService = { deleteAccount } as unknown as UsersService;
    const controller = new UsersController(usersService);
    const { response } = makeFakeResponse();

    await controller.deleteMe({ id: 'user-42' }, response as never);

    expect(deleteAccount).toHaveBeenCalledWith('user-42');
  });

  /**
   * The critical ordering guarantee: a failed database deletion must
   * never be disguised as a successful one merely because cookies
   * would otherwise be cleared.
   */
  it('when the database deletion fails, cookies are NOT cleared and no success response is sent \u2014 the error propagates instead', async () => {
    const deleteAccount = jest.fn().mockRejectedValue(new Error('simulated database failure'));
    const usersService = { deleteAccount } as unknown as UsersService;
    const controller = new UsersController(usersService);
    const { response, cleared, getStatusCode, wasSent } = makeFakeResponse();

    await expect(controller.deleteMe({ id: 'user-1' }, response as never)).rejects.toThrow(
      'simulated database failure',
    );

    expect(cleared).toHaveLength(0);
    expect(getStatusCode()).toBeUndefined();
    expect(wasSent()).toBe(false);
  });
});
