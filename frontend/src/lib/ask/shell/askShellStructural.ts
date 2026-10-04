/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE FIVE STRUCTURAL TEMPLATES — L'S PARTS, ASSEMBLED BY CODE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R4 · wording by Claude L, assembly by Claude H.
 *
 * Twenty-eight of the thirty-three templates are substitution: a pattern, or one pattern per
 * CLDR plural category, and `renderShellTemplate` turns either back into a function. Five are
 * not. They append an optional segment, join a list with a language-specific conjunction and
 * quotation marks, or branch on something that is not a count:
 *
 *   askR2Strings.clarify.broadening        branches on a boolean; quotes the reader's words
 *   askR2Strings.r3.relationshipScope      optional tail; joins a list
 *   askGovernedCopy.imihigoAbsent          two independent optional segments
 *   askGovernedCopy.official               three bodies chosen by (body === null, rate)
 *   askGovernedCopy.officialFollowUp       two bodies chosen by (body === null)
 *
 * ── WHY THESE ARE ASSEMBLED HERE RATHER THAN EXPRESSED AS A PATTERN ──────
 *
 * A template language rich enough to express an optional segment, a list join and a boolean
 * branch is a second, weaker `Intl` — and every feature of it is a place a translator can be
 * misunderstood. So the division is the one the contract asked for: **L supplies the parts and
 * every language-specific decision** — the quotation marks, the list separator, the
 * conjunction, which body each branch takes — and this module only puts them in order.
 *
 * Nothing here chooses a word. If a sentence reads wrongly in some locale, the fix is in L's
 * parts, not in this file.
 */

/** The parts Claude L supplies per locale, exactly as her overlay files carry them. */
export interface StructuralParts {
  readonly [path: string]: Readonly<Record<string, string>>;
}

const fill = (pattern: string, args: readonly unknown[]): string =>
  pattern.replace(/\{(\d+)\}/g, (whole, digits: string) => {
    const value = args[Number(digits)];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : whole;
  });

/**
 * Join the reader's own words the way this language joins a list.
 *
 * Every character here is L's: the quotation marks a locale opens and closes with, its list
 * separator, and its conjunction before the last item. The EN/PL original hard-coded `“`,
 * `„`, `, ` and " and " at the call site, which is why only two languages could use it.
 */
function quoteList(items: readonly string[], parts: Readonly<Record<string, string>>): string {
  const quoted = items.map((item) => `${parts.quote_open ?? '"'}${item}${parts.quote_close ?? '"'}`);
  if (quoted.length <= 1) return quoted[0] ?? '';
  const separator = parts.list_separator ?? ', ';
  const conjunction = parts.last_conjunction ?? ' and ';
  return `${quoted.slice(0, -1).join(separator)}${conjunction}${quoted[quoted.length - 1]}`;
}

/**
 * Build the five functions for one locale from that locale's parts.
 *
 * A path whose parts are missing is simply absent from the result, so the overlay merge leaves
 * the English function in place and `shellFallbacks()` reports the key — the same honest
 * outcome as any other unsupplied key, rather than a half-assembled sentence.
 */
export function buildStructural(
  parts: StructuralParts,
): Readonly<Record<string, (...args: never[]) => string>> {
  const out: Record<string, (...args: never[]) => string> = {};
  const p = (path: string): Readonly<Record<string, string>> | undefined => parts[path];

  const broadening = p('askR2Strings.clarify.broadening');
  if (broadening !== undefined) {
    out['askR2Strings.clarify.broadening'] = ((
      notApplied: readonly string[],
      withSuggestion: boolean,
    ) =>
      `${(broadening.base ?? '').replace('{list}', quoteList(notApplied, broadening))}${
        withSuggestion ? (broadening.with_suggestion ?? '') : (broadening.without_suggestion ?? '')
      }`) as never;
  }

  const scope = p('askR2Strings.r3.relationshipScope');
  if (scope !== undefined) {
    out['askR2Strings.r3.relationshipScope'] = ((
      a: string,
      b: string,
      relations: readonly string[],
    ) =>
      `${fill(scope.head ?? '', [a, b])}${
        relations.length > 0
          ? `${scope.tail_prefix ?? ' · '}${relations.join(scope.separator ?? ', ')}`
          : ''
      }`) as never;
  }

  const absent = p('askGovernedCopy.imihigoAbsent');
  if (absent !== undefined) {
    out['askGovernedCopy.imihigoAbsent'] = ((
      district: string,
      cycle: string | null,
      aggregate: boolean,
    ) =>
      `${(absent.base ?? '')
        .replace(
          '{cycle}',
          cycle === null
            ? (absent.cycle_absent ?? '')
            : fill(absent.cycle_present ?? '', ['', cycle]),
        )
        .replace(/\{0\}/g, district)}${
        aggregate
          ? fill(absent.aggregate_tail ?? '', [district])
          : (absent.aggregate_absent ?? '')
      }`) as never;
  }

  const official = p('askGovernedCopy.official');
  if (official !== undefined) {
    out['askGovernedCopy.official'] = ((body: string | null, rate: boolean) =>
      body === null
        ? (official.body_null ?? '')
        : fill((rate ? official.body_rate : official.body_figure) ?? '', [body])) as never;
  }

  const followUp = p('askGovernedCopy.officialFollowUp');
  if (followUp !== undefined) {
    out['askGovernedCopy.officialFollowUp'] = ((body: string | null) =>
      body === null
        ? (followUp.body_null ?? '')
        : fill(followUp.body_named ?? '', [body])) as never;
  }

  return out;
}

/** The five paths this module assembles. Asserted against the overlays by the spec. */
export const STRUCTURAL_PATHS: readonly string[] = Object.freeze([
  'askR2Strings.clarify.broadening',
  'askR2Strings.r3.relationshipScope',
  'askGovernedCopy.imihigoAbsent',
  'askGovernedCopy.official',
  'askGovernedCopy.officialFollowUp',
]);
