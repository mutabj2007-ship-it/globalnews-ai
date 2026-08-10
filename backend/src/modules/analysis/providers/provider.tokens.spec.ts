import type { AnalysisProvider } from '../interfaces';
import { isUsableOpenAiApiKey, resolveActiveAnalysisProvider } from './provider.tokens';

function makeProvider(id: string): AnalysisProvider {
  return {
    id,
    displayName: id,
    isMock: id === 'mock-analysis',
    analyzeNews: jest.fn(),
  };
}

describe('isUsableOpenAiApiKey', () => {
  it('returns false for undefined', () => {
    expect(isUsableOpenAiApiKey(undefined)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isUsableOpenAiApiKey('')).toBe(false);
  });

  it('returns false for a whitespace-only string', () => {
    expect(isUsableOpenAiApiKey('   ')).toBe(false);
    expect(isUsableOpenAiApiKey('\t\n')).toBe(false);
  });

  it('returns true for a non-empty, non-whitespace string', () => {
    expect(isUsableOpenAiApiKey('sk-real-key')).toBe(true);
  });

  it('returns true for a value with meaningful content and incidental surrounding whitespace', () => {
    expect(isUsableOpenAiApiKey('  sk-real-key  ')).toBe(true);
  });
});

describe('resolveActiveAnalysisProvider', () => {
  const mock = makeProvider('mock-analysis');
  const openai = makeProvider('openai');

  it('selects mock when the key is missing', () => {
    expect(resolveActiveAnalysisProvider(undefined, mock, openai)).toBe(mock);
  });

  it('selects mock when the key is an empty string', () => {
    expect(resolveActiveAnalysisProvider('', mock, openai)).toBe(mock);
  });

  it('selects mock when the key is whitespace-only — a whitespace-only value must not accidentally count as valid production configuration', () => {
    expect(resolveActiveAnalysisProvider('   ', mock, openai)).toBe(mock);
  });

  it('selects OpenAI when a real, non-empty key is configured', () => {
    expect(resolveActiveAnalysisProvider('sk-real-key', mock, openai)).toBe(openai);
  });
});
