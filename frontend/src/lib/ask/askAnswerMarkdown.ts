/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 ANSWER READING EXPERIENCE R1 · PHASE A — THE ANSWER'S OWN STRUCTURE,
 * PARSED RATHER THAN PRINTED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── THE DEFECT THIS CLOSES, AS THE PRODUCT OWNER SAW IT ───────────────────
 *
 * `**Nationally Determined Contributions**` reached readers with its asterisks. Measured at
 * `5513275`: a background answer is rendered as ONE element —
 *
 *     <p className="whitespace-pre-wrap">{payload.background.text}</p>   (AskR2TurnView:536)
 *
 * — and the cited brief renders each paragraph as plain text segments. Neither looks at the
 * markup the answer is written in, so every heading, bullet, numbered step and bold run is
 * shown to the reader as raw syntax.
 *
 * ── WHY PARSING IS NOT "INVENTING STRUCTURE" ──────────────────────────────
 *
 * The CTO's instruction is explicit: *"Do not invent headings or conclusions in the frontend.
 * Render semantic structure authored by the answer."* That is exactly what this module does
 * and all it does. It adds nothing: every heading it emits is a heading the answer wrote,
 * every bullet is a bullet the answer wrote. The previous behaviour was not neutral — it
 * DESTROYED structure the answer had already authored and showed the wreckage.
 *
 * ── SAFETY: NO ARBITRARY HTML, BY CONSTRUCTION ────────────────────────────
 *
 * This module returns a typed tree of plain data. It never returns HTML, never returns
 * `dangerouslySetInnerHTML`, and never produces an href. The renderer builds React elements
 * from that tree, so any `<script>` in the answer text is text — React escapes it — and the
 * worst a malformed answer can do is read as prose.
 *
 * MARKDOWN LINKS ARE DELIBERATELY REDUCED TO THEIR LABEL. `[text](url)` renders `text` and
 * drops the URL. Citations are a GOVERNED mechanism — a citation number is a source's
 * position in `analysis.sources`, attached by the backend — and letting a model emit a
 * clickable destination through prose would be a second, ungoverned one.
 */

export type AskInline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'strong'; readonly text: string }
  | { readonly kind: 'em'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string };

export type AskBlock =
  /** A heading the ANSWER authored. Level is clamped to 2–3: the question is the page's h1. */
  | { readonly kind: 'heading'; readonly level: 2 | 3; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'bullets'; readonly items: readonly string[] }
  | { readonly kind: 'ordered'; readonly items: readonly string[] };

const HEADING = /^(#{1,6})\s+(.*)$/;
/** `-`, `*` or `•` followed by a space. `*` only when it is not the start of `**bold**`. */
const BULLET = /^\s{0,3}(?:[-•]|\*(?!\*))\s+(.*)$/;
const ORDERED = /^\s{0,3}(\d{1,2})[.)]\s+(.*)$/;
/** A line that is only `---` / `***` / `___`: a rule. Dropped — the layout provides separation. */
const RULE = /^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/;

/**
 * A SHORT BOLD LINE ON ITS OWN IS A HEADING THE ANSWER WROTE WITHOUT A `#`.
 *
 * Models write section titles both ways, and `**Bottom line**` on its own line is the
 * CTO's own example of a concluding section. Treating it as a paragraph that happens to be
 * entirely bold reproduces the flat wall this contract exists to remove. The test is
 * deliberately narrow — a whole line, entirely one bold run, short, and not ending in
 * sentence punctuation — so a genuinely emphasised sentence stays a paragraph.
 */
const BOLD_LINE = /^\*\*([^*]{1,60})\*\*:?$/;

/**
 * The guard the comment above promises, written down rather than implied: a whole line, one
 * bold run, short, and NOT a finished sentence. `**Bottom line**` is a title;
 * `**This is an emphasised full sentence.**` is a sentence that happens to be bold, and
 * promoting it to a heading would be the frontend inventing structure.
 */
function boldLineHeading(line: string): string | null {
  const match = BOLD_LINE.exec(line.trim());
  if (match === null) return null;
  const text = match[1].trim();
  if (text.length === 0 || /[.!?]$/.test(text)) return null;
  return text;
}

function headingLevel(hashes: number): 2 | 3 {
  return hashes <= 2 ? 2 : 3;
}

