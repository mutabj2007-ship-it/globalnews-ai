import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NEWS_CATEGORIES, type NewsCategory } from '@globalnews-ai/shared';

export class CountryParamsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  countryCode!: string;
}

export class CountryNewsQueryDto {
  @IsOptional()
  @IsIn(NEWS_CATEGORIES)
  category?: NewsCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;
}
