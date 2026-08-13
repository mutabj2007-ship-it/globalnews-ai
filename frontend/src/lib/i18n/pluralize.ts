/**
 * Milestone #48 — extracted from SourceDiversitySummary.tsx (built in
 * Milestone #47) into a shared location so homepage components can
 * reuse the SAME grammar helpers instead of duplicating them, per the
 * explicit "reuse established helpers/patterns instead of duplicating
 * grammar logic" requirement. Behavior is byte-for-byte identical to
 * the original private functions — this is a pure relocation, not a
 * rewrite.
 */
import type { LanguageCode } from '@globalnews-ai/shared';

export function pluralEn(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/**
 * Standard, well-known Polish grammar rule (not an NLP engine, not
 * stemming): singular for 1; "few" form for count ending in 2-4
 * (excluding the 12-14 teens exception); "many" (genitive plural) form
 * otherwise. forms = [singular, few, many].
 */
export function polishForm(count: number, forms: [string, string, string]): string {
  const [one, few, many] = forms;
  if (count === 1) return one;
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

export function pluralPl(count: number, forms: [string, string, string]): string {
  return `${count} ${polishForm(count, forms)}`;
}

/**
 * Milestone #48 — unified language-aware plural, used where a
 * dictionary field needs the SAME shape (a 3-tuple `[singular, few,
 * many]`) across every language so `pl`'s dictionary type structurally
 * matches `en`'s (see dictionaries/index.ts's `Dictionary = typeof en`
 * pattern). English only has two real grammatical forms, so its own
 * `forms[1]`/`forms[2]` are identical by convention (e.g. `['source',
 * 'sources', 'sources']`) — this function still only ever reads
 * `forms[0]`/`forms[1]` for non-Polish languages, matching pluralEn's
 * own simple singular/plural rule exactly.
 */
export function pluralWithForms(
  count: number,
  language: LanguageCode,
  forms: [string, string, string],
): string {
  if (language === 'pl') return pluralPl(count, forms);
  const [singular, plural] = forms;
  return `${count} ${count === 1 ? singular : plural}`;
}
