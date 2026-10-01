import { isBroadGlobalHeadlinesQuestion } from './broad-global-headlines.util';

describe('PUBLIC BETA HARDENING R1B — the broad global headlines decision rule', () => {
  it.each([
    'Any global news can you share?',
    'What is happening around the world?',
    "What are today's top world stories?",
    'Give me the latest global headlines.',
    'What are the main news stories today?',
    "What's the latest world news?",
    'Any international headlines today?',
  ])('EN qualifies: %s', (q) => {
    expect(isBroadGlobalHeadlinesQuestion(q, 'en')).toBe(true);
  });

  it.each([
    'Co się dzieje na świecie?',
    'Jakie są najważniejsze wiadomości ze świata?',
    'Podaj najnowsze wiadomości ze świata.',
    'Jakie są dziś najważniejsze wiadomości?',
    'Czy masz jakieś wiadomości ze świata?',
  ])('PL qualifies: %s', (q) => {
    expect(isBroadGlobalHeadlinesQuestion(q, 'pl')).toBe(true);
  });

  it.each([
    "What's happening with NATO?",
    'Latest news about Kenya',
    'What happened on the Dubai–Israel flight?',
    'What are the latest developments in eastern DRC?',
    'Latest ECB interest-rate news',
    'What is GDP?',
    'Explain TCP vs UDP.',
    'Compare the latest world news from BBC and Reuters',
    'What are the main news stories in the last 7 days?',
    'Any news?',
    'What is happening?',
    'Latest world news about climate change',
    'Give me a deep analysis of the latest global headlines',
  ])('EN does NOT qualify: %s', (q) => {
    expect(isBroadGlobalHeadlinesQuestion(q, 'en')).toBe(false);
  });

  it.each([
    'Co się dzieje w Kenii?',
    'Najnowsze wiadomości o NATO',
    'Jakie są najważniejsze wiadomości z Polski?',
    'Co to jest PKB?',
  ])('PL does NOT qualify: %s', (q) => {
    expect(isBroadGlobalHeadlinesQuestion(q, 'pl')).toBe(false);
  });

  it('EN/PL parity: each language is read with its own vocabulary only', () => {
    expect(isBroadGlobalHeadlinesQuestion('Co się dzieje na świecie?', 'en')).toBe(false);
    expect(isBroadGlobalHeadlinesQuestion('What is happening around the world?', 'pl')).toBe(false);
    expect(isBroadGlobalHeadlinesQuestion('What is happening around the world?', 'fr')).toBe(false);
  });
});
