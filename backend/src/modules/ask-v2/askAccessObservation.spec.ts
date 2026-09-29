import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  type ArgumentsHost,
} from '@nestjs/common';
import { AskAccessObservationFilter } from './ask-access-observation.filter';
import type { AskObservationService } from '../ask-observability/ask-observation.service';

/**
 * R1 — THE ASKS THAT NEVER BECAME AN ASK.
 *
 * A signed-out attempt cannot have an observation, because no operation exists to observe.
 * It is counted instead. These assertions prove the counter fires on exactly that case,
 * does NOT fire on a case that merely looks like it, and changes nothing about the
 * response either way.
 */
function hostFor(user?: { id: string }): { host: ArgumentsHost; response: unknown } {
  const response = { headersSent: false };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ user, url: '/ask-v2/threads', method: 'POST' }),
      getResponse: () => response,
    }),
    getType: () => 'http',
  } as unknown as ArgumentsHost;
  return { host, response };
}

function harness() {
  const counted: string[] = [];
  const observations = {
    countAccess: jest.fn(async (event: string) => {
      counted.push(event);
      return true;
    }),
  } as unknown as AskObservationService;
  const filter = new AskAccessObservationFilter(observations);
  /* The base filter is what re-throws to the platform handler; stubbed so this test is
     about the counting decision and not about Nest's own error rendering. */
  const rethrown: unknown[] = [];
  jest
    .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(filter)), 'catch')
    .mockImplementation((...args: unknown[]) => {
      rethrown.push(args[0]);
    });
  return { filter, counted, rethrown };
}

afterEach(() => jest.restoreAllMocks());

describe('R1 — the access counter fires on a refusal and on nothing else', () => {
  it('an unauthenticated Ask attempt is counted as a signed-out attempt', () => {
    const { filter, counted } = harness();
    const { host } = hostFor(undefined);
    filter.catch(new UnauthorizedException(), host);
    expect(counted).toEqual(['SIGNED_OUT_ATTEMPT']);
  });

  it('a 404 thrown BEFORE authentication is the switched-off surface, and is counted as that', () => {
    /* AskV2EnabledGuard runs ahead of RequireAuthGuard, so `request.user` is unset. */
    const { filter, counted } = harness();
    const { host } = hostFor(undefined);
    filter.catch(new NotFoundException(), host);
    expect(counted).toEqual(['ASK_SURFACE_ABSENT']);
  });

  it("a 404 for SOMEBODY ELSE'S operation is counted as NOTHING — it is not an access event", () => {
    /*
      THE CASE THIS DISCRIMINATOR EXISTS FOR. An owner-scoped read is only reachable after
      RequireAuthGuard has set `request.user`, so a signed-in 404 is a privacy-preserving
      refusal rather than a reader meeting a disabled surface. Counting it would both
      corrupt the figure and turn an ownership probe into a signal.
    */
    const { filter, counted } = harness();
    const { host } = hostFor({ id: 'account-1' });
    filter.catch(new NotFoundException(), host);
    expect(counted).toEqual([]);
  });

  it('the exception is always handed on unchanged — the counter cannot alter a response', () => {
    const { filter, counted, rethrown } = harness();
    const error = new UnauthorizedException();
    filter.catch(error, hostFor(undefined).host);
    expect(rethrown).toEqual([error]);
    expect(counted).toEqual(['SIGNED_OUT_ATTEMPT']);
  });

  it('a counter that throws cannot break the refusal', async () => {
    const failing = {
      countAccess: jest.fn(async () => {
        throw new Error('store down');
      }),
    } as unknown as AskObservationService;
    const filter = new AskAccessObservationFilter(failing);
    jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(filter)), 'catch')
      .mockImplementation(() => undefined);
    expect(() => filter.catch(new UnauthorizedException(), hostFor(undefined).host)).not.toThrow();
    /* The rejection is the service's own to swallow; nothing here may observe it as a
       failure of the request. */
    await Promise.resolve();
  });

  it('it catches only the two refusals, so an ordinary conflict is never counted', () => {
    const { filter, counted } = harness();
    filter.catch(new ConflictException(), hostFor({ id: 'account-1' }).host);
    expect(counted).toEqual([]);
  });
});

describe('R1 — the guard order the discriminator depends on is the one that ships', () => {
  const controller = readFileSync(join(__dirname, 'ask-v2.controller.ts'), 'utf8');

  it('the enable guard still runs BEFORE authentication', () => {
    expect(controller).toContain('@UseGuards(AskV2EnabledGuard, RequireAuthGuard)');
  });

  it('the filter is attached to the Ask V2 controller', () => {
    expect(controller).toContain('@UseFilters(AskAccessObservationFilter)');
  });

  it('the filter reads nothing from the request but the presence of an account', () => {
    const filter = readFileSync(join(__dirname, 'ask-access-observation.filter.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    ['.body', '.query', '.headers', 'req.ip', 'request.ip', 'cookie', 'user-agent'].forEach(
      (forbidden) => {
        expect({
          forbidden,
          present: filter.toLowerCase().includes(forbidden.toLowerCase()),
        }).toEqual({ forbidden, present: false });
      },
    );
  });
});
