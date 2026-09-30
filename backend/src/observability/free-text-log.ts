import { createHmac, randomBytes } from 'node:crypto';

/**
 * ASK FIRST-ANSWER RETRIEVAL R3 — READER TEXT NEVER GOES INTO A LOG LINE.
 *
 * Measured on Production (2026-09-30): the publisher-feed diagnostic wrote the reader's
 * normalized question verbatim, and several retrieval debug lines wrote derived provider
 * queries, topics and source phrases — all free text the reader typed. AskObservation
 * deliberately stores no question text; the logs must not be the back door.
 *
 * `describeFreeText` keeps what an operator needs (that text was present, how long it
 * was, and whether two lines within one process refer to the SAME text) and nothing a
 * reader wrote. The reference is an HMAC under a key generated at process start and
 * never persisted or logged, so it cannot be reversed by guessing likely questions
 * offline, and it does not link text across restarts.
 */
const PROCESS_KEY = randomBytes(32);

export function describeFreeText(text: string | null | undefined): string {
  if (text === null || text === undefined) return 'text=absent';
  const ref = createHmac('sha256', PROCESS_KEY).update(text).digest('hex').slice(0, 8);
  return `len=${text.length} ref=${ref}`;
}
