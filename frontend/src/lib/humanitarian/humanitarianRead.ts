import {
  humanitarianReadAbsence, parseHumanitarianRetainedRead,
  type HumanitarianRetainedRead,
} from '@globalnews-ai/shared';
import { resolveApiBaseUrl } from '@/lib/api/apiBase';

/** Server-component read of our backend only. Never a provider URL or acquisition. */
export async function readHumanitarianObservations(): Promise<HumanitarianRetainedRead> {
  if (typeof window !== 'undefined') return humanitarianReadAbsence('NOT_ASSESSED');
  try {
    const response = await fetch(
      `${resolveApiBaseUrl().replace(/\/$/, '')}/humanitarian/observations`,
      { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) return humanitarianReadAbsence('SOURCE_TEMPORARILY_UNAVAILABLE');
    // The only admitted response is tiny; bound streamed input before parsing JSON.
    const stream = response.body?.getReader();
    if (!stream) return humanitarianReadAbsence('SOURCE_TEMPORARILY_UNAVAILABLE');
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const part = await stream.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > 4096) {
          await stream.cancel();
          return humanitarianReadAbsence('SOURCE_TEMPORARILY_UNAVAILABLE');
        }
        chunks.push(part.value);
      }
    } finally {
      stream.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return parseHumanitarianRetainedRead(JSON.parse(new TextDecoder().decode(bytes))) ??
      humanitarianReadAbsence('SOURCE_TEMPORARILY_UNAVAILABLE');
  } catch {
    return humanitarianReadAbsence('SOURCE_TEMPORARILY_UNAVAILABLE');
  }
}