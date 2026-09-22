import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SecurityApiError, fetchSecurityObservations } from './securityApi';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE SECURITY READ CLIENT — AND THE LAST HOP WHERE THE HONESTY COULD BE UNDONE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The backend spends a great deal of effort keeping "we could not look" apart from "nothing
 * happened". ONE LINE IN A CLIENT CAN COLLAPSE ALL OF IT:
 *
 *     catch { return { observations: [], absence: 'NOT_ASSESSED', ... } }
 *
 * That is a friendly-looking change, it would pass a typecheck, and it would make a dead
 * backend indistinguishable from a quiet country. The first two tests below are the ones that
 * would fail if somebody wrote it.
 *
 * The source sweeps guard the two absences the docblock claims: no default for the absence
 * state, and no reader prose for a limitation code.
 */

const CLIENT_SOURCE = readFileSync(join(__dirname, 'securityApi.ts'), 'utf8');

/** Comments stripped, so a docblock explaining what is forbidden is not punished for it. */
const CLIENT_CODE = CLIENT_SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(
  /(^|[^:])\/\/[^\n]*/g,
  '$1 ',
);

const RESPONSE = {
  geographyId: 'RW',
  geographyName: 'Rwanda',
  observations: [],
  coverage: [],
  limitations: ['RETAINED_CORPUS_ENGLISH_LEXICON_ONLY'],
  absence: 'COVERAGE_GAP',
  changeState: null,
  changeStateReason: 'No change state may honestly be asserted.',
  producedBy: 'BETA-SECURITY-EVIDENCE-R1',
  assessedAt: '2026-09-22T10:00:00.000Z',
  generatedAt: '2026-09-22T10:00:00.000Z',
};

function mockFetch(implementation: jest.Mock): jest.Mock {
  (globalThis as { fetch?: unknown }).fetch = implementation;
  return implementation;
}

function okResponse(body: unknown = RESPONSE): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  jest.restoreAllMocks();
  delete (globalThis as { fetch?: unknown }).fetch;
});

describe('fetchSecurityObservations — a failure is never an empty result', () => {
  it('throws when the network call fails, rather than returning a friendly absence', async () => {
    mockFetch(jest.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    await expect(fetchSecurityObservations('RW')).rejects.toBeInstanceOf(SecurityApiError);
  });

  it('throws on a non-OK status and carries the status through', async () => {
    mockFetch(
      jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as Response),
    );

    await expect(fetchSecurityObservations('RW')).rejects.toMatchObject({
      name: 'SecurityApiError',
      status: 503,
    });
  });

  it('throws a timeout message when the request aborts', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    mockFetch(jest.fn().mockRejectedValue(abortError));

    await expect(fetchSecurityObservations('RW')).rejects.toThrow(/took too long/i);
  });
});

describe('fetchSecurityObservations — it passes the backend response through untouched', () => {
  it('returns the response exactly as the backend sent it', async () => {
    mockFetch(jest.fn().mockResolvedValue(okResponse()));

    const response = await fetchSecurityObservations('RW');

    expect(response).toEqual(RESPONSE);
    // Not defaulted, not remapped, not normalised.
    expect(response.absence).toBe('COVERAGE_GAP');
    expect(response.limitations).toEqual(['RETAINED_CORPUS_ENGLISH_LEXICON_ONLY']);
  });

  it('preserves a null absence when the backend returned observations', async () => {
    mockFetch(jest.fn().mockResolvedValue(okResponse({ ...RESPONSE, absence: null })));

    const response = await fetchSecurityObservations('RW');

    // `null` means there is content. It must not become a string on the way through.
    expect(response.absence).toBeNull();
  });
});

describe('fetchSecurityObservations — the request it actually issues', () => {
  it('issues exactly one request, to the observations path for the geography', async () => {
    const fetchMock = mockFetch(jest.fn().mockResolvedValue(okResponse()));

    await fetchSecurityObservations('RW');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/security/observations/RW');
    expect(init.cache).toBe('no-store');
  });

  it('omits both query parameters when the caller passes none', async () => {
    const fetchMock = mockFetch(jest.fn().mockResolvedValue(okResponse()));

    await fetchSecurityObservations('RW');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).not.toContain('?');
  });

  it('threads limit and maxAgeMinutes through when supplied', async () => {
    const fetchMock = mockFetch(jest.fn().mockResolvedValue(okResponse()));

    await fetchSecurityObservations('RW', { limit: 5, maxAgeMinutes: 60 });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('limit=5');
    expect(url).toContain('maxAgeMinutes=60');
  });

  it('encodes the geography so a path segment cannot be injected', async () => {
    const fetchMock = mockFetch(jest.fn().mockResolvedValue(okResponse()));

    await fetchSecurityObservations('../admin/users');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).not.toContain('/admin/users');
    expect(url).toContain('%2F');
  });

  it('is a GET — it never sends a method, body or mutation', async () => {
    const fetchMock = mockFetch(jest.fn().mockResolvedValue(okResponse()));

    await fetchSecurityObservations('RW');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBeUndefined();
    expect(init.body).toBeUndefined();
  });
});

describe('the client defaults nothing and renders nothing', () => {
  it('contains no fallback for the absence state', () => {
    // The absence vocabulary refuses to have a default, and a client must not supply one.
    expect(CLIENT_CODE).not.toMatch(/NOT_ASSESSED/);
    expect(CLIENT_CODE).not.toMatch(/COVERAGE_GAP/);
    expect(CLIENT_CODE).not.toMatch(/absence\s*(\?\?|\|\|)/);
  });

  it('turns no limitation code into a sentence', () => {
    // Reader copy in an API client would make English an authority.
    expect(CLIENT_CODE).not.toMatch(/RETAINED_CORPUS|LEXICON_ONLY|GEOGRAPHY_PRECISION/);
  });

  it('never substitutes an empty response for a failure', () => {
    expect(CLIENT_CODE).not.toMatch(/observations:\s*\[\]/);
  });

  it('positive control — the sweep is reading the real client', () => {
    expect(CLIENT_CODE).toMatch(/fetchSecurityObservations/);
    expect(CLIENT_CODE).toMatch(/SecurityApiError/);
    expect(CLIENT_CODE).toMatch(/no-store/);
  });
});

describe('the Security visual surface is untouched by this lane', () => {
  const SECURITY_SRC = join(__dirname, '..', '..', 'components', 'security');

  it('imports this client into no Security component', () => {
    // Claude Design remains the visual authority. Binding a zone to live data is a visual
    // decision with its own review, not a side effect of landing a backend.
    for (const file of ['SecurityScreen.tsx', 'SecurityCompactScreen.tsx', 'SecParts.tsx']) {
      const source = readFileSync(join(SECURITY_SRC, file), 'utf8');
      expect(source).not.toMatch(/securityApi|fetchSecurityObservations/);
    }
  });
});
