import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MASTER CTO R47 / #95 · D04–D06 — "WHICH CONGO?", ASKED SPECIFICALLY, NEVER RESOLVED SILENTLY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Product Owner, Alpha 2026-10-13: a question naming Kigali, "right now" and a bare "Congo" came
 * back with the generic "Add one specific place, topic or period" — although a place and a time
 * WERE named. Two server outcomes reach the reader for such a question:
 *   · LANDED_AMBIGUOUS_COUNTRY with candidates [COD, COG] — the server's own ambiguity verdict;
 *   · a clarification WITHOUT candidates (live 059cdb7: the subjectless follow-up guard,
 *     NO_PRIOR_SUBJECT) — a backend router defect tracked separately.
 * In both, when the reader's own words contain a bare "Congo", the one specific question is WHICH
 * Congo. Each choice is the reader's question with only that word replaced by the full official
 * name (the long forms the reviewed Congo reading recognises), so Kigali, the time and every other
 * word stay exactly as written. The draft is staged, never sent; nothing is assigned to either
 * country until the reader chooses. A question that already says which Congo is never touched.
 */
const QUALIFIED =
  /(?:^|[^\p{L}])(?:dr\s*congo|d\.r\.\s*congo|rd\s*congo|drc|rdc|democratic\s+republic|r[ée]publique|rep[uú]blica|republic\s+of\s+(?:the\s+)?congo|kinshasa|brazzaville|pointe-noire)(?=$|[^\p{L}])/iu;
const BARE = /(^|[^\p{L}])(congo)(?=$|[^\p{L}])/iu;

interface CongoCopy {
  readonly lead: string;
  readonly cod: { readonly label: string; readonly name: string };
  readonly cog: { readonly label: string; readonly name: string };
}

/* EN reviewed; FR / ES / PT / DE / AR / PL are Claude Code drafts pending Claude L (the reader's
   question keeps its own language; only the country name is replaced, in that language). */
const COPY: Readonly<Record<string, CongoCopy>> = {
  en: {
    lead: 'Which Congo do you mean? The rest of your question stays as you wrote it.',
    cod: { label: 'Democratic Republic of the Congo (Kinshasa)', name: 'Democratic Republic of the Congo' },
    cog: { label: 'Republic of the Congo (Brazzaville)', name: 'Republic of the Congo' },
  },
  fr: {
    lead: 'De quel Congo s’agit-il ? Le reste de votre question reste tel que vous l’avez écrit.',
    cod: { label: 'République démocratique du Congo (Kinshasa)', name: 'République démocratique du Congo' },
    cog: { label: 'République du Congo (Brazzaville)', name: 'République du Congo' },
  },
  es: {
    lead: '¿A qué Congo te refieres? El resto de tu pregunta queda tal como la escribiste.',
    cod: { label: 'República Democrática del Congo (Kinshasa)', name: 'República Democrática del Congo' },
    cog: { label: 'República del Congo (Brazzaville)', name: 'República del Congo' },
  },
  pt: {
    lead: 'A que Congo se refere? O resto da sua pergunta fica como a escreveu.',
    cod: { label: 'República Democrática do Congo (Kinshasa)', name: 'República Democrática do Congo' },
    cog: { label: 'República do Congo (Brazzaville)', name: 'República do Congo' },
  },
  de: {
    lead: 'Welchen Kongo meinen Sie? Der Rest Ihrer Frage bleibt, wie Sie ihn geschrieben haben.',
    cod: { label: 'Demokratische Republik Kongo (Kinshasa)', name: 'Demokratische Republik Kongo' },
    cog: { label: 'Republik Kongo (Brazzaville)', name: 'Republik Kongo' },
  },
  ar: {
    lead: 'أيّ كونغو تقصد؟ يبقى باقي سؤالك كما كتبته.',
    cod: { label: 'جمهورية الكونغو الديمقراطية (كينشاسا)', name: 'جمهورية الكونغو الديمقراطية' },
    cog: { label: 'جمهورية الكونغو (برازافيل)', name: 'جمهورية الكونغو' },
  },
  pl: {
    lead: 'O które Kongo chodzi? Reszta pytania pozostaje tak, jak ją napisano.',
    cod: { label: 'Demokratyczna Republika Konga (Kinszasa)', name: 'Demokratyczna Republika Konga' },
    cog: { label: 'Republika Konga (Brazzaville)', name: 'Republika Konga' },
  },
};

export interface CongoClarification {
  readonly lead: string;
  /** COD first, then COG — the server's own candidate order. */
  readonly choices: readonly { readonly iso3: 'COD' | 'COG'; readonly label: string; readonly question: string }[];
}

/** Null unless the reader's own words contain a bare "Congo" and nothing that already says which. */
export function congoClarificationOf(question: string, locale: DisplayLocale | string): CongoClarification | null {
  const text = question.trim();
  if (text === '' || QUALIFIED.test(text)) return null;
  const match = BARE.exec(text);
  if (match === null) return null;
  const copy = COPY[locale] ?? COPY.en;
  const at = match.index + match[1].length;
  const replace = (name: string) => `${text.slice(0, at)}${name}${text.slice(at + match[2].length)}`;
  return {
    lead: copy.lead,
    choices: [
      { iso3: 'COD', label: copy.cod.label, question: replace(copy.cod.name) },
      { iso3: 'COG', label: copy.cog.label, question: replace(copy.cog.name) },
    ],
  };
}
