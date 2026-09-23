import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AnalysisApiResponse, LanguageCode, StoryContext } from '@globalnews-ai/shared';
import { analyzeNews } from '@/lib/api/analysisApi';
import { useAskConversation } from './useAskConversation';

jest.mock('@/lib/api/analysisApi', () => ({ analyzeNews: jest.fn() }));
jest.mock('@/components/search/SearchPageClient', () => ({
  resolveAnalysisErrorMessage: () => 'Request failed',
}));

const rwanda = { title: 'Rwanda', countryCode: 'RWA', articleId: 'rwanda-1' };
const kenya = { title: 'Kenya', countryCode: 'KEN', articleId: 'kenya-1' };
const response = {
  analysis: { summary: 'AI OUTPUT MUST NEVER BE INPUT' },
} as unknown as AnalysisApiResponse;
const transport = jest.mocked(analyzeNews);
function deferred() {
  let resolve!: (value: AnalysisApiResponse) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<AnalysisApiResponse>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
let current: ReturnType<typeof useAskConversation>;
let renderer: ReactTestRenderer;
function Harness({ language, context }: { language: LanguageCode; context?: StoryContext }) {
  current = useAskConversation(language, context);
  return null;
}
function render(language: LanguageCode = 'en', context: StoryContext | undefined = rwanda) {
  act(() => {
    renderer.update(createElement(Harness, { language, context }));
  });
}
function submit(question = 'What changed?') {
  let result!: Promise<boolean>;
  act(() => {
    result = current.submit(question);
  });
  return result;
}
beforeEach(() => {
  transport.mockReset();
  act(() => {
    renderer = create(createElement(Harness, { language: 'en', context: rwanda }));
  });
});
afterEach(() => {
  act(() => renderer.unmount());
});

describe('Ask pending publication identity', () => {
  it.each([
    ['country', 'en', kenya],
    ['language only', 'pl', rwanda],
    ['language and country', 'pl', kenya],
  ] as const)(
    'rejects a stale response after changing %s without another request',
    async (_, language, context) => {
      const request = deferred();
      transport.mockReturnValueOnce(request.promise);
      const result = submit();
      expect(current.pending).toBe('What changed?');
      render(language, context);
      expect(current.pending).toBeNull();
      expect(transport).toHaveBeenCalledTimes(1);
      await act(async () => {
        request.resolve(response);
        expect(await result).toBe(false);
      });
      expect(current.turns).toEqual([]);
      expect(current.pending).toBeNull();
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );
  it('commits once for unchanged bounded identity and sends only the previous user question', async () => {
    const request = deferred();
    transport.mockReturnValueOnce(request.promise);
    const result = submit();
    expect(await submit('duplicate')).toBe(false);
    render('en', { ...rwanda, url: 'https://ignored.example', sourceName: 'ignored' });
    expect(current.pending).toBe('What changed?');
    await act(async () => {
      request.resolve(response);
      expect(await result).toBe(true);
    });
    expect(current.turns).toHaveLength(1);
    expect(transport).toHaveBeenCalledTimes(1);
    transport.mockResolvedValueOnce(response);
    await act(async () => {
      await current.submit('Why?');
    });
    expect(current.turns).toHaveLength(2);
    expect(transport.mock.calls).toEqual([
      ['What changed?', 'en', rwanda, undefined],
      ['Why?', 'en', rwanda, 'What changed?'],
    ]);
  });
  it('does not clear a newer pending request when the stale request settles', async () => {
    const old = deferred();
    const fresh = deferred();
    transport.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const oldResult = submit();
    render('en', kenya);
    const freshResult = submit('Kenya question');
    await act(async () => {
      old.resolve(response);
      await oldResult;
    });
    expect(current.pending).toBe('Kenya question');
    expect(current.turns).toEqual([]);
    await act(async () => {
      fresh.resolve(response);
      await freshResult;
    });
    expect(current.turns).toHaveLength(1);
    expect(current.turns[0].context).toEqual(kenya);
    expect(transport.mock.calls[1]).toEqual(['Kenya question', 'en', kenya, undefined]);
  });
  it('invalidates even when context switches away and back before completion', async () => {
    const request = deferred();
    transport.mockReturnValueOnce(request.promise);
    const result = submit();
    render('en', kenya);
    render('en', rwanda);
    await act(async () => {
      request.resolve(response);
      expect(await result).toBe(false);
    });
    expect(current.turns).toEqual([]);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('does not publish stale errors', async () => {
    const request = deferred();
    transport.mockReturnValueOnce(request.promise);
    const result = submit();
    render('en', kenya);
    await act(async () => {
      request.reject(new Error('old failure'));
      await result;
    });
    expect(current.turns).toEqual([]);
    expect(current.pending).toBeNull();
  });
});
