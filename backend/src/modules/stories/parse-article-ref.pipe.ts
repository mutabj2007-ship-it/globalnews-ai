import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isArticleRef } from '../news/identity/article-ref.util';

/** A path articleRef must be exactly 64 lowercase hex characters. */
@Injectable()
export class ParseArticleRefPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (!isArticleRef(value)) throw new BadRequestException('ARTICLE_REF');
    return value;
  }
}
