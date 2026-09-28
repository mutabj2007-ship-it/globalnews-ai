import { EXTERNAL_LINK_REL, EXTERNAL_URL_MAX_LENGTH, safeExternalHref } from './externalUrl';

/**
 * B-1 ACCEPTANCE — E1's hostile citation-URL corpus, carried VERBATIM.
 *
 * Source: E1-ASK-R2-SECURITY-REMEDIATION-VERIFICATION-R1 / harness/b1-url-corpus.js
 * (sha256 1c0c788f4aefe1173fda4408cfddedcc36448da0ba80a5706124421c666b523d).
 * The rows below are the harness's CORPUS array unedited. The verdict rule is the
 * harness's own: a non-empty string is ACCEPT, anything else (or a throw) is REJECT.
 *
 * This spec is implementation-facing evidence. It is NOT E1 certification: E1
 * re-runs its own harness against this module independently.
 */
const CORPUS: Array<[unknown, 'ACCEPT' | 'REJECT', string]> = [
  ['https://example.com/a', 'ACCEPT', 'legitimate https'],
  ['http://example.com/a', 'ACCEPT', 'legitimate http'],
  ['https://example.com/a?b=1#c', 'ACCEPT', 'query + fragment'],
  ['https://xn--80ak6aa92e.com/', 'ACCEPT', 'punycode IDN host'],
  ['https://example.com/pa%20th', 'ACCEPT', 'percent-encoded path'],

  ['javascript:alert(1)', 'REJECT', 'javascript:'],
  ['JavaScript:alert(1)', 'REJECT', 'mixed-case scheme'],
  ['JAVASCRIPT:alert(1)', 'REJECT', 'upper-case scheme'],
  ['  javascript:alert(1)', 'REJECT', 'leading whitespace'],
  ['javascript:alert(1)   ', 'REJECT', 'trailing whitespace'],
  ['\tjavascript:alert(1)', 'REJECT', 'leading tab'],
  ['\njavascript:alert(1)', 'REJECT', 'leading newline'],
  ['java\tscript:alert(1)', 'REJECT', 'TAB inside the scheme'],
  ['java\nscript:alert(1)', 'REJECT', 'LF inside the scheme'],
  ['java\rscript:alert(1)', 'REJECT', 'CR inside the scheme'],
  ['java\u0000script:alert(1)', 'REJECT', 'NUL inside the scheme'],
  ['jav\u0001ascript:alert(1)', 'REJECT', 'SOH control char'],
  ['\u200Bjavascript:alert(1)', 'REJECT', 'zero-width space prefix'],
  ['\uFEFFjavascript:alert(1)', 'REJECT', 'BOM prefix'],

  ['data:text/html,<script>alert(1)</script>', 'REJECT', 'data: html'],
  ['data:text/html;base64,PHNjcmlwdD4=', 'REJECT', 'data: base64'],
  ['DATA:text/html,x', 'REJECT', 'data: mixed case'],
  ['blob:https://example.com/uuid', 'REJECT', 'blob:'],
  ['file:///etc/passwd', 'REJECT', 'file:'],
  ['file://C:/Windows/win.ini', 'REJECT', 'file: windows'],
  ['vbscript:msgbox(1)', 'REJECT', 'vbscript:'],
  ['about:blank', 'REJECT', 'about:'],
  ['chrome://settings', 'REJECT', 'custom scheme'],
  ['intent://x#Intent;scheme=http;end', 'REJECT', 'android intent:'],
  ['mailto:a@b.c', 'REJECT', 'mailto: outside the allowlist'],
  ['tel:+123', 'REJECT', 'tel: outside the allowlist'],
  ['ws://example.com', 'REJECT', 'websocket scheme'],
  ['ftp://example.com/a', 'REJECT', 'ftp:'],

  ['&#106;avascript:alert(1)', 'REJECT', 'HTML entity encoded j'],
  ['&#x6A;avascript:alert(1)', 'REJECT', 'hex entity encoded j'],
  ['%6Aavascript:alert(1)', 'REJECT', 'percent-encoded scheme byte'],
  ['java%09script:alert(1)', 'REJECT', 'percent-encoded TAB in scheme'],
  ['%20javascript:alert(1)', 'REJECT', 'percent-encoded leading space'],
  ['\\/\\/evil.example', 'REJECT', 'backslash protocol-relative'],
  ['//evil.example/a', 'REJECT', 'protocol-relative inherits page scheme'],
  ['https:/\\evil.example', 'REJECT', 'mixed slash authority'],

  ['', 'REJECT', 'empty string'],
  ['   ', 'REJECT', 'whitespace only'],
  ['not a url', 'REJECT', 'malformed'],
  ['http://', 'REJECT', 'scheme with no host'],
  ['https://', 'REJECT', 'https with no host'],
  ['h'.repeat(70000), 'REJECT', 'absurd length'],
  [null, 'REJECT', 'null'],
  [undefined, 'REJECT', 'undefined'],
  [{ toString: () => 'javascript:alert(1)' }, 'REJECT', 'object with hostile toString'],
];

function verdict(boundary: (input: unknown) => unknown, input: unknown): 'ACCEPT' | 'REJECT' {
  let out: unknown;
  try {
    out = boundary(input);
  } catch {
    out = null;
  }
  return typeof out === 'string' && out.length > 0 ? 'ACCEPT' : 'REJECT';
}

function score(boundary: (input: unknown) => unknown): { pass: number; failures: string[] } {
  const failures: string[] = [];
  let pass = 0;
  for (const [input, required, label] of CORPUS) {
    if (verdict(boundary, input) === required) pass += 1;
    else failures.push(label);
  }
  return { pass, failures };
}

describe('B-1 — safeExternalHref against E1’s 50-row corpus', () => {
  it('the corpus is the harness’s: 50 rows, 5 ACCEPT / 45 REJECT', () => {
    expect(CORPUS).toHaveLength(50);
    expect(CORPUS.filter((row) => row[1] === 'ACCEPT')).toHaveLength(5);
  });

  it('scores 50/50', () => {
    const result = score(safeExternalHref);
    expect(result.failures).toEqual([]);
    expect(result.pass).toBe(50);
  });

  it('controls still bite: the as-shipped identity boundary scores 8/50, refuse-everything 45/50', () => {
    expect(score((u) => (u === null || u === undefined ? null : String(u))).pass).toBe(8);
    expect(score(() => null).pass).toBe(45);
  });

  it('accepted values are canonicalised (one normalised string per input)', () => {
    expect(safeExternalHref('HTTPS://Example.COM/a')).toBe('https://example.com/a');
    expect(safeExternalHref('https://example.com')).toBe('https://example.com/');
  });

  it('refuses embedded credentials and over-length input; the rel constant carries noopener', () => {
    expect(safeExternalHref('https://user:pass@example.com/')).toBeUndefined();
    expect(safeExternalHref(`https://example.com/${'a'.repeat(EXTERNAL_URL_MAX_LENGTH)}`)).toBeUndefined();
    expect(EXTERNAL_LINK_REL).toBe('noopener noreferrer');
  });
});
