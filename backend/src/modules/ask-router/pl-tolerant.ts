/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 FOURTH PASS — POLISH WITH AND WITHOUT DIACRITICS IS THE SAME TEXT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Readers often type Polish without diacritics ("czym sie rozni", "co sie dzis dzieje"). The
 * governed Polish readers are written with diacritics ("czym się różni", "dziś"). Rather than
 * mirror every pattern, a Polish pattern is made TOLERANT: it matches the text as written, and
 * if not, the diacritic-FOLDED pattern is tried on the diacritic-folded text (ą→a, ć→c, ę→e, ł→l,
 * ń→n, ó→o, ś→s, ź→z, ż→z). Folding is one character for one character, so match positions and
 * lengths stay aligned with the original text. Only form changes; meaning is never rewritten,
 * and the reader's original text is what is stored and shown.
 */
const FOLD: Readonly<Record<string, string>> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
  Ą: 'A',
  Ć: 'C',
  Ę: 'E',
  Ł: 'L',
  Ń: 'N',
  Ó: 'O',
  Ś: 'S',
  Ź: 'Z',
  Ż: 'Z',
};

/** Polish diacritics folded, one character for one character. */
export function foldPl(text: string): string {
  return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (c) => FOLD[c] ?? c);
}

/**
 * A RegExp that also matches the diacritic-folded text with the diacritic-folded pattern. A
 * drop-in RegExp: `test`, `exec`, `matchAll`, `source` and `flags` all work.
 */
export class PlTolerantRegExp extends RegExp {
  private readonly folded: RegExp;

  constructor(pattern: RegExp | string, flags?: string) {
    super(pattern, flags);
    this.folded = new RegExp(foldPl(this.source), this.flags);
  }

  exec(text: string): RegExpExecArray | null {
    const start = this.lastIndex;
    const direct = super.exec(text);
    if (direct !== null) return direct;
    const foldedText = foldPl(text);
    if (foldedText === text && foldPl(this.source) === this.source) return null;
    this.folded.lastIndex = start;
    const m = this.folded.exec(foldedText);
    if (m === null) {
      if (this.global || this.sticky) this.lastIndex = 0;
      return null;
    }
    if (this.global || this.sticky) this.lastIndex = this.folded.lastIndex;
    /* the whole match, restored to the reader's own spelling (positions are aligned) */
    m[0] = text.slice(m.index, m.index + m[0].length);
    (m as { input: string }).input = text;
    return m;
  }

  static get [Symbol.species](): RegExpConstructor {
    return PlTolerantRegExp as unknown as RegExpConstructor;
  }
}

/** A Polish (or mixed EN/PL) pattern made diacritic-tolerant. */
export function plTolerant(re: RegExp): RegExp {
  return new PlTolerantRegExp(re.source, re.flags);
}
