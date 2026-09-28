import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import { resolvePolishCountry } from '../query/polish-country-forms.util';

/**
 * ASK R2 ALPHA ENABLEMENT R1 · MC-070 — THE CONTINUATION ELLIPSIS.
 *
 * "And Kenya?", "What about Kenya?", "A Kenia?", "A co z Kenią?" continue an earlier
 * question with a new PLACE and nothing else. Asked with no earlier question, there is no
 * subject to carry, and running it anyway answers a question the reader did not ask
 * ("Kenya news") while implying one they did.
 *
 * This reader recognises only that shape, from a CLOSED set of continuation markers, and
 * only when EVERYTHING after the marker resolves to governed countries — so a fresh
 * question that names its own subject ("What about inflation in Poland?", "And what is
 * happening in Kenya?") is never caught. It reads; it decides nothing. The caller decides
 * what a continuation with no earlier question means.
 */

const EN_MARKER =
  /^\s*(?:and\s+what\s+about|and\s+how\s+about|what\s+about|how\s+about|what\s+of|same\s+for|and\s+also|and|but|also|plus)\s+(?:(?:in|for|about|on|with)\s+)?(?:the\s+)?(.+?)\s*[?!.…]*\s*$/iu;
const PL_MARKER =
  /^\s*(?:a\s+co\s+z|a\s+jak\s+z|a\s+jak\s+w|a\s+jak\s+jest\s+w|co\s+z|jak\s+z|a\s+dla|a\s+w|a\s+we|a\s+teraz|to\s+samo\s+dla|a\s+także|a|i)\s+(.+?)\s*[?!.…]*\s*$/iu;

/** Separators between several places ("And Kenya and Uganda?", "A Kenia i Uganda?"). */
const LIST_SEPARATOR =
  /\s*(?:,|\band\b|\bor\b|(?:^|\s)i(?=\s)|(?:^|\s)oraz(?=\s)|(?:^|\s)lub(?=\s))\s*/iu;

const MAX_PLACE_WORDS = 4;

export interface ContinuationEllipsis {
  /** The ISO-3 codes of the places the reader named, in the order named. */
  readonly candidates: readonly string[];
}

function resolvePlace(part: string): string | undefined {
  const text = part.trim();
  if (text.length === 0) return undefined;
  /* A lower-case two/three-letter word is an English word ("it", "us"), never a code. */
  if (/^[a-z]{2,3}$/.test(text)) return undefined;
  return (resolveCountryByAnyIdentifier(text) ?? resolvePolishCountry(text))?.iso3;
}

export function readContinuationEllipsis(question: string): ContinuationEllipsis | null {
  const text = (question ?? '').trim();
  const match = EN_MARKER.exec(text) ?? PL_MARKER.exec(text);
  const rest = match?.[1]?.trim();
  if (rest === undefined || rest.split(/\s+/).length > MAX_PLACE_WORDS * 2) return null;
  const parts = rest.split(LIST_SEPARATOR).filter((p) => p.trim().length > 0);
  if (parts.length === 0 || parts.some((p) => p.trim().split(/\s+/).length > MAX_PLACE_WORDS)) {
    return null;
  }
  const candidates: string[] = [];
  for (const part of parts) {
    const iso3 = resolvePlace(part);
    if (iso3 === undefined) return null;
    if (!candidates.includes(iso3)) candidates.push(iso3);
  }
  return { candidates };
}
