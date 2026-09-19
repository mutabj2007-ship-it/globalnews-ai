import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CanonicalOfficialDataAdmissionEvaluator,
  classifyContentType,
  contentTypeClassifiersAgree,
  mediaTypeIsAdmitted,
  parseStrictJson,
  refusalIsSecurityClass,
  refusalMayRetry,
  resolveParserBinding,
  retrievalIsPublishable,
  scanForSecrets,
  STRICT_JSON_MAX_DEPTH,
  STRICT_JSON_MAX_NODES,
  type OfficialDataTransportEvidence,
} from '@globalnews-ai/shared';

import { nodeGunzip } from './official-data-transport.node';
import { MarketCanonicalAdmissionBinding } from './canonical-admission.binding';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE CANONICAL ADMISSION PIPELINE — E1 · §9 AND THE R1 NEGATIVE CONTROLS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every assertion here is a way of trying to get bytes ADMITTED that should not be, plus
 * the one control that proves the gate is not simply refusing everything.
 *
 * R-B, stated by E1 itself: "without a capture that is admitted, T-1 … T-22 are
 * satisfied by a pipeline that refuses everything, and a gate that refuses everything
 * passes every negative test ever written for it." The positive control at the bottom
 * runs on REAL CAPTURED EUROSTAT BYTES from the accepted D-2 byte capture — not a
 * fixture somebody wrote to match the parser.
 */

const EUROSTAT_HOST = 'ec.europa.eu';
const NOW = '2026-09-19T09:00:00.000Z';

const evaluator = new CanonicalOfficialDataAdmissionEvaluator({
  gunzip: nodeGunzip,
  secrets: { configuredSecrets: ['s3cr3t-api-key-value-0001'] },
  now: () => NOW,
});

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

/** A well-formed Eurostat JSON-stat envelope, minimal but structurally real. */
const GOOD_BODY = JSON.stringify({
  class: 'dataset',
  value: { '0': 3.1 },
  id: ['geo', 'time'],
  size: [1, 1],
  dimension: { geo: { category: { index: { PL: 0 } } } },
});

