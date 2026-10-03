import type { GazetteerExonym } from '../geo-gazetteer';

/**
 * TRUST & CONVERSATIONAL EXPERIENCE R1 §14 — POLISH CASE FORMS OF MAJOR POLISH CITIES.
 *
 * "Co się dzieje w Krakowie?" resolved no place: the gazetteer holds "Kraków" and the exonym
 * "cracow", but a Polish reader names a city in the locative ("w Krakowie"), genitive ("z
 * Krakowa") or instrumental ("pod Krakowem"), and the resolver matches whole folded names only.
 *
 * CURATED, NOT STEMMED. Every row below is a written-out, hand-checked surface form pointing at
 * an existing gazetteer settlement — the same shape as the artifact's exonym rows, merged into
 * the same exonym index (geo-gazetteer.ts), and verified the same way: a row whose canonical
 * settlement does not exist in the gazetteer is a test failure, and a form that is itself the
 * name of another gazetteer settlement or exonym is never indexed. No suffix is ever stripped
 * from what the reader typed.
 *
 * DELIBERATELY EXCLUDED, BECAUSE THE FORM IS AN ORDINARY WORD:
 *   Łódź → "łodzi" / "łodzią" are also the cases of "łódź" (a boat): "w łodzi" is "in a boat".
 *   Nominatives stay as they are (the gazetteer already holds them).
 *
 * Forms are FOLDED (lowercase, diacritics removed), matching foldPlaceName().
 */
export const POLISH_SETTLEMENT_CASE_FORMS: readonly GazetteerExonym[] = [
  /* Kraków */
  { x: 'krakowie', n: 'Kraków', cc: 'PL' },
  { x: 'krakowa', n: 'Kraków', cc: 'PL' },
  { x: 'krakowem', n: 'Kraków', cc: 'PL' },
  /* Warszawa (gazetteer canonical: Warsaw) */
  { x: 'warszawie', n: 'Warsaw', cc: 'PL' },
  { x: 'warszawy', n: 'Warsaw', cc: 'PL' },
  { x: 'warszawe', n: 'Warsaw', cc: 'PL' },
  /* Gdańsk */
  { x: 'gdansku', n: 'Gdańsk', cc: 'PL' },
  { x: 'gdanska', n: 'Gdańsk', cc: 'PL' },
  { x: 'gdanskiem', n: 'Gdańsk', cc: 'PL' },
  /* Wrocław */
  { x: 'wroclawiu', n: 'Wrocław', cc: 'PL' },
  { x: 'wroclawia', n: 'Wrocław', cc: 'PL' },
  { x: 'wroclawiem', n: 'Wrocław', cc: 'PL' },
  /* Poznań */
  { x: 'poznaniu', n: 'Poznań', cc: 'PL' },
  { x: 'poznania', n: 'Poznań', cc: 'PL' },
  { x: 'poznaniem', n: 'Poznań', cc: 'PL' },
  /* Katowice (plural) */
  { x: 'katowicach', n: 'Katowice', cc: 'PL' },
  { x: 'katowic', n: 'Katowice', cc: 'PL' },
  /* Szczecin */
  { x: 'szczecinie', n: 'Szczecin', cc: 'PL' },
  { x: 'szczecina', n: 'Szczecin', cc: 'PL' },
  /* Lublin */
  { x: 'lublinie', n: 'Lublin', cc: 'PL' },
  /* Bydgoszcz */
  { x: 'bydgoszczy', n: 'Bydgoszcz', cc: 'PL' },
];
