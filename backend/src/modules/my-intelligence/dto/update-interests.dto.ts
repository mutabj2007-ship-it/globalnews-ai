import { ArrayMaxSize, IsArray, IsIn } from 'class-validator';
import { MY_INTELLIGENCE_INTERESTS } from '@globalnews-ai/shared';

/**
 * INTEREST + SELECTION HOOK R1 — PUT /users/me/intelligence/interests.
 *
 * The ONLY thing a client may send is a list of governed interest ids. Free
 * text, unknown ids and any other field are rejected (IsIn + the global
 * ValidationPipe's forbidNonWhitelisted). Duplicates are collapsed by the
 * service, so a repeated id is a no-op rather than an error.
 */
export class UpdateInterestsDto {
  @IsArray()
  @ArrayMaxSize(MY_INTELLIGENCE_INTERESTS.length * 2)
  @IsIn(MY_INTELLIGENCE_INTERESTS as unknown as string[], { each: true })
  interests!: string[];
}
