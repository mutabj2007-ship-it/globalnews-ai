/**
 * S1 — RSS/ATOM ITEM EXTRACTION.
 *
 * DELIBERATELY NARROW, AND THE LIMITS ARE THE DESIGN. This is not a general XML
 * parser and must never become one. It extracts a fixed set of fields from the
 * item/entry elements of feeds served by a CURATED registry of publishers whose
 * output has been inspected — see __fixtures__/README.md for exactly what was
 * captured from whom.
 *
 * WHY NOT A DEPENDENCY. The repository has no XML parser today. Adding one for
 * six known feeds buys generality nobody needs and a supply-chain surface
 * everybody inherits. If the feed set later grows beyond curated publishers,
 * `fast-xml-parser` (MIT) is the natural replacement and this module should be
 * deleted rather than extended — that is the honest upgrade path, recorded here
 * so the next person does not grow this file instead.
 *
 * WHAT IT HANDLES, because real captured feeds contain all of it:
 *   - RSS 2.0 <item> and Atom <entry>
 *   - CDATA sections, including CDATA with surrounding whitespace (Statistics
 *     Poland wraps even <pubDate> that way)
 *   - numeric and named HTML entities in titles (KT Press: &#8217;, &#8220;)
 *   - HTML markup inside a description, which is stripped to text
 *   - namespaced siblings (dc:, wfw:, slash:, sy:, atom:) which are ignored
 *   - self-closing and empty elements
 *
 * WHAT IT REFUSES TO DO:
 *   - guess. An item without a usable link or title is DROPPED, never patched.
 *   - synthesize. An empty description stays empty; no summary is generated
 *     from the title, matching GDELT DOC's own rule.
 *   - interpret. It returns raw strings; dates are parsed by the caller.
 */

export interface ParsedFeedItem {
  readonly title: string;
  readonly link: string;
  /** Empty string when the feed supplied none. Never synthesized. */
  readonly summary: string;
  /**
   * FULL TEXT THE PUBLISHER CHOSE TO SYNDICATE, from <content:encoded>.
   *
   * THE LAWFUL BASIS, STATED ONCE AND PRECISELY. A publisher who places an
   * article body inside their OWN feed has published it FOR syndication - that
   * is what the element is for. Reading it is not scraping, it is consuming what
   * was offered. Nothing here fetches a publisher page, follows a link, or
   * reaches past what the feed itself contains.
   *
   * Absent when the feed carries no such element, which is the common case.
   */
  readonly syndicatedBody?: string;
  /**
   * Where the article text actually came from, so a downstream evidence
   * assessment can tell REAL BODY CONTENT from a summary. Without it a 700-char
   * description and a 700-char article body are indistinguishable, and an
   * analysis built on the former is paraphrase presented as analysis.
   */
  readonly bodySource: 'content-encoded' | 'description' | 'none';
  /** Raw date string exactly as published, or undefined. Parsed by the caller. */
  readonly publishedAt?: string;
  readonly categories: readonly string[];
}

export interface ParsedFeed {
  readonly channelTitle?: string;
  readonly items: readonly ParsedFeedItem[];
  /** Items present in the document that were dropped for being unusable. */
  readonly droppedItemCount: number;
}

/** The small, closed set of named entities these feeds actually use. */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(
      /&([a-zA-Z]+);/g,
      (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match,
    );
}

/**
 * Unwraps CDATA and trims. Statistics Poland writes
 * `<title>\n<![CDATA[ Text ]]>\n</title>`, so the whitespace lives BOTH outside
 * and inside the CDATA and both have to go.
 */
function unwrap(raw: string): string {
  const withoutCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

  return decodeEntities(withoutCdata).trim();
}

/**
 * WordPress appends a self-referential trailer to every feed description:
 * "The post <headline> appeared first on <Publisher Name>." It is template
 * output, not the article's text, and it must not reach the evidence pool.
 *
 * THIS IS NOT COSMETIC — IT WAS A MEASURED DEFECT. Relevance scoring reads the
 * summary, and the trailer carries the PUBLISHER'S OWN NAME. For a publisher
 * whose name contains a country ("Taarifa Rwanda"), the trailer supplies a
 * country mention that the journalism never made. Measured on a real KT Press
 * item with no Rwanda signal in its text: 15 and refused without the trailer,
 * 45 and ADMITTED with it, on the strength of a reason that reads "country
 * reference appears in summary" when the only reference was a template.
 *
 * That is precisely the kind of fabricated admission the local-publisher work
 * exists to prevent, so it is removed at the parser boundary rather than left
 * for a downstream heuristic to guess at.
 *
 * DELIBERATELY NARROW. The pattern must reach the END of the text and must
 * contain "appeared first on" — an article that merely opens a sentence with
 * "The post" is untouched. Nothing else is stripped: no editorializing about
 * what counts as boilerplate, and no other publisher's markup is guessed at.
 */
