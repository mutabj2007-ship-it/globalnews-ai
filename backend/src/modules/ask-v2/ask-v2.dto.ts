import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Intent, Language } from './ask-compute.contract';

export class CreateThreadDto {
  @IsString() @Length(1, 128) idempotencyKey!: string;
  @IsIn(['en', 'pl']) language!: Language;
  @IsOptional() @IsString() @Length(1, 500) returnPath?: string;
}
export class QuoteTurnDto {
  @IsString() @Length(1, 128) idempotencyKey!: string;
  @IsString() @Length(2, 1000) question!: string;
  @IsIn(['en', 'pl']) language!: Language;
  @IsIn(['ask', 'deep-analysis', 'research-report']) intent!: Intent;
}
export class HistoryPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) after = 0;
}
