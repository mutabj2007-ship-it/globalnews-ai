import { NEWS_CATEGORIES, type NewsCategory } from '@globalnews-ai/shared';
import { IsIn } from 'class-validator';

export class CategoryParamsDto {
  @IsIn(NEWS_CATEGORIES)
  category!: NewsCategory;
}
