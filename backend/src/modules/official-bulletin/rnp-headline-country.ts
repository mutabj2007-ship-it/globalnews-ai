import { COUNTRIES } from '@globalnews-ai/shared';

/*
  E1 ADDENDUM-05 (2026-10-18) — the country-level event geography of a Rwanda National Police listing item is
  DERIVED, deterministically and in code only, from its listing title. The title itself is never rendered,
  never stored, never placed in a model prompt (C-1); only the ISO3 and the rule id leave this file (C-6).

  C-2  the publisher's own name is removed BEFORE matching: every item says "Rwanda National Police", and a
       naive matcher would place G's NEG-1 item ("… in South Sudan") in Rwanda.
  C-3  longest name first, and a matched span is consumed: "South Sudan" is SSD, never also SDN.
  C-4  country names and official short forms only, as whole tokens: "Rwandan" is an actor, not a place.
  C-5  two or more countries → AMBIGUOUS; none → NOT_STATED; never the publisher's country.
  Bare "Congo" is deliberately NOT a key (the Congo-Kinshasa → COG P0): only the explicit DR / Republic forms.
*/
export const RNP_GEO_RULE = 'RNP-GEO-R1';

export type RnpGeography =
  | { readonly outcome: 'MATCHED'; readonly iso3: string; readonly rule: typeof RNP_GEO_RULE }
  | { readonly outcome: 'AMBIGUOUS' | 'NOT_STATED'; readonly iso3: null; readonly rule: typeof RNP_GEO_RULE };

/** C-2 — the publisher's own name in every form it uses, removed before any country is looked for. */
const PUBLISHER_NAMES: readonly string[] = ['rwanda national police', 'rnp'];

/** Official long forms the country table does not carry, reviewed one by one. */
const OFFICIAL_FORMS: Readonly<Record<string, string>> = {
  'democratic republic of the congo': 'COD',
  'republic of the congo': 'COG',
  'united republic of tanzania': 'TZA',
};

/** Lower case, diacritics folded, every non-letter a single space — so matching is by whole token. */
export function foldForMatch(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}]+/gu, ' ')
    .trim();
}

const KEYS: readonly (readonly [string, string])[] = [
  ...COUNTRIES.filter((c) => c.iso3 !== 'COG').map((c) => [foldForMatch(c.name), c.iso3] as const),
  ...Object.entries(OFFICIAL_FORMS).map(([name, iso3]) => [foldForMatch(name), iso3] as const),
]
  .filter(([key]) => key.length > 0)
  .sort((a, b) => b[0].length - a[0].length);

export function rnpHeadlineCountry(title: string): RnpGeography {
  let text = ` ${foldForMatch(title)} `;
  for (const name of PUBLISHER_NAMES) text = text.split(` ${name} `).join('  ');
  const found = new Set<string>();
  for (const [key, iso3] of KEYS) {
    const needle = ` ${key} `;
    let at = text.indexOf(needle);
    while (at !== -1) {
      found.add(iso3);
      text = text.slice(0, at) + ' '.repeat(needle.length) + text.slice(at + needle.length);
      at = text.indexOf(needle);
    }
  }
  if (found.size === 1) return { outcome: 'MATCHED', iso3: [...found][0], rule: RNP_GEO_RULE };
  return { outcome: found.size === 0 ? 'NOT_STATED' : 'AMBIGUOUS', iso3: null, rule: RNP_GEO_RULE };
}
