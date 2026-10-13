import { Injectable, Logger, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { readerRightsEnforced, withholdThirdPartyArticles } from './reader-rights';

/*
  MASTER CTO R48 / #96 (E1-R46 R46-1/2/7/13) — THE LAST POINT BEFORE A READER. The Production
  backend is publicly reachable, so the reader news routes (/news search, top headlines, retained,
  category, country, stories, compare), /analysis/news, history, saved stories, alerts and home
  editorial all return third-party article JSON directly. Every such article object without a
  recorded per-use right (reader-rights.ts — only CLEARED publisher feeds) is removed from the
  response at this point, whichever route produced it; nothing stored is changed. Internal admin
  routes are not reader surfaces and are left as they are. Withholding is counted in a response
  header for operators; the reader-facing wording of each surface is unchanged.
*/
const INTERNAL_PREFIXES = ['/admin', '/api/admin', '/health', '/readiness'];

@Injectable()
export class ReaderRightsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ReaderRightsInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http' || !readerRightsEnforced()) return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<{ originalUrl?: string; url?: string }>();
    const path = (request?.originalUrl ?? request?.url ?? '').split('?')[0];
    if (INTERNAL_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return next.handle();
    const response = http.getResponse<{ setHeader?: (name: string, value: string) => void; headersSent?: boolean }>();
    return next.handle().pipe(
      map((body) => {
        const { value, withheld } = withholdThirdPartyArticles(body);
        if (withheld > 0) {
          if (response?.headersSent !== true) response?.setHeader?.('X-Source-Rights-Withheld', String(withheld));
          this.logger.warn(`source-rights containment: withheld=${withheld} path=${path}`);
          /*
            CTO R52 · E1 P-5 — a withheld list must never read as a completed "no news" result: an
            object response carries its own truthful reason in the JSON (an additive field; existing
            fields are unchanged). Array responses keep the header only.
          */
          if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            return { ...(value as Record<string, unknown>), sourceRightsWithheld: { count: withheld, reason: 'SOURCE_RIGHTS_WITHHELD' } };
          }
        }
        return value;
      }),
    );
  }
}
