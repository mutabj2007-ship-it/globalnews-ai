import {
  LOCALES,
  TURNS,
  QUESTION,
  dataStrings,
  englishLeaks,
  renderTurn,
  visibleValues,
} from './testing/renderedLocale.testkit';

describe('R4 · rendered-surface language acceptance — the answer turn', () => {
  it.each(Object.keys(TURNS).flatMap((k) => LOCALES.map((l) => [k, l] as const)))(
    '%s · %s: no English chrome reaches the reader',
    (kind, locale) => {
      const data = dataStrings(QUESTION, TURNS[kind]());
      const leaks = englishLeaks(
        visibleValues(renderTurn(kind, 'en')),
        visibleValues(renderTurn(kind, locale)),
        data,
        locale,
      );
      expect(leaks).toEqual([]);
    },
  );
});