/** Parse an answer's text into the blocks it was authored as. Pure; no DOM, no HTML. */
export function parseAnswerBlocks(source: string): readonly AskBlock[] {
  const blocks: AskBlock[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');

  let paragraph: string[] = [];
  let bullets: string[] = [];
  let ordered: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ').trim();
    paragraph = [];
    if (text.length === 0) return;
    const bold = boldLineHeading(text);
    if (bold !== null) {
      blocks.push({ kind: 'heading', level: 3, text: bold });
      return;
    }
    blocks.push({ kind: 'paragraph', text });
  };
  const flushBullets = (): void => {
    if (bullets.length > 0) blocks.push({ kind: 'bullets', items: bullets });
    bullets = [];
  };
  const flushOrdered = (): void => {
    if (ordered.length > 0) blocks.push({ kind: 'ordered', items: ordered });
    ordered = [];
  };
  const flushAll = (): void => {
    flushParagraph();
    flushBullets();
    flushOrdered();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim().length === 0) {
      flushAll();
      continue;
    }
    if (RULE.test(line)) {
      flushAll();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      flushAll();
      const text = heading[2].trim().replace(/\s*#+\s*$/, '');
      if (text.length > 0)
        blocks.push({ kind: 'heading', level: headingLevel(heading[1].length), text });
      continue;
    }

    /*
      A bold-only LINE is a section title, even when the next line continues in prose —
      which is exactly how `**Bottom line**` followed by its sentence is authored. Testing
      this only after paragraph lines had been joined missed every one of them.
    */
    const boldLine = boldLineHeading(line);
    if (boldLine !== null) {
      flushAll();
      blocks.push({ kind: 'heading', level: 3, text: boldLine });
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet !== null) {
      flushParagraph();
      flushOrdered();
      if (bullet[1].trim().length > 0) bullets.push(bullet[1].trim());
      continue;
    }

    const numbered = ORDERED.exec(line);
    if (numbered !== null) {
      flushParagraph();
      flushBullets();
      if (numbered[2].trim().length > 0) ordered.push(numbered[2].trim());
      continue;
    }

    /* A continuation line of the open list item, not a new paragraph. */
    if (bullets.length > 0 && /^\s{2,}\S/.test(raw)) {
      bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${line.trim()}`;
      continue;
    }
    if (ordered.length > 0 && /^\s{2,}\S/.test(raw)) {
      ordered[ordered.length - 1] = `${ordered[ordered.length - 1]} ${line.trim()}`;
      continue;
    }

    flushBullets();
    flushOrdered();
    paragraph.push(line.trim());
  }
  flushAll();
  return blocks;
}

/**
 * Split one run of text into inline spans. Order matters: code first, so `**` inside a code
 * span is not read as emphasis.
 */
export function parseInline(text: string): readonly AskInline[] {
  const out: AskInline[] = [];
  /* `code` · **strong** · __strong__ · *em* · _em_ · [label](url) -> label */
  /*
    `_x_` ONLY AT WORD BOUNDARIES. Without the lookarounds, `snake_case_name` renders its
    middle word in italics — markdown's own rule, and the reason underscore emphasis is
    bounded rather than greedy.
  */
  const pattern =
    /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(?<![A-Za-z0-9])(__[^_\n]+__)(?![A-Za-z0-9])|(\*[^\s*][^*\n]*\*)|(?<![A-Za-z0-9])(_[^\s_][^_\n]*_)(?![A-Za-z0-9])|(\[[^\]\n]*\]\([^)\n]*\))/;
  let rest = text;

  while (rest.length > 0) {
    const match = pattern.exec(rest);
    if (match === null || match.index === undefined) break;
    if (match.index > 0) out.push({ kind: 'text', text: rest.slice(0, match.index) });
    const token = match[0];

    if (token.startsWith('`')) {
      out.push({ kind: 'code', text: token.slice(1, -1) });
    } else if (token.startsWith('**') || token.startsWith('__')) {
      out.push({ kind: 'strong', text: token.slice(2, -2) });
    } else if (token.startsWith('[')) {
      /* The LABEL only. The destination is dropped: citations are the governed path. */
      const label = token.slice(1, token.indexOf(']'));
      if (label.length > 0) out.push({ kind: 'text', text: label });
    } else {
      out.push({ kind: 'em', text: token.slice(1, -1) });
    }
    rest = rest.slice(match.index + token.length);
  }
  if (rest.length > 0) out.push({ kind: 'text', text: rest });
  return out.length > 0 ? out : [{ kind: 'text', text }];
}

/** Every character a reader will see, with the markup removed. For tests and for Copy. */
export function answerPlainText(blocks: readonly AskBlock[]): string {
  const flat = (text: string): string =>
    parseInline(text)
      .map((span) => span.text)
      .join('');
  return blocks
    .map((block) => {
      if (block.kind === 'heading' || block.kind === 'paragraph') return flat(block.text);
      return block.items.map(flat).join('\n');
    })
    .join('\n');
}

/** True when a block list carries structure worth rendering as structure. */
export function answerHasStructure(blocks: readonly AskBlock[]): boolean {
  return blocks.some((block) => block.kind !== 'paragraph');
}
