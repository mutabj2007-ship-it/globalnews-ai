import { AsyncLocalStorage } from 'node:async_hooks';
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { clientIpScope } from '../compute-controls/compute-scopes';
import type { AskContextExecutionInputs } from './ask-context';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE E — WHO IS ASKING, FOR THE BUDGET.
 *
 * The execution port's signature is frozen (`execute(request, plan, operationId)`), and the
 * public DTO must not grow so the client can describe itself (§1). But the per-account and
 * per-IP budgets (§10) need the SERVER-resolved account and address. So the controller's
 * request carries them in async-local context: set here from `request.user` (resolved by
 * RequireAuthGuard) and `request.ip` (Express, under the landed TRUST_PROXY setting), and
 * read by the execution adapter. Never a caller-supplied value; absent outside a request.
 */
export interface AskRequestContext {
  readonly accountId: string | null;
  /** ASK GUEST TRIAL R3 — the server-issued guest session (RequireGuestGuard), or null. */
  readonly guestSessionId?: string | null;
  readonly ipScope: string;
  /**
   * ASK R3 CONTINUITY — the reader's OWN previous question in the SAME thread, read by
   * AskV2Service from an owner-verified thread. Never a caller-supplied value, never another
   * owner's text, never a prior AI answer. Absent on a thread's first turn.
   */
  readonly priorQuestion?: string | null;
  /**
   * HOME R1 STAGE A — the server-RESOLVED context for THIS operation (ask-context.ts), set by
   * AskV2Service from the operation's own persisted plan. Never a caller-supplied value.
   */
  readonly askContext?: AskContextExecutionInputs;
}

export const askRequestContext = new AsyncLocalStorage<AskRequestContext>();

@Injectable()
export class AskRequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      user?: { id?: string };
      guest?: { id?: string };
      ip?: string;
    }>();
    const store: AskRequestContext = {
      accountId: typeof request?.user?.id === 'string' ? request.user.id : null,
      guestSessionId: typeof request?.guest?.id === 'string' ? request.guest.id : null,
      ipScope: clientIpScope(request?.ip),
    };
    return new Observable((subscriber) =>
      askRequestContext.run(store, () => next.handle().subscribe(subscriber)),
    );
  }
}
