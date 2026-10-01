import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ARTICLE_REF_PATTERN } from '@globalnews-ai/shared';
import { MAX_COMMENT_LENGTH, REPORT_REASONS } from './discussion.service';

/** The existing selection identity: the URL is verified to hash to the articleRef server-side. */
export class StoryArticleDto {
  @IsString()
  @Matches(ARTICLE_REF_PATTERN)
  articleRef!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  url!: string;
}

export class ArticleRefsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @Matches(ARTICLE_REF_PATTERN, { each: true })
  articleRefs!: string[];
}

export class PostCommentDto extends StoryArticleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_COMMENT_LENGTH + 200)
  body!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  /** Client-generated per draft; a retried submit returns the same comment. */
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  idempotencyKey!: string;
}

export class EditCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_COMMENT_LENGTH + 200)
  body!: string;
}

export class ReportCommentDto {
  @IsIn(REPORT_REASONS as unknown as string[])
  reason!: string;
}

export class ModerateCommentDto {
  @IsIn(['HIDE', 'REMOVE', 'RESTORE'])
  action!: 'HIDE' | 'REMOVE' | 'RESTORE';

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class LockDiscussionDto {
  @IsBoolean()
  locked!: boolean;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class MergeStoriesDto {
  @IsUUID()
  survivorId!: string;

  @IsUUID()
  mergedId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class SplitStoryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Matches(ARTICLE_REF_PATTERN, { each: true })
  articleRefs!: string[];

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class BackfillDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
}

export const ALERT_OPS = ['pause', 'resume', 'mute', 'unmute', 'remove', 'restore'] as const;
