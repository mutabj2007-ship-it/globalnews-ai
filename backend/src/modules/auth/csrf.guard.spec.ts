import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';
import { CSRF_COOKIE_NAME } from './cookie.util';

describe('CsrfGuard (Milestone #57)', () => {
  function makeContext(cookies: Record<string, string>, headers: Record<string, unknown>) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ cookies, headers }),
      }),
    } as never;
  }

  it('accepts a request whose CSRF cookie matches the X-CSRF-Token header', () => {
    const guard = new CsrfGuard();
    const context = makeContext({ [CSRF_COOKIE_NAME]: 'abc123' }, { 'x-csrf-token': 'abc123' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a request with a missing CSRF cookie', () => {
    const guard = new CsrfGuard();
    const context = makeContext({}, { 'x-csrf-token': 'abc123' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a request with a missing X-CSRF-Token header', () => {
    const guard = new CsrfGuard();
    const context = makeContext({ [CSRF_COOKIE_NAME]: 'abc123' }, {});
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a request where the cookie and header values do not match', () => {
    const guard = new CsrfGuard();
    const context = makeContext({ [CSRF_COOKIE_NAME]: 'abc123' }, { 'x-csrf-token': 'different-value' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects an empty-string header value, not just an absent one', () => {
    const guard = new CsrfGuard();
    const context = makeContext({ [CSRF_COOKIE_NAME]: 'abc123' }, { 'x-csrf-token': '' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects an array-typed header value (a real Express quirk with duplicate headers), not just a mismatched string', () => {
    const guard = new CsrfGuard();
    const context = makeContext({ [CSRF_COOKIE_NAME]: 'abc123' }, { 'x-csrf-token': ['abc123'] });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
