/**
 * T1 — ONE DEFINITION OF "THIS CREDENTIAL IS A PLACEHOLDER, NOT A KEY".
 *
 * THE MEASURED DEFECT. `isUsableGNewsApiKey` (and its Event Registry / OpenAI
 * twins) accepted any non-blank string, so the value `.env.example` ships —
 * `replace_with_your_gnews_key` — counted as "configured": provider selection
 * picked the live provider, the production startup guard passed, and the
 * first request failed upstream with an auth error instead of the process
 * reporting the truth (not configured).
 *
 * WHAT THIS REJECTS — WHOLE-VALUE MATCHES ONLY, NEVER SUBSTRINGS. A substring
 * rule would eventually reject a legitimate random key that happens to contain
 * "test" or "key", and a guard that fires on a correct configuration is worse
 * than none (the next person disables it). Every rule below is anchored to the
 * entire trimmed value:
 *
 *   - the exact shipped/obvious set from auth-secrets.config.ts
 *     (`change_me`, `changeme`, `placeholder`, `todo`, ...), plus a few
 *     API-key neighbours (`example`, `dummy`, `none`, `null`, `undefined`, ...)
 *   - `replace_with_...` / `replace-with-...` / `replace_me...`
 *   - `your_..._key|token|secret` / `your-api-key` / `your_key_here`
 *   - `<anything in angle brackets>`, `${...}`, `{{...}}` (unrendered templates)
 *   - runs of x / * / . / 0 only (`xxx`, `xxxx-xxxx`, `****`, `...`)
 *   - `dummy|example|sample|fake|test` followed only by an optional
 *     `[-_]api` and `[-_]key|token|secret` (`test-key`, `dummy_api_key`,
 *     `example-token`) — but NOT `test-key-12345` or any value carrying more
 *   - `insert_..._here`, `..._here` key-slot wording (`put_your_key_here`)
 *
 * Kept conservative and documented on purpose: false negatives cost a clear
 * upstream auth error; false positives would silently switch a real key off.
 */
import { SHIPPED_PLACEHOLDER_VALUES } from './auth-secrets.config';

const EXTRA_EXACT_PLACEHOLDERS: ReadonlySet<string> = new Set([
  'example',
  'dummy',
  'sample',
  'fake',
  'none',
  'null',
  'undefined',
  'n/a',
  'na',
  'tbd',
  'xxx',
  'api_key',
  'api-key',
  'apikey',
  'your_key',
  'your-key',
  'yourkey',
]);

const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /^replace[_-]?(with|me)([_-][\w.-]*)?$/,
  /^your[_-][\w-]*?(key|token|secret)([_-]here)?$/,
  /^<[^<>]*>$/,
  /^\$\{[^{}]*\}$/,
  /^\{\{[^{}]*\}\}$/,
  /^[x*.0]+(?:[-_][x*.0]+)*$/,
  /^(dummy|example|sample|fake|test)([_-]?api)?([_-]?(key|token|secret))?$/,
  /^(insert|put|paste|enter|add)[_-][\w-]*[_-]here$/,
];

/** True when the (trimmed) value is an obvious placeholder rather than a credential. */
export function isPlaceholderCredential(value: string | undefined | null): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return false;
  if (SHIPPED_PLACEHOLDER_VALUES.has(normalized) || EXTRA_EXACT_PLACEHOLDERS.has(normalized)) {
    return true;
  }
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * The shared usability rule for every provider API key/token: a string, not
 * whitespace-only, and not a placeholder. Provider selection, startup
 * validation and health must all use this (via their provider-named wrappers)
 * so they can never disagree.
 */
export function isUsableApiCredential(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !isPlaceholderCredential(value);
}

/** Why a credential is unusable, for logs and health — never echoes the value. */
export function describeUnusableCredential(
  name: string,
  value: string | undefined | null,
): string {
  if (value === undefined || value === null || value === '') return `${name} is missing or empty.`;
  if (value.trim().length === 0) return `${name} is whitespace-only.`;
  if (isPlaceholderCredential(value))
    return `${name} is a placeholder value (e.g. the .env.example template), not a real credential.`;
  return `${name} is configured.`;
}
