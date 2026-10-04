import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import {
  legacyRouteUsage,
  type AuthClass,
  type LegacyRoute,
  type LegacyRouteUsageRegistry,
} from './legacy-route-usage';

type HeaderValue = string | string[] | undefined;
interface RequestLike {
  headers?: Record<string, HeaderValue>;
}

const first = (value: HeaderValue): string | undefined =>
  Array.isArray(value) ? value[0] : typeof value === 'string' ? value : undefined;

/**
 * STAGE 2 / T4 — counts one legacy request per invocation, then gets out of the way.
 *
 * Attached per handler as an INSTANCE (`@UseInterceptors(new LegacyRouteUsageInterceptor(...))`)
 * on the legacy controllers only, so no other route — Ask V2 above all — can reach it, and
 * app.module needs no change. It runs after the route's guards, so a request a guard refused
 * (rate limit, missing session) is not counted here; those are already logged by the guards.
 *
 * Recorded BEFORE the handler runs, so a request that later fails is still evidence of a caller.
 * The response stream is returned untouched: no tap, no map, no delay.
 *
 * `resolveAuth` is supplied by the owning controller, which alone knows how (or whether) its
 * route assesses identity. It must return a class, never an identifier.
 */
export class LegacyRouteUsageInterceptor implements NestInterceptor {
  constructor(
    private readonly route: LegacyRoute,
    private readonly resolveAuth: (request: unknown) => AuthClass = () => 'not-assessed',
    private readonly registry: LegacyRouteUsageRegistry = legacyRouteUsage,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    try {
      const request = context.switchToHttp().getRequest<RequestLike>();
      const headers = request?.headers ?? {};
      this.registry.record(
        this.route,
        {
          referer: first(headers.referer ?? headers.referrer),
          origin: first(headers.origin),
          userAgentHeader: first(headers['user-agent']),
        },
        this.resolveAuth(request),
      );
    } catch {
      // A measurement failure never fails the legacy request it measures.
    }
    return next.handle();
  }
}
