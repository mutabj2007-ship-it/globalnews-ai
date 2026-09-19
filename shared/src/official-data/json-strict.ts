/**
 * ════════════════════════════════════════════════════════════════════════════
 * STRICT JSON — E1 · §3 PER-TYPE ROW AND §5 PARSER DIFFERENTIALS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-OFFICIAL-DATA-CANONICAL-ADMISSION-R1.
 *
 * `JSON.parse` is not usable as the admission parser, and the reason is not pedantry.
 * It is permissive in exactly the three places E1 names as differentials:
 *
 *   1. DUPLICATE KEYS ARE SILENTLY LAST-WINS.  E1 · P-2: parsers disagree — first-wins,
 *      last-wins, error — so a duplicate-key body means "different components of one
 *      system can legitimately read different values from identical bytes". A refusal
 *      is the only answer that keeps one meaning per byte sequence.
 *   2. IT TAKES A STRING, NOT BYTES.  By the time a `string` exists the UTF-8 decision
 *      has already been made, and the default decoder REPLACES an invalid sequence with
 *      U+FFFD. T-11 requires invalid UTF-8 to be REFUSED and asserts no U+FFFD appears
 *      in any stored byte. A validator that runs after a lossy decode cannot see the
 *      thing it exists to refuse.
 *   3. IT COERCES NUMBERS.  E1 · P-3: official statistics carry long decimals, and
 *      `parseFloat` losing a digit is "a silent wrong number that every assertion on the
 *      value passes". `1e400` becomes `Infinity`; a 30-digit decimal quietly rounds.
 *
 * So this scanner reads BYTES, decodes them itself with `fatal: true`, and refuses
 * rather than repairs. It runs ONCE per capture (E1 · P-1, parse once) and its result is
 * what the rest of the pipeline uses.
 *
 * ── THE NUMERIC RULE, WHICH IS THE SUBTLE ONE ─────────────────────────────
 *
 * E1 · T-13 gives two permitted outcomes for a token failing the lexical round-trip
 * `String(Number(t)) === t`: retained as a string, OR the capture is refused — and
 * "never silently coerced". This takes the first: the token is kept VERBATIM as a
 * string and flagged in `lexicalNumberTokens`. Nothing downstream can mistake it for a
 * number it is not, and the original characters survive for whoever needs the value.
 *
 * That choice is deliberate. Refusing would discard a whole capture over a precision
 * artefact in one cell; keeping the characters loses nothing and lies about nothing.
 */

import type { SnapshotRefusalKey } from './snapshot-admission';

/** Depth and node ceilings. E1 · §3 per-type row, asserted by T-12. */
export const STRICT_JSON_MAX_DEPTH = 64;
export const STRICT_JSON_MAX_NODES = 200_000;

/**
 * A numeric token kept as characters because `Number` could not round-trip it.
 * Its presence is a FACT ABOUT THE CAPTURE, recorded rather than smoothed away.
 */
export interface LexicalNumberToken {
  /** A JSON-Pointer-shaped path, for an operator reading an audit row. */
  readonly path: string;
  /** The token exactly as it appeared in the bytes. */
  readonly token: string;
}

export type StrictJsonResult =
  | {
      readonly ok: true;
      readonly value: unknown;
      readonly nodes: number;
      readonly maxDepth: number;
      readonly lexicalNumberTokens: readonly LexicalNumberToken[];
    }
  | {
      readonly ok: false;
      readonly refusalKey: Extract<SnapshotRefusalKey, 'PARSE_FAILED' | 'BODY_NOT_JSON_SHAPED'>;
      /**
       * A SHORT, CLASSIFIED reason. E1 · C-4 — "a foreign string is classified, never
       * interpolated". No provider text and no body bytes appear here; the detail names
       * the RULE that fired, and the rule names are ours.
       */
      readonly detail: string;
      readonly offset: number;
    };

type Refusable = 'PARSE_FAILED' | 'BODY_NOT_JSON_SHAPED';

/**
 * Decode UTF-8 STRICTLY. `fatal: true` throws on an overlong encoding, a lone surrogate,
 * a truncated sequence or an invalid byte — each of which the lenient decoder turns into
 * U+FFFD, which is the outcome T-11 forbids.
 */
function decodeStrictUtf8(bytes: Uint8Array): { text: string } | { failed: true } {
  try {
    return { text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes) };
  } catch {
    return { failed: true };
  }
}

/**
 * The scanner: recursive descent over a validated string, refusing everything RFC 8259
 * does not permit — and the few things it permits that this gate does not.
 */
