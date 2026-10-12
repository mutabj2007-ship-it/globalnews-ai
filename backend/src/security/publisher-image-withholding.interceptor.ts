import {
  Injectable,
  StreamableFile,
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
  shared), never touches binary or streamed values (streams, buffers, files, dates), filters a
  class-instance body in the shape JSON.stringify would emit (D-2), and is idempotent.
  No global serializer runs outside this interceptor (verified: no ClassSerializerInterceptor or
  instanceToPlain on the response path; class-transformer is used only for request DTOs).

  KEY SET (D-1). Only `imageUrl` / `thumbnailUrl` are withheld. The set is guarded, not open: the
  spec walks the response contract (shared/src + controller-local response types) and FAILS when any
  other image-like key appears there, so a new image field is a build failure, not a leak.
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

/*
  U-1 D-2 (E1-22 §2.3) — values that are SENT AS THEY ARE, not serialized as JSON objects: binary
  data and streams (Nest streams or writes them untouched). Everything else that is an object is
  serialized by JSON.stringify, so it is filtered in the shape JSON.stringify would produce.
*/
function isPassThrough(value: object): boolean {
  return (
    value instanceof Date ||
    value instanceof StreamableFile ||
    Buffer.isBuffer(value) ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    typeof (value as { pipe?: unknown }).pipe === 'function'
  );
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
  if (!isPlainObject(source)) {
    if (isPassThrough(source)) return value;
    /* D-2: a class instance (DTO) is serialized from its toJSON() result when it has one, and from
       its own enumerable properties otherwise — filter exactly that shape. */
    const toJSON = (source as { toJSON?: unknown }).toJSON;
    if (typeof toJSON === 'function') {
      const json = withoutPublisherImages((toJSON as () => unknown).call(source), seen);
      seen.set(source, json);
      return json as T;
    }
  }
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