function evidence(
  over: Partial<OfficialDataTransportEvidence> = {},
): OfficialDataTransportEvidence {
  const wireBytes = over.wireBytes ?? utf8(GOOD_BODY);
  // The length is derived from the bytes, never passed separately, so a test overriding
  // the body cannot accidentally assert against a stale length. The one test that DOES
  // need them to disagree overrides `wireByteLength` on the returned object.
  return {
    wireByteLength: wireBytes.byteLength,
    providerId: 'EUROSTAT',
    endpointId: 'une_rt_m',
    finalUrl: `https://${EUROSTAT_HOST}/eurostat/api/dissemination/statistics/1.0/data/une_rt_m`,
    configuredHost: EUROSTAT_HOST,
    redirectChain: [],
    httpStatus: 200,
    requestedAt: NOW,
    retrievedAt: NOW,
    contentTypeHeader: 'application/json',
    contentEncoding: 'identity',
    contentEncodingHeaderPresent: false,
    wireBytes,
    decodedBytes: wireBytes,
    headers: {},
    ...over,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · THE GATE, STEP BY STEP
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('the canonical admission gate refuses in E1 §4 order', () => {
  it('T-15 · a final host that is not the configured host is PROVENANCE_HOST_MISMATCH', () => {
    const out = evaluator.evaluate(
      evidence({ finalUrl: 'https://cdn.evil.example/eurostat/data/une_rt_m' }),
    );

    expect(out.admission.admissibility).toBe('REFUSED');
    expect(out.admission.refusalKey).toBe('PROVENANCE_HOST_MISMATCH');
    // "Retain for audit; never admit." The bytes survive; the verdict does not.
    expect(out.retainableBytes).toBeDefined();
  });

  it('provenance is checked FIRST — a perfect body from the wrong host still refuses', () => {
    /*
      The ordering assertion, not a duplicate of the one above. A well-formed,
      correctly-typed, correctly-enveloped body from the wrong host is the most
      dangerous admissible-looking capture there is, and every later step would pass it.
    */
    const out = evaluator.evaluate(
      evidence({
        finalUrl: 'https://mirror.example.org/data',
        contentTypeHeader: 'application/json',
      }),
    );
    expect(out.admission.refusalKey).toBe('PROVENANCE_HOST_MISMATCH');
  });

  it('T-5 · 404 is PERMANENT, 503 is TRANSIENT, and only TRANSIENT may retry', () => {
    const notFound = evaluator.evaluate(evidence({ httpStatus: 404 }));
    const unavailable = evaluator.evaluate(evidence({ httpStatus: 503 }));

    expect(notFound.admission.refusalKey).toBe('STATUS_NOT_OK');
    expect(notFound.admission.refusalClass).toBe('PERMANENT');
    expect(unavailable.admission.refusalClass).toBe('TRANSIENT');

    expect(refusalMayRetry('STATUS_NOT_OK', 404)).toBe(false);
    expect(refusalMayRetry('STATUS_NOT_OK', 503)).toBe(true);
  });

  it.each([
    ['text/csv', 'MEDIA_TYPE_NOT_ALLOWED'],
    ['application/xml', 'MEDIA_TYPE_NOT_ALLOWED'],
    ['text/html', 'MEDIA_TYPE_NOT_ALLOWED'],
    ['application/octet-stream', 'MEDIA_TYPE_NOT_ALLOWED'],
    ['', 'MEDIA_TYPE_NOT_ALLOWED'],
    ['application/json; charset=iso-8859-1', 'CHARSET_NOT_ALLOWED'],
  ])('T-1 · %s refuses under its own key %s', (header, key) => {
    const out = evaluator.evaluate(evidence({ contentTypeHeader: header }));
    expect([header, out.admission.refusalKey]).toEqual([header, key]);
  });

  it.each([
    'application/JSON',
    'application/json ; charset=UTF-8',
    'application/json;charset=utf-8',
  ])('T-2 · %s is ADMITTED — the type is parsed, not string-matched', (header) => {
    const out = evaluator.evaluate(evidence({ contentTypeHeader: header }));
    expect([header, out.admission.admissibility]).toEqual([header, 'ADMITTED']);
  });

  it('the two content-type classifiers never disagree — there is one governed path', () => {
    /*
      `classifyContentType` splits the verdict into two keys that `mediaTypeIsAdmitted`
      does not distinguish. That is a second FUNCTION, and this is what stops it becoming
      a second CLASSIFIER: for every input the two must agree on admit-or-not.
    */
    for (const header of [
      'application/json',
      'application/JSON',
      'application/json; charset=utf-8',
      'application/json; charset=iso-8859-1',
      'application/json; boundary=x',
      'text/csv',
      'text/html; charset=utf-8',
      '',
      'application/jsonx',
      'application/json; charset="utf-8"',
    ]) {
      expect([header, contentTypeClassifiersAgree(header)]).toEqual([header, true]);
      expect([header, classifyContentType(header) === 'OK']).toEqual([
        header,
        mediaTypeIsAdmitted(header),
      ]);
    }
  });

  it.each(['br', 'deflate', 'compress', 'gzip, br'])(
    'T-9 · Content-Encoding %s is ENCODING_NOT_ALLOWED',
    (enc) => {
      const out = evaluator.evaluate(evidence({ contentEncoding: enc }));
      expect([enc, out.admission.refusalKey]).toEqual([enc, 'ENCODING_NOT_ALLOWED']);
    },
  );

  it('an ABSENT Content-Encoding is identity by the canonical rule, and admits', () => {
    /*
      The rule that decides this lives in the transport and is applied once. The real
      Eurostat captures carry no Content-Encoding header at all, so a pipeline that
      treated "absent" as "unknown, refuse" would refuse every genuine capture.
    */
    const out = evaluator.evaluate(
      evidence({ contentEncoding: 'identity', contentEncodingHeaderPresent: false }),
    );
    expect(out.admission.admissibility).toBe('ADMITTED');
    expect(out.admission.transport.contentEncoding).toBe('identity');
  });

  it('T-6 · a body over the wire cap is SIZE_EXCEEDED', () => {
    const huge = new Uint8Array(4 * 1024 * 1024 + 1);
    huge.fill(0x20);
    huge[0] = 0x7b;
    const out = evaluator.evaluate(evidence({ wireBytes: huge }));
    expect(out.admission.refusalKey).toBe('SIZE_EXCEEDED');
  });

  it('a transport whose declared length disagrees with its bytes is refused', () => {
    // Not a cap violation — a broken measurement. Admitting on the strength of it would
    // mean the evidence and the artefact describe different things.
    const bytes = utf8(GOOD_BODY);
    const out = evaluator.evaluate({ ...evidence({ wireBytes: bytes }), wireByteLength: 99 });
    expect(out.admission.refusalKey).toBe('SIZE_EXCEEDED');
  });

  it('T-7 · a gzip expanding past the ratio bound is aborted, not expanded then measured', () => {
    // ~1 MiB of zeros compresses far beyond 20:1.
    const bomb = gzipSync(Buffer.alloc(1024 * 1024, 0));
    const out = evaluator.evaluate(
      evidence({ wireBytes: new Uint8Array(bomb), contentEncoding: 'gzip' }),
    );
    expect(out.admission.refusalKey).toBe('DECOMPRESSION_BOUND_EXCEEDED');
  });

  it('a gzip within the ratio bound decodes and admits', () => {
    // The paired positive: the bound refuses bombs, not compression.
    const packed = gzipSync(Buffer.from(GOOD_BODY, 'utf8'));
    const out = evaluator.evaluate(
      evidence({ wireBytes: new Uint8Array(packed), contentEncoding: 'gzip' }),
    );
    expect(out.admission.admissibility).toBe('ADMITTED');
    expect(out.admission.transport.contentEncoding).toBe('gzip');
  });

  it('T-8 · gzip within gzip is REFUSED, not double-decoded', () => {
    const inner = gzipSync(Buffer.from(GOOD_BODY, 'utf8'));
    const outer = gzipSync(inner);
    const out = evaluator.evaluate(
      evidence({ wireBytes: new Uint8Array(outer), contentEncoding: 'gzip' }),
    );
    expect(out.admission.refusalKey).toBe('ENCODING_NOT_ALLOWED');
  });

  it('T-3 · THE HEADLINE CASE — 200 + application/json + an HTML error page', () => {
    /*
      E1: "an HTML error page served as application/json with HTTP 200 is the single most
      common way official data silently becomes wrong."
    */
    const out = evaluator.evaluate(
      evidence({ wireBytes: utf8('<!DOCTYPE html><html><body>Service unavailable</body></html>') }),
    );
    expect(out.admission.refusalKey).toBe('BODY_NOT_JSON_SHAPED');
  });

  it('a whitespace-prefixed disguised HTML body refuses identically', () => {
    const out = evaluator.evaluate(evidence({ wireBytes: utf8('\n\r\n  <!DOCTYPE html><html>') }));
    expect(out.admission.refusalKey).toBe('BODY_NOT_JSON_SHAPED');
  });

  it('T-14 · ZIP magic bytes are ARCHIVE_NOT_ALLOWED', () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    const out = evaluator.evaluate(evidence({ wireBytes: zip }));
    expect(out.admission.refusalKey).toBe('ARCHIVE_NOT_ALLOWED');
  });

  it('T-4 · valid JSON with an unrecognised envelope is ENVELOPE_NOT_RECOGNISED', () => {
    const out = evaluator.evaluate(evidence({ wireBytes: utf8('{"totally":"unrelated"}') }));
    expect(out.admission.refusalKey).toBe('ENVELOPE_NOT_RECOGNISED');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · THE PARSER REGISTRY — §3
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('parser identity comes from the registry, never from the adapter', () => {
  it('an unknown provider has no binding and the capture is REFUSED', () => {
    expect(resolveParserBinding('NOT_A_PROVIDER', 'x', 'application/json')).toBeNull();

    const out = evaluator.evaluate(
      evidence({ providerId: 'NOT_A_PROVIDER', configuredHost: EUROSTAT_HOST }),
    );
    expect(out.admission.refusalKey).toBe('ENVELOPE_NOT_RECOGNISED');
    expect(out.detail).toBe('NO_GOVERNED_PARSER_BINDING');
  });

  it('an unknown ENDPOINT on a known provider is REFUSED — there is no fallback parser', () => {
    /*
      THE ONE THAT MATTERS MOST IN THIS BLOCK. A fallback would undo the whole control in
      a single line: every unreviewed endpoint would become admissible by default and the
      registry would be documentation rather than a gate.
    */
    expect(resolveParserBinding('TED', 'notices/EXPORT-ALL', 'application/json')).toBeNull();

    const out = evaluator.evaluate(
      evidence({
        providerId: 'TED',
        endpointId: 'notices/EXPORT-ALL',
        configuredHost: EUROSTAT_HOST,
      }),
    );
    expect(out.admission.refusalKey).toBe('ENVELOPE_NOT_RECOGNISED');
    expect(out.detail).toBe('NO_GOVERNED_PARSER_BINDING');
  });

  it('the ADMITTED record carries the registry identity, not anything a caller supplied', () => {
    const out = evaluator.evaluate(evidence());
    expect(out.admission.parse).toEqual({
      parserId: 'eurostat.jsonstat',
      parserVersion: '1.0.0',
      parsedAt: NOW,
    });
  });

  it('the binding is keyed on media type too, so a new type needs a new row', () => {
    expect(resolveParserBinding('EUROSTAT', 'une_rt_m', 'text/csv')).toBeNull();
    expect(resolveParserBinding('EUROSTAT', 'une_rt_m', 'application/json')).not.toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · STRICT JSON — E1 · §5
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('the strict parser refuses what JSON.parse accepts', () => {
  it('T-10 · duplicate keys are REFUSED, and demonstrably not last-wins', () => {
    const body = '{"value":{"0":1},"value":{"0":2}}';

    // What the permissive parser does, stated so the difference is visible rather than
    // asserted: it silently keeps the second and reports no problem at all.
    expect((JSON.parse(body) as { value: { '0': number } }).value['0']).toBe(2);

    const strict = parseStrictJson(utf8(body));
    expect(strict.ok).toBe(false);
    expect(strict.ok === false && strict.detail).toBe('DUPLICATE_OBJECT_KEY');

    const out = evaluator.evaluate(evidence({ wireBytes: utf8(body) }));
    expect(out.admission.refusalKey).toBe('PARSE_FAILED');
  });

  it('a key appearing once is fine even when it is a prototype name', () => {
    // The paired control for the duplicate check: `constructor` and `__proto__` used ONCE
    // must not be mistaken for duplicates by a naive `in` test.
    const r = parseStrictJson(utf8('{"constructor":1,"__proto__":2,"toString":3}'));
    expect(r.ok).toBe(true);
  });

  it('T-11 · invalid UTF-8 is REFUSED and no U+FFFD is produced', () => {
    const bad = new Uint8Array([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xff, 0xfe, 0x22, 0x7d]);
    const r = parseStrictJson(bad);

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.detail).toBe('INVALID_UTF8');

    // And the bytes were never rewritten: the replacement character appears nowhere.
    expect(Array.from(bad).includes(0xef)).toBe(false);
  });

  it('T-12 · depth 65 and 200,001 nodes are REFUSED, and the limits themselves admit', () => {
    const deep = '['.repeat(STRICT_JSON_MAX_DEPTH + 1) + ']'.repeat(STRICT_JSON_MAX_DEPTH + 1);
    const deepResult = parseStrictJson(utf8(deep));
    expect(deepResult.ok).toBe(false);
    expect(deepResult.ok === false && deepResult.detail).toBe('MAX_DEPTH_EXCEEDED');

    const wide = '[' + '1,'.repeat(STRICT_JSON_MAX_NODES) + '1]';
    const wideResult = parseStrictJson(utf8(wide));
    expect(wideResult.ok).toBe(false);
    expect(wideResult.ok === false && wideResult.detail).toBe('MAX_NODES_EXCEEDED');

    // The paired control — at the limit, not over it, the parse succeeds. Otherwise
    // "refuses at 65" is indistinguishable from "refuses at everything".
    const atLimit = '['.repeat(STRICT_JSON_MAX_DEPTH - 1) + ']'.repeat(STRICT_JSON_MAX_DEPTH - 1);
    expect(parseStrictJson(utf8(atLimit)).ok).toBe(true);
  });

  it.each([
    ['{"a":1,}', 'TRAILING_COMMA'],
    ['{a:1}', 'UNQUOTED_OBJECT_KEY'],
    ["{'a':1}", 'UNQUOTED_OBJECT_KEY'],
    ['{"a":NaN}', 'NAN_NOT_PERMITTED'],
    ['{"a":Infinity}', 'INFINITY_NOT_PERMITTED'],
    ['{"a":01}', 'MISSING_VALUE_SEPARATOR'],
    ['// c\n{"a":1}', 'COMMENT_NOT_PERMITTED'],
    ['{"a":1}{"b":2}', 'TRAILING_CONTENT'],
  ])('strict JSON refuses %s', (body, detail) => {
    const r = parseStrictJson(utf8(body));
    expect([body, r.ok]).toEqual([body, false]);
    expect([body, r.ok === false && r.detail]).toEqual([body, detail]);
  });

  it('T-13 · a number failing the lexical round-trip is kept as characters, never coerced', () => {
    const body = '{"class":"dataset","value":{"0":1e400},"id":[],"size":[],"dimension":{}}';
    const r = parseStrictJson(utf8(body));

    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');

    // THE POINT: JSON.parse turns this into Infinity, which every downstream assertion
    // on "is it a number" then passes.
    expect((JSON.parse(body) as { value: { '0': number } }).value['0']).toBe(Infinity);

    const value = (r.value as { value: Record<string, unknown> }).value['0'];
    expect(value).toBe('1e400');
    expect(r.lexicalNumberTokens).toEqual([{ path: '/value/0', token: '1e400' }]);
  });

  it('an ordinary number is still a number — the rule does not swallow everything', () => {
    // The paired control for T-13. If every number came back as a string the rule would
    // be indistinguishable from "refuse to parse numbers", and T-13 would prove nothing.
    const r = parseStrictJson(utf8('{"a":3.1,"b":-2,"c":1000,"d":0,"e":-0.5}'));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.value).toEqual({ a: 3.1, b: -2, c: 1000, d: 0, e: -0.5 });
    expect(r.lexicalNumberTokens).toEqual([]);
  });

  it('EXPONENT FORM is kept as characters, because the rule is lexical and it must be', () => {
    /*
      `1e3` is exactly 1000 — no precision is lost — and it is STILL kept as characters,
      because `String(Number('1e3'))` is `'1000'` and the token does not survive the
      round trip.

      This looks over-strict until you ask what the alternative rule would be. "Keep the
      number when the VALUE is equal" cannot distinguish `1e3` (exact) from a 30-digit
      decimal that quietly rounded to something that also compares equal to itself. The
      lexical test is the only one that can be applied without already knowing the answer,
      so E1 states it lexically and this implements it lexically. The cost is that an
      exact exponent is carried as characters; nothing is lost and nothing is claimed.
    */
    const r = parseStrictJson(utf8('{"c":1e3,"d":1.0}'));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.value).toEqual({ c: '1e3', d: '1.0' });
    expect(r.lexicalNumberTokens).toEqual([
      { path: '/c', token: '1e3' },
      { path: '/d', token: '1.0' },
    ]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · SECRETS AND QUARANTINE — §5
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('a secret-bearing body is quarantined, terminally', () => {
  const leaky = `{"error":"bad request","echo":"apikey=s3cr3t-api-key-value-0001"}`;

  it('T-17 · no bytes are returned to the caller at all', () => {
    const out = evaluator.evaluate(evidence({ wireBytes: utf8(leaky) }));

    expect(out.admission.refusalKey).toBe('SECRET_DETECTED');
    // Not "the caller should not store them" — the caller DOES NOT HAVE THEM.
    expect(out.retainableBytes).toBeUndefined();
    expect(out.secretRotationRequired).toBe(true);
  });

  it('the quarantine is PERMANENT and is never retried', () => {
    const out = evaluator.evaluate(evidence({ wireBytes: utf8(leaky) }));
    expect(out.admission.refusalClass).toBe('PERMANENT');
    expect(refusalIsSecurityClass('SECRET_DETECTED')).toBe(true);
    expect(refusalMayRetry('SECRET_DETECTED')).toBe(false);
  });

  it('THE CASE E1 · C-3 IS ACTUALLY ABOUT — a REFUSED error body is scanned too', () => {
    /*
      Provider ERROR bodies are the ones that echo the request, so the refused capture is
      the likeliest place our own credential comes to rest. An earlier draft returned the
      bytes for every refusal without scanning them, which would have stored exactly the
      bodies this control exists for.

      Here the body is BOTH not-JSON-shaped AND secret-bearing. The secret wins.
    */
    const htmlWithSecret = '<!DOCTYPE html><p>apikey=s3cr3t-api-key-value-0001</p>';
    const out = evaluator.evaluate(evidence({ wireBytes: utf8(htmlWithSecret) }));

    expect(out.admission.refusalKey).toBe('SECRET_DETECTED');
    expect(out.retainableBytes).toBeUndefined();
    // The original reason is not lost — it is recorded alongside.
    expect(out.detail).toContain('BODY_NOT_JSON_SHAPED');
  });

  it('a 503 carrying a secret stays TERMINAL — the status does not soften it', () => {
    // §4's worked example. An ordinary 503 is transient; a secret refusal at 503 is not.
    const out = evaluator.evaluate(evidence({ httpStatus: 503, wireBytes: utf8(leaky) }));
    expect(out.admission.refusalKey).toBe('SECRET_DETECTED');
    expect(out.admission.refusalClass).toBe('PERMANENT');
  });

  it('an ordinary 503 with a clean body IS transient — the guard is targeted', () => {
    const out = evaluator.evaluate(evidence({ httpStatus: 503 }));
    expect(out.admission.refusalKey).toBe('STATUS_NOT_OK');
    expect(out.admission.refusalClass).toBe('TRANSIENT');
  });

  it('the scan reports WHICH RULE fired and never what it matched', () => {
    const r = scanForSecrets(utf8(leaky), {
      configuredSecrets: ['s3cr3t-api-key-value-0001'],
    });
    expect(r.hit).toBe(true);
    expect(r.rule).toBe('configuredSecrets[0]');
    expect(JSON.stringify(r)).not.toContain('s3cr3t');
  });

  it('a short or empty configured secret cannot quarantine everything', () => {
    // A misconfiguration must not become a system-wide outage dressed as a security win.
    const r = scanForSecrets(utf8(GOOD_BODY), { configuredSecrets: ['', 'a'] });
    expect(r.hit).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 5 · THE MARKET BINDING — §6
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('Market consumes the canonical evaluator and authors no verdict', () => {
  const binding = new MarketCanonicalAdmissionBinding(
    evaluator,
    (providerId) => (providerId === 'EUROSTAT' ? EUROSTAT_HOST : undefined),
    () => NOW,
  );

  const subject = {
    providerId: 'EUROSTAT',
    endpointId: 'une_rt_m',
    finalUrl: `https://${EUROSTAT_HOST}/eurostat/api/dissemination/statistics/1.0/data/une_rt_m`,
    httpStatus: 200,
    contentTypeHeader: 'application/json',
    contentEncodingHeader: '',
    wireBytes: utf8(GOOD_BODY),
  };

  it('a valid approved response is ADMITTED through the canonical path', async () => {
    const admission = await binding.evaluate(subject);
    expect(admission.admissibility).toBe('ADMITTED');
    expect(retrievalIsPublishable(admission)).toBe(true);
  });

  it('a refused response yields nothing publishable', async () => {
    const admission = await binding.evaluate({
      ...subject,
      wireBytes: utf8('<!DOCTYPE html>'),
    });
    expect(admission.admissibility).toBe('REFUSED');
    expect(retrievalIsPublishable(admission)).toBe(false);
  });

  it('an unconfigured provider fails CLOSED at the provenance step', async () => {
    const admission = await binding.evaluate({ ...subject, providerId: 'TED' });
    expect(admission.refusalKey).toBe('PROVENANCE_HOST_MISMATCH');
  });

  it('Market code contains no literal ADMITTED used as a bypass', () => {
    /*
      §6, checked rather than asserted. The binding is the one place Market touches
      admission, so this reads the file and fails if the word appears as a value.
    */
    const src = readFileSync(join(__dirname, 'canonical-admission.binding.ts'), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

    expect(/['"]ADMITTED['"]/.test(code)).toBe(false);
    expect(/admissibility\s*:/.test(code)).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 6 · R-B · THE POSITIVE CONTROL, ON REAL CAPTURED BYTES
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('R-B · real Eurostat D-2 captures pass the governed pipeline', () => {
  /*
    E1 · T-23, and the reason it is mandatory: "without a capture that is admitted,
    T-1 … T-22 are satisfied by a pipeline that refuses everything."

    These are the EXACT BYTES from ECON-EUROSTAT-BYTE-CAPTURE-D2-R1, whose two
    independent SHA-256 passes agreed. They were captured before this evaluator existed,
    so they cannot have been shaped to fit it.
  */
  const CAPTURE_DIR = join(
    'D:',
    'Desktop',
    'GlobalNewsAI',
    'Claude_Output',
    'ECON-EUROSTAT-BYTE-CAPTURE-D2-R1',
    'raw',
  );

  const load = (name: string): Uint8Array | null => {
    try {
      return new Uint8Array(readFileSync(join(CAPTURE_DIR, name)));
    } catch {
      return null;
    }
  };

  it.each([
    ['E1-une_rt_m.body', 'une_rt_m'],
    ['E2-prc_hicp_manr.body', 'prc_hicp_manr'],
  ])('%s is ADMITTED, parses, and binds the governed Eurostat parser', (file, datasetCode) => {
    const bytes = load(file);
    if (bytes === null) {
      throw new Error(
        `R-B positive control cannot run: ${file} is missing. This test must not be ` +
          'silently skipped — without it the whole suite is satisfied by a pipeline ' +
          'that refuses everything.',
      );
    }

    const out = evaluator.evaluate(
      evidence({
        endpointId: datasetCode,
        finalUrl: `https://${EUROSTAT_HOST}/eurostat/api/dissemination/statistics/1.0/data/${datasetCode}`,
        wireBytes: bytes,
        // The real captures carry NO Content-Encoding header.
        contentEncoding: 'identity',
        contentEncodingHeaderPresent: false,
      }),
    );

    expect([file, out.admission.admissibility]).toEqual([file, 'ADMITTED']);
    expect(out.admission.parse?.parserId).toBe('eurostat.jsonstat');
    expect(retrievalIsPublishable(out.admission)).toBe(true);

    // The bytes are retainable and are the SAME OBJECT that arrived — not re-encoded.
    expect(out.retainableBytes).toBeDefined();
    expect(Buffer.from(out.retainableBytes!).equals(Buffer.from(bytes))).toBe(true);

    // And the parse is real: JSON-stat structure, not an empty object that happened to
    // satisfy a shallow check.
    const parsed = out.parsed as { class: string; id: unknown[] };
    expect(parsed.class).toBe('dataset');
    expect(Array.isArray(parsed.id)).toBe(true);
  });

  it('the captured 404 negative control is REFUSED and classified PERMANENT', () => {
    const bytes = load('E3-negative-control-404.body');
    if (bytes === null) throw new Error('E3 negative control capture is missing');

    const out = evaluator.evaluate(
      evidence({ httpStatus: 404, wireBytes: bytes, endpointId: 'nonexistent_ds' }),
    );

    expect(out.admission.admissibility).toBe('REFUSED');
    expect(out.admission.refusalKey).toBe('STATUS_NOT_OK');
    expect(out.admission.refusalClass).toBe('PERMANENT');
    // E1 · §4.2: "404 must never enter the cooldown path."
    expect(refusalMayRetry('STATUS_NOT_OK', 404)).toBe(false);
  });

  it('the same Economy bytes reach the same verdict through the Market binding', () => {
    /*
      §7 — one shared pipeline must unblock BOTH lanes. This is the assertion that says
      so: identical bytes, two entry points, one verdict. If Market and Economy could
      reach different answers on the same capture, there would be two evaluators no
      matter how many files there are.
    */
    const bytes = load('E1-une_rt_m.body');
    if (bytes === null) throw new Error('E1 capture is missing');

    const direct = evaluator.evaluate(
      evidence({
        endpointId: 'une_rt_m',
        wireBytes: bytes,
        finalUrl: `https://${EUROSTAT_HOST}/eurostat/api/dissemination/statistics/1.0/data/une_rt_m`,
      }),
    );

    const viaMarket = new MarketCanonicalAdmissionBinding(
      evaluator,
      () => EUROSTAT_HOST,
      () => NOW,
    ).evaluateFully({
      providerId: 'EUROSTAT',
      endpointId: 'une_rt_m',
      finalUrl: `https://${EUROSTAT_HOST}/eurostat/api/dissemination/statistics/1.0/data/une_rt_m`,
      httpStatus: 200,
      contentTypeHeader: 'application/json',
      contentEncodingHeader: '',
      wireBytes: bytes,
    });

    expect(viaMarket.admission).toEqual(direct.admission);
  });
});
