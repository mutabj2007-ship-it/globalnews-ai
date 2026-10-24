/**
 * E1 V6 (ADDENDUM-24, C-GV1…C-GV9) + G R175 — THE GLOBAL VOICES ADMISSION GATE, ON THE ARTICLE PAGE.
 *
 * CC BY 3.0 is granted on attribution and terminates on breach with no cure period, so an item whose
 * author we cannot resolve DETERMINISTICALLY is an item we cannot lawfully display, summarise or model.
 * Three outcomes, fail closed (C-GV1):
 *   ADMIT                          — author, publication date, canonical URL and licence all resolved;
 *   ATTRIBUTION_NOT_DETERMINISTIC  — refused for every use; re-admissible if the rule improves;
 *   EXCLUDE                        — not GV's to license (provenance), or not on the cleared host.
 *
 * ADMIT iff ALL (G R175 §3, the corrected rule):
 *   A  the author comes from the ON-PAGE byline furniture — exactly one contributor, labelled exactly
 *      "Written by", a person name whose author-page slug is that name. NEVER dc:creator (correct in
 *      0 of 5 measured items); never body prose (C-GV2).
 *   B  NO content-provenance phrase anywhere on the page (C-GV3). Keyed on the PREPOSITION: never on
 *      "originally published" alone (the feed footer, 5/5) and never on the bare word "partnership"
 *      (a funder credit, G W-3). The markers are LOAD-BEARING: G's newest bare-byline item passes A
 *      and is caught only by "content-sharing agreement" (G W-2).
 *   C  a "Posted <d Month yyyy>" date. "Translation posted" is copy time, never publication time (C-GV5).
 *   D  rel="canonical" READ from the raw HTML, https, on globalvoices.org exactly, naming the same
 *      article as the item; missing → fail closed; advox.globalvoices.org excluded (C-GV8).
 *   E  media dropped unconditionally — not a caller decision (C-GV4).
 *   F  the page's own licence link is CC BY 3.0, so the four attribution conditions can be rendered.
 *
 * Translations ("Written (<Lang>) by" / "Translated by" / "Translation posted") are B2 and EXCLUDED by
 * default (C-GV6). G's B1 discriminator needs a read of the language-edition original that E1 has not
 * granted; until it does, every translation fails closed.
 *
 * Pure: no network, no clock. The page is read once at admission and nothing but the verdict is kept.
 */
export const GV_CLEARED_HOST = 'globalvoices.org';
export const GV_LICENCE = Object.freeze({
  id: 'CC-BY-3.0',
  url: 'https://creativecommons.org/licenses/by/3.0/',
} as const);

export type GvExcludeReason =
  | 'CANONICAL_MISSING'
  | 'CANONICAL_HOST_NOT_CLEARED'
  | 'CANONICAL_NOT_THIS_ITEM'
  | 'CONTENT_PROVENANCE_MARKER'
  | 'TRANSLATION_B2_DEFAULT'
  | 'LICENCE_NOT_CC_BY_3';

export type GvNotDeterministicReason =
  | 'NO_BYLINE'
  | 'MULTIPLE_CONTRIBUTORS'
  | 'BYLINE_LABEL_NOT_BARE'
  | 'NAME_NOT_A_PERSON'
  | 'NO_PUBLICATION_DATE';

export type GvVerdict =
  | {
      readonly outcome: 'ADMIT';
      readonly admissionClass: 'A_GV_ORIGINAL';
      readonly author: { readonly name: string; readonly profileUrl: string };
      /** the publisher's own publication DATE (day precision; GV prints no time) */
      readonly publishedOn: string;
      readonly canonicalUrl: string;
      readonly licence: typeof GV_LICENCE;
      readonly dropMedia: true;
    }
  | {
      readonly outcome: 'ATTRIBUTION_NOT_DETERMINISTIC';
      readonly reason: GvNotDeterministicReason;
      readonly dropMedia: true;
    }
  | {
      readonly outcome: 'EXCLUDE';
      readonly reason: GvExcludeReason;
      readonly marker?: string;
      readonly dropMedia: true;
    };

