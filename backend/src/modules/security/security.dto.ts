import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

/**
 * BETA-SECURITY-EVIDENCE-R1 — the read-only Security route's inputs.
 *
 * Validated by the ValidationPipe convention this codebase already applies to every other
 * controller, so a malformed request is refused before any method body runs.
 *
 * WHAT IS DELIBERATELY NOT A PARAMETER:
 *
 *   no `lang`      This lane serves no reader prose. Absence states reach the reader as
 *                  language-neutral codes and the frontend renders them in its own two
 *                  languages — the rule `TrustReason` set and `absence.ts` holds.
 *   no free text   There is no search, no filter and no query string over the claim text. A
 *                  free-text parameter against a Security corpus is a probe: it lets a
 *                  caller ask "do you hold anything matching this" and read the answer off
 *                  an empty result. `FREE_TEXT_FIELDS_ARE_NOT_FIELD_CONTROLLABLE` names the
 *                  same hazard on the write side.
 *   no axis filter A caller must not be able to request the covered axis alone. Every
 *                  response carries all five, because an omitted axis is the silence the
 *                  coverage contract exists to prevent.
 */
export class SecurityGeographyParamsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2)
  @Matches(/^[a-zA-Z]{2}$/)
  countryCode!: string;
}

export class SecurityReadQueryDto {
  /**
   * How many observations to return. Bounded at 30 by the same ceiling the country news
   * route uses, because it is the same corpus underneath and one surface should not be able
   * to pull a larger page of it than another.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;

  /**
   * The age window, in minutes.
   *
   * IT IS NOT WRITTEN INTO THE COVERAGE DECLARATION, and that is the point of the comment
   * there: a narrow question must not be able to make a source look narrow. The window
   * bounds what is RETURNED; the declaration states what the source can SEE.
   *
   * Capped at 30 days. An unbounded window would let one request scan the whole retained
   * corpus for a geography and classify every row in it.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(43200)
  maxAgeMinutes?: number;
}
