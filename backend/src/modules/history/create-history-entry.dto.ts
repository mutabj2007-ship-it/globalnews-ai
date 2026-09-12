import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Milestone #57 — mirrors the existing SearchNewsDto/AnalyzeNewsDto
 * free-text query field convention.
 *
 * Query-limit correction — raised to 1000 alongside AnalyzeNewsDto.query
 * so a valid long analysis question can also be saved to search
 * history (a question the user was allowed to ask must also be
 * allowed to be recorded). SearchNewsDto.q intentionally remains at
 * its own separate 300-character limit — that is a different product
 * surface (direct news search) and is out of scope for this change.
 * countryCode bounded generously (60, matching CountryParamsDto's own
 * existing convention) since it is only ever a real ISO-style country
 * code/name, never long free text.
 */
export class CreateHistoryEntryDto {
  @IsString()
  @MaxLength(1000)
  query!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  countryCode?: string;
}
