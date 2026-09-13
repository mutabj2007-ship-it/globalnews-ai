import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { TelemetryService } from './telemetry.service';

/**
 * R3/T7 — analysis telemetry, WITHOUT MODIFYING THE ANALYSIS MODULE.
 *
 * `AnalysisProvenance` is already present on EVERY `AnalysisApiResponse`
 * — success, failure, validation rejection, not-attempted, cached or
 * fresh — and already carries provider, model, status, failureReason,
 * latencyMs and token usage. The analysis pipeline has been measuring all
 * of this since Milestone #30; it simply never persisted it.
 *
 * So this interceptor reads what the controller already returns and
 * writes it down. NOT ONE FILE UNDER `backend/src/modules/analysis/` IS
 * MODIFIED BY THIS MILESTONE: no service change, no controller change, no
 * DTO change, no provider change. The analysis pipeline does not learn
 * that telemetry exists, which is what keeps a measurement system from
 * becoming a dependency of the thing it measures.
 *
 * A TELEMETRY FAILURE CAN NEVER FAIL AN ANALYSIS REQUEST. The write is
 * fire-and-forget: it is not awaited, it is wrapped in the service, and
 * its promise is explicitly caught here as well. A user must not lose
 * their answer because a metrics row would not insert.
 *
 * NO REQUEST DATA IS READ except the route path, which is needed to know
 * which responses to observe. No header, no IP, no user-agent, no body.
 */
const ANALYSIS_ROUTE = '/analysis/news';

@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  constructor(private readonly telemetry: TelemetryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (request?.method !== 'POST' || !request?.path?.endsWith(ANALYSIS_ROUTE)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((payload) => {
        const provenance = (payload as AnalysisApiResponse | undefined)?.provenance;
        if (!provenance) return;

        // Not awaited. The response is already on its way to the user and
        // must not wait for, or be affected by, a metrics write.
        void this.record(provenance);
      }),
    );
  }

  private async record(provenance: AnalysisApiResponse['provenance']): Promise<void> {
    try {
      await this.telemetry.recordAnalysisRun({
        provider: provenance.provider,
        model: provenance.model,
        status: provenance.status,
        failureReason: provenance.failureReason,
        latencyMs: provenance.latencyMs,
        promptTokens: provenance.tokenUsage?.promptTokens,
        completionTokens: provenance.tokenUsage?.completionTokens,
        totalTokens: provenance.tokenUsage?.totalTokens,
        cached: provenance.cached,
      });

      // The two product events the platform can emit honestly from the
      // server, with no client involvement. analysis_started is recorded
      // alongside analysis_completed rather than at request entry
      // because a request that never produced a provenance object is not
      // an analysis anybody started — it is a rejected request.
      await this.telemetry.recordProductEvent('analysis_started');
      await this.telemetry.recordProductEvent('analysis_completed');
    } catch {
      // Swallowed on purpose. TelemetryService already logs; nothing
      // here may propagate into the response pipeline.
    }
  }
}
