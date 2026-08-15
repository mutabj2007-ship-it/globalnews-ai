import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Milestone #57 — mirrors the existing SearchNewsDto/AnalyzeNewsDto
 * @MaxLength(300) convention for free-text query fields (see M56's
 * SearchNewsDto.q correction). countryCode bounded generously (60,
 * matching CountryParamsDto's own existing convention) since it is
 * only ever a real ISO-style country code/name, never long free text.
 */
export class CreateHistoryEntryDto {
  @IsString()
  @MaxLength(300)
  query!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  countryCode?: string;
}
