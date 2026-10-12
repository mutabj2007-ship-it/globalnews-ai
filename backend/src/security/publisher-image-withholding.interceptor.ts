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

  KEY SET (D-1). `imageUrl` / `thumbnailUrl` are always withheld. The set is guarded, not open: the
  spec walks the response contract (shared/src + controller-local response types) and FAILS when any
  other image-like key appears there, so a new image field is a build failure, not a leak. Keys the
  contract never declared (historical stored JSON) are covered by R-b below.
  Nothing is stored, deleted or rewritten: `Article.imageUrl` and `SavedStory.imageUrl` keep their
  data (E1-11 §7.1 — the URL is evidence for the pending legal question). No proxy, no thumbnail.
*/

export const WITHHELD_PUBLISHER_IMAGE_KEYS: ReadonlySet<string> = new Set([
  'imageUrl',
  'thumbnailUrl',
]);

/* Image-like NAME PARTS: image / thumbnail / photo / enclosure anywhere; media / social only as a whole
   name part (camelCase, SCREAMING_CASE or a leading word), so "immediateImpacts" or "medianMs" do not
   match. One predicate for the D-1 contract guard (spec) and the R-b runtime rule (below). */
export function isImageLikeKey(key: string): boolean {
  return (
    /image|thumbnail|photo|enclosure/iu.test(key) ||
    /^(?:media|social)(?![a-z])/iu.test(key) ||
    /[a-z0-9](?:Media|Social)(?![a-z])/u.test(key) ||
    /(?:^|_)(?:MEDIA|SOCIAL)(?:_|$)/u.test(key)
  );
}

/** Reviewed image-like names that are NOT media URLs. Adding to this list needs E1 review. */
export const REVIEWED_NON_IMAGE_KEYS: ReadonlySet<string> = new Set([
  'mediaType', // official-data MIME type of a retained snapshot (e.g. "text/csv"), never a URL
  'MEDIA_TYPE_NOT_ALLOWED', // official-data admission refusal reason code, never a URL
]);

/*
  U-1 R-b (E1-R4 §1.4.1) — STORED JSON IS NOT BOUND BY TODAY'S CONTRACT. A historical StoredResult
  payload (an older serializer, a raw provider object) may carry a publisher image under a name no
  type ever declared: `image`, `urlToImage`, `ogImage`, GDELT's `socialimage`, `media`, `enclosure`.
  So, besides the exact withheld names, a property is withheld when BOTH hold:
    1. its name is image-like (the D-1 predicate) and not E1-reviewed; and
    2. its value is an ABSOLUTE URL — a string `http(s)://…` (E1's rule) or protocol-relative `//…`,
       or an object / array that carries one at any depth (`media: { url }`, `enclosure: { url }`).
  Relative first-party paths (`/images/…`), gradients and every non-image-like key — the article
  `url` above all — are kept whatever their value.
*/
const ABSOLUTE_URL = /^(?:https?:)?\/\//iu;

function carriesAbsoluteUrl(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') return ABSOLUTE_URL.test(value.trim());
  if (value === null || typeof value !== 'object' || depth > 8) return false;
  return Object.values(value as Record<string, unknown>).some((child) =>
    carriesAbsoluteUrl(child, depth + 1),
  );
}

function isWithheld(key: string, value: unknown): boolean {
  if (WITHHELD_PUBLISHER_IMAGE_KEYS.has(key)) return true;
  return isImageLikeKey(key) && !REVIEWED_NON_IMAGE_KEYS.has(key) && carriesAbsoluteUrl(value);
}

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
    if (isWithheld(key, child)) continue;
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
