import type { ComparisonCountryCoverage } from '@globalnews-ai/shared';

/** Fail closed on unsupported affirmative locality claims in the generated brief. */
export function hasUnsupportedLocalReportingClaim(
  summary: string,
  coverage?: readonly ComparisonCountryCoverage[],
): boolean {
  if (!coverage?.some((member) => member.localSourceProvenance === 'NOT_ESTABLISHED')) return false;
  return summary
    .split(/[.!?\n]+/u)
    .some(
      (sentence) =>
        /\b(?:local (?:reporting|sources?|media|press|outlets?)|domestic (?:reporting|media|press)|national media)\b|lokaln\p{L}* (?:źród\p{L}*|medi\p{L}*|doniesieni\p{L}*)|krajow\p{L}* medi\p{L}*/iu.test(
          sentence,
        ) &&
        !/^\s*local (?:reporting|sources?|media|press|outlets?) (?:cannot be established|is not established|are not established|is unconfirmed|are unconfirmed)\s*$/iu.test(
          sentence,
        ),
    );
}
