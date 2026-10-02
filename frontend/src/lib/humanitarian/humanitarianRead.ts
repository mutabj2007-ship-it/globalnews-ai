import {
  humanitarianReadAbsence, parseHumanitarianRetainedRead,
  type HumanitarianRetainedRead,
} from '@globalnews-ai/shared';
import { resolveApiBaseUrl } from '@/lib/api/apiBase';
import {
  humanitarianHomeProjection, parseHumanitarianReaderRuling,
  type HumanitarianHomeProjection, type HumanitarianReaderRuling,
} from './humHomeProjection';

/**
 * Bound on a reader read. The backend's one retained corpus is capacity-bounded
 * (HUMANITARIAN_CORPUS_CAPACITY = 200 records), so an admitted read is bounded too; an absence is
 * a few dozen bytes. Anything larger is refused rather than parsed.
 */
export const MAX_HUMANITARIAN_READ_BYTES = 512 * 1024;

/** One bounded, no-store GET of OUR backend. Never a provider URL; null on any failure. */
async function readBoundedJson(path: string, maxBytes: number): Promise<unknown | null> {
  try {
    const response = await fetch(
      `${resolveApiBaseUrl().replace(/\/$/, '')}${path}`,
      { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) return null;
    // Bound streamed input before parsing JSON.
    const stream = response.body?.getReader();
    if (!stream) return null;
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const part = await stream.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > maxBytes) {
          await stream.cancel();
          return null;
        }
        chunks.push(part.value);
      }
    } finally {
      stream.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** Server-component read of our backend only. Never a provider URL or acquisition. */
export async function readHumanitarianObservations(): Promise<HumanitarianRetainedRead> {
  if (typeof window !== 'undefined') return humanitarianReadAbsence('NOT_ASSESSED');
  const body = await readBoundedJson('/humanitarian/observations', MAX_HUMANITARIAN_READ_BYTES);
  return (body === null ? null : parseHumanitarianRetainedRead(body)) ??
    humanitarianReadAbsence('SOURCE_TEMPORARILY_UNAVAILABLE');
}

/** E1's reader-display constants as the backend publishes them; null = no display anywhere. */
export async function readHumanitarianReaderRuling(): Promise<HumanitarianReaderRuling | null> {
  if (typeof window !== 'undefined') return null;
  return parseHumanitarianReaderRuling(await readBoundedJson('/humanitarian/reader-ruling', 8192));
}

/**
 * Home's Humanitarian projection, or null (Home then renders nothing Humanitarian). The ruling is
 * read only when the read actually carries retained rows, so an absence costs one small GET.
 */
export async function readHumanitarianHome(projectedAt: string): Promise<HumanitarianHomeProjection | null> {
  const read = await readHumanitarianObservations();
  if (read.kind !== 'RETAINED') return null;
  const ruling = await readHumanitarianReaderRuling();
  return ruling === null ? null : humanitarianHomeProjection(read, ruling, projectedAt);
}
