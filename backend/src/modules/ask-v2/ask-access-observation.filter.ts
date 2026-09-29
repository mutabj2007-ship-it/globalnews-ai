import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { AskObservationService } from '../ask-observability/ask-observation.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN ASK INTELLIGENCE OBSERVABILITY R1 — THE ASKS THAT NEVER BECAME AN ASK
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A signed-out reader who tries to Ask is refused by `RequireAuthGuard` before any
 * operation exists, so that attempt can never have an `AskObservation` — there is nothing
 * to observe. It is still the single most actionable number Product can have about the
 * Ask surface, so it is COUNTED here.
 *
 * A FILTER, NOT AN INTERCEPTOR, AND THAT IS THE WHOLE REASON THIS FILE EXISTS.
 * Interceptors run only after every guard has passed, so `AskRequestContextInterceptor`
 * never sees a refusal. A filter does, and it sees it without moving, weakening or
 * reordering a single guard.
 *
 * THE DISCRIMINATOR IS `request.user`, AND IT IS EXACT.
 * The guard chain is `AskV2EnabledGuard` then `RequireAuthGuard`, in that order:
 *   - the enable guard's 404 is thrown BEFORE authentication, so `request.user` is unset
 *     — the Ask surface is switched off and the caller met its absence;
 *   - a 404 from the service is thrown by an owner-scoped read, which is only reachable
 *     AFTER `RequireAuthGuard` set `request.user` — somebody else's operation, and NOT an
 *     access event. It is counted as nothing.
 * `askAccessObservation.spec.ts` asserts both directions rather than trusting the comment.
 *
 * NOTHING ABOUT THE RESPONSE CHANGES. The exception is re-thrown to the platform's own
 * handler, so status, body and the Ask privacy headers are exactly what they were. The
 * count is fire-and-forget on a service that swallows its own failures: a counter that
 * could turn a 401 into a 500 would be worse than no counter.
 *
 * NO REQUEST CONTENT IS READ. Not the body, not the query, not a header, not the address.
 * The only thing this filter reads from the request is whether `user` is present.
 */
@Catch(UnauthorizedException, NotFoundException)
@Injectable()
export class AskAccessObservationFilter extends BaseExceptionFilter implements ExceptionFilter {
  constructor(private readonly observations: AskObservationService) {
    super();
  }

  catch(exception: HttpException, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<{ user?: { id?: string } }>();
    const signedIn = request?.user?.id !== undefined;

    /*
      FIRE AND FORGET, WITH A CATCH THAT IS NOT DECORATION. A bare `void promise` on a
      rejecting promise is an unhandled rejection, and an unhandled rejection takes the
      process down on modern Node — so a counter attached to a 401 path could have turned
      every refusal into an outage. The service already swallows its own failures; this
      catch is the second lock, for the case where it is not the service that fails.
    */
    const count = (event: 'SIGNED_OUT_ATTEMPT' | 'ASK_SURFACE_ABSENT'): void => {
      void Promise.resolve(this.observations.countAccess(event)).catch(() => undefined);
    };

    if (exception instanceof UnauthorizedException) {
      count('SIGNED_OUT_ATTEMPT');
    } else if (!signedIn) {
      count('ASK_SURFACE_ABSENT');
    }

    super.catch(exception, host);
  }
}
