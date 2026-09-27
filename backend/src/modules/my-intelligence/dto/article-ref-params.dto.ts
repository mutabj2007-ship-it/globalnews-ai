import { IsString, Matches } from 'class-validator';
import { ARTICLE_REF_PATTERN } from '@globalnews-ai/shared';

/** DELETE /saved/stories/:articleRef — a sha256 hex identity, nothing else. */
export class ArticleRefParamsDto {
  @IsString()
  @Matches(ARTICLE_REF_PATTERN)
  articleRef!: string;
}
