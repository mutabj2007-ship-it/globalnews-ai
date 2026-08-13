import { pluralEn, pluralPl, polishForm, pluralWithForms } from './pluralize';

describe('pluralize (Milestone #48)', () => {
  describe('pluralEn', () => {
    it('singular', () => {
      expect(pluralEn(1, 'source')).toBe('1 source');
    });
    it('plural', () => {
      expect(pluralEn(5, 'source')).toBe('5 sources');
    });
    it('zero uses plural form', () => {
      expect(pluralEn(0, 'source')).toBe('0 sources');
    });
  });

  describe('polishForm / pluralPl', () => {
    it('singular (1)', () => {
      expect(pluralPl(1, ['źródło', 'źródła', 'źródeł'])).toBe('1 źródło');
    });
    it('few (2-4)', () => {
      expect(pluralPl(3, ['źródło', 'źródła', 'źródeł'])).toBe('3 źródła');
    });
    it('many (5+)', () => {
      expect(pluralPl(8, ['źródło', 'źródła', 'źródeł'])).toBe('8 źródeł');
    });
    it('teens exception (12-14 use "many", not "few")', () => {
      expect(pluralPl(12, ['źródło', 'źródła', 'źródeł'])).toBe('12 źródeł');
      expect(pluralPl(14, ['źródło', 'źródła', 'źródeł'])).toBe('14 źródeł');
    });
    it('22 uses "few" (mod10=2, not in teens range)', () => {
      expect(polishForm(22, ['a', 'b', 'c'])).toBe('b');
    });
  });

  describe('pluralWithForms (Milestone #48 unified helper)', () => {
    it('en singular', () => {
      expect(pluralWithForms(1, 'en', ['source', 'sources', 'sources'])).toBe('1 source');
    });
    it('en plural', () => {
      expect(pluralWithForms(5, 'en', ['source', 'sources', 'sources'])).toBe('5 sources');
    });
    it('pl delegates to full 3-way Polish grammar', () => {
      expect(pluralWithForms(1, 'pl', ['źródło', 'źródła', 'źródeł'])).toBe('1 źródło');
      expect(pluralWithForms(3, 'pl', ['źródło', 'źródła', 'źródeł'])).toBe('3 źródła');
      expect(pluralWithForms(8, 'pl', ['źródło', 'źródła', 'źródeł'])).toBe('8 źródeł');
    });
    it('an unimplemented language falls back to the simple 2-way English-style rule', () => {
      expect(pluralWithForms(1, 'sw', ['source', 'sources', 'sources'])).toBe('1 source');
      expect(pluralWithForms(5, 'sw', ['source', 'sources', 'sources'])).toBe('5 sources');
    });
  });
});
