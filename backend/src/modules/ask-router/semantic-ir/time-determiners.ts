import { plTolerant } from '../pl-tolerant';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 SEVEN-LANGUAGE RULING §13 — DEFECT 3: A POSSESSIVE TIME WORD IS A DETERMINER, NOT A TIME
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ROOT CAUSE. Every time reader (currentness markers, temporal semantics, knowledge-requirement
 * freshness, user-job temporal roles, the stated-period producer, the EN date reading) matches the
 * bare token "today" — and JS `\b` puts a boundary before the apostrophe, so "today's money" was
 * read as the ADVERB "today": a present-state request. Six readers made the same mistake
 * independently, so no single regex fix could hold.
 *
 * INVARIANT. "today's / tonight's / tomorrow's / yesterday's X" (PL "dzisiejszy / wczorajszy /
 * jutrzejszy X") describes X by its time; it asks for the present only when X is a MUTABLE STATE or
 * a reporting object ("today's rates", "today's headlines"). Before any other head it is a
 * present-era / idiomatic description ("today's money", "today's youth", "tomorrow's leaders"):
 * WEAK currentness at most, never a time adverb. The determiner is masked (same length, so every
 * span stays valid) in the text the TIME readers read; the currentness reader reports it WEAK, so
 * a stable frame escalates to the one bounded interpretation instead of either reader deciding.
 */
export const TIME_DETERMINER_STATE_HEAD = String.raw`(?:price|prices|rate|rates|range|level|levels|status|situation|state|regulations?|polic(?:y|ies)|laws?|rules?|requirements?|restrictions?|edition|version|government|president|ministers?|cabinet|figures?|numbers?|total|count|tally|standings|rankings?|scores?|forecasts?|outlook|estimates?|target|inflation|unemployment|yields?|deficit|reserves|line-?up|squad|sanctions|tariffs?|ceasefire|talks|negotiations|deal|polls?|polling|market|markets|limits?|news|headlines|papers?|newspapers?|front\s+pages?|stories|top\s+stories|briefing|agenda|schedule|weather|match|matches|game|games|race|session|meeting|vote|votes|announcement|speech|statement|press\s+conference|summit|hearing|trial|verdict|ruling|decision|developments|updates?|events?|protests?|strike|strikes|attack|attacks|election|elections|results?|exchange\s+rates?|close|open|opening|trading|session)`;

const EN_DETERMINER = new RegExp(
  String.raw`\b(today|tonight|tomorrow|yesterday)['’]s(?![\p{L}])`,
  'giu',
);
const EN_STATE_HEAD_RE = new RegExp(String.raw`^${TIME_DETERMINER_STATE_HEAD}$`, 'iu');
const PL_DETERMINER = plTolerant(
  /(?<![\p{L}])(dzisiejsz\p{L}*|wczorajsz\p{L}*|jutrzejsz\p{L}*)(?=\s+(\p{L}+))/giu,
);
const PL_STATE_HEAD =
  /^(?:cen|stop|kurs|poziom|stan|sytuacj|przepis|regulacj|polityk|zasad|rząd|rzad|prezydent|premier|notowa|prognoz|inflacj|sankcj|rozmow|negocjacj|wiadomo|nagłów|naglow|gazet|wydarze|posiedze|głosowa|glosowa|wynik|wybor|mecz|sesj|szczyt|decyzj|wyrok|protest|strajk|atak)/iu;

/*
  SEVEN-LANGUAGE REGRESSION FIX (sealed #4 S4-027) — an ERA noun is not an entity described by its
  time: "in today's world", "w dzisiejszych czasach" ("nowadays") is the governed CONTEMPORARY
  phrase every time reader already classifies as present-era. Masking its time word erased that
  signal. A determiner before an era noun is therefore never masked: the era phrase keeps its own,
  governed reading.
*/
const EN_ERA_HEAD = /^(?:world|era|age|times|society|economy|climate)$/iu;
const PL_ERA_HEAD =
  /^(?:czas|czasy|czasach|świat|świecie|swiat|swiecie|realia|realiach|epoce|epoka|dobie|dzień|dzien)$/iu;

export interface TimeDeterminer {
  readonly word: string;
  readonly head: string;
  readonly start: number;
  readonly end: number;
}

/** The possessive time determiners whose head is NOT a mutable state / reporting object. */
export function nonStateTimeDeterminers(text: string, language: string): TimeDeterminer[] {
  const out: TimeDeterminer[] = [];
  if (language === 'en') {
    for (const m of text.matchAll(EN_DETERMINER)) {
      /* a state / reporting head anywhere in the next three words keeps it a real time */
      const window = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 60);
      const words = window
        .split(/[^\p{L}-]+/u)
        .filter(Boolean)
        .slice(0, 3);
      const twoWord = words.length > 1 ? `${words[0]} ${words[1]}` : '';
      if (words.some((w) => EN_STATE_HEAD_RE.test(w)) || EN_STATE_HEAD_RE.test(twoWord)) continue;
      if (EN_ERA_HEAD.test(words[0] ?? '')) continue;
      out.push({
        word: m[0],
        head: words[0] ?? '',
        start: m.index ?? 0,
        end: (m.index ?? 0) + m[0].length,
      });
    }
  } else if (language === 'pl') {
    for (const m of text.matchAll(PL_DETERMINER)) {
      if (PL_STATE_HEAD.test(m[2] ?? '') || PL_ERA_HEAD.test(m[2] ?? '')) continue;
      out.push({
        word: m[1],
        head: m[2] ?? '',
        start: m.index ?? 0,
        end: (m.index ?? 0) + m[1].length,
      });
    }
  }
  return out;
}

/** The text the TIME readers read: non-state time determiners blanked (same length, spans kept). */
export function maskTimeDeterminers(text: string, language: string): string {
  let out = text;
  for (const d of nonStateTimeDeterminers(text, language))
    out = out.slice(0, d.start) + ' '.repeat(d.end - d.start) + out.slice(d.end);
  return out;
}