export function parseStrictJson(bytes: Uint8Array): StrictJsonResult {
  const decoded = decodeStrictUtf8(bytes);
  if ('failed' in decoded) {
    // NOT a parse failure in the ordinary sense: the bytes are not text at all. Named
    // separately so an audit row distinguishes "malformed JSON" from "not valid UTF-8".
    return { ok: false, refusalKey: 'PARSE_FAILED', detail: 'INVALID_UTF8', offset: 0 };
  }

  const s = decoded.text;

  // A BOM is CONTENT. E1 · §4.3 refuses it rather than stepping over it, and repeating
  // that here means the rule holds whether or not the leading-byte sniff ran first.
  if (s.charCodeAt(0) === 0xfeff) {
    return { ok: false, refusalKey: 'BODY_NOT_JSON_SHAPED', detail: 'BOM_PRESENT', offset: 0 };
  }

  let i = 0;
  let nodes = 0;
  let maxDepth = 0;
  const lexicalNumberTokens: LexicalNumberToken[] = [];
  let failure: StrictJsonResult | null = null;

  /** Records the first failure and stops the walk. Later failures cannot overwrite it. */
  function fail(refusalKey: Refusable, detail: string): undefined {
    if (failure === null) failure = { ok: false, refusalKey, detail, offset: i };
    return undefined;
  }

  /** Only the four JSON whitespace characters. A NUL or a vertical tab is not one. */
  function skipWs(): void {
    while (i < s.length) {
      const c = s.charCodeAt(i);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) {
        i += 1;
        continue;
      }
      // Comments are not JSON. Caught here so the refusal says COMMENT_NOT_PERMITTED
      // rather than reporting a confusing "unexpected token" three rules later.
      if (c === 0x2f) {
        fail('PARSE_FAILED', 'COMMENT_NOT_PERMITTED');
        return;
      }
      break;
    }
  }

  function parseValue(depth: number, path: string): unknown {
    if (failure !== null) return undefined;
    if (depth > STRICT_JSON_MAX_DEPTH) return fail('PARSE_FAILED', 'MAX_DEPTH_EXCEEDED');
    if (depth > maxDepth) maxDepth = depth;

    nodes += 1;
    if (nodes > STRICT_JSON_MAX_NODES) return fail('PARSE_FAILED', 'MAX_NODES_EXCEEDED');

    skipWs();
    if (failure !== null) return undefined;
    if (i >= s.length) return fail('PARSE_FAILED', 'UNEXPECTED_END');

    const c = s[i];

    if (c === '{') return parseObject(depth, path);
    if (c === '[') return parseArray(depth, path);
    if (c === '"') return parseString();
    if (c === 't') return parseLiteral('true', true);
    if (c === 'f') return parseLiteral('false', false);
    if (c === 'n') return parseLiteral('null', null);
    if (c === '-' || (c >= '0' && c <= '9')) return parseNumber(path);

    // Single quotes, NaN and Infinity each get their own reason rather than being
    // lumped into one message, because the three have different causes and fixes.
    if (c === "'") return fail('PARSE_FAILED', 'SINGLE_QUOTED_STRING_NOT_PERMITTED');
    if (s.startsWith('NaN', i)) return fail('PARSE_FAILED', 'NAN_NOT_PERMITTED');
    if (s.startsWith('Infinity', i)) return fail('PARSE_FAILED', 'INFINITY_NOT_PERMITTED');
    return fail('PARSE_FAILED', 'UNEXPECTED_TOKEN');
  }

  function parseLiteral(word: string, value: unknown): unknown {
    if (!s.startsWith(word, i)) return fail('PARSE_FAILED', 'BAD_LITERAL');
    i += word.length;
    return value;
  }

  function parseObject(depth: number, path: string): unknown {
    i += 1; // consume {
    const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;

    /*
      DUPLICATE KEYS — E1 · P-2, asserted by T-10.

      `seen` is a Set rather than the object itself. The object has a NULL PROTOTYPE, but
      an `in` or `hasOwnProperty` check against an ordinary object would also answer true
      for "constructor", "__proto__" and "toString" — so a body using any of those as a
      key ONCE would be refused as a duplicate. A Set answers the question actually being
      asked: has this exact key already appeared in THIS object.
    */
    const seen = new Set<string>();

    skipWs();
    if (failure !== null) return undefined;
    if (s[i] === '}') {
      i += 1;
      return out;
    }

    for (;;) {
      skipWs();
      if (failure !== null) return undefined;
      if (i >= s.length) return fail('PARSE_FAILED', 'UNEXPECTED_END');
      if (s[i] !== '"') return fail('PARSE_FAILED', 'UNQUOTED_OBJECT_KEY');

      const key = parseString();
      if (failure !== null) return undefined;
      const k = key as string;

      if (seen.has(k)) return fail('PARSE_FAILED', 'DUPLICATE_OBJECT_KEY');
      seen.add(k);

      skipWs();
      if (s[i] !== ':') return fail('PARSE_FAILED', 'MISSING_NAME_SEPARATOR');
      i += 1;

      const v = parseValue(depth + 1, path + '/' + k);
      if (failure !== null) return undefined;
      out[k] = v;

      skipWs();
      if (failure !== null) return undefined;
      if (s[i] === ',') {
        i += 1;
        skipWs();
        // A trailing comma is legal in JavaScript and not in JSON.
        if (s[i] === '}') return fail('PARSE_FAILED', 'TRAILING_COMMA');
        continue;
      }
      if (s[i] === '}') {
        i += 1;
        return out;
      }
      return fail('PARSE_FAILED', 'MISSING_VALUE_SEPARATOR');
    }
  }

  function parseArray(depth: number, path: string): unknown {
    i += 1; // consume [
    const out: unknown[] = [];

    skipWs();
    if (failure !== null) return undefined;
    if (s[i] === ']') {
      i += 1;
      return out;
    }

    for (;;) {
      const v = parseValue(depth + 1, path + '/' + String(out.length));
      if (failure !== null) return undefined;
      out.push(v);

      skipWs();
      if (failure !== null) return undefined;
      if (s[i] === ',') {
        i += 1;
        skipWs();
        if (s[i] === ']') return fail('PARSE_FAILED', 'TRAILING_COMMA');
        continue;
      }
      if (s[i] === ']') {
        i += 1;
        return out;
      }
      return fail('PARSE_FAILED', 'MISSING_VALUE_SEPARATOR');
    }
  }

  function parseString(): unknown {
    i += 1; // consume opening quote
    let out = '';

    for (;;) {
      if (i >= s.length) return fail('PARSE_FAILED', 'UNTERMINATED_STRING');
      const c = s.charCodeAt(i);

      if (c === 0x22) {
        i += 1;
        return out;
      }

      // RFC 8259: control characters below 0x20 MUST be escaped inside a string.
      if (c < 0x20) return fail('PARSE_FAILED', 'UNESCAPED_CONTROL_CHARACTER');

      if (c !== 0x5c) {
        out += s[i];
        i += 1;
        continue;
      }

      i += 1;
      const e = s[i];
      if (e === '"') out += '"';
      else if (e === '\\') out += '\\';
      else if (e === '/') out += '/';
      else if (e === 'b') out += '\b';
      else if (e === 'f') out += '\f';
      else if (e === 'n') out += '\n';
      else if (e === 'r') out += '\r';
      else if (e === 't') out += '\t';
      else if (e === 'u') {
        const hex = s.slice(i + 1, i + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) return fail('PARSE_FAILED', 'BAD_UNICODE_ESCAPE');
        out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
      } else {
        // \x, \0 and \' are JavaScript escapes, not JSON ones.
        return fail('PARSE_FAILED', 'BAD_ESCAPE');
      }
      i += 1;
    }
  }

  function parseNumber(path: string): unknown {
    const start = i;

    if (s[i] === '-') i += 1;

    // Leading zeros are forbidden: "01" is not a JSON number.
    if (s[i] === '0') {
      i += 1;
    } else if (s[i] >= '1' && s[i] <= '9') {
      while (i < s.length && s[i] >= '0' && s[i] <= '9') i += 1;
    } else {
      return fail('PARSE_FAILED', 'BAD_NUMBER');
    }

    if (s[i] === '.') {
      i += 1;
      if (!(s[i] >= '0' && s[i] <= '9')) return fail('PARSE_FAILED', 'BAD_NUMBER_FRACTION');
      while (i < s.length && s[i] >= '0' && s[i] <= '9') i += 1;
    }

    if (s[i] === 'e' || s[i] === 'E') {
      i += 1;
      if (s[i] === '+' || s[i] === '-') i += 1;
      if (!(s[i] >= '0' && s[i] <= '9')) return fail('PARSE_FAILED', 'BAD_NUMBER_EXPONENT');
      while (i < s.length && s[i] >= '0' && s[i] <= '9') i += 1;
    }

    const token = s.slice(start, i);

    /*
      E1 · P-3 / T-13 — THE LEXICAL ROUND-TRIP.

      If the characters do not survive a trip through `Number` unchanged, the number this
      process would hold is NOT the number the publisher sent. The token is kept as
      characters instead. `1e400` (becomes Infinity), a 30-digit decimal (rounds) and
      `1.0` (renders as "1") all take this path — the last is harmless and is still
      recorded, because a rule with exceptions is a rule someone argues about later.
    */
    const asNumber = Number(token);
    if (String(asNumber) !== token) {
      lexicalNumberTokens.push({ path: path === '' ? '/' : path, token });
      return token;
    }
    return asNumber;
  }

  const root = parseValue(1, '');
  if (failure !== null) return failure;

  skipWs();
  if (failure !== null) return failure;

  // Trailing content after the top-level value: two concatenated JSON documents are not
  // one document, and accepting the first silently discards the second.
  if (i < s.length) {
    return { ok: false, refusalKey: 'PARSE_FAILED', detail: 'TRAILING_CONTENT', offset: i };
  }

  return { ok: true, value: root, nodes, maxDepth, lexicalNumberTokens };
}
