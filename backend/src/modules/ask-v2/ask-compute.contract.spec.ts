import {
  classifyCompute,
  fingerprint,
  hashIdentity,
  safeReturnPath,
  SAND_CHARGING_ENABLED,
  SAND_QUOTES,
  UNWIRED_ASK_EXECUTION_PORT,
  validatePlan,
  AskPlan,
  AskRequest,
} from './ask-compute.contract';

const request: AskRequest = { question: 'Co się wydarzyło?', language: 'pl', intent: 'ask' };
const plan: AskPlan = {
  revision: 'r1',
  scope: 'RW:7d',
  contract: 'cto-v1',
  executionKey: 'Key-A',
  validUntil: '2099-01-01T00:00:00Z',
  contextual: false,
  deepRequested: false,
  reportRequested: false,
  countryCount: 1,
  domainCount: 1,
  timeWindowDays: 7,
};
describe('Ask compute compatibility contract', () => {
  test.each([
    ['STORED', { intent: 'research-report' }, {}, true],
    ['CONTEXTUAL', {}, { contextual: true }, false],
    ['FRESH_BOUNDED', {}, {}, false],
    ['FRESH_BOUNDED', {}, { countryCount: 2, timeWindowDays: 89 }, false],
    ['DEEP_ANALYSIS', {}, { countryCount: 2, timeWindowDays: 90 }, false],
    ['DEEP_ANALYSIS', {}, { deepRequested: true }, false],
    ['RESEARCH_REPORT', {}, { reportRequested: true }, false],
    ['DEEP_ANALYSIS', { intent: 'deep-analysis' }, {}, false],
    ['DEEP_ANALYSIS', {}, { countryCount: 3 }, false],
    ['DEEP_ANALYSIS', {}, { domainCount: 3 }, false],
    ['DEEP_ANALYSIS', {}, { timeWindowDays: 180 }, false],
    ['DEEP_ANALYSIS', {}, { countryCount: 2, domainCount: 2 }, false],
    ['RESEARCH_REPORT', { intent: 'research-report' }, {}, false],
  ])('classifies %s', (expected, change, signals, stored) => {
    expect(
      classifyCompute(
        { ...request, ...change } as AskRequest,
        { ...plan, ...signals },
        stored as boolean,
      ),
    ).toBe(expected);
  });
  test('language, intent, evidence, scope and opaque case-sensitive contracts separate identities', () => {
    const key = fingerprint(request, plan);
    expect(fingerprint({ ...request, language: 'en' }, plan)).not.toBe(key);
    expect(fingerprint({ ...request, intent: 'deep-analysis' }, plan)).not.toBe(key);
    for (const field of ['revision', 'scope', 'contract', 'executionKey'] as const) {
      expect(fingerprint(request, { ...plan, [field]: plan[field] + '-changed' })).not.toBe(key);
    }
    expect(fingerprint(request, { ...plan, executionKey: 'key-a' })).not.toBe(key);
    expect(hashIdentity(['a\u001fb', 'c'])).not.toBe(hashIdentity(['a', 'b\u001fc']));
  });
  test('invalid or expired planning fails closed', () => {
    for (const patch of [
      { revision: '' },
      { validUntil: 'bad' },
      { validUntil: '2000-01-01' },
      { countryCount: -1 },
    ]) {
      expect(() => validatePlan({ ...plan, ...patch })).toThrow();
    }
  });
  test.each([
    '//evil.test',
    '/\\evil.test',
    'https://evil.test',
    '/%2f%2fevil.test',
    '/\nevil',
    '/x#evil',
  ])('rejects unsafe contextual return %s', (path) => {
    expect(() => safeReturnPath(path)).toThrow();
  });
  test('contextual return is a pure local navigation value', () => {
    expect(safeReturnPath('/map?country=PL')).toBe('/map?country=PL');
    expect(safeReturnPath()).toBeNull();
  });
  test('charging cannot be enabled by environment; ordinary Ask stays zero', () => {
    const prior = process.env.SAND_CHARGING_ENABLED;
    process.env.SAND_CHARGING_ENABLED = 'true';
    try {
      expect(SAND_CHARGING_ENABLED).toBe(false);
      expect(SAND_QUOTES.FRESH_BOUNDED).toBe(0);
    } finally {
      if (prior === undefined) delete process.env.SAND_CHARGING_ENABLED;
      else process.env.SAND_CHARGING_ENABLED = prior;
    }
  });
  test('default execution adapter fails explicitly with no provider', async () => {
    await expect(UNWIRED_ASK_EXECUTION_PORT.prepare(request)).rejects.toThrow(
      'ASK_EXECUTION_PORT_NOT_BOUND',
    );
    await expect(UNWIRED_ASK_EXECUTION_PORT.execute(request, plan, 'op')).rejects.toThrow(
      'ASK_EXECUTION_PORT_NOT_BOUND',
    );
  });
});
