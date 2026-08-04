import { resolveActiveAnalysisProvider } from './provider.tokens';
import type { AnalysisProvider } from '../interfaces';

const mock: AnalysisProvider = {
  id: 'mock-analysis',
  displayName: 'Mock',
  isMock: true,
  analyzeNews: async () => ({}),
};

const openai: AnalysisProvider = {
  id: 'openai',
  displayName: 'OpenAI',
  isMock: false,
  analyzeNews: async () => ({}),
};

describe('resolveActiveAnalysisProvider', () => {
  it('selects the OpenAI provider when an API key is present', () => {
    expect(resolveActiveAnalysisProvider('sk-test-key', mock, openai)).toBe(openai);
  });

  it('selects the mock provider when no API key is configured', () => {
    expect(resolveActiveAnalysisProvider(undefined, mock, openai)).toBe(mock);
  });

  it('selects the mock provider when the API key is an empty string', () => {
    expect(resolveActiveAnalysisProvider('', mock, openai)).toBe(mock);
  });
});
