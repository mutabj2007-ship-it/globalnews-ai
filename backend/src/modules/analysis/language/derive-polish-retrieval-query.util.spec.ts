import { derivePolishRetrievalQuery } from './derive-polish-retrieval-query.util';

describe('derivePolishRetrievalQuery (Milestone #47)', () => {
  it('"Co dzieje się teraz w NATO?" -> "NATO"', () => {
    expect(derivePolishRetrievalQuery('Co dzieje się teraz w NATO?')).toBe('NATO');
  });

  it('"Co dzieje się w NATO?" -> "NATO" (without "teraz")', () => {
    expect(derivePolishRetrievalQuery('Co dzieje się w NATO?')).toBe('NATO');
  });

  it('"Najnowsze informacje o NATO" -> "NATO"', () => {
    expect(derivePolishRetrievalQuery('Najnowsze informacje o NATO')).toBe('NATO');
  });

  it('"Jakie są najważniejsze wiadomości z Polski?" -> "Polska" (bounded genitive-case normalization)', () => {
    expect(derivePolishRetrievalQuery('Jakie są najważniejsze wiadomości z Polski?')).toBe(
      'Polska',
    );
  });

  it('"Co dzieje się teraz w Warszawie?" -> "Warszawa" (bounded locative-case normalization)', () => {
    expect(derivePolishRetrievalQuery('Co dzieje się teraz w Warszawie?')).toBe('Warszawa');
  });

  it('Polish diacritics are preserved untouched throughout (ą ć ę ł ń ó ś ź ż)', () => {
    const input = 'Bardzo dziwne pytanie ą ć ę ł ń ó ś ź ż';
    expect(derivePolishRetrievalQuery(input)).toBe(input);
  });

  it('an already-concise entity query is a no-op', () => {
    expect(derivePolishRetrievalQuery('NATO')).toBe('NATO');
  });

  it('safety invariant: never returns empty for a non-empty input', () => {
    const result = derivePolishRetrievalQuery('Zupełnie nierozpoznane pytanie bez wzorca');
    expect(result.length).toBeGreaterThan(0);
  });

  it("empty-input safety invariant matches deriveGenericNewsQuery's own contract", () => {
    expect(derivePolishRetrievalQuery('   ')).toBe('');
  });

  it('an unrecognized case-inflected place name is returned as-captured, never guessed at (honest, disclosed limitation) — "Krakowie" (locative of "Kraków") is not in the tiny closed normalization table', () => {
    expect(derivePolishRetrievalQuery('Co dzieje się teraz w Krakowie?')).toBe('Krakowie');
  });

  it('a query with an inserted word between "wiadomości" and the preposition does not match the pattern and falls through safely to the punctuation-stripped original — never fabricates a match', () => {
    expect(
      derivePolishRetrievalQuery('Jakie są najważniejsze wiadomości gospodarcze w Polsce?'),
    ).toBe('Jakie są najważniejsze wiadomości gospodarcze w Polsce');
  });

  it('is a pure, deterministic function', () => {
    const input = 'Co dzieje się teraz w NATO?';
    expect(derivePolishRetrievalQuery(input)).toBe(derivePolishRetrievalQuery(input));
  });
});
