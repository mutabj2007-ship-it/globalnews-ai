import {
  COUNTRY_ALIASES_BY_ISO3,
  findCountryByIso3,
  getLocalizedCountryName,
  type CountryMeta,
} from '@globalnews-ai/shared';
import { readContinuationEllipsis } from '../../analysis/anchor/continuation-ellipsis.util';
import { normalizeAskQuestion } from '../../ask-router/normalization/qualified-reading';
import { MAX_CONTINUATION_WORDS, typedCountriesOf } from './conversation-place';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO CHECKPOINT 5 §5 — CROSS-COUNTRY CONTINUATION (replaces the MC-070 always-clarify rule)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * "How is Madagascar's economy doing?" → "And in Kenya?" means "How is Kenya's economy doing?".
 * When the reader's turn is a governed continuation ellipsis naming exactly ONE new country
 * (readContinuationEllipsis: "And in Kenya?", "What about Kenya?", "How about Kenya?", "And
 * Kenya?", "A w Kenii?", "A co z Kenią?", optionally with a new time: "And in Kenya yesterday?"),
 * and the conversation holds a PORTABLE geography-scoped subject, the new place replaces the old
 * one while the subject (topic, domain, intent, time) carries forward.
 *
 * THE SUBJECT IS THE READER'S OWN EARLIER WORDS, NEVER AN ANSWER. The previous turn is used:
 *   - it names exactly one country BY NAME (not a demonym: "the Rwandan genocide" is not
 *     re-targeted to "the Kenyan genocide") → that country's name is replaced in it;
 *   - it is itself such a continuation → its own composition is the base (bounded chain);
 *   - it is a short, placeless follow-up that inherited the conversation's place ("And the
 *     economy?") → the new place is attached to it.
 * Anything else (no earlier turn, "Who was Napoleon?", a comparison of several countries, a
 * place the forms below cannot express) composes NOTHING: the turn keeps the existing truthful
 * clarification. A new explicit time replaces the earlier one. Start New Topic opens a new
 * thread, so there is no earlier turn. A turn that carries its own story / module / selection
 * context is never composed (the caller passes `hasOwnContext`). Pure: no I/O, no AI.
 */
export const MAX_CHAIN = 5;

export interface CrossCountryContinuation {
  /** The question the engine answers, in the reader's language. */
  readonly effectiveQuestion: string;
  /** The reader's own earlier words the subject came from. */
  readonly fromQuestion: string;
  readonly newCountry: string;
}

export interface EarlierQuestion {
  readonly question: string;
  readonly language: string;
}

/* ── time phrases a continuation may add ("And in Kenya yesterday?") ─────────────────────── */
const EN_TIME =
  /\s+(today|yesterday|this\s+week|last\s+week|(?:in|over)\s+the\s+past\s+week|the\s+past\s+week|past\s+week|this\s+month|last\s+month)\s*([?!.…]*)\s*$/iu;
const PL_TIME =
  /\s+(dzisiaj|dziś|wczoraj|w\s+tym\s+tygodniu|w\s+zeszłym\s+tygodniu|w\s+ostatnim\s+tygodniu|w\s+tym\s+miesiącu)\s*([?!.…]*)\s*$/iu;

export function splitTime(
  question: string,
  lang: 'en' | 'pl',
): { rest: string; period: string | null } {
  const m = (lang === 'pl' ? PL_TIME : EN_TIME).exec(question);
  if (!m) return { rest: question, period: null };
  return { rest: question.slice(0, m.index) + (m[2] ?? '?'), period: m[1] };
}

/* ── Polish case forms (generated FORWARD from the curated nominative; fail closed) ───────── */
type PlCase = 'nom' | 'gen' | 'loc';
export function plCases(nominative: string): Record<PlCase, string> | null {
  if (/\s/.test(nominative)) return null;
  const n = nominative;
  if (/a$/i.test(n)) {
    const stem = n.slice(0, -1);
    const last = stem.slice(-1).toLowerCase();
    if (last === 'i' || last === 'j') return { nom: n, gen: stem + 'i', loc: stem + 'i' };
    if (last === 'k') return { nom: n, gen: stem + 'i', loc: stem.slice(0, -1) + 'ce' };
    if (last === 'g') return { nom: n, gen: stem + 'i', loc: stem.slice(0, -1) + 'dze' };
    if (last === 'd') return { nom: n, gen: stem + 'y', loc: stem.slice(0, -1) + 'dzie' };
    if (last === 't') return { nom: n, gen: stem + 'y', loc: stem.slice(0, -1) + 'cie' };
    if (last === 'r') return { nom: n, gen: stem + 'y', loc: stem + 'ze' };
    return null;
  }
  const last = n.slice(-1).toLowerCase();
  if (last === 'r') return { nom: n, gen: n + 'u', loc: n + 'ze' };
  if (last === 'n') return { nom: n, gen: n + 'u', loc: n + 'ie' };
  if (last === 't') return { nom: n, gen: n + 'u', loc: n.slice(0, -1) + 'cie' };
  if (last === 'k') return { nom: n, gen: n + 'u', loc: n + 'u' };
  return null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function occurrences(text: string, surface: string): RegExpMatchArray[] {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(surface)}(?![\\p{L}\\p{N}])`, 'giu');
  return [...text.matchAll(re)];
}

/** Replace the ONE written form of `from` in `text` with `to` (same case in Polish). */
export function retarget(
  text: string,
  from: CountryMeta,
  to: CountryMeta,
  lang: 'en' | 'pl',
): string | null {
  if (lang === 'en') {
    const surfaces = [
      from.name,
      ...Object.entries(COUNTRY_ALIASES_BY_ISO3)
        .filter(([, iso3]) => iso3 === from.iso3)
        .map(([alias]) => alias),
    ].filter((s) => s.length >= 3);
    const hits = surfaces.flatMap((s) => occurrences(text, s).map((m) => ({ m, s })));
    const distinct = new Set(hits.map((h) => h.m.index));
    if (distinct.size !== 1) return null;
    const { m } = hits.sort((a, b) => b.m[0].length - a.m[0].length)[0];
    let before = text.slice(0, m.index);
    /* "in the UK" → "in Kenya": a leading article belongs to the old name, not the new one */
    if (/\bthe\s+$/i.test(before) && !/^the\s/i.test(to.name))
      before = before.replace(/the\s+$/i, '');
    return before + to.name + text.slice((m.index ?? 0) + m[0].length);
  }
  const fromNom = getLocalizedCountryName(from.iso2, 'pl');
  const toNom = getLocalizedCountryName(to.iso2, 'pl');
  const fromCases = fromNom ? plCases(fromNom) : null;
  const toCases = toNom ? plCases(toNom) : null;
  if (!fromCases || !toCases) return null;
  const hits = (Object.keys(fromCases) as PlCase[]).flatMap((c) =>
    occurrences(text, fromCases[c]).map((m) => ({ m, c })),
  );
  const distinct = new Set(hits.map((h) => h.m.index));
  if (distinct.size !== 1) return null;
  const { m, c } = hits.sort((a, b) => b.m[0].length - a.m[0].length)[0];
  /* "na Madagaskarze / na Kubie" — the preposition belongs to the old place, not the new one */
  if (/(?:^|\s)na\s+$/iu.test(text.slice(0, m.index))) return null;
  return text.slice(0, m.index) + toCases[c] + text.slice((m.index ?? 0) + m[0].length);
}

/** Attach the place to a short placeless follow-up: "And the economy?" → "And the economy in Kenya?". */
export function attach(text: string, to: CountryMeta, lang: 'en' | 'pl'): string | null {
  const trimmed = text.trim().replace(/[?!.…\s]+$/u, '');
  if (lang === 'en') return `${trimmed} in ${to.name}?`;
  const nom = getLocalizedCountryName(to.iso2, 'pl');
  const cases = nom ? plCases(nom) : null;
  return cases ? `${trimmed} w ${cases.loc}?` : null;
}

/** Remove the earlier stated period ("this week") before applying the reader's new one. */
export function withNewPeriod(text: string, lang: 'en' | 'pl', period: string | null): string {
  if (period === null) return text;
  const outcome = normalizeAskQuestion({
    originalQuestion: text,
    sourceLanguage: lang,
    normalizationLanguage: lang,
    displayLanguage: lang,
    origin: 'ASK',
  });
  let base = text;
  const stated =
    outcome.status === 'NOT_READ' ? undefined : outcome.reading.statedTime?.statedPeriod;
  if (stated) {
    const hits = occurrences(base, stated);
    if (hits.length === 1) {
      const h = hits[0];
      base = (base.slice(0, h.index) + base.slice((h.index ?? 0) + h[0].length)).replace(
        /\s{2,}/g,
        ' ',
      );
    }
  }
  base = base
    .trim()
    .replace(/\s+([?!.…])/gu, '$1')
    .replace(/[?!.…\s]+$/u, '');
  return `${base} ${period}?`;
}

const isEllipsis = (q: string) => readContinuationEllipsis(q) !== null;
const words = (q: string) => q.trim().split(/\s+/u).filter(Boolean).length;

export function composeCrossCountryContinuation(
  question: string,
  language: string,
  earlierNewestFirst: readonly EarlierQuestion[],
  options: { readonly hasOwnContext?: boolean } = {},
  depth = 0,
): CrossCountryContinuation | null {
  if (options.hasOwnContext === true || depth > MAX_CHAIN) return null;
  if (language !== 'en' && language !== 'pl') return null;
  const lang: 'en' | 'pl' = language;
  const { rest, period } = splitTime(question.trim(), lang);
  const ellipsis = readContinuationEllipsis(rest);
  if (ellipsis === null || ellipsis.candidates.length !== 1) return null;
  const to = findCountryByIso3(ellipsis.candidates[0]);
  const prev = earlierNewestFirst[0];
  if (to === undefined || prev === undefined || prev.language !== language) return null;

  let base: string | null = null;
  let fromQuestion = prev.question;
  if (isEllipsis(splitTime(prev.question.trim(), lang).rest)) {
    /* a chain: "…economy?" → "And in Kenya?" → "What about Uganda?" */
    const earlier = composeCrossCountryContinuation(
      prev.question,
      prev.language,
      earlierNewestFirst.slice(1),
      {},
      depth + 1,
    );
    if (earlier === null) return null;
    const from = findCountryByIso3(earlier.newCountry);
    base = from ? retarget(earlier.effectiveQuestion, from, to, lang) : null;
    fromQuestion = earlier.fromQuestion;
  } else {
    const typed = typedCountriesOf(prev.question, prev.language);
    if (typed === null) return null;
    if (typed.length === 1 && typed[0] !== 'CONTESTED') {
      const from = findCountryByIso3(typed[0]);
      if (from === undefined || from.iso3 === to.iso3) return null;
      base = retarget(prev.question, from, to, lang);
    } else if (typed.length === 0 && words(prev.question) <= MAX_CONTINUATION_WORDS) {
      /* a placeless follow-up ("And the economy?") counts only if the conversation had a place */
      const second = earlierNewestFirst[1];
      const hadPlace =
        second !== undefined &&
        ((typedCountriesOf(second.question, second.language) ?? []).length === 1 ||
          isEllipsis(splitTime(second.question.trim(), lang).rest));
      base = hadPlace ? attach(prev.question, to, lang) : null;
    }
  }
  if (base === null) return null;
  return {
    effectiveQuestion: withNewPeriod(base, lang, period),
    fromQuestion,
    newCountry: to.iso3,
  };
}
