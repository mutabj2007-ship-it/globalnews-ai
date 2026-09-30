import { splitResponseDirectives } from './response-directives.util';

describe('ASK FIRST-ANSWER RETRIEVAL R3 — splitResponseDirectives', () => {
  describe('removes recognised trailing answer-format instructions', () => {
    it.each([
      [
        "What has changed in Poland's economy? Give the dates and cite the sources.",
        "What has changed in Poland's economy?",
        ['Give the dates and cite the sources'],
      ],
      [
        "What has changed in Kenya's economy? Please cite your sources.",
        "What has changed in Kenya's economy?",
        ['Please cite your sources'],
      ],
      [
        "What is happening with Brazil's inflation, with dates and sources?",
        "What is happening with Brazil's inflation?",
        ['with dates and sources'],
      ],
      [
        'What changed in German energy policy and cite the sources',
        'What changed in German energy policy',
        ['cite the sources'],
      ],
      [
        "What has changed in Japan's trade? Give the dates. Cite sources. Be brief.",
        "What has changed in Japan's trade?",
        ['Give the dates', 'Cite sources', 'Be brief'],
      ],
      [
        'Co się zmieniło w gospodarce Polski? Podaj daty i źródła.',
        'Co się zmieniło w gospodarce Polski?',
        ['Podaj daty i źródła'],
      ],
      [
        'Co nowego w polityce Czech? Wymień źródła, krótko.',
        'Co nowego w polityce Czech?',
        ['Wymień źródła, krótko'],
      ],
      [
        'Co się dzieje na Węgrzech, z datami i źródłami?',
        'Co się dzieje na Węgrzech?',
        ['z datami i źródłami'],
      ],
      [
        'Co sie zmienilo w gospodarce Slowacji? Podaj zrodla.',
        'Co sie zmienilo w gospodarce Slowacji?',
        ['Podaj zrodla'],
      ],
    ])('%s', (question, subject, directives) => {
      expect(splitResponseDirectives(question)).toEqual({ subject, directives });
    });
  });

  describe('leaves the question alone when there is no trailing instruction', () => {
    it.each([
      "What are Poland's energy sources?",
      'Give me the latest on sources of inflation',
      'Which sources say the ceasefire dates were agreed?',
      'What changed in the dates of the Polish election?',
      'What does Statistics Poland report about wages?',
      'What does Reuters report about Poland? ',
      "What has changed in Poland's economy this week?",
      'Co się zmieniło w gospodarce Polski w tym tygodniu?',
      'Are markets long and short on the zloty?',
      'Is the recovery short?',
      'Źródła energii w Polsce',
      'Cite the sources.',
      'Give the dates and cite the sources.',
    ])('%s', (question) => {
      expect(splitResponseDirectives(question)).toEqual({ subject: question, directives: [] });
    });
  });

  it('never removes a time bound, a place or a source attribution', () => {
    const q = "What does Reuters report about Kenya's economy this week? Cite the sources.";
    expect(splitResponseDirectives(q).subject).toBe(
      "What does Reuters report about Kenya's economy this week?",
    );
  });

  it('keeps curly-apostrophe input intact apart from the removed instruction', () => {
    expect(
      splitResponseDirectives(
        'What has changed in Poland’s economy? Give the dates and cite the sources.',
      ).subject,
    ).toBe('What has changed in Poland’s economy?');
  });

  it('refuses to leave fewer than two content words', () => {
    expect(splitResponseDirectives('Kenya? Cite sources.').subject).toBe('Kenya? Cite sources.');
  });
});