function stripFeedTrailer(text: string): string {
  return text.replace(/\s*The post\b[\s\S]*?\bappeared first on\b[\s\S]*$/, '').trim();
}

/** Strips HTML tags from a description body, then collapses whitespace. */
function toPlainText(raw: string): string {
  const flattened = unwrap(raw)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return stripFeedTrailer(flattened);
}

/**
 * Reads the text of the FIRST occurrence of a non-namespaced element.
 *
 * The `(?![\w:-])` guard is what stops `<link>` matching `<linkFoo>` and, more
 * importantly, stops a namespaced sibling such as `<atom:link>` or
 * `<dc:creator>` being mistaken for the plain element — real feeds carry both.
 */
/**
 * Reads a NAMESPACED element such as <content:encoded>.
 *
 * readElement() below deliberately refuses these - its `(?![\w:-])` guard exists
 * to stop <atom:link> being mistaken for <link>. content:encoded is the one
 * namespaced element we genuinely want, so it gets its own reader rather than a
 * weakening of that guard.
 */
function readNamespacedElement(block: string, tag: string): string | undefined {
  const open = new RegExp(`<${tag}(?![\\w-])[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = block.match(open);

  return match ? match[1] : undefined;
}

function readElement(block: string, tag: string): string | undefined {
  const open = new RegExp(`<${tag}(?![\\w:-])[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = block.match(open);

  return match ? match[1] : undefined;
}

function readAll(block: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}(?![\\w:-])[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const found: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(block)) !== null) {
    found.push(match[1]);
  }

  return found;
}

/** Atom links carry the URL in an href attribute rather than as text. */
function readAtomLink(block: string): string | undefined {
  const alternate = block.match(
    /<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*>/i,
  );

  if (alternate) return alternate[1];

  const plain = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);

  return plain ? plain[1] : undefined;
}

function parseItemBlock(block: string): ParsedFeedItem | undefined {
  const title = unwrap(readElement(block, 'title') ?? '');

  const link = unwrap(readElement(block, 'link') ?? '') || unwrap(readAtomLink(block) ?? '');

  /*
   * AN ITEM WITHOUT A TITLE OR A LINK IS DROPPED, NOT REPAIRED. The link is the
   * article's identity everywhere downstream — it is the dedup key, the
   * publisher-identity input and the provenance URL — so an item missing it
   * cannot be normalized honestly.
   */
  if (title.length === 0 || link.length === 0) return undefined;

  const description = readElement(block, 'description') ?? readElement(block, 'summary') ?? '';
  const encoded = readNamespacedElement(block, 'content:encoded');
  const syndicatedBody = encoded ? toPlainText(encoded) : '';

  const publishedAt =
    unwrap(readElement(block, 'pubDate') ?? '') ||
    unwrap(readElement(block, 'published') ?? '') ||
    unwrap(readElement(block, 'updated') ?? '');

  return {
    title,
    link,
    // Empty stays empty. No summary is ever generated from the title.
    summary: toPlainText(description),
    /*
     * ONLY KEPT WHEN IT ADDS SOMETHING. Many WordPress feeds emit an identical
     * description and content:encoded; recording the same text twice and calling
     * one of them "body" would overstate the evidence depth, which is the exact
     * failure this field exists to prevent.
     */
    ...(syndicatedBody.length > 0 && syndicatedBody !== toPlainText(description)
      ? { syndicatedBody, bodySource: 'content-encoded' as const }
      : {}),
    bodySource:
      syndicatedBody.length > 0 && syndicatedBody !== toPlainText(description)
        ? ('content-encoded' as const)
        : toPlainText(description).length > 0
          ? ('description' as const)
          : ('none' as const),
    publishedAt: publishedAt.length > 0 ? publishedAt : undefined,
    categories: readAll(block, 'category')
      .map((value) => unwrap(value))
      .filter(Boolean),
  };
}

/**
 * Parses a feed document. Never throws: an unrecognisable document yields zero
 * items, which the provider reports as "no articles" rather than as a crash.
 */
export function parseFeed(xml: string): ParsedFeed {
  const source = typeof xml === 'string' ? xml : '';

  const channelTitleRaw =
    readElement(source.split(/<item(?![\w:-])/i)[0] ?? source, 'title') ?? undefined;

  const blocks = [...readAll(source, 'item'), ...readAll(source, 'entry')];

  const items: ParsedFeedItem[] = [];
  let dropped = 0;

  for (const block of blocks) {
    const item = parseItemBlock(block);

    if (item) {
      items.push(item);
    } else {
      dropped += 1;
    }
  }

  return {
    channelTitle: channelTitleRaw ? unwrap(channelTitleRaw) : undefined,
    items,
    droppedItemCount: dropped,
  };
}