/*
  C-GV3 + G W-3 — content-provenance phrases only. Matched on whitespace-normalised, tag-stripped text,
  case-insensitive, with "-" and " " interchangeable inside compounds.
*/
const PROVENANCE_MARKERS: readonly RegExp[] = [
  /\boriginally published by\b/i,
  /\brepublished on global voices\b/i,
  /\bcontent[\s-]partnership agreement\b/i,
  /\bcontent[\s-]sharing agreement\b/i,
  /\ba content partner of global voices\b/i,
  /\bpublished on global voices with permission\b/i,
  /\bbeing published on global voices as part of\b/i,
];

/* names that address an organisation, a desk or a placeholder, never a person (fail closed) */
const NOT_A_PERSON =
  /\b(?:guest|contributor|global voices|media|news|network|rights|agency|desk|team|staff|editors?|editorial|project|foundation|institute|lab|collective|coalition|centre|center|observatory|advox|lingua|newsroom)\b/i;

/* E1-BIDI-1/-2: an author name is third-party data — any control or format character refuses it */
const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/u;

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return m ? decodeEntities(m[1] ?? m[2] ?? '') : null;
}

/** The article's identity: https, the cleared host exactly, path without a trailing slash. */
function articleKey(url: string | null | undefined): { host: string; key: string } | null {
  try {
    const u = new URL(url ?? '');
    if (u.protocol !== 'https:') return null;
    return {
      host: u.hostname.toLowerCase(),
      key: `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`,
    };
  } catch {
    return null;
  }
}

function readCanonical(html: string): string | null {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, 'rel');
    if (rel && rel.toLowerCase().split(/\s+/).includes('canonical')) return attr(tag, 'href');
  }
  return null;
}

interface Contributor {
  readonly label: string;
  readonly name: string;
  readonly profileUrl: string;
}

