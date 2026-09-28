/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · B-1 — THE ONE EXTERNAL URL BOUNDARY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every externally-derived source / citation / publisher link in the product
 * passes through `safeExternalHref` before it reaches an `href`. There is no
 * second scheme check anywhere: components do not decide what a safe URL is.
 *
 * Acceptance authority: E1-ASK-R2-SECURITY-REMEDIATION-VERIFICATION-R1,
 * `harness/b1-url-corpus.js` — 50 rows, required 50/50, with a refuse-everything
 * control that must fail the five ACCEPT rows.
 *
 * FAIL CLOSED. The input is accepted only when ALL of these hold; otherwise the
 * result is `undefined` (JSX then renders no `href` at all — an inert anchor,
 * never a live hostile one):
 *
 *   1. it is a primitive string (an object with a hostile `toString` is refused
 *      rather than coerced);
 *   2. it is at most EXTERNAL_URL_MAX_LENGTH characters;
 *   3. it contains no whitespace, no C0/C1 control character and no invisible
 *      format character (zero-width space, BOM, bidi controls …) ANYWHERE —
 *      browsers strip or ignore those, so `java\tscript:` is `javascript:`;
 *   4. its RAW text begins with exactly `http://` or `https://`
 *      (case-insensitive) — this is what refuses entity encodings (`&#106;…`),
 *      percent-encoded schemes (`%6A…`), protocol-relative `//host` and the
 *      backslash forms, none of which a parser should be trusted to interpret;
 *   5. the WHATWG URL parser agrees: protocol `http:`/`https:`, a non-empty
 *      hostname, and no embedded credentials.
 *
 * The accepted value is returned CANONICALISED (`URL.href`), so every surface
 * links the same normalised string for the same input.
 */

export const EXTERNAL_URL_MAX_LENGTH = 4096;

const ALLOWED_PREFIX = /^https?:\/\//i;

/*
  Whitespace (including NBSP and the Unicode space separators), C0 and C1
  controls, and the invisible format characters a browser drops while parsing:
  zero-width space/joiners, word joiner, BOM, soft hyphen, bidi embeddings,
  overrides and isolates.
*/
const FORBIDDEN_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x0020], // C0 controls and SPACE
  [0x007f, 0x00a0], // DEL, C1 controls, NBSP
  [0x00ad, 0x00ad], // soft hyphen
  [0x1680, 0x1680], // ogham space mark
  [0x180e, 0x180e], // mongolian vowel separator
  [0x2000, 0x200f], // Unicode spaces, zero-width space/joiners, LRM/RLM
  [0x2028, 0x202f], // line/paragraph separators, bidi embeddings/overrides, NNBSP
  [0x205f, 0x206f], // medium math space, word joiner, invisible operators, bidi isolates
  [0x3000, 0x3000], // ideographic space
  [0xfeff, 0xfeff], // BOM / zero-width no-break space
];

function hasForbiddenCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    for (const [low, high] of FORBIDDEN_RANGES) {
      if (code >= low && code <= high) return true;
    }
  }
  return false;
}

export function safeExternalHref(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.length === 0 || value.length > EXTERNAL_URL_MAX_LENGTH) return undefined;
  if (hasForbiddenCharacter(value)) return undefined;
  if (!ALLOWED_PREFIX.test(value)) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
  if (parsed.hostname.length === 0) return undefined;
  if (parsed.username !== '' || parsed.password !== '') return undefined;
  return parsed.href;
}

/** The `rel` every external link carries. One value, one place. */
export const EXTERNAL_LINK_REL = 'noopener noreferrer';
