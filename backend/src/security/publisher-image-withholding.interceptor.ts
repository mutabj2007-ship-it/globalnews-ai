import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

/*
  U-1 PUBLISHER-IMAGE CONTAINMENT — B-1, THE API BOUNDARY (E1-18 §3 A-1, E1-20 §5 B-1, CTO R3A §5).

  Publisher image use is not cleared (E1 matrix, use G; ledger M-18). The rule is containment by
  ABSENCE: no publisher image URL is serialized to any client, so no component — current or future —
  can render or prefetch what it never receives.

  WHY ONE GLOBAL BOUNDARY AND NOT EIGHT PROJECTIONS. The audit found eight response shapes carrying
  `imageUrl` (news, country news, analysis, Ask operations for accounts and guests, Home / story
  search, My Intelligence, saved stories, story compare) — and one of them is STORED: Ask answers
  already persisted in StoredResult.payload contain `analysis.articles[].imageUrl`, so a write-side
  fix cannot reach them. Removing the field where the response leaves the server covers every route,
  stored and live, and the next route someone writes.

  WHAT IT DOES. Returns a copy of the response body with every `imageUrl` / `thumbnailUrl` property
  removed at any depth. It never mutates the handler's object (analysis results are cached and
  shared), never touches non-plain values (streams, buffers, files, dates), and is idempotent.
  Nothing is stored, deleted or rewritten: `Article.imageUrl` and `SavedStory.imageUrl` keep their
  data (E1-11 §7.1 — the URL is evidence for the pending legal question). No proxy, no thumbnail.
*/

export const WITHHELD_PUBLISHER_IMAGE_KEYS: ReadonlySet<string> = new Set([
  'imageUrl',
  'thumbnailUrl',
]);

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

/** A copy of `value` without any withheld image property, at any depth. Never mutates `value`. */
export function withoutPublisherImages<T>(
  value: T,
  seen: WeakMap<object, unknown> = new WeakMap(),
): T {
  if (value === null || typeof value !== 'object') return value;
  const source = value as unknown as object;
  const known = seen.get(source);
  if (known !== undefined) return known as T;
  if (Array.isArray(source)) {
    const copy: unknown[] = [];
    seen.set(source, copy);
    for (const item of source) copy.push(withoutPublisherImages(item, seen));
    return copy as unknown as T;
  }
  if (!isPlainObject(source)) return value;
  const copy: Record<string, unknown> = {};
  seen.set(source, copy);
  for (const [key, child] of Object.entries(source as Record<string, unknown>)) {
    if (WITHHELD_PUBLISHER_IMAGE_KEYS.has(key)) continue;
    copy[key] = withoutPublisherImages(child, seen);
  }
  return copy as unknown as T;
}

@Injectable()
export class PublisherImageWithholdingInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((body: unknown) => withoutPublisherImages(body)));
  }
}