/* the post's own credit blocks only — sidebar/promo cards use a different container class */
const CONTRIBUTOR =
  /<div\s+class\s*=\s*['"]contributor-name['"]\s*>\s*<span\s+class\s*=\s*['"]credit-label['"]\s*>([^<]*)<\/span>\s*<a\b([^>]*)>([^<]*)<\/a>/gi;

function readContributors(html: string): Contributor[] {
  const seen = new Map<string, Contributor>();
  for (const m of html.matchAll(CONTRIBUTOR)) {
    const label = decodeEntities(m[1] ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    const name = decodeEntities(m[3] ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    const profileUrl = attr(m[2] ?? '', 'href') ?? '';
    seen.set(`${label}\u0000${name}\u0000${profileUrl}`, { label, name, profileUrl });
  }
  return [...seen.values()];
}

function slugOf(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** A person name, deterministically: 2–5 words, no org/desk/placeholder word, slug = author page. */
function isPersonByline(c: Contributor): boolean {
  if (CONTROL_OR_FORMAT.test(c.name)) return false;
  const words = c.name.split(' ');
  if (words.length < 2 || words.length > 5) return false;
  if (!words.every((w) => /^\p{Lu}[\p{L}\p{M}'’.-]*$/u.test(w))) return false;
  if (NOT_A_PERSON.test(c.name)) return false;
  const profile = articleKey(c.profileUrl);
  if (!profile || profile.host !== GV_CLEARED_HOST) return false;
  return profile.key === `${GV_CLEARED_HOST}/author/${slugOf(c.name)}`;
}

function readPostDate(html: string): { label: string; isoDate: string | null } | null {
  const m = /<span\s+class\s*=\s*['"]post-date['"]\s*>([\s\S]*?)<\/span>/i.exec(html);
  if (!m) return null;
  const text = visibleText(m[1] ?? '');
  const d = /^(Translation posted|Posted) (\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(text);
  if (!d) return { label: text, isoDate: null };
  const month = MONTHS.indexOf((d[3] ?? '').toLowerCase());
  if (month < 0) return { label: d[1] ?? '', isoDate: null };
  const iso = `${d[4]}-${String(month + 1).padStart(2, '0')}-${String(Number(d[2])).padStart(2, '0')}`;
  const check = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== iso)
    return { label: d[1] ?? '', isoDate: null };
  return { label: d[1] ?? '', isoDate: iso };
}

function readLicenceHrefs(html: string): string[] {
  const out: string[] = [];
  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, 'rel');
    if (rel && rel.toLowerCase().split(/\s+/).includes('license'))
      out.push(attr(tag, 'href') ?? '');
  }
  return out;
}

const exclude = (reason: GvExcludeReason, marker?: string): GvVerdict =>
  marker === undefined
    ? { outcome: 'EXCLUDE', reason, dropMedia: true }
    : { outcome: 'EXCLUDE', reason, marker, dropMedia: true };
const notDeterministic = (reason: GvNotDeterministicReason): GvVerdict => ({
  outcome: 'ATTRIBUTION_NOT_DETERMINISTIC',
  reason,
  dropMedia: true,
});

/**
 * @param itemUrl the feed item's link — the article the page must say it IS (canonical match).
 * @param html    the raw article page, fetched once from the cleared host.
 */
export function admitGlobalVoicesPage(itemUrl: string, html: string): GvVerdict {
  /* D — the canonical, read, never reconstructed */
  const canonicalUrl = readCanonical(html);
  const canonical = articleKey(canonicalUrl);
  if (!canonicalUrl || !canonical) return exclude('CANONICAL_MISSING');
  if (canonical.host !== GV_CLEARED_HOST) return exclude('CANONICAL_HOST_NOT_CLEARED');
  const item = articleKey(itemUrl);
  if (!item || item.key !== canonical.key) return exclude('CANONICAL_NOT_THIS_ITEM');

  /* B — provenance first: a marker excludes even when the byline resolves (G W-2, T1) */
  const text = visibleText(html);
  for (const marker of PROVENANCE_MARKERS) {
    const hit = marker.exec(text);
    if (hit) return exclude('CONTENT_PROVENANCE_MARKER', hit[0].toLowerCase());
  }

  /* C-GV6 — any translation signal is B2 by default */
  const contributors = readContributors(html);
  const date = readPostDate(html);
  const translation =
    contributors.some(
      (c) => /^Written \(.+\) by$/.test(c.label) || /^Translated\b/i.test(c.label),
    ) || date?.label === 'Translation posted';
  if (translation) return exclude('TRANSLATION_B2_DEFAULT');

  /* F — the page's own licence */
  const licences = readLicenceHrefs(html);
  if (
    licences.length === 0 ||
    !licences.every((h) => h.replace(/^http:/, 'https:') === GV_LICENCE.url)
  ) {
    return exclude('LICENCE_NOT_CC_BY_3');
  }

  /* A — exactly one bare "Written by <person>" */
  if (contributors.length === 0) return notDeterministic('NO_BYLINE');
  if (contributors.length > 1) return notDeterministic('MULTIPLE_CONTRIBUTORS');
  const [author] = contributors as [Contributor];
  if (author.label !== 'Written by') return notDeterministic('BYLINE_LABEL_NOT_BARE');
  if (!isPersonByline(author)) return notDeterministic('NAME_NOT_A_PERSON');

  /* C — the publisher's own publication date */
  if (!date || date.label !== 'Posted' || !date.isoDate)
    return notDeterministic('NO_PUBLICATION_DATE');

  return {
    outcome: 'ADMIT',
    admissionClass: 'A_GV_ORIGINAL',
    author: { name: author.name, profileUrl: author.profileUrl },
    publishedOn: date.isoDate,
    canonicalUrl,
    licence: GV_LICENCE,
    dropMedia: true,
  };
}
