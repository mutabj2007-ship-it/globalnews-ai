import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { OWNER_PREVIEW_COOKIE, ownerAccessContext, type OwnerAccessState } from './alpha-owner-entitlement';

/**
 * PHONE-FIRST HOME CORRECTION R1 · §2 — records, per request, the SERVER-RESOLVED account id
 * (request.user, set by RequireAuthGuard; guards run before interceptors) and the owner's
 * ordinary-preview choice. Registered globally; it grants nothing by itself — every exemption is
 * decided by ownerExemptionApplies(), which re-checks environment and owner id.
 */
@Injectable()
export class OwnerAccessInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<{ user?: { id?: unknown }; cookies?: Record<string, unknown> }>();
    const state: OwnerAccessState = {
      accountId: typeof request?.user?.id === 'string' ? request.user.id : null,
      previewOrdinary: request?.cookies?.[OWNER_PREVIEW_COOKIE] === '1',
    };
    return new Observable((subscriber) => ownerAccessContext.run(state, () => next.handle().subscribe(subscriber)));
  }
}
