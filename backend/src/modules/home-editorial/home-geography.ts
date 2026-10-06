import { EAST_AFRICA_MEMBERS, EU27_MEMBERS, MIDDLE_EAST_MEMBERS, findCountryByIso3 } from '@globalnews-ai/shared';
import { scoreCountryRelevance } from '../news/country/country-relevance.util';
import { leadSentence, namesAnyCountry } from './home-eligibility';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME DATA TRUTH CORRECTION R1 · B3 — A HOME REGION PLACEMENT MUST BE SUPPORTED BY THE STORY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A stored `ArticleCountry.isRelevant` tag is NOT, by itself, enough to put a story in a Home
 * region row: "Obesity costs Britain's economy £20bn" was tagged Spain (a comparison in the
 * summary) and reached the EU row; a US utility-merger story was tagged Kenya ("Councilwoman
 * Kenya Gibson") and was eligible for East Africa.
 *
 * For PUBLIC regional placement a tagged country is kept only when the story itself names it,
 * judged by the canonical scorer (country names, governed aliases, curated cities, demonyms —
 * `scoreCountryRelevance`; no second geography vocabulary):
 *
 *   1. the HEADLINE names it (place or demonym); or
 *   2. the headline names NO country at all, and the summary's LEAD SENTENCE names it as a place —
 *      not as a person's name ("Councilwoman Kenya Gibson").
 *
 * FINAL CORRECTION · R1 — a governed region member the HEADLINE explicitly names supports placement
 * even when upstream tagging missed it ("Houthis hit Saudi base…" tagged only Yemen/Iran). This is a
 * presentation relation only: no ArticleCountry row is written and the stored tags are not changed.
 *
 * When the headline names a country (tagged or not), a country found only in the summary is a
 * secondary mention (a comparison, a reaction) and does not move the story into that region.
 * Unsupported tags only lose Home placement: the article, its tags and its canonical Story stay
 * untouched and searchable.
 */
export interface TaggedCountry {
  readonly iso3: string;
  readonly relevance: number;
}

const PLACE_IN_TITLE = new Set(['country reference appears in title', 'demonym appears in title']);
const PLACE_IN_SUMMARY = 'country reference appears in summary';
const SURNAME_ONLY = 'likely surname-only mention';

/* honorifics and offices that turn a country word into a person's name */
const PERSON_BEFORE =
  /\b(mr|mrs|ms|miss|dr|sir|dame|prof|professor|councilwoman|councilman|councillor|councilor|council member|senator|sen|rep|representative|congresswoman|congressman|mayor|judge|actress|actor|singer|rapper|player|coach)\.?\s+$/i;

function namedAsPerson(lead: string, name: string): boolean {
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  let m: RegExpExecArray | null;
  let any = false;
  while ((m = re.exec(lead)) !== null) {
    any = true;
    if (!PERSON_BEFORE.test(lead.slice(0, m.index))) return false;
  }
  return any;
}

/* the shared Home region scopes (no local list): the only countries a Home row can be built from */
const GOVERNED_MEMBERS: readonly string[] = [...new Set([...EAST_AFRICA_MEMBERS, ...EU27_MEMBERS, ...MIDDLE_EAST_MEMBERS])];

/** The canonical scorer's title verdict for one country: its score when the headline names it, else null. */
function titleScore(title: string, iso3: string): number | null {
  const meta = findCountryByIso3(iso3);
  if (meta === undefined) return null;
  const r = scoreCountryRelevance({ title, summary: '' }, meta);
  return !r.reasons.includes(SURNAME_ONLY) && r.reasons.some((x) => PLACE_IN_TITLE.has(x)) ? r.score : null;
}

function leadNames(lead: string, iso3: string): boolean {
  const meta = findCountryByIso3(iso3);
  if (meta === undefined || lead === '') return false;
  const r = scoreCountryRelevance({ title: '', summary: lead }, meta);
  if (r.reasons.includes(SURNAME_ONLY) || !r.reasons.includes(PLACE_IN_SUMMARY)) return false;
  return !namedAsPerson(lead, meta.name);
}

/** The subset of a story's tagged countries that its own headline / lead supports for Home placement. */
export function supportedCountries(
  row: { readonly title: string; readonly summary: string | null },
  tagged: readonly TaggedCountry[],
): TaggedCountry[] {
  const inTitle = tagged.filter((c) => titleScore(row.title, c.iso3) !== null);
  /* R1 — governed members the headline names, whether or not upstream tagged them */
  const untagged: TaggedCountry[] = [];
  for (const iso3 of GOVERNED_MEMBERS) {
    if (tagged.some((c) => c.iso3 === iso3)) continue;
    const score = titleScore(row.title, iso3);
    if (score !== null) untagged.push({ iso3, relevance: score });
  }
  if (inTitle.length + untagged.length > 0) return [...inTitle, ...untagged];
  /* the headline locates the story in a country that is not tagged here: the tags are secondary */
  if (namesAnyCountry(row.title)) return [];
  const lead = leadSentence(row.summary);
  return tagged.filter((c) => leadNames(lead, c.iso3));
}
